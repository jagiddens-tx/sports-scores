import { useState, useEffect } from 'react'
import type { Game, Sport } from '../types'

const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports'

export function useScores(sport: Sport) {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let isFirstLoad = true

    async function fetchScores() {
      // Only show loading spinner on first load, not refreshes
      if (isFirstLoad) {
        setLoading(true)
      }
      setError(null)

      try {
        const response = await fetch(`${ESPN_API}/${sport.espnSlug}/scoreboard`)
        if (!response.ok) throw new Error('Failed to fetch scores')

        const data = await response.json()
        if (cancelled) return

        const games: Game[] = data.events?.map((event: any) => {
          const competition = event.competitions?.[0]
          const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home')
          const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away')

          return {
            id: event.id,
            status: event.status?.type?.state || 'pre',
            statusDetail: event.status?.type?.shortDetail || '',
            startTime: event.date,
            homeTeam: {
              id: homeTeam?.team?.id || '',
              name: homeTeam?.team?.displayName || 'TBD',
              abbreviation: homeTeam?.team?.abbreviation || '',
              logo: homeTeam?.team?.logo || '',
              score: parseInt(homeTeam?.score || '0', 10),
            },
            awayTeam: {
              id: awayTeam?.team?.id || '',
              name: awayTeam?.team?.displayName || 'TBD',
              abbreviation: awayTeam?.team?.abbreviation || '',
              logo: awayTeam?.team?.logo || '',
              score: parseInt(awayTeam?.score || '0', 10),
            },
            venue: competition?.venue?.fullName,
            broadcast: competition?.broadcasts?.[0]?.names?.[0],
          }
        }) || []

        setGames(games)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled && isFirstLoad) {
          setLoading(false)
          isFirstLoad = false
        }
      }
    }

    fetchScores()

    // Refresh every 30 seconds for live games
    const interval = setInterval(fetchScores, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sport.espnSlug])

  return { games, loading, error }
}
