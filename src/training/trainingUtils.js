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

// Colours live in src/theme (useTheme); only fonts and theme-derived styles are here
export const FONT_REGULAR = 'Manrope_400Regular'
export const FONT_MEDIUM = 'Manrope_500Medium'
export const FONT_SEMIBOLD = 'Manrope_600SemiBold'
export const FONT_BOLD = 'Manrope_700Bold'
export const FONT_EXTRABOLD = 'Manrope_800ExtraBold'

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