import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { SkeletonGameGrid, SkeletonPlayerRow } from '../components/Skeleton'
import { EmptyState, InlineError } from '../components/States'
import type { BlowoutRisk, LineupGame, LineupPlayer, LineupTeam, LiveGame, TodayGames } from '../types'

// ─── Badge discreto de risco de blowout ────────────────────────────────────
// Aparece só em jogos ao vivo. Em finalizados, vira "Encerrado".
// Tooltip mostra a razão calculada no backend (período, diferença, tempo).
function BlowoutBadge({ risk }: { risk: BlowoutRisk }) {
  if (risk.level === 'final') {
    return null  // o estado "encerrado" já aparece em outro lugar
  }
  if (risk.level === 'low' && risk.percentage <= 5) {
    return null  // jogo equilibrado: não polui a UI
  }

  const styles = {
    low:    'bg-slate-700/60 text-slate-300 border-slate-600',
    medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    high:   'bg-red-500/15 text-red-300 border-red-500/40',
    final:  'bg-slate-700/60 text-slate-400 border-slate-600',
  }[risk.level]

  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${styles} cursor-help select-none`}
      title={risk.reason}
    >
      💥 Blowout: {risk.percentage}%
    </span>
  )
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Ao vivo',
  final: 'Finalizado',
}

// ─── Cor da nota ─────────────────────────────────────────────────────────────
function ratingColor(rating: number, label: string): string {
  if (label === 'N/A') return 'text-slate-500'
  if (rating >= 8.5) return 'text-emerald-300'
  if (rating >= 7.0) return 'text-green-400'
  if (rating >= 5.0) return 'text-slate-300'
  return 'text-red-400'
}

// ─── Card individual do jogador ──────────────────────────────────────────────
function PlayerRow({ p }: { p: LineupPlayer }) {
  const ringClass = p.is_on_court
    ? 'ring-2 ring-emerald-500'
    : 'ring-1 ring-slate-700'

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700/60 p-3 flex items-center gap-3 ${p.is_on_court ? 'shadow-emerald-500/10 shadow-md' : ''}`}>
      <PlayerAvatar
        photoUrl={p.photo_url}
        name={p.name}
        size={48}
        ringClassName={ringClass}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white font-semibold text-sm truncate">{p.name}</span>
          {p.position && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">
              {p.position}
            </span>
          )}
          {p.is_on_court && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ● EM QUADRA
            </span>
          )}
          {p.status === 'INACTIVE' && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30"
              title={p.not_playing_reason || 'Inativo'}
            >
              ✕ INATIVO
            </span>
          )}
          {p.blowout_impact?.applies && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
              title={`Risco de descanso — ${p.blowout_impact.reason}. Esse jogador tem maior chance de perder minutos se o jogo virar blowout.`}
            >
              💥 Risco de descanso
            </span>
          )}
        </div>

        {/* Linha de stats compacta */}
        <div className="flex items-baseline gap-3 mt-1 text-xs text-slate-500 flex-wrap">
          <span className="whitespace-nowrap">
            {p.minutes > 0 ? `${p.minutes.toFixed(1)} min` : '—'}
          </span>
          {p.played && (
            <>
              <span className="whitespace-nowrap">
                <span className="text-slate-300 font-semibold">{p.points}</span> PTS
              </span>
              <span className="whitespace-nowrap">
                <span className="text-slate-300 font-semibold">{p.rebounds}</span> REB
              </span>
              <span className="whitespace-nowrap">
                <span className="text-slate-300 font-semibold">{p.assists}</span> AST
              </span>
            </>
          )}
          {p.status === 'INACTIVE' && p.not_playing_reason && (
            <span className="text-red-400/70 italic truncate">{p.not_playing_reason}</span>
          )}
        </div>
      </div>

      {/* Nota */}
      <div className="text-right shrink-0">
        <p className={`font-bold text-lg leading-none ${ratingColor(p.performance_rating, p.performance_label)}`}>
          {p.performance_label === 'N/A' ? '—' : p.performance_rating.toFixed(1)}
          {p.low_confidence && p.performance_label !== 'N/A' && (
            <span className="text-slate-600 text-xs ml-0.5" title="Pouca amostra (jogou pouco)">*</span>
          )}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          {p.performance_label}
        </p>
      </div>
    </div>
  )
}

// ─── Bloco de time ───────────────────────────────────────────────────────────
function TeamBlock({ team }: { team: LineupTeam }) {
  // Em quadra agora = tudo que tem is_on_court (geralmente 5; em pré-jogo, 0)
  const onCourt = [...team.starters, ...team.bench].filter(p => p.is_on_court)
  const startersOffCourt = team.starters.filter(p => !p.is_on_court)
  const benchOffCourt = team.bench.filter(p => !p.is_on_court)

  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-4">
      {/* Header do time */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="bg-slate-700 text-slate-200 text-sm font-bold px-3 py-1 rounded-lg border border-slate-600">
            {team.tricode}
          </span>
          <span className="text-slate-400 text-sm">{team.name}</span>
        </div>
        <span className="text-3xl font-bold text-white">{team.score}</span>
      </div>

      {/* Em quadra agora */}
      {onCourt.length > 0 && (
        <Section title="Em quadra agora" countTone="emerald" players={onCourt} />
      )}

      {/* Titulares fora de quadra (descansando) */}
      {startersOffCourt.length > 0 && (
        <Section
          title={onCourt.length > 0 ? 'Titulares descansando' : 'Titulares'}
          countTone="amber"
          players={startersOffCourt}
        />
      )}

      {/* Reservas */}
      {benchOffCourt.length > 0 && (
        <Section title="Reservas" countTone="slate" players={benchOffCourt} />
      )}

      {/* Inativos */}
      {team.inactive.length > 0 && (
        <Section title="Inativos" countTone="red" players={team.inactive} muted />
      )}
    </div>
  )
}

function Section({
  title, countTone, players, muted,
}: {
  title: string
  countTone: 'emerald' | 'amber' | 'slate' | 'red'
  players: LineupPlayer[]
  muted?: boolean
}) {
  const tones = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-300',
    slate: 'text-slate-400',
    red: 'text-red-400/70',
  }
  return (
    <div className={`mb-4 ${muted ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${tones[countTone]}`}>
          {title}
        </span>
        <span className="text-slate-600 text-xs">({players.length})</span>
        <div className="flex-1 h-px bg-slate-700/50" />
      </div>
      <div className="space-y-2">
        {players.map(p => <PlayerRow key={p.player_id} p={p} />)}
      </div>
    </div>
  )
}

// ─── GameCard mini (selector) ────────────────────────────────────────────────
function GameSelector({ game, selected, onClick }: { game: LiveGame; selected: boolean; onClick: () => void }) {
  const live = game.game_status === 'in_progress'
  return (
    <button
      onClick={onClick}
      className={[
        'text-left p-3 rounded-xl border w-full',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-brand-500/40',
        selected
          ? 'bg-slate-800 border-brand-500 shadow-glow'
          : 'bg-slate-800/70 border-slate-700/70 hover:border-slate-500 hover:-translate-y-0.5 shadow-soft',
      ].join(' ')}
    >
      <p className={`text-xs font-medium mb-2 ${live ? 'text-brand-400' : 'text-slate-500'}`}>
        {live && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 mr-1.5 animate-pulse-subtle" />
        )}
        {STATUS_LABELS[game.game_status] ?? game.game_status}
        {live && ` · Q${game.period} ${game.clock}`}
      </p>
      <div className="flex items-center justify-between tabular">
        <span className="text-slate-200 font-bold">{game.away_team.tricode} <span className="text-slate-300">{game.away_team.score}</span></span>
        <span className="text-slate-600 text-xs px-2">@</span>
        <span className="text-slate-200 font-bold">{game.home_team.tricode} <span className="text-slate-300">{game.home_team.score}</span></span>
      </div>
    </button>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function LineupsPage() {
  const [todayGames, setTodayGames]   = useState<TodayGames | null>(null)
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null)
  const [lineup, setLineup]           = useState<LineupGame | null>(null)
  const [loadingGames, setLoadingGames] = useState(false)
  const [loadingLineup, setLoadingLineup] = useState(false)
  const [gamesError, setGamesError]   = useState(false)
  const [lineupError, setLineupError] = useState(false)

  // Carrega jogos do dia
  const loadGames = async () => {
    setLoadingGames(true)
    try {
      const r = await api.getTodayGames()
      setTodayGames(r.data)
      setGamesError(false)
    } catch {
      setGamesError(true)
    } finally {
      setLoadingGames(false)
    }
  }

  useEffect(() => {
    loadGames()
  }, [])

  // Auto-retry da lista de jogos
  useEffect(() => {
    if (!gamesError) return
    const id = setTimeout(loadGames, 8_000)
    return () => clearTimeout(id)
  }, [gamesError])

  // Carrega lineup quando seleciona jogo
  const selectGame = async (game: LiveGame) => {
    setSelectedGame(game)
    setLineup(null)
    setLineupError(false)

    if (game.game_status === 'not_started') return

    setLoadingLineup(true)
    try {
      const r = await api.getLineup(game.game_id)
      setLineup(r.data)
    } catch {
      setLineupError(true)
    } finally {
      setLoadingLineup(false)
    }
  }

  // Polling do lineup a cada 10s (em jogos ao vivo). Reaproveita cache do
  // boxscore no backend (TTL 15s), sem custo adicional na NBA Live API.
  useEffect(() => {
    if (!selectedGame || selectedGame.game_status !== 'in_progress') return
    const tick = async () => {
      try {
        const r = await api.getLineup(selectedGame.game_id)
        setLineup(r.data)
      } catch {
        // mantém último snapshot bom
      }
    }
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [selectedGame])

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Elencos & Quadra</h2>
          <p className="text-slate-500 text-sm mt-1">
            Titulares, reservas e quem está em quadra agora — com nota de
            desempenho e foto oficial.
          </p>
        </div>
      </div>

      {gamesError && (
        <InlineError
          title="Não foi possível carregar a lista de jogos"
          description="Tentando de novo automaticamente em alguns segundos."
          onRetry={loadGames}
        />
      )}

      {loadingGames && !todayGames && (
        <SkeletonGameGrid count={6} />
      )}

      {todayGames && todayGames.games.length === 0 && (
        <EmptyState
          icon="📅"
          title="Nenhum jogo agendado para hoje"
          description="Volte amanhã ou confira o calendário oficial da NBA."
        />
      )}

      {/* Selector de jogos */}
      {todayGames && todayGames.games.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {todayGames.games.map(g => (
            <GameSelector
              key={g.game_id}
              game={g}
              selected={selectedGame?.game_id === g.game_id}
              onClick={() => selectGame(g)}
            />
          ))}
        </div>
      )}

      {/* Jogo selecionado */}
      {selectedGame && (
        <div className="border-t border-slate-700 pt-6">
          {selectedGame.game_status === 'not_started' && (
            <EmptyState
              icon="⏰"
              title="Aguardando início do jogo"
              description="A escalação aparece quando a partida começar."
            />
          )}

          {loadingLineup && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[0, 1].map(i => (
                <div key={i} className="card p-4 space-y-3">
                  <div className="skeleton h-6 w-32" />
                  <SkeletonPlayerRow />
                  <SkeletonPlayerRow />
                  <SkeletonPlayerRow />
                  <SkeletonPlayerRow />
                  <SkeletonPlayerRow />
                </div>
              ))}
            </div>
          )}

          {lineupError && (
            <InlineError
              tone="red"
              title="Erro ao buscar elencos"
              description="Tente novamente em alguns segundos."
              onRetry={() => selectedGame && selectGame(selectedGame)}
            />
          )}

          {lineup && (
            <>
              {/* Header com placar live + risco de blowout discreto */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4 px-1">
                <div className="text-sm text-slate-400">
                  {lineup.game_status === 'in_progress' && (
                    <span className="text-green-400 font-medium">🔴 Q{lineup.period} {lineup.clock}</span>
                  )}
                  {lineup.game_status === 'final' && (
                    <span className="text-slate-400 font-medium">🏁 Encerrado</span>
                  )}
                  <span className="ml-3 text-slate-500">
                    {lineup.away_team.tricode} {lineup.away_team.score} @ {lineup.home_team.tricode} {lineup.home_team.score}
                  </span>
                </div>
                <BlowoutBadge risk={lineup.blowout_risk} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TeamBlock team={lineup.away_team} />
                <TeamBlock team={lineup.home_team} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
