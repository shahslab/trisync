/// <reference path="../pb_data/types.d.ts" />

// TriSync signs people in with a one-time code emailed to them, not a password.
// Accounts are created with a random password the user never sees (PocketBase requires one).
// Superusers are a separate collection and keep signing in with their password.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.otp.enabled = true
  users.otp.length = 6
  users.otp.duration = 600 // seconds
  users.passwordAuth.enabled = false
  users.otp.emailTemplate.subject = 'Your TriSync sign-in code'
  users.otp.emailTemplate.body = `<p>Hello,</p>
<p>Your TriSync sign-in code is:</p>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">{OTP}</p>
<p>It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
<p>TriSync</p>`
  app.save(users)

  const settings = app.settings()
  settings.meta.appName = 'TriSync'
  settings.meta.appURL = 'https://trisync-pb.fly.dev'
  settings.meta.senderName = 'TriSync'
  app.save(settings)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  users.otp.enabled = false
  users.passwordAuth.enabled = true
  app.save(users)
})
