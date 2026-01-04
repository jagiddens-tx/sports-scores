import { useEffect, useState } from 'react'
import type { Game, GameEvent, TeamStats } from '../types'
import './GameDetail.css'

interface Props {
  game: Game
  sportId: string
}

interface GameDetails {
  events: GameEvent[]
  homeStats?: TeamStats
  awayStats?: TeamStats
  attendance?: number
}

const SPORT_SLUGS: Record<string, string> = {
  epl: 'soccer/eng.1',
  mls: 'soccer/usa.1',
}

export function GameDetail({ game, sportId }: Props) {
  const [details, setDetails] = useState<GameDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDetails = async () => {
      const slug = SPORT_SLUGS[sportId]
      if (!slug) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`
        )
        const data = await res.json()

        const event = data.events?.find((e: any) => e.id === game.id)
        if (!event) {
          setLoading(false)
          return
        }

        const competition = event.competitions?.[0]
        if (!competition) {
          setLoading(false)
          return
        }

        const events: GameEvent[] = (competition.details || []).map((d: any) => {
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

        setDetails({
          events,
          homeStats: parseStats(homeTeam),
          awayStats: parseStats(awayTeam),
          attendance: competition.attendance,
        })
      } catch (err) {
        console.error('Failed to fetch game details:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()
  }, [game.id, sportId])

  const goals = details?.events.filter(e => e.type === 'goal') || []
  const cards = details?.events.filter(e => e.type === 'yellow_card' || e.type === 'red_card') || []

  const hasContent = goals.length > 0 || cards.length > 0 ||
    details?.homeStats?.possession || details?.awayStats?.possession

  return (
    <div className="game-detail-expanded">
      {loading && <div className="detail-loading">Loading details...</div>}

      {!loading && !hasContent && (
        <div className="detail-note">No match events yet</div>
      )}

      {!loading && hasContent && (
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
                    <img
                      src={event.teamId === game.homeTeam.id ? game.homeTeam.logo : game.awayTeam.logo}
                      alt=""
                      className="event-team-logo"
                    />
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
                    <img
                      src={event.teamId === game.homeTeam.id ? game.homeTeam.logo : game.awayTeam.logo}
                      alt=""
                      className="event-team-logo"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats comparison */}
          {(details?.homeStats?.possession || details?.awayStats?.possession) && (
            <div className="detail-section">
              <h3 className="section-title">Match Stats</h3>
              <div className="stats-grid">
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

          {details?.attendance && (
            <div className="detail-attendance">
              Attendance: {details.attendance.toLocaleString()}
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
