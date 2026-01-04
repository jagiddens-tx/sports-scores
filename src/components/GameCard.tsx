import type { Game } from '../types'
import type { FavoriteTeam } from '../hooks/useFavorites'
import './GameCard.css'

interface Props {
  game: Game
  sportId: string
  isFavorite: (teamId: string) => boolean
  toggleFavorite: (team: FavoriteTeam) => void
}

export function GameCard({ game, sportId, isFavorite, toggleFavorite }: Props) {
  const isLive = game.status === 'in'
  const isFinal = game.status === 'post'

  const handleFavoriteClick = (team: typeof game.homeTeam, e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite({
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      logo: team.logo,
      sport: sportId,
    })
  }

  return (
    <div className={`game-card ${isLive ? 'live' : ''}`}>
      <div className="game-status">
        {isLive && <span className="live-indicator">LIVE</span>}
        <span className="status-detail">{game.statusDetail}</span>
        {game.broadcast && <span className="broadcast">{game.broadcast}</span>}
      </div>

      <div className="teams">
        <div className={`team ${isFinal && game.awayTeam.score > game.homeTeam.score ? 'winner' : ''}`}>
          <button
            className={`favorite-btn ${isFavorite(game.awayTeam.id) ? 'is-favorite' : ''}`}
            onClick={(e) => handleFavoriteClick(game.awayTeam, e)}
            title={isFavorite(game.awayTeam.id) ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite(game.awayTeam.id) ? '★' : '☆'}
          </button>
          {game.awayTeam.logo && (
            <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="team-logo" />
          )}
          <span className="team-name">{game.awayTeam.name}</span>
          <span className="team-score">{game.status !== 'pre' ? game.awayTeam.score : ''}</span>
        </div>

        <div className={`team ${isFinal && game.homeTeam.score > game.awayTeam.score ? 'winner' : ''}`}>
          <button
            className={`favorite-btn ${isFavorite(game.homeTeam.id) ? 'is-favorite' : ''}`}
            onClick={(e) => handleFavoriteClick(game.homeTeam, e)}
            title={isFavorite(game.homeTeam.id) ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite(game.homeTeam.id) ? '★' : '☆'}
          </button>
          {game.homeTeam.logo && (
            <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="team-logo" />
          )}
          <span className="team-name">{game.homeTeam.name}</span>
          <span className="team-score">{game.status !== 'pre' ? game.homeTeam.score : ''}</span>
        </div>
      </div>

      {game.venue && (
        <div className="game-venue">{game.venue}</div>
      )}
    </div>
  )
}
