// Everything that talks to ESPN's public site API lives here so the app and
// the notification worker read games the same way.
import type { Game, Team } from './types'

export const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports'

export interface League {
  id: string
  name: string      // short label, e.g. "CFB"
  fullName: string  // e.g. "College Football"
  espnSlug: string
  hasDetails: boolean  // supports the expanded game detail view
}

export const LEAGUES: League[] = [
  { id: 'epl', name: 'EPL', fullName: 'Premier League', espnSlug: 'soccer/eng.1', hasDetails: true },
  { id: 'ncaaf', name: 'CFB', fullName: 'College Football', espnSlug: 'football/college-football', hasDetails: true },
  { id: 'nfl', name: 'NFL', fullName: 'NFL', espnSlug: 'football/nfl', hasDetails: true },
  { id: 'nba', name: 'NBA', fullName: 'NBA', espnSlug: 'basketball/nba', hasDetails: false },
  { id: 'mlb', name: 'MLB', fullName: 'MLB', espnSlug: 'baseball/mlb', hasDetails: false },
  { id: 'nhl', name: 'NHL', fullName: 'NHL', espnSlug: 'hockey/nhl', hasDetails: false },
  { id: 'ncaab', name: 'CBB', fullName: 'College Basketball', espnSlug: 'basketball/mens-college-basketball', hasDetails: false },
]

export const LEAGUES_BY_ID: Record<string, League> = Object.fromEntries(LEAGUES.map(l => [l.id, l]))

// Cup competitions to also check for a league's teams
const EXTRA_COMPETITIONS: Record<string, string[]> = {
  epl: [
    'soccer/eng.fa',         // FA Cup
    'soccer/eng.league_cup', // Carabao Cup
    'soccer/uefa.champions', // Champions League
    'soccer/uefa.europa',    // Europa League
  ],
}

/** Every scoreboard slug to check for a league's teams */
export function competitionSlugs(leagueId: string): string[] {
  const league = LEAGUES_BY_ID[leagueId]
  if (!league) return []
  return [league.espnSlug, ...(EXTRA_COMPETITIONS[leagueId] || [])]
}

// ESPN only returns Top 25 games/teams for college sports unless a division
// group is requested: 80 = FBS football, 50 = Division I men's basketball.
const COLLEGE_GROUPS: Record<string, string> = {
  'football/college-football': '80',
  'basketball/mens-college-basketball': '50',
}

export function scoreboardUrl(slug: string) {
  const group = COLLEGE_GROUPS[slug]
  return group
    ? `${ESPN_API}/${slug}/scoreboard?groups=${group}&limit=500`
    : `${ESPN_API}/${slug}/scoreboard`
}

export function teamsUrl(slug: string) {
  const group = COLLEGE_GROUPS[slug]
  // College leagues have well over 100 teams, so don't let the list get cut off
  return group
    ? `${ESPN_API}/${slug}/teams?groups=${group}&limit=1000`
    : `${ESPN_API}/${slug}/teams?limit=1000`
}

export function summaryUrl(slug: string, eventId: string) {
  return `${ESPN_API}/${slug}/summary?event=${eventId}`
}

/**
 * ESPN logos are 500px PNGs; ask ESPN's image resizer for one at the size we
 * actually draw (2x for retina). Non-ESPN URLs are returned unchanged.
 */
export function resizedLogo(url: string, displaySize: number) {
  const match = url.match(/^https:\/\/a\.espncdn\.com(\/i\/[^?]+\.png)$/)
  if (!match) return url
  const px = displaySize * 2
  return `https://a.espncdn.com/combiner/i?img=${match[1]}&w=${px}&h=${px}`
}

// --- Raw ESPN response shapes (only the fields we read) ---

export interface EspnTeam {
  id: string
  displayName?: string
  abbreviation?: string
  logo?: string
  logos?: { href: string }[]
}

export interface EspnStatistic {
  name: string
  displayValue: string
}

export interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score?: string
  team?: EspnTeam
  statistics?: EspnStatistic[]
}

export interface EspnAthlete {
  displayName?: string
  headshot?: string
  position?: string
}

export interface EspnDetail {
  type?: { text?: string }
  clock?: { displayValue?: string }
  team?: { id?: string }
  scoringPlay?: boolean
  yellowCard?: boolean
  redCard?: boolean
  ownGoal?: boolean
  penaltyKick?: boolean
  athletesInvolved?: EspnAthlete[]
}

export interface EspnCompetition {
  competitors?: EspnCompetitor[]
  venue?: { fullName?: string }
  broadcasts?: { names?: string[] }[]
  details?: EspnDetail[]
  attendance?: number
}

export interface EspnEvent {
  id: string
  date: string
  status?: { type?: { state?: Game['status']; shortDetail?: string } }
  competitions?: EspnCompetition[]
}

export interface EspnScoreboard {
  events?: EspnEvent[]
}

export interface EspnTeamsResponse {
  sports?: { leagues?: { teams?: { team: EspnTeam }[] }[] }[]
}

export interface EspnScoringPlay {
  period?: { number?: number }
  clock?: { displayValue?: string }
  team?: { id?: string; logo?: string }
  type?: { abbreviation?: string; text?: string }
  text?: string
  homeScore?: number
  awayScore?: number
}

export interface EspnRoster {
  homeAway: 'home' | 'away'
  formation?: string
  team?: EspnTeam
  roster?: {
    jersey?: string
    starter?: boolean
    athlete?: { displayName?: string }
    position?: { displayName?: string; abbreviation?: string }
  }[]
}

export interface EspnSummary {
  boxscore?: { teams?: { homeAway: 'home' | 'away'; statistics?: EspnStatistic[] }[] }
  scoringPlays?: EspnScoringPlay[]
  gameInfo?: { attendance?: number }
  rosters?: EspnRoster[]
}

// --- Parsing ---

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN request failed (HTTP ${res.status})`)
  return res.json() as Promise<T>
}

function parseTeam(competitor: EspnCompetitor | undefined): Team {
  const team = competitor?.team
  return {
    id: team?.id || '',
    name: team?.displayName || 'TBD',
    abbreviation: team?.abbreviation || '',
    logo: team?.logo || '',
    score: parseInt(competitor?.score || '0', 10),
  }
}

export function findCompetitor(competition: EspnCompetition | undefined, side: 'home' | 'away') {
  return competition?.competitors?.find(c => c.homeAway === side)
}

export function parseGame(event: EspnEvent): Game {
  const competition = event.competitions?.[0]
  return {
    id: event.id,
    status: event.status?.type?.state || 'pre',
    statusDetail: event.status?.type?.shortDetail || '',
    startTime: event.date,
    homeTeam: parseTeam(findCompetitor(competition, 'home')),
    awayTeam: parseTeam(findCompetitor(competition, 'away')),
    venue: competition?.venue?.fullName,
    broadcast: competition?.broadcasts?.[0]?.names?.[0],
  }
}

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000

/** ESPN can return a long window of games; drop finished ones older than 48 hours */
export function isRecent(game: Game, now = Date.now()) {
  if (game.status !== 'post') return true
  return now - new Date(game.startTime).getTime() < FORTY_EIGHT_HOURS
}

export async function fetchScoreboard(slug: string): Promise<Game[]> {
  const data = await fetchJson<EspnScoreboard>(scoreboardUrl(slug))
  return (data.events || []).map(parseGame).filter(game => isRecent(game))
}

export async function fetchTeams(slug: string) {
  const data = await fetchJson<EspnTeamsResponse>(teamsUrl(slug))
  const teams = data.sports?.[0]?.leagues?.[0]?.teams || []
  return teams.map(({ team }) => ({
    id: team.id,
    name: team.displayName || '',
    abbreviation: team.abbreviation || '',
    logo: team.logos?.[0]?.href || '',
  }))
}

const STATUS_ORDER = { in: 0, pre: 1, post: 2 }

/** Live first, then upcoming (soonest first), then final (most recent first) */
export function compareGames(a: Game, b: Game) {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  if (byStatus !== 0) return byStatus
  const timeDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  return a.status === 'post' ? -timeDiff : timeDiff
}
