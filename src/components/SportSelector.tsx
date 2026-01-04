import type { Sport } from '../types'
import './SportSelector.css'

interface Props {
  sports: Sport[]
  selected: Sport
  onSelect: (sport: Sport) => void
}

export function SportSelector({ sports, selected, onSelect }: Props) {
  return (
    <nav className="sport-selector">
      {sports.map((sport) => (
        <button
          key={sport.id}
          className={`sport-btn ${selected.id === sport.id ? 'active' : ''}`}
          onClick={() => onSelect(sport)}
        >
          {sport.name}
        </button>
      ))}
    </nav>
  )
}
