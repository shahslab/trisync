import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

// Set in .env.local (see .env.example). Expo inlines EXPO_PUBLIC_* vars into the bundle,
// so the secret ships with the app: fine for a personal build, never deploy it publicly.
const CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID
const CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET

const API = 'https://www.strava.com/api/v3'
const SCOPE = 'activity:read_all,activity:write'

// Description block OnePlan owns; re-syncing replaces it instead of appending twice
const MARKER = '— OnePlan —'

const SPORTS_RUN = ['Run', 'TrailRun', 'VirtualRun']
const SPORTS_BIKE = ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'EMountainBikeRide']
const SPORT_TYPES = {
  Run: SPORTS_RUN,
  Bike: SPORTS_BIKE,
  Swim: ['Swim'],
  Brick: [...SPORTS_RUN, ...SPORTS_BIKE],
  Strength: ['WeightTraining', 'Workout', 'Crossfit'],
}

export const isStravaConfigured = () => !!(CLIENT_ID && CLIENT_SECRET)

export const canSyncType = (type) => !!SPORT_TYPES[type]

function authorizeUrl(base, redirectUri) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
  })
  return `${base}?${params}`
}

// Form-encoded on purpose: Strava's token endpoint doesn't answer CORS preflights,
// so a JSON body would be blocked in the browser.
async function requestToken(params) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }).toString(),
  })
  if (!res.ok) throw new Error(`Strava login failed (${res.status}).`)
  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteName: data.athlete ? `${data.athlete.firstname || ''} ${data.athlete.lastname || ''}`.trim() : undefined,
  }
}

export async function exchangeCode({ code, scope, error }) {
  if (error) throw new Error('Strava access was not granted.')
  const granted = (scope || '').split(',')
  if (!granted.includes('activity:write') || !granted.includes('activity:read_all')) {
    throw new Error('OnePlan needs permission to view and edit your activities. Connect again and leave both boxes ticked.')
  }
  return requestToken({ code, grant_type: 'authorization_code' })
}

export async function refreshSession(session) {
  const fresh = await requestToken({ refresh_token: session.refreshToken, grant_type: 'refresh_token' })
  return { ...session, ...fresh, athleteName: fresh.athleteName || session.athleteName }
}

export const isExpired = (session) => session.expiresAt * 1000 < Date.now() + 60 * 1000

// Web: full-page redirect to Strava, which sends the browser back here with ?code=...
export function startWebLogin() {
  const redirectUri = window.location.origin + window.location.pathname
  window.location.assign(authorizeUrl('https://www.strava.com/oauth/authorize', redirectUri))
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

// Native: in-app browser session that returns to the app's oneplan:// scheme
export async function nativeLogin() {
  const redirectUri = Linking.createURL('strava-auth')
  const result = await WebBrowser.openAuthSessionAsync(
    authorizeUrl('https://www.strava.com/oauth/mobile/authorize', redirectUri),
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
  if (!res.ok) throw new Error(`Strava request failed (${res.status}).`)
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

function buildUpdate(activity, workout) {
  const update = {}
  if (workout.title && workout.title !== activity.name) update.name = workout.title

  const existing = activity.description || ''
  const markerAt = existing.indexOf(MARKER)
  const base = (markerAt >= 0 ? existing.slice(0, markerAt) : existing).trimEnd()

  const blockLines = []
  if (workout.status === 'partial') blockLines.push('Partially completed')
  if (workout.notes) blockLines.push(workout.notes)
  const block = blockLines.length ? `${MARKER}\n${blockLines.join('\n')}` : ''

  const description = [base, block].filter(Boolean).join('\n\n')
  if (description !== existing.trimEnd()) update.description = description

  return update
}

// Writes the planned title/notes onto a Strava activity. Returns the updated activity.
export async function applyWorkoutToActivity(accessToken, activityId, workout) {
  // The list endpoint omits descriptions, so fetch the full activity first
  const activity = await api(accessToken, `/activities/${activityId}`)
  const update = buildUpdate(activity, workout)
  if (Object.keys(update).length === 0) return activity

  return api(accessToken, `/activities/${activityId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
}
