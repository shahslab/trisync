import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { STORAGE_KEY as TRAINING_KEY } from '../training/TrainingContext'
import { STORAGE_KEY as APPEARANCE_KEY } from '../theme/ThemeContext'
import { STORAGE_KEY as STRAVA_SESSION_KEY, KEYS_STORAGE_KEY as STRAVA_KEYS_KEY } from '../strava/StravaContext'
import { toIsoDate } from '../training/trainingUtils'

// A backup is a JSON file of the on-device storage, so data can move between browsers and
// devices without a server. The Strava login session is left out on purpose: its tokens
// grant access to the athlete's account, and reconnecting after a restore is one tap.
const FORMAT = 'trisync-backup'
const VERSION = 1
const SECTIONS = {
  training: TRAINING_KEY, // planRange + workouts
  appearance: APPEARANCE_KEY,
  stravaKeys: STRAVA_KEYS_KEY, // the user's Strava API Client ID and Secret
}

// Export and import go through the browser's file download and file picker
export const backupSupported = Platform.OS === 'web'

export async function exportBackup() {
  const data = {}
  for (const [section, key] of Object.entries(SECTIONS)) {
    const stored = await AsyncStorage.getItem(key)
    if (stored) data[section] = JSON.parse(stored)
  }
  const backup = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), data }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `trisync-backup-${toIsoDate(new Date())}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Opens the file picker; resolves with the chosen file's text, or null if cancelled
function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      file.text().then(resolve, () => resolve(null))
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

// Replaces this device's data with a backup file's, then reloads so every provider
// starts from it. Returns { error } on failure, or { cancelled: true }.
export async function importBackup() {
  const text = await pickFile()
  if (text == null) return { cancelled: true }

  let backup
  try {
    backup = JSON.parse(text)
  } catch {
    return { error: 'That file isn\'t a TriSync backup.' }
  }
  if (backup?.format !== FORMAT || typeof backup.data !== 'object' || !backup.data) {
    return { error: 'That file isn\'t a TriSync backup.' }
  }
  if (backup.version > VERSION) {
    return { error: 'This backup comes from a newer version of TriSync. Refresh the app and try again.' }
  }

  if (!window.confirm('Replace the plan, workouts and settings on this device with the backup?')) {
    return { cancelled: true }
  }

  const previousKeys = await AsyncStorage.getItem(STRAVA_KEYS_KEY)
  for (const [section, key] of Object.entries(SECTIONS)) {
    if (backup.data[section] != null) await AsyncStorage.setItem(key, JSON.stringify(backup.data[section]))
    else await AsyncStorage.removeItem(key)
  }
  // Tokens belong to the Strava app that issued them, so different keys need a new login
  if (JSON.stringify(backup.data.stravaKeys ?? null) !== JSON.stringify(previousKeys ? JSON.parse(previousKeys) : null)) {
    await AsyncStorage.removeItem(STRAVA_SESSION_KEY)
  }

  window.location.reload()
  return {}
}
