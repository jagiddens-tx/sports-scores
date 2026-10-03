import { useState } from 'react'
import './App.css'
import { SportSelector } from './components/SportSelector'
import { ScoreBoard } from './components/ScoreBoard'
import { TeamPicker } from './components/TeamPicker'
import { MyTeamsView } from './components/MyTeamsView'
import { useFavorites } from './hooks/useFavorites'
import { LEAGUES, type League } from './espn'

type View = 'my-teams' | 'all-scores' | 'pick-teams'

function App() {
  const { favorites, isFavorite, toggleFavorite, hasCompletedSetup, completeSetup } = useFavorites()
  const [selectedLeague, setSelectedLeague] = useState<League>(LEAGUES[0])
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
        initialCount={favorites.length}
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
            leagues={LEAGUES}
            selected={selectedLeague}
            onSelect={setSelectedLeague}
          />
          <ScoreBoard
            key={selectedLeague.id}
            league={selectedLeague}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
          />
        </>
      )}
    </div>
  )
}

export default App
