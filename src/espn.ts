export const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports'

// ESPN only returns Top 25 games/teams for college sports unless a division
// group is requested: 80 = FBS football, 50 = Division I men's basketball.
const COLLEGE_GROUPS: Record<string, string> = {
  'football/college-football': '80',
  'basketball/mens-college-basketball': '50',
}

export function scoreboardUrl(slug: string) {
  const group = COLLEGE_GROUPS[slug]
  return group
    ? `${ESPN_API}/${slug}/scoreboard?groups=${group}&limit=500`
    : `${ESPN_API}/${slug}/scoreboard`
}

export function teamsUrl(slug: string) {
  const group = COLLEGE_GROUPS[slug]
  // College leagues have well over 100 teams, so don't let the list get cut off
  return group
    ? `${ESPN_API}/${slug}/teams?groups=${group}&limit=1000`
    : `${ESPN_API}/${slug}/teams?limit=1000`
}
