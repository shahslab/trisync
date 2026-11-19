import { Alert, Platform } from 'react-native'

// Resolves true when the user confirms. window.confirm on web, a two-button alert on native.
export function confirmAsync(title, message, confirmLabel = 'OK') {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`))
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
}
