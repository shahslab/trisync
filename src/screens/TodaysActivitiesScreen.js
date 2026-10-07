import React from 'react'
import { YStack, XStack, Card, Paragraph } from 'tamagui'
import { Text } from 'react-native'

import { useTraining } from '../training/TrainingContext'
import { Pill, WorkoutRow } from '../training/WorkoutRow'
import { isoToDisplay, formatLongDate, FONT_REGULAR, FONT_BOLD, FONT_EXTRABOLD } from '../training/trainingUtils'
import { useTheme } from '../theme/ThemeContext'


export default function TodaysActivitiesScreen({ navigation }) {
  const t = useTheme()
  const { today, planRange, workouts, updateWorkout, deleteWorkout } = useTraining()

  const todaysWorkouts = workouts.filter((w) => w.date === today)

  return (
    <YStack flex={1} backgroundColor={t.bg} p="$5" gap="$4">
      <YStack gap="$0.5">
        <Paragraph style={{ fontFamily: FONT_BOLD }} fontSize={11} letterSpacing={2} color={t.subtle} textTransform="uppercase">
            Today
        </Paragraph>
        <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 24, color: t.text }}>{formatLongDate(today)}</Text>
      </YStack>

      {!planRange ? (
        <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$4" style={t.cardShadow}>
          <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.subtle} fontSize={13}>
            No plan set up yet. Head to the full calendar to create one.
          </Paragraph>
        </Card>
      ) : (
        <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$4" gap="$1" style={t.cardShadow}>
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 16, color: t.text }}>{planRange.raceName || 'Race Plan'}</Text>
          <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.subtle} fontSize={13}>Race day {isoToDisplay(planRange.raceDate)}</Paragraph>
        </Card>
      )}

      <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$4" gap="$3" style={t.cardShadow}>
        {todaysWorkouts.length === 0 ? (
          <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.subtle} fontSize={13}>No workouts scheduled for today.</Paragraph>
        ) : (
          todaysWorkouts.map((w) => (
            <WorkoutRow key={w.id} workout={w} today={today} onUpdate={updateWorkout} onDelete={deleteWorkout} />
          ))
        )}
      </Card>
    </YStack>
  )
}