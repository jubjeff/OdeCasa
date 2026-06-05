import { HTMLAttributes } from 'react'

/* Larguras de conteúdo padronizadas (compartilhadas com a TopBar) */
export type WrapSize = 'wide' | 'reading' | 'narrow'

export const WRAP_MAX: Record<WrapSize, string> = {
  wide: 'max-w-5xl',     // hubs e listagens (referência: /lojas)
  reading: 'max-w-2xl',  // cardápio e checkout (leitura em coluna)
  narrow: 'max-w-lg',    // formulários, painel, conta
}

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: WrapSize
}

/** Envolve o conteúdo da página com a largura máxima e o padding horizontal padrão. */
export function PageContainer({ size = 'wide', className = '', children, ...props }: PageContainerProps) {
  return (
    <div className={[WRAP_MAX[size], 'mx-auto w-full px-4', className].join(' ')} {...props}>
      {children}
    </div>
  )
}
