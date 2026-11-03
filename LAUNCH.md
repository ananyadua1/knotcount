# KnotCount launch guide

Everything here was checked on 3 Nov 2026 unless it says "you must".

## 1. What has been verified

| Check | Result |
|---|---|
| Android bundle export | Passes |
| Server tests on a real Postgres (smoke + regression) | Pass. Rerun any time: `cd server/tools/local-test && npm install && npm test` (needs no Postgres install) |
| App store tests | Pass: `cd app && node test/store.cjs` |
| `npm audit`, app and server | 0 vulnerabilities |
| `expo install --check` (online) | "Dependencies are up to date" |
| Live `/health`, `/privacy`, `/delete-account` | All answer HTTP 200 |
| Database upgrade from the live schema | Existing accounts and guests kept, several weddings per account allowed |
| Load (25 guests at once, 10 s, real server + Postgres on a laptop) | 911 requests/second, 0 errors, slowest 5% under 72 ms |
| Backup, then restore into an empty database | Every row identical; new records still get fresh ids; refuses to restore over a database that has accounts |
| Email: sign-up code sent through the live server | Accepted by Google's script (the code arrives from `domaincraftstudios@gmail.com`). Confirm it reached the inbox |
| Signed release build (`production` profile, `.aab`) | See the build log link in the hand-off message |

Not verifiable from a computer, so you must do them: the device test in section 6, the Play Console steps in section 7, and checking the test email arrived.

## 2. Settings the live server needs

On Render > knotcount-server > Environment. The server **refuses to start** without the first five (that is deliberate: it will not run half-configured).

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` | 32+ random characters (the Blueprint generates one) |
| `PUBLIC_URL` | `https://knotcount-server.onrender.com` |
| `MAIL_WEBHOOK_URL` | Web app URL of your Google script (`server/mail-relay.gs`, steps in `DEPLOY.md`) |
| `MAIL_WEBHOOK_SECRET` | Same string as `SECRET` in that script |
| `SUPPORT_EMAIL` | `domaincraftstudios@gmail.com` |
| `MAIL_DAILY_LIMIT` | `90` (a free Gmail script sends about 100 a day) |

**Free plan or paid?** `render.yaml` now says `plan: starter` (about $7 a month). The free plan sleeps after 15 minutes idle, so the first guest to open a link can wait about 30 seconds, and Render's free plan can be stopped without notice. For a real wedding, the paid plan is the safe choice. If you prefer free, change that line back to `plan: free` and use the uptime monitor in section 4 as a keep-awake ping.

## 3. Deploying and rolling back

Render does not always deploy on its own. After every push: Render > knotcount-server > **Manual Deploy > Deploy latest commit**, wait for **Live**, then open `/health`.

If a deploy breaks something: Render > **Events** (or **Deploys**), find the last good deploy, **Rollback**. The database changes so far only add columns and tables (or relax a rule), so an older version of the server should keep working against the newer database. Take a backup before any rollback anyway.

## 4. Monitoring

1. Make a free account at https://uptimerobot.com and add an **HTTP(s)** monitor for `https://knotcount-server.onrender.com/health`, every 5 minutes, alerting your email. `/health` also checks the database, so it catches a dead database too.
2. Render > Account > **Notifications**: turn on deploy-failed and service-unhealthy emails.
3. Errors are written to Render's **Logs** tab; email failures say `mail failed:`.
4. Email is capped by `MAIL_DAILY_LIMIT`. Once the day's cap is used up, further emails are refused until the next day (reminders stop 20 short of the cap so sign-up and reset codes still get through). If people say codes are not arriving late in the day, look for that in the Logs.

## 5. Backups

Neon keeps only a short history on the free plan (check the number on your Neon dashboard), so keep your own copies.

```
cd server
set DATABASE_URL=<your Neon connection string>      (PowerShell: $env:DATABASE_URL="...")
node tools/backup.mjs C:\KnotCountBackups
```

That writes one JSON file with every account, wedding and guest. It contains personal data and password hashes: store it somewhere private, never in git. Take one **before the invitations go out, the day before the wedding, and weekly in between**.

To restore into a new, empty Neon database:

```
set DATABASE_URL=<the NEW database's connection string>
node tools/restore.mjs C:\KnotCountBackups\knotcount-backup-....json
```

Then point `DATABASE_URL` on Render at the new database and redeploy. The restore script refuses to run on a database that already has accounts.

## 6. Test on a real phone before you announce it

Install the latest build and go through this once. About 20 minutes.

1. Create an account with a new email. A 6-digit code arrives (check spam). Enter it.
2. Sign out and in. Try "Forgot password?" and finish a reset.
3. Profile > Add a wedding. Switch between two weddings. Each keeps its own guests.
4. Invitations: fill in the details, try each colour and "My colour", try each message, then "My own".
5. Guests > Add guests > Import from contacts: allow the permission, import two people.
6. Send an invitation to yourself on WhatsApp. Open the link on another phone. Reply with 3 guests, 1 veg and 2 non-veg. Check you cannot go above the invited seats.
7. Back in the app the reply appears within about 10 seconds. Open "Total guests" and check the numbers.
8. Turn on aeroplane mode: the app should say it is offline rather than crash.
9. Profile > Delete account, then confirm the account is gone (the same email can sign up again).

## 7. Google Play Console

You need a Google Play developer account (one-time fee, paid to Google). Then:

| Item | What to enter |
|---|---|
| App name / package | KnotCount / `com.knotcount.app` |
| Privacy policy URL | `https://knotcount-server.onrender.com/privacy` |
| Account deletion URL | `https://knotcount-server.onrender.com/delete-account` (and it is in the app: Profile > Delete account) |
| App access | The app needs an account. Make a test account and give Google its email and password |
| Ads | No |
| Content rating | Complete the questionnaire: no violence, no user-to-user chat, no location, no purchases. Expect "Everyone" |
| Target audience | 18 and over (not for children) |
| Permission | `READ_CONTACTS`: used only when the host taps Import, to copy chosen names and numbers into the guest list. Say exactly that in the permission declaration |
| Target API | 36 (checked in the project's Android configuration) |

**Data safety form** (answers match what the code does):

| Data | Collected | Why | Shared with others |
|---|---|---|---|
| Name, email address | Yes | Account, sign-in, emails you ask for | No |
| Phone numbers, names of guests; contacts you choose to import | Yes (what the host types or selects) | The guest list | No |
| Guest replies (attending, headcount, meal, arrival time, note) | Yes | The guest list | No |
| Location, photos, files, financial info, device ID, ads/analytics | No | | |

Also: data is encrypted in transit (HTTPS); users can ask for deletion (in app and on the web page above); no advertising or analytics SDKs. Render (hosting), Neon (database) and Google (the email script) process data for you as service providers.

**Release steps**
1. Upload the `.aab` from the `production` build to **Testing > Internal testing**.
2. Install from the internal link on a real phone and repeat section 6.
3. New personal developer accounts must run a **closed test with enough testers for 14 days** before production access; Play Console shows the current number and rule on the Production page.
4. Store listing needs: icon 512x512, feature graphic 1024x500, at least 2 phone screenshots, a short description (80 characters) and a full description. Suggested short line: "Send wedding invitations and see who is coming, live."

`eas submit -p android --profile production` can upload the build once you have created the app in Play Console and added a Google service-account key (Play Console > Setup > API access).

## 8. Known limits

- Reminders and verification emails share about 100 messages a day through a free Gmail. A very large guest list reminded on the same day can hit the cap; the cap reserves room for sign-up and reset codes first.
- WhatsApp invitations are sent by tapping Send for each guest; WhatsApp does not allow sending on your behalf without its paid business service.
- The load figures above came from a laptop. A hosted server will differ, so watch the first busy day.
