import { useState } from 'react'
import './App.css'
import { SportSelector } from './components/SportSelector'
import { ScoreBoard } from './components/ScoreBoard'
import { TeamPicker } from './components/TeamPicker'
import { MyTeamsView } from './components/MyTeamsView'
import { useFavorites } from './hooks/useFavorites'
import type { Sport } from './types'

const SPORTS: Sport[] = [
  { id: 'nfl', name: 'NFL', espnSlug: 'football/nfl' },
  { id: 'nba', name: 'NBA', espnSlug: 'basketball/nba' },
  { id: 'mlb', name: 'MLB', espnSlug: 'baseball/mlb' },
  { id: 'nhl', name: 'NHL', espnSlug: 'hockey/nhl' },
  { id: 'ncaaf', name: 'CFB', espnSlug: 'football/college-football' },
  { id: 'ncaab', name: 'CBB', espnSlug: 'basketball/mens-college-basketball' },
  { id: 'mls', name: 'MLS', espnSlug: 'soccer/usa.1' },
  { id: 'epl', name: 'EPL', espnSlug: 'soccer/eng.1' },
]

type View = 'my-teams' | 'all-scores' | 'pick-teams'

function App() {
  const { favorites, isFavorite, toggleFavorite, hasCompletedSetup, completeSetup } = useFavorites()
  const [selectedSport, setSelectedSport] = useState<Sport>(SPORTS[0])
  const [view, setView] = useState<View>(hasCompletedSetup ? 'my-teams' : 'pick-teams')

  // First time user - show team picker
  if (view === 'pick-teams') {
    return (
      <TeamPicker
        onComplete={() => {
          completeSetup()
          setView('my-teams')
        }}
        toggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
      />
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Live Scores</h1>
      </header>

      <nav className="view-tabs">
        <button
          className={`view-tab ${view === 'my-teams' ? 'active' : ''}`}
          onClick={() => setView('my-teams')}
        >
          My Teams
        </button>
        <button
          className={`view-tab ${view === 'all-scores' ? 'active' : ''}`}
          onClick={() => setView('all-scores')}
        >
          All Scores
        </button>
      </nav>

      {view === 'my-teams' ? (
        <MyTeamsView
          favorites={favorites}
          onEditTeams={() => setView('pick-teams')}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}

export default App
