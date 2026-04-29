import axios from 'axios'
import type {
  Player,
  SeasonAnalysis,
  GameStat,
  PointsByPeriodAverage,
  TodayGames,
  HotRanking,
  LiveGameAnalysis,
} from '../types'

const runtimeApiUrl = (
  window as Window & { __APP_CONFIG__?: { VITE_API_URL?: string } }
).__APP_CONFIG__?.VITE_API_URL

const normalizeApiUrl = (value?: string) => {
  if (!value) return undefined
  const unquoted = value.trim().replace(/^['\"]|['\"]$/g, '')
  const trimmed = unquoted.replace(/\/$/, '')
  if (!trimmed) return undefined

  // If env value comes as "/api.example.com", treat it as host instead of relative path.
  const withoutLeadingSlashes = trimmed.replace(/^\/+/, '')

  if (/^https?:\/\//i.test(withoutLeadingSlashes)) {
    return withoutLeadingSlashes
  }

  return `https://${withoutLeadingSlashes}`
}

const apiBaseUrl =
  (normalizeApiUrl(runtimeApiUrl) ? '/api' : undefined) ||
  normalizeApiUrl(import.meta.env.VITE_API_URL) ||
  'http://localhost:8080'

const client = axios.create({
  baseURL: apiBaseUrl,
  timeout: 180_000, // 3 min — PBP requests são lentos
})

export const api = {
  searchPlayers: (name: string) =>
    client.get<Player[]>('/players/search', { params: { name } }),

  getSeasonAnalysis: (playerId: number, season: string) =>
    client.get<SeasonAnalysis>(`/players/${playerId}/analysis/season`, {
      params: { season },
    }),

  getGameStats: (playerId: number, season: string) =>
    client.get<GameStat[]>(`/players/${playerId}/stats/games`, {
      params: { season },
    }),

  getPointsByPeriod: (playerId: number, season: string, lastGames = 10) =>
    client.get<PointsByPeriodAverage>(
      `/players/${playerId}/analysis/points-by-period`,
      { params: { season, last_games: lastGames } },
    ),

  getTodayGames: () => client.get<TodayGames>('/games/live/today'),

  getHotRanking: (gameId: string, season: string, limit = 10) =>
    client.get<HotRanking>(`/games/${gameId}/live-hot-ranking`, {
      params: { season, limit },
    }),

  getLiveAnalysis: (gameId: string, season: string) =>
    client.get<LiveGameAnalysis>(`/games/${gameId}/live-analysis`, {
      params: { season },
    }),
}
