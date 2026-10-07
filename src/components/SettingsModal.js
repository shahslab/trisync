import React, { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'

import { useAppearance, useTheme, GradientFill } from '../theme/ThemeContext'
import { Pill } from '../training/WorkoutRow'
import { useStrava } from '../strava/StravaContext'
import { backupSupported, exportBackup, importBackup } from '../backup/backup'
import { FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from '../training/trainingUtils'

const MODES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'gradient', label: 'Gradient' },
]

function SectionLabel({ children }) {
  const t = useTheme()
  return (
    <Text style={{ fontFamily: FONT_BOLD, fontSize: 11, letterSpacing: 1, color: t.subtle, textTransform: 'uppercase' }}>
      {children}
    </Text>
  )
}

function GradientSwatch({ gradient, selected, onPress }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 6, width: 72 }} accessibilityLabel={`${gradient.name} gradient`}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: selected ? t.primary : t.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GradientFill colors={gradient.colors} id={`swatch-${gradient.id}`} />
        {selected && <Ionicons name="checkmark" size={22} color={gradient.base === 'light' ? '#18181b' : '#ffffff'} />}
      </View>
      <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12, color: selected ? t.text : t.subtle }}>{gradient.name}</Text>
    </Pressable>
  )
}

function StravaSettings() {
  const t = useTheme()
  const strava = useStrava()
  const [clientId, setClientId] = useState(strava.keys?.clientId || '')
  const [clientSecret, setClientSecret] = useState(strava.keys?.clientSecret || '')
  const [savedNote, setSavedNote] = useState('')

  useEffect(() => {
    setClientId(strava.keys?.clientId || '')
    setClientSecret(strava.keys?.clientSecret || '')
  }, [strava.keys])

  const inputStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: t.text,
    backgroundColor: t.surfaceRaised,
    fontFamily: FONT_REGULAR,
  }
  const body = { fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 19, color: t.subtle }
  const strong = { fontFamily: FONT_SEMIBOLD, color: t.text }
  const unchanged = clientId.trim() === (strava.keys?.clientId || '') && clientSecret.trim() === (strava.keys?.clientSecret || '')

  const save = async () => {
    await strava.saveKeys({ clientId, clientSecret })
    setSavedNote(clientId.trim() && clientSecret.trim() ? 'Keys saved on this device.' : 'Keys removed.')
  }

  return (
    <YStack gap="$2.5">
      <SectionLabel>Strava</SectionLabel>

      {strava.connected ? (
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Text style={{ ...body, flexShrink: 1 }}>
            Connected{strava.athleteName ? <> as <Text style={strong}>{strava.athleteName}</Text></> : null}
          </Text>
          <Pill label="Disconnect" onPress={strava.disconnect} />
        </XStack>
      ) : (
        <Text style={body}>
          TriSync connects to Strava through your own free Strava API app, so your keys and data stay on this device.
        </Text>
      )}

      <Text style={body}>
        1. Create an app at <Text style={strong}>strava.com/settings/api</Text>{'\n'}
        2. Set its Authorization Callback Domain to <Text style={strong}>{strava.callbackDomain}</Text>{'\n'}
        3. Paste its Client ID and Client Secret here
      </Text>

      <Text style={body}>
        <Text style={strong}>Daily sync cap:</Text> Strava limits each API app to about 1,000 requests a day
        (100 every 15 minutes), reset at midnight UTC. A sync uses about 3, so that's roughly 300 syncs a day.
        Your app's exact limits are shown on strava.com/settings/api.
      </Text>

      <TextInput
        style={inputStyle}
        placeholder="Client ID"
        placeholderTextColor={t.subtle}
        value={clientId}
        onChangeText={(v) => { setClientId(v); setSavedNote('') }}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={inputStyle}
        placeholder="Client Secret"
        placeholderTextColor={t.subtle}
        value={clientSecret}
        onChangeText={(v) => { setClientSecret(v); setSavedNote('') }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        {!unchanged && <Pill label="Save keys" variant="primary" onPress={save} />}
        {unchanged && strava.hasKeys && !strava.connected && (
          <Pill label="Connect Strava" variant="primary" onPress={strava.connect} />
        )}
        {!!savedNote && <Text style={body}>{savedNote}</Text>}
      </XStack>
    </YStack>
  )
}

function BackupSettings() {
  const t = useTheme()
  const [note, setNote] = useState('')
  const body = { fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 19, color: t.subtle }

  const runImport = async () => {
    setNote('')
    const result = await importBackup()
    if (result.error) setNote(result.error)
  }

  return (
    <YStack gap="$2.5">
      <SectionLabel>Backup</SectionLabel>
      <Text style={body}>
        Everything is saved only in this browser, so clearing site data, private browsing or a home-screen
        install on iPhone can start you from scratch. Export a backup file to keep your plan, workouts and
        settings (including your Strava API keys), and import it on any device. After importing, reconnect Strava.
      </Text>
      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        <Pill label="Export backup" variant="primary" onPress={() => exportBackup().catch((e) => setNote(e.message))} />
        <Pill label="Import backup" onPress={runImport} />
      </XStack>
      {!!note && <Text style={{ ...body, color: t.danger }}>{note}</Text>}
    </YStack>
  )
}

export default function SettingsModal({ visible, onClose }) {
  const t = useTheme()
  const { appearance, setAppearance, gradients } = useAppearance()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: t.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 }} onPress={onClose}>
        {/* Inner Pressable swallows taps so only the backdrop closes the dialog */}
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 420, maxHeight: '90%' }}>
          {/* maxHeight + flexShrink keep the dialog on screen; the ScrollView takes the overflow */}
          <YStack backgroundColor={t.surfaceSolid} borderColor={t.border} borderWidth={1} borderRadius={20} overflow="hidden" maxHeight="100%" flexShrink={1}>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20, gap: 20 }}>
              <XStack justifyContent="space-between" alignItems="center" width="100%">
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 18, color: t.text }}>Settings</Text>
                <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close settings">
                  <Ionicons name="close" size={22} color={t.subtle} />
                </Pressable>
              </XStack>

              <YStack gap="$2.5">
                <SectionLabel>Appearance</SectionLabel>
                <XStack gap="$2" flexWrap="wrap">
                  {MODES.map((mode) => (
                    <Pill
                      key={mode.id}
                      label={mode.label}
                      active={appearance.mode === mode.id}
                      onPress={() => setAppearance({ mode: mode.id })}
                    />
                  ))}
                </XStack>
              </YStack>

              {appearance.mode === 'gradient' && (
                <YStack gap="$2.5">
                  <SectionLabel>Gradient</SectionLabel>
                  <XStack gap="$2" flexWrap="wrap" rowGap="$3">
                    {gradients.map((gradient) => (
                      <GradientSwatch
                        key={gradient.id}
                        gradient={gradient}
                        selected={appearance.gradientId === gradient.id}
                        onPress={() => setAppearance({ gradientId: gradient.id })}
                      />
                    ))}
                  </XStack>
                  <Text style={{ fontFamily: FONT_REGULAR, fontSize: 12.5, lineHeight: 18, color: t.subtle }}>
                    Your Strava graphic keeps its dark look whatever theme you pick.
                  </Text>
                </YStack>
              )}

              <StravaSettings />

              {backupSupported && <BackupSettings />}
            </ScrollView>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
