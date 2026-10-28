# Deploy for free

You need a GitHub account. Total time: about 20 minutes.

## 1. Database (Neon)
1. Sign up at neon.tech and create a project.
2. Copy the connection string (starts with `postgres://`). Keep it.

## 2. Server (Render)
1. Push this folder to a GitHub repository.
2. On render.com choose New > Blueprint and pick the repository. It reads `render.yaml`.
3. When asked, set:
   - `DATABASE_URL` = the Neon connection string
   - `PUBLIC_URL` = the address Render gives you, e.g. `https://knotcount-server.onrender.com` (you can set this after the first deploy and redeploy)
4. Open `https://YOUR-SERVER/health`. It should answer `{"ok":true}`. Tables are created automatically on first start.

Note: the free Render plan sleeps after 15 minutes without traffic, so the first request after a quiet spell takes ~30 seconds. A guest opening their link may wait that long once. Upgrade the plan before the invitations go out, or use a free uptime pinger on `/health`.

## 3. Android app
1. In `app/`, create `.env` containing `EXPO_PUBLIC_API_URL=https://YOUR-SERVER`.
2. Build an installable APK (free Expo account):
   ```
   npm install -g eas-cli
   eas login
   eas build -p android --profile preview
   ```
   EAS gives you a download link for the `.apk`.

## 4. Optional: email reminders
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` on Render (Brevo's free plan or a Gmail app password both work). The app then shows "Email all pending" and a switch for automatic reminders every 3 days (job runs daily at 10:00 IST).

## What stays manual
WhatsApp does not let any app send messages on your behalf without the paid WhatsApp Business API. The app opens each message ready-typed with the guest's link; you tap send. Everything after that (the guest's reply, totals, caterer count) is automatic.
