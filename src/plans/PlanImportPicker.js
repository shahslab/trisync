import React, { useState } from 'react'
import { Platform, Pressable, Text } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'

import { Pill } from '../training/WorkoutRow'
import { useTheme } from '../theme/ThemeContext'
import { importPlanFile, PLAN_FILE_EXAMPLE } from './planImport'
import { formatOrdinalDate, subtractDays, FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from '../training/trainingUtils'

const MONO = Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' })

// "Import a Plan" on the new-plan form. `imported` is { plan, fileName } or null;
// `onError` reports a file that couldn't be read.
export default function PlanImportPicker({ imported, onChange, onError, raceIso, today }) {
  const t = useTheme()
  const [showFormat, setShowFormat] = useState(false)
  const label = { fontFamily: FONT_BOLD, fontSize: 11, letterSpacing: 0.6, color: t.subtle, textTransform: 'uppercase' }
  const body = { fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 18, color: t.subtle }

  const choose = async () => {
    const result = await importPlanFile()
    if (result.cancelled) return
    if (result.error) return onError(result.error)
    onChange(result)
  }

  const plan = imported?.plan
  const start = plan && raceIso ? subtractDays(raceIso, plan.weeks * 7 - 1) : null

  return (
    <YStack gap="$2.5">
      <Text style={label}>Import a Plan</Text>
      <Text style={body}>Load your own plan from a JSON file, set to finish on your race day.</Text>

      {plan ? (
        <YStack backgroundColor={t.surfaceRaised} borderColor={t.border} borderWidth={1} borderRadius={14} p="$3" gap="$1.5">
          <XStack alignItems="center" gap="$2">
            <Ionicons name="document-text-outline" size={16} color={t.primary} />
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: t.text, flexShrink: 1 }}>
              {plan.name || imported.fileName} · {plan.weeks} week{plan.weeks === 1 ? '' : 's'}
            </Text>
          </XStack>
          <Text style={body}>
            {plan.workouts.length} workout{plan.workouts.length === 1 ? '' : 's'}
            {start && start >= today ? `, starting ${formatOrdinalDate(start)}` : ''}.
            The plan sets the training weeks for you.
          </Text>
          <XStack gap="$2" mt="$1">
            <Pill label="Choose another" onPress={choose} />
            <Pill label="Remove" onPress={() => onChange(null)} />
          </XStack>
        </YStack>
      ) : (
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Pill label="Choose file" onPress={choose} />
          <Pressable onPress={() => setShowFormat((s) => !s)} accessibilityRole="button" hitSlop={8}>
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12.5, color: t.primary }}>
              {showFormat ? 'Hide file format' : 'See file format'}
            </Text>
          </Pressable>
        </XStack>
      )}

      {showFormat && !plan && (
        <YStack gap="$2">
          <YStack backgroundColor={t.surfaceRaised} borderColor={t.border} borderWidth={1} borderRadius={12} p="$3">
            <Text style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 17, color: t.text }}>{PLAN_FILE_EXAMPLE}</Text>
          </YStack>
          <Text style={body}>
            "week" counts from 1 and "day" from 0 (the plan's first day) to 6. "type" is Swim, Bike, Run,
            Brick, Strength or Rest; "notes" is optional. Enter a brick as two Brick workouts on the same day.
            "weeks" is optional and defaults to the last week with a workout.
          </Text>
        </YStack>
      )}
    </YStack>
  )
}
