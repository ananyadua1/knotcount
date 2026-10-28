# KnotCount

Wedding guest manager. Guests reply from a personal link on their own phone; the host sees every reply live in the app.

```
app/      Android app for the couple (Expo / React Native)
server/   Node.js + Express API, Postgres database, and the guest RSVP web page
```

## How it works
1. You sign in to the app and add guests (or import from contacts).
2. Each guest gets a private link like `https://your-server/r/Xk3...`. Send it from the app over WhatsApp, or by email.
3. The guest opens the link in any browser (no app, no login) and answers: yes/no, how many, food, arrival time.
4. The server saves it in Postgres. Your dashboard, totals and caterer count update within seconds.

## Run everything on your computer (to try it)
You need Node.js 20+ and Postgres.
```
cd server
npm install
createdb knotcount
DATABASE_URL=postgres://localhost/knotcount npm start      # http://localhost:3000
npm test                                                     # optional: end-to-end checks

cd ../app
npm install
EXPO_PUBLIC_API_URL=http://YOUR-COMPUTER-IP:3000 npx expo start
```
Scan the QR code with Expo Go. On the sign-in screen you can also change the server address under "Server".

## Put it online for free
See `DEPLOY.md`. Short version: Neon (free Postgres) + Render (free Node host) + Expo EAS (free APK build).
