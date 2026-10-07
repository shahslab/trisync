import React, { useState } from 'react'
import { YStack, XStack, Paragraph, Input } from 'tamagui'
import { Popover } from '@tamagui/popover'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  TYPE_LIST, TYPE_ICONS, STATUS_COLORS, statusFor,
  TEXT, SUBTLE, BORDER, SURFACE, SURFACE_RAISED,
  FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD,
  ACCENT_PRIMARY, notesInputStyle,
} from './trainingUtils'
import { useStrava } from '../strava/StravaContext'

export function Pill({ label, active, color, onPress, variant = 'default' }) {
  const isDanger = variant === 'danger'
  const isPrimary = variant === 'primary'

  const bg = isPrimary ? ACCENT_PRIMARY : active ? (color || ACCENT_PRIMARY) : SURFACE
  const textColor = isPrimary || active ? '#0b1220' : isDanger ? '#f87171' : TEXT
  const borderColor = isDanger ? '#5b1d1d' : active || isPrimary ? (color || ACCENT_PRIMARY) : BORDER

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

function RowMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end">
      <Popover.Trigger asChild>
        <Pressable
          hitSlop={10}
          style={{ padding: 6 }}
          accessibilityLabel="Workout options"
        >
          <Ionicons name="ellipsis-vertical" size={18} color={SUBTLE} />
        </Pressable>
      </Popover.Trigger>

      <Popover.Content
        borderWidth={1}
        borderColor={BORDER}
        backgroundColor={SURFACE_RAISED}
        borderRadius={14}
        padding="$2"
        elevate
      >
        <YStack minWidth={140}>
          <Pressable
            onPress={() => { setOpen(false); onEdit() }}
            style={{ paddingVertical: 10, paddingHorizontal: 10 }}
          >
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: TEXT }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => { setOpen(false); onDelete() }}
            style={{ paddingVertical: 10, paddingHorizontal: 10 }}
          >
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: '#f87171' }}>Delete</Text>
          </Pressable>
        </YStack>
      </Popover.Content>
    </Popover>
  )
}

const smallText = { fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 18, color: SUBTLE }

function StravaSync({ workout, sync, onRun, onCancel }) {
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
      <XStack gap="$2" ai="center" flexWrap="wrap">
        <Text style={{ ...smallText, flexShrink: 1 }}>{message}</Text>
        <Pill label="Retry" onPress={() => onRun()} />
      </XStack>
    )
  }

  if (workout.stravaActivityId) {
    return (
      <XStack gap="$2" ai="center" flexWrap="wrap">
        <Text style={{ ...smallText, flexShrink: 1 }}>Strava: {workout.stravaActivityName}</Text>
        {workout.status !== 'pending' && <Pill label="Sync again" onPress={() => onRun()} />}
      </XStack>
    )
  }

  return null
}

export function WorkoutRow({ workout, today, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editType, setEditType] = useState(workout.type)
  const [editTitle, setEditTitle] = useState(workout.title)
  const [editNotes, setEditNotes] = useState(workout.notes || '')

  const strava = useStrava()
  const [sync, setSync] = useState(null) // { state: 'syncing' | 'none' | 'choose' | 'error', activities, message }

  const status = statusFor(workout, today)
  const statusColor = STATUS_COLORS[status]

  const runSync = async (target, activityId) => {
    setSync({ state: 'syncing' })
    try {
      const result = await strava.syncWorkout(target, activityId)
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
      <YStack borderWidth={1} borderColor={BORDER} borderRadius={16} backgroundColor={SURFACE_RAISED} p="$3" gap="$2">
        <XStack gap="$2" flexWrap="wrap">
          {TYPE_LIST.map((type) => (
            <Pill key={type} label={type} active={editType === type} onPress={() => setEditType(type)} />
          ))}
        </XStack>

        <Input
          placeholder="Title (optional)"
          value={editTitle}
          onChangeText={setEditTitle}
          borderColor={BORDER}
          borderRadius={10}
          backgroundColor={SURFACE}
          color={TEXT}
          fontFamily={FONT_REGULAR}
          placeholderTextColor={SUBTLE}
        />

        <TextInput
          placeholder="Notes"
          placeholderTextColor={SUBTLE}
          value={editNotes}
          onChangeText={setEditNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ ...notesInputStyle, backgroundColor: SURFACE }}
        />

        <XStack gap="$2">
          <Pill label="Save" variant="primary" onPress={saveEdit} />
          <Pill label="Cancel" onPress={() => setIsEditing(false)} />
        </XStack>
      </YStack>
    )
  }

  return (
    <YStack borderWidth={1} borderColor={BORDER} borderRadius={16} backgroundColor={SURFACE} p="$3" gap="$3">
      <XStack ai="flex-start" jc="space-between" gap="$2">
        <XStack f={1} minWidth={0} gap="$3" ai="flex-start">
          <TypeIcon type={workout.type} color={statusColor} />
          <YStack f={1} minWidth={0} flexShrink={1} gap="$0.5" pt="$1">
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 14.5, color: TEXT }}>
              {workout.title ? `${workout.type}: ${workout.title}` : workout.type}
            </Text>
            {!!workout.notes && (
              <Text
                style={{
                  fontFamily: FONT_REGULAR,
                  fontSize: 13,
                  lineHeight: 19,
                  color: SUBTLE,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {workout.notes}
              </Text>
            )}
          </YStack>
        </XStack>

        <View style={{ flexShrink: 0 }}>
          <RowMenu onEdit={startEdit} onDelete={() => onDelete(workout.id)} />
        </View>
      </XStack>

      <XStack gap="$2">
        <Pill label="Not done" active={workout.status === 'pending'} color={STATUS_COLORS.upcoming} onPress={() => setStatus('pending')} />
        <Pill label="Partial" active={workout.status === 'partial'} color={STATUS_COLORS.partial} onPress={() => setStatus('partial')} />
        <Pill label="Done" active={workout.status === 'done'} color={STATUS_COLORS.done} onPress={() => setStatus('done')} />
      </XStack>

      {strava.canSync(workout) && (
        <StravaSync
          workout={workout}
          sync={sync}
          onRun={(activityId) => runSync(workout, activityId)}
          onCancel={() => setSync(null)}
        />
      )}
    </YStack>
  )
}

export function AddWorkoutForm({ onAdd }) {
  const [newType, setNewType] = useState(TYPE_LIST[2] || TYPE_LIST[0])
  const [newTitle, setNewTitle] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const handleAdd = () => {
    onAdd({ type: newType, title: newTitle, notes: newNotes })
    setNewTitle('')
    setNewNotes('')
  }

  return (
    <YStack borderTopWidth={1} borderColor={BORDER} pt="$3" gap="$2">
      <Paragraph fontFamily={FONT_BOLD} fontSize={11} letterSpacing={1} color={SUBTLE} textTransform="uppercase">
        Add a workout
      </Paragraph>

      <XStack gap="$2" flexWrap="wrap">
        {TYPE_LIST.map((type) => (
          <Pill key={type} label={type} active={newType === type} onPress={() => setNewType(type)} />
        ))}
      </XStack>

      <Input
        placeholder="Title (optional)"
        value={newTitle}
        onChangeText={setNewTitle}
        borderColor={BORDER}
        borderRadius={10}
        backgroundColor={SURFACE_RAISED}
        color={TEXT}
        fontFamily={FONT_REGULAR}
        placeholderTextColor={SUBTLE}
      />

      <TextInput
        placeholder="Notes (e.g. 5km @ tempo pace, how it felt, etc.)"
        placeholderTextColor={SUBTLE}
        value={newNotes}
        onChangeText={setNewNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        style={notesInputStyle}
      />

      <Pill label="Add Workout" variant="primary" onPress={handleAdd} />
    </YStack>
  )
}