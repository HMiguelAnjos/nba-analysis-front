/**
 * Skeleton loaders para substituir spinners e textos "Carregando...".
 * Visual mais profissional: o usuário vê a estrutura do que vai aparecer.
 *
 * Uso:
 *   <Skeleton className="h-4 w-32" />
 *   <SkeletonCard />
 *   <SkeletonList count={5} />
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-3/5' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

/** Card skeleton com a forma típica de um GameCard (placar + status). */
export function SkeletonGameCard() {
  return (
    <div className="card p-4">
      <Skeleton className="h-3 w-24 mb-3" />
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <Skeleton className="h-3 w-12 mx-auto" />
          <Skeleton className="h-8 w-10 mx-auto mt-2" />
        </div>
        <Skeleton className="h-3 w-3 mx-3" />
        <div className="flex-1 text-center">
          <Skeleton className="h-3 w-12 mx-auto" />
          <Skeleton className="h-8 w-10 mx-auto mt-2" />
        </div>
      </div>
      <Skeleton className="h-3 w-3/4 mt-4" />
    </div>
  )
}

/** Linha de jogador (avatar + nome + stats + nota). */
export function SkeletonPlayerRow() {
  return (
    <div className="card p-3 flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2 w-full max-w-[200px]" />
      </div>
      <Skeleton className="h-6 w-10 shrink-0" />
    </div>
  )
}

export function SkeletonList({
  count = 5,
  Component = SkeletonPlayerRow,
}: {
  count?: number
  Component?: React.ComponentType
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => <Component key={i} />)}
    </div>
  )
}

/** Grid de SkeletonGameCard responsivo. */
export function SkeletonGameGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => <SkeletonGameCard key={i} />)}
    </div>
  )
}
