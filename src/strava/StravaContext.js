import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  isStravaConfigured, canSyncType, exchangeCode, refreshSession, isExpired,
  startWebLogin, takeWebRedirect, nativeLogin,
  activitiesOnDate, matchingActivities, applyWorkoutToActivity,
} from './stravaApi'

const STORAGE_KEY = 'oneplan/strava/v1'

const StravaContext = createContext(null)

export function notify(message) {
  if (Platform.OS === 'web') window.alert(message)
  else Alert.alert('Strava', message)
}

export function StravaProvider({ children }) {
  const [session, setSession] = useState(null) // { accessToken, refreshToken, expiresAt, athleteName }
  const sessionRef = useRef(null)

  const saveSession = async (next) => {
    sessionRef.current = next
    setSession(next)
    if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else await AsyncStorage.removeItem(STORAGE_KEY)
  }

  const finishLogin = async (redirect) => {
    try {
      await saveSession(await exchangeCode(redirect))
    } catch (e) {
      notify(e.message)
    }
  }

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
      if (stored) {
        sessionRef.current = JSON.parse(stored)
        setSession(sessionRef.current)
      }
      // Returning from Strava's login page on web
      const redirect = takeWebRedirect()
      if (redirect) await finishLogin(redirect)
    })()
  }, [])

  const connect = async () => {
    if (!isStravaConfigured()) {
      notify('Strava isn\'t set up yet. Add your Strava API Client ID and secret to .env.local, then restart the dev server.')
      return
    }
    if (Platform.OS === 'web') {
      startWebLogin()
      return
    }
    const redirect = await nativeLogin()
    if (redirect) await finishLogin(redirect)
  }

  const disconnect = () => saveSession(null)

  const accessToken = async () => {
    let current = sessionRef.current
    if (!current) throw new Error('Connect Strava first.')
    if (isExpired(current)) {
      current = await refreshSession(current)
      await saveSession(current)
    }
    return current.accessToken
  }

  // Finds the Strava activity for a workout and writes the plan onto it.
  // Pass activityId to skip matching (after the user picked one).
  // Returns { status: 'synced', activity } | { status: 'choose', activities } | { status: 'none' }
  const syncWorkout = async (workout, activityId) => {
    const token = await accessToken()
    let id = activityId || workout.stravaActivityId
    if (!id) {
      const sameDay = await activitiesOnDate(token, workout.date)
      if (sameDay.length === 0) return { status: 'none' }
      const matches = matchingActivities(sameDay, workout.type)
      if (matches.length !== 1) return { status: 'choose', activities: matches.length ? matches : sameDay }
      id = matches[0].id
    }
    const activity = await applyWorkoutToActivity(token, id, workout)
    return { status: 'synced', activity }
  }

  const value = {
    connected: !!session,
    athleteName: session?.athleteName,
    connect,
    disconnect,
    canSync: (workout) => !!session && canSyncType(workout.type),
    syncWorkout,
  }

  return <StravaContext.Provider value={value}>{children}</StravaContext.Provider>
}

export function useStrava() {
  const ctx = useContext(StravaContext)
  if (!ctx) throw new Error('useStrava must be used within a StravaProvider')
  return ctx
}
