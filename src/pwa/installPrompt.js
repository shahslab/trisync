import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

// Chrome/Edge fire `beforeinstallprompt` once, often before React mounts, so it is captured
// here at import time (index.js imports this module on web) and replayed to the menu.
let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined'

if (isWeb) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // show it from our menu instead of the browser's mini-bar
    deferredPrompt = event
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

const isStandalone = () => isWeb && (
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
)

// iPadOS reports itself as a Mac, so also check for touch
const isIOS = () => isWeb && (
  /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
)

// Every iOS browser says "Safari" in its user agent, so rule out the others by name.
// In-app browsers (Instagram, Gmail…) usually drop the "Safari" token altogether.
const isIOSSafari = () => /Safari/.test(navigator.userAgent)
  && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|YaBrowser|FBAN|FBAV|Instagram|Line\//.test(navigator.userAgent)

// 'ios' | 'ios-other' (an iOS browser that isn't Safari) | 'android' | 'desktop'
export function installPlatform() {
  if (isIOS()) return isIOSSafari() ? 'ios' : 'ios-other'
  if (isWeb && /Android/.test(navigator.userAgent)) return 'android'
  return 'desktop'
}

// { available, canPrompt, prompt } — available is false in native builds and once installed
export function useInstallPrompt() {
  const [, rerender] = useState(0)

  useEffect(() => {
    const update = () => rerender((n) => n + 1)
    listeners.add(update)
    return () => listeners.delete(update)
  }, [])

  const prompt = async () => {
    if (!deferredPrompt) return false
    const event = deferredPrompt
    deferredPrompt = null // a prompt can only be shown once
    notify()
    await event.prompt()
    return true
  }

  return { available: isWeb && !isStandalone(), canPrompt: !!deferredPrompt, prompt }
}
