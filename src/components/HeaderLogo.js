import React from 'react'
import { Image } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import { GLYPH_ASPECT } from './SplashOverlay'

const WIDTH = 30

// Small tri glyph shown before each page title, tinted like the splash screen
export default function HeaderLogo() {
  const t = useTheme()
  return (
    <Image
      source={require('../../assets/brand/tri-glyph.png')}
      style={{ width: WIDTH, height: WIDTH * GLYPH_ASPECT, tintColor: t.text, marginLeft: 16, marginRight: 10 }}
      resizeMode="contain"
      accessibilityLabel="TriSync"
    />
  )
}
