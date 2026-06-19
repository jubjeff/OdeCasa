'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

/** Botão de alternância claro/escuro. Gerencia o próprio estado de hidratação. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label={resolvedTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
      className={[
        'w-11 h-11 flex items-center justify-center rounded-full',
        'hover:bg-brand-50 transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        mounted ? '' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      {resolvedTheme === 'dark'
        ? <Sun size={20} strokeWidth={1.75} className="text-ink-soft" />
        : <Moon size={20} strokeWidth={1.75} className="text-ink-soft" />}
    </button>
  )
}
