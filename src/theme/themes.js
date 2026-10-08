// Colour palettes. Dark matches the Strava activity graphic (near-black cards, muted grey
// text, blue accents). Gradient themes paint a gradient behind the whole app and
// use translucent, tinted surfaces on top of it, built on a dark or light base.

const dark = {
  isDark: true,
  gradient: null,
  bg: '#0b0b0d',
  bgSolid: '#0b0b0d', // opaque stand-in for bg (text drawn on light fills, overlays)
  header: '#0b0b0d',
  tabBar: '#121214',
  surface: '#17171a',
  surfaceSolid: '#17171a', // menus and dialogs: opaque even in gradient themes
  surfaceRaised: '#222226',
  border: '#2a2a30',
  text: '#f4f4f5',
  subtle: '#8c8c94',
  disabled: '#3f3f46',
  planRing: '#3a3a40',
  primary: '#3b9eff', // same blue as secondary
  secondary: '#3b9eff', // blue, used by the Add a workout section
  onAccent: '#0b0b0d', // text on primary/status fills
  danger: '#f43f6b',
  dangerBorder: '#5a1a2b',
  status: { done: '#2fd36b', partial: '#ff8a3d', missed: '#f43f6b', upcoming: '#a1a1aa' },
  race: '#facc15',
  cardShadow: { boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
  overlay: 'rgba(0,0,0,0.7)',
}

const light = {
  isDark: false,
  gradient: null,
  bg: '#f4f4f5',
  bgSolid: '#f4f4f5',
  header: '#f4f4f5',
  tabBar: '#ffffff',
  surface: '#ffffff',
  surfaceSolid: '#ffffff',
  surfaceRaised: '#f4f4f5',
  border: '#e4e4e7',
  text: '#18181b',
  subtle: '#71717a',
  disabled: '#d4d4d8',
  planRing: '#d4d4d8',
  primary: '#2563eb',
  secondary: '#2563eb',
  onAccent: '#ffffff',
  danger: '#e11d48',
  dangerBorder: '#fecdd3',
  status: { done: '#16a34a', partial: '#ea580c', missed: '#e11d48', upcoming: '#71717a' },
  race: '#ca8a04',
  cardShadow: { boxShadow: '0 6px 20px rgba(24,24,27,0.08)' },
  overlay: 'rgba(24,24,27,0.45)',
}

// Translucent surfaces that let the gradient show through (blurred on web)
const glass = {
  dark: {
    header: 'transparent',
    tabBar: 'rgba(10,10,14,0.35)',
    surface: 'rgba(10,10,14,0.45)',
    surfaceRaised: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.12)',
    planRing: 'rgba(255,255,255,0.22)',
    cardShadow: { boxShadow: '0 8px 24px rgba(0,0,0,0.25)', backdropFilter: 'blur(18px)' },
  },
  light: {
    header: 'transparent',
    tabBar: 'rgba(255,255,255,0.45)',
    surface: 'rgba(255,255,255,0.55)',
    surfaceRaised: 'rgba(255,255,255,0.7)',
    border: 'rgba(255,255,255,0.85)',
    planRing: 'rgba(24,24,27,0.18)',
    cardShadow: { boxShadow: '0 6px 20px rgba(24,24,27,0.08)', backdropFilter: 'blur(18px)' },
  },
}

// Discord-style gradient presets; `base` picks the dark or light palette underneath
export const GRADIENTS = [
  { id: 'aurora', name: 'Aurora', base: 'dark', colors: ['#0f3b2c', '#13213f', '#2a1745'] },
  { id: 'ember', name: 'Ember', base: 'dark', colors: ['#4a1626', '#2a1530', '#121018'] },
  { id: 'midnight', name: 'Midnight', base: 'dark', colors: ['#101935', '#1f1446', '#0d0d1a'] },
  { id: 'lagoon', name: 'Lagoon', base: 'dark', colors: ['#063f47', '#0d2238', '#0a1420'] },
  { id: 'mint', name: 'Mint', base: 'light', colors: ['#d4f5e4', '#cfe8f7'] },
  { id: 'peach', name: 'Peach', base: 'light', colors: ['#fde7c8', '#f9cfd8'] },
  { id: 'lavender', name: 'Lavender', base: 'light', colors: ['#e6dcfb', '#d3e4fb'] },
]

// units ('imperial' | 'metric') sets how estimated workout distances are shown
export const DEFAULT_APPEARANCE = { mode: 'dark', gradientId: 'aurora', units: 'imperial' }

// appearance: { mode: 'dark' | 'light' | 'gradient', gradientId }
export function themeFor({ mode, gradientId }) {
  if (mode === 'light') return { ...light, name: 'light' }
  if (mode !== 'gradient') return { ...dark, name: 'dark' }

  const preset = GRADIENTS.find((g) => g.id === gradientId) || GRADIENTS[0]
  const base = preset.base === 'light' ? light : dark
  return {
    ...base,
    ...glass[preset.base],
    name: `gradient-${preset.id}`,
    gradient: preset.colors,
    bg: 'transparent',
    bgSolid: preset.colors[0],
  }
}
