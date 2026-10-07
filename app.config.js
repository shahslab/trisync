// Extends app.json. EXPO_BASE_URL is set only by the GitHub Pages workflow, where the
// site is served from /trisync/; local development keeps serving from the root.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : null),
  },
})
