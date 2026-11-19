import React from 'react'
import { YStack, XStack } from 'tamagui'
import { Pressable, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { useTraining } from './TrainingContext'
import { estimateHours, sportOf } from './distanceEstimate'
import { TYPE_ICONS, planWeekOf, subtractDays, isTraining, FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from './trainingUtils'

const SPORTS = ['Swim', 'Bike', 'Run', 'Strength']

// Hours trained: done counts in full, partial as half
const trainedShare = (w) => (w.status === 'done' ? 1 : w.status === 'partial' ? 0.5 : 0)

export function formatHours(hours) {
  const mins = Math.round(hours * 60)
  if (mins < 60) return `${mins}m`
  return mins % 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins / 60}h`
}

// { planned, trained } hours for a list of workouts (those with no duration are left out)
function volumeOf(list) {
  return list.reduce((sum, w) => {
    const hours = estimateHours(w)
    if (!hours) return sum
    return { planned: sum.planned + hours, trained: sum.trained + hours * trainedShare(w) }
  }, { planned: 0, trained: 0 })
}

// This plan week's planned and trained hours for each sport
export function WeeklyVolume() {
  const t = useTheme()
  const { today, planRange, workouts, planWeekDates } = useTraining()
  if (!planRange || today < planRange.start || today > planRange.raceDate) return null

  const week = planWeekDates(today)
  const weekWorkouts = workouts.filter((w) => week.includes(w.date) && isTraining(w))
  const rows = SPORTS
    .map((sport) => ({ sport, ...volumeOf(weekWorkouts.filter((w) => sportOf(w) === sport)) }))
    .filter((r) => r.planned > 0)
  if (rows.length === 0) return null
  const total = volumeOf(weekWorkouts)

  return (
    <YStack gap="$2.5">
      <XStack justifyContent="space-between" alignItems="baseline">
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, letterSpacing: 1.5, color: t.subtle, textTransform: 'uppercase' }}>Hours this week</Text>
        <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12.5, color: t.subtle }}>
          <Text style={{ color: t.text }}>{formatHours(total.trained)}</Text> of {formatHours(total.planned)}
        </Text>
      </XStack>
      {rows.map((r) => (
        <XStack key={r.sport} alignItems="center" gap="$2.5">
          <Ionicons name={TYPE_ICONS[r.sport]} size={15} color={t.subtle} />
          <Text style={{ width: 62, fontFamily: FONT_SEMIBOLD, fontSize: 12.5, color: t.text }}>{r.sport}</Text>
          <XStack flex={1} height={8} borderRadius={4} overflow="hidden" backgroundColor={t.surfaceRaised} borderWidth={1} borderColor={t.border}>
            <YStack width={`${Math.min(1, r.trained / r.planned) * 100}%`} backgroundColor={t.status.done} />
          </XStack>
          <Text style={{ width: 92, textAlign: 'right', fontFamily: FONT_REGULAR, fontSize: 12, color: t.subtle }}>
            {formatHours(r.trained)} / {formatHours(r.planned)}
          </Text>
        </XStack>
      ))}
      <Text style={{ fontFamily: FONT_REGULAR, fontSize: 11.5, color: t.subtle }}>
        From the durations in workout titles. Partial workouts count as half.
      </Text>
    </YStack>
  )
}

const CHART_HEIGHT = 64

// One column per plan week: planned hours as the outline, trained hours filled in.
// Tapping a column selects that week's first day.
export function PlanVolumeChart({ onSelectWeek }) {
  const t = useTheme()
  const { today, planRange, workouts } = useTraining()
  if (!planRange) return null

  const weeks = Array.from({ length: planRange.weeks }, (_, i) => {
    const first = subtractDays(planRange.start, -i * 7)
    const last = subtractDays(first, -6)
    return { week: i + 1, first, ...volumeOf(workouts.filter((w) => w.date >= first && w.date <= last && isTraining(w))) }
  })
  const max = Math.max(...weeks.map((w) => w.planned))
  if (!max) return null
  const currentWeek = today >= planRange.start && today <= planRange.raceDate ? planWeekOf(planRange.start, today) : null

  return (
    <YStack gap="$1.5">
      <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, letterSpacing: 1.5, color: t.subtle, textTransform: 'uppercase' }}>Hours by week</Text>
      <XStack height={CHART_HEIGHT} alignItems="flex-end" gap={3}>
        {weeks.map((w) => {
          const isCurrent = w.week === currentWeek
          return (
            <Pressable
              key={w.week}
              onPress={() => onSelectWeek(w.first)}
              accessibilityRole="button"
              accessibilityLabel={`Week ${w.week}: ${formatHours(w.trained)} of ${formatHours(w.planned)}`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
            >
              <YStack
                height={Math.max(2, (w.planned / max) * CHART_HEIGHT)}
                borderRadius={3}
                borderWidth={1}
                borderColor={isCurrent ? t.primary : t.planRing}
                justifyContent="flex-end"
                overflow="hidden"
              >
                <YStack height={`${w.planned ? (w.trained / w.planned) * 100 : 0}%`} backgroundColor={t.status.done} />
              </YStack>
            </Pressable>
          )
        })}
      </XStack>
      <XStack justifyContent="space-between">
        <Text style={{ fontFamily: FONT_REGULAR, fontSize: 11, color: t.subtle }}>W1</Text>
        <Text style={{ fontFamily: FONT_REGULAR, fontSize: 11, color: t.subtle }}>Peak {formatHours(max)}</Text>
        <Text style={{ fontFamily: FONT_REGULAR, fontSize: 11, color: t.subtle }}>W{planRange.weeks}</Text>
      </XStack>
    </YStack>
  )
}
