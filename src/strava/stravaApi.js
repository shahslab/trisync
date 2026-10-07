import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { daysBetween } from '../training/trainingUtils'

// Each user registers their own Strava API app and enters its keys in Settings; they are
// stored only on that device and passed in here as `keys` ({ clientId, clientSecret }).
// Nothing is baked into the build, so anyone can run their own TriSync instance.

const API = 'https://www.strava.com/api/v3'
const SCOPE = 'activity:read_all,activity:write'

const NAME_PREFIX = 'TriSync: '

const SPORTS_RUN = ['Run', 'TrailRun', 'VirtualRun']
const SPORTS_BIKE = ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'EMountainBikeRide']
const SPORT_TYPES = {
  Run: SPORTS_RUN,
  Bike: SPORTS_BIKE,
  Swim: ['Swim'],
  Brick: [...SPORTS_RUN, ...SPORTS_BIKE],
  Strength: ['WeightTraining', 'Workout', 'Crossfit'],
}

export const hasKeys = (keys) => !!(keys?.clientId && keys?.clientSecret)

export const canSyncType = (type) => !!SPORT_TYPES[type]

function authorizeUrl(keys, base, redirectUri) {
  const params = new URLSearchParams({
    client_id: keys.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
  })
  return `${base}?${params}`
}

// Strava caps each API app's requests (by default 100 every 15 minutes, 1,000 a day)
const RATE_LIMIT_MESSAGE = 'Strava\'s sync limit for your API app has been reached. '
  + 'Try again in 15 minutes, or after midnight UTC if the daily limit is used up.'

// Form-encoded on purpose: Strava's token endpoint doesn't answer CORS preflights,
// so a JSON body would be blocked in the browser.
async function requestToken(keys, params) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: keys.clientId, client_secret: keys.clientSecret, ...params }).toString(),
  })
  if (!res.ok) {
    throw new Error(res.status === 401
      ? 'Strava rejected the Client ID or Secret. Check them in Settings → Strava.'
      : res.status === 429 ? RATE_LIMIT_MESSAGE : `Strava login failed (${res.status}).`)
  }
  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteName: data.athlete ? `${data.athlete.firstname || ''} ${data.athlete.lastname || ''}`.trim() : undefined,
  }
}

export async function exchangeCode(keys, { code, scope, error }) {
  if (error) throw new Error('Strava access was not granted.')
  const granted = (scope || '').split(',')
  if (!granted.includes('activity:write') || !granted.includes('activity:read_all')) {
    throw new Error('TriSync needs permission to view and edit your activities. Connect again and leave both boxes ticked.')
  }
  return requestToken(keys, { code, grant_type: 'authorization_code' })
}

export async function refreshSession(keys, session) {
  const fresh = await requestToken(keys, { refresh_token: session.refreshToken, grant_type: 'refresh_token' })
  return { ...session, ...fresh, athleteName: fresh.athleteName || session.athleteName }
}

export const isExpired = (session) => session.expiresAt * 1000 < Date.now() + 60 * 1000

// The host to set as the Strava app's "Authorization Callback Domain": the deployed site.
// Strava always allows localhost too, so local dev logs in with the same setting.
export const WEB_CALLBACK_DOMAIN = 'shahslab.github.io'
export const callbackDomain = () => (Platform.OS === 'web'
  ? WEB_CALLBACK_DOMAIN
  : Linking.parse(Linking.createURL('strava-auth')).hostname)

// Web: full-page redirect to Strava, which sends the browser back here with ?code=...
export function startWebLogin(keys) {
  const redirectUri = window.location.origin + window.location.pathname
  window.location.assign(authorizeUrl(keys, 'https://www.strava.com/oauth/authorize', redirectUri))
}

// Web: reads (and clears from the address bar) the code Strava redirected back with
export function takeWebRedirect() {
  if (Platform.OS !== 'web') return null
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const error = params.get('error')
  if (!code && !error) return null
  window.history.replaceState(null, '', window.location.pathname)
  return { code, error, scope: params.get('scope') }
}

// Native: in-app browser session that returns to the app's trisync:// scheme
export async function nativeLogin(keys) {
  const redirectUri = Linking.createURL('strava-auth')
  const result = await WebBrowser.openAuthSessionAsync(
    authorizeUrl(keys, 'https://www.strava.com/oauth/mobile/authorize', redirectUri),
    redirectUri,
  )
  if (result.type !== 'success') return null
  return Linking.parse(result.url).queryParams || {}
}

async function api(accessToken, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) },
  })
  if (!res.ok) throw new Error(res.status === 429 ? RATE_LIMIT_MESSAGE : `Strava request failed (${res.status}).`)
  return res.json()
}

// All activities whose local start date is dateIso. The API filters by UTC epoch,
// so fetch a day either side and filter on start_date_local.
export async function activitiesOnDate(accessToken, dateIso) {
  const dayStart = Math.floor(new Date(`${dateIso}T00:00:00`).getTime() / 1000)
  const after = dayStart - 86400
  const before = dayStart + 2 * 86400
  const list = await api(accessToken, `/athlete/activities?after=${after}&before=${before}&per_page=50`)
  return list.filter((a) => (a.start_date_local || '').slice(0, 10) === dateIso)
}

export function matchingActivities(activities, type) {
  const sports = SPORT_TYPES[type] || []
  return activities.filter((a) => sports.includes(a.sport_type || a.type))
}

// e.g. "Week 3 of 12 · 45 days to Berlin Marathon"; null outside the plan
export function planLine(workout, plan) {
  if (!plan) return null
  const week = Math.floor(daysBetween(plan.start, workout.date) / 7) + 1
  const daysToRace = daysBetween(workout.date, plan.raceDate)
  const race = plan.raceName || 'race day'
  if (daysToRace === 0) return `Race day: ${race}`
  if (week < 1 || daysToRace < 0) return null
  return `Week ${week} of ${plan.weeks} · ${daysToRace} ${daysToRace === 1 ? 'day' : 'days'} to ${race}`
}

// Title: "TriSync: <workout title>" (falls back to Strava's own name).
// Description: the workout notes, prefixed "Brick Part N: " for brick legs.
function buildUpdate(activity, workout, brickPart) {
  const update = {}

  const baseName = workout.title || (activity.name || '').replace(NAME_PREFIX, '')
  const name = `${NAME_PREFIX}${baseName}`
  if (name !== activity.name) update.name = name

  const brickLabel = workout.type === 'Brick' ? `Brick Part ${brickPart || 1}` : null
  const description = brickLabel
    ? [brickLabel, workout.notes].filter(Boolean).join(': ')
    : workout.notes
  // Leave Strava's description alone when TriSync has nothing to say
  if (description && description !== (activity.description || '')) update.description = description

  return update
}

export const getActivity = (accessToken, activityId) => api(accessToken, `/activities/${activityId}`)

// Writes the workout's title and notes onto a Strava activity. Returns the updated activity.
export async function applyWorkoutToActivity(accessToken, activityId, workout, brickPart) {
  // The list endpoint omits descriptions, so fetch the full activity first
  const activity = await getActivity(accessToken, activityId)
  const update = buildUpdate(activity, workout, brickPart)
  if (Object.keys(update).length === 0) return activity

  return api(accessToken, `/activities/${activityId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
}
