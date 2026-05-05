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

export interface BlowoutRisk {
  percentage: number              // 0–100
  level: 'low' | 'medium' | 'high' | 'final'
  reason: string
}

export interface HotRanking {
  game_id: string
  limit: number
  ranking: HotRankingPlayer[]
  // Estado do jogo no momento do snapshot — front usa pra atualizar
  // placar/relógio sem refazer chamada ao scoreboard.
  game_status: string             // not_started | in_progress | final
  period: number
  clock: string
  home_score: number
  away_score: number
  blowout_risk: BlowoutRisk
  updated_at: string              // ISO 8601 UTC
}

// ─── Lineups ────────────────────────────────────────────────────────────────

export interface LineupPlayer {
  player_id: number
  name: string
  jersey_num: string
  position: string
  is_starter: boolean
  is_on_court: boolean
  played: boolean
  status: string                  // "ACTIVE" | "INACTIVE"
  not_playing_reason: string | null
  photo_url: string
  minutes: number
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fouls: number
  field_goals_made: number
  field_goals_attempted: number
  three_pointers_made: number
  three_pointers_attempted: number
  free_throws_made: number
  free_throws_attempted: number
  plus_minus: number
  performance_rating: number      // 0–10
  performance_label: string       // Excelente | Bom | Regular | Ruim | N/A
  low_confidence: boolean         // <10 min jogados
}

export interface LineupTeam {
  team_id: number
  name: string
  tricode: string
  score: number
  starters: LineupPlayer[]
  bench: LineupPlayer[]
  inactive: LineupPlayer[]
}

export interface LineupGame {
  game_id: string
  game_status: string
  period: number
  clock: string
  home_team: LineupTeam
  away_team: LineupTeam
  blowout_risk: BlowoutRisk
  updated_at: string
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
