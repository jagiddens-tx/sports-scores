import { useState, useEffect, useRef } from 'react'
import type { FavoriteTeam } from '../hooks/useFavorites'
import type { Game } from '../types'
import { GameCard } from './GameCard'
import { GameDetail } from './GameDetail'
import { scoreboardUrl } from '../espn'
import { startPolling } from '../polling'
import './MyTeamsView.css'

interface FavoriteGame {
  game: Game
  sportId: string
  espnSlug: string  // The actual ESPN API slug for this competition
}

interface Props {
  favorites: FavoriteTeam[]
  onEditTeams: () => void
}

const SPORT_SLUGS: Record<string, string> = {
  epl: 'soccer/eng.1',
  ncaaf: 'football/college-football',
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
  ncaab: 'basketball/mens-college-basketball',
}

// Additional competitions to check for EPL teams
const EPL_EXTRA_COMPETITIONS = [
  'soccer/eng.fa',        // FA Cup
  'soccer/eng.league_cup', // Carabao Cup
  'soccer/uefa.champions', // Champions League
  'soccer/uefa.europa',    // Europa League
]

const SPORTS_WITH_DETAILS = ['epl', 'mls', 'ncaaf', 'nfl']

export function MyTeamsView({ favorites, onEditTeams }: Props) {
  const [games, setGames] = useState<FavoriteGame[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)

  const hasLoaded = useRef(false)

  // Team IDs are only unique within a sport, so match on both
  const isFavorite = (teamId: string, sport: string) =>
    favorites.some(f => f.id === teamId && f.sport === sport)

  useEffect(() => {
    let cancelled = false
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000

    async function fetchGames() {
      // Only show loading spinner on first load, not refreshes
      if (!hasLoaded.current) {
        setLoading(true)
      }
      const now = Date.now()
      const allGames: FavoriteGame[] = []
      const seenGameIds = new Set<string>()
      let failures = 0

      // Group favorites by sport
      const sportGroups = new Map<string, FavoriteTeam[]>()
      for (const team of favorites) {
        const existing = sportGroups.get(team.sport) || []
        existing.push(team)
        sportGroups.set(team.sport, existing)
      }

      // Helper to fetch games from a slug and add matching favorites
      async function fetchFromSlug(slug: string, teams: FavoriteTeam[], sportId: string) {
        try {
          const res = await fetch(scoreboardUrl(slug))
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()

          for (const event of data.events || []) {
            const competition = event.competitions?.[0]
            if (!competition) continue

            const homeCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'home')
            const awayCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'away')

            // Check if any favorite team is in this game
            const hasFavorite = teams.some(
              t => t.id === homeCompetitor?.team?.id || t.id === awayCompetitor?.team?.id
            )

            if (hasFavorite && !seenGameIds.has(event.id)) {
              const gameStatus = event.status?.type?.state || 'pre'
              const gameTime = new Date(event.date).getTime()

              // Skip finished games older than 48 hours
              if (gameStatus === 'post' && now - gameTime >= FORTY_EIGHT_HOURS) {
                continue
              }

              seenGameIds.add(event.id)

              const game: Game = {
                id: event.id,
                status: event.status?.type?.state || 'pre',
                statusDetail: event.status?.type?.shortDetail || '',
                startTime: event.date,
                homeTeam: {
                  id: homeCompetitor?.team?.id || '',
                  name: homeCompetitor?.team?.displayName || 'TBD',
                  abbreviation: homeCompetitor?.team?.abbreviation || '',
                  logo: homeCompetitor?.team?.logo || '',
                  score: parseInt(homeCompetitor?.score || '0', 10),
                },
                awayTeam: {
                  id: awayCompetitor?.team?.id || '',
                  name: awayCompetitor?.team?.displayName || 'TBD',
                  abbreviation: awayCompetitor?.team?.abbreviation || '',
                  logo: awayCompetitor?.team?.logo || '',
                  score: parseInt(awayCompetitor?.score || '0', 10),
                },
                venue: competition?.venue?.fullName,
                broadcast: competition?.broadcasts?.[0]?.names?.[0],
              }

              allGames.push({ game, sportId, espnSlug: slug })
            }
          }
        } catch {
          // Skip failed fetches, but count them so a total outage isn't shown as "no games"
          failures++
        }
      }

      // Fetch every sport (and cup competition) in parallel
      const requests: Promise<void>[] = []
      for (const [sport, teams] of sportGroups) {
        const slug = SPORT_SLUGS[sport]
        if (!slug) continue

        requests.push(fetchFromSlug(slug, teams, sport))

        // For EPL teams, also check other competitions they might be playing in
        if (sport === 'epl') {
          for (const extraSlug of EPL_EXTRA_COMPETITIONS) {
            requests.push(fetchFromSlug(extraSlug, teams, 'epl'))
          }
        }
      }
      await Promise.all(requests)

      // Sort: live games first, then upcoming (soonest first), then final (most recent first)
      allGames.sort((a, b) => {
        const order = { in: 0, pre: 1, post: 2 }
        const byStatus = order[a.game.status] - order[b.game.status]
        if (byStatus !== 0) return byStatus
        const timeDiff = new Date(a.game.startTime).getTime() - new Date(b.game.startTime).getTime()
        return a.game.status === 'post' ? -timeDiff : timeDiff
      })

      // A newer fetch (e.g. after editing teams) owns the state now
      if (cancelled) return

      setGames(allGames)
      setFetchFailed(requests.length > 0 && failures === requests.length)
      setLoading(false)
      hasLoaded.current = true
    }

    const stopPolling = startPolling(fetchGames, 30000)
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [favorites])

  const handleGameClick = (gameId: string) => {
    setSelectedGameId(selectedGameId === gameId ? null : gameId)
  }

  if (loading) {
    return (
      <div className="my-teams-view">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your teams...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="my-teams-view">
      <div className="my-teams-header">
        <h2>My Teams</h2>
        <button className="edit-btn" onClick={onEditTeams}>Edit</button>
      </div>

      {games.length === 0 && fetchFailed ? (
        <div className="no-games">
          <p>Couldn't load scores from ESPN</p>
          <p className="hint">Will retry automatically</p>
        </div>
      ) : games.length === 0 ? (
        <div className="no-games">
          <p>No games today for your teams</p>
          <p className="hint">Check back later or browse all scores below</p>
        </div>
      ) : (
        <div className="games-list">
          {games.map(({ game, sportId, espnSlug }) => {
            const hasDetails = SPORTS_WITH_DETAILS.includes(sportId)
            const isExpanded = selectedGameId === game.id
            return (
              <div key={game.id} className={`game-wrapper ${isExpanded ? 'expanded' : ''}`}>
                <GameCard
                  game={game}
                  sportId={sportId}
                  isFavorite={isFavorite}
                  toggleFavorite={() => {}} // No-op, already favorites
                  onClick={hasDetails ? () => handleGameClick(game.id) : undefined}
                  isExpanded={isExpanded}
                />
                {hasDetails && isExpanded && (
                  <GameDetail game={game} sportId={sportId} espnSlug={espnSlug} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
