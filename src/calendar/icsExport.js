import { Platform } from 'react-native'
import { subtractDays } from '../training/trainingUtils'

// Builds an iCalendar (.ics) file for a plan: one all-day event per workout plus race day.
// Google Calendar, Apple Calendar and Outlook all import .ics files. Event UIDs come from
// the workout ids, so they stay stable between exports.

// Downloading a file goes through the browser
export const calendarExportSupported = Platform.OS === 'web'

const STATUS_LABELS = { done: 'Done', partial: 'Partial' }

// Text values escape backslashes, semicolons, commas and newlines (RFC 5545 §3.3.11)
const escapeText = (text) => String(text)
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Lines longer than 75 octets continue on the next line after a space (RFC 5545 §3.1)
function fold(line) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts = []
  let current = ''
  let size = 0
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length
    if (size + charSize > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += charSize
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const icsDate = (iso) => iso.replace(/-/g, '')
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

function allDayEvent({ uid, date, summary, description }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${icsDate(date)}`,
    `DTEND;VALUE=DATE:${icsDate(subtractDays(date, -1))}`, // all-day events end the next day
    `SUMMARY:${escapeText(summary)}`,
  ]
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`)
  lines.push('TRANSP:TRANSPARENT', 'END:VEVENT') // all-day training shouldn't block the day as busy
  return lines
}

export function buildPlanIcs(plan) {
  const raceName = plan.raceName || 'Race'
  const events = [...plan.workouts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => allDayEvent({
      uid: `${w.id}@trisync`,
      date: w.date,
      summary: w.title ? `${w.type}: ${w.title}` : w.type,
      description: [w.notes, STATUS_LABELS[w.status] && `Status: ${STATUS_LABELS[w.status]}`].filter(Boolean).join('\n\n'),
    }))
  events.push(allDayEvent({ uid: `${plan.id}-race@trisync`, date: plan.raceDate, summary: `Race day: ${raceName}` }))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TriSync//Training Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`TriSync: ${raceName}`)}`,
    ...events.flat(),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadPlanIcs(plan) {
  const blob = new Blob([buildPlanIcs(plan)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const slug = (plan.raceName || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan'
  link.download = `trisync-${slug}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
