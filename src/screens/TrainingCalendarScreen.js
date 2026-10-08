import React, { useEffect, useMemo, useState } from 'react'
import { YStack, XStack, Card, Paragraph, Input } from 'tamagui'
import { Pressable, Text, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Calendar, LocaleConfig } from 'react-native-calendars'

import { useTraining, isLogged } from '../training/TrainingContext'
import { Pill, WorkoutRow, AddWorkoutForm } from '../training/WorkoutRow'
import {
  isoToDisplay, displayToIso, formatLongDate, formatOrdinalDate, daysBetween, subtractDays, planWeekOf, toIsoDate,
  FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD, FONT_EXTRABOLD,
} from '../training/trainingUtils'
import { useTheme } from '../theme/ThemeContext'
import PlanLibraryPicker, { planLibrarySupported, loadLibraryPlan, findEntry } from '../plans/PlanLibraryPicker'
import PlanImportPicker from '../plans/PlanImportPicker'
import { planImportSupported } from '../plans/planImport'

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

// The Monday on or before a date
const mondayOf = (iso) => subtractDays(iso, (new Date(`${iso}T00:00:00`).getDay() + 6) % 7)

// Space left of the plan calendar's rows for the plan week labels (W1, W2, ...)
const WEEK_GUTTER = 32

// Day names above a calendar, in the same seven columns as its rows (the library's own
// padding is 5 on each side, plus the week label gutter when there is one)
function WeekdayRow({ gutter = 0 }) {
  const t = useTheme()
  return (
    <XStack style={{ paddingLeft: 5 + gutter, paddingRight: 5 }} mb="$1">
      {CALENDAR_DAY_LABELS.map((label, i) => (
        <YStack key={label} flex={1} alignItems="center">
          <YStack width={32} alignItems="center" style={{ position: 'relative' }}>
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 11, color: t.subtle }}>{label}</Text>
            {gutter > 0 && i === 0 && (
              // Placed like DayCell's week labels, so it sits above them
              <Text style={{ position: 'absolute', right: 32 + 12, fontFamily: FONT_SEMIBOLD, fontSize: 11, color: t.subtle }}>Wk</Text>
            )}
          </YStack>
        </YStack>
      ))}
    </XStack>
  )
}

const calendarThemeFor = (t, gutter = 0) => ({
  // Replaces the library's week row style, so it repeats its defaults
  'stylesheet.calendar.main': {
    week: { marginVertical: 7, flexDirection: 'row', justifyContent: 'space-around', paddingLeft: gutter },
  },
  backgroundColor: 'transparent',
  calendarBackground: 'transparent',
  textSectionTitleColor: 'transparent',
  monthTextColor: t.text,
  arrowColor: t.text,
  textMonthFontFamily: FONT_EXTRABOLD,
  textMonthFontSize: 16,
})

// Custom circular day badge — priority order for "worst" status wins the ring color
const STATUS_PRIORITY = { missed: 0, partial: 1, upcoming: 2, done: 3 }

function DayCell({ date, state, marking, onPress }) {
  const t = useTheme()
  if (!date) return null
  const isDisabled = state === 'disabled'
  const isSelected = !!marking?.selected
  const status = marking?.status
  const isRace = marking?.isRace
  const isInPlan = !!marking?.inPlan
  const count = marking?.count || 0
  const weekLabel = marking?.weekLabel // set on the Monday of each row that overlaps the plan

  const ringColor = isRace ? t.race : status ? t.status[status] : null
  const isFilled = status === 'done' || isRace

  let circleBg = 'transparent'
  let hasBorder = false
  let borderColor = 'transparent'
  let textColor = isDisabled ? t.disabled : t.text

  if (isSelected) {
    circleBg = t.text
    textColor = t.bgSolid
  } else if (isFilled && ringColor) {
    circleBg = ringColor
    textColor = t.onAccent
  } else if (ringColor) {
    hasBorder = true
    borderColor = ringColor
  } else if (isInPlan) {
    // Bare plan day — no status yet, not selected: show a plan-colored ring instead of a fill
    hasBorder = true
    borderColor = t.planRing
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
        alignItems="center"
        justifyContent="center"
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
          }}
        />
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 13, color: textColor, textAlign: 'center' }}>
          {date.day}
        </Text>
        {!!weekLabel && (
          // Drawn in the gutter to the left of the row
          <Text
            style={{ position: 'absolute', right: 32 + 12, top: 0, height: 32, lineHeight: 32, fontFamily: FONT_SEMIBOLD, fontSize: 11, color: weekLabel.current ? t.primary : t.subtle }}
          >
            {weekLabel.text}
          </Text>
        )}
      </YStack>

      {count > 1 && (
        <YStack mt="$0.5" width={4} height={4} borderRadius={2} backgroundColor={ringColor || t.subtle} />
      )}
    </Pressable>
  )
}

// Race date field for the plan form: a button that opens a calendar beneath it.
// `value` and `onChange` use the form's DD-MM-YYYY text, like the other inputs.
function RaceDatePicker({ value, onChange, today, calendarTheme }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const iso = value ? displayToIso(value) : null
  const earliest = subtractDays(today, -1) // the race must be after today

  const pick = (day) => {
    if (day.dateString < earliest) return // earlier days are greyed out, ignore taps on them
    onChange(isoToDisplay(day.dateString))
    setOpen(false)
  }

  return (
    <YStack gap="$2">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={iso ? `Race date, ${formatOrdinalDate(iso)}` : 'Choose race date'}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: open ? t.primary : t.border,
          borderRadius: 12,
          backgroundColor: t.surfaceRaised,
          paddingHorizontal: 14,
          height: 44,
        }}
      >
        <Text style={{ fontFamily: FONT_REGULAR, fontSize: 15, color: iso ? t.text : t.subtle }}>
          {iso ? formatOrdinalDate(iso) : 'Choose a date'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={open ? t.primary : t.subtle} />
      </Pressable>

      {open && (
        <YStack borderWidth={1} borderColor={t.border} borderRadius={16} p="$2" backgroundColor={t.surfaceSolid}>
          <WeekdayRow />
          <Calendar
            current={iso || earliest}
            firstDay={1}
            key={t.name}
            theme={calendarTheme}
            // Grey out earlier days here rather than with minDate: the library reads minDate as
            // UTC midnight, which leaves the day before it pickable in time zones behind UTC
            // Greyed-out days do nothing when tapped (the library would otherwise jump months)
            dayComponent={(props) => {
              const disabled = props.state === 'disabled' || props.date?.dateString < earliest
              return <DayCell {...props} state={disabled ? 'disabled' : props.state} onPress={disabled ? () => {} : props.onPress} />
            }}
            markedDates={iso ? { [iso]: { selected: true } } : {}}
            onDayPress={pick}
          />
        </YStack>
      )}
    </YStack>
  )
}

// Where the plan being edited came from: a library plan, an imported file or the user's own
function PlanSourceNote({ source }) {
  const t = useTheme()
  const { icon, heading, detail } = source.kind === 'library'
    ? { icon: 'document-text-outline', heading: `${source.distance} ${source.level} · ${source.weeks} weeks`, detail: 'From Available Plans.' }
    : source.kind === 'import'
    ? { icon: 'document-attach-outline', heading: source.name || source.fileName, detail: `Imported from ${source.fileName}.` }
    : { icon: 'create-outline', heading: 'Your own plan', detail: 'Started blank, with workouts you added yourself.' }
  return (
    <YStack gap="$2">
      <Paragraph style={{ fontFamily: FONT_SEMIBOLD }} fontSize={11} letterSpacing={0.6} color={t.subtle} textTransform="uppercase">Plan</Paragraph>
      <YStack backgroundColor={t.surfaceRaised} borderColor={t.border} borderWidth={1} borderRadius={14} p="$3" gap="$1.5">
        <XStack alignItems="center" gap="$2">
          <Ionicons name={icon} size={16} color={t.primary} />
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: t.text, flexShrink: 1 }}>{heading}</Text>
        </XStack>
        <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 18, color: t.subtle }}>{detail}</Text>
      </YStack>
    </YStack>
  )
}

// Shown before switching an existing plan: what's kept and what's replaced
function SwitchPlanWarning({ workouts, today }) {
  const t = useTheme()
  const logged = workouts.filter(isLogged(today)).length
  const replaced = workouts.length - logged
  const n = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
  return (
    <XStack gap="$2.5" p="$3" borderRadius={14} borderWidth={1} borderColor={t.status.partial} backgroundColor={t.surfaceRaised}>
      <Ionicons name="warning-outline" size={18} color={t.status.partial} style={{ marginTop: 1 }} />
      <YStack flex={1} gap="$1.5">
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 14, color: t.text }}>Switching replaces your upcoming workouts</Text>
        <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 18, color: t.subtle }}>
          {n(replaced, 'workout')} from today on will be replaced by the new plan's.
          {logged > 0 && ` Your ${n(logged, 'logged workout')} (done, partial or missed) stay as they are, along with any Strava links, so earlier weeks will still show the old plan's sessions.`}
        </Text>
      </YStack>
    </XStack>
  )
}

export default function TrainingCalendarScreen({ navigation }) {
  const t = useTheme()
  const calendarTheme = useMemo(() => calendarThemeFor(t), [t])
  const planCalendarTheme = useMemo(() => calendarThemeFor(t, WEEK_GUTTER), [t])
  const {
    today, planRange, createPlan, editingPlan, creatingPlan, cancelEditingPlan,
    workouts, addWorkout, updateWorkout, deleteWorkout,
  } = useTraining()

  const [raceDateInput, setRaceDateInput] = useState('')
  const [raceNameInput, setRaceNameInput] = useState('')
  const [weeksInput, setWeeksInput] = useState('12')
  const [setupError, setSetupError] = useState('')
  const [librarySelection, setLibrarySelection] = useState(null) // { distance, level, weeks } from Available Plans
  const [importedPlan, setImportedPlan] = useState(null) // { plan, fileName } from Import a Plan
  const [switching, setSwitching] = useState(false) // editing: choosing a different plan
  const [creating, setCreating] = useState(false)

  const [selectedDate, setSelectedDate] = useState(today)
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7)) // 'YYYY-MM' shown in the plan calendar

  // The week column only shows on months whose rows (including the greyed days either side) touch the plan
  const showWeeks = useMemo(() => {
    if (!planRange) return false
    const [year, month] = visibleMonth.split('-').map(Number)
    const firstRow = mondayOf(`${visibleMonth}-01`)
    const lastRowEnd = subtractDays(mondayOf(toIsoDate(new Date(year, month, 0))), -6)
    return firstRow <= planRange.raceDate && lastRowEnd >= planRange.start
  }, [visibleMonth, planRange])

  // Editing starts the form from the current plan; a new plan starts it blank
  useEffect(() => {
    if (editingPlan && planRange) {
      setRaceNameInput(planRange.raceName || '')
      setRaceDateInput(isoToDisplay(planRange.raceDate))
      setWeeksInput(String(planRange.weeks))
    } else if (creatingPlan) {
      setRaceNameInput('')
      setRaceDateInput('')
      setWeeksInput('12')
    }
    setLibrarySelection(null)
    setImportedPlan(null)
    setSwitching(false)
    setSetupError('')
  }, [editingPlan, creatingPlan])

  // A plan comes from the library or a file, not both
  const chooseLibraryPlan = (next) => {
    setLibrarySelection(next)
    setImportedPlan(null) // a library plan, or "None" for a blank plan
    setSetupError('')
  }
  const chooseImportedPlan = (next) => {
    setImportedPlan(next)
    if (next) {
      setLibrarySelection(null)
      if (!raceNameInput.trim() && next.plan.name) setRaceNameInput(next.plan.name)
    }
    setSetupError('')
  }

  const handleCreatePlan = async () => {
    const choosing = !editingPlan || switching
    let template = importedPlan && choosing ? importedPlan.plan : undefined
    const entry = choosing && librarySelection && findEntry(librarySelection)
    if (entry) {
      setCreating(true)
      try {
        template = await loadLibraryPlan(entry)
      } catch (e) {
        setSetupError(e.message)
        return
      } finally {
        setCreating(false)
      }
    }
    const source = entry
      ? { kind: 'library', distance: entry.distance, level: entry.level, weeks: entry.weeks }
      : template
      ? { kind: 'import', fileName: importedPlan.fileName, name: importedPlan.plan.name }
      : editingPlan ? undefined : { kind: 'manual' }
    const result = createPlan({ raceNameInput, raceDateInput, weeksInput, template, source })
    if (result?.error) {
      setSetupError(result.error)
      return
    }
    setSetupError('')
    if (!editingPlan) setSelectedDate(result.start)
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

      // Label each calendar row (Monday to Sunday) with its plan week. Plan weeks start on the
      // plan's start day, so when that isn't a Monday a row spans two; it takes the one with more days.
      const todayWeek = today >= planRange.start && today <= planRange.raceDate ? planWeekOf(planRange.start, today) : null
      let monday = mondayOf(planRange.start)
      while (showWeeks && monday <= planRange.raceDate) {
        const counts = {}
        for (let i = 0; i < 7; i++) {
          const day = subtractDays(monday, -i)
          if (day >= planRange.start && day <= planRange.raceDate) {
            const week = planWeekOf(planRange.start, day)
            counts[week] = (counts[week] || 0) + 1
          }
        }
        const week = Number(Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a - b)[0])
        marks[monday] = { ...(marks[monday] || {}), weekLabel: { text: `W${week}`, current: week === todayWeek } }
        monday = subtractDays(monday, -7)
      }
    }

    marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true }

    return marks
  }, [workouts, selectedDate, today, planRange, showWeeks])

  const dayWorkouts = workouts.filter((w) => w.date === selectedDate)
  const isRaceDay = planRange && selectedDate === planRange.raceDate

  // The library and import pickers: always for a new plan, and when switching while editing
  const choosingPlan = !editingPlan || switching

  if (!planRange || editingPlan || creatingPlan) {
    // Cancel goes back to the current plan, so only offer it when there is one
    const canCancel = !!planRange && (editingPlan || creatingPlan)
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      >
        <YStack gap="$1">
          <Paragraph style={{ fontFamily: FONT_BOLD }} fontSize={11} letterSpacing={2} color={t.subtle} textTransform="uppercase">
            Training Plan
          </Paragraph>
          <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 28, color: t.text }}>{editingPlan ? 'Edit Your Plan' : creatingPlan && planRange ? 'New Race Plan' : 'Set Up Your Race'}</Text>
        </YStack>

        <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$5" gap="$4" style={t.cardShadow}>
          <YStack gap="$2">
            <Paragraph style={{ fontFamily: FONT_SEMIBOLD }} fontSize={11} letterSpacing={0.6} color={t.subtle} textTransform="uppercase">Race name</Paragraph>
            <Input value={raceNameInput} onChangeText={setRaceNameInput} placeholder="e.g. Ironman 70.3 Oceanside" placeholderTextColor={t.subtle} borderColor={t.border} borderRadius={12} backgroundColor={t.surfaceRaised} color={t.text} style={{ fontFamily: FONT_REGULAR }} />
          </YStack>

          <YStack gap="$2">
            <Paragraph style={{ fontFamily: FONT_SEMIBOLD }} fontSize={11} letterSpacing={0.6} color={t.subtle} textTransform="uppercase">Race date</Paragraph>
            <RaceDatePicker value={raceDateInput} onChange={setRaceDateInput} today={today} calendarTheme={calendarTheme} />
          </YStack>

          {editingPlan && (
            <YStack gap="$2.5">
              {planRange.source && <PlanSourceNote source={planRange.source} />}
              {planLibrarySupported && (
                <XStack>
                  <Pill
                    label={switching ? 'Keep this plan' : 'Change plan'}
                    onPress={() => { setSwitching((s) => !s); chooseLibraryPlan(null) }}
                  />
                </XStack>
              )}
            </YStack>
          )}

          {planLibrarySupported && choosingPlan && (
            <PlanLibraryPicker
              selection={librarySelection}
              onChange={chooseLibraryPlan}
              imported={!!importedPlan}
              // When switching, a plan that would start in the past is fine: only its days from today on are used
              raceIso={editingPlan ? null : displayToIso(raceDateInput)}
              today={today}
              noneText={editingPlan ? 'Keep the workouts you have now.' : undefined}
              defaultWeeks={editingPlan ? planRange.weeks : undefined}
            />
          )}

          {editingPlan && (librarySelection || importedPlan) && (
            <SwitchPlanWarning workouts={workouts} today={today} />
          )}

          {/* Importing is the alternative to a library plan, so it only shows with "None" chosen */}
          {planImportSupported && choosingPlan && !librarySelection && (
            <PlanImportPicker
              imported={importedPlan}
              onChange={chooseImportedPlan}
              onError={setSetupError}
              raceIso={displayToIso(raceDateInput)}
              today={today}
            />
          )}

          <YStack gap="$2">
            <Paragraph style={{ fontFamily: FONT_SEMIBOLD }} fontSize={11} letterSpacing={0.6} color={t.subtle} textTransform="uppercase">Training weeks</Paragraph>
            {(librarySelection || importedPlan) && choosingPlan ? (
              // A library or imported plan has a fixed length
              <Text style={{ fontFamily: FONT_REGULAR, fontSize: 15, color: t.text, paddingVertical: 4 }}>
                {(librarySelection || importedPlan.plan).weeks} week{(librarySelection || importedPlan.plan).weeks === 1 ? '' : 's'}, set by the plan
              </Text>
            ) : (
              <Input value={weeksInput} onChangeText={setWeeksInput} keyboardType="numeric" placeholder="12" placeholderTextColor={t.subtle} borderColor={t.border} borderRadius={12} backgroundColor={t.surfaceRaised} color={t.text} style={{ fontFamily: FONT_REGULAR }} />
            )}
          </YStack>

          {!!setupError && <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.danger} fontSize={13}>{setupError}</Paragraph>}

          <XStack gap="$2">
            <Pill label={editingPlan ? (choosingPlan && (librarySelection || importedPlan) ? 'Switch Plan' : 'Save Plan') : creating ? 'Loading plan…' : 'Create Plan'} variant="primary" onPress={creating ? () => {} : handleCreatePlan} />
            {canCancel && <Pill label="Cancel" onPress={cancelEditingPlan} />}
          </XStack>
        </Card>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
    >
      <YStack gap="$0.5">
        <Paragraph style={{ fontFamily: FONT_BOLD }} fontSize={11} letterSpacing={2} color={t.subtle} textTransform="uppercase">
          Training Plan
        </Paragraph>
        <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 24, color: t.text }}>
          {planRange.raceName || 'Race Plan'}
        </Text>
      </YStack>

      <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$4" gap="$1" style={t.cardShadow}>
        <YStack>
          <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.subtle} fontSize={13}>{planRange.weeks} - Week Plan</Paragraph>
          <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.subtle} fontSize={13}>Start: {formatOrdinalDate(planRange.start)}</Paragraph>
          <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.subtle} fontSize={13}>Race Day: {formatOrdinalDate(planRange.raceDate)}</Paragraph>
        </YStack>
        <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 20, color: daysToRace < 0 ? t.status.done : t.primary }}>
          {daysToRace > 0
            ? `${daysToRace} day${daysToRace === 1 ? '' : 's'} to race day`
            : daysToRace === 0
            ? 'Race day is today'
            : 'Race complete'}
        </Text>
      </Card>

      <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$3" style={t.cardShadow}>
        <WeekdayRow gutter={showWeeks ? WEEK_GUTTER : 0} />
        <Calendar
          markedDates={markedDates}
          firstDay={1}
          // The library reads its theme once, so adding or removing the week column remounts it on the same month
          key={`${t.name}-${showWeeks}`}
          current={`${visibleMonth}-01`}
          onMonthChange={(month) => setVisibleMonth(month.dateString.slice(0, 7))}
          theme={showWeeks ? planCalendarTheme : calendarTheme}
          dayComponent={DayCell}
          onDayPress={(day) => setSelectedDate(day.dateString)}
        />
      </Card>

      <XStack gap="$4" alignItems="center" flexWrap="wrap" px="$4">
        <LegendDot color={t.status.done} label="Done" />
        <LegendDot color={t.status.partial} label="Partial" />
        <LegendDot color={t.status.missed} label="Missed" />
        <LegendDot color={t.status.upcoming} label="Upcoming" />
        <LegendDot color={t.race} label="Race day" />
      </XStack>

      <Card backgroundColor={t.surface} borderColor={t.border} borderWidth={1} borderRadius={20} p="$4" gap="$3" style={t.cardShadow}>
        <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 17, color: t.text }}>
          {formatLongDate(selectedDate)} {isRaceDay ? '· Race Day' : ''}
        </Text>
        {selectedDate >= planRange.start && selectedDate <= planRange.raceDate && (
          <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 13, color: t.subtle, marginTop: -8 }}>
            Week {planWeekOf(planRange.start, selectedDate)} of {planRange.weeks}
          </Text>
        )}

        {dayWorkouts.length === 0 ? (
          <Paragraph style={{ fontFamily: FONT_REGULAR }} color={t.subtle} fontSize={13}>No workouts scheduled yet.</Paragraph>
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
  const t = useTheme()
  return (
    <XStack alignItems="center" gap="$1.5">
      <YStack width={8} height={8} borderRadius={4} backgroundColor={color} alignSelf="center" />
      <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12, color: t.subtle, lineHeight: 16 }}>
        {label}
      </Text>
    </XStack>
  )
}