import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  todayStr, displayToIso, isValidCalendarDate, daysBetween, subtractDays, makeId, formatPlanNotes,
} from './trainingUtils'

// { plans: [{ id, raceName, raceDate, start, weeks, source, workouts }], activePlanId }
// source: where a plan's workouts came from, shown when editing it (missing on plans made before it existed):
// { kind: 'library', distance, level, weeks } | { kind: 'import', fileName, name } | { kind: 'manual' }
export const STORAGE_KEY = 'trisync/training/v2'
const V1_STORAGE_KEY = 'trisync/training/v1' // one plan: { planRange, workouts }
const LEGACY_STORAGE_KEY = 'oneplan/training/v1' // before the OnePlan → TriSync rename

// Accepts saved or backed-up training data in any version and returns the current shape
export function normalizeTrainingData(data) {
  if (Array.isArray(data?.plans)) {
    // Older plan notes were saved as one paragraph; laying them out again is harmless if already done
    const plans = data.plans.map((p) => ({
      ...p,
      workouts: (p.workouts || []).map((w) => (w.notes ? { ...w, notes: formatPlanNotes(w.notes) } : w)),
    }))
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

// Library workouts are numbered by week (from 1) and day (0 = the plan's first day)
const workoutsFromTemplate = (template, start) => template.workouts.map((w) => ({
  id: makeId(),
  date: subtractDays(start, -((w.week - 1) * 7 + w.day)),
  type: w.type,
  title: w.title,
  notes: formatPlanNotes(w.notes),
  status: 'pending',
}))

// Workouts that are part of the training record: marked done or partial, or missed (still pending on a
// past day). Switching plans keeps these and replaces the rest.
export const isLogged = (today) => (w) => w.status !== 'pending' || w.date < today

// The workouts that move together: a brick's legs stay on the same day
const groupOf = (list, workout) => (workout.type === 'Brick'
  ? list.filter((w) => w.type === 'Brick' && w.date === workout.date)
  : [workout])

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
    ? { start: activePlan.start, raceDate: activePlan.raceDate, raceName: activePlan.raceName, weeks: activePlan.weeks, source: activePlan.source }
    : null), [activePlan])
  const workouts = activePlan?.workouts || []

  // Applies fn to the current plan's workout list
  const updateActiveWorkouts = (fn) => {
    setPlans((prev) => prev.map((p) => (p.id === activePlanId ? { ...p, workouts: fn(p.workouts) } : p)))
  }

  // template: an optional library or imported plan ({ weeks, workouts: [{ week, day, type, title, notes }] })
  // whose workouts fill a new plan, placed so its final day (race day) falls on the race date.
  // Editing with a template switches the plan: workouts already logged (done, partial, or missed
  // because their day has passed) stay, and the rest are replaced by the template's from today on.
  const createPlan = ({ raceNameInput, raceDateInput, weeksInput, template, source }) => {
    const raceIso = displayToIso(raceDateInput)
    const weeks = template ? template.weeks : parseInt(weeksInput, 10)

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
    if (template && editing) return switchPlan({ raceIso, raceName: raceNameInput.trim(), template, source })
    if (template && !editing && subtractDays(raceIso, weeks * 7 - 1) < today) {
      return { error: `This ${weeks}-week plan would have to start before today. Pick a later race date or a shorter plan.` }
    }
    // New plans can't start in the past. An edited plan that has already begun keeps
    // its original start rather than jumping to today.
    const earliestStart = editing && activePlan.start < today ? activePlan.start : today
    const idealStart = subtractDays(raceIso, weeks * 7 - 1)
    const start = idealStart < earliestStart ? earliestStart : idealStart
    const fields = { start, raceDate: raceIso, raceName: raceNameInput.trim(), weeks }

    if (editing) {
      setPlans((prev) => prev.map((p) => (p.id === activePlanId ? { ...p, ...fields } : p)).sort(byRaceDate))
    } else {
      const plan = { id: makeId(), ...fields, source, workouts: template ? workoutsFromTemplate(template, start) : [] }
      setPlans((prev) => [...prev, plan].sort(byRaceDate))
      setActivePlanId(plan.id)
    }
    setEditingPlan(false)
    setCreatingPlan(false)

    return { start }
  }

  const switchPlan = ({ raceIso, raceName, template, source }) => {
    const templateStart = subtractDays(raceIso, template.weeks * 7 - 1)
    // A plan that has begun keeps its start, so logged workouts stay inside it and week numbers don't shift
    const start = activePlan.start < today ? activePlan.start : (templateStart < today ? today : templateStart)
    const weeks = Math.ceil((daysBetween(start, raceIso) + 1) / 7)
    const kept = activePlan.workouts.filter(isLogged(today))
    const added = workoutsFromTemplate(template, templateStart).filter((w) => w.date >= today && w.date >= start)
    const workouts = [...kept, ...added].sort((a, b) => a.date.localeCompare(b.date))
    setPlans((prev) => prev.map((p) => (p.id === activePlanId
      ? { ...p, start, raceDate: raceIso, raceName, weeks, source, workouts }
      : p)).sort(byRaceDate))
    setEditingPlan(false)
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

  // Moves a workout (with its brick partner) to another day
  const moveWorkout = (id, date) => {
    updateActiveWorkouts((prev) => {
      const group = groupOf(prev, prev.find((w) => w.id === id)).map((w) => w.id)
      return prev.map((w) => (group.includes(w.id) ? { ...w, date } : w))
    })
  }

  // Swaps the days of two workouts (bricks move with both legs)
  const swapWorkouts = (idA, idB) => {
    updateActiveWorkouts((prev) => {
      const a = prev.find((w) => w.id === idA)
      const b = prev.find((w) => w.id === idB)
      const groupA = groupOf(prev, a).map((w) => w.id)
      const groupB = groupOf(prev, b).map((w) => w.id)
      return prev.map((w) => (groupA.includes(w.id) ? { ...w, date: b.date } : groupB.includes(w.id) ? { ...w, date: a.date } : w))
    })
  }

  // The current plan's days in the same plan week as date (weeks count from the plan's start)
  const planWeekDates = (date) => {
    if (!activePlan) return []
    const first = subtractDays(activePlan.start, -Math.floor(daysBetween(activePlan.start, date) / 7) * 7)
    return Array.from({ length: 7 }, (_, i) => subtractDays(first, -i))
      .filter((d) => d >= activePlan.start && d <= activePlan.raceDate)
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
    moveWorkout,
    swapWorkouts,
    planWeekDates,
  }

  if (!loaded) return <View style={{ flex: 1 }} />

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>
}

export function useTraining() {
  const ctx = useContext(TrainingContext)
  if (!ctx) throw new Error('useTraining must be used within a TrainingProvider')
  return ctx
}
