import React from 'react'
import { YStack, XStack, Card, Paragraph } from 'tamagui'
import { Text } from 'react-native'

import { useTraining } from '../training/TrainingContext'
import { Pill, WorkoutRow } from '../training/WorkoutRow'
import { isoToDisplay, formatLongDate, BG, TEXT, SUBTLE, BORDER, SURFACE, CARD_SHADOW, FONT_REGULAR, FONT_BOLD, FONT_EXTRABOLD } from '../training/trainingUtils'


export default function TodaysActivitiesScreen({ navigation }) {
  const { today, planRange, workouts, updateWorkout, deleteWorkout } = useTraining()

  const todaysWorkouts = workouts.filter((w) => w.date === today)

  return (
    <YStack f={1} backgroundColor={BG} p="$5" gap="$4">
      <YStack gap="$0.5">
        <Paragraph fontFamily={FONT_BOLD} fontSize={11} letterSpacing={2} color={SUBTLE} textTransform="uppercase">
            Today
        </Paragraph>
        <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 24, color: TEXT }}>{formatLongDate(today)}</Text>
      </YStack>

      {!planRange ? (
        <Card backgroundColor={SURFACE} borderColor={BORDER} borderWidth={1} borderRadius={20} p="$4" style={CARD_SHADOW}>
          <Paragraph fontFamily={FONT_REGULAR} color={SUBTLE} fontSize={13}>
            No plan set up yet. Head to the full calendar to create one.
          </Paragraph>
        </Card>
      ) : (
        <Card backgroundColor={SURFACE} borderColor={BORDER} borderWidth={1} borderRadius={20} p="$4" gap="$1" style={CARD_SHADOW}>
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 16, color: TEXT }}>{planRange.raceName || 'Race Plan'}</Text>
          <Paragraph fontFamily={FONT_REGULAR} color={SUBTLE} fontSize={13}>Race day {isoToDisplay(planRange.raceDate)}</Paragraph>
        </Card>
      )}

      <Card backgroundColor={SURFACE} borderColor={BORDER} borderWidth={1} borderRadius={20} p="$4" gap="$3" style={CARD_SHADOW}>
        {todaysWorkouts.length === 0 ? (
          <Paragraph fontFamily={FONT_REGULAR} color={SUBTLE} fontSize={13}>No workouts scheduled for today.</Paragraph>
        ) : (
          todaysWorkouts.map((w) => (
            <WorkoutRow key={w.id} workout={w} today={today} onUpdate={updateWorkout} onDelete={deleteWorkout} />
          ))
        )}
      </Card>
    </YStack>
  )
}