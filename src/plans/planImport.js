import { Platform } from 'react-native'

import { TYPE_LIST } from '../training/trainingUtils'

// Imported plans use the library's format, so createPlan places them the same way:
// { name?, weeks?, workouts: [{ week, day, type, title, notes? }] }, week from 1, day 0-6
// counted from the plan's first day. `weeks` defaults to the highest week used.
export const planImportSupported = Platform.OS === 'web'

export const PLAN_FILE_EXAMPLE = `{
  "name": "My Sprint Plan",
  "weeks": 8,
  "workouts": [
    { "week": 1, "day": 0, "type": "Swim", "title": "1500 m",
      "notes": "Intensity: Easy" },
    { "week": 1, "day": 2, "type": "Run", "title": "30 mins" },
    { "week": 1, "day": 5, "type": "Brick", "title": "45 mins" },
    { "week": 1, "day": 5, "type": "Brick", "title": "15 mins" }
  ]
}`

// Opens the file picker; resolves with { name, text }, or null if cancelled
function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      file.text().then((text) => resolve({ name: file.name, text }), () => resolve(null))
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

const TYPES_BY_NAME = Object.fromEntries(TYPE_LIST.map((type) => [type.toLowerCase(), type]))

// Checks a plan file's text. Returns { plan: { name, weeks, workouts } } or { error }.
export function parsePlanFile(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'That file isn\'t valid JSON.' }
  }
  const list = Array.isArray(data) ? data : data?.workouts
  if (!Array.isArray(list) || list.length === 0) {
    return { error: 'The file needs a "workouts" list with at least one workout.' }
  }

  const workouts = []
  for (const [i, w] of list.entries()) {
    const where = `Workout ${i + 1}`
    const type = TYPES_BY_NAME[String(w?.type ?? '').trim().toLowerCase()]
    if (!Number.isInteger(w?.week) || w.week < 1) return { error: `${where}: "week" must be a whole number from 1.` }
    if (!Number.isInteger(w.day) || w.day < 0 || w.day > 6) return { error: `${where}: "day" must be a whole number from 0 to 6.` }
    if (!type) return { error: `${where}: "type" must be one of ${TYPE_LIST.join(', ')}.` }
    if (typeof w.title !== 'string' || !w.title.trim()) return { error: `${where}: "title" is missing.` }
    if (w.notes != null && typeof w.notes !== 'string') return { error: `${where}: "notes" must be text.` }
    workouts.push({ week: w.week, day: w.day, type, title: w.title.trim(), notes: w.notes?.trim() || '' })
  }

  const lastWeek = Math.max(...workouts.map((w) => w.week))
  const weeks = data.weeks ?? lastWeek
  if (!Number.isInteger(weeks) || weeks < lastWeek) {
    return { error: `"weeks" must be a whole number, at least ${lastWeek} (the last week with a workout).` }
  }
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  return { plan: { name, weeks, workouts } }
}

// Picks and checks a plan file. Resolves with { plan, fileName }, { error } or { cancelled: true }.
export async function importPlanFile() {
  const file = await pickFile()
  if (!file) return { cancelled: true }
  const result = parsePlanFile(file.text)
  return result.error ? result : { ...result, fileName: file.name }
}
