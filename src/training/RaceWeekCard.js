import React, { useEffect, useState } from 'react'
import { YStack, XStack, Card } from 'tamagui'
import { Pressable, Text, TextInput } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { useTraining } from './TrainingContext'
import { daysBetween, formatLongDate, FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD, FONT_EXTRABOLD } from './trainingUtils'

// How many days before the race the card appears
const RACE_WEEK_DAYS = 7

export const RACE_CHECKLIST = [
  'Bike serviced, tyres and brakes checked',
  'Wetsuit, goggles and swim cap',
  'Helmet, bike shoes and sunglasses',
  'Run shoes, race belt and hat',
  'Tri suit and race kit laid out',
  'Race nutrition and bottles',
  'Race pack and timing chip collected',
  'Transition bags packed',
  'Travel, parking and wake-up time planned',
]

const isTime = (value) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(value)

// "2 days 14 hrs" until the start (or the start of race day without a time)
function countdown(raceDate, startTime, now) {
  const start = new Date(`${raceDate}T${isTime(startTime) ? startTime.padStart(5, '0') : '00:00'}:00`)
  const mins = Math.round((start - now) / 60000)
  if (mins <= 0) return null
  const days = Math.floor(mins / 1440)
  const hrs = Math.floor((mins % 1440) / 60)
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} ${hrs} hr${hrs === 1 ? '' : 's'}`
  return `${hrs} hr${hrs === 1 ? '' : 's'} ${mins % 60} min`
}

// On Today in the last week before the race: a countdown to the start, its time and a kit checklist
export default function RaceWeekCard() {
  const t = useTheme()
  const { today, planRange, updatePlanDetails } = useTraining()
  const [now, setNow] = useState(() => new Date())
  const [timeInput, setTimeInput] = useState(planRange?.raceStartTime || '')

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  if (!planRange) return null
  const daysToRace = daysBetween(today, planRange.raceDate)
  if (daysToRace < 0 || daysToRace > RACE_WEEK_DAYS) return null

  const checklist = planRange.raceChecklist || {}
  const ticked = RACE_CHECKLIST.filter((item) => checklist[item]).length
  const left = countdown(planRange.raceDate, planRange.raceStartTime, now)

  const saveTime = () => {
    const value = timeInput.trim()
    if (value === '' || isTime(value)) updatePlanDetails({ raceStartTime: value || undefined })
    else setTimeInput(planRange.raceStartTime || '')
  }

  return (
    <Card backgroundColor={t.surface} borderColor={`${t.race}88`} borderWidth={1} borderRadius={20} p="$4" gap="$3" style={t.cardShadow}>
      <XStack alignItems="center" gap="$2">
        <Ionicons name="trophy-outline" size={18} color={t.race} />
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, letterSpacing: 1.5, color: t.race, textTransform: 'uppercase' }}>
          {daysToRace === 0 ? 'Race day' : 'Race week'}
        </Text>
      </XStack>

      <YStack gap="$1">
        <Text style={{ fontFamily: FONT_EXTRABOLD, fontSize: 26, color: t.text }}>
          {left ? `${left} to go` : 'Race is under way. Go get it!'}
        </Text>
        <Text style={{ fontFamily: FONT_REGULAR, fontSize: 13, color: t.subtle }}>
          {planRange.raceName || 'Race day'} · {formatLongDate(planRange.raceDate)}
        </Text>
      </YStack>

      <XStack alignItems="center" gap="$2.5">
        <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 13, color: t.text }}>Start time</Text>
        <TextInput
          value={timeInput}
          onChangeText={setTimeInput}
          onBlur={saveTime}
          onSubmitEditing={saveTime}
          placeholder="07:00"
          placeholderTextColor={t.subtle}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          accessibilityLabel="Race start time, 24-hour"
          style={{
            width: 76,
            fontFamily: FONT_SEMIBOLD,
            fontSize: 14,
            color: t.text,
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: 10,
            backgroundColor: t.surfaceRaised,
            paddingHorizontal: 10,
            paddingVertical: 7,
            textAlign: 'center',
          }}
        />
        <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12, color: t.subtle }}>24-hour</Text>
      </XStack>

      <YStack gap="$1">
        <XStack justifyContent="space-between" alignItems="baseline" mb="$1">
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, letterSpacing: 1.5, color: t.subtle, textTransform: 'uppercase' }}>Checklist</Text>
          <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12.5, color: ticked === RACE_CHECKLIST.length ? t.status.done : t.subtle }}>
            {ticked} of {RACE_CHECKLIST.length}
          </Text>
        </XStack>
        {RACE_CHECKLIST.map((item) => {
          const done = !!checklist[item]
          return (
            <Pressable
              key={item}
              onPress={() => updatePlanDetails({ raceChecklist: { ...checklist, [item]: !done } })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
            >
              <Ionicons name={done ? 'checkbox' : 'square-outline'} size={20} color={done ? t.status.done : t.subtle} />
              <Text style={{ flex: 1, fontFamily: FONT_REGULAR, fontSize: 13.5, color: done ? t.subtle : t.text, textDecorationLine: done ? 'line-through' : 'none' }}>
                {item}
              </Text>
            </Pressable>
          )
        })}
      </YStack>
    </Card>
  )
}
