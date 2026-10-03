import { useState, useEffect } from 'react'
import type { FavoriteTeam } from '../hooks/useFavorites'
import { LEAGUES, fetchTeams } from '../espn'
import { TeamLogo } from './TeamLogo'
import './TeamPicker.css'

interface Team {
  id: string
  name: string
  abbreviation: string
  logo: string
}

interface Props {
  onComplete: () => void
  toggleFavorite: (team: FavoriteTeam) => void
  isFavorite: (teamId: string, sport: string) => boolean
  initialCount: number
}

export function TeamPicker({ onComplete, toggleFavorite, isFavorite, initialCount }: Props) {
  const [selectedLeague, setSelectedLeague] = useState(LEAGUES[0])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCount, setSelectedCount] = useState(initialCount)
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const visibleTeams = query
    ? teams.filter(t => t.name.toLowerCase().includes(query) || t.abbreviation.toLowerCase().includes(query))
    : teams

  useEffect(() => {
    let cancelled = false
    async function loadTeams() {
      setLoading(true)
      let teamList: Team[] = []
      try {
        teamList = (await fetchTeams(selectedLeague.espnSlug)).sort((a, b) => a.name.localeCompare(b.name))
      } catch {
        // Show an empty list; switching tabs retries
      }
      // Ignore a slow response for a league tab the user already left
      if (cancelled) return
      setTeams(teamList)
      setLoading(false)
    }
    loadTeams()
    return () => {
      cancelled = true
    }
  }, [selectedLeague])

  const handleTeamClick = (team: Team) => {
    const wasSelected = isFavorite(team.id, selectedLeague.id)
    toggleFavorite({
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      logo: team.logo,
      sport: selectedLeague.id,
    })
    setSelectedCount(prev => wasSelected ? prev - 1 : prev + 1)
  }

  return (
    <div className="team-picker">
      <div className="picker-header">
        <h1>Pick Your Teams</h1>
        <p>Select the teams you want to follow</p>
      </div>

      <div className="league-tabs">
        {LEAGUES.map((league) => (
          <button
            key={league.id}
            className={`league-tab ${selectedLeague.id === league.id ? 'active' : ''}`}
            onClick={() => setSelectedLeague(league)}
          >
            {league.fullName}
          </button>
        ))}
      </div>

      <div className="team-search">
        <input
          type="search"
          placeholder={`Search ${selectedLeague.fullName} teams`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>

      <div className="teams-grid">
        {loading ? (
          <div className="loading">Loading teams...</div>
        ) : (
          visibleTeams.map((team) => (
            <button
              key={team.id}
              className={`team-btn ${isFavorite(team.id, selectedLeague.id) ? 'selected' : ''}`}
              onClick={() => handleTeamClick(team)}
            >
              <TeamLogo src={team.logo} size={48} className="team-logo" />
              <span className="team-name">{team.name}</span>
              {isFavorite(team.id, selectedLeague.id) && <span className="check">✓</span>}
            </button>
          ))
        )}
      </div>

      <div className="picker-footer">
        <button
          className="done-btn"
          onClick={onComplete}
          disabled={selectedCount === 0}
        >
          {selectedCount === 0 ? 'Select at least one team' : `Done (${selectedCount} selected)`}
        </button>
        <button
          className="update-link"
          onClick={() => window.location.reload()}
        >
          Check for updates
        </button>
      </div>
    </div>
  )
}
