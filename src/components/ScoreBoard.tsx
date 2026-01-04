import { useState } from 'react'
import type { Sport, Game } from '../types'
import type { FavoriteTeam } from '../hooks/useFavorites'
import { useScores } from '../hooks/useScores'
import { GameCard } from './GameCard'
import { GameDetail } from './GameDetail'
import './ScoreBoard.css'

interface Props {
  sport: Sport
  isFavorite: (teamId: string, sport: string) => boolean
  toggleFavorite: (team: FavoriteTeam) => void
}

export function ScoreBoard({ sport, isFavorite, toggleFavorite }: Props) {
  const { games, loading, error } = useScores(sport)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="scoreboard-loading">
        <div className="spinner"></div>
        <p>Loading {sport.name} scores...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="scoreboard-error">
        <p>Failed to load scores: {error}</p>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="scoreboard-empty">
        <p>No {sport.name} games scheduled today</p>
      </div>
    )
  }

  const isSoccer = sport.id === 'epl' || sport.id === 'mls'

  const handleGameClick = (game: Game) => {
    // Toggle: click same game to close, different game to switch
    setSelectedGameId(selectedGameId === game.id ? null : game.id)
  }

  return (
    <div className="scoreboard">
      {games.map((game) => (
        <div key={game.id} className="game-wrapper">
          <GameCard
            game={game}
            sportId={sport.id}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            onClick={isSoccer ? () => handleGameClick(game) : undefined}
          />
          {isSoccer && selectedGameId === game.id && (
            <GameDetail
              game={game}
              sportId={sport.id}
            />
          )}
        </div>
      ))}
    </div>
  )
}
