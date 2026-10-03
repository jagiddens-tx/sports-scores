// Cloudflare Worker: serves the app's static files and sends score
// notifications. A cron trigger polls ESPN every minute for teams that have
// push subscribers; a single Durable Object stores subscriptions, the last
// seen state of each game, and the VAPID keys (generated on first use).
import { DurableObject } from 'cloudflare:workers'
import { ESPN_API, competitionSlugs, fetchScoreboard } from '../src/espn'
import type { Game } from '../src/types'
import { alertFor, snapshot, type GameSnapshot } from './alerts'
import { generateVapidKeys, sendPush, type PushSubscriptionJSON, type VapidKeys } from './webpush'

interface Env {
  ASSETS: Fetcher
  PUSH_HUB: DurableObjectNamespace<PushHub>
  // Local testing only: point ESPN requests at a mock server and accept any push endpoint
  TEST_ESPN_API?: string
}

interface FollowedTeam {
  id: string
  sport: string
}

// Push services we'll deliver to; anything else is rejected so the Worker
// can't be used to send requests to arbitrary URLs.
const PUSH_SERVICE_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.mozilla\.com$/, /\.notify\.windows\.com$/]

const STATE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function hub(env: Env) {
  return env.PUSH_HUB.get(env.PUSH_HUB.idFromName('hub'))
}

/** Local testing hook: send ESPN API requests to a mock server */
function routeEspnToTestServer(env: Env) {
  const base = env.TEST_ESPN_API
  if (!base) return
  const realFetch = globalThis.fetch
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    return realFetch(url.startsWith(ESPN_API) ? base + url.slice(ESPN_API.length) : input, init)
  }) as typeof fetch
}

function parseSubscribeBody(body: unknown, allowAnyEndpoint: boolean) {
  const { subscription, teams } = (body || {}) as { subscription?: PushSubscriptionJSON; teams?: FollowedTeam[] }
  if (
    typeof subscription?.endpoint !== 'string' ||
    typeof subscription.keys?.p256dh !== 'string' ||
    typeof subscription.keys?.auth !== 'string' ||
    !Array.isArray(teams) || teams.length > 200 ||
    !teams.every(t => typeof t?.id === 'string' && typeof t?.sport === 'string')
  ) {
    return null
  }
  let url: URL
  try {
    url = new URL(subscription.endpoint)
  } catch {
    return null
  }
  if (!allowAnyEndpoint && (url.protocol !== 'https:' || !PUSH_SERVICE_HOSTS.some(host => host.test(url.hostname)))) {
    return null
  }
  return {
    subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
    teams: teams.map(t => ({ id: t.id, sport: t.sport })),
  }
}

export class PushHub extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    routeEspnToTestServer(env)
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
        endpoint TEXT PRIMARY KEY, keys TEXT NOT NULL, teams TEXT NOT NULL)`)
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY, snapshot TEXT NOT NULL, updated INTEGER NOT NULL)`)
    })
  }

  async vapidPublicKey() {
    return (await this.vapidKeys()).publicKey
  }

  private async vapidKeys(): Promise<VapidKeys> {
    let keys = await this.ctx.storage.get<VapidKeys>('vapid')
    if (!keys) {
      keys = await generateVapidKeys()
      await this.ctx.storage.put('vapid', keys)
    }
    return keys
  }

  async subscribe(subscription: PushSubscriptionJSON, teams: FollowedTeam[], origin: string) {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO subscriptions (endpoint, keys, teams) VALUES (?, ?, ?)',
      subscription.endpoint, JSON.stringify(subscription.keys), JSON.stringify(teams),
    )
    // VAPID "subject": who the push services can contact about our messages
    await this.ctx.storage.put('subject', origin)
  }

  async unsubscribe(endpoint: string) {
    this.ctx.storage.sql.exec('DELETE FROM subscriptions WHERE endpoint = ?', endpoint)
  }

  /** Called by the cron trigger: check followed teams' games and notify on changes */
  async poll() {
    const subscribers = this.ctx.storage.sql
      .exec<{ endpoint: string; keys: string; teams: string }>('SELECT endpoint, keys, teams FROM subscriptions')
      .toArray()
      .map(row => ({
        subscription: { endpoint: row.endpoint, keys: JSON.parse(row.keys) } as PushSubscriptionJSON,
        teams: new Set((JSON.parse(row.teams) as FollowedTeam[]).map(t => `${t.sport}:${t.id}`)),
      }))
    if (subscribers.length === 0) return { subscribers: 0, alerts: 0 }

    const followed = new Set(subscribers.flatMap(s => [...s.teams]))
    const sports = new Set([...followed].map(key => key.split(':')[0]))

    // Fetch every competition the followed teams play in
    const requests = [...sports].flatMap(sport =>
      competitionSlugs(sport).map(slug => fetchScoreboard(slug).then(games => games.map(game => ({ game, sport })))),
    )
    const results = await Promise.allSettled(requests)
    const games = new Map<string, { game: Game; sport: string }>()
    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      for (const entry of result.value) {
        const { game, sport } = entry
        if (followed.has(`${sport}:${game.homeTeam.id}`) || followed.has(`${sport}:${game.awayTeam.id}`)) {
          games.set(game.id, entry)
        }
      }
    }

    const now = Date.now()
    const vapid = await this.vapidKeys()
    const subject = (await this.ctx.storage.get<string>('subject')) || 'https://example.com'
    const gone = new Set<string>()
    let alerts = 0

    for (const { game, sport } of games.values()) {
      const row = this.ctx.storage.sql
        .exec<{ snapshot: string }>('SELECT snapshot FROM games WHERE id = ?', game.id)
        .toArray()[0]
      const previous = row ? (JSON.parse(row.snapshot) as GameSnapshot) : undefined
      this.ctx.storage.sql.exec(
        'INSERT OR REPLACE INTO games (id, snapshot, updated) VALUES (?, ?, ?)',
        game.id, JSON.stringify(snapshot(game)), now,
      )

      const alert = alertFor(previous, game)
      if (!alert) continue
      alerts++

      const payload = JSON.stringify({ ...alert, url: '/' })
      const recipients = subscribers.filter(s =>
        s.teams.has(`${sport}:${game.homeTeam.id}`) || s.teams.has(`${sport}:${game.awayTeam.id}`))
      await Promise.all(recipients.map(async ({ subscription }) => {
        try {
          const status = await sendPush(subscription, payload, { vapid, subject, topic: alert.tag, ttl: 1800 })
          // The subscription expired or the user turned notifications off
          if (status === 404 || status === 410) gone.add(subscription.endpoint)
        } catch (err) {
          console.error('Push failed', err)
        }
      }))
    }

    for (const endpoint of gone) await this.unsubscribe(endpoint)
    this.ctx.storage.sql.exec('DELETE FROM games WHERE updated < ?', now - STATE_RETENTION_MS)
    return { subscribers: subscribers.length, alerts }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/push/public-key' && request.method === 'GET') {
      return json({ publicKey: await hub(env).vapidPublicKey() })
    }

    if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
      const parsed = parseSubscribeBody(await request.json().catch(() => null), Boolean(env.TEST_ESPN_API))
      if (!parsed) return json({ error: 'Invalid subscription' }, 400)
      await hub(env).subscribe(parsed.subscription, parsed.teams, url.origin)
      return json({ ok: true })
    }

    if (url.pathname === '/api/push/unsubscribe' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null
      if (typeof body?.endpoint !== 'string') return json({ error: 'Invalid request' }, 400)
      await hub(env).unsubscribe(body.endpoint)
      return json({ ok: true })
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404)

    return env.ASSETS.fetch(request)
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(hub(env).poll().then(result => console.log('poll', JSON.stringify(result))))
  },
} satisfies ExportedHandler<Env>
