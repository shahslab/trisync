// Estimates a workout's distance from the duration in its title and the intensity in its notes,
// at typical age-group paces. Swims already given in metres are just converted to yards.

// Average speeds over a whole session (warm-up and recoveries included), by intensity
const SPEEDS = {
  Run: { easy: 9.0, steady: 9.7, hard: 10.5 }, // km/h: about 10:45, 10:00 and 9:10 per mile
  Bike: { easy: 23, steady: 26, hard: 28 }, // km/h: about 14, 16 and 17.5 mph
  Swim: { easy: 2.4, steady: 2.7, hard: 2.9 }, // km/h: about 2:30, 2:13 and 2:04 per 100 m
}

const KM_PER_MILE = 1.609344
const M_PER_YARD = 0.9144

function intensityOf(notes) {
  const line = /^Intensity: (.*)$/m.exec(notes || '')?.[1]?.toLowerCase() || ''
  if (/easy|recovery/.test(line)) return 'easy'
  if (/hard|tempo|threshold|vo2/.test(line)) return 'hard'
  return 'steady'
}

// "1 hr 20 mins", "42 mins 30 secs" → hours, or null when the title has no duration
function durationHours(title) {
  const hours = /(\d+(?:\.\d+)?) ?(?:hrs?|hours?)\b/i.exec(title)
  const mins = /(\d+) ?(?:mins?|minutes?)\b/i.exec(title)
  const secs = /(\d+) ?(?:secs?|seconds?)\b/i.exec(title)
  if (!hours && !mins) return null
  return (hours ? +hours[1] : 0) + (mins ? +mins[1] / 60 : 0) + (secs ? +secs[1] / 3600 : 0)
}

// A brick is entered as one workout per leg: its chosen sport, or else the run leg's title names the run
export const sportOf = (workout) => (workout.type === 'Brick'
  ? workout.brickSport || (/run/i.test(workout.title) ? 'Run' : 'Bike')
  : workout.type)

const roundTo = (value, step) => Math.round(value / step) * step

function formatLong(km, units) {
  const value = roundTo(units === 'imperial' ? km / KM_PER_MILE : km, 0.5)
  if (!value) return null
  const unit = units === 'imperial' ? (value === 1 ? 'mile' : 'miles') : 'km'
  return `${value} ${unit}`
}

function formatSwim(metres, units) {
  const value = roundTo(units === 'imperial' ? metres / M_PER_YARD : metres, 50)
  if (!value) return null
  return `${value.toLocaleString('en-US')} ${units === 'imperial' ? 'yards' : 'm'}`
}

// How long a workout takes, in hours: the title's duration, or a swim's metres at a steady pace.
// null when the title gives neither.
export function estimateHours(workout) {
  const title = workout.title || ''
  const hours = durationHours(title)
  if (hours) return hours
  const metres = sportOf(workout) === 'Swim' && /(\d[\d,]*) ?m\b/.exec(title)
  return metres ? +metres[1].replace(/,/g, '') / 1000 / SPEEDS.Swim.steady : null
}

// units: 'imperial' | 'metric'. Returns e.g. "11 miles", or null when there's nothing to add.
export function estimateDistance(workout, units) {
  const title = workout.title || ''
  const sport = sportOf(workout)
  if (!SPEEDS[sport]) return null

  if (sport === 'Swim') {
    const metres = /(\d[\d,]*) ?m\b/.exec(title)
    if (metres) return units === 'imperial' ? formatSwim(+metres[1].replace(/,/g, ''), units) : null
  }
  // A title that already gives a distance needs no estimate
  if (/\d ?(?:km|mi|miles?|m|yds?|yards?)\b/i.test(title)) return null

  const hours = durationHours(title)
  if (!hours) return null
  const km = hours * SPEEDS[sport][intensityOf(workout.notes)]
  return sport === 'Swim' ? formatSwim(km * 1000, units) : formatLong(km, units)
}

// ---- Workouts by distance ----------------------------------------------------------------
// With the "Workouts by: Distance" setting, timed rides and runs are shown as distances:
// the title's duration becomes the session's estimated distance, and each timed work interval
// in the notes becomes a distance at a typical speed for its heart-rate zone. Recoveries,
// rests and anything under 2 minutes stay timed, as distance-based plans write them.
// Shown only, never stored: editing a workout still edits its time-based title and notes.

// Speeds while holding each zone, Z1 to Z5 (km/h)
const ZONE_SPEEDS = {
  Run: [8.0, 9.0, 10.0, 11.0, 12.0], // about 12:04, 10:44, 9:39, 8:47 and 8:03 per mile
  Bike: [21, 25, 28, 31, 34], // about 13, 15.5, 17.5, 19 and 21 mph
}
const MIN_INTERVAL_SECS = 120

// "1 hr 20 mins", "45 mins", "1 hr", "90 secs" (one duration, possibly in parts)
const DURATION = /\d+(?:\.\d+)? ?(?:hrs?|hours?)(?: \d+ ?(?:mins?|minutes?))?(?: \d+ ?(?:secs?|seconds?))?|\d+ ?(?:mins?|minutes?)(?: \d+ ?(?:secs?|seconds?))?|\d+ ?(?:secs?|seconds?)/gi

function durationSecs(text) {
  const hours = /(\d+(?:\.\d+)?) ?(?:hrs?|hours?)/i.exec(text)
  const mins = /(\d+) ?(?:mins?|minutes?)/i.exec(text)
  const secs = /(\d+) ?(?:secs?|seconds?)/i.exec(text)
  return (hours ? +hours[1] * 3600 : 0) + (mins ? +mins[1] * 60 : 0) + (secs ? +secs[1] : 0)
}

// An interval's distance: metres for short runs ("800 m"), otherwise miles or km in quarters
// (halves from 5 up)
function formatInterval(km, sport, units) {
  if (sport === 'Run' && km < 1.6) return `${roundTo(km * 1000, 100)} m`
  const raw = units === 'imperial' ? km / KM_PER_MILE : km
  const value = +roundTo(raw, raw < 5 ? 0.25 : 0.5).toFixed(2)
  if (!value) return null
  if (units !== 'imperial') return `${value} km`
  return `${value} ${value === 1 ? 'mile' : 'miles'}`
}

const distanceSport = (workout) => {
  const sport = sportOf(workout)
  return ZONE_SPEEDS[sport] ? sport : null
}

// The title with its duration swapped for the estimated distance ("Optional Bike · 17.5 miles"),
// or null when it can't be shown by distance
export function distanceTitle(workout, units) {
  const title = workout.title || ''
  if (!distanceSport(workout) || !durationHours(title)) return null
  const distance = estimateDistance(workout, units)
  if (!distance) return null
  DURATION.lastIndex = 0
  const match = DURATION.exec(title)
  return match ? title.slice(0, match.index) + distance + title.slice(match.index + match[0].length) : distance
}

// The notes with timed work intervals converted to distances
export function notesByDistance(workout, units) {
  const notes = workout.notes || ''
  const sport = distanceSport(workout)
  if (!sport || !notes) return notes
  const sessionSpeed = SPEEDS[sport][intensityOf(notes)]

  return notes.replace(DURATION, (match, offset) => {
    // What follows the duration, up to the end of this step: "in upper Z3", "recovery in Z1"
    const rest = notes.slice(offset + match.length)
    const context = rest.slice(0, rest.search(/[,+().\n]|$/))
    const secs = durationSecs(match)
    if (secs < MIN_INTERVAL_SECS || /recover|rest|easy spin|jog/i.test(context)) return match
    // Before the step: "Intensity:" lines and rest periods named first ("rest 2 mins") stay as they are
    const before = notes.slice(Math.max(0, offset - 12), offset)
    if (/rest\s*$/i.test(before)) return match

    const zone = /Z(\d)(?:\s*-\s*Z?(\d))?/i.exec(context)
    let speed = sessionSpeed
    if (zone) {
      const zones = [+zone[1], +(zone[2] || zone[1])].map((z) => Math.min(Math.max(z, 1), 5))
      speed = (ZONE_SPEEDS[sport][zones[0] - 1] + ZONE_SPEEDS[sport][zones[1] - 1]) / 2
    }
    return formatInterval((secs / 3600) * speed, sport, units) || match
  })
}
