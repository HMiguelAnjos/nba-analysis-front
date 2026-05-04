import { useState } from 'react'

/**
 * Padrão de URL do CDN da NBA — deterministico por personId.
 * Use isso quando você só tem o id (ex: HotRanking) e não o photo_url completo.
 */
export function playerPhotoUrl(
  playerId: number,
  size: '260x190' | '1040x760' = '260x190',
): string {
  return `https://cdn.nba.com/headshots/nba/latest/${size}/${playerId || 0}.png`
}

/**
 * Avatar do jogador com fallback elegante de iniciais.
 *
 * O CDN da NBA serve uma silhueta padrão pra IDs desconhecidos, então
 * normalmente o `<img>` carrega 200. Mas em offline/erro de rede usamos
 * `onError` pra trocar por um círculo com as iniciais do nome.
 */
export function PlayerAvatar({
  photoUrl,
  name,
  size = 40,
  className = '',
  ringClassName,
}: {
  photoUrl?: string | null
  name: string
  size?: number
  className?: string
  /** Classe extra na borda (ex: anel verde quando em quadra). */
  ringClassName?: string
}) {
  const [errored, setErrored] = useState(false)

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('')

  const dim = { width: size, height: size }
  const baseRing = ringClassName ?? 'ring-1 ring-slate-700'

  if (!photoUrl || errored) {
    return (
      <div
        style={dim}
        className={`flex items-center justify-center rounded-full bg-slate-700 text-slate-300 font-bold text-xs uppercase select-none shrink-0 ${baseRing} ${className}`}
        title={name}
      >
        {initials || '?'}
      </div>
    )
  }

  return (
    <img
      src={photoUrl}
      alt={name}
      title={name}
      style={dim}
      onError={() => setErrored(true)}
      className={`rounded-full object-cover bg-slate-800 shrink-0 ${baseRing} ${className}`}
    />
  )
}
