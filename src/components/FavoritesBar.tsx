import type { FavoriteTeam } from '../hooks/useFavorites'
import './FavoritesBar.css'

interface Props {
  favorites: FavoriteTeam[]
  toggleFavorite: (team: FavoriteTeam) => void
}

export function FavoritesBar({ favorites, toggleFavorite }: Props) {
  return (
    <div className="favorites-bar">
      <span className="favorites-label">My Teams</span>
      <div className="favorites-list">
        {favorites.map((team) => (
          <div key={team.id} className="favorite-team">
            {team.logo && (
              <img src={team.logo} alt={team.name} className="favorite-logo" />
            )}
            <span className="favorite-name">{team.abbreviation || team.name}</span>
            <button
              className="remove-favorite"
              onClick={() => toggleFavorite(team)}
              title="Remove from favorites"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
