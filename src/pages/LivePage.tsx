import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { TodayGames, LiveGame, HotRanking, LiveGameAnalysis } from '../types'

function getCurrentSeason(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 10
    ? `${year}-${String(year + 1).slice(2)}`
    : `${year - 1}-${String(year).slice(2)}`
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Ao vivo',
  final: 'Finalizado',
}

const STATUS_COLORS: Record<string, string> = {
  hot: 'bg-red-500/20 text-red-400 border border-red-500/30',
  above_average: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  normal: 'bg-slate-700 text-slate-400 border border-slate-600',
  below_average: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  cold: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
}

const STATUS_EMOJI: Record<string, string> = {
  hot: '🔥',
  above_average: '📈',
  normal: '➡️',
  below_average: '📉',
  cold: '🥶',
}

function GameCard({
  game,
  selected,
  onClick,
}: {
  game: LiveGame
  selected: boolean
  onClick: () => void
}) {
  const live = game.game_status === 'in_progress'
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-slate-800 rounded-xl p-4 border transition-all ${
        selected ? 'border-orange-500 shadow-lg shadow-orange-500/10' : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-medium ${live ? 'text-green-400' : 'text-slate-500'}`}>
          {live && '🔴 '}
          {STATUS_LABELS[game.game_status] ?? game.game_status}
          {live && ` · Q${game.period} ${game.clock}`}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <p className="text-slate-300 font-semibold text-sm">{game.away_team.tricode}</p>
          <p className="text-3xl font-bold text-white mt-1">{game.away_team.score}</p>
        </div>
        <span className="text-slate-600 text-xs px-3">@</span>
        <div className="text-center flex-1">
          <p className="text-slate-300 font-semibold text-sm">{game.home_team.tricode}</p>
          <p className="text-3xl font-bold text-white mt-1">{game.home_team.score}</p>
        </div>
      </div>
      <p className="text-slate-600 text-xs mt-3 truncate">
        {game.away_team.name} vs {game.home_team.name}
      </p>
    </button>
  )
}

export default function LivePage() {
  const season = getCurrentSeason()
  const [todayGames, setTodayGames] = useState<TodayGames | null>(null)
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null)
  const [ranking, setRanking] = useState<HotRanking | null>(null)
  const [analysis, setAnalysis] = useState<LiveGameAnalysis | null>(null)
  const [loadingGames, setLoadingGames] = useState(false)
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingGames(true)
    api.getTodayGames()
      .then(r => setTodayGames(r.data))
      .catch((err) => {
        const msg = err?.response?.data?.detail || err?.message || String(err)
        setError(`Erro ao buscar jogos: ${msg}`)
      })
      .finally(() => setLoadingGames(false))
  }, [])

  const selectGame = async (game: LiveGame) => {
    setSelectedGame(game)
    setRanking(null)
    setAnalysis(null)
    setError(null)
    setLoadingRanking(true)
    try {
      const r = await api.getHotRanking(game.game_id, season, 10)
      setRanking(r.data)
    } catch {
      setError('Erro ao buscar hot ranking. O jogo pode ainda não ter começado.')
    } finally {
      setLoadingRanking(false)
    }
  }

  const loadAnalysis = async () => {
    if (!selectedGame) return
    setLoadingAnalysis(true)
    setError(null)
    try {
      const r = await api.getLiveAnalysis(selectedGame.game_id, season)
      setAnalysis(r.data)
    } catch {
      setError('Erro ao buscar análise completa.')
    } finally {
      setLoadingAnalysis(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Jogos ao Vivo</h2>
        <span className="text-slate-500 text-sm bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
          Temporada {season}
        </span>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {loadingGames && (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <p>Carregando jogos do dia...</p>
        </div>
      )}

      {todayGames && (
        <>
          <p className="text-slate-500 text-sm mb-4">
            {todayGames.date} · {todayGames.games.length} jogo(s)
          </p>

          {todayGames.games.length === 0 ? (
            <div className="text-center py-20 text-slate-600">
              <div className="text-5xl mb-3">📅</div>
              <p>Nenhum jogo agendado para hoje.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {todayGames.games.map(g => (
                <GameCard
                  key={g.game_id}
                  game={g}
                  selected={selectedGame?.game_id === g.game_id}
                  onClick={() => selectGame(g)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Selected game panel */}
      {selectedGame && (
        <div className="border-t border-slate-700 pt-6">
          <h3 className="text-xl font-bold text-white mb-6">
            {selectedGame.away_team.tricode} @ {selectedGame.home_team.tricode}
            <span className="text-slate-500 font-normal text-sm ml-3">
              {selectedGame.game_status === 'in_progress'
                ? `Q${selectedGame.period} ${selectedGame.clock}`
                : STATUS_LABELS[selectedGame.game_status]}
            </span>
          </h3>

          {loadingRanking && <p className="text-slate-500 text-sm mb-6">Carregando hot ranking...</p>}

          {/* Hot Ranking */}
          {ranking && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
              <h4 className="text-white font-semibold mb-4">🔥 Hot Ranking</h4>

              {ranking.ranking.length === 0 ? (
                <p className="text-slate-500 text-sm">Nenhum jogador com dados suficientes ainda.</p>
              ) : (
                <div className="space-y-3">
                  {ranking.ranking.map((p, i) => (
                    <div key={p.player_id} className="flex items-center gap-3">
                      <span className="text-slate-600 w-5 text-sm font-mono">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">{p.name}</span>
                          <span className="text-slate-500 text-xs">{p.team}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                            {STATUS_EMOJI[p.status]} {p.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                          <span title="Pontos marcados no jogo atual">
                            <span className="text-slate-400 font-medium">{p.current_points}</span> pts marcados
                          </span>
                          <span title="Pontos esperados proporcionalmente aos minutos jogados vs. média da temporada">
                            · esperado: <span className="text-slate-400">{p.expected_points}</span>
                          </span>
                          <span
                            title="Diferença entre pontos marcados e esperados"
                            className={p.points_diff >= 0 ? 'text-green-400' : 'text-red-400'}
                          >
                            ({p.points_diff >= 0 ? '+' : ''}{p.points_diff} vs esperado)
                          </span>
                          <span title="Score composto: diferença de pts × 1.0 + reb × 0.7 + ast × 0.8">
                            · score: <span className="text-slate-400 font-medium">{p.score}</span>
                          </span>
                        </div>
                      </div>
                      <span className="text-slate-500 text-xs shrink-0" title="Minutos jogados no jogo atual">{p.minutes} min jogados</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Load full analysis */}
          {!analysis && !loadingAnalysis && ranking && (
            <button
              onClick={loadAnalysis}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2.5 rounded-xl text-sm border border-slate-700 transition-colors mb-6"
            >
              📊 Carregar análise completa
              <span className="text-slate-500 text-xs">(pode levar 1–3 min na 1ª vez)</span>
            </button>
          )}

          {loadingAnalysis && (
            <p className="text-slate-500 text-sm mb-6">
              Buscando médias da temporada de cada jogador... ☕ Aguarde.
            </p>
          )}

          {/* Full analysis table */}
          {analysis && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-white font-semibold">Análise Completa</h4>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {analysis.players.length} jogadores · {analysis.analysis_type}
                  </p>
                </div>
                {analysis.errors.length > 0 && (
                  <span className="text-slate-500 text-xs">
                    {analysis.errors.length} sem dados
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-500 text-xs">
                      <th className="text-left p-4">Jogador</th>
                      <th className="text-center p-4">Time</th>
                      <th className="text-center p-4">Min</th>
                      <th className="text-center p-4">PTS</th>
                      <th className="text-center p-4">Esp.</th>
                      <th className="text-center p-4">Diff</th>
                      <th className="text-center p-4">REB</th>
                      <th className="text-center p-4">AST</th>
                      <th className="text-center p-4">Status</th>
                      <th className="text-center p-4">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...analysis.players]
                      .sort((a, b) => b.score - a.score)
                      .map(p => (
                        <tr
                          key={p.player_id}
                          className="border-b border-slate-700/40 hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="p-4 text-white font-medium">{p.name}</td>
                          <td className="p-4 text-slate-400 text-center">{p.team}</td>
                          <td className="p-4 text-slate-400 text-center">{p.minutes}</td>
                          <td className="p-4 text-white text-center font-bold">{p.current.points}</td>
                          <td className="p-4 text-slate-500 text-center">{p.expected_until_now.points}</td>
                          <td className={`p-4 text-center font-semibold ${p.difference.points > 0 ? 'text-green-400' : p.difference.points < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {p.difference.points > 0 ? '+' : ''}{p.difference.points}
                          </td>
                          <td className="p-4 text-slate-300 text-center">{p.current.rebounds}</td>
                          <td className="p-4 text-slate-300 text-center">{p.current.assists}</td>
                          <td className="p-4 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                              {STATUS_EMOJI[p.status]} {p.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300 text-center font-mono">{p.score}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
