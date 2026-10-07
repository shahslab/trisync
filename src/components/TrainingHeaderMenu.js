import React, { useState } from 'react'
import { Pressable, Text } from 'react-native'
import { YStack } from 'tamagui'
import { Popover } from '@tamagui/popover'
import { Ionicons } from '@expo/vector-icons'
import { useTraining } from '../training/TrainingContext'
import { useStrava } from '../strava/StravaContext'
import { SURFACE, BORDER, TEXT, SUBTLE, FONT_REGULAR, FONT_SEMIBOLD } from '../training/trainingUtils'

const itemStyle = { paddingVertical: 10, paddingHorizontal: 10 }
const itemText = { fontFamily: FONT_SEMIBOLD, fontSize: 14, color: TEXT }

export default function TrainingHeaderMenu() {
  const { planRange, editPlanLength } = useTraining()
  const strava = useStrava()
  const [open, setOpen] = useState(false)

  const choose = (action) => () => {
    setOpen(false)
    action()
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end">
      <Popover.Trigger asChild>
        <Pressable
          hitSlop={10}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          accessibilityLabel="Menu"
        >
          <Ionicons name="menu" size={24} color={TEXT} />
        </Pressable>
      </Popover.Trigger>

      <Popover.Content
        borderWidth={1}
        borderColor={BORDER}
        backgroundColor={SURFACE}
        borderRadius={14}
        padding="$2"
        elevate
      >
        <YStack minWidth={180}>
          <Pressable
            disabled={!planRange}
            onPress={choose(editPlanLength)}
            style={{ ...itemStyle, opacity: planRange ? 1 : 0.4 }}
          >
            <Text style={itemText}>Edit plan</Text>
          </Pressable>

          {strava.connected ? (
            <Pressable onPress={choose(strava.disconnect)} style={itemStyle}>
              <Text style={itemText}>Disconnect Strava</Text>
              {!!strava.athleteName && (
                <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12, color: SUBTLE }}>{strava.athleteName}</Text>
              )}
            </Pressable>
          ) : (
            <Pressable onPress={choose(strava.connect)} style={itemStyle}>
              <Text style={itemText}>Connect Strava</Text>
            </Pressable>
          )}
        </YStack>
      </Popover.Content>
    </Popover>
  )
}