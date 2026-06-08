'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, Package, Tags, User, Menu, X,
  Sun, Moon, ExternalLink, Copy, Check,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { supabase } from '@/lib/supabase'

/* ── Navegação ───────────────────────────────────── */

const NAV = [
  { href: '/painel',            label: 'Painel',      icon: LayoutDashboard, titulo: 'Painel' },
  { href: '/painel/pedidos',    label: 'Pedidos',     icon: ClipboardList,   titulo: 'Pedidos' },
  { href: '/painel/categorias', label: 'Categorias',  icon: Tags,            titulo: 'Categorias' },
  { href: '/painel/produtos',   label: 'Produtos',    icon: Package,         titulo: 'Produtos' },
  { href: '/painel/conta',      label: 'Minha conta', icon: User,            titulo: 'Minha conta' },
] as const

const TAB_LABELS: Record<string, string> = {
  perfil: 'Perfil',
  loja: 'Loja',
  entrega: 'Entrega',
  horarios: 'Horários',
  pagamentos: 'Pagamentos',
  avaliacoes: 'Avaliações',
}

/* ── Breadcrumb (precisa de useSearchParams → Suspense) ── */

function HeaderBreadcrumb({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const navTitulo = NAV.find(n => n.href === pathname)?.titulo ?? 'Painel'

  if (pathname === '/painel/conta' && tab && TAB_LABELS[tab]) {
    return (
      <h1 className="text-base font-semibold text-ink flex-1 truncate">
        <span className="font-normal text-ink-soft">Minha conta</span>
        <span className="mx-1.5 text-ink-mute">›</span>
        {TAB_LABELS[tab]}
      </h1>
    )
  }

  return <h1 className="text-base font-semibold text-ink flex-1 truncate">{navTitulo}</h1>
}

/* ── Layout ──────────────────────────────────────── */

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const [nomeLoja, setNomeLoja]   = useState('')
  const [slugLoja, setSlugLoja]   = useState('')
  const [recebidos, setRecebidos] = useState(0)
  const [copiado, setCopiado]     = useState(false)
  const [drawerAberto, setDrawerAberto]   = useState(false)
  const [desktopAberto, setDesktopAberto] = useState(true)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!ativo || !user) return

      const { data: loja } = await supabase
        .from('lojas')
        .select('id, nome, slug')
        .eq('dono_id', user.id)
        .maybeSingle()

      if (ativo) {
        setNomeLoja(loja?.nome ?? '')
        setSlugLoja(loja?.slug ?? '')
      }

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

  useEffect(() => { setDrawerAberto(false) }, [pathname])

  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const sidebarInner = (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center justify-between px-4 border-b border-line shrink-0">
        <Link
          href="/painel"
          aria-label="Ir para o painel"
          className="flex flex-col leading-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span className="text-lg font-bold">
            <span className="text-ink">Ôde</span><span className="text-brand-500">Casa</span>
          </span>
          <span className="text-[11px] font-medium text-ink-mute tracking-wide">delivery</span>
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
          // /painel só ativa na rota exata; as demais ativam em qualquer sub-rota
          const ativoExato = item.href === '/painel'
            ? pathname === '/painel'
            : pathname === item.href || pathname.startsWith(item.href + '/')
          const Icone = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                ativoExato
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-soft hover:bg-brand-50 hover:text-ink',
              ].join(' ')}
            >
              <Icone
                size={18}
                strokeWidth={1.75}
                className={ativoExato ? 'text-brand-700' : 'text-ink-mute'}
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

      {slugLoja && (
        <div className="p-3 border-t border-line shrink-0">
          <div className="rounded-xl bg-brand-50 border border-brand-200 px-3 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
              <span className="text-xs font-semibold text-brand-700 truncate">Sua loja está no ar</span>
            </div>
            <p className="text-[11px] text-ink-mute truncate">/loja/{slugLoja}</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  const link = `${window.location.origin}/loja/${slugLoja}`
                  navigator.clipboard.writeText(link)
                  setCopiado(true)
                  setTimeout(() => setCopiado(false), 2000)
                }}
                title="Copiar link"
                className="flex-1 flex items-center justify-center gap-1 h-8 rounded-md border border-line bg-surface text-xs font-medium text-ink-soft hover:text-brand-700 hover:border-brand-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {copiado ? <Check size={13} strokeWidth={2.5} className="text-brand-600" /> : <Copy size={13} strokeWidth={1.75} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
              <a
                href={`/loja/${slugLoja}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver minha loja"
                className="flex-1 flex items-center justify-center gap-1 h-8 rounded-md bg-brand-500 text-xs font-semibold text-surface hover:bg-brand-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <ExternalLink size={12} strokeWidth={2} />
                Ver loja
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex">

      <aside
        className={[
          'w-60 shrink-0 flex-col border-r border-line bg-surface sticky top-0 h-screen',
          desktopAberto ? 'hidden md:flex' : 'hidden',
        ].join(' ')}
      >
        {sidebarInner}
      </aside>

      {drawerAberto && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerAberto(false)} aria-hidden="true" />
          <aside className="relative w-64 max-w-[80%] bg-surface flex flex-col border-r border-line shadow-lg">
            {sidebarInner}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">

        <header className="sticky top-0 z-30 bg-surface border-b border-line">
          <div className="h-14 px-4 flex items-center gap-3">
            <button
              onClick={() => setDrawerAberto(true)}
              aria-label="Abrir menu"
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
            >
              <Menu size={20} strokeWidth={1.75} className="text-ink" />
            </button>

            <button
              onClick={() => setDesktopAberto(o => !o)}
              aria-label={desktopAberto ? 'Recolher menu' : 'Abrir menu'}
              aria-expanded={desktopAberto}
              className="hidden md:flex w-10 h-10 items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
            >
              <Menu size={20} strokeWidth={1.75} className="text-ink" />
            </button>

            {/* Breadcrumb / título — usa Suspense por conta do useSearchParams */}
            <Suspense fallback={
              <h1 className="text-base font-semibold text-ink flex-1 truncate">
                {NAV.find(n => n.href === pathname)?.titulo ?? 'Painel'}
              </h1>
            }>
              <HeaderBreadcrumb pathname={pathname} />
            </Suspense>

            {nomeLoja && (
              <span className="hidden sm:block text-sm font-medium text-ink truncate max-w-[200px]">
                {nomeLoja}
              </span>
            )}

            {mounted && (
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                aria-label={resolvedTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
                title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
              >
                {resolvedTheme === 'dark'
                  ? <Sun size={18} strokeWidth={1.75} className="text-ink-soft" />
                  : <Moon size={18} strokeWidth={1.75} className="text-ink-soft" />}
              </button>
            )}
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
