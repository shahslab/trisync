import React, { useMemo } from 'react'
import { Linking, Modal, Platform, Pressable, Text } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'

import { useTheme } from '../theme/ThemeContext'
import { reportDetails, githubIssueUrl, bugEmailUrl, BUG_EMAIL } from './bugReport'
import { FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from '../training/trainingUtils'

// Two ways to report a bug, both pre-filled with the device details listed here
export default function ReportBugModal({ visible, onClose }) {
  const t = useTheme()
  // Read when opened, so the screen size and install state are current
  const details = useMemo(() => (visible ? reportDetails() : []), [visible])
  const body = { fontFamily: FONT_REGULAR, fontSize: 13.5, lineHeight: 20, color: t.text }

  const open = (url) => {
    // On web, Linking opens a new tab, which mailto: would leave blank
    if (Platform.OS === 'web' && url.startsWith('mailto:')) window.location.href = url
    else Linking.openURL(url)
    onClose()
  }

  const button = (primary) => ({
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 999,
    backgroundColor: primary ? t.primary : 'transparent', borderWidth: 1, borderColor: primary ? t.primary : t.border,
  })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: t.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 420 }}>
          <YStack backgroundColor={t.surfaceSolid} borderColor={t.border} borderWidth={1} borderRadius={20} p="$5" gap="$4">
            <XStack justifyContent="space-between" alignItems="center" width="100%">
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 18, color: t.text }}>Report a Bug</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close bug report">
                <Ionicons name="close" size={22} color={t.subtle} />
              </Pressable>
            </XStack>

            <Text style={body}>
              Tell me what went wrong and what you expected instead. Steps to make it happen again help the most.
            </Text>

            <YStack gap="$2">
              <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 11, letterSpacing: 0.6, color: t.subtle, textTransform: 'uppercase' }}>
                Added to your report
              </Text>
              <YStack backgroundColor={t.surfaceRaised} borderColor={t.border} borderWidth={1} borderRadius={12} p="$3" gap="$1">
                {details.map(([label, value]) => (
                  <XStack key={label} justifyContent="space-between" gap="$3">
                    <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, color: t.subtle }}>{label}</Text>
                    <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12.5, color: t.text, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
                  </XStack>
                ))}
              </YStack>
              <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12, lineHeight: 17, color: t.subtle }}>
                Your plans and Strava details are never included. If the bug is in a plan, you can attach a backup from Settings yourself.
              </Text>
            </YStack>

            <YStack gap="$2">
              <Pressable onPress={() => open(githubIssueUrl(details))} style={button(true)}>
                <Ionicons name="logo-github" size={17} color={t.onAccent} />
                <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.onAccent }}>Report on GitHub</Text>
              </Pressable>
              <Pressable onPress={() => open(bugEmailUrl(details))} style={button(false)}>
                <Ionicons name="mail-outline" size={17} color={t.text} />
                <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.text }}>Email instead</Text>
              </Pressable>
              <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12, color: t.subtle, textAlign: 'center' }} selectable>
                No GitHub account? Email {BUG_EMAIL}
              </Text>
            </YStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
