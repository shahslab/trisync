import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_APPEARANCE, GRADIENTS, themeFor } from './themes'
import { localChanged } from '../account/changeBus'

export const STORAGE_KEY = 'trisync/appearance/v1'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(DEFAULT_APPEARANCE)
  const [loaded, setLoaded] = useState(false)

  // Reads the saved appearance; also called after an account's data replaces the device's
  const reload = () => AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => setAppearanceState({ ...DEFAULT_APPEARANCE, ...(stored ? JSON.parse(stored) : null) }))
    .catch(() => {})

  useEffect(() => {
    reload().finally(() => setLoaded(true))
  }, [])

  const setAppearance = (changes) => {
    setAppearanceState((prev) => {
      const next = { ...prev, ...changes }
      const json = JSON.stringify(next)
      AsyncStorage.setItem(STORAGE_KEY, json).then(() => localChanged('appearance', json))
      return next
    })
  }

  const value = useMemo(() => ({ theme: themeFor(appearance), appearance, setAppearance, reload }), [appearance])

  // Avoid flashing the default theme before the saved one loads
  if (!loaded) return null

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx.theme
}

export function useAppearance() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useAppearance must be used within a ThemeProvider')
  return { appearance: ctx.appearance, setAppearance: ctx.setAppearance, reload: ctx.reload, gradients: GRADIENTS }
}

// 'imperial' | 'metric', for estimated workout distances
export function useUnits() {
  return useAppearance().appearance.units
}

// Diagonal gradient filling its parent; used behind the app and for settings swatches
export function GradientFill({ colors, id, style }) {
  return (
    <Svg style={style || StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {colors.map((color, i) => (
            <Stop key={color} offset={i / (colors.length - 1)} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  )
}

// Full-screen app background: the gradient for gradient themes, otherwise the solid bg
export function AppBackground({ children }) {
  const theme = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: theme.bgSolid }}>
      {theme.gradient && <GradientFill colors={theme.gradient} id="app-bg" />}
      {children}
    </View>
  )
}
