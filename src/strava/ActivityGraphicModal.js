import React, { useEffect, useRef, useState } from 'react'
import { Image, Modal, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { SvgXml } from 'react-native-svg'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'

import { useStrava } from './StravaContext'
import { planLine } from './stravaApi'
import { buildGraphicSvg, svgDataUri, GRAPHIC_SIZE } from './activityGraphic'
import { Pill } from '../training/WorkoutRow'
import { SURFACE, BORDER, TEXT, SUBTLE, FONT_REGULAR, FONT_BOLD } from '../training/trainingUtils'

// Web: rasterize the SVG on a canvas and download it as a PNG
function downloadPngWeb(svg, fileName) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = GRAPHIC_SIZE
      canvas.height = GRAPHIC_SIZE
      canvas.getContext('2d').drawImage(img, 0, 0, GRAPHIC_SIZE, GRAPHIC_SIZE)
      canvas.toBlob((blob) => {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        link.click()
        URL.revokeObjectURL(link.href)
        resolve()
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Could not render the graphic.'))
    img.src = svgDataUri(svg)
  })
}

export default function ActivityGraphicModal({ workout, plan, visible, onClose }) {
  const strava = useStrava()
  const { width } = useWindowDimensions()
  const previewSize = Math.min(width - 48, 420)
  const captureView = useRef(null)

  const [svg, setSvg] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    setSvg(null)
    setError(null)
    strava.fetchActivity(workout.stravaActivityId)
      .then((activity) => {
        setSvg(buildGraphicSvg({
          activity,
          title: workout.title || activity.name,
          footer: ['TriSync', planLine(workout, plan) || workout.type].join(' · '),
          status: workout.status,
        }))
      })
      .catch((e) => setError(e.message))
  }, [visible, workout.stravaActivityId, workout.status])

  const save = async () => {
    setSaving(true)
    try {
      if (Platform.OS === 'web') {
        await downloadPngWeb(svg, `trisync-${workout.date}.png`)
      } else {
        const uri = await captureRef(captureView, { format: 'png', width: GRAPHIC_SIZE, height: GRAPHIC_SIZE })
        await Sharing.shareAsync(uri, { mimeType: 'image/png' })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <YStack backgroundColor={SURFACE} borderColor={BORDER} borderWidth={1} borderRadius={20} p="$4" gap="$3" ai="center">
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 16, color: TEXT, alignSelf: 'flex-start' }}>Activity graphic</Text>

          <View style={{ width: previewSize, height: previewSize, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {error ? (
              <Text style={{ fontFamily: FONT_REGULAR, fontSize: 13, color: '#f87171', textAlign: 'center' }}>{error}</Text>
            ) : !svg ? (
              <Text style={{ fontFamily: FONT_REGULAR, fontSize: 13, color: SUBTLE }}>Loading laps from Strava…</Text>
            ) : Platform.OS === 'web' ? (
              <Image source={{ uri: svgDataUri(svg) }} style={{ width: previewSize, height: previewSize }} />
            ) : (
              <View ref={captureView} collapsable={false}>
                <SvgXml xml={svg} width={previewSize} height={previewSize} />
              </View>
            )}
          </View>

          <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 18, color: SUBTLE, maxWidth: previewSize }}>
            Strava doesn't let apps add photos, so save this and add it to the activity in Strava.
          </Text>

          <XStack gap="$2" alignSelf="flex-start">
            {!!svg && !error && (
              <Pill label={saving ? 'Saving…' : Platform.OS === 'web' ? 'Download PNG' : 'Save / share'} variant="primary" onPress={saving ? undefined : save} />
            )}
            <Pill label="Close" onPress={onClose} />
          </XStack>
        </YStack>
      </View>
    </Modal>
  )
}
