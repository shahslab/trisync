import React, { createContext, useContext, useEffect, useState } from 'react'
import { View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  todayStr, displayToIso, isValidCalendarDate, daysBetween, subtractDays, makeId, BG,
} from './trainingUtils'

const STORAGE_KEY = 'oneplan/training/v1'

const TrainingContext = createContext(null)

export function TrainingProvider({ children }) {
  const today = todayStr()

  const [planRange, setPlanRange] = useState(null) // { start, raceDate, raceName, weeks }
  const [workouts, setWorkouts] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
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
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ planRange, workouts }))
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

    const idealStart = subtractDays(raceIso, weeks * 7 - 1)
    const start = idealStart < today ? today : idealStart

    setPlanRange({ start, raceDate: raceIso, raceName: raceNameInput.trim(), weeks })

    return { start }
  }

  const editPlanLength = () => setPlanRange(null)

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
    editPlanLength,
    workouts,
    addWorkout,
    updateWorkout,
    deleteWorkout,
  }

  if (!loaded) return <View style={{ flex: 1, backgroundColor: BG }} />

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>
}

export function useTraining() {
  const ctx = useContext(TrainingContext)
  if (!ctx) throw new Error('useTraining must be used within a TrainingProvider')
  return ctx
}