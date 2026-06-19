'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, Package, Tags, User, CreditCard, Menu, X,
  Sun, Moon, ExternalLink, Copy, Check, LogOut,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { PlanProvider, usePlan } from '@/hooks/usePlan'
import { RoleProvider, useRole, type Papel } from '@/hooks/useRole'

/* ── NAV com minRole ────────────────────────────── */

const NAV_ITEMS: {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  titulo: string
  minRole: Papel
}[] = [
  { href: '/painel',            label: 'Painel',      icon: LayoutDashboard, titulo: 'Painel',       minRole: 'gerente' },
  { href: '/painel/pedidos',    label: 'Pedidos',     icon: ClipboardList,   titulo: 'Pedidos',      minRole: 'caixa' },
  { href: '/painel/categorias', label: 'Categorias',  icon: Tags,            titulo: 'Categorias',   minRole: 'atendente' },
  { href: '/painel/produtos',   label: 'Produtos',    icon: Package,         titulo: 'Produtos',     minRole: 'atendente' },
  { href: '/painel/planos',     label: 'Plano',       icon: CreditCard,      titulo: 'Plano',        minRole: 'dono' },
  { href: '/painel/conta',      label: 'Minha conta', icon: User,            titulo: 'Minha conta',  minRole: 'gerente' },
]

/* ── Carrossel do rodapé da sidebar ─────────────── */

function SidebarFooterCarousel({ slugLoja }: { slugLoja: string }) {
  const [slide, setSlide]     = useState(0)
  const [copiado, setCopiado] = useState(false)
  const pausado               = useRef(false)

  const { plano, usoMes, isNearLimit, isLimitReached } = usePlan()
  const { count, limite, percentual } = usoMes

  const TOTAL = 2

  useEffect(() => {
    const t = setInterval(() => {
      if (!pausado.current) setSlide(s => (s + 1) % TOTAL)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  const corBarra = isLimitReached()
    ? 'bg-danger'
    : isNearLimit()
      ? 'bg-accent'
      : 'bg-brand-500'

  function copiar() {
    const link = `${window.location.origin}/loja/${slugLoja}`
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div
      className="border-t border-line p-3 shrink-0"
      onMouseEnter={() => { pausado.current = true }}
      onMouseLeave={() => { pausado.current = false }}
    >
      <div className="overflow-hidden rounded-xl">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${slide * 100}%)` }}
        >

          {/* Slide 0: loja no ar */}
          <div className={[
            'w-full shrink-0 px-3 py-3 rounded-xl flex flex-col gap-2',
            isLimitReached()
              ? 'bg-danger/10 border border-danger/30'
              : 'bg-brand-50 border border-brand-200',
          ].join(' ')}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isLimitReached() ? 'bg-danger' : 'bg-brand-500'}`} />
              <span className={`text-xs font-semibold truncate ${isLimitReached() ? 'text-danger' : 'text-brand-700'}`}>
                {isLimitReached() ? 'Pedidos pausados' : 'Sua loja está no ar'}
              </span>
            </div>

            {isLimitReached() ? (
              <>
                <p className="text-[11px] text-danger/80 leading-snug">
                  Limite de pedidos atingido este mês. Faça upgrade para continuar recebendo novos pedidos.
                </p>
                <Link
                  href="/painel/planos"
                  className="flex items-center justify-center h-8 rounded-md bg-danger text-surface text-xs font-semibold hover:bg-danger/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                >
                  Fazer upgrade →
                </Link>
              </>
            ) : (
              <>
                <p className="text-[11px] text-ink-mute truncate">/loja/{slugLoja}</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={copiar}
                    title="Copiar link"
                    className="flex-1 flex items-center justify-center gap-1 h-8 rounded-md border border-line bg-surface text-xs font-medium text-ink-soft hover:text-brand-700 hover:border-brand-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {copiado
                      ? <><Check size={13} strokeWidth={2.5} className="text-brand-600" />Copiado</>
                      : <><Copy size={13} strokeWidth={1.75} />Copiar</>}
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
              </>
            )}
          </div>

          {/* Slide 1: plano */}
          <div className="w-full shrink-0">
            <Link
              href="/painel/planos"
              className="block bg-bg border border-line px-3 py-2.5 rounded-xl hover:border-brand-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <div className="flex items-center gap-2">
                <span className="relative shrink-0">
                  <CreditCard size={16} strokeWidth={1.75} className="text-ink-soft" />
                  {isNearLimit() && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-danger" />
                  )}
                </span>
                <span className="flex-1 text-xs font-semibold text-ink truncate">
                  Plano {plano.nome}
                </span>
                {limite === null && (
                  <Check size={12} strokeWidth={2.5} className="text-brand-500 shrink-0" />
                )}
              </div>
              {limite !== null && (
                <div className="mt-2 flex flex-col gap-1">
                  <div className="h-1 w-full rounded-full bg-line overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${corBarra}`}
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-ink-mute">{count} de {limite} pedidos</span>
                </div>
              )}
            </Link>
          </div>

        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {Array.from({ length: TOTAL }, (_, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            aria-label={`Ver slide ${i + 1}`}
            className={[
              'rounded-full transition-all duration-200',
              i === slide
                ? 'w-4 h-1.5 bg-brand-500'
                : 'w-1.5 h-1.5 bg-line hover:bg-ink-mute',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}

/* ── Breadcrumb ──────────────────────────────────── */

const TAB_LABELS: Record<string, string> = {
  perfil: 'Perfil', loja: 'Loja', entrega: 'Entrega',
  horarios: 'Horários', pagamentos: 'Pagamentos', avaliacoes: 'Avaliações',
  operadores: 'Operadores',
}

function HeaderBreadcrumb({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const navTitulo = NAV_ITEMS.find(n => n.href === pathname)?.titulo ?? 'Painel'

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

/* ── Layout interno (usa os contexts) ────────────── */

function PainelLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { papel, lojaId, isLoading: roleLoading, hasRole } = useRole()

  const [nomeLoja, setNomeLoja]   = useState('')
  const [slugLoja, setSlugLoja]   = useState('')
  const [logoLoja, setLogoLoja]   = useState<string | null>(null)
  const [recebidos, setRecebidos] = useState(0)
  const [drawerAberto, setDrawerAberto]   = useState(false)
  const [desktopAberto, setDesktopAberto] = useState(true)

  // Carrega nome/slug da loja e contagem de pedidos recebidos
  useEffect(() => {
    if (!lojaId) return
    let ativo = true
    async function carregar() {
      const [lojaRes, pedidosRes] = await Promise.all([
        supabase.from('lojas').select('nome, slug, logo_url').eq('id', lojaId).maybeSingle(),
        supabase.from('pedidos').select('id', { count: 'exact', head: true })
          .eq('loja_id', lojaId).eq('status', 'recebido'),
      ])
      if (!ativo) return
      setNomeLoja(lojaRes.data?.nome ?? '')
      setSlugLoja(lojaRes.data?.slug ?? '')
      setLogoLoja(lojaRes.data?.logo_url ?? null)
      setRecebidos(pedidosRes.count ?? 0)
    }
    carregar()
    return () => { ativo = false }
  }, [lojaId, pathname])

  useEffect(() => { setDrawerAberto(false) }, [pathname])

  // Proteção de rotas por papel
  useEffect(() => {
    if (roleLoading || !papel) return
    const protecoes: { path: string; min: Papel }[] = [
      { path: '/painel/planos',     min: 'dono' },
      { path: '/painel/conta',      min: 'gerente' },
      { path: '/painel/produtos',   min: 'atendente' },
      { path: '/painel/categorias', min: 'atendente' },
    ]
    // Dashboard só para gerente+
    if (pathname === '/painel' && !hasRole('gerente')) {
      router.replace('/painel/pedidos')
      return
    }
    const p = protecoes.find(r => pathname.startsWith(r.path))
    if (p && !hasRole(p.min)) {
      toast.error('Você não tem permissão para acessar esta área.')
      router.replace('/painel/pedidos')
    }
  }, [roleLoading, papel, pathname, hasRole, router])

  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Filtra itens da sidebar pelo papel
  const navVisivel = NAV_ITEMS.filter(item => !roleLoading && hasRole(item.minRole))

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

      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {navVisivel.filter(item => item.href !== '/painel/conta').map(item => {
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

        <div className="mt-auto pt-2 border-t border-line">
          {navVisivel.filter(item => item.href === '/painel/conta').map(item => {
            const ativo = pathname === item.href || pathname.startsWith(item.href + '/')
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
                <Icone size={18} strokeWidth={1.75} className={ativo ? 'text-brand-700' : 'text-ink-mute'} />
                <span className="flex-1">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {slugLoja && <SidebarFooterCarousel slugLoja={slugLoja} />}
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

            <Suspense fallback={
              <h1 className="text-base font-semibold text-ink flex-1 truncate">
                {NAV_ITEMS.find(n => n.href === pathname)?.titulo ?? 'Painel'}
              </h1>
            }>
              <HeaderBreadcrumb pathname={pathname} />
            </Suspense>

            {nomeLoja && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-full overflow-hidden bg-brand-50 border border-line flex items-center justify-center shrink-0">
                  {logoLoja ? (
                    <img src={logoLoja} alt={nomeLoja} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-brand-700 select-none leading-none">
                      {nomeLoja.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="hidden sm:block text-sm font-medium text-ink truncate max-w-[200px]">
                  {nomeLoja}
                </span>
              </div>
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

            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
              aria-label="Sair da conta"
              title="Sair da conta"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-danger/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
            >
              <LogOut size={18} strokeWidth={1.75} className="text-ink-mute" />
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}

/* ── Layout exportado ────────────────────────────── */

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlanProvider>
      <RoleProvider>
        <PainelLayoutContent>
          {children}
        </PainelLayoutContent>
      </RoleProvider>
    </PlanProvider>
  )
}
