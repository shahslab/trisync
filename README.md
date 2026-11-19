# TriSync

A free triathlon training planner that syncs with Strava. Plan your weeks up to race day, then mark a workout Done or Partial. TriSync finds the matching Strava activity (for example, one your watch uploaded) and updates its title and description with your plan. It can also make a shareable lap-chart graphic of the activity.

- **Sign in with your email.** TriSync emails you a 6-digit code; there's no password. Your plans, workouts and settings sync to your account, so they're the same on your phone and laptop, and the app still opens offline.
- **You use your own Strava API app.** Its keys are saved to your account. Your Strava login stays on each device.

## Install on your phone

Open **https://trisync.fly.dev** and add it to your home screen:

- **Android (Chrome):** tap **Install app**, or ⋮ → **Install app**.
- **iPhone (Safari):** tap **Share** → **Add to Home Screen**.

It opens full-screen like a normal app and updates automatically. Sign in, then follow [Connect Strava](#connect-strava), using `trisync.fly.dev` as the callback domain. On iPhone, connect Strava from inside the installed app.

TriSync used to live at shahslab.github.io/trisync; that address now forwards here. If your Strava app's callback domain is still `shahslab.github.io`, change it to `trisync.fly.dev`.

## Run it yourself

You need a current LTS version of [Node.js](https://nodejs.org).

```bash
git clone https://github.com/shahslab/trisync.git
cd trisync
npm install
npm run web
```

Then open http://localhost:8081.

`npm start` runs the Expo dev server for phones, using [Expo Go](https://expo.dev/go). Strava login on phones is untested; web is the supported way to use it.

## Connect Strava

1. Go to https://www.strava.com/settings/api and create an app. Any name, website and icon will do.
2. Set **Authorization Callback Domain** to the domain you use TriSync on: `trisync.fly.dev` for the installed app, or `localhost` when running it yourself. TriSync shows the exact value in Settings.
3. In TriSync, open **☰ → Settings → Strava**, paste the app's **Client ID** and **Client Secret**, and press **Save keys**.
4. Press **Connect Strava** and approve access. Keep both permission boxes ticked: TriSync needs to view your activities and edit their title and description.

A new Strava API app can be used by one athlete, its owner. That's all TriSync needs, because everyone connects through their own app.

## How syncing works

- **Matching:** when you mark a workout Done or Partial, TriSync looks for a Strava activity on the same day with a matching sport (Run → Run, Bike → Ride, and so on). If there are none or several, it asks you to pick one.
- **Title and description:** the activity is renamed to `TriSync: <your workout title>`, and its description is set to your workout notes.
- **Bricks:** add two Brick workouts on the same day, one per leg. When you mark each one, TriSync asks which activity it was, then labels them `Brick Part 1` and `Brick Part 2` in the order you did them on Strava. The legs' notes start with the same label, so you see what Strava will show.
- **Graphic:** a synced workout can make a lap-chart image you can download. You add it to the Strava post yourself, because Strava doesn't let apps attach photos.

## Training plans

When you create a plan, **Available Plans** lets you start from a free triathlon plan: Sprint, Olympic, 70.3 or 140.6, at Beginner, Intermediate or Advanced level, over 8 or 12 weeks. TriSync places the plan so it finishes on your race day.

## Hosting

The web app runs on [Fly.io](https://fly.io) as a small nginx container (`Dockerfile`, `nginx.conf`, `fly.toml`), deployed by `.github/workflows/deploy-fly.yml` on every push to `master` (it needs a `FLY_API_TOKEN` repository secret), or by hand with `fly deploy`. The account server is PocketBase in `pocketbase/` (`cd pocketbase && fly deploy --ha=false`); its address is in `src/account/config.js`, and an empty address switches accounts off. GitHub Pages only serves a redirect to the new address (`redirect/`).
