/**
 * Estados visuais padronizados: vazio, erro e em-construção.
 * Usar esses componentes em vez de inventar layouts ad-hoc em cada página
 * — garante consistência visual em todo o app.
 */

import type { ReactNode } from 'react'

interface BaseStateProps {
  icon?: string
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

function BaseState({ icon, title, description, action, className = '' }: BaseStateProps) {
  return (
    <div className={`text-center py-16 px-6 animate-fade-in ${className}`}>
      {icon && (
        <div className="text-5xl mb-4 opacity-80" aria-hidden>{icon}</div>
      )}
      <p className="text-slate-200 font-semibold text-base mb-1.5">{title}</p>
      {description && (
        <div className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
          {description}
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function EmptyState(props: BaseStateProps) {
  return <BaseState icon={props.icon ?? '📭'} {...props} />
}

export function ErrorState({
  title = 'Algo deu errado',
  description,
  onRetry,
  ...rest
}: BaseStateProps & { onRetry?: () => void }) {
  return (
    <BaseState
      icon="⚠️"
      title={title}
      description={description}
      action={
        onRetry ? (
          <button onClick={onRetry} className="btn-primary">
            🔄 Tentar de novo
          </button>
        ) : undefined
      }
      {...rest}
    />
  )
}

/**
 * Banner inline pra erros não-bloqueantes (auto-retry, transitório etc).
 * Mais discreto que ErrorState — não toma a tela inteira.
 */
export function InlineError({
  title,
  description,
  onRetry,
  tone = 'amber',
}: {
  title: string
  description?: ReactNode
  onRetry?: () => void
  tone?: 'amber' | 'red'
}) {
  const toneClasses = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
    red:   'bg-red-500/10 border-red-500/30 text-red-200',
  }[tone]
  const iconColor = tone === 'amber' ? 'text-amber-300' : 'text-red-300'
  return (
    <div className={`rounded-xl border p-4 mb-6 flex items-start justify-between gap-4 flex-wrap ${toneClasses}`}>
      <div>
        <p className={`font-semibold text-sm mb-1 ${iconColor}`}>⚠️ {title}</p>
        {description && (
          <p className="text-xs leading-relaxed opacity-90">{description}</p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
            tone === 'amber'
              ? 'bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-red-500/20 border-red-500/40 hover:bg-red-500/30'
          }`}
        >
          🔄 Tentar agora
        </button>
      )}
    </div>
  )
}
