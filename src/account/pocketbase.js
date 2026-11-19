import { POCKETBASE_URL } from './config'

// Plain fetch calls to PocketBase's REST API (v0.23+), in the same style as stravaApi.js.
// Accounts live in PocketBase's built-in `users` collection. Each user has one `userdata`
// record whose `data` JSON holds what TriSync keeps on the device (see syncStore.js).

const USERS = '/api/collections/users'
const USERDATA = '/api/collections/userdata/records'
const TIMEOUT_MS = 12000

// Thrown when the server can't be reached at all, so callers can carry on offline
export class OfflineError extends Error {}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.isDuplicateEmail = body?.data?.email?.code === 'validation_not_unique'
  }
}

// PocketBase reports form problems per field: { data: { email: { code, message } } }
function friendlyMessage(status, body) {
  const fields = body?.data || {}
  if (fields.email) return 'Enter a valid email address.'
  if (status === 400 && /otp|authenticate/i.test(body?.message || '')) return 'That code is wrong or has expired. Check it, or send a new one.'
  if (status === 429) return 'Too many attempts. Wait a minute and try again.'
  return body?.message || `The account server answered with an error (${status}).`
}

async function request(path, { method = 'GET', token, body } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(POCKETBASE_URL + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : null),
        ...(token ? { Authorization: token } : null),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch {
    throw new OfflineError('Can\'t reach the TriSync server. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 204) return null
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(friendlyMessage(res.status, json), res.status, json)
  return json
}

// Auth results: { token, user: { id, email } }
const session = (json) => ({ token: json.token, user: { id: json.record.id, email: json.record.email } })

// PocketBase needs a password on every account, but TriSync never uses it: people sign in
// with an emailed code. This one is random and thrown away.
function throwawayPassword() {
  const bytes = new Uint8Array(24)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Emails a 6-digit sign-in code, creating the account first if the email is new.
// Resolves with the otpId that verifyCode() needs.
export async function requestCode(email) {
  const address = email.trim().toLowerCase()
  const password = throwawayPassword()
  try {
    await request(`${USERS}/records`, { method: 'POST', body: { email: address, password, passwordConfirm: password } })
  } catch (e) {
    // Already has an account: carry on and send the code
    if (!(e instanceof ApiError && e.isDuplicateEmail)) throw e
  }
  const json = await request(`${USERS}/request-otp`, { method: 'POST', body: { email: address } })
  return json.otpId
}

export async function verifyCode(otpId, code) {
  return session(await request(`${USERS}/auth-with-otp`, {
    method: 'POST',
    body: { otpId, password: code.replace(/\s/g, '') },
  }))
}

// Swaps a still-valid token for a fresh one; a 401 means the user has to sign in again
export async function refreshAuth(token) {
  return session(await request(`${USERS}/auth-refresh`, { method: 'POST', token }))
}

// Deletes the account; the userdata record goes with it (cascade delete)
export async function deleteAccount({ token, user }) {
  await request(`${USERS}/records/${user.id}`, { method: 'DELETE', token })
}

// Records: { id, data, updated }, or null when the user has none yet
export async function fetchUserData({ token, user }) {
  const filter = encodeURIComponent(`user = "${user.id}"`)
  const json = await request(`${USERDATA}?filter=${filter}&perPage=1&skipTotal=1`, { token })
  return json.items?.[0] || null
}

export async function createUserData({ token, user }, data) {
  return request(USERDATA, { method: 'POST', token, body: { user: user.id, data } })
}

export async function updateUserData({ token }, recordId, data) {
  return request(`${USERDATA}/${recordId}`, { method: 'PATCH', token, body: { data } })
}
