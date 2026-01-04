import { useState, useEffect } from 'react'

const STORAGE_KEY = 'sports-favorites'

export interface FavoriteTeam {
  id: string
  name: string
  abbreviation: string
  logo: string
  sport: string // e.g., 'nfl', 'nba'
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setFavorites(JSON.parse(stored))
      } catch {
        // Invalid JSON, reset
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  }, [favorites])

  const addFavorite = (team: FavoriteTeam) => {
    setFavorites((prev) => {
      if (prev.some((t) => t.id === team.id)) return prev
      return [...prev, team]
    })
  }

  const removeFavorite = (teamId: string) => {
    setFavorites((prev) => prev.filter((t) => t.id !== teamId))
  }

  const isFavorite = (teamId: string) => {
    return favorites.some((t) => t.id === teamId)
  }

  const toggleFavorite = (team: FavoriteTeam) => {
    if (isFavorite(team.id)) {
      removeFavorite(team.id)
    } else {
      addFavorite(team)
    }
  }

  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite }
}
