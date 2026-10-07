import React, { createContext, useContext, useEffect, useState } from 'react'
import { View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  todayStr, displayToIso, isValidCalendarDate, daysBetween, subtractDays, makeId,
} from './trainingUtils'

export const STORAGE_KEY = 'trisync/training/v1'
const LEGACY_STORAGE_KEY = 'oneplan/training/v1' // before the OnePlan → TriSync rename

const TrainingContext = createContext(null)

export function TrainingProvider({ children }) {
  const today = todayStr()

  const [planRange, setPlanRange] = useState(null) // { start, raceDate, raceName, weeks }
  const [workouts, setWorkouts] = useState([])
  // True while the setup form is open for an existing plan; the plan stays until saved
  const [editingPlan, setEditingPlan] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        // The save effect below moves legacy data to the new key once loaded
        return stored || AsyncStorage.getItem(LEGACY_STORAGE_KEY)
      })
      .then((stored) => {
        if (!stored) return
        const data = JSON.parse(stored)
        setPlanRange(data.planRange || null)
        setWorkouts(data.workouts || [])
      })
      .finally(() => setLoaded(true))
  }, [])

  // Save only after loading, so the empty initial state never overwrites stored data
  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ planRange, workouts }))
      .then(() => AsyncStorage.removeItem(LEGACY_STORAGE_KEY))
  }, [loaded, planRange, workouts])

  const createPlan = ({ raceNameInput, raceDateInput, weeksInput }) => {
    const raceIso = displayToIso(raceDateInput)
    const weeks = parseInt(weeksInput, 10)

    if (!raceIso || !isValidCalendarDate(raceIso)) {
      return { error: 'Race date must be in DD-MM-YYYY format.' }
    }
    if (daysBetween(today, raceIso) <= 0) {
      return { error: 'Race date must be after today.' }
    }
    if (!weeks || weeks < 1) {
      return { error: 'Enter a valid number of training weeks (1 or more).' }
    }

    // New plans can't start in the past. An edited plan that has already begun keeps
    // its original start rather than jumping to today.
    const earliestStart = planRange && planRange.start < today ? planRange.start : today
    const idealStart = subtractDays(raceIso, weeks * 7 - 1)
    const start = idealStart < earliestStart ? earliestStart : idealStart

    setPlanRange({ start, raceDate: raceIso, raceName: raceNameInput.trim(), weeks })
    setEditingPlan(false)

    return { start }
  }

  const startEditingPlan = () => setEditingPlan(true)
  const cancelEditingPlan = () => setEditingPlan(false)

  const addWorkout = ({ date, type, title, notes }) => {
    setWorkouts((prev) => [
      ...prev,
      {
        id: makeId(),
        date,
        type,
        title: (title || '').trim(),
        notes: (notes || '').trim(),
        status: 'pending',
      },
    ])
  }

  const updateWorkout = (id, updates) => {
    setWorkouts((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)))
  }

  const deleteWorkout = (id) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }

  const value = {
    today,
    planRange,
    createPlan,
    editingPlan,
    startEditingPlan,
    cancelEditingPlan,
    workouts,
    addWorkout,
    updateWorkout,
    deleteWorkout,
  }

  if (!loaded) return <View style={{ flex: 1 }} />

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>
}

export function useTraining() {
  const ctx = useContext(TrainingContext)
  if (!ctx) throw new Error('useTraining must be used within a TrainingProvider')
  return ctx
}