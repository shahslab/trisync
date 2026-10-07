import React, { useMemo } from 'react'
import { TamaguiProvider } from 'tamagui'
import tamaguiConfig from './tamagui.config'

import { Platform, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DarkTheme, NavigationContainer } from '@react-navigation/native'

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope'

import TrainingCalendarScreen from './src/screens/TrainingCalendarScreen'
import TodaysActivitiesScreen from './src/screens/TodaysActivitiesScreen'
import TrainingHeaderMenu from './src/components/TrainingHeaderMenu'
import { TrainingProvider } from './src/training/TrainingContext'
import { StravaProvider } from './src/strava/StravaContext'
import { BG, SURFACE, BORDER, TEXT, SUBTLE, ACCENT_PRIMARY, FONT_BOLD, FONT_SEMIBOLD } from './src/training/trainingUtils'

const Tab = createBottomTabNavigator()

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  })

  const screenOptions = useMemo(() => ({
    headerStyle: { backgroundColor: BG },
    headerShadowVisible: false,
    headerTintColor: TEXT,
    headerTitleStyle: { fontFamily: FONT_BOLD, color: TEXT },
    headerRight: () => <TrainingHeaderMenu />,
    sceneContainerStyle: { backgroundColor: BG },
    tabBarStyle: {
      backgroundColor: SURFACE,
      borderTopColor: BORDER,
      borderTopWidth: 1,
      height: 64,
      paddingBottom: 10,
      paddingTop: 8,
    },
    tabBarActiveTintColor: ACCENT_PRIMARY,
    tabBarInactiveTintColor: SUBTLE,
    tabBarLabelStyle: { fontFamily: FONT_SEMIBOLD, fontSize: 11.5 },
  }), [])

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: BG }} />
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <StravaProvider>
        <TrainingProvider>
          <View style={{ flex: 1, ...(Platform.OS === 'web' ? { height: '100vh' } : null) }}>
            <NavigationContainer
              documentTitle={{ formatter: (options, route) => `${options?.headerTitle ?? route?.name} · TriSync` }}
              theme={{
                ...DarkTheme,
                colors: { ...DarkTheme.colors, background: BG, card: SURFACE, border: BORDER, text: TEXT },
              }}
            >
              <Tab.Navigator screenOptions={screenOptions}>
                <Tab.Screen
                  name="TodaysActivities"
                  component={TodaysActivitiesScreen}
                  options={{
                    headerTitle: "Today's Activities",
                    tabBarLabel: 'Today',
                    tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} />,
                  }}
                />
                <Tab.Screen
                  name="TrainingPlan"
                  component={TrainingCalendarScreen}
                  options={{
                    headerTitle: 'Training Plan',
                    tabBarLabel: 'Calendar',
                    tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
                  }}
                />
              </Tab.Navigator>
            </NavigationContainer>
          </View>
        </TrainingProvider>
      </StravaProvider>
    </TamaguiProvider>
  )
}