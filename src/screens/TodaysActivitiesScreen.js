import React, { useState } from 'react'
import { YStack, XStack, Card, Paragraph } from 'tamagui'
import { Pressable, ScrollView, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { useTraining } from '../training/TrainingContext'
import { Pill, WorkoutList, AddWorkoutForm } from '../training/WorkoutRow'
import PlanProgress from '../training/PlanProgress'
import SyncAllBanner from '../strava/SyncAllBanner'
import StravaSuggestions from '../strava/StravaSuggestions'
import { WeeklyVolume } from '../training/TrainingVolume'
import RaceWeekCard from '../training/RaceWeekCard'
import {
  formatLongDate, mondayOf, subtractDays, dayStatus, shortWeekday, planWeekOf,
  FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD, FONT_EXTRABOLD,
} from '../training/trainingUtils'
import { useTheme } from '../theme/ThemeContext'

// How far back the catch-up list looks for workouts that were never logged
const CATCH_UP_DAYS = 7

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function SectionLabel({ children }) {
  const t = useTheme()
  return (
    <Paragraph style={{ fontFamily: FONT_BOLD }} fontSize={11} letterSpacing={1.5} color={t.subtle} textTransform="uppercase">
      {children}
    </Paragraph>
  )
}

// The current plan week (or Monday to Sunday outside a plan), each day coloured by status.
// Tapping a day opens it in the calendar.
function WeekStrip({ onOpenDay }) {
  const t = useTheme()
  const { today, planRange, workouts, planWeekDates } = useTraining()
  const inPlan = !!planRange && today >= planRange.start && today <= planRange.raceDate
  const days = inPlan
    ? planWeekDates(today)
    : Array.from({ length: 7 }, (_, i) => subtractDays(mondayOf(today), -i))

  return (
    <YStack gap="$2">
      <SectionLabel>{inPlan ? `Week ${planWeekOf(planRange.start, today)}` : 'This week'}</SectionLabel>
      <XStack justifyContent="space-between">
        {days.map((day) => {
          const status = dayStatus(workouts.filter((w) => w.date === day), today)
          const isToday = day === today
          const isRace = planRange?.raceDate === day
          const color = isRace ? t.race : status ? t.status[status] : null
          const filled = status === 'done' || isRace
          return (
            <Pressable
              key={day}
              onPress={() => onOpenDay(day)}
              accessibilityRole="button"
              accessibilityLabel={`${formatLongDate(day)}${status ? `, ${status}` : ''}`}
              style={({ pressed }) => ({ alignItems: 'center', gap: 6, flex: 1, opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontFamily: isToday ? FONT_BOLD : FONT_SEMIBOLD, fontSize: 11, color: isToday ? t.text : t.subtle }}>
                {shortWeekday(day)}
              </Text>
              <YStack
                width={34}
                height={34}
                borderRadius={17}
                alignItems="center"
                justifyContent="center"
                backgroundColor={filled ? color : isToday ? t.surfaceRaised : 'transparent'}
                borderWidth={2}
                borderColor={color || (isToday ? t.text : t.planRing)}
              >
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 13, color: filled ? t.onAccent : t.text }}>
                  {Number(day.slice(8))}
                </Text>
              </YStack>
              <YStack width={5} height={5} borderRadius={3} backgroundColor={isToday ? t.primary : 'transparent'} />
            </Pressable>
          )
        })}
      </XStack>
    </YStack>
  )
}

// Workouts from the past week that were never marked done or partial
function CatchUp({ onUpdate, onDelete }) {
  const t = useTheme()
  const { today, workouts } = useTraining()
  const since = subtractDays(today, CATCH_UP_DAYS)
  const unlogged = workouts.filter((w) => w.status === 'pending' && w.date < today && w.date >= since && w.type !== 'Rest')
  // The list keeps what was shown when it opened, so a workout stays put while it's logged
  // (and while its Strava activity is picked)
  const [shownIds, setShownIds] = useState(null)

  if (!shownIds && unlogged.length === 0) return null

  const shown = shownIds
    ? workouts.filter((w) => shownIds.includes(w.id))
    : []

  return (
    <Card backgroundColor={t.surface} borderColor={unlogged.length ? `${t.status.missed}66` : t.border} borderWidth={1} borderRadius={20} p="$4" gap="$3" style={t.cardShadow}>
      <XStack alignItems="center" gap="$2.5">
        <Ionicons
          name={unlogged.length ? 'alert-circle-outline' : 'checkmark-circle-outline'}
          size={20}
          color={unlogged.length ? t.status.missed : t.status.done}
        />
        <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.text, flex: 1 }}>
          {unlogged.length
            ? `${plural(unlogged.length, 'workout')} from the past week ${unlogged.length === 1 ? "isn't" : "aren't"} logged`
            : 'All caught up'}
        </Text>
        <Pill
          label={shownIds ? 'Hide' : 'Review'}
          onPress={() => setShownIds(shownIds ? null : unlogged.map((w) => w.id))}
        />
      </XStack>
      {shownIds && (
        <YStack gap="$3">
          <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, color: t.subtle }}>
            Mark what you did, or Skip what you deliberately left out. Anything left stays as missed.
          </Text>
          <WorkoutList workouts={shown} today={today} onUpdate={onUpdate} onDelete={onDelete} showDate />
        </YStack>
      )}
    </Card>
  )
}

export default function TodaysActivitiesScreen({ navigation }) {
  const t = useTheme()
  const { today, planRange, workouts, addWorkout, updateWorkout, deleteWorkout } = useTraining()

  const todaysWorkouts = workouts.filter((w) => w.date === today)
  // The calendar tab selects this day; `at` makes repeat taps on the same day count
  const openDay = (date) => navigation.navigate('TrainingPlan', { date, at: Date.now() })

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
    >
      <XStack alignItems="flex-end" justifyContent="space-between" gap="$2">
        <YStack gap="$0.5" flexShrink={1}>
          <Paragraph style={{ fontFamily: FONT_BOLD }} fontSize={11} letterSpacing={2} color={t.subtle} textTransform="uppercase">
            Today
          </Paragraph>
          <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 24, color: t.text }}>{formatLongDate(today)}</Text>
        </YStack>
        {!!planRange && <Pill label="Calendar" icon="calendar-outline" onPress={() => openDay(today)} />}
      </XStack>

      {!planRange ? (
        <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$4" gap="$3" style={t.cardShadow}>
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 16, color: t.text }}>No race plan yet</Text>
          <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.subtle} fontSize={13}>
            Pick your race and date, then start from one of the ready-made plans or build your own.
          </Paragraph>
          <XStack>
            <Pill label="Create a plan" icon="add" variant="primary" onPress={() => navigation.navigate('TrainingPlan')} />
          </XStack>
        </Card>
      ) : (
        <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$4" gap="$4" style={t.cardShadow}>
          <YStack gap="$1">
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 17, color: t.text }}>{planRange.raceName || 'Race Plan'}</Text>
            <PlanProgress />
          </YStack>
          <WeekStrip onOpenDay={openDay} />
          <WeeklyVolume />
        </Card>
      )}

      {!!planRange && <RaceWeekCard key={planRange.raceDate} />}

      {!!planRange && <StravaSuggestions />}

      {!!planRange && <CatchUp onUpdate={updateWorkout} onDelete={deleteWorkout} />}

      {!!planRange && <SyncAllBanner onOpenDay={openDay} />}

      {!!planRange && (
        <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$4" gap="$3" style={t.cardShadow}>
          <SectionLabel>Today's workouts</SectionLabel>
          {todaysWorkouts.length === 0 ? (
            <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.subtle} fontSize={13}>
              Nothing scheduled today. Enjoy the rest, or add a workout below.
            </Paragraph>
          ) : (
            <WorkoutList workouts={todaysWorkouts} today={today} onUpdate={updateWorkout} onDelete={deleteWorkout} />
          )}
          <AddWorkoutForm date={today} onAdd={(w) => addWorkout({ ...w, date: today })} />
        </Card>
      )}
    </ScrollView>
  )
}
