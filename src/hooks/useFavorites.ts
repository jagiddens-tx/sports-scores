import { useState, useEffect } from 'react'

const STORAGE_KEY = 'sports-favorites'
const SETUP_KEY = 'sports-setup-complete'

export interface FavoriteTeam {
  id: string
  name: string
  abbreviation: string
  logo: string
  sport: string // e.g., 'nfl', 'nba'
}

export function useFavorites() {
  // Read saved favorites synchronously so the first render already has them
  // (loading in an effect made My Teams fetch with an empty list first)
  const [favorites, setFavorites] = useState<FavoriteTeam[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    try {
      return JSON.parse(stored)
    } catch {
      // Invalid JSON, reset
      localStorage.removeItem(STORAGE_KEY)
      return []
    }
  })
  const [hasCompletedSetup, setHasCompletedSetup] = useState(() => {
    return localStorage.getItem(SETUP_KEY) === 'true'
  })

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  }, [favorites])

  const addFavorite = (team: FavoriteTeam) => {
    setFavorites((prev) => {
      if (prev.some((t) => t.id === team.id && t.sport === team.sport)) return prev
      return [...prev, team]
    })
  }

  const removeFavorite = (teamId: string, sport: string) => {
    setFavorites((prev) => prev.filter((t) => !(t.id === teamId && t.sport === sport)))
  }

  const isFavorite = (teamId: string, sport: string) => {
    return favorites.some((t) => t.id === teamId && t.sport === sport)
  }

  const toggleFavorite = (team: FavoriteTeam) => {
    if (isFavorite(team.id, team.sport)) {
      removeFavorite(team.id, team.sport)
    } else {
      addFavorite(team)
    }
  }

  const completeSetup = () => {
    localStorage.setItem(SETUP_KEY, 'true')
    setHasCompletedSetup(true)
  }

  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite, hasCompletedSetup, completeSetup }
}
