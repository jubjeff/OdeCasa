import { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  /** Texto/elemento fixo à direita do campo (ex.: "min", "R$"). */
  suffix?: ReactNode
}

export function Input({ label, id, className = '', suffix, ...props }: InputProps) {
  const inputEl = (
    <input
      id={id}
      className={[
        'h-12 w-full rounded-md border border-line bg-surface px-4',
        'text-sm text-ink placeholder:text-ink-mute',
        'outline-none transition-shadow duration-150',
        'focus:ring-2 focus:ring-brand-500 focus:border-transparent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        suffix ? 'pr-12' : '',
        className,
      ].join(' ')}
      {...props}
    />
  )

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-ink leading-none"
        >
          {label}
        </label>
      )}
      {suffix ? (
        <div className="relative">
          {inputEl}
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-mute">
            {suffix}
          </span>
        </div>
      ) : (
        inputEl
      )}
    </div>
  )
}
