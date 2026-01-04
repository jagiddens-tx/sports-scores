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
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)

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

  return (
    <>
      <div className="scoreboard">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            sportId={sport.id}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            onClick={isSoccer ? () => setSelectedGame(game) : undefined}
          />
        ))}
      </div>

      {selectedGame && (
        <GameDetail
          game={selectedGame}
          sportId={sport.id}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </>
  )
}
