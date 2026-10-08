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

// A brick is entered as one workout per leg; the run leg's title names the run
const sportOf = (workout) => (workout.type === 'Brick' ? (/run/i.test(workout.title) ? 'Run' : 'Bike') : workout.type)

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
