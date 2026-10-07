// Builds the shareable lap chart for a Strava activity as an SVG string.
// Dark card: headline stat + status badge, slim bars over the workout's laps
// (hard laps glow in the accent colour), a progress line and a one-paragraph summary.

export const GRAPHIC_SIZE = 1080

const LEFT = 100
const RIGHT = 980
const WIDTH = RIGHT - LEFT
const CHART = { top: 330, bottom: 720 }
const TARGET_BARS = 32
const BAR_GAP = 10
const MIN_HEIGHT_SHARE = 0.18
// Laps within this speed spread count as steady effort: every bar lit, no hard/easy split
const STEADY_SPREAD = 0.1

const ACCENTS = { done: '#2fd36b', partial: '#ff8a3d' }
const DIM = '#2b2b30'
const MUTED = '#8c8c94'
const FONT = "font-family=\"'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif\""

const RUN_SPORTS = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike']

const esc = (text) => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function formatDuration(seconds) {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

function formatPace(secondsPerUnit) {
  const s = Math.round(secondsPerUnit)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Speed in the units each sport is usually discussed in
function formatSpeed(sport, speed) {
  if (sport === 'Swim') return `${formatPace(100 / speed)} /100m`
  if (RUN_SPORTS.includes(sport)) return `${formatPace(1000 / speed)} /km`
  return `${(speed * 3.6).toFixed(1)} km/h`
}

function formatDistance(sport, meters) {
  return sport === 'Swim' ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`
}

// Laps if the watch recorded more than one, otherwise Strava's per-km splits
export function segmentsFromActivity(activity) {
  const toSegment = (s) => ({ seconds: s.moving_time || s.elapsed_time || 0, speed: s.average_speed || 0 })
  const usable = (list) => (list || []).map(toSegment).filter((s) => s.seconds > 0 && s.speed > 0)

  const laps = usable(activity.laps)
  if (laps.length > 1) return { segments: laps, unit: 'laps' }
  return { segments: usable(activity.splits_metric), unit: 'splits' }
}

// Marks each segment hard/easy and gives it a bar height share (0..1)
function classify(segments) {
  const speeds = segments.map((s) => s.speed)
  const min = Math.min(...speeds)
  const max = Math.max(...speeds)
  const steady = (max - min) / max < STEADY_SPREAD
  const midpoint = (min + max) / 2

  return {
    steady,
    segments: segments.map((s) => ({
      ...s,
      hard: steady || s.speed > midpoint,
      // Steady efforts scale to raw speed so small pace wobbles don't look like intervals
      share: steady ? s.speed / max : MIN_HEIGHT_SHARE + (1 - MIN_HEIGHT_SHARE) * ((s.speed - min) / (max - min)),
    })),
  }
}

// Splits the segments into roughly TARGET_BARS slim bars, in proportion to time,
// so long laps span several bars and short ones (recoveries) still get one
function toBars(segments) {
  const total = segments.reduce((sum, s) => sum + s.seconds, 0)
  return segments.flatMap((s) => {
    const count = Math.max(1, Math.round((s.seconds / total) * TARGET_BARS))
    return Array.from({ length: count }, () => s)
  })
}

function barsSvg(bars) {
  const n = bars.length
  const gap = Math.min(BAR_GAP, (WIDTH / n) * 0.35)
  const w = (WIDTH - gap * (n - 1)) / n
  const maxHeight = CHART.bottom - CHART.top

  return bars.map((bar, i) => {
    const h = maxHeight * bar.share
    const x = LEFT + i * (w + gap)
    return `<rect x="${x.toFixed(1)}" y="${(CHART.bottom - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, w / 2).toFixed(1)}" fill="url(#${bar.hard ? 'lit' : 'dim'})"/>`
  }).join('')
}

// A line of text where {braced} parts are drawn in the accent colour
function richText(x, y, size, template, accent) {
  const parts = template.split(/(\{[^}]*\})/).filter(Boolean).map((part) => (part.startsWith('{')
    ? `<tspan fill="${accent}">${esc(part.slice(1, -1))}</tspan>`
    : esc(part)))
  return `<text x="${x}" y="${y}" ${FONT} font-size="${size}" font-weight="500" fill="${MUTED}">${parts.join('')}</text>`
}

function summaryLines(activity, sport, classified, unit) {
  const lines = []
  const time = formatDuration(activity.moving_time || activity.elapsed_time || 0)
  if (activity.distance && activity.average_speed) {
    lines.push(`{${formatDistance(sport, activity.distance)}} in {${time}} at {${formatSpeed(sport, activity.average_speed)}}.`)
  } else {
    lines.push(`{${time}} of training.`)
  }

  // Without laps the chart area already says so
  if (!classified) return lines
  if (classified.steady) {
    lines.push(`Steady effort across {${classified.segments.length}} ${unit}.`)
  } else {
    const hard = classified.segments.filter((s) => s.hard)
    const fastest = Math.max(...hard.map((s) => s.speed))
    lines.push(`{${hard.length}} hard ${unit}, fastest {${formatSpeed(sport, fastest)}}.`)
  }
  return lines
}

// Approximate text width, for sizing the badge and shrinking long text
const textWidth = (text, size, glyphShare = 0.55) => String(text).length * size * glyphShare
const fitFontSize = (text, maxSize, maxWidth = WIDTH) =>
  Math.min(maxSize, Math.floor(maxWidth / (String(text).length * 0.55)))

function badgeSvg(status) {
  const partial = status === 'partial'
  const accent = partial ? ACCENTS.partial : ACCENTS.done
  const lead = partial ? 'Partially ' : 'Workout '
  const word = 'complete'
  const size = 30
  const height = 72
  const width = 34 + 22 + 16 + textWidth(lead + word, size, 0.5) + 34
  const x = RIGHT - width
  const y = 112

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="#ffffff" fill-opacity="0.03" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>`
    + `<circle cx="${x + 34 + 11}" cy="${y + height / 2}" r="11" fill="${accent}"/>`
    + `<circle cx="${x + 34 + 11}" cy="${y + height / 2}" r="18" fill="${accent}" fill-opacity="0.18"/>`
    + `<text x="${x + 34 + 22 + 16}" y="${y + height / 2 + 10}" ${FONT} font-size="${size}" font-weight="500" fill="#d4d4d8">${esc(lead)}<tspan fill="${accent}">${word}</tspan></text>`
}

// title and footer come from TriSync (planned workout), the numbers from Strava.
// status is the workout status ('done' | 'partial'); it picks the accent colour.
export function buildGraphicSvg({ activity, title, footer, status }) {
  const sport = activity.sport_type || activity.type
  const accent = status === 'partial' ? ACCENTS.partial : ACCENTS.done
  const { segments, unit } = segmentsFromActivity(activity)
  const classified = segments.length ? classify(segments) : null

  const headline = activity.distance
    ? formatDistance(sport, activity.distance)
    : formatDuration(activity.moving_time || activity.elapsed_time || 0)

  let chart
  let progressShare = 0
  if (classified) {
    chart = barsSvg(toBars(classified.segments))
    const total = classified.segments.reduce((sum, s) => sum + s.seconds, 0)
    progressShare = classified.segments.filter((s) => s.hard).reduce((sum, s) => sum + s.seconds, 0) / total
  } else {
    chart = `<text x="${GRAPHIC_SIZE / 2}" y="${(CHART.top + CHART.bottom) / 2}" text-anchor="middle" ${FONT} font-size="34" fill="${MUTED}">No lap data recorded</text>`
  }

  const lines = summaryLines(activity, sport, classified, unit)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GRAPHIC_SIZE}" height="${GRAPHIC_SIZE}" viewBox="0 0 ${GRAPHIC_SIZE} ${GRAPHIC_SIZE}">`
    + '<defs>'
    + '<linearGradient id="card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1d21"/><stop offset="1" stop-color="#121214"/></linearGradient>'
    + `<linearGradient id="lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${accent}" stop-opacity="0.12"/></linearGradient>`
    + `<linearGradient id="dim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${DIM}"/><stop offset="1" stop-color="${DIM}" stop-opacity="0.35"/></linearGradient>`
    + '</defs>'
    + `<rect width="${GRAPHIC_SIZE}" height="${GRAPHIC_SIZE}" fill="#0b0b0d"/>`
    + '<rect x="40" y="40" width="1000" height="1000" rx="56" fill="url(#card)" stroke="#ffffff" stroke-opacity="0.09" stroke-width="2"/>'
    + `<text x="${LEFT}" y="186" ${FONT} font-size="88" font-weight="700" fill="#ffffff">${esc(headline)}</text>`
    + `<text x="${LEFT}" y="244" ${FONT} font-size="${fitFontSize(title, 40, 520)}" font-weight="500" fill="${MUTED}">${esc(title)}</text>`
    + badgeSvg(status)
    + chart
    + `<rect x="${LEFT}" y="752" width="${WIDTH}" height="8" rx="4" fill="${DIM}"/>`
    + (progressShare ? `<rect x="${LEFT}" y="752" width="${(WIDTH * progressShare).toFixed(1)}" height="8" rx="4" fill="${accent}"/>` : '')
    + lines.map((line, i) => richText(LEFT, 846 + i * 54, 36, line, accent)).join('')
    + `<line x1="${LEFT}" y1="950" x2="${RIGHT}" y2="950" stroke="#ffffff" stroke-opacity="0.09" stroke-width="2"/>`
    + `<text x="${GRAPHIC_SIZE / 2}" y="1004" text-anchor="middle" ${FONT} font-size="${fitFontSize(footer, 32)}" font-weight="600" fill="#e4e4e7">${esc(footer)}</text>`
    + '</svg>'
}

export const svgDataUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
