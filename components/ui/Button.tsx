import { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-surface hover:bg-brand-600 active:scale-[0.98] shadow-sm',
  secondary:
    'bg-surface text-brand-700 border border-line hover:bg-brand-50 active:scale-[0.98]',
  ghost:
    'text-brand-700 hover:bg-brand-50 active:scale-[0.98]',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2',
        'min-h-[48px] min-w-[44px] px-5',
        'rounded-md font-semibold text-sm',
        'transition-all duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variantClasses[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
