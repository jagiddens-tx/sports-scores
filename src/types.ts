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

// Soccer-specific game details
export interface GameEvent {
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution'
  minute: string
  teamId: string
  player: {
    name: string
    headshot?: string
    position?: string
  }
  assistedBy?: string
  isOwnGoal?: boolean
  isPenalty?: boolean
}

// Football scoring plays
export interface ScoringPlay {
  quarter: string
  clock: string
  teamId: string
  teamLogo: string
  type: string // "Rushing TD", "Passing TD", "Field Goal", etc.
  description: string
  homeScore: number
  awayScore: number
}

export interface TeamStats {
  // Soccer stats
  possession?: string
  shots?: number
  shotsOnTarget?: number
  corners?: number
  fouls?: number
  // Football stats
  totalYards?: number
  passingYards?: number
  rushingYards?: number
  turnovers?: number
  timeOfPossession?: string
  thirdDownEff?: string
  firstDowns?: number
}

export interface GameDetails {
  events: GameEvent[]
  scoringPlays?: ScoringPlay[]
  homeStats?: TeamStats
  awayStats?: TeamStats
  attendance?: number
}
