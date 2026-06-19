'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#como-funciona',   label: 'Como funciona'  },
  { href: '#precos',          label: 'Preços'         },
  { href: '#depoimentos',     label: 'Depoimentos'    },
]

export function LandingHeader() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [rolou, setRolou] = useState(false)

  useEffect(() => {
    const handler = () => setRolou(window.scrollY > 12)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  function fecharMenu() { setMenuAberto(false) }

  return (
    <header
      className={[
        'sticky top-0 z-50 transition-all duration-200',
        rolou
          ? 'bg-surface/90 backdrop-blur-md border-b border-line shadow-sm'
          : 'bg-surface/80 backdrop-blur-sm',
      ].join(' ')}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-16 flex items-center gap-4">

          {/* Logo */}
          <Link href="/" aria-label="ÔdeCasa Delivery — início" className="flex flex-col leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
            <span className="text-lg font-bold">
              <span className="text-ink">Ôde</span><span className="text-brand-500">Casa</span>
            </span>
            <span className="text-[11px] font-medium text-ink-mute tracking-wide">delivery</span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center" aria-label="Navegação principal">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="px-4 py-2 rounded-md text-sm font-medium text-ink-soft hover:text-ink hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* CTAs desktop */}
          <div className="hidden md:flex items-center gap-3 ml-auto md:ml-0">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-brand-500 text-surface text-sm font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Criar minha loja grátis
            </Link>
          </div>

          {/* Hambúrguer mobile */}
          <button
            onClick={() => setMenuAberto(v => !v)}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuAberto}
            className="md:hidden ml-auto w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {menuAberto
              ? <X size={20} strokeWidth={1.75} className="text-ink" />
              : <Menu size={20} strokeWidth={1.75} className="text-ink" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {menuAberto && (
        <div className="md:hidden border-t border-line bg-surface px-4 py-5 flex flex-col gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={fecharMenu}
              className="py-3 px-3 rounded-md text-base font-medium text-ink-soft hover:text-ink hover:bg-brand-50 transition-colors duration-150"
            >
              {label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-4 border-t border-line mt-2">
            <Link
              href="/login"
              onClick={fecharMenu}
              className="flex items-center justify-center h-11 rounded-md border border-line text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors duration-150"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              onClick={fecharMenu}
              className="flex items-center justify-center h-11 rounded-md bg-brand-500 text-surface text-sm font-semibold hover:bg-brand-600 transition-colors duration-150"
            >
              Criar minha loja grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
