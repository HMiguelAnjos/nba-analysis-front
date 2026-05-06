import { useTickingClock } from '../hooks/useTickingClock'

/**
 * Componente que renderiza "Q{period} MM:SS" com o relógio ticando
 * localmente a cada segundo. Resync automático quando chega valor
 * novo do servidor.
 */
export function LiveClock({
  period,
  clock,
  isLive,
  className = '',
}: {
  period: number
  clock: string
  isLive: boolean
  className?: string
}) {
  const ticking = useTickingClock(clock, isLive)
  return (
    <span className={`tabular ${className}`}>
      Q{period} {ticking}
    </span>
  )
}
