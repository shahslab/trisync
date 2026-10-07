import React, { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'

import { useTheme } from '../theme/ThemeContext'
import { installPlatform } from './installPrompt'
import { FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from '../training/trainingUtils'

// Step text with the icon of the browser button it refers to
const STEPS = {
  ios: {
    intro: 'Open TriSync in Safari, then:',
    steps: [
      { icon: 'share-outline', text: 'Tap the Share button (bottom of the screen on iPhone, top right on iPad)' },
      { icon: 'add', boxed: true, text: 'Scroll down and tap Add to Home Screen' },
      { icon: 'checkmark', text: 'Tap Add. TriSync appears on your home screen' },
    ],
    note: 'The installed app keeps its own data, separate from Safari, so set up Strava from inside it.',
  },
  'ios-other': {
    intro: 'On iPhone and iPad, TriSync can only be installed from Safari:',
    steps: [
      { icon: 'link-outline', text: 'Copy this page\'s link with the button below' },
      { icon: 'compass-outline', text: 'Open Safari and paste the link into the address bar' },
      { icon: 'menu', text: 'In Safari, open the ☰ menu and tap Install TriSync again' },
    ],
    copyLink: true,
    note: 'Inside apps like Instagram or Gmail you can also use their ⋯ menu → Open in Safari.',
  },
  android: {
    intro: 'Open TriSync in Chrome, then:',
    steps: [
      { icon: 'ellipsis-vertical', text: 'Tap the ⋮ menu in the top right' },
      { icon: 'download-outline', text: 'Tap Install app (or Add to Home screen → Install)' },
      { icon: 'checkmark', text: 'TriSync appears on your home screen and in your app drawer' },
    ],
    note: 'If you opened this link inside another app (Gmail, Instagram…), choose Open in Chrome first.',
  },
  desktop: {
    intro: 'In Chrome or Edge:',
    steps: [
      { icon: 'desktop-outline', text: 'Click the install icon at the right of the address bar' },
      { icon: 'ellipsis-vertical', text: 'Or open the ⋮ menu → Cast, save and share → Install page as app' },
    ],
    note: 'Safari and Firefox on computers can\'t install web apps.',
  },
}

function StepIcon({ name, boxed }) {
  const t = useTheme()
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.surfaceRaised,
        borderWidth: 1,
        borderColor: t.border,
      }}
    >
      {boxed ? (
        <View style={{ borderWidth: 1.5, borderColor: t.secondary, borderRadius: 5, padding: 1 }}>
          <Ionicons name={name} size={14} color={t.secondary} />
        </View>
      ) : (
        <Ionicons name={name} size={19} color={t.secondary} />
      )}
    </View>
  )
}

export default function InstallModal({ visible, onClose }) {
  const t = useTheme()
  const guide = STEPS[installPlatform()]
  const [copied, setCopied] = useState(false)
  const body = { fontFamily: FONT_REGULAR, fontSize: 13.5, lineHeight: 20, color: t.text, flexShrink: 1 }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      // Clipboard can be blocked in in-app browsers; the URL is shown for copying by hand
      setCopied('failed')
    }
  }

  const close = () => {
    setCopied(false)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: t.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 }} onPress={close}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 420 }}>
          <YStack backgroundColor={t.surfaceSolid} borderColor={t.border} borderWidth={1} borderRadius={20} p="$5" gap="$4">
            <XStack justifyContent="space-between" alignItems="center" width="100%">
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 18, color: t.text }}>Install TriSync</Text>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close install instructions">
                <Ionicons name="close" size={22} color={t.subtle} />
              </Pressable>
            </XStack>

            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 13, color: t.subtle }}>{guide.intro}</Text>

            <YStack gap="$3">
              {guide.steps.map((step, i) => (
                <XStack key={step.text} gap="$3" alignItems="center">
                  <StepIcon name={step.icon} boxed={step.boxed} />
                  <Text style={body}>{`${i + 1}. ${step.text}`}</Text>
                </XStack>
              ))}
            </YStack>

            {guide.copyLink && (
              <YStack gap="$2">
                <Pressable
                  onPress={copyLink}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 999, backgroundColor: t.primary }}
                >
                  <Ionicons name={copied === true ? 'checkmark' : 'copy-outline'} size={17} color={t.onAccent} />
                  <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.onAccent }}>
                    {copied === true ? 'Link copied' : 'Copy link'}
                  </Text>
                </Pressable>
                {copied === 'failed' && (
                  <Text selectable style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, color: t.text, textAlign: 'center' }}>
                    {window.location.href}
                  </Text>
                )}
              </YStack>
            )}

            <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 18, color: t.subtle }}>{guide.note}</Text>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
