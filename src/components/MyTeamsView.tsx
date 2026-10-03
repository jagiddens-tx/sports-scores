import { useState, useEffect } from 'react'
import type { FavoriteTeam } from '../hooks/useFavorites'
import type { Game } from '../types'
import { GameCard } from './GameCard'
import { GameDetail } from './GameDetail'
import { NotificationsToggle } from './NotificationsToggle'
import { LEAGUES_BY_ID, competitionSlugs, compareGames, fetchScoreboard } from '../espn'
import { readCache, writeCache } from '../cache'
import { startPolling } from '../polling'
import './MyTeamsView.css'

interface FavoriteGame {
  game: Game
  sportId: string
  espnSlug: string  // The actual ESPN API slug for this competition
}

interface Props {
  favorites: FavoriteTeam[]
  onEditTeams: () => void
}

const CACHE_KEY = 'my-teams'

export function MyTeamsView({ favorites, onEditTeams }: Props) {
  // Paint the last-known games instantly; fresh data replaces them in the background
  const [games, setGames] = useState<FavoriteGame[]>(() => readCache<FavoriteGame[]>(CACHE_KEY) || [])
  const [loading, setLoading] = useState(games.length === 0)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)

  // Team IDs are only unique within a sport, so match on both
  const isFavorite = (teamId: string, sport: string) =>
    favorites.some(f => f.id === teamId && f.sport === sport)

  useEffect(() => {
    let cancelled = false

    async function fetchGames() {
      // Group favorite team IDs by sport
      const teamIdsBySport = new Map<string, Set<string>>()
      for (const team of favorites) {
        const ids = teamIdsBySport.get(team.sport) || new Set<string>()
        ids.add(team.id)
        teamIdsBySport.set(team.sport, ids)
      }

      // Fetch every league (and cup competition) in parallel
      const requests: Promise<FavoriteGame[]>[] = []
      for (const [sportId, teamIds] of teamIdsBySport) {
        for (const slug of competitionSlugs(sportId)) {
          requests.push(
            fetchScoreboard(slug).then(games => games
              .filter(game => teamIds.has(game.homeTeam.id) || teamIds.has(game.awayTeam.id))
              .map(game => ({ game, sportId, espnSlug: slug })))
          )
        }
      }
      const results = await Promise.allSettled(requests)
      // A newer fetch (e.g. after editing teams) owns the state now
      if (cancelled) return

      const failures = results.filter(r => r.status === 'rejected').length
      const allFailed = requests.length > 0 && failures === requests.length
      setFetchFailed(allFailed)

      // On a total outage keep showing the last-known games
      if (!allFailed) {
        const seenGameIds = new Set<string>()
        const allGames = results
          .flatMap(r => (r.status === 'fulfilled' ? r.value : []))
          .filter(({ game }) => !seenGameIds.has(game.id) && seenGameIds.add(game.id))
          .sort((a, b) => compareGames(a.game, b.game))
        setGames(allGames)
        writeCache(CACHE_KEY, allGames)
      }
      setLoading(false)
    }

    const stopPolling = startPolling(fetchGames, 30000)
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [favorites])

  const handleGameClick = (gameId: string) => {
    setSelectedGameId(selectedGameId === gameId ? null : gameId)
  }

  if (loading) {
    return (
      <div className="my-teams-view">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your teams...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="my-teams-view">
      <div className="my-teams-header">
        <h2>My Teams</h2>
        <div className="my-teams-actions">
          <NotificationsToggle favorites={favorites} />
          <button className="edit-btn" onClick={onEditTeams}>Edit</button>
        </div>
      </div>

      {fetchFailed && (
        <div className="fetch-warning">
          {games.length > 0 ? "Can't reach ESPN — showing last known scores" : "Couldn't load scores from ESPN. Will retry automatically."}
        </div>
      )}

      {games.length === 0 ? (
        !fetchFailed && (
          <div className="no-games">
            <p>No games today for your teams</p>
            <p className="hint">Check back later or browse all scores below</p>
          </div>
        )
      ) : (
        <div className="games-list">
          {games.map(({ game, sportId, espnSlug }) => {
            const hasDetails = LEAGUES_BY_ID[sportId]?.hasDetails ?? false
            const isExpanded = selectedGameId === game.id
            return (
              <div key={game.id} className={`game-wrapper ${isExpanded ? 'expanded' : ''}`}>
                <GameCard
                  game={game}
                  sportId={sportId}
                  isFavorite={isFavorite}
                  toggleFavorite={() => {}} // No-op, already favorites
                  onClick={hasDetails ? () => handleGameClick(game.id) : undefined}
                  isExpanded={isExpanded}
                />
                {hasDetails && isExpanded && (
                  <GameDetail game={game} espnSlug={espnSlug} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
