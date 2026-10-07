import React, { useState } from 'react'
import { Pressable, Text } from 'react-native'
import { YStack } from 'tamagui'
import { Popover } from '@tamagui/popover'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTraining } from '../training/TrainingContext'
import { useStrava } from '../strava/StravaContext'
import { FONT_REGULAR, FONT_SEMIBOLD } from '../training/trainingUtils'
import { useTheme } from '../theme/ThemeContext'
import SettingsModal from './SettingsModal'

const itemStyle = { paddingVertical: 10, paddingHorizontal: 10 }

export default function TrainingHeaderMenu() {
  const { planRange, startEditingPlan } = useTraining()
  const navigation = useNavigation()
  const strava = useStrava()
  const t = useTheme()
  const itemText = { fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.text }
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const choose = (action) => () => {
    setOpen(false)
    action()
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} placement="bottom-end">
        <Popover.Trigger asChild>
          <Pressable
            hitSlop={10}
            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            accessibilityLabel="Menu"
          >
            <Ionicons name="menu" size={24} color={t.text} />
          </Pressable>
        </Popover.Trigger>

        <Popover.Content
          borderWidth={1}
          borderColor={t.border}
          backgroundColor={t.surfaceSolid}
          borderRadius={14}
          padding="$2"
          elevate
        >
          <YStack minWidth={180}>
            <Pressable
              disabled={!planRange}
              onPress={choose(() => {
                // The plan form lives on the Calendar tab
                startEditingPlan()
                navigation.navigate('TrainingPlan')
              })}
              style={{ ...itemStyle, opacity: planRange ? 1 : 0.4 }}
            >
              <Text style={itemText}>Edit plan</Text>
            </Pressable>

            {strava.connected ? (
              <Pressable onPress={choose(strava.disconnect)} style={itemStyle}>
                <Text style={itemText}>Disconnect Strava</Text>
                {!!strava.athleteName && (
                  <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12, color: t.subtle }}>{strava.athleteName}</Text>
                )}
              </Pressable>
            ) : (
              // Without keys, Connect goes to Settings where they're entered
            <Pressable onPress={choose(strava.hasKeys ? strava.connect : () => setSettingsOpen(true))} style={itemStyle}>
                <Text style={itemText}>Connect Strava</Text>
              </Pressable>
            )}

            <Pressable onPress={choose(() => setSettingsOpen(true))} style={itemStyle}>
              <Text style={itemText}>Settings</Text>
            </Pressable>
          </YStack>
        </Popover.Content>
      </Popover>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}