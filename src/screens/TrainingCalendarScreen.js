import React, { useMemo, useState } from 'react'
import { YStack, XStack, Card, Paragraph, Input } from 'tamagui'
import { Pressable, Text, ScrollView } from 'react-native'
import { Calendar, LocaleConfig } from 'react-native-calendars'

import { useTraining } from '../training/TrainingContext'
import { Pill, WorkoutRow, AddWorkoutForm } from '../training/WorkoutRow'
import {
  isoToDisplay, formatLongDate, formatOrdinalDate, daysBetween, subtractDays, STATUS_COLORS, RACE_COLOR,
  BG, TEXT, SUBTLE, BORDER, SURFACE, SURFACE_RAISED, CARD_SHADOW,
  FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD, FONT_EXTRABOLD,
  ACCENT_TEAL, ACCENT_PRIMARY,
} from '../training/trainingUtils'

LocaleConfig.locales['en'] = {
  monthNames: [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ],
  monthNamesShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  dayNames: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  dayNamesShort: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
}
LocaleConfig.defaultLocale = 'en'

const CALENDAR_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function WeekdayRow() {
  return (
    <XStack jc="space-between" px="$0.5" mb="$1">
      {CALENDAR_DAY_LABELS.map((label) => (
        <YStack key={label} width={32} ai="center">
          <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 11, color: SUBTLE }}>{label}</Text>
        </YStack>
      ))}
    </XStack>
  )
}

const calendarTheme = {
  backgroundColor: 'transparent',
  calendarBackground: 'transparent',
  textSectionTitleColor: 'transparent',
  monthTextColor: TEXT,
  arrowColor: TEXT,
  textMonthFontFamily: FONT_EXTRABOLD,
  textMonthFontSize: 16,
}

// Custom circular day badge — priority order for "worst" status wins the ring color
const STATUS_PRIORITY = { missed: 0, partial: 1, upcoming: 2, done: 3 }

function DayCell({ date, state, marking, onPress }) {
  if (!date) return null
  const isDisabled = state === 'disabled'
  const isSelected = !!marking?.selected
  const status = marking?.status
  const isRace = marking?.isRace
  const isInPlan = !!marking?.inPlan
  const count = marking?.count || 0

  const ringColor = isRace ? RACE_COLOR : status ? STATUS_COLORS[status] : null
  const isFilled = status === 'done' || isRace

  let circleBg = 'transparent'
  let hasBorder = false
  let borderColor = 'transparent'
  let textColor = isDisabled ? '#334155' : TEXT

  if (isSelected) {
    circleBg = TEXT
    textColor = BG
  } else if (isFilled && ringColor) {
    circleBg = ringColor
    textColor = '#0b1220'
  } else if (ringColor) {
    hasBorder = true
    borderColor = ringColor
  } else if (isInPlan) {
    // Bare plan day — no status yet, not selected: show a plan-colored ring instead of a fill
    hasBorder = true
    borderColor = ACCENT_PRIMARY
  }

  // Tint only applies when nothing else (status ring/fill, selection) is already showing
  const showPlanTint = isInPlan && !isSelected && !ringColor

  return (
    <Pressable
      onPress={() => onPress(date)}
      style={{
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
      }}
    >
      <YStack
        width={32}
        height={32}
        ai="center"
        jc="center"
        style={{ position: 'relative' }}
      >
        <YStack
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: circleBg,
            borderWidth: hasBorder ? 2 : 0,
            borderColor,
            transform: isSelected ? [{ translateY: -5 }] : undefined,
            boxShadow: isSelected ? '0 4px 10px rgba(0,0,0,0.4)' : undefined,
          }}
        />
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 13, color: textColor, textAlign: 'center' }}>
          {date.day}
        </Text>
      </YStack>

      {count > 1 && (
        <YStack mt="$0.5" width={4} height={4} borderRadius={2} backgroundColor={ringColor || SUBTLE} />
      )}
    </Pressable>
  )
}

export default function TrainingCalendarScreen({ navigation }) {
  const {
    today, planRange, createPlan, editPlanLength,
    workouts, addWorkout, updateWorkout, deleteWorkout,
  } = useTraining()

  const [raceDateInput, setRaceDateInput] = useState('')
  const [raceNameInput, setRaceNameInput] = useState('')
  const [weeksInput, setWeeksInput] = useState('12')
  const [setupError, setSetupError] = useState('')

  const [selectedDate, setSelectedDate] = useState(today)

  const handleCreatePlan = () => {
    const result = createPlan({ raceNameInput, raceDateInput, weeksInput })
    if (result?.error) {
      setSetupError(result.error)
      return
    }
    setSetupError('')
    setSelectedDate(result.start)
  }

  const daysToRace = planRange ? daysBetween(today, planRange.raceDate) : null

  const markedDates = useMemo(() => {
    const marks = {}

    workouts.forEach((w) => {
      const status = w.status === 'done' ? 'done' : w.status === 'partial' ? 'partial' : (w.date < today ? 'missed' : 'upcoming')
      const existing = marks[w.date] || { count: 0, statuses: [] }
      marks[w.date] = { ...existing, count: existing.count + 1, statuses: [...existing.statuses, status] }
    })

    Object.keys(marks).forEach((date) => {
      const statuses = marks[date].statuses
      const dominant = statuses.reduce((best, s) => (STATUS_PRIORITY[s] < STATUS_PRIORITY[best] ? s : best), statuses[0])
      marks[date].status = dominant
    })

    if (planRange) {
      let cursor = planRange.start
      while (cursor <= planRange.raceDate) {
        marks[cursor] = { ...(marks[cursor] || {}), inPlan: true }
        cursor = subtractDays(cursor, -1) // step forward one day
      }
      marks[planRange.raceDate] = { ...(marks[planRange.raceDate] || {}), isRace: true }
    }

    marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true }

    return marks
  }, [workouts, selectedDate, today, planRange])

  const dayWorkouts = workouts.filter((w) => w.date === selectedDate)
  const isRaceDay = planRange && selectedDate === planRange.raceDate

  if (!planRange) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      >
        <YStack gap="$1">
          <Paragraph fontFamily={FONT_BOLD} fontSize={11} letterSpacing={2} color={SUBTLE} textTransform="uppercase">
            Training Plan
          </Paragraph>
          <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 28, color: TEXT }}>Set Up Your Race</Text>
        </YStack>

        <Card backgroundColor={SURFACE} borderColor={BORDER} borderWidth={1} borderRadius={20} p="$5" gap="$4" style={CARD_SHADOW}>
          <YStack gap="$2">
            <Paragraph fontFamily={FONT_SEMIBOLD} fontSize={11} letterSpacing={0.6} color={SUBTLE} textTransform="uppercase">Race name</Paragraph>
            <Input value={raceNameInput} onChangeText={setRaceNameInput} placeholder="e.g. Ironman 70.3 Oceanside" placeholderTextColor={SUBTLE} borderColor={BORDER} borderRadius={12} backgroundColor={SURFACE_RAISED} color={TEXT} fontFamily={FONT_REGULAR} />
          </YStack>

          <YStack gap="$2">
            <Paragraph fontFamily={FONT_SEMIBOLD} fontSize={11} letterSpacing={0.6} color={SUBTLE} textTransform="uppercase">Race date (DD-MM-YYYY)</Paragraph>
            <Input value={raceDateInput} onChangeText={setRaceDateInput} placeholder="06-12-2026" placeholderTextColor={SUBTLE} borderColor={BORDER} borderRadius={12} backgroundColor={SURFACE_RAISED} color={TEXT} fontFamily={FONT_REGULAR} />
          </YStack>

          <YStack gap="$2">
            <Paragraph fontFamily={FONT_SEMIBOLD} fontSize={11} letterSpacing={0.6} color={SUBTLE} textTransform="uppercase">Training weeks</Paragraph>
            <Input value={weeksInput} onChangeText={setWeeksInput} keyboardType="numeric" placeholder="12" placeholderTextColor={SUBTLE} borderColor={BORDER} borderRadius={12} backgroundColor={SURFACE_RAISED} color={TEXT} fontFamily={FONT_REGULAR} />
          </YStack>

          {!!setupError && <Paragraph fontFamily={FONT_REGULAR} color="#f87171" fontSize={13}>{setupError}</Paragraph>}

          <Pill label="Create Plan" variant="primary" onPress={handleCreatePlan} />
        </Card>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
    >
      <YStack gap="$0.5">
        <Paragraph fontFamily={FONT_BOLD} fontSize={11} letterSpacing={2} color={SUBTLE} textTransform="uppercase">
          Training Plan
        </Paragraph>
        <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 24, color: TEXT }}>
          {planRange.raceName || 'Race Plan'}
        </Text>
      </YStack>

      <Card backgroundColor={SURFACE} borderColor={BORDER} borderWidth={1} borderRadius={20} p="$4" gap="$1" style={CARD_SHADOW}>
        <Paragraph fontFamily={FONT_REGULAR} color={SUBTLE} fontSize={13}>
          {planRange.weeks} - Week Plan · Start: {formatOrdinalDate(planRange.start)} · Race Day: {formatOrdinalDate(planRange.raceDate)}
        </Paragraph>
        <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 20, color: daysToRace < 0 ? STATUS_COLORS.done : ACCENT_TEAL }}>
          {daysToRace > 0
            ? `${daysToRace} day${daysToRace === 1 ? '' : 's'} to race day`
            : daysToRace === 0
            ? 'Race day is today'
            : 'Race complete'}
        </Text>
      </Card>

      <Card backgroundColor={SURFACE} borderColor={BORDER} borderWidth={1} borderRadius={20} p="$3" style={CARD_SHADOW}>
        <WeekdayRow />
        <Calendar
          markedDates={markedDates}
          firstDay={1}
          theme={calendarTheme}
          dayComponent={DayCell}
          onDayPress={(day) => setSelectedDate(day.dateString)}
        />
      </Card>

      <XStack gap="$4" ai="center" flexWrap="wrap" px="$1">
        <LegendDot color={STATUS_COLORS.done} label="Done" />
        <LegendDot color={STATUS_COLORS.partial} label="Partial" />
        <LegendDot color={STATUS_COLORS.missed} label="Missed" />
        <LegendDot color={STATUS_COLORS.upcoming} label="Upcoming" />
        <LegendDot color={RACE_COLOR} label="Race day" />
      </XStack>

      <Card backgroundColor={SURFACE} borderColor={BORDER} borderWidth={1} borderRadius={20} p="$4" gap="$3" style={CARD_SHADOW}>
        <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 17, color: TEXT }}>
          {formatLongDate(selectedDate)} {isRaceDay ? '· Race Day' : ''}
        </Text>

        {dayWorkouts.length === 0 ? (
          <Paragraph fontFamily={FONT_REGULAR} color={SUBTLE} fontSize={13}>No workouts scheduled yet.</Paragraph>
        ) : (
          dayWorkouts.map((w) => (
            <WorkoutRow key={w.id} workout={w} today={today} onUpdate={updateWorkout} onDelete={deleteWorkout} />
          ))
        )}

        <AddWorkoutForm onAdd={({ type, title, notes }) => addWorkout({ date: selectedDate, type, title, notes })} />
      </Card>
    </ScrollView>
  )
}

function LegendDot({ color, label }) {
  return (
    <XStack ai="center" gap="$1.5">
      <YStack width={8} height={8} borderRadius={4} backgroundColor={color} alignSelf="center" />
      <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12, color: SUBTLE, lineHeight: 16 }}>
        {label}
      </Text>
    </XStack>
  )
}