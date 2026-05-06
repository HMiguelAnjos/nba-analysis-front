import { useEffect, useRef, useState } from 'react'

/**
 * Mantém o relógio do jogo "ticando" localmente entre fetches do servidor.
 *
 * O backend atualiza a cada 2-5s. Entre polls, o usuário veria o relógio
 * congelado por vários segundos antes de pular. Esse hook:
 *
 *  1. Recebe o `serverClock` mais recente ("MM:SS") e o flag `isLive`.
 *  2. Quando o servidor manda novo valor, ressincroniza imediatamente.
 *  3. Em jogos ao vivo, decrementa 1 segundo a cada tick local.
 *
 * Limitação conhecida: durante timeouts/intervalos, nosso contador local
 * desce mesmo que o relógio real esteja parado. O próximo poll corrige
 * em até 5s — drift mínimo, aceitável.
 */
export function useTickingClock(serverClock: string, isLive: boolean): string {
  const [localSec, setLocalSec] = useState(() => parseClockToSeconds(serverClock))
  const lastServerRef = useRef(serverClock)

  // Ressincroniza sempre que o servidor manda valor novo (mesmo se igual,
  // não há custo — só guarda referência).
  useEffect(() => {
    if (lastServerRef.current === serverClock) return
    lastServerRef.current = serverClock
    setLocalSec(parseClockToSeconds(serverClock))
  }, [serverClock])

  // Tick local enquanto o jogo estiver ao vivo.
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => {
      setLocalSec(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [isLive])

  return formatSecondsToClock(localSec)
}

function parseClockToSeconds(clock: string): number {
  const s = (clock || '').trim()
  if (!s.includes(':')) return 0
  const [mm, ss] = s.split(':')
  const minutes = parseInt(mm, 10) || 0
  const seconds = parseInt(ss, 10) || 0
  return minutes * 60 + seconds
}

function formatSecondsToClock(totalSec: number): string {
  const mm = Math.floor(totalSec / 60)
  const ss = totalSec % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
