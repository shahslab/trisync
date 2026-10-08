import React from 'react'
import { Platform, Text, View } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'

import { Pill } from '../training/WorkoutRow'
import { useTheme } from '../theme/ThemeContext'
import { PLAN_LIBRARY } from './planLibrary'
import { daysBetween, formatOrdinalDate, subtractDays, FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from '../training/trainingUtils'

const DISTANCES = ['Sprint', 'Olympic', '70.3', '140.6']
const LEVELS = ['Beginner', 'Intermediate', 'Advanced']
const LENGTHS = [8, 12]

// The plan files are served next to the web app (public/plans), so this is web only
export const planLibrarySupported = Platform.OS === 'web'

export async function loadLibraryPlan(entry) {
  const res = await fetch(new URL(`plans/${entry.id}.json`, document.baseURI))
  if (!res.ok) throw new Error(`Couldn't load the ${entry.distance} plan (${res.status}). Check your connection and try again.`)
  return { weeks: entry.weeks, workouts: await res.json() }
}

const findEntry = ({ distance, level, weeks }) =>
  PLAN_LIBRARY.find((p) => p.distance === distance && p.level === level && p.weeks === weeks)

function Choice({ label, active, disabled, onPress }) {
  return (
    <View style={{ opacity: disabled ? 0.35 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
      <Pill label={label} active={active} onPress={onPress} />
    </View>
  )
}

// "Available Plans" on the new-plan form. `selection` is { distance, level, weeks } or null;
// `raceIso` (when chosen) greys out lengths that would have to start before today.
// "None" also covers an imported plan file; `imported` hides its blank-plan description then.
// `noneText` describes what "None" means on this form; `defaultWeeks` is the length picked first, if it fits.
export default function PlanLibraryPicker({ selection, onChange, raceIso, today, imported, noneText, defaultWeeks }) {
  const t = useTheme()
  const label = { fontFamily: FONT_SEMIBOLD, fontSize: 11, letterSpacing: 0.6, color: t.subtle, textTransform: 'uppercase' }
  const body = { fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 18, color: t.subtle }

  const weeksToRace = raceIso ? Math.floor((daysBetween(today, raceIso) + 1) / 7) : null
  const fits = (weeks) => !raceIso || subtractDays(raceIso, weeks * 7 - 1) >= today
  const entry = selection && findEntry(selection)
  const start = entry && raceIso ? subtractDays(raceIso, entry.weeks * 7 - 1) : null

  const pick = (changes) => {
    const firstWeeks = LENGTHS.includes(defaultWeeks) && fits(defaultWeeks) ? defaultWeeks : LENGTHS.find(fits) ?? 8
    const next = { level: 'Beginner', weeks: firstWeeks, ...selection, ...changes }
    onChange(next.distance ? next : null)
  }

  return (
    <YStack gap="$2.5">
      <Text style={{ ...label, fontFamily: FONT_BOLD }}>Available Plans</Text>
      <Text style={body}>Start from a free triathlon plan, set to finish on your race day.</Text>

      <XStack gap="$2" flexWrap="wrap">
        <Choice label="None" active={!selection} onPress={() => onChange(null)} />
        {DISTANCES.map((d) => (
          <Choice key={d} label={d} active={selection?.distance === d} onPress={() => pick({ distance: d })} />
        ))}
      </XStack>

      {!selection && !imported && (
        <Text style={body}>
          {noneText || "You'll start with an empty plan and add your own workouts day by day on the calendar."}
        </Text>
      )}

      {selection && (
        <>
          <Text style={label}>Level</Text>
          <XStack gap="$2" flexWrap="wrap">
            {LEVELS.map((l) => (
              <Choice key={l} label={l} active={selection.level === l} onPress={() => pick({ level: l })} />
            ))}
          </XStack>

          <Text style={label}>Length</Text>
          <XStack gap="$2" flexWrap="wrap" alignItems="center">
            {LENGTHS.map((w) => (
              <Choice key={w} label={`${w} weeks`} active={selection.weeks === w} disabled={!fits(w)} onPress={() => pick({ weeks: w })} />
            ))}
          </XStack>
          {raceIso && !LENGTHS.every(fits) && (
            <Text style={body}>
              Your race is {weeksToRace < 1 ? 'less than a week' : `${weeksToRace} week${weeksToRace === 1 ? '' : 's'}`} away,
              so longer plans would have to start in the past.
            </Text>
          )}

          {entry && (
            <YStack backgroundColor={t.surfaceRaised} borderColor={t.border} borderWidth={1} borderRadius={14} p="$3" gap="$1.5">
              <XStack alignItems="center" gap="$2">
                <Ionicons name="document-text-outline" size={16} color={t.primary} />
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: t.text, flexShrink: 1 }}>
                  {entry.distance} {entry.level} · {entry.weeks} weeks
                </Text>
              </XStack>
              <Text style={body}>
                {entry.count} workouts{start && fits(entry.weeks) ? `, starting ${formatOrdinalDate(start)}` : ''}.
                The plan sets the training weeks for you.
              </Text>
            </YStack>
          )}
        </>
      )}
    </YStack>
  )
}

export { findEntry }
