import { Platform } from 'react-native'

import appConfig from '../../app.json'
import { isStandalone } from '../pwa/installPrompt'
import { todayStr } from '../training/trainingUtils'

export const BUG_EMAIL = 'shahshachi1@gmail.com'
const ISSUES_URL = 'https://github.com/shahslab/trisync/issues/new'

// The browser's name and version from its user agent. Order matters: Edge and the iOS
// browsers also say "Chrome" or "Safari".
function browserName(ua) {
  const known = [
    [/Edg\/([\d.]+)/, 'Edge'], [/CriOS\/([\d.]+)/, 'Chrome (iOS)'], [/FxiOS\/([\d.]+)/, 'Firefox (iOS)'],
    [/Firefox\/([\d.]+)/, 'Firefox'], [/Chrome\/([\d.]+)/, 'Chrome'], [/Version\/([\d.]+).*Safari/, 'Safari'],
  ]
  for (const [pattern, name] of known) {
    const match = ua.match(pattern)
    if (match) return `${name} ${match[1].split('.')[0]}`
  }
  return 'Unknown browser'
}

function deviceName(ua) {
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown device'
}

// What gets attached to a report: nothing about the user's plans or Strava account
export function reportDetails() {
  const rows = [['App version', appConfig.expo.version], ['Date', todayStr()]]
  if (Platform.OS === 'web') {
    const ua = navigator.userAgent
    rows.push(
      ['Device', deviceName(ua)],
      ['Browser', browserName(ua)],
      ['Installed to home screen', isStandalone() ? 'Yes' : 'No'],
      ['Screen', `${window.innerWidth} × ${window.innerHeight}`],
    )
  } else {
    rows.push(['Device', `${Platform.OS} ${Platform.Version}`])
  }
  return rows
}

const detailsText = (rows) => rows.map(([label, value]) => `${label}: ${value}`).join('\n')

// Opens the repo's bug report form with the device details filled in
export const githubIssueUrl = (rows) =>
  `${ISSUES_URL}?template=bug_report.yml&title=${encodeURIComponent('Bug: ')}&details=${encodeURIComponent(detailsText(rows))}`

export const bugEmailUrl = (rows) => {
  const body = `What happened?\n\n\nWhat did you expect instead?\n\n\nSteps to reproduce:\n\n\n---\n${detailsText(rows)}\n`
  return `mailto:${BUG_EMAIL}?subject=${encodeURIComponent('TriSync bug report')}&body=${encodeURIComponent(body)}`
}
