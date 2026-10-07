# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TriSync is an Expo (SDK 54, React Native 0.81, React 19, new architecture enabled) app for planning race training (triathlon-style workouts: Swim, Bike, Run, Brick, Strength, Rest). It targets iOS, Android and web. Code is plain JavaScript (`.js`), even though `tsconfig.json` exists.

## Commands

- `npm start` — Expo dev server (`npm run ios` / `npm run android` / `npm run web` for a specific platform)
- `npx expo start -c` — restart with a cleared Metro cache; needed after changing `babel.config.js` or `tamagui.config.js`
- `npx expo install <pkg>` — add Expo-managed deps so versions match SDK 54

Strava sync needs `EXPO_PUBLIC_STRAVA_CLIENT_ID` / `EXPO_PUBLIC_STRAVA_CLIENT_SECRET` in `.env.local` (git-ignored; template in `.env.example`). Restart the dev server after changing them.

There is no test runner, linter, or formatter configured.

## Architecture

- **Entry:** `index.js` registers `App.js` and loads `app.web.css` only on web (it makes `#root` a full-height flex column so React Native Web scroll views work). `global.css` is not currently imported.
- **App shell (`App.js`):** waits for Manrope fonts, then wraps everything in `TamaguiProvider` (dark theme) → `StravaProvider` → `TrainingProvider` → `NavigationContainer` with a bottom tab navigator holding two screens: `TodaysActivitiesScreen` ("Today") and `TrainingCalendarScreen` ("Calendar"). `TrainingHeaderMenu` is rendered as `headerRight` on every tab.
- **State (`src/training/TrainingContext.js`):** a single React context, accessed with `useTraining()`, holds `planRange` (`{ start, raceDate, raceName, weeks }`, or `null` when no plan exists) and the `workouts` array, plus the actions (`createPlan`, `editPlanLength`, `addWorkout`, `updateWorkout`, `deleteWorkout`). `planRange` and `workouts` are saved to AsyncStorage (`trisync/training/v1`; localStorage on web). Data saved under the old `oneplan/*` keys (from before the OnePlan → TriSync rename) is migrated on load. The provider renders a blank screen until the saved data has loaded, so the empty initial state never overwrites it. `createPlan` returns `{ error }` for validation failures, and it clamps the plan start to today. "Edit plan" works by resetting `planRange` to `null`, which sends the calendar screen back to the plan-setup form.
- **Shared module (`src/training/trainingUtils.js`):** contains date helpers, workout types and icons, `statusFor()`, **and the theme**: color constants (`BG`, `SURFACE`, `TEXT`, `STATUS_COLORS`, `RACE_COLOR`, ...), the `FONT_*` Manrope family names, and shared styles. New UI should import these tokens instead of hard-coding colors or fonts.
- **Shared UI (`src/training/WorkoutRow.js`):** exports `Pill`, `WorkoutRow` and `AddWorkoutForm`, which both screens reuse.
- **Strava (`src/strava/`):** `stravaApi.js` makes plain `fetch` calls to the Strava API (no backend). `StravaContext.js` keeps the OAuth session in AsyncStorage (`trisync/strava/v1`), refreshes expired tokens, and exposes `syncWorkout`. On web, login is a full-page redirect back to the app with `?code=`, which `StravaProvider` picks up on mount. On native it uses `expo-web-browser` with the `trisync://` scheme; that path is untested. When a workout is marked Done or Partial, `WorkoutRow` matches it to the Strava activity with the same date and sport. If there are zero or several candidates, the user picks one. Activities already linked to another workout are never offered again. The matched activity is stored on the workout as `stravaActivityId`. Its name becomes `TriSync: <workout title>`, falling back to Strava's own name. Its description is replaced with the workout notes; if the notes are empty, the description is left alone. A brick is entered as two Brick workouts on the same day, one per leg, and their order in the list sets the description prefix `Brick Part 1: ` / `Brick Part 2: `.
- **Activity graphic:** `activityGraphic.js` builds a 1080×1080 dark-card SVG string from the Strava activity's `laps`, or `splits_metric` if there's only one lap. It shows a headline distance (or time), the workout title and a status badge (green for Done, red for Partial). The bars are about 32 slim bars, divided between laps by duration. Hard laps glow in the accent colour unless the effort was steady (speeds within 10%), in which case every bar lights. A progress line shows the share of time in hard laps, followed by a summary with highlighted numbers and a `TriSync · <plan week>` footer. `ActivityGraphicModal` previews the SVG and saves it: on web it draws it to a canvas and downloads a PNG; on native it uses `react-native-view-shot` and `expo-sharing` (untested). Strava's public API can't attach photos (partner apps only), so the user uploads the image to Strava manually.
- `src/components/DashboardHeaderMenu.js` is unused. It is a leftover light/dark toggle.

## Conventions and gotchas

- **Dates:** dates are stored and compared as ISO `YYYY-MM-DD` strings (string comparison is used for ordering, e.g. in `statusFor`). User input and display use `DD-MM-YYYY`; convert with `displayToIso` and `isoToDisplay`. Helpers parse with a `T00:00:00` suffix (local midnight) and format back with `toIsoDate()`, which uses the local time zone. Never use `toISOString().slice(0, 10)`: it is UTC and shifts the date by a day in many time zones.
- **Workout status:** the stored `status` is `'pending' | 'done' | 'partial'`. The displayed status comes from `statusFor(workout, today)`, which turns pending workouts into `'missed'` (past) or `'upcoming'`. In the calendar, a day with several workouts shows the worst status, ranked by `STATUS_PRIORITY`.
- **Styling:** styling mixes Tamagui layout primitives (`YStack`, `XStack`, `Card`, `Paragraph`, shorthand props like `f`, `p`, `jc`, `ai`, `$` tokens) with RN `Text`/`Pressable` and inline styles that use the tokens from `trainingUtils`. Popovers come from `@tamagui/popover`. Icons come from `@expo/vector-icons` (Ionicons).
- **Strava token requests** must be form-encoded, because `oauth/token` doesn't answer CORS preflights; a JSON body fails in the browser.
- **Babel:** `babel.config.js` runs the Tamagui babel plugin and `react-native-reanimated/plugin`; the reanimated plugin must stay last.
