import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  todayStr, displayToIso, isValidCalendarDate, daysBetween, subtractDays, makeId,
} from './trainingUtils'

// { plans: [{ id, raceName, raceDate, start, weeks, workouts }], activePlanId }
export const STORAGE_KEY = 'trisync/training/v2'
const V1_STORAGE_KEY = 'trisync/training/v1' // one plan: { planRange, workouts }
const LEGACY_STORAGE_KEY = 'oneplan/training/v1' // before the OnePlan → TriSync rename

// Accepts saved or backed-up training data in any version and returns the current shape
export function normalizeTrainingData(data) {
  if (Array.isArray(data?.plans)) {
    const plans = data.plans.map((p) => ({ ...p, workouts: p.workouts || [] }))
    const activePlanId = plans.some((p) => p.id === data.activePlanId) ? data.activePlanId : (plans[0]?.id ?? null)
    return { plans, activePlanId }
  }
  // v1 held a single plan; its workouts only ever existed alongside it
  if (data?.planRange) {
    const plan = { id: makeId(), ...data.planRange, workouts: data.workouts || [] }
    return { plans: [plan], activePlanId: plan.id }
  }
  return { plans: [], activePlanId: null }
}

const byRaceDate = (a, b) => a.raceDate.localeCompare(b.raceDate)

const TrainingContext = createContext(null)

export function TrainingProvider({ children }) {
  const today = todayStr()

  const [plans, setPlans] = useState([])
  const [activePlanId, setActivePlanId] = useState(null)
  // The setup form is open: editing the current plan (kept until saved) or creating a new one
  const [editingPlan, setEditingPlan] = useState(false)
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      // The save effect below moves older data to the current key once loaded
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
        || await AsyncStorage.getItem(V1_STORAGE_KEY)
        || await AsyncStorage.getItem(LEGACY_STORAGE_KEY)
      if (stored) {
        const data = normalizeTrainingData(JSON.parse(stored))
        setPlans(data.plans)
        setActivePlanId(data.activePlanId)
      }
    })().finally(() => setLoaded(true))
  }, [])

  // Save only after loading, so the empty initial state never overwrites stored data
  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ plans, activePlanId }))
      .then(() => AsyncStorage.multiRemove([V1_STORAGE_KEY, LEGACY_STORAGE_KEY]))
  }, [loaded, plans, activePlanId])

  const activePlan = plans.find((p) => p.id === activePlanId) || null
  const planRange = useMemo(() => (activePlan
    ? { start: activePlan.start, raceDate: activePlan.raceDate, raceName: activePlan.raceName, weeks: activePlan.weeks }
    : null), [activePlan])
  const workouts = activePlan?.workouts || []

  // Applies fn to the current plan's workout list
  const updateActiveWorkouts = (fn) => {
    setPlans((prev) => prev.map((p) => (p.id === activePlanId ? { ...p, workouts: fn(p.workouts) } : p)))
  }

  const createPlan = ({ raceNameInput, raceDateInput, weeksInput }) => {
    const raceIso = displayToIso(raceDateInput)
    const weeks = parseInt(weeksInput, 10)

    if (!raceIso || !isValidCalendarDate(raceIso)) {
      return { error: 'Choose a race date.' }
    }
    if (daysBetween(today, raceIso) <= 0) {
      return { error: 'Race date must be after today.' }
    }
    if (!weeks || weeks < 1) {
      return { error: 'Enter a valid number of training weeks (1 or more).' }
    }

    const editing = editingPlan && activePlan
    // New plans can't start in the past. An edited plan that has already begun keeps
    // its original start rather than jumping to today.
    const earliestStart = editing && activePlan.start < today ? activePlan.start : today
    const idealStart = subtractDays(raceIso, weeks * 7 - 1)
    const start = idealStart < earliestStart ? earliestStart : idealStart
    const fields = { start, raceDate: raceIso, raceName: raceNameInput.trim(), weeks }

    if (editing) {
      setPlans((prev) => prev.map((p) => (p.id === activePlanId ? { ...p, ...fields } : p)).sort(byRaceDate))
    } else {
      const plan = { id: makeId(), ...fields, workouts: [] }
      setPlans((prev) => [...prev, plan].sort(byRaceDate))
      setActivePlanId(plan.id)
    }
    setEditingPlan(false)
    setCreatingPlan(false)

    return { start }
  }

  const startEditingPlan = () => {
    setCreatingPlan(false)
    setEditingPlan(true)
  }
  const startNewPlan = () => {
    setEditingPlan(false)
    setCreatingPlan(true)
  }
  const cancelEditingPlan = () => {
    setEditingPlan(false)
    setCreatingPlan(false)
  }

  const selectPlan = (id) => {
    setActivePlanId(id)
    cancelEditingPlan()
  }

  const deletePlan = (id) => {
    const remaining = plans.filter((p) => p.id !== id)
    setPlans(remaining)
    if (id === activePlanId) {
      // Fall back to the next race still ahead, else the most recent one
      const next = remaining.find((p) => p.raceDate >= today) || remaining[remaining.length - 1]
      setActivePlanId(next?.id ?? null)
      cancelEditingPlan()
    }
  }

  const addWorkout = ({ date, type, title, notes }) => {
    updateActiveWorkouts((prev) => [
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
    updateActiveWorkouts((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)))
  }

  const deleteWorkout = (id) => {
    updateActiveWorkouts((prev) => prev.filter((w) => w.id !== id))
  }

  const value = {
    today,
    plans,
    activePlanId,
    selectPlan,
    deletePlan,
    startNewPlan,
    creatingPlan,
    planRange,
    createPlan,
    editingPlan,
    startEditingPlan,
    cancelEditingPlan,
    workouts,
    // Every plan's workouts, e.g. so a Strava activity is never linked twice across plans
    allWorkouts: plans.flatMap((p) => p.workouts),
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
