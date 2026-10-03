# Live Scores

A small PWA for following your teams' scores (EPL, college football, NFL, NBA,
MLB, NHL, college basketball), built with React + Vite and deployed to
Cloudflare Workers. Scores come from ESPN's public site API.

## How it fits together

- `src/espn.ts` – leagues, ESPN URLs, and typed parsing shared by the app and the worker
- `src/` – the React app; last-known scores are kept in localStorage so it opens instantly
- `public/sw.js` – service worker: offline app shell, logo cache, push notifications
- `worker/` – Cloudflare Worker: serves the app, stores push subscriptions in a
  Durable Object, and polls ESPN every minute (cron) to send score alerts

## Score alerts

Tap **Alerts** on My Teams to get a notification when a followed team's game
starts, on every score, and at the final (one notification per game, updated in
place). On iPhone this needs iOS 16.4+ and the app added to the Home Screen.

No setup is needed: the worker generates its VAPID keys on first use and
stores them in the Durable Object.

## Development

```sh
npm install
npm run dev        # app only (no /api)
npm run build && npx wrangler dev   # app + worker locally
npm run lint
```

Pushing to `main` deploys via GitHub Actions (`.github/workflows/deploy.yml`).
