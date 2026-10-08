import React, { useState } from 'react'
import { YStack, XStack, Paragraph, Input } from 'tamagui'
import { Popover } from '@tamagui/popover'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  TYPE_LIST, TYPE_ICONS, statusFor, formatShortDay,
  FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD,
  notesInputStyle,
} from './trainingUtils'
import { useTheme, useUnits } from '../theme/ThemeContext'
import { estimateDistance } from './distanceEstimate'
import { useStrava } from '../strava/StravaContext'
import { useTraining } from './TrainingContext'
import ActivityGraphicModal from '../strava/ActivityGraphicModal'

export function Pill({ label, active, color, onPress, variant = 'default' }) {
  const t = useTheme()
  const isDanger = variant === 'danger'
  const isPrimary = variant === 'primary'

  const bg = isPrimary || active ? (color || t.primary) : t.surface
  const textColor = isPrimary || active ? t.onAccent : isDanger ? t.danger : t.text
  const borderColor = isDanger ? t.dangerBorder : active || isPrimary ? (color || t.primary) : t.border

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderColor,
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 15,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12.5, letterSpacing: 0.3, color: textColor }}>
        {label}
      </Text>
    </Pressable>
  )
}

function TypeIcon({ type, color }) {
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${color}22`,
      }}
    >
      <Ionicons name={TYPE_ICONS[type] || 'fitness-outline'} size={18} color={color} />
    </View>
  )
}

function RowMenu({ onEdit, onSwap, onDelete }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end">
      <Popover.Trigger asChild>
        <Pressable
          hitSlop={10}
          style={{ padding: 6 }}
          accessibilityLabel="Workout options"
        >
          <Ionicons name="ellipsis-vertical" size={18} color={t.subtle} />
        </Pressable>
      </Popover.Trigger>

      <Popover.Content
        borderWidth={1}
        borderColor={t.border}
        backgroundColor={t.surfaceSolid}
        borderRadius={14}
        padding="$2"
        elevate
      >
        <YStack minWidth={140}>
          <Pressable
            onPress={() => { setOpen(false); onEdit() }}
            style={{ paddingVertical: 10, paddingHorizontal: 10 }}
          >
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.text }}>Edit</Text>
          </Pressable>
          {onSwap && (
            <Pressable
              onPress={() => { setOpen(false); onSwap() }}
              style={{ paddingVertical: 10, paddingHorizontal: 10 }}
            >
              <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.text }}>Swap or move</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => { setOpen(false); onDelete() }}
            style={{ paddingVertical: 10, paddingHorizontal: 10 }}
          >
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.danger }}>Delete</Text>
          </Pressable>
        </YStack>
      </Popover.Content>
    </Popover>
  )
}

const smallTextStyle = (t) => ({ fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 18, color: t.subtle })

function StravaSync({ workout, sync, onRun, onCancel, onShowGraphic }) {
  const t = useTheme()
  const smallText = smallTextStyle(t)

  if (sync?.state === 'syncing') {
    return <Text style={smallText}>Updating Strava…</Text>
  }

  if (sync?.state === 'choose') {
    return (
      <YStack gap="$2">
        <Text style={smallText}>Which Strava activity is this?</Text>
        <XStack gap="$2" flexWrap="wrap">
          {sync.activities.map((a) => (
            <Pill
              key={a.id}
              label={`${a.name} · ${(a.start_date_local || '').slice(11, 16)}`}
              onPress={() => onRun(a.id)}
            />
          ))}
          <Pill label="Cancel" onPress={onCancel} />
        </XStack>
      </YStack>
    )
  }

  if (sync?.state === 'none' || sync?.state === 'error') {
    const message = sync.state === 'none'
      ? 'No Strava activity on this day yet. Retry once your watch has uploaded.'
      : sync.message
    return (
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Text style={{ ...smallText, flexShrink: 1 }}>{message}</Text>
        <Pill label="Retry" onPress={() => onRun()} />
      </XStack>
    )
  }

  if (workout.stravaActivityId) {
    return (
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Text style={{ ...smallText, flexShrink: 1 }}>Strava: {workout.stravaActivityName}</Text>
        {workout.status !== 'pending' && <Pill label="Sync again" onPress={() => onRun()} />}
        <Pill label="Graphic" onPress={onShowGraphic} />
      </XStack>
    )
  }

  return null
}

const workoutLabel = (w) => (w.title ? `${w.type}: ${w.title}` : w.type)

// Workouts that are done or linked to Strava stay on their day
const isMovable = (w) => w.status === 'pending' && !w.stravaActivityId

// Lists the other workouts in this plan week to swap with, and the week's days to move to
function SwapPanel({ workout, onClose }) {
  const t = useTheme()
  const { workouts, planWeekDates, moveWorkout, swapWorkouts } = useTraining()
  const weekDates = planWeekDates(workout.date)

  // A brick's legs move together, so each brick day is offered once
  const seenBrickDays = new Set()
  const candidates = workouts
    .filter((w) => w.date !== workout.date && weekDates.includes(w.date) && isMovable(w))
    .filter((w) => {
      if (w.type !== 'Brick') return true
      if (seenBrickDays.has(w.date)) return false
      seenBrickDays.add(w.date)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <YStack borderWidth={1} borderColor={t.border} borderRadius={12} backgroundColor={t.surfaceRaised} p="$3" gap="$2">
      <Text style={smallTextStyle(t)}>
        {workout.type === 'Brick' ? 'Both legs of this brick move together. ' : ''}Swap with a workout this week:
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        {candidates.length === 0 ? (
          <Text style={smallTextStyle(t)}>No other workouts to swap with.</Text>
        ) : candidates.map((w) => (
          <Pill
            key={w.id}
            label={`${formatShortDay(w.date)} · ${w.type === 'Brick' ? 'Brick' : workoutLabel(w)}`}
            onPress={() => { swapWorkouts(workout.id, w.id); onClose() }}
          />
        ))}
      </XStack>
      <Text style={smallTextStyle(t)}>Or move it to:</Text>
      <XStack gap="$2" flexWrap="wrap">
        {weekDates.filter((d) => d !== workout.date).map((d) => (
          <Pill key={d} label={formatShortDay(d)} onPress={() => { moveWorkout(workout.id, d); onClose() }} />
        ))}
      </XStack>
      <XStack>
        <Pill label="Cancel" onPress={onClose} />
      </XStack>
    </YStack>
  )
}

export function WorkoutRow({ workout, today, onUpdate, onDelete }) {
  const t = useTheme()
  const [isEditing, setIsEditing] = useState(false)
  const [editType, setEditType] = useState(workout.type)
  const [editTitle, setEditTitle] = useState(workout.title)
  const [editNotes, setEditNotes] = useState(workout.notes || '')

  const strava = useStrava()
  const { planRange, workouts, allWorkouts } = useTraining()
  const units = useUnits()
  const [showGraphic, setShowGraphic] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  const [sync, setSync] = useState(null) // { state: 'syncing' | 'none' | 'choose' | 'error', activities, message }

  const distance = estimateDistance(workout, units)
  // Only workouts in the current plan's range can move within their plan week
  const canMove = !!planRange && workout.date >= planRange.start && workout.date <= planRange.raceDate
    && (workout.type === 'Brick' ? workouts.filter((w) => w.type === 'Brick' && w.date === workout.date) : [workout]).every(isMovable)

  const status = statusFor(workout, today)
  const statusColor = t.status[status]

  const runSync = async (target, activityId) => {
    setSync({ state: 'syncing' })
    try {
      // Activities linked in any plan are never offered again; brick legs come from this plan
      const linked = allWorkouts.filter((w) => w.id !== target.id && w.stravaActivityId)
      const result = await strava.syncWorkout(target, {
        linkedActivityIds: linked.map((w) => w.stravaActivityId),
        brickSiblings: target.type === 'Brick'
          ? workouts.filter((w) => w.id !== target.id && w.stravaActivityId && w.type === 'Brick' && w.date === target.date)
          : [],
      }, activityId)
      if (result.status === 'synced') {
        onUpdate(target.id, { stravaActivityId: result.activity.id, stravaActivityName: result.activity.name })
        setSync(null)
      } else {
        setSync({ state: result.status, activities: result.activities })
      }
    } catch (e) {
      setSync({ state: 'error', message: e.message })
    }
  }

  const setStatus = (nextStatus) => {
    onUpdate(workout.id, { status: nextStatus })
    if (nextStatus !== 'pending' && strava.canSync(workout)) runSync({ ...workout, status: nextStatus })
  }

  const startEdit = () => {
    setEditType(workout.type)
    setEditTitle(workout.title)
    setEditNotes(workout.notes || '')
    setIsEditing(true)
  }

  const saveEdit = () => {
    onUpdate(workout.id, { type: editType, title: editTitle.trim(), notes: editNotes.trim() })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <YStack borderWidth={1} borderColor={t.border} borderRadius={16} backgroundColor={t.surfaceRaised} p="$3" gap="$2">
        <XStack gap="$2" flexWrap="wrap">
          {TYPE_LIST.map((type) => (
            <Pill key={type} label={type} active={editType === type} onPress={() => setEditType(type)} />
          ))}
        </XStack>

        <Input
          placeholder="Title (optional)"
          value={editTitle}
          onChangeText={setEditTitle}
          borderColor={t.border}
          borderRadius={10}
          backgroundColor={t.surface}
          color={t.text}
          style={{ fontFamily: FONT_REGULAR }}
          placeholderTextColor={t.subtle}
        />

        <TextInput
          placeholder="Notes"
          placeholderTextColor={t.subtle}
          value={editNotes}
          onChangeText={setEditNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ ...notesInputStyle(t), backgroundColor: t.surface }}
        />

        <XStack gap="$2">
          <Pill label="Save" variant="primary" onPress={saveEdit} />
          <Pill label="Cancel" onPress={() => setIsEditing(false)} />
        </XStack>
      </YStack>
    )
  }

  return (
    <YStack borderWidth={1} borderColor={t.border} borderRadius={16} backgroundColor={t.surface} p="$3" gap="$3">
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
        <XStack flex={1} minWidth={0} gap="$3" alignItems="flex-start">
          <TypeIcon type={workout.type} color={statusColor} />
          <YStack flex={1} minWidth={0} flexShrink={1} gap="$0.5" pt="$1">
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 14.5, color: t.text }}>
              {workoutLabel(workout)}{distance ? ` ≈ ${distance}` : ''}
            </Text>
            {!!workout.notes && (
              <Text
                style={{
                  fontFamily: FONT_REGULAR,
                  fontSize: 13,
                  lineHeight: 19,
                  color: t.subtle,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {workout.notes}
              </Text>
            )}
          </YStack>
        </XStack>

        <View style={{ flexShrink: 0 }}>
          <RowMenu
            onEdit={startEdit}
            onSwap={canMove ? () => setIsSwapping(true) : null}
            onDelete={() => onDelete(workout.id)}
          />
        </View>
      </XStack>

      {isSwapping && canMove && <SwapPanel workout={workout} onClose={() => setIsSwapping(false)} />}

      <XStack gap="$2">
        <Pill label="Not done" active={workout.status === 'pending'} color={t.status.upcoming} onPress={() => setStatus('pending')} />
        <Pill label="Partial" active={workout.status === 'partial'} color={t.status.partial} onPress={() => setStatus('partial')} />
        <Pill label="Done" active={workout.status === 'done'} color={t.status.done} onPress={() => setStatus('done')} />
      </XStack>

      {strava.canSync(workout) && (
        <StravaSync
          workout={workout}
          sync={sync}
          onRun={(activityId) => runSync(workout, activityId)}
          onCancel={() => setSync(null)}
          onShowGraphic={() => setShowGraphic(true)}
        />
      )}

      {!!workout.stravaActivityId && (
        <ActivityGraphicModal
          workout={workout}
          plan={planRange}
          visible={showGraphic}
          onClose={() => setShowGraphic(false)}
        />
      )}
    </YStack>
  )
}

export function AddWorkoutForm({ onAdd }) {
  const t = useTheme()
  const [newType, setNewType] = useState(TYPE_LIST[2] || TYPE_LIST[0])
  const [newTitle, setNewTitle] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const handleAdd = () => {
    onAdd({ type: newType, title: newTitle, notes: newNotes })
    setNewTitle('')
    setNewNotes('')
  }

  return (
    <YStack borderTopWidth={1} borderColor={t.border} pt="$3" gap="$2">
      <Paragraph style={{ fontFamily: FONT_BOLD }} fontSize={11} letterSpacing={1} color={t.subtle} textTransform="uppercase">
        Add a workout
      </Paragraph>

      <XStack gap="$2" flexWrap="wrap">
        {TYPE_LIST.map((type) => (
          <Pill key={type} label={type} active={newType === type} color={t.secondary} onPress={() => setNewType(type)} />
        ))}
      </XStack>

      <Input
        placeholder="Title (optional)"
        value={newTitle}
        onChangeText={setNewTitle}
        borderColor={t.border}
        borderRadius={10}
        backgroundColor={t.surfaceRaised}
        color={t.text}
        style={{ fontFamily: FONT_REGULAR }}
        placeholderTextColor={t.subtle}
      />

      <TextInput
        placeholder="Notes (e.g. 5km @ tempo pace, how it felt, etc.)"
        placeholderTextColor={t.subtle}
        value={newNotes}
        onChangeText={setNewNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        style={notesInputStyle(t)}
      />

      <Pill label="Add Workout" variant="primary" color={t.secondary} onPress={handleAdd} />
    </YStack>
  )
}