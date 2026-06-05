import { ButtonHTMLAttributes } from 'react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/** Botão circular de 40px para ações na TopBar (voltar, atualizar, etc.). Alvo de toque 44px+. */
export function IconButton({ className = '', children, ...props }: IconButtonProps) {
  return (
    <button
      className={[
        'w-10 h-10 flex items-center justify-center rounded-full shrink-0',
        'text-ink hover:bg-brand-50 transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        'disabled:opacity-40 disabled:pointer-events-none',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
