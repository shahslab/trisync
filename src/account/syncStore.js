import AsyncStorage from '@react-native-async-storage/async-storage'

import { STORAGE_KEY as TRAINING_KEY } from '../training/TrainingContext'
import { STORAGE_KEY as APPEARANCE_KEY } from '../theme/ThemeContext'
import { STORAGE_KEY as STRAVA_SESSION_KEY, KEYS_STORAGE_KEY as STRAVA_KEYS_KEY } from '../strava/StravaContext'

// What an account syncs: the same sections as a backup file. The Strava login session stays
// on each device (its tokens grant access to the athlete's Strava account).
export const SECTIONS = {
  training: TRAINING_KEY,
  appearance: APPEARANCE_KEY,
  stravaKeys: STRAVA_KEYS_KEY,
}

export const AUTH_KEY = 'trisync/account/v1' // { token, user: { id, email } }
// Which account the device's data belongs to, the server version it matches, and whether
// it has changes the server hasn't got yet: { userId, recordId, updated, dirty }
const META_KEY = 'trisync/sync/v1'

const parse = (json) => (json ? JSON.parse(json) : null)

export const loadAuth = async () => parse(await AsyncStorage.getItem(AUTH_KEY))
export const saveAuth = (auth) => (auth ? AsyncStorage.setItem(AUTH_KEY, JSON.stringify(auth)) : AsyncStorage.removeItem(AUTH_KEY))

export const loadMeta = async () => parse(await AsyncStorage.getItem(META_KEY)) || {}
export async function saveMeta(changes) {
  const next = { ...(await loadMeta()), ...changes }
  await AsyncStorage.setItem(META_KEY, JSON.stringify(next))
  return next
}

// The device's synced data as one object: { training, appearance, stravaKeys } (missing = null)
export async function readLocal() {
  const data = {}
  for (const [section, key] of Object.entries(SECTIONS)) data[section] = parse(await AsyncStorage.getItem(key))
  return data
}

// Replaces the device's synced data with the server's. Different Strava keys mean the
// device's Strava login no longer fits (tokens belong to the app that issued them).
export async function writeLocal(data) {
  const previousKeys = await AsyncStorage.getItem(STRAVA_KEYS_KEY)
  for (const [section, key] of Object.entries(SECTIONS)) {
    if (data?.[section] != null) await AsyncStorage.setItem(key, JSON.stringify(data[section]))
    else await AsyncStorage.removeItem(key)
  }
  if (JSON.stringify(data?.stravaKeys ?? null) !== (previousKeys ?? 'null')) {
    await AsyncStorage.removeItem(STRAVA_SESSION_KEY)
  }
}

// On sign-out: nothing of this account stays on the device. keepAuth keeps the sign-in
// being set up, when another account's data is cleared away.
export async function clearLocal({ keepAuth = false } = {}) {
  await AsyncStorage.multiRemove([
    ...Object.values(SECTIONS), STRAVA_SESSION_KEY, META_KEY, ...(keepAuth ? [] : [AUTH_KEY]),
  ])
}

// Marks the device's data as changed, for writes that happen before a reload (backup import)
export const markDirty = () => saveMeta({ dirty: true })

export const hasPlans = (data) => (data?.training?.plans?.length || 0) > 0
