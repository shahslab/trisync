import React from 'react'
import { YStack, XStack } from 'tamagui'
import { Text } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import { useTraining } from './TrainingContext'
import { daysBetween, planWeekOf, isTraining, FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from './trainingUtils'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// "Week 4 of 12 · 52 days to go", or where the plan stands before or after it runs
export function planHeadline(planRange, today) {
  const daysToRace = daysBetween(today, planRange.raceDate)
  if (daysToRace < 0) return 'Race complete'
  if (daysToRace === 0) return 'Race day is today'
  if (today < planRange.start) return `Starts in ${plural(daysBetween(today, planRange.start), 'day')}`
  return `Week ${planWeekOf(planRange.start, today)} of ${planRange.weeks} · ${plural(daysToRace, 'day')} to go`
}

// This plan week's training (rest days aside): a bar of done and partial workouts and a count
export default function PlanProgress({ showHeadline = true }) {
  const t = useTheme()
  const { today, planRange, workouts, planWeekDates } = useTraining()
  if (!planRange) return null

  const inPlan = today >= planRange.start && today <= planRange.raceDate
  const week = inPlan ? planWeekDates(today) : []
  const weekWorkouts = workouts.filter((w) => week.includes(w.date) && isTraining(w))
  const done = weekWorkouts.filter((w) => w.status === 'done').length
  const partial = weekWorkouts.filter((w) => w.status === 'partial').length
  const skipped = weekWorkouts.filter((w) => w.status === 'skipped').length
  const total = weekWorkouts.length

  return (
    <YStack gap="$2">
      {showHeadline && (
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 15, color: t.primary }}>{planHeadline(planRange, today)}</Text>
      )}
      {inPlan && total > 0 && (
        <YStack gap="$1.5">
          <XStack height={8} borderRadius={4} overflow="hidden" backgroundColor={t.surfaceRaised} borderWidth={1} borderColor={t.border}>
            <YStack width={`${(done / total) * 100}%`} backgroundColor={t.status.done} />
            <YStack width={`${(partial / total) * 100}%`} backgroundColor={t.status.partial} />
          </XStack>
          <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, color: t.subtle }}>
            <Text style={{ fontFamily: FONT_SEMIBOLD, color: t.text }}>{done} of {total}</Text> done this week
            {partial > 0 ? ` · ${partial} partial` : ''}
            {skipped > 0 ? ` · ${skipped} skipped` : ''}
          </Text>
        </YStack>
      )}
    </YStack>
  )
}
