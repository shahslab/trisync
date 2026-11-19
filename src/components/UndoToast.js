import React, { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { useTraining } from '../training/TrainingContext'
import { FONT_REGULAR, FONT_BOLD } from '../training/trainingUtils'

const SHOW_FOR_MS = 7000

// "Workout deleted · Undo" above the tab bar for a few seconds after a delete
export default function UndoToast() {
  const t = useTheme()
  const { lastDeleted, undoDelete, dismissUndo } = useTraining()

  useEffect(() => {
    if (!lastDeleted) return undefined
    const timer = setTimeout(dismissUndo, SHOW_FOR_MS)
    return () => clearTimeout(timer)
  }, [lastDeleted?.at])

  if (!lastDeleted) return null
  const { workout } = lastDeleted

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 86, alignItems: 'center', paddingHorizontal: 16 }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          maxWidth: 480,
          width: '100%',
          backgroundColor: t.surfaceSolid,
          borderColor: t.border,
          borderWidth: 1,
          borderRadius: 14,
          paddingVertical: 10,
          paddingLeft: 16,
          paddingRight: 8,
          ...t.cardShadow,
        }}
      >
        <Ionicons name="trash-outline" size={16} color={t.subtle} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONT_REGULAR, fontSize: 13.5, color: t.text }}>
          Deleted {workout.title ? `${workout.type}: ${workout.title}` : workout.type}
        </Text>
        <Pressable onPress={undoDelete} hitSlop={8} accessibilityRole="button" style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 13.5, color: t.primary }}>Undo</Text>
        </Pressable>
        <Pressable onPress={dismissUndo} hitSlop={8} accessibilityLabel="Dismiss" style={{ padding: 4 }}>
          <Ionicons name="close" size={16} color={t.subtle} />
        </Pressable>
      </View>
    </View>
  )
}
