// Last-known data saved to localStorage so the app can paint scores instantly
// on launch (and offline) while fresh data loads in the background.
const PREFIX = 'scores-cache:'

export function readCache<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable; caching is best-effort
  }
}
