import { registerRootComponent } from 'expo'
import { Platform } from 'react-native'
import App from './App'

// Only load CSS on web
if (Platform.OS === 'web') {
  require('./app.web.css')
  // Hide inactive tabs with display:none. Without it, web stacks them and relies on opaque
  // screen backgrounds, so they show through each other in gradient themes.
  require('react-native-screens').enableScreens(true)
  // Catch the browser's install prompt before the app mounts (used by the ☰ menu)
  require('./src/pwa/installPrompt')
  require('./src/pwa/noZoom')
  // Ask the browser not to clear saved data under storage pressure (granted silently where supported)
  navigator.storage?.persist?.()
  // Offline support / installability for the deployed web app; skipped in dev to avoid stale caches
  if (!__DEV__ && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'))
  }
}

registerRootComponent(App)
