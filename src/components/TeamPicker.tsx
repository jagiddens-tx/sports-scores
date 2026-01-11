import { useState, useEffect } from 'react'
import type { FavoriteTeam } from '../hooks/useFavorites'
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

const LEAGUES = [
  { id: 'epl', name: 'Premier League', slug: 'soccer/eng.1' },
  { id: 'ncaaf', name: 'College Football', slug: 'football/college-football' },
  { id: 'nfl', name: 'NFL', slug: 'football/nfl' },
  { id: 'nba', name: 'NBA', slug: 'basketball/nba' },
  { id: 'mlb', name: 'MLB', slug: 'baseball/mlb' },
  { id: 'nhl', name: 'NHL', slug: 'hockey/nhl' },
  { id: 'ncaab', name: 'College Basketball', slug: 'basketball/mens-college-basketball' },
]

const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports'

export function TeamPicker({ onComplete, toggleFavorite, isFavorite, initialCount }: Props) {
  const [selectedLeague, setSelectedLeague] = useState(LEAGUES[0])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCount, setSelectedCount] = useState(initialCount)

  useEffect(() => {
    async function fetchTeams() {
      setLoading(true)
      try {
        const res = await fetch(`${ESPN_API}/${selectedLeague.slug}/teams?limit=100`)
        const data = await res.json()
        const teamList: Team[] = data.sports?.[0]?.leagues?.[0]?.teams?.map((t: any) => ({
          id: t.team.id,
          name: t.team.displayName,
          abbreviation: t.team.abbreviation,
          logo: t.team.logos?.[0]?.href || '',
        })) || []
        setTeams(teamList.sort((a, b) => a.name.localeCompare(b.name)))
      } catch {
        setTeams([])
      }
      setLoading(false)
    }
    fetchTeams()
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
            {league.name}
          </button>
        ))}
      </div>

      <div className="teams-grid">
        {loading ? (
          <div className="loading">Loading teams...</div>
        ) : (
          teams.map((team) => (
            <button
              key={team.id}
              className={`team-btn ${isFavorite(team.id, selectedLeague.id) ? 'selected' : ''}`}
              onClick={() => handleTeamClick(team)}
            >
              {team.logo && <img src={team.logo} alt="" className="team-logo" />}
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
