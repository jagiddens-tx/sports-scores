import { useState, useEffect } from 'react'
import type { FavoriteTeam } from '../hooks/useFavorites'
import './MyTeamsView.css'

interface TeamGame {
  id: string
  team: FavoriteTeam
  opponent: { name: string; logo: string; score: number }
  teamScore: number
  status: 'pre' | 'in' | 'post'
  statusDetail: string
  isHome: boolean
  startTime: string
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

export function MyTeamsView({ favorites, onEditTeams }: Props) {
  const [games, setGames] = useState<TeamGame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchGames() {
      setLoading(true)
      const allGames: TeamGame[] = []

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

            for (const favTeam of teams) {
              const isHome = homeCompetitor?.team?.id === favTeam.id
              const isAway = awayCompetitor?.team?.id === favTeam.id

              if (isHome || isAway) {
                const opponentCompetitor = isHome ? awayCompetitor : homeCompetitor
                const teamCompetitor = isHome ? homeCompetitor : awayCompetitor

                allGames.push({
                  id: `${event.id}-${favTeam.id}`,
                  team: favTeam,
                  opponent: {
                    name: opponentCompetitor?.team?.displayName || 'TBD',
                    logo: opponentCompetitor?.team?.logo || '',
                    score: parseInt(opponentCompetitor?.score || '0', 10),
                  },
                  teamScore: parseInt(teamCompetitor?.score || '0', 10),
                  status: event.status?.type?.state || 'pre',
                  statusDetail: event.status?.type?.shortDetail || '',
                  isHome,
                  startTime: event.date,
                })
              }
            }
          }
        } catch {
          // Skip failed fetches
        }
      }

      // Sort: live games first, then upcoming, then final
      allGames.sort((a, b) => {
        const order = { in: 0, pre: 1, post: 2 }
        return order[a.status] - order[b.status]
      })

      setGames(allGames)
      setLoading(false)
    }

    fetchGames()
    const interval = setInterval(fetchGames, 30000)
    return () => clearInterval(interval)
  }, [favorites])

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
          {games.map((game) => (
            <div key={game.id} className={`game-row ${game.status}`}>
              <div className="team-side my-team">
                {game.team.logo && <img src={game.team.logo} alt="" className="team-logo" />}
                <span className="team-name">{game.team.abbreviation || game.team.name}</span>
                <span className="score">{game.status !== 'pre' ? game.teamScore : ''}</span>
              </div>

              <div className="game-info">
                {game.status === 'in' && <span className="live-badge">LIVE</span>}
                <span className="status">{game.statusDetail}</span>
                <span className="location">{game.isHome ? 'HOME' : 'AWAY'}</span>
              </div>

              <div className="team-side opponent">
                <span className="score">{game.status !== 'pre' ? game.opponent.score : ''}</span>
                <span className="team-name">{game.opponent.name}</span>
                {game.opponent.logo && <img src={game.opponent.logo} alt="" className="team-logo" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
