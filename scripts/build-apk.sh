#!/usr/bin/env bash
# Builds a signed release APK: dist-native/TriSync-<version>.apk
#
# Signing uses a private key kept outside the repo, described by a properties file
# (storeFile, storePassword, keyAlias, keyPassword), by default
# ~/.config/trisync/android-signing.properties. Keep a backup of that file and its .jks:
# Android only installs an update signed with the same key as the installed app.
# Needs the Android SDK (ANDROID_HOME) and JDK 17+.
set -euo pipefail
cd "$(dirname "$0")/.."

SIGNING="${TRISYNC_SIGNING:-$HOME/.config/trisync/android-signing.properties}"
[ -f "$SIGNING" ] || { echo "Missing signing properties: $SIGNING" >&2; exit 1; }

# android/ is generated from app.json (and git-ignored), so start clean each time
npx expo prebuild -p android --clean --no-install
git checkout -- package.json 2>/dev/null || true # prebuild rewrites the run scripts

# Sign release builds with the TriSync key instead of the template's debug key
python3 - android/app/build.gradle "$SIGNING" <<'PY'
import sys
path, signing = sys.argv[1], sys.argv[2]
s = open(path).read()
release_config = f"""    signingConfigs {{
        release {{
            def props = new Properties()
            file('{signing}').withInputStream {{ props.load(it) }}
            storeFile file(props['storeFile'])
            storePassword props['storePassword']
            keyAlias props['keyAlias']
            keyPassword props['keyPassword']
        }}
"""
assert s.count('    signingConfigs {\n') == 1
s = s.replace('    signingConfigs {\n', release_config, 1)
head, sep, tail = s.partition('        release {\n            // Caution!')
assert sep, 'release build type not found'
tail = tail.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release', 1)
open(path, 'w').write(head + sep + tail)
PY

(cd android && ./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64)

VERSION=$(node -p "require('./app.json').expo.version")
mkdir -p dist-native
cp android/app/build/outputs/apk/release/app-release.apk "dist-native/TriSync-$VERSION.apk"
echo "Built dist-native/TriSync-$VERSION.apk"
