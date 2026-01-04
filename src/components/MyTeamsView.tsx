import { useState, useEffect } from 'react'
import type { FavoriteTeam } from '../hooks/useFavorites'
import type { Game } from '../types'
import { GameCard } from './GameCard'
import { GameDetail } from './GameDetail'
import './MyTeamsView.css'

interface FavoriteGame {
  game: Game
  sportId: string
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

const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports'

const SPORTS_WITH_DETAILS = ['epl', 'mls', 'ncaaf', 'nfl']

export function MyTeamsView({ favorites, onEditTeams }: Props) {
  const [games, setGames] = useState<FavoriteGame[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)

  const isFavorite = (teamId: string) => favorites.some(f => f.id === teamId)

  useEffect(() => {
    async function fetchGames() {
      setLoading(true)
      const allGames: FavoriteGame[] = []
      const seenGameIds = new Set<string>()

      // Group favorites by sport
      const sportGroups = new Map<string, FavoriteTeam[]>()
      for (const team of favorites) {
        const existing = sportGroups.get(team.sport) || []
        existing.push(team)
        sportGroups.set(team.sport, existing)
      }

      // Fetch each sport
      for (const [sport, teams] of sportGroups) {
        const slug = SPORT_SLUGS[sport]
        if (!slug) continue

        try {
          const res = await fetch(`${ESPN_API}/${slug}/scoreboard`)
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

              allGames.push({ game, sportId: sport })
            }
          }
        } catch {
          // Skip failed fetches
        }
      }

      // Sort: live games first, then upcoming, then final
      allGames.sort((a, b) => {
        const order = { in: 0, pre: 1, post: 2 }
        return order[a.game.status] - order[b.game.status]
      })

      setGames(allGames)
      setLoading(false)
    }

    fetchGames()
    const interval = setInterval(fetchGames, 30000)
    return () => clearInterval(interval)
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

      {games.length === 0 ? (
        <div className="no-games">
          <p>No games today for your teams</p>
          <p className="hint">Check back later or browse all scores below</p>
        </div>
      ) : (
        <div className="games-list">
          {games.map(({ game, sportId }) => {
            const hasDetails = SPORTS_WITH_DETAILS.includes(sportId)
            const isExpanded = selectedGameId === game.id
            return (
              <div key={game.id} className={`game-wrapper ${isExpanded ? 'expanded' : ''}`}>
                <GameCard
                  game={game}
                  sportId={sportId}
                  isFavorite={(teamId) => isFavorite(teamId)}
                  toggleFavorite={() => {}} // No-op, already favorites
                  onClick={hasDetails ? () => handleGameClick(game.id) : undefined}
                  isExpanded={isExpanded}
                />
                {hasDetails && isExpanded && (
                  <GameDetail game={game} sportId={sportId} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
