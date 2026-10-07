import React from 'react'
import { Pressable, Text } from 'react-native'
import { YStack } from 'tamagui'
import { Popover } from '@tamagui/popover'
import { Ionicons } from '@expo/vector-icons'
import { useTraining } from '../training/TrainingContext'
import { SURFACE, BORDER, TEXT, FONT_SEMIBOLD } from '../training/trainingUtils'

export default function TrainingHeaderMenu() {
  const { planRange, editPlanLength } = useTraining()

  return (
    <Popover placement="bottom-end">
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
        <YStack minWidth={160}>
          <Pressable
            disabled={!planRange}
            onPress={editPlanLength}
            style={{ paddingVertical: 10, paddingHorizontal: 10, opacity: planRange ? 1 : 0.4 }}
          >
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: TEXT }}>
              Edit plan
            </Text>
          </Pressable>
        </YStack>
      </Popover.Content>
    </Popover>
  )
}