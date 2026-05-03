import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api } from '../services/api'
import type { Player, SeasonAnalysis, GameStat, PointsByPeriodAverage } from '../types'

const SEASONS = ['2025-26', '2024-25', '2023-24', '2022-23']

function StatCard({
  label, value, last5,
}: { label: string; value: number; last5: number }) {
  const diff = +(last5 - value).toFixed(1)
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className={`text-xs mt-1 ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-500'}`}>
        Últ. 5: {last5} ({diff > 0 ? '+' : ''}{diff})
      </p>
    </div>
  )
}

function TrendChip({ label, value }: { label: string; value: number }) {
  const pos = value > 0.5
  const neg = value < -0.5
  return (
    <div className={`rounded-lg p-3 border ${pos ? 'bg-green-500/10 border-green-500/30' : neg ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
      <p className="text-slate-400 text-xs mb-1">{label} · últ. 5 jogos</p>
      <p className={`text-xl font-bold ${pos ? 'text-green-400' : neg ? 'text-red-400' : 'text-slate-300'}`}>
        {value > 0 ? '+' : ''}{value}
      </p>
    </div>
  )
}

export default function PlayersPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Player[]>([])
  const [player, setPlayer] = useState<Player | null>(null)
  const [season, setSeason] = useState('2025-26')
  const [analysis, setAnalysis] = useState<SeasonAnalysis | null>(null)
  const [gameStats, setGameStats] = useState<GameStat[]>([])
  const [periodData, setPeriodData] = useState<PointsByPeriodAverage | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingPeriod, setLoadingPeriod] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.searchPlayers(query)
        setResults(res.data.slice(0, 8))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  // Fetch season analysis + game stats when player/season changes
  useEffect(() => {
    if (!player) return
    setLoadingStats(true)
    setError(null)
    setAnalysis(null)
    setGameStats([])
    setPeriodData(null)

    Promise.all([
      api.getSeasonAnalysis(player.id, season),
      api.getGameStats(player.id, season),
    ])
      .then(([a, g]) => {
        setAnalysis(a.data)
        setGameStats(g.data)
      })
      .catch((err) => {
        const status = err?.response?.status
        if (status === 502 || status === 504) {
          setError('stats_blocked')
        } else {
          const msg = err?.response?.data?.detail || err?.message || String(err)
          setError(`Erro ao buscar dados: ${msg}`)
        }
      })
      .finally(() => setLoadingStats(false))
  }, [player, season])

  const selectPlayer = (p: Player) => {
    setPlayer(p)
    setQuery('')
    setResults([])
  }

  const clearPlayer = () => {
    setPlayer(null)
    setAnalysis(null)
    setGameStats([])
    setPeriodData(null)
    setError(null)
  }

  const loadPeriod = async () => {
    if (!player) return
    setLoadingPeriod(true)
    try {
      const res = await api.getPointsByPeriod(player.id, season, 10)
      setPeriodData(res.data)
    } catch {
      setError('Erro ao buscar pontos por quarto.')
    } finally {
      setLoadingPeriod(false)
    }
  }

  // Chart data — reverse to oldest→newest, last 20 games
  const chartData = [...gameStats]
    .reverse()
    .slice(-20)
    .map(g => ({
      date: g.game_date.replace(/(\w{3})\w*\s(\d+),.*/, '$1 $2'),
      pts: g.points,
      reb: g.rebounds,
      ast: g.assists,
    }))

  const periodChartData = periodData
    ? Object.entries(periodData.points_by_period_average)
        .sort(([a], [b]) => (a === 'OT' ? 1 : b === 'OT' ? -1 : +a - +b))
        .map(([p, avg]) => ({ quarter: p === 'OT' ? 'OT' : `Q${p}`, avg }))
    : []

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      color: '#f1f5f9',
    },
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Search */}
      <div className="relative mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar jogador... (ex: LeBron, Curry, Tatum)"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
        />
        {searching && (
          <span className="absolute right-4 top-3.5 text-slate-400 text-sm">Buscando...</span>
        )}

        {results.length > 0 && !player && (
          <div className="absolute w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-10">
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => selectPlayer(p)}
                className="w-full text-left px-4 py-3 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 flex items-center justify-between transition-colors"
              >
                <span className="text-slate-100">{p.full_name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                  {p.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Player header */}
      {player && (
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{player.full_name}</h2>
            <button
              onClick={clearPlayer}
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              ✕ trocar
            </button>
          </div>
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-orange-500"
          >
            {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`rounded-xl p-4 mb-6 text-sm ${error === 'stats_blocked' ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
          {error === 'stats_blocked' ? (
            <>
              <p className="text-yellow-400 font-semibold mb-1">⚠️ API de estatísticas da NBA indisponível no momento</p>
              <p className="text-yellow-400/70 text-xs leading-relaxed">
                O <strong>stats.nba.com</strong> está bloqueando requisições automáticas agora. Isso é temporário e costuma resolver durante os jogos ao vivo. Tente novamente em alguns minutos.
              </p>
            </>
          ) : (
            <span className="text-red-400">{error}</span>
          )}
        </div>
      )}

      {/* Loading */}
      {loadingStats && (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <div className="text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p>Carregando dados de {player?.full_name}...</p>
          </div>
        </div>
      )}

      {/* Stats */}
      {analysis && !loadingStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard label="Pontos" value={analysis.averages.points} last5={analysis.last_5_games.points} />
            <StatCard label="Rebotes" value={analysis.averages.rebounds} last5={analysis.last_5_games.rebounds} />
            <StatCard label="Assistências" value={analysis.averages.assists} last5={analysis.last_5_games.assists} />
            <StatCard label="Minutos" value={analysis.averages.minutes} last5={analysis.last_5_games.minutes} />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <TrendChip label="PTS vs Média" value={analysis.trend.points_vs_season_average} />
            <TrendChip label="REB vs Média" value={analysis.trend.rebounds_vs_season_average} />
            <TrendChip label="AST vs Média" value={analysis.trend.assists_vs_season_average} />
          </div>

          <p className="text-slate-500 text-xs mb-6">
            {analysis.games_played} jogos na temporada {analysis.season}
          </p>
        </>
      )}

      {/* Game chart */}
      {chartData.length > 0 && !loadingStats && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-4">
          <h3 className="text-white font-semibold mb-4">Desempenho por Jogo — últimos {chartData.length}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <Line type="monotone" dataKey="pts" name="Pontos" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="reb" name="Rebotes" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="ast" name="Assistências" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Points by quarter */}
      {player && !loadingStats && analysis && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">Pontos por Quarto</h3>
              <p className="text-slate-500 text-xs mt-0.5">Média dos últimos 10 jogos via play-by-play</p>
            </div>
            {!periodData && (
              <button
                onClick={loadPeriod}
                disabled={loadingPeriod}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {loadingPeriod ? 'Carregando...' : 'Carregar'}
              </button>
            )}
          </div>

          {loadingPeriod && (
            <p className="text-slate-500 text-sm">
              Buscando play-by-play de 10 jogos... pode levar até 2 minutos. ☕
            </p>
          )}

          {periodData && periodChartData.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={periodChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="quarter" tick={{ fill: '#64748b' }} />
                  <YAxis tick={{ fill: '#64748b' }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="avg" name="Média de Pontos" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-slate-500 text-xs mt-3">
                {periodData.games_analyzed} jogos analisados · Total médio: {periodData.total_average} pts
                {periodData.errors.length > 0 && ` · ${periodData.errors.length} jogo(s) com erro ignorados`}
              </p>
            </>
          )}
        </div>
      )}

      {/* Recent games table */}
      {gameStats.length > 0 && !loadingStats && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <h3 className="text-white font-semibold p-5 border-b border-slate-700">Últimos Jogos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-500 text-xs">
                  <th className="text-left p-4">Data</th>
                  <th className="text-left p-4">Partida</th>
                  <th className="text-center p-4">MIN</th>
                  <th className="text-center p-4">PTS</th>
                  <th className="text-center p-4">REB</th>
                  <th className="text-center p-4">AST</th>
                </tr>
              </thead>
              <tbody>
                {gameStats.slice(0, 15).map(g => (
                  <tr key={g.game_id} className="border-b border-slate-700/40 hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 text-slate-400">{g.game_date}</td>
                    <td className="p-4 text-slate-200">{g.matchup}</td>
                    <td className="p-4 text-slate-400 text-center">{g.minutes}</td>
                    <td className="p-4 text-white text-center font-bold">{g.points}</td>
                    <td className="p-4 text-slate-300 text-center">{g.rebounds}</td>
                    <td className="p-4 text-slate-300 text-center">{g.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!player && !loadingStats && (
        <div className="flex flex-col items-center justify-center py-32 text-slate-600">
          <div className="text-6xl mb-4">🏀</div>
          <p className="text-lg font-medium">Busque um jogador para começar</p>
          <p className="text-sm mt-1">LeBron James, Jayson Tatum, Stephen Curry...</p>
        </div>
      )}
    </div>
  )
}
