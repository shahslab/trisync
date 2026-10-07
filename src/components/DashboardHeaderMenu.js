import React from 'react'
import { Button, YStack, Paragraph } from 'tamagui'
import { Popover } from '@tamagui/popover'

export default function DashboardHeaderMenu({ themeName, setThemeName }) {
  return (
    <Popover placement="bottom-end">
      <Popover.Trigger asChild>
        <Button
            unstyled
            backgroundColor="transparent"
            borderWidth={0}
            paddingHorizontal="$2"
            paddingVertical="$1"
            aria-label="Menu"
        >
            ☰
        </Button>
       </Popover.Trigger>

      <Popover.Content bordered elevate padding="$3">
        <YStack gap="$2" minWidth={160}>
          <Paragraph fontWeight="700">Appearance</Paragraph>

          <Button
            size="$3"
            onPress={() => setThemeName(themeName === 'light' ? 'dark' : 'light')}
          >
            {themeName === 'light' ? '🌙 Dark mode' : '🌞 Light mode'}
          </Button>
        </YStack>
      </Popover.Content>
    </Popover>
  )
}
