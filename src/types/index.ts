export interface Player {
  id: number
  full_name: string
  first_name: string
  last_name: string
  is_active: boolean
}

export interface GameStat {
  game_id: string
  game_date: string
  matchup: string
  minutes: number
  points: number
  rebounds: number
  assists: number
}

export interface StatAverages {
  points: number
  rebounds: number
  assists: number
  minutes: number
}

export interface SeasonAnalysis {
  player_id: number
  season: string
  games_played: number
  averages: StatAverages
  last_5_games: StatAverages
  last_10_games: StatAverages
  trend: {
    points_vs_season_average: number
    rebounds_vs_season_average: number
    assists_vs_season_average: number
  }
}

export interface PointsByPeriodAverage {
  player_id: number
  season: string
  games_analyzed: number
  points_by_period_average: Record<string, number>
  total_average: number
  errors: { game_id: string; reason: string }[]
}

export interface LiveTeam {
  team_id: number
  name: string
  tricode: string
  score: number
}

export interface LiveGame {
  game_id: string
  game_status: string
  period: number
  clock: string
  /** ISO 8601 UTC. Front converte pro timezone local do usuário. */
  game_time_utc?: string | null
  home_team: LiveTeam
  away_team: LiveTeam
}

export interface TodayGames {
  date: string
  games: LiveGame[]
}

export interface HotRankingPlayer {
  player_id: number
  name: string
  team: string
  minutes: number
  current_points: number
  current_assists: number
  current_rebounds: number
  expected_points: number
  expected_assists: number
  expected_rebounds: number
  points_diff: number
  assists_diff: number
  rebounds_diff: number
  projected_points: number
  projected_assists: number
  projected_rebounds: number
  pace_projection_points: PaceProjection
  pace_projection_assists: PaceProjection
  pace_projection_rebounds: PaceProjection
  fouls: number
  foul_trouble: boolean
  blowout_risk: boolean
  on_court: boolean
  status: string
  score: number
}

export interface PaceProjection {
  low: number
  expected: number
  high: number
}

export interface HotRanking {
  game_id: string
  limit: number
  ranking: HotRankingPlayer[]
}

export interface LiveCurrentStats {
  points: number
  rebounds: number
  assists: number
}

export interface LivePlayerAnalysis {
  player_id: number
  name: string
  team: string
  minutes: number
  fouls: number
  on_court: boolean
  current: LiveCurrentStats
  season_average: StatAverages
  expected_until_now: LiveCurrentStats
  difference: LiveCurrentStats
  status: string
  score: number
}

export interface LiveGameAnalysis {
  game_id: string
  season: string
  game_status: string
  period: number
  clock: string
  analysis_type: string
  players: LivePlayerAnalysis[]
  hot_players: LivePlayerAnalysis[]
  cold_players: LivePlayerAnalysis[]
  errors: { player_id: number; name: string; reason: string }[]
}
