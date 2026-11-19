import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, View } from 'react-native'

import { accountsEnabled } from './config'
import {
  OfflineError, refreshAuth, fetchUserData, createUserData, updateUserData,
  deleteAccount as deleteAccountApi,
} from './pocketbase'
import {
  loadAuth, saveAuth, loadMeta, saveMeta, readLocal, writeLocal, clearLocal, hasPlans, SECTIONS,
} from './syncStore'
import { onLocalChange } from './changeBus'
import { confirmAsync } from './confirm'
import AuthScreen, { ChooseDataScreen } from './AuthScreen'
import { useAppearance, useTheme } from '../theme/ThemeContext'

// Accounts are required: until someone signs in, only the sign-in screen shows. Once signed
// in, the device keeps a full copy of the account's data (so the app opens offline), uploads
// each change a moment after it's saved, and pulls changes made on other devices whenever the
// app comes back to the foreground. Conflicts are settled whole-account, last write wins.

const UPLOAD_DELAY_MS = 1500
const PULL_EVERY_MS = 60 * 1000

const AccountContext = createContext({ enabled: false })

// { enabled, user: { id, email }, status: 'synced' | 'saving' | 'offline', signOut, deleteAccount, syncNow }
export const useAccount = () => useContext(AccountContext)

// Key order can differ between what the device and the server stored, so compare canonically
function canon(value) {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canon(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function AccountGate({ children }) {
  if (!accountsEnabled) return children
  return <SignedInGate>{children}</SignedInGate>
}

function SignedInGate({ children }) {
  const t = useTheme()
  const { reload: reloadAppearance } = useAppearance()

  // 'loading' | 'signedOut' | 'choose' | 'ready'
  const [phase, setPhase] = useState('loading')
  const [auth, setAuth] = useState(null)
  const authRef = useRef(null)
  const [status, setStatus] = useState('synced')
  const [notice, setNotice] = useState('')
  const [choice, setChoice] = useState(null) // { resolve } while asking which data to keep
  // Bumped when the server's data replaces the device's, to remount the providers below
  const [dataVersion, setDataVersion] = useState(0)

  const queue = useRef(Promise.resolve()) // sync steps run one at a time
  const uploadTimer = useRef(null)
  const known = useRef({}) // section → canon() of what the server has
  const changeSeq = useRef(0) // counts local changes, so an upload knows if more came in meanwhile
  const uploadedSeq = useRef(0)
  const pending = () => changeSeq.current !== uploadedSeq.current

  const serial = (step) => {
    const run = queue.current.then(step, step)
    queue.current = run.catch(() => {})
    return run
  }

  const remember = (data) => {
    for (const section of Object.keys(SECTIONS)) known.current[section] = canon(data?.[section])
  }

  // The server's copy replaces the device's; providers remount and read it
  const applyRemote = async (record) => {
    await writeLocal(record.data)
    remember(record.data)
    await saveMeta({ recordId: record.id, updated: record.updated, dirty: false })
    reloadAppearance()
    setDataVersion((v) => v + 1)
  }

  // Writes the device's data to the account (creating its record the first time)
  const pushLocal = async (a) => {
    const seq = changeSeq.current
    const local = await readLocal()
    const meta = await loadMeta()
    let record = null
    if (meta.recordId) {
      try {
        record = await updateUserData(a, meta.recordId, local)
      } catch (e) {
        if (e.status !== 404) throw e
      }
    }
    if (!record) {
      const existing = await fetchUserData(a)
      record = existing ? await updateUserData(a, existing.id, local) : await createUserData(a, local)
    }
    remember(local)
    uploadedSeq.current = seq
    await saveMeta({ userId: a.user.id, recordId: record.id, updated: record.updated, dirty: pending() })
    return record
  }

  // A sign-in that no longer works (expired, password changed, account deleted elsewhere).
  // The device's data and its unsynced changes stay until the same account signs back in.
  const sessionEnded = () => {
    authRef.current = null
    setAuth(null)
    setNotice('Your session ended. Sign in again; changes on this device are kept.')
    setPhase('signedOut')
  }

  const handleSyncError = (e) => {
    if (e.status === 401 || e.status === 403) sessionEnded()
    else setStatus('offline')
  }

  const upload = () => serial(async () => {
    const a = authRef.current
    if (!a || !pending()) return
    try {
      await pushLocal(a)
      setStatus(pending() ? 'saving' : 'synced')
    } catch (e) {
      handleSyncError(e)
    }
  })

  // Fetches changes made on other devices. Local changes not uploaded yet go up instead.
  const pull = useCallback(() => serial(async () => {
    const a = authRef.current
    if (!a) return
    try {
      const meta = await loadMeta()
      if (pending() || meta.dirty) {
        changeSeq.current += pending() ? 0 : 1 // a change saved before a reload
        await pushLocal(a)
      } else {
        const record = await fetchUserData(a)
        if (!record) await pushLocal(a)
        else if (record.updated !== meta.updated) await applyRemote(record)
      }
      setStatus(pending() ? 'saving' : 'synced')
    } catch (e) {
      handleSyncError(e)
    }
  }), [])

  // Asks whether this device's plans or the account's should win; resolves 'device' | 'account'
  const askWhichData = () => new Promise((resolve) => {
    setChoice({ resolve })
    setPhase('choose')
  })

  // Brings the device and the account in line after signing in or opening the app.
  // Throws if that can't happen yet (offline the first time this account is used here).
  const hydrate = async (a) => {
    let meta = await loadMeta()
    if (meta.userId && meta.userId !== a.user.id) {
      // Another account's data: it isn't this user's to keep or upload
      await clearLocal({ keepAuth: true })
      meta = {}
    }
    const sameAccount = meta.userId === a.user.id

    let record
    try {
      record = await fetchUserData(a)
    } catch (e) {
      if (e instanceof OfflineError && sameAccount) {
        setStatus('offline')
        if (meta.dirty) changeSeq.current += 1 // upload once back online
        return
      }
      throw e
    }

    const local = await readLocal()
    if (sameAccount) {
      if (meta.dirty) {
        changeSeq.current += 1
        await pushLocal(a)
      } else if (!record) {
        changeSeq.current += 1
        await pushLocal(a)
      } else if (record.updated !== meta.updated) {
        await applyRemote(record)
      } else {
        remember(record.data)
      }
    } else if (!record || (hasPlans(local) && !hasPlans(record.data))) {
      // A new account, or one without plans yet: this device's data (from before accounts) moves in
      changeSeq.current += 1
      await pushLocal(a)
    } else if (hasPlans(local) && canon(local.training) !== canon(record.data?.training)) {
      const keep = await askWhichData()
      setPhase('loading')
      if (keep === 'device') {
        changeSeq.current += 1
        await pushLocal(a)
      } else {
        await applyRemote(record)
      }
    } else {
      await applyRemote(record)
    }
    await saveMeta({ userId: a.user.id })
    setStatus(pending() ? 'saving' : 'synced')
  }

  const startSession = async (a) => {
    await saveAuth(a)
    authRef.current = a
    setAuth(a)
    await hydrate(a)
    reloadAppearance()
    setDataVersion((v) => v + 1)
    setNotice('')
    setPhase('ready')
  }

  // From the sign-in screen; errors are shown there
  const signedIn = async (a) => {
    try {
      await startSession(a)
    } catch (e) {
      authRef.current = null
      setAuth(null)
      await saveAuth(null)
      setPhase('signedOut')
      throw e
    }
  }

  // Opening the app: reuse the saved sign-in, refreshing its token when online
  useEffect(() => {
    (async () => {
      const saved = await loadAuth()
      if (!saved) return setPhase('signedOut')
      let a = saved
      try {
        a = await refreshAuth(saved.token)
      } catch (e) {
        if (!(e instanceof OfflineError)) {
          await saveAuth(null)
          setNotice('Your session ended. Sign in again; changes on this device are kept.')
          return setPhase('signedOut')
        }
      }
      try {
        await startSession(a)
      } catch (e) {
        setNotice(e.message)
        setPhase('signedOut')
      }
    })()
  }, [])

  // Saved changes go up shortly after they're made
  useEffect(() => onLocalChange((section, json) => {
    if (!authRef.current) return
    let value = null
    try {
      value = json == null ? null : JSON.parse(json)
    } catch {
      return
    }
    if (known.current[section] === canon(value)) return
    changeSeq.current += 1
    setStatus('saving')
    saveMeta({ dirty: true })
    clearTimeout(uploadTimer.current)
    uploadTimer.current = setTimeout(upload, UPLOAD_DELAY_MS)
  }), [])

  // Pull other devices' changes when the app returns to the foreground, and now and then
  useEffect(() => {
    if (phase !== 'ready') return undefined
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') pull() })
    const timer = setInterval(() => { if (AppState.currentState === 'active') pull() }, PULL_EVERY_MS)
    return () => {
      sub.remove()
      clearInterval(timer)
    }
  }, [phase, pull])

  const signOut = async () => {
    clearTimeout(uploadTimer.current)
    if (pending()) await upload()
    if (pending()) {
      const ok = await confirmAsync(
        'Sign out?',
        'Some changes on this device haven\'t reached your account yet, because the server can\'t be reached. Signing out now loses them.',
        'Sign out',
      )
      if (!ok) return
    }
    await serial(async () => {
      await clearLocal()
      authRef.current = null
      changeSeq.current = uploadedSeq.current
      known.current = {}
      setAuth(null)
      setNotice('')
      reloadAppearance()
      setPhase('signedOut')
    })
  }

  const deleteAccount = async () => {
    const ok = await confirmAsync(
      'Delete your account?',
      'This permanently deletes your TriSync account and every plan, workout and setting in it, on all devices. It can\'t be undone.',
      'Delete account',
    )
    if (!ok) return { cancelled: true }
    try {
      await deleteAccountApi(authRef.current)
    } catch (e) {
      return { error: e.message }
    }
    clearTimeout(uploadTimer.current)
    await clearLocal()
    authRef.current = null
    changeSeq.current = uploadedSeq.current
    known.current = {}
    setAuth(null)
    setNotice('Your account was deleted.')
    reloadAppearance()
    setPhase('signedOut')
    return {}
  }

  if (phase === 'signedOut') return <AuthScreen onSignedIn={signedIn} notice={notice} />
  if (phase === 'choose') {
    return (
      <ChooseDataScreen
        email={auth?.user.email}
        onChoose={(keep) => {
          choice?.resolve(keep)
          setChoice(null)
        }}
      />
    )
  }
  if (phase !== 'ready') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bgSolid }}>
        <ActivityIndicator color={t.primary} />
      </View>
    )
  }

  const value = { enabled: true, user: auth.user, status, signOut, deleteAccount, syncNow: pull }
  return (
    <AccountContext.Provider value={value}>
      <React.Fragment key={dataVersion}>{children}</React.Fragment>
    </AccountContext.Provider>
  )
}
