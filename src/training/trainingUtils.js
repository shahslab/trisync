export const WORKOUT_TYPES = {
  SWIM: 'Swim',
  BIKE: 'Bike',
  RUN: 'Run',
  BRICK: 'Brick',
  STRENGTH: 'Strength',
  REST: 'Rest',
}

export function makeId() {
  return `w_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

// Formats a Date as YYYY-MM-DD in the local time zone (toISOString would use UTC)
export function toIsoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayStr = () => toIsoDate(new Date())

export function isoToDisplay(isoStr) {
  if (!isoStr) return ''
  const [y, m, d] = isoStr.split('-')
  return `${d}-${m}-${y}`
}

export function displayToIso(displayStr) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec((displayStr || '').trim())
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

export function isValidCalendarDate(isoStr) {
  if (!isoStr) return false
  const d = new Date(`${isoStr}T00:00:00`)
  return !Number.isNaN(d.getTime()) && isoStr === toIsoDate(d)
}

// Which week of a plan a date falls in, counting from 1 at the plan's start date
export const planWeekOf = (startIso, dateIso) => Math.floor(daysBetween(startIso, dateIso) / 7) + 1

export function daysBetween(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00`)
  const end = new Date(`${endIso}T00:00:00`)
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

export function subtractDays(isoStr, days) {
  const d = new Date(`${isoStr}T00:00:00`)
  d.setDate(d.getDate() - days)
  return toIsoDate(d)
}

export function statusFor(workout, todayIso) {
  if (workout.status === 'done') return 'done'
  if (workout.status === 'partial') return 'partial'
  return workout.date < todayIso ? 'missed' : 'upcoming'
}

export const TYPE_LIST = Object.values(WORKOUT_TYPES)

const NOTE_SECTIONS = /(Warm Up|Main Set|Warm Down):[ \t]*/g
// The start of a set: "2 x (..." or "11 mins ..."
const SET_START = /^\s+\d+\s*(?:x\s*\(|mins?\b)/

// Splits a section into its sets at commas that are followed by a new set and aren't inside
// brackets ("2 x (3, 2, 1 mins ...)" is one set)
function splitSets(body) {
  const sets = []
  let depth = 0
  let from = 0
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++
    else if (body[i] === ')') depth = Math.max(0, depth - 1)
    else if (body[i] === ',' && depth === 0 && SET_START.test(body.slice(i + 1))) {
      sets.push(body.slice(from, i))
      from = i + 1
    }
  }
  return [...sets, body.slice(from)]
}
// A heading for the sets after it, like "Repeat 2 sets of 500:" before "1 x (..."
const SET_HEADING = /^([^()]+?):\s*(?=\d+\s*x\s*\()/

// Lays out plan notes written as one paragraph ("Warm Up: ... Main Set: ... Warm Down: ...")
// with each section on its own line, and a section of several sets as one bullet per set
// (a "Repeat 2 sets of 500:" heading gets its own line above them).
// Only whitespace changes, and notes already laid out (or without these headings) come back as they are.
export function formatPlanNotes(notes) {
  if (!notes) return notes
  const parts = notes.split(NOTE_SECTIONS) // [before, label, body, label, body, ...]
  if (parts.length < 3) return notes
  const sections = []
  for (let i = 1; i < parts.length; i += 2) {
    const body = parts[i + 1].trim()
    const sets = splitSets(body)
    if (body.includes('\n')) sections.push(`${parts[i]}:\n${body}`) // laid out already
    else if (sets.length > 1) {
      const lines = sets.map((set) => {
        const item = set.trim().replace(/[.,]$/, '')
        const heading = SET_HEADING.exec(item)
        return heading ? `${heading[1]}:\n• ${item.slice(heading[0].length)}` : `• ${item}`
      })
      sections.push(`${parts[i]}:\n${lines.join('\n')}`)
    }
    else sections.push(`${parts[i]}: ${body}`)
  }
  const before = parts[0].trim()
  return [before, ...sections].filter(Boolean).join('\n\n')
}

// Colours live in src/theme (useTheme); only fonts and theme-derived styles are here
export const FONT_REGULAR = 'JosefinSans_400Regular'
export const FONT_MEDIUM = 'JosefinSans_500Medium'
export const FONT_SEMIBOLD = 'JosefinSans_600SemiBold'
export const FONT_BOLD = 'JosefinSans_700Bold'
export const FONT_EXTRABOLD = 'JosefinSans_700Bold' // Josefin Sans tops out at Bold

export const notesInputStyle = (theme) => ({
  borderWidth: 1,
  borderColor: theme.border,
  borderRadius: 12,
  padding: 12,
  minHeight: 76,
  fontSize: 14,
  lineHeight: 20,
  width: '100%',
  color: theme.text,
  backgroundColor: theme.surfaceRaised,
  fontFamily: FONT_REGULAR,
})

export const TYPE_ICONS = {
  Swim: 'water-outline',
  Bike: 'bicycle-outline',
  Run: 'walk-outline',
  Brick: 'flash-outline',
  Strength: 'barbell-outline',
  Rest: 'bed-outline',
}

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export function formatLongDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(`${isoStr}T00:00:00`)
  const dayName = DAY_NAMES[d.getDay()]
  const monthName = MONTH_NAMES[d.getMonth()]
  const dayNum = d.getDate()
  const year = d.getFullYear()
  return `${dayName}, ${dayNum} ${monthName} ${year}`
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// e.g. "Tue 7"
export function formatShortDay(isoStr) {
  const d = new Date(`${isoStr}T00:00:00`)
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()}`
}

function ordinalSuffix(day) {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

export function formatOrdinalDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(`${isoStr}T00:00:00`)
  const day = d.getDate()
  const month = MONTH_NAMES[d.getMonth()]
  const year = d.getFullYear()
  return `${day}${ordinalSuffix(day)} ${month} ${year}`
}