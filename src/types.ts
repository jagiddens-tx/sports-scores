export interface Sport {
  id: string
  name: string
  espnSlug: string
}

export interface Team {
  id: string
  name: string
  abbreviation: string
  logo: string
  score: number
}

export interface Game {
  id: string
  status: 'pre' | 'in' | 'post'
  statusDetail: string
  startTime: string
  homeTeam: Team
  awayTeam: Team
  venue?: string
  broadcast?: string
}
