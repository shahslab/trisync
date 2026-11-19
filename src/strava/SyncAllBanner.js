import React, { useState } from 'react'
import { YStack, XStack } from 'tamagui'
import { Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { useTraining } from '../training/TrainingContext'
import { useStrava } from './StravaContext'
import { linkUpdates } from './stravaApi'
import { Pill } from '../training/WorkoutRow'
import { formatShortDay, isTrained, FONT_REGULAR, FONT_BOLD } from '../training/trainingUtils'

// A sync is about 3 Strava requests and the app's limit is 100 every 15 minutes
const MAX_PER_RUN = 15

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// Offers to sync every logged workout in the current plan that isn't linked to Strava yet.
// Ones that need a choice (several candidate activities, or none yet) are left for their own card.
export default function SyncAllBanner({ onOpenDay }) {
  const t = useTheme()
  const strava = useStrava()
  const { workouts, allWorkouts, updateWorkout } = useTraining()
  const [run, setRun] = useState(null) // { running, done, total, synced, skipped: [workout], error }

  if (!strava.connected) return null

  const unsynced = workouts
    .filter((w) => isTrained(w) && !w.stravaActivityId && strava.canSync(w))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (!run && unsynced.length === 0) return null

  const syncAll = async () => {
    const batch = unsynced.slice(0, MAX_PER_RUN)
    // Links made during this run, which `workouts` won't show until the next render
    const linked = allWorkouts.filter((w) => w.stravaActivityId)
    const skipped = []
    let synced = 0
    let error = null
    setRun({ running: true, done: 0, total: batch.length })
    for (const [i, w] of batch.entries()) {
      try {
        const result = await strava.syncWorkout(w, {
          linkedActivityIds: linked.map((l) => l.stravaActivityId),
          brickSiblings: w.type === 'Brick'
            ? linked.filter((l) => l.type === 'Brick' && l.date === w.date && workouts.some((x) => x.id === l.id))
            : [],
        })
        if (result.status === 'synced') {
          const updates = linkUpdates(w, result.activity)
          updateWorkout(w.id, updates)
          linked.push({ ...w, ...updates })
          synced += 1
        } else {
          skipped.push(w)
        }
      } catch (e) {
        error = e.message
        break
      }
      setRun({ running: true, done: i + 1, total: batch.length })
    }
    setRun({ running: false, synced, skipped, error, more: unsynced.length > batch.length })
  }

  let body
  if (run?.running) {
    body = <Text style={textStyle(t)}>Syncing {run.done + 1} of {run.total}…</Text>
  } else if (run) {
    body = (
      <YStack gap="$2">
        <Text style={textStyle(t)}>
          {run.error
            ? `Stopped after ${plural(run.synced, 'workout')}: ${run.error}`
            : `Synced ${plural(run.synced, 'workout')}.`}
          {run.skipped?.length > 0 && ` ${plural(run.skipped.length, 'workout')} need${run.skipped.length === 1 ? 's' : ''} you to pick the Strava activity, or ${run.skipped.length === 1 ? "hasn't" : "haven't"} uploaded yet:`}
        </Text>
        {run.skipped?.length > 0 && (
          <XStack gap="$2" flexWrap="wrap">
            {run.skipped.map((w) => (
              <Pill key={w.id} label={`${formatShortDay(w.date)} · ${w.brickSport ? `Brick ${w.brickSport}` : w.type}`} onPress={() => onOpenDay(w.date)} />
            ))}
          </XStack>
        )}
        <XStack gap="$2">
          {unsynced.length > 0 && !run.skipped?.length && <Pill label="Sync the rest" onPress={syncAll} />}
          <Pill label="Dismiss" onPress={() => setRun(null)} />
        </XStack>
      </YStack>
    )
  } else {
    body = (
      <XStack gap="$2" alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Text style={{ ...textStyle(t), flexShrink: 1 }}>
          {plural(unsynced.length, 'logged workout')} {unsynced.length === 1 ? "isn't" : "aren't"} on Strava yet.
        </Text>
        <Pill label="Sync all" icon="sync-outline" color={t.strava} variant="primary" onPress={syncAll} />
      </XStack>
    )
  }

  return (
    <YStack borderWidth={1} borderColor={`${t.strava}66`} borderRadius={16} backgroundColor={t.surface} p="$3" gap="$2" style={t.cardShadow}>
      <XStack alignItems="center" gap="$2">
        <Ionicons name="cloud-upload-outline" size={16} color={t.strava} />
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: t.text }}>Strava</Text>
      </XStack>
      {body}
    </YStack>
  )
}

const textStyle = (t) => ({ fontFamily: FONT_REGULAR, fontSize: 13, lineHeight: 19, color: t.subtle })
