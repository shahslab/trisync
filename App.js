import React, { useMemo } from 'react'
import { TamaguiProvider, Theme } from 'tamagui'
import tamaguiConfig from './tamagui.config'

import { Platform, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native'

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import {
  useFonts,
  JosefinSans_400Regular,
  JosefinSans_500Medium,
  JosefinSans_600SemiBold,
  JosefinSans_700Bold,
} from '@expo-google-fonts/josefin-sans'

import TrainingCalendarScreen from './src/screens/TrainingCalendarScreen'
import TodaysActivitiesScreen from './src/screens/TodaysActivitiesScreen'
import TrainingHeaderMenu from './src/components/TrainingHeaderMenu'
import HeaderLogo from './src/components/HeaderLogo'
import { TrainingProvider, useTraining } from './src/training/TrainingContext'
import SplashOverlay from './src/components/SplashOverlay'
import { StravaProvider } from './src/strava/StravaContext'
import { FONT_BOLD, FONT_SEMIBOLD } from './src/training/trainingUtils'
import { ThemeProvider, AppBackground, useTheme } from './src/theme/ThemeContext'

const Tab = createBottomTabNavigator()

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}

function AppShell() {
  const t = useTheme()
  const [fontsLoaded] = useFonts({
    JosefinSans_400Regular,
    JosefinSans_500Medium,
    JosefinSans_600SemiBold,
    JosefinSans_700Bold,
    })

  const screenOptions = useMemo(() => ({
    headerStyle: { backgroundColor: t.header },
    headerShadowVisible: false,
    headerTintColor: t.text,
    headerTitleStyle: { fontFamily: FONT_BOLD, color: t.text },
    headerLeft: () => <HeaderLogo />,
    headerRight: () => <TrainingHeaderMenu />,
    // Transparent scenes let the gradient (drawn by AppBackground) show through
    sceneStyle: { backgroundColor: 'transparent' },
    tabBarStyle: {
      backgroundColor: t.tabBar,
      borderTopColor: t.border,
      borderTopWidth: 1,
      height: 72,
      paddingBottom: 10,
      paddingTop: 8,
      ...(t.gradient ? { backdropFilter: 'blur(18px)' } : null),
    },
    tabBarActiveTintColor: t.primary,
    tabBarInactiveTintColor: t.subtle,
    tabBarLabelStyle: { fontFamily: FONT_SEMIBOLD, fontSize: 11.5 },
  }), [t])

  const navigationTheme = useMemo(() => {
    const base = t.isDark ? DarkTheme : DefaultTheme
    return {
      ...base,
      colors: { ...base.colors, background: 'transparent', card: t.tabBar, border: t.border, text: t.text, primary: t.primary },
    }
  }, [t])

  return (
    <View style={{ flex: 1, backgroundColor: t.bgSolid }}>
      {fontsLoaded && (
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <Theme name={t.isDark ? 'dark' : 'light'}>
            <StravaProvider>
              <TrainingProvider>
                <View style={{ flex: 1, ...(Platform.OS === 'web' ? { height: '100vh' } : null) }}>
                  <AppBackground>
                    <NavigationContainer
                      documentTitle={{ formatter: (options, route) => `${options?.headerTitle ?? route?.name} · TriSync` }}
                      theme={navigationTheme}
                    >
                      <MainTabs screenOptions={screenOptions} />
                    </NavigationContainer>
                  </AppBackground>
                </View>
              </TrainingProvider>
            </StravaProvider>
          </Theme>
        </TamaguiProvider>
      )}
      <SplashOverlay ready={fontsLoaded} />
    </View>
  )
}

// Rendered inside TrainingProvider, which only mounts once saved data has loaded,
// so planRange is final here when the navigator picks its first tab
function MainTabs({ screenOptions }) {
  const { planRange } = useTraining()
  return (
    <Tab.Navigator
      screenOptions={screenOptions}
      // New users land on the Calendar tab's "Set Up Your Race" form
      initialRouteName={planRange ? 'TodaysActivities' : 'TrainingPlan'}
    >
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
  )
}