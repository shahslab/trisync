import React from 'react'
import { Alert, Modal, Platform, Pressable, ScrollView, Text } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'

import { useTraining } from '../training/TrainingContext'
import { Pill } from '../training/WorkoutRow'
import { useTheme } from '../theme/ThemeContext'
import { calendarExportSupported } from '../calendar/icsExport'
import { daysBetween, formatOrdinalDate, FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from '../training/trainingUtils'

// Alert.alert does nothing on web, so confirm there with the browser dialog
function confirmDelete(name, onConfirm) {
  const message = `Delete "${name}" and all its workouts? This can't be undone.`
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm()
    return
  }
  Alert.alert('Delete plan', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ])
}

function countdown(today, raceDate) {
  const days = daysBetween(today, raceDate)
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} to go`
  if (days === 0) return 'Race day is today'
  return 'Completed'
}

function PlanCard({ plan, active, today, onSelect, onExport, onDelete }) {
  const t = useTheme()
  const name = plan.raceName || 'Race Plan'
  const done = plan.raceDate < today
  const count = plan.workouts.length

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={`${name}${active ? ', current plan' : ''}`}
      style={({ pressed }) => ({
        borderWidth: active ? 2 : 1,
        borderColor: active ? t.primary : t.border,
        borderRadius: 16,
        backgroundColor: t.surfaceRaised,
        padding: active ? 13 : 14,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
        <YStack flex={1} gap="$1">
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            <Text style={{ fontFamily: FONT_BOLD, fontSize: 16, color: t.text }}>{name}</Text>
            {active && (
              <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 10.5, letterSpacing: 0.6, color: t.primary, textTransform: 'uppercase' }}>
                Current
              </Text>
            )}
          </XStack>
          <Text style={{ fontFamily: FONT_REGULAR, fontSize: 13, color: t.subtle }}>
            {formatOrdinalDate(plan.raceDate)} · {plan.weeks} week{plan.weeks === 1 ? '' : 's'} · {count} workout{count === 1 ? '' : 's'}
          </Text>
          <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 13.5, color: done ? t.subtle : t.primary }}>
            {countdown(today, plan.raceDate)}
          </Text>
        </YStack>
        <XStack gap="$3">
          {calendarExportSupported && (
            <Pressable onPress={onExport} hitSlop={8} accessibilityLabel={`Add ${name} to calendar`} style={{ padding: 2 }}>
              <Ionicons name="calendar-outline" size={18} color={t.subtle} />
            </Pressable>
          )}
          <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel={`Delete ${name}`} style={{ padding: 2 }}>
            <Ionicons name="trash-outline" size={18} color={t.subtle} />
          </Pressable>
        </XStack>
      </XStack>
    </Pressable>
  )
}

// Lists every race plan: tap one to make it current, or start a new one
export default function PlansModal({ visible, onClose, onNewPlan, onExportPlan }) {
  const t = useTheme()
  const { plans, activePlanId, selectPlan, deletePlan, today } = useTraining()

  // Races still ahead first (soonest first), then finished ones (most recent first)
  const upcoming = plans.filter((p) => p.raceDate >= today)
  const finished = plans.filter((p) => p.raceDate < today).reverse()

  const card = (plan) => (
    <PlanCard
      key={plan.id}
      plan={plan}
      today={today}
      active={plan.id === activePlanId}
      onSelect={() => {
        selectPlan(plan.id)
        onClose()
      }}
      onExport={() => onExportPlan(plan)}
      onDelete={() => confirmDelete(plan.raceName || 'Race Plan', () => deletePlan(plan.id))}
    />
  )

  const sectionLabel = { fontFamily: FONT_BOLD, fontSize: 11, letterSpacing: 1, color: t.subtle, textTransform: 'uppercase' }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: t.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 }} onPress={onClose}>
        {/* Inner Pressable swallows taps so only the backdrop closes the dialog */}
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 420, maxHeight: '90%' }}>
          <YStack backgroundColor={t.surfaceSolid} borderColor={t.border} borderWidth={1} borderRadius={20} overflow="hidden" maxHeight="100%" flexShrink={1}>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
              <XStack justifyContent="space-between" alignItems="center" width="100%">
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 18, color: t.text }}>My Plans</Text>
                <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close plans">
                  <Ionicons name="close" size={22} color={t.subtle} />
                </Pressable>
              </XStack>

              {plans.length === 0 && (
                <Text style={{ fontFamily: FONT_REGULAR, fontSize: 13.5, color: t.subtle }}>No plans yet.</Text>
              )}

              {upcoming.length > 0 && <Text style={sectionLabel}>Upcoming</Text>}
              {upcoming.map(card)}

              {finished.length > 0 && <Text style={sectionLabel}>Completed</Text>}
              {finished.map(card)}

              <XStack>
                <Pill label="New plan" variant="primary" onPress={onNewPlan} />
              </XStack>
            </ScrollView>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
