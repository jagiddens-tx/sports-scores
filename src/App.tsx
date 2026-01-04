import { useState } from 'react'
import './App.css'
import { SportSelector } from './components/SportSelector'
import { ScoreBoard } from './components/ScoreBoard'
import { FavoritesBar } from './components/FavoritesBar'
import { useFavorites } from './hooks/useFavorites'
import type { Sport } from './types'

const SPORTS: Sport[] = [
  { id: 'nfl', name: 'NFL', espnSlug: 'football/nfl' },
  { id: 'nba', name: 'NBA', espnSlug: 'basketball/nba' },
  { id: 'mlb', name: 'MLB', espnSlug: 'baseball/mlb' },
  { id: 'nhl', name: 'NHL', espnSlug: 'hockey/nhl' },
  { id: 'ncaaf', name: 'College Football', espnSlug: 'football/college-football' },
  { id: 'ncaab', name: 'College Basketball', espnSlug: 'basketball/mens-college-basketball' },
  { id: 'mls', name: 'MLS', espnSlug: 'soccer/usa.1' },
  { id: 'epl', name: 'Premier League', espnSlug: 'soccer/eng.1' },
]

function App() {
  const [selectedSport, setSelectedSport] = useState<Sport>(SPORTS[0])
  const { favorites, isFavorite, toggleFavorite } = useFavorites()

  return (
    <div className="app">
      <header>
        <h1>Live Scores</h1>
      </header>
      {favorites.length > 0 && (
        <FavoritesBar favorites={favorites} toggleFavorite={toggleFavorite} />
      )}
      <SportSelector
        sports={SPORTS}
        selected={selectedSport}
        onSelect={setSelectedSport}
      />
      <ScoreBoard
        sport={selectedSport}
        isFavorite={isFavorite}
        toggleFavorite={toggleFavorite}
      />
    </div>
  )
}

export default App
