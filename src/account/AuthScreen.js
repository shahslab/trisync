import React, { useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from 'react-native'
import { XStack, YStack } from 'tamagui'

import { AppBackground, useTheme } from '../theme/ThemeContext'
import { Pill } from '../training/WorkoutRow'
import { GLYPH_ASPECT } from '../components/SplashOverlay'
import { FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD } from '../training/trainingUtils'
import { requestCode, verifyCode } from './pocketbase'
import ReportBugModal from '../support/ReportBugModal'

// Full-screen card shared by the sign-in and "which data?" screens, with a bug report
// link below it (signing in is where a problem would otherwise leave someone stuck)
function Shell({ children }) {
  const t = useTheme()
  const [bugOpen, setBugOpen] = useState(false)
  return (
    <AppBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <YStack
            width="100%"
            maxWidth={420}
            gap="$3.5"
            padding={24}
            borderRadius={20}
            borderWidth={1}
            borderColor={t.border}
            backgroundColor={t.surfaceSolid}
          >
            <YStack alignItems="center" gap="$2">
              <Image
                source={require('../../assets/brand/tri-glyph.png')}
                style={{ width: 48, height: 48 * GLYPH_ASPECT, tintColor: t.text }}
                resizeMode="contain"
                accessibilityLabel="TriSync"
              />
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 24, color: t.text }}>TriSync</Text>
            </YStack>
            {children}
          </YStack>
          <Pressable onPress={() => setBugOpen(true)} accessibilityRole="button" hitSlop={8} style={{ marginTop: 16 }}>
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12.5, color: t.subtle }}>Report a bug</Text>
          </Pressable>
        </ScrollView>
        <ReportBugModal visible={bugOpen} onClose={() => setBugOpen(false)} />
      </KeyboardAvoidingView>
    </AppBackground>
  )
}

const validEmail = (email) => /^\S+@\S+\.\S+$/.test(email.trim())

// Sign-in is passwordless: enter your email, then the 6-digit code emailed to it.
// A new email gets an account on the way.
export default function AuthScreen({ onSignedIn, notice }) {
  const t = useTheme()
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [otpId, setOtpId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(notice || '')

  const body = { fontFamily: FONT_REGULAR, fontSize: 13, lineHeight: 19, color: t.subtle }
  const inputStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: t.text,
    backgroundColor: t.surfaceRaised,
    fontFamily: FONT_REGULAR,
  }

  const sendCode = async () => {
    if (busy) return
    setError('')
    setInfo('')
    if (!validEmail(email)) return setError('Enter your email address.')
    setBusy(true)
    try {
      setOtpId(await requestCode(email))
      setCode('')
      setStep('code')
      setInfo(`We sent a 6-digit code to ${email.trim()}. It works for 10 minutes. Check your spam folder if it isn't there.`)
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  const verify = async () => {
    if (busy) return
    setError('')
    const digits = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(digits)) return setError('Enter the 6-digit code from the email.')
    setBusy(true)
    try {
      await onSignedIn(await verifyCode(otpId, digits))
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const useOtherEmail = () => {
    setStep('email')
    setCode('')
    setOtpId(null)
    setError('')
    setInfo('')
  }

  const onCodeStep = step === 'code'

  return (
    <Shell>
      <Text style={{ ...body, textAlign: 'center' }}>
        {onCodeStep
          ? 'Enter the code to sign in.'
          : 'Sign in or create an account with your email. We\'ll send you a code, no password needed. Your plans, workouts and settings stay in sync on every device.'}
      </Text>

      {onCodeStep ? (
        <TextInput
          key="code"
          style={{ ...inputStyle, fontSize: 22, letterSpacing: 8, textAlign: 'center', fontFamily: FONT_SEMIBOLD }}
          placeholder="000000"
          placeholderTextColor={t.subtle}
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^\d]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoFocus
          maxLength={6}
          onSubmitEditing={verify}
          accessibilityLabel="Sign-in code"
        />
      ) : (
        <TextInput
          key="email"
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={t.subtle}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          onSubmitEditing={sendCode}
          accessibilityLabel="Email"
        />
      )}

      {!!error && <Text style={{ ...body, color: t.danger }}>{error}</Text>}
      {!!info && <Text style={{ ...body, color: t.text }}>{info}</Text>}

      <Pressable
        onPress={onCodeStep ? verify : sendCode}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => ({
          backgroundColor: t.primary,
          borderRadius: 999,
          paddingVertical: 13,
          alignItems: 'center',
          opacity: busy ? 0.6 : pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 14, color: t.onAccent }}>
          {busy ? 'One moment…' : onCodeStep ? 'Sign in' : 'Email me a code'}
        </Text>
      </Pressable>

      {onCodeStep && (
        <XStack justifyContent="center" gap="$4">
          <Pressable onPress={sendCode} disabled={busy} accessibilityRole="button">
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12.5, color: t.subtle }}>Send a new code</Text>
          </Pressable>
          <Pressable onPress={useOtherEmail} accessibilityRole="button">
            <Text style={{ fontFamily: FONT_SEMIBOLD, fontSize: 12.5, color: t.subtle }}>Use a different email</Text>
          </Pressable>
        </XStack>
      )}
    </Shell>
  )
}

// Shown once, when an account that already has plans signs in on a device that has
// different plans of its own (from before accounts)
export function ChooseDataScreen({ email, onChoose }) {
  const t = useTheme()
  const body = { fontFamily: FONT_REGULAR, fontSize: 13, lineHeight: 19, color: t.subtle }
  return (
    <Shell>
      <Text style={{ fontFamily: FONT_BOLD, fontSize: 17, color: t.text, textAlign: 'center' }}>Which plans should you keep?</Text>
      <Text style={body}>
        {email ? <Text style={{ fontFamily: FONT_SEMIBOLD, color: t.text }}>{email}</Text> : 'Your account'} already has
        training plans, and this device has different ones. Pick which to keep. The other set is replaced
        everywhere.
      </Text>
      <YStack gap="$2">
        <Pill label="Keep my account's plans" variant="primary" onPress={() => onChoose('account')} />
        <Pill label="Keep this device's plans" onPress={() => onChoose('device')} />
      </YStack>
    </Shell>
  )
}
