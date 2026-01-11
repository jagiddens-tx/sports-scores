import { useEffect, useState } from 'react'
import type { Game, GameEvent, TeamStats, ScoringPlay } from '../types'
import './GameDetail.css'

interface Props {
  game: Game
  sportId: string
  espnSlug?: string  // Optional: use this slug instead of looking up from sportId
}

interface Player {
  name: string
  jersey: string
  position: string
  positionAbbr: string
  starter: boolean
}

interface TeamLineup {
  teamId: string
  teamName: string
  teamAbbr: string
  formation?: string
  players: Player[]
}

interface GameDetails {
  events: GameEvent[]
  scoringPlays?: ScoringPlay[]
  homeStats?: TeamStats
  awayStats?: TeamStats
  attendance?: number
  homeLineup?: TeamLineup
  awayLineup?: TeamLineup
}

const SPORT_SLUGS: Record<string, string> = {
  epl: 'soccer/eng.1',
  mls: 'soccer/usa.1',
  ncaaf: 'football/college-football',
  nfl: 'football/nfl',
}

const FOOTBALL_SPORTS = ['ncaaf', 'nfl']
const SOCCER_SPORTS = ['epl', 'mls']

export function GameDetail({ game, sportId, espnSlug }: Props) {
  const [details, setDetails] = useState<GameDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'match' | 'home' | 'away'>('match')

  // Determine sport type from sportId or espnSlug
  const isSoccer = SOCCER_SPORTS.includes(sportId) || espnSlug?.startsWith('soccer/')

  useEffect(() => {
    const fetchDetails = async () => {
      // Use provided espnSlug, or fall back to lookup
      const slug = espnSlug || SPORT_SLUGS[sportId]
      if (!slug) {
        setLoading(false)
        return
      }

      const isFootball = FOOTBALL_SPORTS.includes(sportId)
      const isSoccerFetch = SOCCER_SPORTS.includes(sportId) || slug.startsWith('soccer/')

      try {
        let events: GameEvent[] = []
        let scoringPlays: ScoringPlay[] = []
        let homeStats: TeamStats = {}
        let awayStats: TeamStats = {}
        let attendance: number | undefined
        let homeLineup: TeamLineup | undefined
        let awayLineup: TeamLineup | undefined

        if (isFootball) {
          // Football uses the summary endpoint for detailed stats
          const endpoint = `https://site.api.espn.com/apis/site/v2/sports/${slug}/summary?event=${game.id}`
          const res = await fetch(endpoint)
          const data = await res.json()

          // Parse football data from summary endpoint
          const boxscore = data.boxscore
          if (boxscore?.teams) {
            for (const team of boxscore.teams) {
              const isHome = team.homeAway === 'home'
              const stats: TeamStats = {}
              for (const stat of team.statistics || []) {
                if (stat.name === 'totalYards') stats.totalYards = parseInt(stat.displayValue)
                if (stat.name === 'netPassingYards' || stat.name === 'passingYards') stats.passingYards = parseInt(stat.displayValue)
                if (stat.name === 'rushingYards') stats.rushingYards = parseInt(stat.displayValue)
                if (stat.name === 'turnovers') stats.turnovers = parseInt(stat.displayValue)
                if (stat.name === 'possessionTime') stats.timeOfPossession = stat.displayValue
                if (stat.name === 'thirdDownEff') stats.thirdDownEff = stat.displayValue
                if (stat.name === 'firstDowns') stats.firstDowns = parseInt(stat.displayValue)
              }
              if (isHome) {
                homeStats = stats
              } else {
                awayStats = stats
              }
            }
          }

          // Parse scoring plays from summary
          if (data.scoringPlays) {
            scoringPlays = data.scoringPlays.map((play: any) => ({
              quarter: play.period?.number ? `Q${play.period.number}` : '',
              clock: play.clock?.displayValue || '',
              teamId: play.team?.id || '',
              teamLogo: play.team?.logo || '',
              type: play.type?.abbreviation || play.type?.text || '',
              description: play.text || '',
              homeScore: play.homeScore || 0,
              awayScore: play.awayScore || 0,
            }))
          }

          // Get attendance from gameInfo
          attendance = data.gameInfo?.attendance

        } else if (isSoccerFetch) {
          // Soccer: fetch both scoreboard (for match events) and summary (for lineups)
          const [scoreboardRes, summaryRes] = await Promise.all([
            fetch(`https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`),
            fetch(`https://site.api.espn.com/apis/site/v2/sports/${slug}/summary?event=${game.id}`)
          ])

          const scoreboardData = await scoreboardRes.json()
          const summaryData = await summaryRes.json()

          // Parse match events from scoreboard
          const event = scoreboardData.events?.find((e: any) => e.id === game.id)
          if (!event) {
            setLoading(false)
            return
          }

          const competition = event.competitions?.[0]
          if (!competition) {
            setLoading(false)
            return
          }

          events = (competition.details || []).map((d: any) => {
            let type: GameEvent['type'] = 'goal'
            if (d.yellowCard) type = 'yellow_card'
            if (d.redCard) type = 'red_card'
            if (d.type?.text === 'Substitution') type = 'substitution'
            if (d.scoringPlay) type = 'goal'

            const athlete = d.athletesInvolved?.[0]

            return {
              type,
              minute: d.clock?.displayValue || '',
              teamId: d.team?.id || '',
              player: {
                name: athlete?.displayName || 'Unknown',
                headshot: athlete?.headshot,
                position: athlete?.position,
              },
              isOwnGoal: d.ownGoal,
              isPenalty: d.penaltyKick,
            }
          })

          const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home')
          const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away')

          const parseStats = (team: any): TeamStats => {
            const stats: TeamStats = {}
            for (const stat of team?.statistics || []) {
              if (stat.name === 'possessionPct') stats.possession = stat.displayValue
              if (stat.name === 'totalShots') stats.shots = parseInt(stat.displayValue)
              if (stat.name === 'shotsOnTarget') stats.shotsOnTarget = parseInt(stat.displayValue)
              if (stat.name === 'wonCorners') stats.corners = parseInt(stat.displayValue)
              if (stat.name === 'foulsCommitted') stats.fouls = parseInt(stat.displayValue)
            }
            return stats
          }

          homeStats = parseStats(homeTeam)
          awayStats = parseStats(awayTeam)
          attendance = competition.attendance

          // Parse lineups from summary
          const parseLineup = (roster: any): TeamLineup => {
            const team = roster.team || {}
            return {
              teamId: team.id || '',
              teamName: team.displayName || '',
              teamAbbr: team.abbreviation || '',
              formation: roster.formation,
              players: (roster.roster || []).map((p: any) => ({
                name: p.athlete?.displayName || '',
                jersey: p.jersey || '',
                position: p.position?.displayName || '',
                positionAbbr: p.position?.abbreviation || '',
                starter: p.starter || false,
              }))
            }
          }

          for (const roster of summaryData.rosters || []) {
            const isHome = roster.homeAway === 'home'
            if (isHome) {
              homeLineup = parseLineup(roster)
            } else {
              awayLineup = parseLineup(roster)
            }
          }
        }

        setDetails({
          events,
          scoringPlays: scoringPlays.length > 0 ? scoringPlays : undefined,
          homeStats,
          awayStats,
          attendance,
          homeLineup,
          awayLineup,
        })
      } catch (err) {
        console.error('Failed to fetch game details:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()
  }, [game.id, sportId, espnSlug])

  const isFootball = FOOTBALL_SPORTS.includes(sportId)

  const goals = details?.events.filter(e => e.type === 'goal') || []
  const cards = details?.events.filter(e => e.type === 'yellow_card' || e.type === 'red_card') || []
  const scoringPlays = details?.scoringPlays || []

  const hasSoccerContent = goals.length > 0 || cards.length > 0 ||
    details?.homeStats?.possession || details?.awayStats?.possession
  const hasFootballContent = scoringPlays.length > 0 ||
    details?.homeStats?.totalYards !== undefined || details?.awayStats?.totalYards !== undefined
  const hasLineups = details?.homeLineup?.players?.length || details?.awayLineup?.players?.length
  const hasContent = isSoccer ? (hasSoccerContent || hasLineups) : hasFootballContent

  // For soccer, show tabs if we have lineups
  const showTabs = isSoccer && hasLineups

  return (
    <div className="game-detail-expanded">
      {loading && <div className="detail-loading">Loading details...</div>}

      {!loading && !hasContent && (
        <div className="detail-note">No match events yet</div>
      )}

      {!loading && hasContent && (
        <>
          {/* Tabs for soccer games with lineups */}
          {showTabs && (
            <div className="detail-tabs">
              <button
                className={`detail-tab ${activeTab === 'match' ? 'active' : ''}`}
                onClick={() => setActiveTab('match')}
              >
                Match
              </button>
              <button
                className={`detail-tab ${activeTab === 'away' ? 'active' : ''}`}
                onClick={() => setActiveTab('away')}
              >
                {game.awayTeam.abbreviation}
              </button>
              <button
                className={`detail-tab ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => setActiveTab('home')}
              >
                {game.homeTeam.abbreviation}
              </button>
            </div>
          )}

          {/* Match Events Tab (or default for non-soccer) */}
          {(activeTab === 'match' || !showTabs) && (
            <>
              {/* Goals */}
          {goals.length > 0 && (
            <div className="detail-section">
              <h3 className="section-title">Goals</h3>
              <div className="events-list">
                {goals.map((event, i) => (
                  <div key={i} className={`event-row ${event.teamId === game.homeTeam.id ? 'home' : 'away'}`}>
                    <span className="event-minute">{event.minute}</span>
                    <span className="event-icon">⚽</span>
                    <span className="event-player">
                      {event.player.name}
                      {event.isPenalty && <span className="event-note"> (pen)</span>}
                      {event.isOwnGoal && <span className="event-note"> (og)</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cards */}
          {cards.length > 0 && (
            <div className="detail-section">
              <h3 className="section-title">Cards</h3>
              <div className="events-list">
                {cards.map((event, i) => (
                  <div key={i} className={`event-row ${event.teamId === game.homeTeam.id ? 'home' : 'away'}`}>
                    <span className="event-minute">{event.minute}</span>
                    <span className={`card-icon ${event.type === 'red_card' ? 'red' : 'yellow'}`}></span>
                    <span className="event-player">{event.player.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Soccer Stats */}
          {isSoccer && (details?.homeStats?.possession || details?.awayStats?.possession) && (
            <div className="detail-section">
              <h3 className="section-title">Match Stats</h3>
              <div className="stats-grid">
                <div className="stats-header">
                  <span className="stats-team-name">{game.awayTeam.abbreviation}</span>
                  <span className="stats-spacer"></span>
                  <span className="stats-team-name">{game.homeTeam.abbreviation}</span>
                </div>
                <StatRow
                  label="Possession"
                  away={details?.awayStats?.possession || '-'}
                  home={details?.homeStats?.possession || '-'}
                />
                {(details?.homeStats?.shots !== undefined || details?.awayStats?.shots !== undefined) && (
                  <StatRow
                    label="Shots"
                    away={String(details?.awayStats?.shots ?? '-')}
                    home={String(details?.homeStats?.shots ?? '-')}
                  />
                )}
                {(details?.homeStats?.corners !== undefined || details?.awayStats?.corners !== undefined) && (
                  <StatRow
                    label="Corners"
                    away={String(details?.awayStats?.corners ?? '-')}
                    home={String(details?.homeStats?.corners ?? '-')}
                  />
                )}
                {(details?.homeStats?.fouls !== undefined || details?.awayStats?.fouls !== undefined) && (
                  <StatRow
                    label="Fouls"
                    away={String(details?.awayStats?.fouls ?? '-')}
                    home={String(details?.homeStats?.fouls ?? '-')}
                  />
                )}
              </div>
            </div>
          )}
            </>
          )}

          {/* Away Team Lineup Tab */}
          {activeTab === 'away' && details?.awayLineup && (
            <FormationView lineup={details.awayLineup} />
          )}

          {/* Home Team Lineup Tab */}
          {activeTab === 'home' && details?.homeLineup && (
            <FormationView lineup={details.homeLineup} />
          )}

          {/* Football Scoring Plays */}
          {isFootball && scoringPlays.length > 0 && (
            <div className="detail-section">
              <h3 className="section-title">Scoring</h3>
              <div className="scoring-plays">
                {scoringPlays.map((play, i) => {
                  const isHome = play.teamId === game.homeTeam.id
                  return (
                    <div key={i} className={`scoring-play ${isHome ? 'home' : 'away'}`}>
                      <div className="scoring-play-header">
                        <img src={play.teamLogo} alt="" className="scoring-play-logo" />
                        <span className="scoring-play-type">{play.type}</span>
                        <span className="scoring-play-time">{play.quarter} {play.clock}</span>
                        <span className="scoring-play-score">{play.awayScore} - {play.homeScore}</span>
                      </div>
                      <div className="scoring-play-desc">{play.description}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Football Stats */}
          {isFootball && (details?.homeStats?.totalYards !== undefined || details?.awayStats?.totalYards !== undefined) && (
            <div className="detail-section">
              <h3 className="section-title">Team Stats</h3>
              <div className="stats-grid">
                <div className="stats-header">
                  <span className="stats-team-name">{game.awayTeam.abbreviation}</span>
                  <span className="stats-spacer"></span>
                  <span className="stats-team-name">{game.homeTeam.abbreviation}</span>
                </div>
                <StatRow
                  label="Total Yards"
                  away={String(details?.awayStats?.totalYards ?? '-')}
                  home={String(details?.homeStats?.totalYards ?? '-')}
                />
                {(details?.homeStats?.passingYards !== undefined || details?.awayStats?.passingYards !== undefined) && (
                  <StatRow
                    label="Passing"
                    away={String(details?.awayStats?.passingYards ?? '-')}
                    home={String(details?.homeStats?.passingYards ?? '-')}
                  />
                )}
                {(details?.homeStats?.rushingYards !== undefined || details?.awayStats?.rushingYards !== undefined) && (
                  <StatRow
                    label="Rushing"
                    away={String(details?.awayStats?.rushingYards ?? '-')}
                    home={String(details?.homeStats?.rushingYards ?? '-')}
                  />
                )}
                {(details?.homeStats?.firstDowns !== undefined || details?.awayStats?.firstDowns !== undefined) && (
                  <StatRow
                    label="First Downs"
                    away={String(details?.awayStats?.firstDowns ?? '-')}
                    home={String(details?.homeStats?.firstDowns ?? '-')}
                  />
                )}
                {(details?.homeStats?.thirdDownEff || details?.awayStats?.thirdDownEff) && (
                  <StatRow
                    label="3rd Down"
                    away={details?.awayStats?.thirdDownEff || '-'}
                    home={details?.homeStats?.thirdDownEff || '-'}
                  />
                )}
                {(details?.homeStats?.turnovers !== undefined || details?.awayStats?.turnovers !== undefined) && (
                  <StatRow
                    label="Turnovers"
                    away={String(details?.awayStats?.turnovers ?? '-')}
                    home={String(details?.homeStats?.turnovers ?? '-')}
                  />
                )}
                {(details?.homeStats?.timeOfPossession || details?.awayStats?.timeOfPossession) && (
                  <StatRow
                    label="Possession"
                    away={details?.awayStats?.timeOfPossession || '-'}
                    home={details?.homeStats?.timeOfPossession || '-'}
                  />
                )}
              </div>
            </div>
          )}

          {(game.venue || details?.attendance) && (
            <div className="detail-footer">
              {game.venue && <div className="detail-venue">{game.venue}</div>}
              {details?.attendance && (
                <div className="detail-attendance">
                  Attendance: {details.attendance.toLocaleString()}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatRow({ label, away, home }: { label: string; away: string; home: string }) {
  return (
    <div className="stat-row">
      <span className="stat-value away">{away}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-value home">{home}</span>
    </div>
  )
}

// Position mapping for formation layout (row index, roughly)
const POSITION_ROWS: Record<string, number> = {
  'G': 0,           // Goalkeeper
  'LB': 1, 'RB': 1, 'CD-L': 1, 'CD-R': 1, 'CD': 1, 'CB': 1, 'D': 1, // Defenders
  'DM': 2, 'CDM': 2, 'LDM': 2, 'RDM': 2, // Defensive mids
  'CM': 3, 'LM': 3, 'RM': 3, 'M': 3, // Midfielders
  'AM': 4, 'AM-L': 4, 'AM-R': 4, 'CAM': 4, 'LW': 4, 'RW': 4, // Attacking mids/wingers
  'LF': 5, 'RF': 5, 'CF': 5, 'F': 5, 'ST': 5, 'S': 5, // Forwards
}

function FormationView({ lineup }: { lineup: TeamLineup }) {
  const starters = lineup.players.filter(p => p.starter)
  const subs = lineup.players.filter(p => !p.starter)

  // Group starters by position row
  const rows: Player[][] = [[], [], [], [], [], []]
  for (const player of starters) {
    const rowIndex = POSITION_ROWS[player.positionAbbr] ?? 3
    rows[rowIndex].push(player)
  }

  // Filter out empty rows
  const nonEmptyRows = rows.filter(row => row.length > 0)

  return (
    <div className="formation-view">
      <div className="formation-header">
        <span className="formation-team">{lineup.teamName}</span>
        {lineup.formation && <span className="formation-shape">{lineup.formation}</span>}
      </div>

      <div className="formation-pitch">
        {nonEmptyRows.map((row, i) => (
          <div key={i} className="formation-row">
            {row.map((player, j) => (
              <div key={j} className="formation-player">
                <span className="player-jersey">{player.jersey}</span>
                <span className="player-name">{player.name.split(' ').pop()}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {subs.length > 0 && (
        <div className="formation-subs">
          <h4 className="subs-title">Substitutes</h4>
          <div className="subs-list">
            {subs.map((player, i) => (
              <div key={i} className="sub-player">
                <span className="sub-jersey">{player.jersey}</span>
                <span className="sub-name">{player.name}</span>
                <span className="sub-pos">{player.positionAbbr}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
