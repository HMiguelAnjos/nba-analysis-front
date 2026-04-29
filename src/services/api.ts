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

const client = axios.create({
  baseURL: 'http://localhost:8000',
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
