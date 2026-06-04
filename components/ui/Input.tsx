import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, className = '', ...props }: InputProps) {
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
      <input
        id={id}
        className={[
          'h-12 w-full rounded-md border border-line bg-surface px-4',
          'text-sm text-ink placeholder:text-ink-mute',
          'outline-none transition-shadow duration-150',
          'focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
        {...props}
      />
    </div>
  )
}
