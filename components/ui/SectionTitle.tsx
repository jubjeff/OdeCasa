import { ReactNode } from 'react'

interface SectionTitleProps {
  children: ReactNode
  /** Contador real exibido entre parênteses (ex.: "Lojas em Recife (5)"). */
  count?: number
  /** Ação opcional à direita (ex.: botão "Adicionar"). */
  action?: ReactNode
  className?: string
}

/** Título de seção padrão: 18px/600, com contador e ação opcionais. */
export function SectionTitle({ children, count, action, className = '' }: SectionTitleProps) {
  return (
    <div className={['flex items-center justify-between gap-3', className].join(' ')}>
      <h2 className="text-[18px] font-semibold text-ink">
        {children}
        {count != null && <span className="text-ink-mute font-medium"> ({count})</span>}
      </h2>
      {action}
    </div>
  )
}
