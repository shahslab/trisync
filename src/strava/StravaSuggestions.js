import React, { useEffect, useState } from 'react'
import { YStack, XStack } from 'tamagui'
import { Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { useTraining } from '../training/TrainingContext'
import { useStrava } from './StravaContext'
import { matchingActivities, linkUpdates } from './stravaApi'
import { Pill, workoutLabel } from '../training/WorkoutRow'
import { FONT_REGULAR, FONT_BOLD } from '../training/trainingUtils'

const minutes = (seconds) => {
  const m = Math.round((seconds || 0) / 60)
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`
}

// Pairs today's unlinked Strava activities with today's unlogged workouts of the same sport,
// one activity per workout. A brick leg only pairs once its sport is chosen.
function pairUp(activities, todaysWorkouts, linkedIds) {
  const pairs = []
  const used = new Set(linkedIds)
  todaysWorkouts
    .filter((w) => w.status === 'pending' && !w.stravaActivityId && (w.type !== 'Brick' || w.brickSport))
    .forEach((w) => {
      const match = matchingActivities(activities.filter((a) => !used.has(a.id)), w)[0]
      if (match) {
        used.add(match.id)
        pairs.push({ workout: w, activity: match })
      }
    })
  return pairs
}

// "Strava has a 42 min run today. Mark Run: 40 mins as done?" on the Today tab.
// Checks once each time Today opens (one Strava request).
export default function StravaSuggestions() {
  const t = useTheme()
  const strava = useStrava()
  const { today, workouts, allWorkouts, updateWorkout } = useTraining()
  const [activities, setActivities] = useState(null)
  const [dismissed, setDismissed] = useState([]) // activity ids
  const [busy, setBusy] = useState(null) // workout id being logged
  const [error, setError] = useState(null)

  const hasCandidates = workouts.some((w) => w.date === today && w.status === 'pending' && strava.canSync(w))

  useEffect(() => {
    if (!strava.connected || !hasCandidates || activities) return
    strava.fetchActivitiesOn(today).then(setActivities).catch(() => setActivities([]))
  }, [strava.connected, hasCandidates, today])

  if (!activities?.length) return null
  const todays = workouts.filter((w) => w.date === today)
  const linkedIds = allWorkouts.map((w) => w.stravaActivityId).filter(Boolean)
  const pairs = pairUp(activities, todays, linkedIds).filter((p) => !dismissed.includes(p.activity.id))
  if (pairs.length === 0) return null

  const accept = async ({ workout, activity }) => {
    setBusy(workout.id)
    setError(null)
    try {
      updateWorkout(workout.id, { status: 'done' })
      const result = await strava.syncWorkout({ ...workout, status: 'done' }, {
        linkedActivityIds: linkedIds,
        brickSiblings: workout.type === 'Brick'
          ? todays.filter((w) => w.id !== workout.id && w.type === 'Brick' && w.stravaActivityId)
          : [],
      }, activity.id)
      if (result.status === 'synced') updateWorkout(workout.id, linkUpdates(workout, result.activity))
    } catch (e) {
      setError(e.message)
    }
    setBusy(null)
  }

  return (
    <YStack borderWidth={1} borderColor={`${t.strava}66`} borderRadius={16} backgroundColor={t.surface} p="$3" gap="$3" style={t.cardShadow}>
      {pairs.map((pair) => (
        <YStack key={pair.activity.id} gap="$2">
          <XStack alignItems="center" gap="$2">
            <Ionicons name="flash-outline" size={16} color={t.strava} />
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: t.text, flexShrink: 1 }}>
              Strava has "{pair.activity.name}" · {minutes(pair.activity.moving_time)}
            </Text>
          </XStack>
          <Text style={{ fontFamily: FONT_REGULAR, fontSize: 13, lineHeight: 19, color: t.subtle }}>
            Mark {workoutLabel(pair.workout)} as done and link it?
          </Text>
          <XStack gap="$2">
            <Pill
              label={busy === pair.workout.id ? 'Logging…' : 'Mark done'}
              icon="checkmark"
              variant="primary"
              color={t.status.done}
              onPress={busy ? () => {} : () => accept(pair)}
            />
            <Pill label="Not this one" onPress={() => setDismissed((d) => [...d, pair.activity.id])} />
          </XStack>
        </YStack>
      ))}
      {!!error && <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, color: t.danger }}>{error}</Text>}
    </YStack>
  )
}
