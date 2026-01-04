import type { Game } from '../types'
import type { FavoriteTeam } from '../hooks/useFavorites'
import './GameCard.css'

interface Props {
  game: Game
  sportId: string
  isFavorite: (teamId: string, sport: string) => boolean
  toggleFavorite: (team: FavoriteTeam) => void
  onClick?: () => void
}

export function GameCard({ game, sportId, isFavorite, toggleFavorite, onClick }: Props) {
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
    <div className={`game-card ${isLive ? 'live' : ''}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className="game-status">
        {isLive && <span className="live-indicator">LIVE</span>}
        <span className="status-detail">{game.statusDetail}</span>
        {game.broadcast && <span className="broadcast">{game.broadcast}</span>}
      </div>

      <div className="teams">
        <div className={`team ${isFinal && game.awayTeam.score > game.homeTeam.score ? 'winner' : ''}`}>
          <button
            className={`favorite-btn ${isFavorite(game.awayTeam.id, sportId) ? 'is-favorite' : ''}`}
            onClick={(e) => handleFavoriteClick(game.awayTeam, e)}
            title={isFavorite(game.awayTeam.id, sportId) ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite(game.awayTeam.id, sportId) ? '★' : '☆'}
          </button>
          {game.awayTeam.logo && (
            <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="team-logo" />
          )}
          <span className="team-name">{game.awayTeam.name}</span>
          <span className="team-score">{game.status !== 'pre' ? game.awayTeam.score : ''}</span>
        </div>

        <div className={`team ${isFinal && game.homeTeam.score > game.awayTeam.score ? 'winner' : ''}`}>
          <button
            className={`favorite-btn ${isFavorite(game.homeTeam.id, sportId) ? 'is-favorite' : ''}`}
            onClick={(e) => handleFavoriteClick(game.homeTeam, e)}
            title={isFavorite(game.homeTeam.id, sportId) ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite(game.homeTeam.id, sportId) ? '★' : '☆'}
          </button>
          {game.homeTeam.logo && (
            <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="team-logo" />
          )}
          <span className="team-name">{game.homeTeam.name}</span>
          <span className="team-score">{game.status !== 'pre' ? game.homeTeam.score : ''}</span>
        </div>
      </div>

    </div>
  )
}
