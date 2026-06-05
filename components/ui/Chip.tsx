import { ButtonHTMLAttributes } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

/** Pílula de categoria/filtro em rolagem horizontal. Selecionado = brand-100/700. */
export function Chip({ selected = false, className = '', children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={[
        'shrink-0 px-4 h-9 rounded-full text-sm font-medium whitespace-nowrap',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        selected
          ? 'bg-brand-100 text-brand-700'
          : 'bg-surface border border-line text-ink-soft hover:bg-brand-50',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
