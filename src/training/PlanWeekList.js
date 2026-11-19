import React, { useState } from 'react'
import { YStack, XStack } from 'tamagui'
import { Pressable, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, useWorkoutDisplay } from '../theme/ThemeContext'
import { useTraining } from './TrainingContext'
import { workoutLabel } from './WorkoutRow'
import { estimateHours } from './distanceEstimate'
import { formatHours } from './TrainingVolume'
import { TYPE_ICONS, statusFor, formatShortDay, planWeekOf, subtractDays, FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from './trainingUtils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayMonth = (iso) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`

// The whole plan week by week, one line per workout. Starts at the current week, with earlier
// weeks a tap away. Tapping a workout opens its day in the month view.
export default function PlanWeekList({ onOpenDay }) {
  const t = useTheme()
  const display = useWorkoutDisplay()
  const { today, planRange, workouts } = useTraining()
  const currentWeek = today < planRange.start ? 1 : today > planRange.raceDate ? 1 : planWeekOf(planRange.start, today)
  const [fromWeek, setFromWeek] = useState(currentWeek)

  const weeks = []
  for (let week = fromWeek; week <= planRange.weeks; week++) {
    const first = subtractDays(planRange.start, -(week - 1) * 7)
    const lastDay = subtractDays(first, -6)
    const last = lastDay > planRange.raceDate ? planRange.raceDate : lastDay
    if (first > planRange.raceDate) break
    weeks.push({ week, first, last, list: workouts.filter((w) => w.date >= first && w.date <= last).sort((a, b) => a.date.localeCompare(b.date)) })
  }

  return (
    <YStack gap="$4">
      {fromWeek > 1 && (
        <XStack justifyContent="center">
          <Pressable onPress={() => setFromWeek(1)} accessibilityRole="button" hitSlop={8}>
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 13, color: t.primary }}>Show earlier weeks</Text>
          </Pressable>
        </XStack>
      )}
      {weeks.map(({ week, first, last, list }) => {
        const planned = list.reduce((sum, w) => sum + (estimateHours(w) || 0), 0)
        const isCurrent = week === currentWeek && today >= planRange.start && today <= planRange.raceDate
        return (
          <YStack key={week} gap="$1.5">
            <XStack justifyContent="space-between" alignItems="baseline" borderBottomWidth={1} borderColor={t.border} pb="$1.5">
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: isCurrent ? t.primary : t.text }}>
                Week {week}{isCurrent ? ' · this week' : ''}
              </Text>
              <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12, color: t.subtle }}>
                {dayMonth(first)} – {dayMonth(last)}{planned ? ` · ${formatHours(planned)}` : ''}
              </Text>
            </XStack>
            {list.length === 0 ? (
              <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, color: t.subtle, paddingVertical: 4 }}>No workouts.</Text>
            ) : list.map((w) => {
              const status = statusFor(w, today)
              return (
                <Pressable
                  key={w.id}
                  onPress={() => onOpenDay(w.date)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ width: 52, fontFamily: w.date === today ? FONT_BOLD : FONT_SEMIBOLD, fontSize: 12, color: w.date === today ? t.text : t.subtle }}>
                    {formatShortDay(w.date)}
                  </Text>
                  <YStack width={8} height={8} borderRadius={4} backgroundColor={t.status[status]} />
                  <Ionicons name={TYPE_ICONS[w.type === 'Brick' && w.brickSport ? w.brickSport : w.type] || 'fitness-outline'} size={15} color={t.subtle} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONT_REGULAR, fontSize: 13.5, color: status === 'skipped' ? t.subtle : t.text }}>
                    {workoutLabel(w, display)}
                  </Text>
                  {!!w.stravaActivityId && <Ionicons name="checkmark-circle" size={14} color={t.strava} />}
                </Pressable>
              )
            })}
          </YStack>
        )
      })}
    </YStack>
  )
}
