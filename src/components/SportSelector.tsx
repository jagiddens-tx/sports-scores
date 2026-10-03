import type { League } from '../espn'
import './SportSelector.css'

interface Props {
  leagues: League[]
  selected: League
  onSelect: (league: League) => void
}

export function SportSelector({ leagues, selected, onSelect }: Props) {
  return (
    <nav className="sport-selector">
      {leagues.map((league) => (
        <button
          key={league.id}
          className={`sport-btn ${selected.id === league.id ? 'active' : ''}`}
          onClick={() => onSelect(league)}
        >
          {league.name}
        </button>
      ))}
    </nav>
  )
}
