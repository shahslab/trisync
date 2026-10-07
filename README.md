# TriSync

A free triathlon training planner that syncs with Strava. Plan your weeks up to race day, then mark a workout Done or Partial. TriSync finds the matching Strava activity (for example, one your watch uploaded) and updates its title and description with your plan. It can also make a shareable lap-chart graphic of the activity.

Every copy of TriSync is its own private instance:

- **You use your own Strava API app.** Its keys are entered in the app and stored only on your device.
- **Your plan, workouts and Strava login stay on your device.** On web that means your browser's local storage. There's no TriSync server.

## Install on your phone

Open **https://shahshachi1.github.io/trisync/** and add it to your home screen:

- **Android (Chrome):** tap **Install app**, or ⋮ → **Install app**.
- **iPhone (Safari):** tap **Share** → **Add to Home Screen**.

It opens full-screen like a normal app and updates automatically. Then follow [Connect Strava](#connect-strava), using `shahshachi1.github.io` as the callback domain. On iPhone, the home-screen app keeps its own storage, separate from Safari, so set up Strava from inside the installed app.

## Run it yourself

You need a current LTS version of [Node.js](https://nodejs.org).

```bash
git clone https://github.com/shahshachi1/trisync.git
cd trisync
npm install
npm run web
```

Then open http://localhost:8081.

`npm start` runs the Expo dev server for phones, using [Expo Go](https://expo.dev/go). Strava login on phones is untested; web is the supported way to use it.

## Connect Strava

1. Go to https://www.strava.com/settings/api and create an app. Any name, website and icon will do.
2. Set **Authorization Callback Domain** to the domain you use TriSync on: `shahshachi1.github.io` for the installed app, or `localhost` when running it yourself. TriSync shows the exact value in Settings.
3. In TriSync, open **☰ → Settings → Strava**, paste the app's **Client ID** and **Client Secret**, and press **Save keys**.
4. Press **Connect Strava** and approve access. Keep both permission boxes ticked: TriSync needs to view your activities and edit their title and description.

A new Strava API app can be used by one athlete, its owner. That's all TriSync needs, because everyone connects through their own app.

## How syncing works

- **Matching:** when you mark a workout Done or Partial, TriSync looks for a Strava activity on the same day with a matching sport (Run → Run, Bike → Ride, and so on). If there are none or several, it asks you to pick one.
- **Title and description:** the activity is renamed to `TriSync: <your workout title>`, and its description is set to your workout notes.
- **Bricks:** add two Brick workouts on the same day, one per leg. They're labelled `Brick Part 1` and `Brick Part 2` in their descriptions.
- **Graphic:** a synced workout can make a lap-chart image you can download. You add it to the Strava post yourself, because Strava doesn't let apps attach photos.

## Hosting your own copy

Fork the repo, then in your fork go to **Settings → Pages** and set **Source** to **GitHub Actions**. Every push to `master` then publishes the app at `https://<you>.github.io/<repo>/`, using `.github/workflows/deploy-web.yml`. No secrets are involved: visitors enter their own Strava keys in the app, and nothing about your Strava account is shared with them.
