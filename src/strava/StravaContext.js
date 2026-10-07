import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  hasKeys, callbackDomain, canSyncType, exchangeCode, refreshSession, isExpired,
  startWebLogin, takeWebRedirect, nativeLogin,
  activitiesOnDate, matchingActivities, brickPartFor, applyWorkoutToActivity, getActivity,
} from './stravaApi'

export const STORAGE_KEY = 'trisync/strava/v1'
// This user's own Strava API app ({ clientId, clientSecret }), entered in Settings
export const KEYS_STORAGE_KEY = 'trisync/strava-keys/v1'
const LEGACY_STORAGE_KEY = 'oneplan/strava/v1'

const StravaContext = createContext(null)

export function notify(message) {
  if (Platform.OS === 'web') window.alert(message)
  else Alert.alert('Strava', message)
}

export function StravaProvider({ children }) {
  const [session, setSession] = useState(null) // { accessToken, refreshToken, expiresAt, athleteName }
  const sessionRef = useRef(null)
  const [keys, setKeys] = useState(null)
  const keysRef = useRef(null)

  const saveSession = async (next) => {
    sessionRef.current = next
    setSession(next)
    if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else await AsyncStorage.removeItem(STORAGE_KEY)
  }

  const saveKeys = async (next) => {
    const cleaned = next && { clientId: next.clientId.trim(), clientSecret: next.clientSecret.trim() }
    const changed = cleaned?.clientId !== keysRef.current?.clientId || cleaned?.clientSecret !== keysRef.current?.clientSecret
    keysRef.current = hasKeys(cleaned) ? cleaned : null
    setKeys(keysRef.current)
    if (keysRef.current) await AsyncStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keysRef.current))
    else await AsyncStorage.removeItem(KEYS_STORAGE_KEY)
    // A login belongs to the Strava app that issued it
    if (changed) await saveSession(null)
  }

  const finishLogin = async (redirect) => {
    try {
      await saveSession(await exchangeCode(keysRef.current, redirect))
    } catch (e) {
      notify(e.message)
    }
  }

  useEffect(() => {
    (async () => {
      const storedKeys = await AsyncStorage.getItem(KEYS_STORAGE_KEY)
      if (storedKeys) {
        keysRef.current = JSON.parse(storedKeys)
        setKeys(keysRef.current)
      }
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
      const legacy = stored ? null : await AsyncStorage.getItem(LEGACY_STORAGE_KEY)
      if (stored) {
        sessionRef.current = JSON.parse(stored)
        setSession(sessionRef.current)
      } else if (legacy) {
        // Saved before the OnePlan → TriSync rename
        await saveSession(JSON.parse(legacy))
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY)
      }
      // Returning from Strava's login page on web
      const redirect = takeWebRedirect()
      if (redirect) await finishLogin(redirect)
    })()
  }, [])

  const connect = async () => {
    if (!keysRef.current) {
      notify('Add your Strava API Client ID and Secret in Settings → Strava first.')
      return
    }
    if (Platform.OS === 'web') {
      startWebLogin(keysRef.current)
      return
    }
    const redirect = await nativeLogin(keysRef.current)
    if (redirect) await finishLogin(redirect)
  }

  const disconnect = () => saveSession(null)

  const accessToken = async () => {
    let current = sessionRef.current
    if (!current) throw new Error('Connect Strava first.')
    if (!keysRef.current) throw new Error('Add your Strava API keys in Settings → Strava.')
    if (isExpired(current)) {
      current = await refreshSession(keysRef.current, current)
      await saveSession(current)
    }
    return current.accessToken
  }

  // Finds the Strava activity for a workout and writes the workout onto it.
  // linkedActivityIds: activities already synced to other workouts (never offered again).
  // brickSiblings: the day's other Brick workouts already synced, renumbered if needed.
  // Pass activityId to skip matching (after the user picked one).
  // Returns { status: 'synced', activity } | { status: 'choose', activities } | { status: 'none' }
  const syncWorkout = async (workout, { linkedActivityIds = [], brickSiblings = [] } = {}, activityId) => {
    const token = await accessToken()
    let dayActivities = null
    const loadDay = async () => (dayActivities ||= await activitiesOnDate(token, workout.date))

    let id = activityId || workout.stravaActivityId
    if (!id) {
      const sameDay = (await loadDay()).filter((a) => !linkedActivityIds.includes(a.id))
      if (sameDay.length === 0) return { status: 'none' }
      const matches = matchingActivities(sameDay, workout.type)
      // Brick legs always ask: a lone run or ride that day isn't necessarily this leg
      if (matches.length !== 1 || workout.type === 'Brick') {
        return { status: 'choose', activities: matches.length ? matches : sameDay }
      }
      id = matches[0].id
    }

    if (workout.type !== 'Brick') {
      return { status: 'synced', activity: await applyWorkoutToActivity(token, id, workout) }
    }

    const day = await loadDay()
    const legIds = [id, ...brickSiblings.map((w) => w.stravaActivityId)]
    const activity = await applyWorkoutToActivity(token, id, workout, brickPartFor(day, legIds, id))
    // A leg synced earlier may have a new number now this one is known (e.g. the run was
    // marked first and called Part 1, then the earlier ride arrives). Unchanged ones aren't rewritten.
    try {
      for (const sibling of brickSiblings) {
        await applyWorkoutToActivity(token, sibling.stravaActivityId, sibling, brickPartFor(day, legIds, sibling.stravaActivityId))
      }
    } catch (e) {
      notify(`Synced, but couldn't renumber the other brick leg on Strava: ${e.message}`)
    }
    return { status: 'synced', activity }
  }

  const value = {
    keys,
    hasKeys: !!keys,
    saveKeys,
    callbackDomain: callbackDomain(),
    connected: !!session,
    athleteName: session?.athleteName,
    connect,
    disconnect,
    canSync: (workout) => !!session && canSyncType(workout.type),
    syncWorkout,
    fetchActivity: async (activityId) => getActivity(await accessToken(), activityId),
  }

  return <StravaContext.Provider value={value}>{children}</StravaContext.Provider>
}

export function useStrava() {
  const ctx = useContext(StravaContext)
  if (!ctx) throw new Error('useStrava must be used within a StravaProvider')
  return ctx
}
