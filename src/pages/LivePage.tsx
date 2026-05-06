import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { PlayerAvatar, playerPhotoUrl } from '../components/PlayerAvatar'
import { LiveClock } from '../components/LiveClock'
import { SkeletonGameGrid, SkeletonPlayerRow } from '../components/Skeleton'
import { EmptyState, InlineError } from '../components/States'
import type { TodayGames, LiveGame, HotRanking, LiveGameAnalysis, HotRankingPlayer } from '../types'

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

// ─── Decision System ─────────────────────────────────────────────────────────

type Decision = 'STRONG_OVER' | 'LEAN_OVER' | 'NEUTRAL' | 'LEAN_UNDER' | 'STRONG_UNDER'

interface DecisionCfg {
  label: string
  emoji: string
  bannerBg: string
  bannerText: string
  borderLeft: string
}

const DECISION: Record<Decision, DecisionCfg> = {
  STRONG_OVER:  { label: 'APOSTAR FORTE', emoji: '🔥', bannerBg: 'bg-emerald-600/40', bannerText: 'text-emerald-200', borderLeft: 'border-l-4 border-l-emerald-500' },
  LEAN_OVER:    { label: 'APOSTAR',       emoji: '✅', bannerBg: 'bg-green-600/20',   bannerText: 'text-green-300',   borderLeft: 'border-l-4 border-l-green-500'   },
  NEUTRAL:      { label: 'OBSERVAR',      emoji: '👀', bannerBg: 'bg-slate-700/40',   bannerText: 'text-slate-400',   borderLeft: 'border-l-4 border-l-slate-600'   },
  LEAN_UNDER:   { label: 'EVITAR',        emoji: '⚠️', bannerBg: 'bg-red-600/20',    bannerText: 'text-red-300',     borderLeft: 'border-l-4 border-l-red-500'     },
  STRONG_UNDER: { label: 'EVITAR FORTE',  emoji: '❌', bannerBg: 'bg-red-800/30',    bannerText: 'text-red-200',     borderLeft: 'border-l-4 border-l-red-700'     },
}

function getDecision(score: number, pointsDiff: number): Decision {
  if (score >= 5 || pointsDiff > 4)               return 'STRONG_OVER'
  if (score >= 2 || pointsDiff > 1.5)             return 'LEAN_OVER'
  if (score > -2 && pointsDiff > -1.5)            return 'NEUTRAL'
  if (score > -5 && pointsDiff > -4)              return 'LEAN_UNDER'
  return 'STRONG_UNDER'
}

// ─── Per-stat decision (PTS / REB / AST tabs) ─────────────────────────────────

type StatTab = 'GERAL' | 'PTS' | 'REB' | 'AST'

const TAB_LABELS: Record<StatTab, string> = {
  GERAL: 'Geral',
  PTS:   'Pontos',
  REB:   'Rebotes',
  AST:   'Assistências',
}

const TAB_COLORS: Record<StatTab, string> = {
  GERAL: 'bg-slate-600 text-white',
  PTS:   'bg-orange-500 text-white',
  REB:   'bg-violet-500 text-white',
  AST:   'bg-sky-500 text-white',
}

// Threshold é PERCENTUAL sobre o esperado, não absoluto.
// Assim PTS/REB/AST são tratados de forma justa proporcionalmente:
// um jogador "+50% acima do esperado" é forte tanto se for em pontos
// (+12.5 numa média de 25) quanto em rebotes (+4 numa média de 8) ou
// assistências (+3 numa média de 6).
//
// Existe ainda um piso ABSOLUTO mínimo para evitar ruído: se o
// esperado é muito pequeno (poucos minutos jogados), uma diferença
// percentual gigante mas absolutamente pequena (ex: +1 reb sobre 0.5
// esperado = +200%) não vira STRONG.
// Mínimo de minutos jogados pra extrair sinal estatístico confiável.
// Abaixo disso, qualquer % de desvio é puro ruído — uma cesta a mais em
// 3 minutos vira "+200%" mas não tem nada de informativo. Ignoramos.
const MIN_MINUTES_FOR_SIGNAL = 5.0

function getDecisionForStat(p: HotRankingPlayer, tab: StatTab): Decision {
  if (tab === 'GERAL') return getDecision(p.score, p.points_diff)

  // Amostra pequena demais — não vira recomendação por mercado.
  if (p.minutes < MIN_MINUTES_FOR_SIGNAL) return 'NEUTRAL'

  let diff = 0
  let expected = 0
  let minAbs = 0   // floor absoluto para considerar STRONG/LEAN
  if (tab === 'PTS') { diff = p.points_diff;   expected = p.expected_points;   minAbs = 2   }
  if (tab === 'REB') { diff = p.rebounds_diff; expected = p.expected_rebounds; minAbs = 1   }
  if (tab === 'AST') { diff = p.assists_diff;  expected = p.expected_assists;  minAbs = 0.8 }

  // Sem baseline suficiente para julgar — sai de cena.
  if (expected < 0.5) return 'NEUTRAL'

  const pct = diff / expected

  // Para entrar em STRONG/LEAN, exige tanto o % quanto o piso absoluto.
  if (pct >  0.50 && diff >  minAbs * 1.5) return 'STRONG_OVER'
  if (pct >  0.18 && diff >  minAbs * 0.5) return 'LEAN_OVER'
  if (pct > -0.18 || Math.abs(diff) <= minAbs * 0.5) return 'NEUTRAL'
  if (pct > -0.50 || diff > -minAbs * 1.5) return 'LEAN_UNDER'
  return 'STRONG_UNDER'
}

// Valor numérico para ordenar/agrupar dentro de cada aba.
function getStatValue(p: HotRankingPlayer, tab: StatTab): number {
  if (tab === 'GERAL') return p.score
  if (tab === 'PTS')   return p.points_diff
  if (tab === 'REB')   return p.rebounds_diff
  return p.assists_diff
}

// ─── Cross-market opportunities ───────────────────────────────────────────────
// Para cada jogador, gera 3 oportunidades (uma por mercado), filtra as
// neutras e ordena pelas mais fortes. Permite mostrar uma lista plana
// de "melhores apostas agora" sem o usuário precisar trocar de aba.

type Market = 'PTS' | 'REB' | 'AST'

interface BettingOpportunity {
  player: HotRankingPlayer
  market: Market
  decision: Decision
  pct: number
  diff: number
  current: number
  expected: number
  projected: number
  projectionLow: number
  projectionHigh: number
}

function buildOpportunities(players: HotRankingPlayer[]): BettingOpportunity[] {
  const opps: BettingOpportunity[] = []
  for (const p of players) {
    const markets: Array<{
      m: Market; diff: number; expected: number; current: number;
      projection: { low: number; expected: number; high: number };
    }> = [
      { m: 'PTS', diff: p.points_diff,   expected: p.expected_points,   current: p.current_points,   projection: p.pace_projection_points   },
      { m: 'REB', diff: p.rebounds_diff, expected: p.expected_rebounds, current: p.current_rebounds, projection: p.pace_projection_rebounds },
      { m: 'AST', diff: p.assists_diff,  expected: p.expected_assists,  current: p.current_assists,  projection: p.pace_projection_assists  },
    ]
    for (const { m, diff, expected, current, projection } of markets) {
      const decision = getDecisionForStat(p, m)
      if (decision === 'NEUTRAL') continue
      const pct = expected > 0 ? diff / expected : 0
      opps.push({
        player: p, market: m, decision, pct, diff, current, expected,
        projected: projection.expected,
        projectionLow: projection.low,
        projectionHigh: projection.high,
      })
    }
  }
  // STRONG vem primeiro; depois ordena por |%| desviação.
  const rank = (d: Decision) =>
    d === 'STRONG_OVER'  ? 4 :
    d === 'LEAN_OVER'    ? 3 :
    d === 'LEAN_UNDER'   ? 2 :
    d === 'STRONG_UNDER' ? 1 : 0
  opps.sort((a, b) => {
    const dr = rank(b.decision) - rank(a.decision)
    if (dr !== 0) return dr
    return Math.abs(b.pct) - Math.abs(a.pct)
  })
  return opps
}

const MARKET_LABEL: Record<Market, string> = {
  PTS: 'PONTOS',
  REB: 'REBOTES',
  AST: 'ASSISTÊNCIAS',
}

const MARKET_BAR_COLOR: Record<Market, string> = {
  PTS: 'text-orange-300',
  REB: 'text-violet-300',
  AST: 'text-sky-300',
}

// ─── Auto-insight ─────────────────────────────────────────────────────────────

function autoInsight(p: HotRankingPlayer): string {
  if (p.minutes < 3) return '⏱️ Pouco tempo em quadra — dados insuficientes para análise'
  const ptsDiff = p.current_points  - p.expected_points
  const rebDiff = p.current_rebounds - p.expected_rebounds
  const astDiff = p.current_assists  - p.expected_assists
  if (p.score >= 5) return '🔥 Ritmo explosivo — muito acima do esperado para este momento'
  if (p.score >= 3) {
    if (ptsDiff > 5)  return `📈 Volume de pontos excelente — +${ptsDiff.toFixed(1)} acima do esperado`
    if (rebDiff > 3)  return `📈 Dominando no garrafão — +${rebDiff.toFixed(1)} REB acima do esperado`
    if (astDiff > 2)  return `📈 Ditando o ritmo — +${astDiff.toFixed(1)} AST acima do esperado`
    return '📈 Produção sólida acima da média proporcional ao tempo'
  }
  if (p.score >= 0) {
    if (p.projected_points > p.expected_points * 1.15) return '➡️ Dentro do esperado; projeção final levemente positiva'
    return '➡️ Desempenho alinhado com a média da temporada'
  }
  if (p.score > -3) {
    if (p.minutes > 24 && ptsDiff < -4) return '⚠️ Alto tempo em quadra, mas pontuação bem abaixo do ritmo'
    return '📉 Ligeiramente abaixo do esperado — pode reagir no 2º tempo'
  }
  if (p.score > -5) return `📉 Abaixo das expectativas — déficit de ${Math.abs(ptsDiff).toFixed(1)} PTS`
  return '🥶 Muito abaixo do esperado — jogo muito fraco até agora'
}

// ─── Stat Bar ─────────────────────────────────────────────────────────────────

const STAT_CFG: Record<string, { bar: string; text: string }> = {
  PTS: { bar: 'bg-orange-500', text: 'text-orange-300' },
  AST: { bar: 'bg-sky-500',    text: 'text-sky-300'    },
  REB: { bar: 'bg-violet-500', text: 'text-violet-300' },
}

function StatBar({
  label, actual, expected, diff, compact,
}: {
  label: 'PTS' | 'AST' | 'REB'
  actual: number
  expected: number
  diff: number
  compact?: boolean
}) {
  const cfg = STAT_CFG[label]
  const scale = Math.max(actual, expected, 1)
  const actualPct   = Math.min((actual / scale) * 100, 100)
  const expectedPct = Math.min((expected / scale) * 100, 100)
  const isAbove = diff >= 0

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold w-7 shrink-0 ${cfg.text}`}>{label}</span>
        <span className="text-white font-bold text-sm w-5">{actual}</span>
        <span className="text-slate-600 text-xs">/ {expected.toFixed(1)}</span>
        <span className={`text-xs font-semibold ml-auto ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-500'}`}>
          {diff > 0 ? '+' : ''}{diff.toFixed(1)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold w-7 shrink-0 ${cfg.text}`}>{label}</span>
      <div className="flex-1 relative h-2 bg-slate-700 rounded-full overflow-hidden">
        {/* Expected — background fill */}
        <div
          className="absolute inset-y-0 left-0 bg-slate-500/40 rounded-full"
          style={{ width: `${expectedPct}%` }}
        />
        {/* Actual — foreground fill */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${isAbove ? cfg.bar : 'bg-slate-500'}`}
          style={{ width: `${actualPct}%` }}
        />
      </div>
      <span className={`text-sm font-bold w-5 text-right shrink-0 ${isAbove ? 'text-white' : 'text-slate-400'}`}>
        {actual}
      </span>
      <span className="text-slate-500 text-xs w-8 shrink-0">/ {expected.toFixed(1)}</span>
      <span className={`text-xs font-bold w-10 text-right shrink-0 ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-500'}`}>
        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
      </span>
    </div>
  )
}

// ─── Projection Pill (helper) ─────────────────────────────────────────────────
// Pílula visual reaproveitada nos dois blocos de projeção (base + ritmo atual).
// `emphasized` deixa a borda mais viva pra destacar a projeção pelo ritmo atual,
// que é a leitura mais "quente"/imediata do jogo.

const PILL_COLOR: Record<'orange' | 'sky' | 'violet', { bg: string; text: string; sub: string; ring: string }> = {
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-300', sub: 'text-orange-400/50', ring: 'border-orange-500/40' },
  sky:    { bg: 'bg-sky-500/10',    text: 'text-sky-300',    sub: 'text-sky-400/50',    ring: 'border-sky-500/40'    },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-300', sub: 'text-violet-400/50', ring: 'border-violet-500/40' },
}

function ProjectionPill({
  color, value, label, emphasized,
}: {
  color: 'orange' | 'sky' | 'violet'
  value: number
  label: string
  emphasized?: boolean
}) {
  const c = PILL_COLOR[color]
  const border = emphasized ? c.ring : 'border-slate-700/40'
  return (
    <div className={`flex-1 text-center ${c.bg} rounded-lg py-2 border ${border}`}>
      <p className={`${c.text} font-bold text-lg leading-none`}>{value}</p>
      <p className={`${c.sub} text-xs mt-0.5`}>{label}</p>
    </div>
  )
}

// Pílula com projeção esperada + range (low–high) abaixo.
// Dá ao usuário a leitura central + a faixa de incerteza num só componente.
// Em jogos finalizados (isFinal=true), mostra apenas o valor real sem
// margem de erro nem range — não tem mais incerteza, é o stat final.
function RangeProjectionPill({
  color, projection, label, isFinal,
}: {
  color: 'orange' | 'sky' | 'violet'
  projection: { low: number; expected: number; high: number }
  label: string
  isFinal?: boolean
}) {
  const c = PILL_COLOR[color]
  return (
    <div className={`flex-1 text-center ${c.bg} rounded-lg py-2 px-1 border ${c.ring}`}>
      <p className={`${c.text} font-bold text-xl leading-none`}>{projection.expected}</p>
      {isFinal ? (
        <p className={`${c.sub} text-[10px] mt-1 uppercase tracking-wider font-semibold`}>Final</p>
      ) : (
        <p className={`${c.sub} text-[10px] mt-1`}>
          {projection.low} – {projection.high}
        </p>
      )}
      <p className={`${c.sub} text-xs mt-0.5 font-semibold`}>{label}</p>
    </div>
  )
}

// ─── Player Card ──────────────────────────────────────────────────────────────

// Mini-pill mostrando a decisão para um stat específico (PTS/REB/AST).
// Aparece ao lado da barra na aba GERAL, ajudando a ver de relance em qual
// mercado o jogador está forte/fraco.
function MiniDecisionPill({ tab, decision }: { tab: 'PTS' | 'REB' | 'AST'; decision: Decision }) {
  const cfg = DECISION[decision]
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.bannerBg} ${cfg.bannerText} shrink-0`}
      title={`${tab}: ${cfg.label}`}
    >
      {cfg.emoji}
    </span>
  )
}

function PlayerCard({
  p, compact, activeTab, isFinal,
}: {
  p: HotRankingPlayer
  compact: boolean
  activeTab: StatTab
  isFinal?: boolean
}) {
  const decision = getDecisionForStat(p, activeTab)
  const cfg = DECISION[decision]
  const insight = autoInsight(p)
  const value = getStatValue(p, activeTab)

  // Per-stat decisions são úteis na aba GERAL, onde a banner mostra um
  // resumo composto e o usuário quer enxergar mercado a mercado.
  const ptsDecision = getDecisionForStat(p, 'PTS')
  const rebDecision = getDecisionForStat(p, 'REB')
  const astDecision = getDecisionForStat(p, 'AST')

  return (
    <div className={`bg-slate-800 rounded-xl overflow-hidden border border-slate-700/60 hover:border-slate-600 transition-colors ${cfg.borderLeft}`}>
      {/* Decision Banner — most prominent */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${cfg.bannerBg}`}>
        <span className={`text-sm font-black tracking-widest uppercase ${cfg.bannerText}`}>
          {cfg.emoji} {cfg.label}
          {activeTab !== 'GERAL' && (
            <span className="ml-2 text-[10px] font-semibold opacity-70">· {TAB_LABELS[activeTab]}</span>
          )}
        </span>
        <span className="text-slate-500 text-xs font-mono">
          {activeTab === 'GERAL' ? 'score' : 'Δ'} {value > 0 ? '+' : ''}{value.toFixed(1)}
        </span>
      </div>

      <div className="p-4">
        {/* Player name + minutes context */}
        <div className="mb-2 flex items-start gap-3">
          <PlayerAvatar
            photoUrl={playerPhotoUrl(p.player_id)}
            name={p.name}
            size={40}
            ringClassName={p.on_court ? 'ring-2 ring-emerald-500' : 'ring-1 ring-slate-700'}
          />
          <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-white font-bold text-base leading-tight">{p.name}</h4>
            {p.foul_trouble && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30"
                title={`${p.fouls} faltas — risco de banco / fouling out. Projeção foi reduzida.`}
              >
                ⚠️ {p.fouls} faltas
              </span>
            )}
            {p.blowout_impact?.applies && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
                title={p.blowout_impact.reason}
              >
                💥 Risco de descanso
              </span>
            )}
            {!p.on_court && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-600/30 text-slate-300 border border-slate-500/40"
                title="Jogador atualmente no banco (descansando). Stats refletem o que ele já produziu."
              >
                🪑 No banco
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">{p.team} · {p.minutes} min jogados</p>
          </div>
        </div>

        {/* Auto-insight */}
        <p className="text-xs text-slate-400 italic mb-3 leading-relaxed border-l-2 border-slate-600 pl-2">{insight}</p>

        {/* Stat bars */}
        <div className="space-y-2 mb-1">
          {!compact && (
            <p className="text-xs text-slate-600 mb-1.5">
              Atual vs. esperado para {p.minutes} min
              {activeTab === 'GERAL' && <span className="ml-1 text-slate-700">· decisão por mercado ao lado</span>}
            </p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <StatBar label="PTS" actual={p.current_points} expected={p.expected_points} diff={p.points_diff} compact={compact} />
            </div>
            {activeTab === 'GERAL' && <MiniDecisionPill tab="PTS" decision={ptsDecision} />}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <StatBar label="AST" actual={p.current_assists} expected={p.expected_assists} diff={p.assists_diff} compact={compact} />
            </div>
            {activeTab === 'GERAL' && <MiniDecisionPill tab="AST" decision={astDecision} />}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <StatBar label="REB" actual={p.current_rebounds} expected={p.expected_rebounds} diff={p.rebounds_diff} compact={compact} />
            </div>
            {activeTab === 'GERAL' && <MiniDecisionPill tab="REB" decision={rebDecision} />}
          </div>
        </div>

        {/* Projeção até o fim do jogo (com margem de erro) — ou stats finais */}
        {!compact && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-semibold ${isFinal ? 'text-slate-300' : 'text-amber-300/80'}`}>
                {isFinal ? '🏁 Estatísticas finais' : '🎯 Projeção até o fim do jogo'}
              </p>
              {!isFinal && (
                <span
                  className="text-[10px] text-slate-600 cursor-help"
                  title="Estimativa final do jogador se mantiver o ritmo atual deste jogo (com pequeno ajuste pela média da temporada para estabilizar). O número grande é a projeção esperada; abaixo, a faixa mín–máx representa a margem de incerteza (cai conforme o jogo avança)."
                >
                  ℹ️
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <RangeProjectionPill color="orange" projection={p.pace_projection_points}   label="PTS" isFinal={isFinal} />
              <RangeProjectionPill color="sky"    projection={p.pace_projection_assists}  label="AST" isFinal={isFinal} />
              <RangeProjectionPill color="violet" projection={p.pace_projection_rebounds} label="REB" isFinal={isFinal} />
            </div>
            {!isFinal && (
              <p className="text-slate-600 text-[10px] mt-2 italic">
                Considera os minutos típicos do jogador (já com descansos).
                Margem ± diminui conforme o jogo avança.
              </p>
            )}
            {!isFinal && (p.foul_trouble || p.blowout_impact?.applies) && (
              <p className="text-amber-400/80 text-[10px] mt-1 leading-snug">
                {p.foul_trouble && p.blowout_impact?.applies
                  ? 'Projeção reduzida: foul trouble + risco de descanso.'
                  : p.foul_trouble
                  ? `Projeção reduzida: ${p.fouls} faltas aumentam risco de banco.`
                  : 'Projeção reduzida: jogador pode ser poupado pelo coach.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Top Opportunities (cross-market shortlist) ───────────────────────────────
// View principal: lista plana das melhores apostas AGORA, em qualquer mercado.
// Em vez de o usuário ter que navegar entre abas e ler cada card, ele vê de
// cara: "Tatum forte em PONTOS, LeBron forte em ASSISTÊNCIAS, etc."

function OpportunityRow({ o }: { o: BettingOpportunity }) {
  const cfg = DECISION[o.decision]
  const direction = (o.decision === 'STRONG_OVER' || o.decision === 'LEAN_OVER') ? 'OVER' : 'UNDER'
  const pctText = `${o.pct > 0 ? '+' : ''}${(o.pct * 100).toFixed(0)}%`
  const diffText = `${o.diff > 0 ? '+' : ''}${o.diff.toFixed(1)}`
  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700/60 ${cfg.borderLeft} flex items-start gap-2 sm:gap-3 px-3 py-2.5`}>
      {/* Decision pill — encolhe um pouco no mobile */}
      <span
        className={`text-[11px] sm:text-xs font-bold tracking-wider px-1.5 sm:px-2 py-1 rounded ${cfg.bannerBg} ${cfg.bannerText} shrink-0 w-20 sm:w-28 text-center mt-0.5`}
      >
        {cfg.emoji} {direction}
      </span>

      {/* Avatar mini do jogador (foto da NBA CDN; fallback de iniciais) */}
      <PlayerAvatar
        photoUrl={playerPhotoUrl(o.player.player_id)}
        name={o.player.name}
        size={32}
        ringClassName={o.player.on_court ? 'ring-2 ring-emerald-500' : 'ring-1 ring-slate-700'}
        className="mt-0.5 hidden sm:block"
      />

      {/* Player + market + stats */}
      <div className="flex-1 min-w-0">
        {/* Linha 1: nome + badges de risco */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white font-semibold text-sm truncate">{o.player.name}</span>
          {o.player.foul_trouble && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30 shrink-0"
              title={`${o.player.fouls} faltas — risco de banco. Projeção foi reduzida.`}
            >
              ⚠️ {o.player.fouls}F
            </span>
          )}
          {o.player.blowout_impact?.applies && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0"
              title={`Risco de descanso — ${o.player.blowout_impact.reason}`}
            >
              💥
            </span>
          )}
          {!o.player.on_court && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-600/30 text-slate-300 border border-slate-500/40 shrink-0"
              title="No banco agora (descansando)."
            >
              🪑
            </span>
          )}
        </div>

        {/* Linha 2: mercado · time */}
        <div className="flex items-center gap-1.5 mt-0.5 text-xs">
          <span className={`font-bold ${MARKET_BAR_COLOR[o.market]}`}>{MARKET_LABEL[o.market]}</span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-500">{o.player.team}</span>
        </div>

        {/* Linha 3: stats em flex-wrap — cada par fica junto, quebra com graça no mobile */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
          <span className="whitespace-nowrap">
            Atual <span className="text-slate-300 font-semibold">{o.current}</span>
          </span>
          <span className="whitespace-nowrap">
            Esp. <span className="text-slate-400">{o.expected.toFixed(1)}</span>
          </span>
          <span className="whitespace-nowrap">
            Proj. <span className="text-slate-300 font-semibold">{o.projected}</span>
          </span>
        </div>
      </div>

      {/* Magnitude */}
      <div className="text-right shrink-0 mt-0.5">
        <p className={`text-sm font-bold ${o.pct > 0 ? 'text-green-400' : 'text-red-400'}`}>{pctText}</p>
        <p className="text-slate-600 text-xs">{diffText}</p>
      </div>
    </div>
  )
}

function TopOpportunities({ players }: { players: HotRankingPlayer[] }) {
  const opps = buildOpportunities(players)
  if (opps.length === 0) {
    return (
      <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/60">
        <p className="text-slate-500 text-sm text-center">
          Nenhuma oportunidade forte detectada no momento — todos os jogadores estão dentro do esperado.
        </p>
      </div>
    )
  }
  const top    = opps.slice(0, 8)
  const strong = top.filter(o => o.decision === 'STRONG_OVER' || o.decision === 'STRONG_UNDER')
  const lean   = top.filter(o => o.decision === 'LEAN_OVER'   || o.decision === 'LEAN_UNDER')

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold text-white uppercase tracking-wider">🎯 Melhores Apostas Agora</span>
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-slate-600 text-xs">{opps.length} sinais detectados</span>
      </div>

      {strong.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">⚡ Sinais Fortes</p>
          <div className="space-y-1.5">
            {strong.map((o, i) => <OpportunityRow key={`s-${i}`} o={o} />)}
          </div>
        </div>
      )}

      {lean.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">📊 Sinais Moderados</p>
          <div className="space-y-1.5">
            {lean.map((o, i) => <OpportunityRow key={`l-${i}`} o={o} />)}
          </div>
        </div>
      )}

      <p className="text-slate-600 text-[11px] mt-3 italic">
        Ordenado pela força do desvio (% acima/abaixo do esperado para os minutos jogados).
        OVER = apostar a mais; UNDER = apostar a menos. Veja os cards abaixo para detalhes.
      </p>
    </div>
  )
}

// ─── Team Ranking Group ───────────────────────────────────────────────────────

function TeamRankingGroup({
  tricode, teamName, players, compact, activeTab, isFinal,
}: {
  tricode: string
  teamName: string
  players: HotRankingPlayer[]
  compact: boolean
  activeTab: StatTab
  isFinal?: boolean
}) {
  if (players.length === 0) return null

  // Classifica cada jogador pela decisão da aba ativa.
  const isOver  = (p: HotRankingPlayer) => {
    const d = getDecisionForStat(p, activeTab)
    return d === 'STRONG_OVER' || d === 'LEAN_OVER'
  }
  const isUnder = (p: HotRankingPlayer) => {
    const d = getDecisionForStat(p, activeTab)
    return d === 'STRONG_UNDER' || d === 'LEAN_UNDER'
  }

  const highValue = players.filter(isOver)
  const lowValue  = players.filter(isUnder)
  const neutral   = players.filter(p => !isOver(p) && !isUnder(p))

  // Ordena cada grupo pelo desvio do mercado ativo.
  const byValueDesc = (a: HotRankingPlayer, b: HotRankingPlayer) =>
    getStatValue(b, activeTab) - getStatValue(a, activeTab)
  const byValueAsc  = (a: HotRankingPlayer, b: HotRankingPlayer) =>
    getStatValue(a, activeTab) - getStatValue(b, activeTab)
  highValue.sort(byValueDesc)
  neutral.sort(byValueDesc)
  lowValue.sort(byValueAsc)

  const hasGroups = highValue.length > 0 || lowValue.length > 0

  return (
    <div className="mb-6">
      {/* Team header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-600">
          {tricode}
        </span>
        <span className="text-slate-500 text-sm">{teamName}</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      {/* High Value */}
      {highValue.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">⚡ Alto Valor</span>
            <div className="flex-1 h-px bg-emerald-500/20" />
          </div>
          <div className="space-y-2">
            {highValue.map(p => <PlayerCard key={p.player_id} p={p} compact={compact} activeTab={activeTab} isFinal={isFinal} />)}
          </div>
        </div>
      )}

      {/* Neutral */}
      {neutral.length > 0 && (
        <div className="mb-3">
          {hasGroups && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Neutro</span>
              <div className="flex-1 h-px bg-slate-700/50" />
            </div>
          )}
          <div className="space-y-2">
            {neutral.map(p => <PlayerCard key={p.player_id} p={p} compact={compact} activeTab={activeTab} isFinal={isFinal} />)}
          </div>
        </div>
      )}

      {/* Low Value */}
      {lowValue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-red-400/70 uppercase tracking-widest">📉 Baixo Valor</span>
            <div className="flex-1 h-px bg-red-500/20" />
          </div>
          <div className="space-y-2">
            {lowValue.map(p => <PlayerCard key={p.player_id} p={p} compact={compact} activeTab={activeTab} isFinal={isFinal} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Analysis Table Status ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  hot:           'bg-red-500/20 text-red-400 border border-red-500/30',
  above_average: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  normal:        'bg-slate-700 text-slate-400 border border-slate-600',
  below_average: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  cold:          'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
}
const STATUS_EMOJI: Record<string, string> = {
  hot: '🔥', above_average: '📈', normal: '➡️', below_average: '📉', cold: '🥶',
}
const STATUS_LABEL: Record<string, string> = {
  hot: 'Em chamas', above_average: 'Acima', normal: 'Normal', below_average: 'Abaixo', cold: 'Frio',
}

// Formata horário UTC pro fuso local do usuário ("21:00", "9:00 PM", etc.
// dependendo do locale do navegador). Retorna string vazia se inválido.
function formatLocalGameTime(utcIso: string | null | undefined): string {
  if (!utcIso) return ''
  const date = new Date(utcIso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,  // 24h em pt-BR; em locales en-US o navegador override
  }).format(date)
}

// "Atualizado há Xs" — re-renderiza a cada segundo pra mostrar a frescura
// dos dados sem depender de novo fetch. Quando o snapshot atualiza no
// backend, o componente automaticamente reseta o contador (porque `iso`
// muda como prop).
function UpdatedAgo({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ageSec = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (Number.isNaN(ageSec)) return null
  return <span className="tabular">atualizado há {ageSec}s</span>
}

// Detecta se o início do jogo é noutro dia (raro, mas acontece em jogos
// de horário tarde — visualmente útil mostrar "amanhã").
function gameDayHint(utcIso: string | null | undefined): string {
  if (!utcIso) return ''
  const date = new Date(utcIso)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (sameDay(date, today)) return ''
  if (sameDay(date, tomorrow)) return ' (amanhã)'
  if (date < today) return ' (ontem)'
  return ''
}

// ─── Game Card ────────────────────────────────────────────────────────────────

function GameCard({ game, selected, onClick }: { game: LiveGame; selected: boolean; onClick: () => void }) {
  const live      = game.game_status === 'in_progress'
  const upcoming  = game.game_status === 'not_started'
  const localTime = formatLocalGameTime(game.game_time_utc)
  const dayHint   = gameDayHint(game.game_time_utc)
  return (
    <button
      onClick={onClick}
      className={[
        'group w-full text-left p-4 rounded-xl border',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-brand-500/40',
        selected
          ? 'bg-slate-800 border-brand-500 shadow-glow'
          : 'bg-slate-800/70 border-slate-700/70 hover:border-slate-500 hover:bg-slate-800 hover:-translate-y-0.5 shadow-soft',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <span className={`text-xs font-medium ${live ? 'text-brand-400' : 'text-slate-500'} inline-flex items-center gap-1.5`}>
          {live && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-subtle" />
          )}
          <span>{STATUS_LABELS[game.game_status] ?? game.game_status}</span>
          {live && (
            <>
              <span className="text-slate-600">·</span>
              <LiveClock period={game.period} clock={game.clock} isLive={live} />
            </>
          )}
        </span>
        {/* Horário do jogo, formatado no timezone do usuário. */}
        {localTime && !live && (
          <span className="text-xs text-slate-400 font-medium tabular">
            {localTime}{upcoming && dayHint}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <p className="text-slate-300 font-semibold text-sm">{game.away_team.tricode}</p>
          <p className="text-3xl font-bold text-white mt-1 tabular">{game.away_team.score}</p>
        </div>
        <span className="text-slate-600 text-xs px-3 font-medium">@</span>
        <div className="text-center flex-1">
          <p className="text-slate-300 font-semibold text-sm">{game.home_team.tricode}</p>
          <p className="text-3xl font-bold text-white mt-1 tabular">{game.home_team.score}</p>
        </div>
      </div>
      <p className="text-slate-600 text-xs mt-3 truncate">{game.away_team.name} vs {game.home_team.name}</p>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Detecta jogo de playoff via game_id (NBA: '0042XXXXX' = playoffs).
// Em playoffs, o auto-detect do backend desliga o ajuste de blowout —
// técnicos mantêm titulares mesmo com vantagem grande (closeout, virada, etc.).
function isPlayoffGameId(gameId: string): boolean {
  return gameId.length >= 4 && gameId.slice(2, 4) === '04'
}

type BlowoutMode = 'auto' | 'on' | 'off'

export default function LivePage() {
  const season = getCurrentSeason()
  const [todayGames, setTodayGames]       = useState<TodayGames | null>(null)
  const [selectedGame, setSelectedGame]   = useState<LiveGame | null>(null)
  const [ranking, setRanking]             = useState<HotRanking | null>(null)
  const [analysis, setAnalysis]           = useState<LiveGameAnalysis | null>(null)
  const [loadingGames, setLoadingGames]   = useState(false)
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [compact, setCompact]             = useState(false)
  const [activeTab, setActiveTab]         = useState<StatTab>('GERAL')
  const [blowoutMode, setBlowoutMode]     = useState<BlowoutMode>('auto')

  // Converte o modo do usuário no parâmetro que vai pra API.
  // 'auto' → undefined (backend decide); 'on' → true; 'off' → false.
  const blowoutOverride: boolean | undefined =
    blowoutMode === 'auto' ? undefined : blowoutMode === 'on'

  // Carrega lista de jogos do dia. Funciona tanto como mount inicial quanto
  // como retry manual/automático. Em caso de erro, agenda auto-retry após 8s
  // — útil em cold start do Railway, quando o worker ainda não populou o cache
  // (retorna 503) e bastaria esperar alguns segundos.
  const loadGames = async (showLoading = true) => {
    if (showLoading) setLoadingGames(true)
    try {
      const r = await api.getTodayGames()
      setTodayGames(r.data)
      // Limpa o erro de games se vier do retry e tiver dado certo agora.
      setError(prev => (prev === 'games_error' ? null : prev))
    } catch {
      setError('games_error')
    } finally {
      if (showLoading) setLoadingGames(false)
    }
  }

  useEffect(() => {
    loadGames()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh periódico da lista de jogos (30s) — captura jogos que mudam de
  // not_started → in_progress → final, e atualiza placares/clocks dos cards
  // do grid mesmo sem o usuário ter selecionado um.
  // Cache do backend é gerado pelo worker em memória, sem custo na ScraperAPI.
  useEffect(() => {
    const id = setInterval(() => loadGames(false), 30_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-retry da lista de jogos enquanto estiver em estado de erro.
  // Não fica retentando pra sempre — só enquanto o usuário está na página.
  useEffect(() => {
    if (error !== 'games_error') return
    const id = setTimeout(() => loadGames(false), 8_000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const selectGame = async (game: LiveGame) => {
    setSelectedGame(game)
    setRanking(null)
    setAnalysis(null)
    setError(null)

    // Jogo ainda não começou — boxscore não existe, não adianta chamar a API
    if (game.game_status === 'not_started') return

    setLoadingRanking(true)
    try {
      const r = await api.getHotRanking(game.game_id, season, 50, blowoutOverride)
      setRanking(r.data)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 502 || status === 504) {
        setError('stats_blocked')
      } else {
        setError('ranking_error')
      }
    } finally {
      setLoadingRanking(false)
    }
  }

  // Auto-refresh do ranking a cada 10s enquanto o jogo está rolando.
  // Reaproveita o cache do worker no backend (boxscore TTL 15s, médias 24h),
  // então o custo é ~1 request leve a cada 10s, sem ficar na ScraperAPI.
  // Falhas silenciosas: mantém os últimos dados bons e tenta de novo.
  // Também re-busca imediatamente quando o usuário troca o modo de blowout
  // (efeito disparado pela mudança em blowoutOverride).
  //
  // O response do ranking traz period/clock/score/status, então também
  // atualizamos o selectedGame ao vivo — sem isso, o cabeçalho do jogo
  // (placar e relógio) ficava congelado mesmo com stats atualizando.
  useEffect(() => {
    if (!selectedGame || selectedGame.game_status === 'not_started') return

    const tick = async () => {
      try {
        const r = await api.getHotRanking(selectedGame.game_id, season, 50, blowoutOverride)
        setRanking(r.data)

        // Sincroniza o selectedGame com o estado fresco do jogo
        // (placar, relógio, período, status). Se o jogo terminou, isso
        // reflete imediatamente na UI (placar congela, projeções viram "Final").
        setSelectedGame(prev => prev ? {
          ...prev,
          game_status: r.data.game_status,
          period: r.data.period,
          clock: r.data.clock,
          home_team: { ...prev.home_team, score: r.data.home_score },
          away_team: { ...prev.away_team, score: r.data.away_score },
        } : prev)
      } catch {
        // intencional: erro transitório não derruba o último snapshot bom
      }
    }
    // Disparo imediato pra refletir mudança de modo sem esperar 10s.
    tick()
    // Para de fazer polling se o jogo já está finalizado — não vai mudar mais.
    if (selectedGame.game_status === 'final') return
    const id = setInterval(tick, 5_000)
    return () => clearInterval(id)
  }, [selectedGame?.game_id, selectedGame?.game_status, season, blowoutOverride])

  // Auto-refresh da Análise Completa também, pra manter as projeções da
  // tabela alinhadas com o ranking (que tem polling acima).
  // Depende de hasAnalysis (boolean) em vez de analysis pra não resetar o
  // timer a cada tick — mantém cadência estável de 30s.
  const hasAnalysis = analysis !== null
  useEffect(() => {
    if (!selectedGame || selectedGame.game_status !== 'in_progress') return
    if (!hasAnalysis) return

    const tick = async () => {
      try {
        const r = await api.getLiveAnalysis(selectedGame.game_id, season)
        setAnalysis(r.data)
      } catch {
        // mantém último snapshot bom
      }
    }
    // Análise é mais pesada (12+ chamadas em paralelo no backend) — cadência maior.
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [selectedGame, season, hasAnalysis])

  const loadAnalysis = async () => {
    if (!selectedGame) return
    setLoadingAnalysis(true)
    setError(null)
    try {
      const r = await api.getLiveAnalysis(selectedGame.game_id, season)
      setAnalysis(r.data)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 502 || status === 504) {
        setError('stats_blocked')
      } else {
        setError('analysis_error')
      }
    } finally {
      setLoadingAnalysis(false)
    }
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Jogos ao Vivo</h2>
          <p className="text-slate-500 text-sm mt-1">
            Acompanhamento em tempo real, projeções e melhores apostas.
          </p>
        </div>
        <span className="text-slate-400 text-xs font-medium bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 rounded-full">
          Temporada {season}
        </span>
      </div>

      {/* Error banners */}
      {error === 'stats_blocked' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 font-semibold text-sm mb-1">
            ⚠️ API de estatísticas da NBA indisponível no momento
          </p>
          <p className="text-yellow-400/70 text-xs leading-relaxed">
            O servidor <strong>stats.nba.com</strong> está bloqueando requisições automáticas agora.
            Isso acontece periodicamente, especialmente fora do horário dos jogos.
            Durante as partidas ao vivo costuma funcionar normalmente. Tente novamente em alguns minutos.
          </p>
        </div>
      )}
      {error === 'ranking_error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-6">
          Erro ao buscar hot ranking. Verifique se o jogo já começou.
        </div>
      )}
      {error === 'analysis_error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-6">
          Erro ao buscar análise completa. Tente novamente.
        </div>
      )}
      {error === 'games_error' && (
        <InlineError
          title="Não foi possível carregar a lista de jogos"
          description="O servidor pode estar inicializando ou sem conexão com a NBA. Tentando novamente automaticamente."
          onRetry={() => loadGames()}
        />
      )}

      {/* Loading games — skeleton premium em vez de spinner/texto */}
      {loadingGames && !todayGames && (
        <div className="mb-8">
          <div className="skeleton h-3 w-40 mb-4" />
          <SkeletonGameGrid count={6} />
        </div>
      )}

      {/* Games grid */}
      {todayGames && (
        <>
          <p className="text-slate-500 text-sm mb-4 tabular">
            {todayGames.date} · <span className="text-slate-400 font-medium">{todayGames.games.length} jogo(s)</span>
          </p>
          {todayGames.games.length === 0 ? (
            <EmptyState
              icon="📅"
              title="Nenhum jogo agendado para hoje"
              description="Volte amanhã ou confira o calendário oficial da NBA."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {todayGames.games.map(g => (
                <GameCard key={g.game_id} game={g} selected={selectedGame?.game_id === g.game_id} onClick={() => selectGame(g)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Selected game panel */}
      {selectedGame && (
        <div className="border-t border-slate-700 pt-6">
          {/* Game header com blowout % discreto à direita */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {selectedGame.away_team.tricode} @ {selectedGame.home_team.tricode}
              </h3>
              <p className="text-slate-500 text-sm mt-0.5 inline-flex items-center gap-1.5 flex-wrap">
                {selectedGame.game_status === 'in_progress' ? (
                  <>
                    <span className="text-brand-400">🔴 Ao vivo</span>
                    <span className="text-slate-600">·</span>
                    <LiveClock
                      period={selectedGame.period}
                      clock={selectedGame.clock}
                      isLive
                      className="text-brand-400 font-medium"
                    />
                  </>
                ) : (
                  <span>{STATUS_LABELS[selectedGame.game_status]}</span>
                )}
                {selectedGame.game_status === 'not_started' && formatLocalGameTime(selectedGame.game_time_utc) && (
                  <span className="text-slate-400 ml-2">
                    🕐 {formatLocalGameTime(selectedGame.game_time_utc)}
                    {gameDayHint(selectedGame.game_time_utc)}
                  </span>
                )}
              </p>
            </div>
            {/* Blowout % do jogo — SEMPRE visível pra dar referência
                constante. Em jogos ao vivo: cor pelo nível (red/amber/slate).
                Em finalizados: slate neutro (histórico, calculado pela margem
                final). Tooltip mostra a razão calculada no backend. */}
            {ranking?.blowout_risk && (() => {
              const isFinal = ranking.blowout_risk.level === 'final'
              const styles =
                isFinal                                 ? 'bg-slate-700/40 text-slate-300 border-slate-600' :
                ranking.blowout_risk.level === 'high'   ? 'bg-red-500/15 text-red-300 border-red-500/40' :
                ranking.blowout_risk.level === 'medium' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                                                          'bg-slate-700/60 text-slate-300 border-slate-600'
              return (
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-help select-none ${styles}`}
                  title={ranking.blowout_risk.reason}
                >
                  💥 Blowout: {ranking.blowout_risk.percentage}%
                </span>
              )
            })()}
          </div>

          {/* Jogo ainda não iniciado */}
          {selectedGame.game_status === 'not_started' && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 mb-6 text-center">
              <div className="text-5xl mb-4">⏰</div>
              <p className="text-white font-semibold text-lg mb-1">Aguardando início do jogo</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                As análises e o terminal de apostas ficam disponíveis<br />
                assim que a partida começar.
              </p>
              <p className="text-slate-600 text-xs mt-4">
                A página atualiza automaticamente — não é preciso recarregar.
              </p>
            </div>
          )}

          {loadingRanking && !ranking && (
            <div className="card-raised p-5 mb-6 space-y-3">
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-3 w-72" />
              <div className="space-y-2 mt-4">
                <SkeletonPlayerRow />
                <SkeletonPlayerRow />
                <SkeletonPlayerRow />
              </div>
            </div>
          )}

          {/* Hot Ranking — Betting Terminal */}
          {ranking && (
            <div className="card-raised p-5 mb-6 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <div>
                  <h4 className="text-white font-bold text-lg tracking-tight">🔥 Terminal de Apostas</h4>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {activeTab === 'GERAL'
                      ? 'Visão geral — desempenho composto de cada jogador'
                      : `Foco no mercado de ${TAB_LABELS[activeTab].toLowerCase()} — recomendação por linha`}
                    {ranking.updated_at && (
                      <span className="text-slate-600 ml-2 inline-flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-subtle" aria-hidden />
                        <UpdatedAgo iso={ranking.updated_at} />
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Blowout toggle: cicla entre auto → forçar ON → forçar OFF.
                      O label de Auto mostra o que o backend está fazendo
                      (off em playoffs, on em temporada regular). */}
                  {(() => {
                    const autoConsider = !isPlayoffGameId(selectedGame.game_id)
                    const next: BlowoutMode =
                      blowoutMode === 'auto' ? 'on' : blowoutMode === 'on' ? 'off' : 'auto'
                    const label =
                      blowoutMode === 'auto' ? `Blowout: Auto (${autoConsider ? 'on' : 'off'})`
                      : blowoutMode === 'on'   ? 'Blowout: Forçado ON'
                      : 'Blowout: Forçado OFF'
                    const styles =
                      blowoutMode === 'on'  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : blowoutMode === 'off' ? 'bg-slate-700 border-slate-600 text-slate-300'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-300'
                    const tip =
                      blowoutMode === 'auto'
                        ? 'Ativa redução por garbage time automaticamente. Desligado em playoffs.'
                        : blowoutMode === 'on'
                        ? 'Forçando consideração de blowout (mesmo em playoffs).'
                        : 'Ignorando blowout — útil em jogos decisivos onde titulares ficam.'
                    return (
                      <button
                        onClick={() => setBlowoutMode(next)}
                        title={tip}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${styles}`}
                      >
                        💥 {label}
                      </button>
                    )
                  })()}

                  {/* Compact toggle */}
                  <button
                    onClick={() => setCompact(c => !c)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      compact
                        ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {compact ? '▦ Detalhado' : '▤ Compacto'}
                  </button>
                </div>
              </div>

              {/* Stat tabs */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {(Object.keys(TAB_LABELS) as StatTab[]).map(tab => {
                  const active = activeTab === tab
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                        active
                          ? TAB_COLORS[tab]
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  )
                })}
              </div>

              {/* Decision legend */}
              {!compact && (
                <div className="flex items-center gap-2 flex-wrap mb-4 p-3 bg-slate-700/30 rounded-lg border border-slate-700/50">
                  <span className="text-xs text-slate-500 mr-1">Leitura:</span>
                  {(Object.entries(DECISION) as [Decision, DecisionCfg][]).map(([key, d]) => (
                    <span key={key} className={`text-xs px-2 py-0.5 rounded font-semibold ${d.bannerBg} ${d.bannerText}`}>
                      {d.emoji} {d.label}
                    </span>
                  ))}
                </div>
              )}

              {ranking.ranking.length === 0 ? (
                <div className="py-4">
                  <p className="text-yellow-400 font-semibold text-sm mb-1">
                    ⚠️ Médias de temporada indisponíveis
                  </p>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    O <strong className="text-slate-400">stats.nba.com</strong> está bloqueando as requisições no momento.
                    Isso é temporário e costuma resolver durante os jogos ao vivo.
                    Tente novamente em alguns minutos.
                  </p>
                </div>
              ) : (
                <>
                  {/* Cross-market shortlist — only on GERAL tab */}
                  {activeTab === 'GERAL' && (
                    <TopOpportunities players={ranking.ranking} />
                  )}

                  <TeamRankingGroup
                    tricode={selectedGame.away_team.tricode}
                    teamName={selectedGame.away_team.name}
                    players={ranking.ranking.filter(p => p.team === selectedGame.away_team.tricode)}
                    compact={compact}
                    activeTab={activeTab}
                    isFinal={ranking.game_status === 'final'}
                  />
                  <TeamRankingGroup
                    tricode={selectedGame.home_team.tricode}
                    teamName={selectedGame.home_team.name}
                    players={ranking.ranking.filter(p => p.team === selectedGame.home_team.tricode)}
                    compact={compact}
                    activeTab={activeTab}
                    isFinal={ranking.game_status === 'final'}
                  />
                </>
              )}
            </div>
          )}

          {/* Load full analysis */}
          {!analysis && !loadingAnalysis && ranking && (
            <button
              onClick={loadAnalysis}
              className="btn-secondary mb-6"
            >
              <span>📊 Carregar análise completa</span>
              <span className="text-slate-500 text-xs">(1–3 min na 1ª vez)</span>
            </button>
          )}

          {loadingAnalysis && (
            <div className="card p-5 mb-6 space-y-3">
              <div className="skeleton h-4 w-44" />
              <div className="skeleton h-3 w-60" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <SkeletonPlayerRow />
                <SkeletonPlayerRow />
                <SkeletonPlayerRow />
                <SkeletonPlayerRow />
              </div>
            </div>
          )}

          {/* Full analysis table */}
          {analysis && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-white font-semibold">Análise Completa</h4>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {analysis.players.length} jogadores · ordenado por performance
                  </p>
                </div>
                {analysis.errors.length > 0 && (
                  <span className="text-slate-500 text-xs">{analysis.errors.length} sem dados</span>
                )}
              </div>

              {/* Mapeia projeções do hot ranking por player_id pra enriquecer
                  cada linha com a projeção até o fim do jogo. */}
              {[
                { tricode: selectedGame.away_team.tricode, name: selectedGame.away_team.name },
                { tricode: selectedGame.home_team.tricode, name: selectedGame.home_team.name },
              ].map(({ tricode, name }) => {
                const teamPlayers = [...analysis.players]
                  .filter(p => p.team === tricode)
                  .sort((a, b) => b.score - a.score)
                if (teamPlayers.length === 0) return null

                const projectionByPlayer = new Map(
                  ranking?.ranking.map(r => [r.player_id, {
                    pts: r.pace_projection_points,
                    reb: r.pace_projection_rebounds,
                    ast: r.pace_projection_assists,
                    foul_trouble: r.foul_trouble,
                    blowout_impact: r.blowout_impact,
                    fouls: r.fouls,
                  }]) ?? [],
                )

                return (
                  <div key={tricode}>
                    <div className="flex items-center gap-2 px-5 py-3 bg-slate-700/30 border-b border-slate-700">
                      <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-600">
                        {tricode}
                      </span>
                      <span className="text-slate-400 text-sm">{name}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700 text-slate-500 text-xs">
                            <th className="text-left px-5 py-2.5">Jogador</th>
                            <th className="text-center px-4 py-2.5">Min</th>
                            <th className="text-center px-4 py-2.5">
                              PTS<br/>
                              <span className="text-slate-600 font-normal">Esp. · Proj. fim</span>
                            </th>
                            <th className="text-center px-4 py-2.5">
                              REB<br/>
                              <span className="text-slate-600 font-normal">Esp. · Proj. fim</span>
                            </th>
                            <th className="text-center px-4 py-2.5">
                              AST<br/>
                              <span className="text-slate-600 font-normal">Esp. · Proj. fim</span>
                            </th>
                            <th className="text-center px-4 py-2.5">Status</th>
                            <th className="text-center px-4 py-2.5">Decisão</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamPlayers.map(p => {
                            const dec = getDecision(p.score, p.difference.points)
                            const dcfg = DECISION[dec]
                            const proj = projectionByPlayer.get(p.player_id)
                            // Fallback: se ranking ainda não chegou, computa
                            // foul_trouble localmente direto do analysis.
                            const foulTrouble  = proj?.foul_trouble ?? p.fouls >= 4
                            const blowoutImpact = proj?.blowout_impact ?? null
                            const fouls        = proj?.fouls ?? p.fouls
                            return (
                              <tr key={p.player_id} className="border-b border-slate-700/40 hover:bg-slate-700/30 transition-colors">
                                <td className="px-5 py-3 text-white font-medium">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{p.name}</span>
                                    {foulTrouble && (
                                      <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30"
                                        title={`${fouls} faltas — risco de banco. Projeção reduzida.`}
                                      >
                                        ⚠️ {fouls}F
                                      </span>
                                    )}
                                    {blowoutImpact?.applies && (
                                      <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                        title={`Risco de descanso — ${blowoutImpact.reason}`}
                                      >
                                        💥
                                      </span>
                                    )}
                                    {!p.on_court && (
                                      <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-600/30 text-slate-300 border border-slate-500/40"
                                        title="No banco agora (descansando)."
                                      >
                                        🪑
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-400 text-center">{p.minutes}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-white font-bold block">{p.current.points}</span>
                                  <span className="text-slate-500 text-xs">
                                    {p.expected_until_now.points}
                                    {proj && <span className="text-orange-300/80 font-semibold"> · {proj.pts.expected}</span>}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-white font-bold block">{p.current.rebounds}</span>
                                  <span className="text-slate-500 text-xs">
                                    {p.expected_until_now.rebounds}
                                    {proj && <span className="text-violet-300/80 font-semibold"> · {proj.reb.expected}</span>}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-white font-bold block">{p.current.assists}</span>
                                  <span className="text-slate-500 text-xs">
                                    {p.expected_until_now.assists}
                                    {proj && <span className="text-sky-300/80 font-semibold"> · {proj.ast.expected}</span>}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                                    {STATUS_EMOJI[p.status]} {STATUS_LABEL[p.status] ?? p.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${dcfg.bannerBg} ${dcfg.bannerText}`}>
                                    {dcfg.emoji} {dcfg.label}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
