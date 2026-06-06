'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Search, Store, SearchX, ExternalLink, ShieldCheck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/ui/TopBar'
import { PageContainer } from '@/components/ui/PageContainer'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { IconButton } from '@/components/ui/IconButton'
import { Card } from '@/components/ui/Card'
import { toast } from 'sonner'

/* ── Tipos ───────────────────────────────────────── */

interface LojaRow {
  id: string
  nome: string
  slug: string
  ativo: boolean
  criado_em: string | null
  dono_id: string
}

interface Dono {
  nome: string | null
  email: string | null
}

interface LojaView extends LojaRow {
  dono: Dono | null
  pedidos: number
}

interface Kpis {
  totalLojas: number
  lojasAtivas: number
  totalPedidos: number
  faturamento: number
}

/* ── Helpers ─────────────────────────────────────── */

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/* ── Pílula de status (ativo/inativo) ────────────── */

function StatusLoja({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap',
        ativo ? 'bg-brand-100 text-brand-700' : 'bg-line text-ink-mute',
      ].join(' ')}
    >
      {ativo ? 'Ativa' : 'Inativa'}
    </span>
  )
}

/* ── Toggle de ativar/desativar ──────────────────── */

function Toggle({
  ativo, disabled, onChange,
}: { ativo: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={ativo ? 'Desativar loja' : 'Ativar loja'}
      disabled={disabled}
      onClick={onChange}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        ativo ? 'bg-brand-500' : 'bg-line',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-5 w-5 rounded-full bg-surface shadow-sm',
          'transition-transform duration-150 ease-out',
          ativo ? 'translate-x-[22px]' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  )
}

/* ── Linha/card de loja ──────────────────────────── */

function LojaItem({
  loja, salvando, onToggle,
}: { loja: LojaView; salvando: boolean; onToggle: () => void }) {
  const donoLabel = loja.dono?.nome || loja.dono?.email || '—'

  return (
    <Card bodyClassName="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink leading-snug truncate">{loja.nome}</p>
          <p className="text-xs text-ink-mute mt-0.5 truncate">/{loja.slug}</p>
        </div>
        <StatusLoja ativo={loja.ativo} />
      </div>

      <div className="mt-3 border-t border-line pt-3 flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-ink-soft shrink-0">Dono</span>
          <span className="text-ink font-medium text-right truncate">{donoLabel}</span>
        </div>
        {loja.dono?.email && loja.dono?.nome && (
          <div className="flex justify-between gap-3">
            <span className="text-ink-soft shrink-0">E-mail</span>
            <span className="text-ink-soft text-right truncate">{loja.dono.email}</span>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="text-ink-soft shrink-0">Criada em</span>
          <span className="text-ink text-right">{formatarData(loja.criado_em)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-ink-soft shrink-0">Pedidos</span>
          <span className="text-ink font-medium text-right">{loja.pedidos}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Toggle ativo={loja.ativo} disabled={salvando} onChange={onToggle} />
          <span className="text-sm text-ink-soft">
            {salvando ? 'Salvando…' : loja.ativo ? 'Ativa' : 'Inativa'}
          </span>
        </label>

        <a
          href={`/loja/${loja.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
        >
          Ver loja
          <ExternalLink size={15} strokeWidth={1.75} />
        </a>
      </div>
    </Card>
  )
}

/* ── Página ──────────────────────────────────────── */

export default function Admin() {
  const router = useRouter()
  // undefined = verificando acesso; true = liberado
  const [autorizado, setAutorizado] = useState<boolean | undefined>(undefined)

  const [lojas, setLojas] = useState<LojaView[] | undefined>(undefined)
  const [kpis, setKpis] = useState<Kpis>({ totalLojas: 0, lojasAtivas: 0, totalPedidos: 0, faturamento: 0 })
  const [busca, setBusca] = useState('')
  const [atualizando, setAtualizando] = useState(false)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  async function carregarDados() {
    // Lojas (admin enxerga todas via RLS)
    const { data: lojasData } = await supabase
      .from('lojas')
      .select('id, nome, slug, ativo, criado_em, dono_id')
      .order('criado_em', { ascending: false })
    const rows = (lojasData as LojaRow[]) ?? []

    // Donos
    const donoIds = [...new Set(rows.map(l => l.dono_id))]
    const donoPorId: Record<string, Dono> = {}
    if (donoIds.length > 0) {
      const { data: perfis } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .in('id', donoIds)
      for (const p of (perfis as { id: string; nome: string | null; email: string | null }[] | null) ?? []) {
        donoPorId[p.id] = { nome: p.nome, email: p.email }
      }
    }

    // Pedidos (admin enxerga todos via RLS) — contagem por loja + faturamento
    const { data: pedidosData } = await supabase
      .from('pedidos')
      .select('id, loja_id, total, status')
    const pedidos = (pedidosData as { id: string; loja_id: string; total: number; status: string }[]) ?? []

    const pedidosPorLoja: Record<string, number> = {}
    let faturamento = 0
    for (const p of pedidos) {
      pedidosPorLoja[p.loja_id] = (pedidosPorLoja[p.loja_id] ?? 0) + 1
      if (p.status !== 'cancelado') faturamento += Number(p.total)
    }

    const view: LojaView[] = rows.map(l => ({
      ...l,
      dono: donoPorId[l.dono_id] ?? null,
      pedidos: pedidosPorLoja[l.id] ?? 0,
    }))

    setLojas(view)
    setKpis({
      totalLojas: rows.length,
      lojasAtivas: rows.filter(l => l.ativo).length,
      totalPedidos: pedidos.length,
      faturamento,
    })
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle()

      if (!perfil?.is_admin) { router.replace('/painel'); return }

      setAutorizado(true)
      await carregarDados()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function handleAtualizar() {
    setAtualizando(true)
    await carregarDados()
    setAtualizando(false)
  }

  async function handleToggle(loja: LojaView) {
    const novoAtivo = !loja.ativo
    setSalvandoId(loja.id)

    const { error } = await supabase
      .from('lojas')
      .update({ ativo: novoAtivo })
      .eq('id', loja.id)

    setSalvandoId(null)

    if (error) {
      toast.error('Não foi possível atualizar a loja.')
      return
    }

    setLojas(prev =>
      prev?.map(l => (l.id === loja.id ? { ...l, ativo: novoAtivo } : l)),
    )
    setKpis(prev => ({
      ...prev,
      lojasAtivas: prev.lojasAtivas + (novoAtivo ? 1 : -1),
    }))
    toast.success(novoAtivo ? 'Loja ativada' : 'Loja desativada')
  }

  const termo = busca.trim()
  const filtradas = useMemo(() => {
    if (!lojas) return []
    if (!termo) return lojas
    const alvo = normalizar(termo)
    return lojas.filter(l => normalizar(l.nome).includes(alvo))
  }, [lojas, termo])

  // Verificando acesso: não pisca conteúdo
  if (autorizado === undefined) return null

  const cards = [
    { label: 'Lojas',            valor: String(kpis.totalLojas) },
    { label: 'Lojas ativas',     valor: String(kpis.lojasAtivas) },
    { label: 'Pedidos',          valor: String(kpis.totalPedidos) },
    { label: 'Faturamento',      valor: formatarReal(kpis.faturamento) },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        width="wide"
        left={
          <span className="inline-flex items-center gap-2 text-brand-600">
            <ShieldCheck size={20} strokeWidth={1.75} />
          </span>
        }
        title="Administração da plataforma"
        right={
          <IconButton onClick={handleAtualizar} aria-label="Atualizar" disabled={atualizando}>
            <RefreshCw size={20} strokeWidth={1.75} className={atualizando ? 'animate-spin' : ''} />
          </IconButton>
        }
      />

      <main className="py-8">
        <PageContainer size="wide" className="flex flex-col gap-6">

          {/* Indicadores gerais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map(c => (
              <Card key={c.label} bodyClassName="p-4">
                <p className="text-xs text-ink-soft leading-snug">{c.label}</p>
                <p className="text-xl font-bold text-ink mt-1 leading-tight">
                  {lojas === undefined ? '—' : c.valor}
                </p>
              </Card>
            ))}
          </div>

          {/* Lojas */}
          <div className="flex flex-col gap-3">
            <SectionTitle count={lojas?.length}>Lojas</SectionTitle>

            {/* Busca */}
            <div className="relative">
              <Search
                size={18}
                strokeWidth={1.75}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none"
              />
              <input
                type="search"
                inputMode="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar loja pelo nome"
                aria-label="Buscar loja pelo nome"
                className={[
                  'w-full h-11 rounded-full border border-line bg-surface pl-10 pr-4',
                  'text-sm text-ink placeholder:text-ink-mute',
                  'outline-none transition-shadow duration-150',
                  'focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                ].join(' ')}
              />
            </div>

            {lojas === undefined ? (
              <p className="text-sm text-ink-mute text-center py-16">Carregando lojas…</p>
            ) : lojas.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-20">
                <Store size={44} strokeWidth={1.25} className="text-ink-mute mb-4" />
                <p className="text-base font-semibold text-ink">Nenhuma loja cadastrada ainda</p>
                <p className="text-sm text-ink-soft mt-1">As lojas aparecerão aqui assim que forem criadas.</p>
              </div>
            ) : filtradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <SearchX size={44} strokeWidth={1.25} className="text-ink-mute mb-4" />
                <p className="text-base font-semibold text-ink">Nenhuma loja encontrada para “{termo}”</p>
                <p className="text-sm text-ink-soft mt-1">Tente buscar por outro nome.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {filtradas.map(loja => (
                  <LojaItem
                    key={loja.id}
                    loja={loja}
                    salvando={salvandoId === loja.id}
                    onToggle={() => handleToggle(loja)}
                  />
                ))}
              </div>
            )}
          </div>

        </PageContainer>
      </main>
    </div>
  )
}
