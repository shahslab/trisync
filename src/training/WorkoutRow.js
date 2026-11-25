import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { YStack, XStack, Paragraph, Input } from 'tamagui'
import { Popover } from '@tamagui/popover'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  TYPE_LIST, TYPE_ICONS, BRICK_SPORTS, sportTitle, statusFor, formatShortDay, isTrained,
  stripBrickPart, withBrickPart, expectedBrickPart,
  FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD,
  notesInputStyle,
} from './trainingUtils'
import { useTheme, useWorkoutDisplay } from '../theme/ThemeContext'
import { estimateDistance, distanceTitle, notesByDistance } from './distanceEstimate'
import { useStrava } from '../strava/StravaContext'
import { canSyncType, linkUpdates } from '../strava/stravaApi'
import { useTraining } from './TrainingContext'
import ActivityGraphicModal from '../strava/ActivityGraphicModal'

export function Pill({ label, active, color, onPress, variant = 'default', icon }) {
  const t = useTheme()
  const isDanger = variant === 'danger'
  const isPrimary = variant === 'primary'

  const bg = isPrimary || active ? (color || t.primary) : t.surface
  const textColor = isPrimary || active ? t.onAccent : isDanger ? t.danger : t.text
  const borderColor = isDanger ? t.dangerBorder : active || isPrimary ? (color || t.primary) : t.border

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={active !== undefined ? { selected: !!active } : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: bg,
        borderColor,
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 15,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {!!icon && <Ionicons name={icon} size={14} color={textColor} />}
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

// A small coloured label, e.g. "Missed" or the Strava badge
function Chip({ label, color, icon }) {
  return (
    <XStack alignItems="center" gap={4} borderRadius={999} borderWidth={1} borderColor={`${color}66`} backgroundColor={`${color}1a`} px={8} py={2}>
      {!!icon && <Ionicons name={icon} size={11} color={color} />}
      <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 11, color }}>{label}</Text>
    </XStack>
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
        {isTrained(workout) && <Pill label="Sync again" onPress={() => onRun()} />}
        <Pill label="Graphic" onPress={onShowGraphic} />
      </XStack>
    )
  }

  // Logged but not linked yet (e.g. marked before Strava was connected)
  if (isTrained(workout)) {
    return (
      <XStack>
        <Pill label="Sync to Strava" icon="sync-outline" onPress={() => onRun()} />
      </XStack>
    )
  }

  return null
}

// "Brick · Run: 15 mins" once a brick leg's sport is chosen. With display.by 'distance'
// (from useWorkoutDisplay), timed rides and runs read as distances: "Bike: 16 miles".
export const workoutLabel = (w, display) => {
  const type = w.type === 'Brick' && w.brickSport ? `Brick · ${w.brickSport}` : w.type
  const title = (display?.by === 'distance' && distanceTitle(w, display.units)) || w.title
  // A title that only repeats the sport (filled in automatically) adds nothing
  return title && !isAutoTitle(title) ? `${type}: ${title}` : type
}

// The title filled in when a type (or a brick leg's sport) is picked: "Ride" for Bike, "Run" for a brick's run leg
const autoTitleFor = (type, brickSport) => sportTitle(type === 'Brick' ? brickSport || '' : type)
// Titles the forms may replace: empty, or one filled in automatically
const isAutoTitle = (title) => !title || [...TYPE_LIST, ...BRICK_SPORTS].some((s) => s === title || sportTitle(s) === title)

// Form state for a workout's type, brick sport, title and notes, keeping an automatic title
// in step, and a brick leg's notes starting "Brick Part N: " as they will on Strava.
// otherBrickSports(): the sports of the day's other brick legs, to number this one.
function useWorkoutForm(initial, otherBrickSports = () => []) {
  const [type, setTypeState] = useState(initial.type)
  const [brickSport, setBrickSportState] = useState(initial.brickSport || null)
  const [title, setTitle] = useState(initial.title || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const retitle = (nextType, nextSport) => {
    setTitle((current) => (isAutoTitle(current.trim()) ? autoTitleFor(nextType, nextSport) : current))
  }
  const renumber = (nextType, nextSport) => {
    setNotes((current) => (nextType === 'Brick' && nextSport
      ? withBrickPart(current, expectedBrickPart(nextSport, otherBrickSports()))
      : stripBrickPart(current)))
  }
  return {
    type,
    brickSport,
    title,
    setTitle,
    notes,
    setNotes,
    setType: (next) => { setTypeState(next); retitle(next, brickSport); renumber(next, brickSport) },
    setBrickSport: (next) => { setBrickSportState(next); retitle(type, next); renumber(type, next) },
    reset: (next) => {
      setTypeState(next.type)
      setBrickSportState(next.brickSport || null)
      setTitle(next.title || '')
      setNotes(next.notes || '')
    },
  }
}

// The sports of a day's brick legs, leaving out one workout (the one being numbered)
const brickSportsOn = (workouts, date, exceptId) => workouts
  .filter((w) => w.type === 'Brick' && w.date === date && w.id !== exceptId)
  .map((w) => w.brickSport)

// Plan notes, cut to a few lines with "Show more" when long
const NOTES_PREVIEW_LINES = 4
function Notes({ text }) {
  const t = useTheme()
  const [expanded, setExpanded] = useState(false)
  const long = text.split('\n').length > NOTES_PREVIEW_LINES || text.length > 220
  return (
    <YStack gap="$1" alignItems="flex-start">
      <Text
        numberOfLines={long && !expanded ? NOTES_PREVIEW_LINES : undefined}
        style={{ fontFamily: FONT_REGULAR, fontSize: 13, lineHeight: 19, color: t.subtle, whiteSpace: 'pre-wrap' }}
      >
        {text}
      </Text>
      {long && (
        <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8} accessibilityRole="button">
          <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12.5, color: t.primary }}>{expanded ? 'Show less' : 'Show more'}</Text>
        </Pressable>
      )}
    </YStack>
  )
}

// Which sport a brick leg is (Swim, Bike or Run)
function BrickSportPicker({ value, onChange, color }) {
  const t = useTheme()
  return (
    <XStack gap="$2" alignItems="center" flexWrap="wrap">
      <Text style={smallTextStyle(t)}>This leg is a</Text>
      {BRICK_SPORTS.map((sport) => (
        <Pill
          key={sport}
          label={sport}
          active={value === sport}
          color={color}
          onPress={() => onChange(value === sport ? null : sport)}
        />
      ))}
    </XStack>
  )
}

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

// One workout card. `embedded` drops the card frame (a brick leg inside BrickCard);
// `showDate` adds the day to the heading (lists that span several days).
// The ref exposes logStatus(status, earlierLegs) so BrickCard can log both legs in turn.
export const WorkoutRow = forwardRef(function WorkoutRow({ workout, today, onUpdate, onDelete, embedded, showDate }, ref) {
  const t = useTheme()
  const [isEditing, setIsEditing] = useState(false)
  const strava = useStrava()
  const { planRange, workouts, allWorkouts } = useTraining()
  const edit = useWorkoutForm(workout, () => brickSportsOn(workouts, workout.date, workout.id))
  const { type: editType, setType: setEditType, title: editTitle, setTitle: setEditTitle, brickSport: editBrickSport, setBrickSport: setEditBrickSport } = edit
  const { notes: editNotes, setNotes: setEditNotes } = edit
  const display = useWorkoutDisplay()
  const { units } = display
  const [showGraphic, setShowGraphic] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  const [sync, setSync] = useState(null) // { state: 'syncing' | 'none' | 'choose' | 'error', activities, message }

  // By distance, the heading shows the distance and the planned time follows it quietly
  const byDistanceTitle = display.by === 'distance' ? distanceTitle(workout, units) : null
  const distance = byDistanceTitle ? null : estimateDistance(workout, units)
  const notesText = display.by === 'distance' ? notesByDistance(workout, units) : workout.notes
  // Only workouts in the current plan's range can move within their plan week
  const canMove = !!planRange && workout.date >= planRange.start && workout.date <= planRange.raceDate
    && (workout.type === 'Brick' ? workouts.filter((w) => w.type === 'Brick' && w.date === workout.date) : [workout]).every(isMovable)

  const status = statusFor(workout, today)
  const statusColor = t.status[status]

  // earlierLegs: brick legs linked moments ago that this render's `workouts` doesn't include yet.
  // Returns the linked activity id, if any.
  const runSync = async (target, activityId, earlierLegs = []) => {
    setSync({ state: 'syncing' })
    try {
      const fresh = (list) => [...list.filter((w) => !earlierLegs.some((e) => e.id === w.id)), ...earlierLegs]
      // Activities linked in any plan are never offered again; brick legs come from this plan
      const linked = fresh(allWorkouts).filter((w) => w.id !== target.id && w.stravaActivityId)
      const result = await strava.syncWorkout(target, {
        linkedActivityIds: linked.map((w) => w.stravaActivityId),
        brickSiblings: target.type === 'Brick'
          ? fresh(workouts).filter((w) => w.id !== target.id && w.stravaActivityId && w.type === 'Brick' && w.date === target.date)
          : [],
      }, activityId)
      if (result.status === 'synced') {
        // Brick legs' notes take the part numbers Strava now shows
        const numbered = (w) => {
          const part = result.brickParts?.[w.id]
          const notes = part ? withBrickPart(w.notes, part).trim() : w.notes
          return notes !== w.notes ? { notes } : null
        }
        Object.keys(result.brickParts || {}).forEach((id) => {
          const sibling = id !== target.id && fresh(workouts).find((w) => w.id === id)
          const change = sibling && numbered(sibling)
          if (change) onUpdate(id, change)
        })
        onUpdate(target.id, { ...linkUpdates(target, result.activity), ...numbered(target) })
        setSync(null)
        return result.activity.id
      }
      setSync({ state: result.status, activities: result.activities })
    } catch (e) {
      setSync({ state: 'error', message: e.message })
    }
    return null
  }

  // Workouts are logged on the day or later; a future one can only be put back to not logged
  const canLog = !!today && workout.date <= today
  const logStatus = async (nextStatus, earlierLegs) => {
    if (nextStatus !== 'pending' && !canLog) return null
    onUpdate(workout.id, { status: nextStatus })
    if ((nextStatus === 'done' || nextStatus === 'partial') && strava.canSync(workout)) {
      return runSync({ ...workout, status: nextStatus }, undefined, earlierLegs)
    }
    return null
  }
  useImperativeHandle(ref, () => ({ logStatus }))

  // Tapping the highlighted status again puts the workout back to not logged
  const toggleStatus = (nextStatus) => logStatus(workout.status === nextStatus ? 'pending' : nextStatus)

  const setBrickSport = (sport) => {
    onUpdate(workout.id, {
      brickSport: sport,
      notes: sport
        ? withBrickPart(workout.notes, expectedBrickPart(sport, brickSportsOn(workouts, workout.date, workout.id))).trim()
        : stripBrickPart(workout.notes),
    })
    // Rename the linked Strava activity to match
    if (sport && workout.stravaActivityId && isTrained(workout) && strava.canSync(workout)) {
      runSync({ ...workout, brickSport: sport })
    }
  }

  const startEdit = () => {
    edit.reset(workout)
    setIsEditing(true)
  }

  const saveEdit = () => {
    const updates = {
      type: editType,
      title: editTitle.trim(),
      notes: editNotes.trim(),
      brickSport: editType === 'Brick' ? editBrickSport : null,
    }
    onUpdate(workout.id, updates)
    setIsEditing(false)
    // A linked brick leg's Strava title is its sport, so a new sport renames it
    if (updates.brickSport && updates.brickSport !== workout.brickSport && workout.stravaActivityId
      && isTrained(workout) && strava.canSync(updates)) {
      runSync({ ...workout, ...updates })
    }
  }

  const frame = embedded
    ? {}
    : { borderWidth: 1, borderColor: t.border, borderRadius: 16, backgroundColor: t.surface, p: '$3' }

  if (isEditing) {
    return (
      <YStack {...frame} {...(embedded ? {} : { backgroundColor: t.surfaceRaised })} gap="$2">
        <XStack gap="$2" flexWrap="wrap">
          {TYPE_LIST.map((type) => (
            <Pill key={type} label={type} active={editType === type} onPress={() => setEditType(type)} />
          ))}
        </XStack>

        {editType === 'Brick' && <BrickSportPicker value={editBrickSport} onChange={setEditBrickSport} />}

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

  const isRest = workout.type === 'Rest'

  return (
    <YStack {...frame} gap="$3">
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
        <XStack flex={1} minWidth={0} gap="$3" alignItems="flex-start">
          <TypeIcon type={workout.type === 'Brick' && workout.brickSport ? workout.brickSport : workout.type} color={statusColor} />
          <YStack flex={1} minWidth={0} flexShrink={1} gap="$1" pt="$1">
            {showDate && (
              <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 11.5, letterSpacing: 0.4, color: t.subtle, textTransform: 'uppercase' }}>
                {formatShortDay(workout.date)}
              </Text>
            )}
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 14.5, color: t.text }}>
              {workoutLabel(workout, display)}{distance ? ` ≈ ${distance}` : ''}
              {!!byDistanceTitle && (
                <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, color: t.subtle }}>{`  ·  ${workout.title}`}</Text>
              )}
            </Text>
            {(status === 'missed' || status === 'skipped' || !!workout.stravaActivityId) && (
              <XStack gap="$1.5" flexWrap="wrap">
                {status === 'missed' && <Chip label="Missed" color={t.status.missed} />}
                {status === 'skipped' && <Chip label="Skipped" color={t.status.skipped} />}
                {!!workout.stravaActivityId && <Chip label="On Strava" icon="checkmark-circle" color={t.strava} />}
              </XStack>
            )}
            {!!notesText && <Notes text={notesText} />}
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

      {/* Once chosen, the sport shows in the heading and changes in Edit */}
      {workout.type === 'Brick' && !workout.brickSport && (
        <BrickSportPicker value={null} onChange={setBrickSport} color={t.secondary} />
      )}

      {!isRest && canLog && (
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Pill label="Done" icon="checkmark" active={workout.status === 'done'} color={t.status.done} onPress={() => toggleStatus('done')} />
          <Pill label="Partial" icon="contrast-outline" active={workout.status === 'partial'} color={t.status.partial} onPress={() => toggleStatus('partial')} />
          {/* Skipping is for days that have come: ill, travelling, or rested on purpose */}
          <Pill label="Skip" icon="remove-circle-outline" active={workout.status === 'skipped'} color={t.status.skipped} onPress={() => toggleStatus('skipped')} />
          {workout.status !== 'pending' && (
            <Pill label="Undo" icon="arrow-undo-outline" onPress={() => logStatus('pending')} />
          )}
        </XStack>
      )}
      {!isRest && !canLog && (
        workout.status !== 'pending' ? (
          // Logged ahead of its day by mistake (before future days were locked): let it be undone
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text style={smallTextStyle(t)}>Marked {STATUS_WORD[workout.status] || workout.status} before its day.</Text>
            <Pill label="Undo" icon="arrow-undo-outline" onPress={() => logStatus('pending')} />
          </XStack>
        ) : (
          <Text style={smallTextStyle(t)}>You can log this on {formatShortDay(workout.date)}.</Text>
        )
      )}


      {/* Strava's sign-in is kept per device and per web address, so a device (or the move to
          trisync.fly.dev) can have the keys but no connection: say so rather than skip the sync */}
      {!strava.connected && strava.hasKeys && canSyncType(workout.type) && isTrained(workout) && !workout.stravaActivityId && (
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Text style={{ ...smallTextStyle(t), flexShrink: 1 }}>Strava isn't connected on this device, so this wasn't synced.</Text>
          <Pill label="Connect Strava" icon="link-outline" color={t.strava} onPress={() => strava.connect()} />
        </XStack>
      )}

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
})

const STATUS_WORD = { done: 'done', partial: 'partial', skipped: 'skipped' }

// A brick's legs (Brick workouts on the same day) in one card, with a button to log both
function BrickCard({ legs, today, onUpdate, onDelete, showDate }) {
  const t = useTheme()
  const legRefs = useRef({})
  const [logging, setLogging] = useState(false)
  const sports = legs.map((w) => w.brickSport)
  const statuses = legs.map((w) => statusFor(w, today))
  const headColor = t.status[statuses.includes('missed') ? 'missed' : statuses.every((s) => s === 'done') ? 'done' : statuses[0]]

  // Legs are logged one after another, so the second sees the first's Strava link and
  // the brick parts are numbered correctly
  const logBoth = async () => {
    setLogging(true)
    const earlierLegs = []
    for (const leg of legs) {
      if (leg.status === 'done') continue
      const activityId = await legRefs.current[leg.id]?.logStatus('done', earlierLegs)
      if (activityId) earlierLegs.push({ ...leg, status: 'done', stravaActivityId: activityId })
    }
    setLogging(false)
  }

  const allDone = legs.every((w) => w.status === 'done')

  return (
    <YStack borderWidth={1} borderColor={t.border} borderRadius={16} backgroundColor={t.surface} p="$3" gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
        <XStack alignItems="center" gap="$2" flexShrink={1}>
          <Ionicons name="flash" size={16} color={headColor} />
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 15, color: t.text }}>
            {showDate ? `${formatShortDay(legs[0].date)} · ` : ''}Brick
          </Text>
          <Text style={{ ...smallTextStyle(t), fontFamily: FONT_SEMIBOLD }}>
            {sports.every(Boolean) ? sports.join(' → ') : `${legs.length} legs`}
          </Text>
        </XStack>
        {!allDone && legs[0].type === 'Brick' && !!today && legs[0].date <= today && (
          <Pill
            label={logging ? 'Logging…' : 'Both done'}
            icon="checkmark-done"
            color={t.status.done}
            onPress={logging ? () => {} : logBoth}
          />
        )}
      </XStack>
      {legs.map((leg, i) => (
        <YStack key={leg.id} gap="$3">
          {i > 0 && <YStack height={1} backgroundColor={t.border} />}
          <WorkoutRow
            ref={(r) => { legRefs.current[leg.id] = r }}
            workout={leg}
            today={today}
            onUpdate={onUpdate}
            onDelete={onDelete}
            embedded
          />
        </YStack>
      ))}
    </YStack>
  )
}

// A list of workout cards, with each day's brick legs grouped into one card
export function WorkoutList({ workouts, today, onUpdate, onDelete, showDate }) {
  const items = []
  const bricks = {}
  workouts.forEach((w) => {
    if (w.type !== 'Brick') {
      items.push({ key: w.id, workout: w })
    } else if (bricks[w.date]) {
      bricks[w.date].legs.push(w)
    } else {
      bricks[w.date] = { key: `brick-${w.date}`, legs: [w] }
      items.push(bricks[w.date])
    }
  })

  return items.map((item) => (item.legs && item.legs.length > 1
    ? <BrickCard key={item.key} legs={item.legs} today={today} onUpdate={onUpdate} onDelete={onDelete} showDate={showDate} />
    : (
      <WorkoutRow
        key={item.key}
        workout={item.workout || item.legs[0]}
        today={today}
        onUpdate={onUpdate}
        onDelete={onDelete}
        showDate={showDate}
      />
    )))
}

// Collapsed to an "Add workout" button until opened, so it doesn't push the day's workouts away
// date: the day it adds to, so a brick leg can be numbered among that day's legs
export function AddWorkoutForm({ onAdd, date }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const DEFAULT_TYPE = TYPE_LIST[2] || TYPE_LIST[0]
  const { workouts } = useTraining()
  const form = useWorkoutForm({ type: DEFAULT_TYPE, title: autoTitleFor(DEFAULT_TYPE) }, () => brickSportsOn(workouts, date))
  const { type: newType, setType: setNewType, title: newTitle, setTitle: setNewTitle, brickSport: newBrickSport, setBrickSport: setNewBrickSport } = form
  const { notes: newNotes, setNotes: setNewNotes } = form

  const close = () => {
    form.reset({ type: newType, title: autoTitleFor(newType) })
    setOpen(false)
  }

  const handleAdd = () => {
    onAdd({ type: newType, title: newTitle, notes: newNotes.trim(), brickSport: newType === 'Brick' ? newBrickSport : null })
    close()
  }

  if (!open) {
    return (
      <XStack borderTopWidth={1} borderColor={t.border} pt="$3">
        <Pill label="Add workout" icon="add" color={t.secondary} onPress={() => setOpen(true)} />
      </XStack>
    )
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

      {newType === 'Brick' && <BrickSportPicker value={newBrickSport} onChange={setNewBrickSport} color={t.secondary} />}

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

      <XStack gap="$2">
        <Pill label="Add Workout" variant="primary" color={t.secondary} onPress={handleAdd} />
        <Pill label="Cancel" onPress={close} />
      </XStack>
    </YStack>
  )
}
