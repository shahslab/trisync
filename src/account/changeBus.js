// The providers call localChanged() after saving a synced section, and the account layer
// listens to upload it. Kept free of imports so any provider can use it without a cycle.
const listeners = new Set()

// section: 'training' | 'appearance' | 'stravaKeys'; json: the string just saved, or null
export function localChanged(section, json) {
  listeners.forEach((listener) => listener(section, json))
}

export function onLocalChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
