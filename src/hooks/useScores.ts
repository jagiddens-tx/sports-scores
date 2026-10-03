import { useState, useEffect } from 'react'
import type { Game } from '../types'
import { fetchScoreboard, type League } from '../espn'
import { readCache, writeCache } from '../cache'
import { startPolling } from '../polling'

export function useScores(league: League) {
  const cacheKey = `scoreboard:${league.id}`
  // Start from the last-known scores (switching leagues re-keys this hook's state via `key`)
  const [games, setGames] = useState<Game[]>(() => readCache<Game[]>(cacheKey) || [])
  const [loading, setLoading] = useState(games.length === 0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let hasLoaded = false

    async function fetchScores() {
      try {
        const games = await fetchScoreboard(league.espnSlug)
        if (cancelled) return
        hasLoaded = true
        setGames(games)
        setError(null)
        writeCache(cacheKey, games)
      } catch (err) {
        // A failed background refresh keeps showing the last good scores
        if (!cancelled && !hasLoaded) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Refresh every 30 seconds for live games
    const stopPolling = startPolling(fetchScores, 30000)

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [league.espnSlug, cacheKey])

  return { games, loading, error }
}
