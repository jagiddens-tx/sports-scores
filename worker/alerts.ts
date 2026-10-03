import type { Game } from '../src/types'

/** What we remember about a game between polls */
export interface GameSnapshot {
  status: Game['status']
  homeScore: number
  awayScore: number
}

export interface Alert {
  title: string
  body: string
  tag: string  // one notification per game; each alert replaces the last
}

export function snapshot(game: Game): GameSnapshot {
  return { status: game.status, homeScore: game.homeTeam.score, awayScore: game.awayTeam.score }
}

function scoreLine(game: Game) {
  const away = game.awayTeam.abbreviation || game.awayTeam.name
  const home = game.homeTeam.abbreviation || game.homeTeam.name
  return `${away} ${game.awayTeam.score}, ${home} ${game.homeTeam.score}`
}

function matchup(game: Game) {
  return `${game.awayTeam.name} at ${game.homeTeam.name}`
}

/**
 * Decides whether a change since the last poll is worth a notification:
 * the game starting, any score change while live, and the final.
 * A game seen for the first time only records a baseline.
 */
export function alertFor(previous: GameSnapshot | undefined, game: Game): Alert | null {
  if (!previous) return null
  const tag = `game-${game.id}`

  if (game.status === 'post' && previous.status !== 'post') {
    return { title: `Final: ${scoreLine(game)}`, body: matchup(game), tag }
  }
  if (game.status === 'in' && previous.status === 'pre') {
    return { title: `Started: ${matchup(game)}`, body: game.statusDetail || 'Underway', tag }
  }
  if (
    game.status === 'in' &&
    (game.homeTeam.score !== previous.homeScore || game.awayTeam.score !== previous.awayScore)
  ) {
    return { title: scoreLine(game), body: game.statusDetail, tag }
  }
  return null
}
