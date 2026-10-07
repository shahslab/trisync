import { registerRootComponent } from 'expo'
import { Platform } from 'react-native'
import App from './App'

// Only load CSS on web
if (Platform.OS === 'web') {
  require('./app.web.css')
}

registerRootComponent(App)
