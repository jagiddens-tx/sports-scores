import { useState } from 'react'
import type { League } from '../espn'
import type { FavoriteTeam } from '../hooks/useFavorites'
import { useScores } from '../hooks/useScores'
import { GameCard } from './GameCard'
import { GameDetail } from './GameDetail'
import './ScoreBoard.css'

interface Props {
  league: League
  isFavorite: (teamId: string, sport: string) => boolean
  toggleFavorite: (team: FavoriteTeam) => void
}

export function ScoreBoard({ league, isFavorite, toggleFavorite }: Props) {
  const { games, loading, error } = useScores(league)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="scoreboard-loading">
        <div className="spinner"></div>
        <p>Loading {league.name} scores...</p>
      </div>
    )
  }

  if (error && games.length === 0) {
    return (
      <div className="scoreboard-error">
        <p>Failed to load scores: {error}</p>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="scoreboard-empty">
        <p>No {league.name} games scheduled today</p>
      </div>
    )
  }

  return (
    <div className="scoreboard">
      {games.map((game) => {
        const isExpanded = selectedGameId === game.id
        return (
          <div key={game.id} className="game-wrapper">
            <GameCard
              game={game}
              sportId={league.id}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
              // Toggle: click same game to close, different game to switch
              onClick={league.hasDetails ? () => setSelectedGameId(isExpanded ? null : game.id) : undefined}
              isExpanded={isExpanded}
            />
            {league.hasDetails && isExpanded && (
              <GameDetail game={game} espnSlug={league.espnSlug} />
            )}
          </div>
        )
      })}
    </div>
  )
}
