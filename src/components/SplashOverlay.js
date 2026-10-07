import React, { useEffect, useRef, useState } from 'react'
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native'
import { GradientFill, useTheme } from '../theme/ThemeContext'

// Shown for at least this long, so the splash doesn't just flicker on fast loads
const MIN_VISIBLE_MS = 900
const FADE_MS = 350

// Layout shared with the #boot-splash markup in public/index.html (keep the two in sync):
// glyph 220px wide, 20px gap, then the 34px "TriSync" wordmark, centred on screen.
export const SPLASH_GLYPH_WIDTH = 220
export const GLYPH_ASPECT = 413 / 565 // height / width of assets/brand/tri-glyph.png

// Themed splash drawn over the app until `ready`; then it fades out and unmounts
export default function SplashOverlay({ ready }) {
  const t = useTheme()
  const opacity = useRef(new Animated.Value(1)).current
  const [minTimeDone, setMinTimeDone] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Hand over from the static web splash (same look) to this one
    if (Platform.OS === 'web') document.getElementById('boot-splash')?.remove()
    const id = setTimeout(() => setMinTimeDone(true), MIN_VISIBLE_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!ready || !minTimeDone) return
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: Platform.OS !== 'web' })
      .start(() => setVisible(false))
  }, [ready, minTimeDone])

  if (!visible) return null

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity, backgroundColor: t.bgSolid, zIndex: 1000 }]}
    >
      {t.gradient && <GradientFill colors={t.gradient} id="splash-bg" />}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <Image
          source={require('../../assets/brand/tri-glyph.png')}
          style={{ width: SPLASH_GLYPH_WIDTH, height: SPLASH_GLYPH_WIDTH * GLYPH_ASPECT, tintColor: t.text }}
          resizeMode="contain"
          accessibilityLabel="TriSync"
        />
        {/* System font: the app fonts may not have loaded yet */}
        <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: -0.5, color: t.text }}>
          Tri<Text style={{ color: t.primary }}>Sync</Text>
        </Text>
      </View>
    </Animated.View>
  )
}
