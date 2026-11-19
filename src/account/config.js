// The PocketBase server that holds TriSync accounts (no trailing slash): the `trisync-pb`
// Fly.io app, built from pocketbase/ in this repo. It isn't a secret: every copy of the app talks to it in the open.
// While it's empty, accounts are switched off and the app keeps its data on the device only,
// as before. For local testing, run `pocketbase serve` and use 'http://127.0.0.1:8090'.
export const POCKETBASE_URL = 'https://trisync-pb.fly.dev'

export const accountsEnabled = !!POCKETBASE_URL
