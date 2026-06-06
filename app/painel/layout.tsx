'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, Package, Tags, User, Menu, X, LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

/* ── Navegação ───────────────────────────────────── */

const NAV = [
  { href: '/painel',            label: 'Painel',      icon: LayoutDashboard, titulo: 'Painel' },
  { href: '/painel/pedidos',    label: 'Pedidos',     icon: ClipboardList,   titulo: 'Pedidos' },
  { href: '/painel/produtos',   label: 'Produtos',    icon: Package,         titulo: 'Produtos' },
  { href: '/painel/categorias', label: 'Categorias',  icon: Tags,            titulo: 'Categorias' },
  { href: '/conta',             label: 'Minha conta', icon: User,            titulo: 'Minha conta' },
] as const

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const [email, setEmail]         = useState('')
  const [recebidos, setRecebidos] = useState(0)
  const [drawerAberto, setDrawerAberto]   = useState(false) // mobile (overlay)
  const [desktopAberto, setDesktopAberto] = useState(true)  // desktop (sidebar fixa)

  /* Email do dono + contagem de pedidos 'recebido' (badge) */
  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!ativo || !user) return
      setEmail(user.email ?? '')

      const { data: loja } = await supabase
        .from('lojas')
        .select('id')
        .eq('dono_id', user.id)
        .maybeSingle()

      if (loja?.id && ativo) {
        const { count } = await supabase
          .from('pedidos')
          .select('id', { count: 'exact', head: true })
          .eq('loja_id', loja.id)
          .eq('status', 'recebido')
        if (ativo) setRecebidos(count ?? 0)
      }
    }
    carregar()
    return () => { ativo = false }
  }, [pathname])

  /* Fecha o drawer ao trocar de rota */
  useEffect(() => { setDrawerAberto(false) }, [pathname])

  async function handleSair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const titulo = NAV.find(n => n.href === pathname)?.titulo ?? 'Painel'

  /* Conteúdo interno da sidebar (reaproveitado no desktop e no drawer) */
  const sidebarInner = (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center justify-between px-4 border-b border-line shrink-0">
        <Link
          href="/painel"
          aria-label="Ir para o painel"
          className="flex items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Image src="/odecasa-logo.png" alt="ÔdeCasa" width={36} height={36} priority />
        </Link>
        <button
          onClick={() => setDrawerAberto(false)}
          aria-label="Fechar menu"
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150"
        >
          <X size={18} strokeWidth={1.75} className="text-ink-soft" />
        </button>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1">
        {NAV.map(item => {
          const ativo = pathname === item.href
          const Icone = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                ativo
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-soft hover:bg-brand-50 hover:text-ink',
              ].join(' ')}
            >
              <Icone
                size={18}
                strokeWidth={1.75}
                className={ativo ? 'text-brand-700' : 'text-ink-mute'}
              />
              <span className="flex-1">{item.label}</span>
              {item.href === '/painel/pedidos' && recebidos > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand-500 text-surface text-[11px] font-bold flex items-center justify-center leading-none">
                  {recebidos > 99 ? '99+' : recebidos}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex">

      {/* Sidebar fixa (desktop) — recolhível pelo hambúrguer */}
      <aside
        className={[
          'w-60 shrink-0 flex-col border-r border-line bg-surface sticky top-0 h-screen',
          desktopAberto ? 'hidden md:flex' : 'hidden',
        ].join(' ')}
      >
        {sidebarInner}
      </aside>

      {/* Drawer (mobile) */}
      {drawerAberto && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerAberto(false)} aria-hidden="true" />
          <aside className="relative w-64 max-w-[80%] bg-surface flex flex-col border-r border-line shadow-lg">
            {sidebarInner}
          </aside>
        </div>
      )}

      {/* Área de conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Header do conteúdo */}
        <header className="sticky top-0 z-30 bg-surface border-b border-line">
          <div className="h-14 px-4 flex items-center gap-3">
            {/* Hambúrguer mobile: abre o drawer */}
            <button
              onClick={() => setDrawerAberto(true)}
              aria-label="Abrir menu"
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
            >
              <Menu size={20} strokeWidth={1.75} className="text-ink" />
            </button>

            {/* Hambúrguer desktop: recolhe/abre a sidebar fixa */}
            <button
              onClick={() => setDesktopAberto(o => !o)}
              aria-label={desktopAberto ? 'Recolher menu' : 'Abrir menu'}
              aria-expanded={desktopAberto}
              className="hidden md:flex w-10 h-10 items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
            >
              <Menu size={20} strokeWidth={1.75} className="text-ink" />
            </button>

            <h1 className="text-base font-semibold text-ink flex-1 truncate">{titulo}</h1>

            {email && (
              <span className="hidden sm:block text-sm text-ink-soft truncate max-w-[200px]">
                {email}
              </span>
            )}
            <button
              onClick={handleSair}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:text-danger/80 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-2 py-1 shrink-0"
            >
              <LogOut size={16} strokeWidth={1.75} />
              Sair
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
