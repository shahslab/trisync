import React, { useState } from 'react'
import { Modal, Pressable, ScrollView, Text } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'

import { Pill } from '../training/WorkoutRow'
import { useTheme } from '../theme/ThemeContext'
import { downloadPlanIcs } from './icsExport'
import { FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from '../training/trainingUtils'

const APPS = [
  {
    name: 'Google Calendar',
    steps: 'On a computer, open calendar.google.com → ⚙ Settings → Import & export → choose the file → Import. (The Google Calendar phone app can’t import files.)',
  },
  {
    name: 'Apple Calendar',
    steps: 'On iPhone or iPad, tap the downloaded file and choose Add All. On a Mac, double-click the file.',
  },
  {
    name: 'Outlook / Microsoft 365',
    steps: 'In Outlook on the web, open Calendar → Add calendar → Upload from file → choose the file → Import.',
  },
]

// Downloads a plan as an .ics file and explains how to add it to common calendar apps
export default function CalendarExportModal({ plan, onClose }) {
  const t = useTheme()
  const [downloaded, setDownloaded] = useState(false)
  if (!plan) return null

  const body = { fontFamily: FONT_REGULAR, fontSize: 13, lineHeight: 19, color: t.subtle }
  const close = () => {
    setDownloaded(false)
    onClose()
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: t.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 }} onPress={close}>
        {/* Inner Pressable swallows taps so only the backdrop closes the dialog */}
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 420, maxHeight: '90%' }}>
          <YStack backgroundColor={t.surfaceSolid} borderColor={t.border} borderWidth={1} borderRadius={20} overflow="hidden" maxHeight="100%" flexShrink={1}>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
              <XStack justifyContent="space-between" alignItems="center" width="100%">
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 18, color: t.text }}>Add to Calendar</Text>
                <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close calendar export">
                  <Ionicons name="close" size={22} color={t.subtle} />
                </Pressable>
              </XStack>

              <Text style={body}>
                Download <Text style={{ fontFamily: FONT_SEMIBOLD, color: t.text }}>{plan.raceName || 'this plan'}</Text> as a calendar
                file: {plan.workouts.length} workout{plan.workouts.length === 1 ? '' : 's'} as all-day events, plus race day.
                Then add it to your calendar app.
              </Text>

              <XStack gap="$2" alignItems="center" flexWrap="wrap">
                <Pill
                  label={downloaded ? 'Download again' : 'Download .ics file'}
                  variant="primary"
                  onPress={() => {
                    downloadPlanIcs(plan)
                    setDownloaded(true)
                  }}
                />
                {downloaded && <Text style={{ ...body, color: t.status.done }}>Downloaded</Text>}
              </XStack>

              {APPS.map((app) => (
                <YStack key={app.name} gap="$1">
                  <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.text }}>{app.name}</Text>
                  <Text style={body}>{app.steps}</Text>
                </YStack>
              ))}

              <Text style={{ ...body, fontSize: 12.5 }}>
                The file is a snapshot of the plan right now. If you change the plan later, importing a new file
                can create duplicate events, so remove the old ones first.
              </Text>
            </ScrollView>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
