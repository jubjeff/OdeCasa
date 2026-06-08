import { ReactNode } from 'react'
import { WRAP_MAX, type WrapSize } from './PageContainer'

interface TopBarProps {
  /** Conteúdo à esquerda: logo, botão voltar, etc. */
  left?: ReactNode
  /** Título da página (texto). Renderizado com o estilo padrão e truncado. */
  title?: ReactNode
  /** Ações à direita (geralmente IconButton). */
  right?: ReactNode
  /** Segunda linha opcional, dentro do mesmo container (ex.: campo de busca). */
  below?: ReactNode
  /** Largura do container — deve casar com o PageContainer da página. */
  width?: WrapSize
  /** Classes extras aplicadas ao elemento <header>. */
  className?: string
}

/** Barra superior fixa padrão: surface, hairline inferior, container alinhado ao conteúdo. */
export function TopBar({ left, title, right, below, width = 'wide', className }: TopBarProps) {
  return (
    <header className={['sticky top-0 z-30 bg-surface border-b border-line', className].filter(Boolean).join(' ')}>
      <div className={[WRAP_MAX[width], 'mx-auto w-full px-4'].join(' ')}>
        <div className="h-14 flex items-center gap-2">
          {left}
          {title != null ? (
            <div className="flex-1 min-w-0 text-base font-semibold text-ink truncate">{title}</div>
          ) : (
            <div className="flex-1" />
          )}
          {right && <div className="flex items-center gap-1 shrink-0">{right}</div>}
        </div>
        {below && <div className="pb-3">{below}</div>}
      </div>
    </header>
  )
}
