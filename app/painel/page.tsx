'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check, Copy, ShoppingBag, DollarSign, Receipt, Star, Lock, Settings, Eye, EyeOff,
  AlertCircle, BarChart2, Download, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageContainer } from '@/components/ui/PageContainer'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { StatusBadge, type OrderStatus } from '@/components/ui/StatusBadge'
import { StoreInfoCard, type Loja } from '@/components/account/StoreInfoCard'
import { PlanLimitBanner } from '@/components/PlanLimitBanner'
import { PlanGate } from '@/components/PlanGate'
import { usePlan } from '@/hooks/usePlan'
import { useRole } from '@/hooks/useRole'
import { toast } from 'sonner'

/* ── Tipos ─────────────────────────────────────────────── */

type Periodo = 'hoje' | '7dias' | '30dias' | 'personalizado'

interface KpiDia {
  count: number
  total: number
}

interface PedidoBruto {
  criado_em: string
  total: number
}

interface BarraGrafico {
  label: string
  valor: number
}

interface ItenCSV {
  nome_produto: string
  quantidade: number
  unidade: string | null
  preco_unitario: number
  subtotal: number
}

interface PedidoCSVRow {
  id: string
  criado_em: string
  nome_cliente: string
  telefone_cliente: string
  endereco_entrega: string
  forma_pagamento: string
  status: string
  total: number
  taxa_entrega: number
  observacoes: string | null
  itens_pedido: ItenCSV[]
}

interface PedidoAndamento {
  id: string
  total: number
  status: OrderStatus
  criado_em: string
  nome_cliente: string
}

interface TopProduto {
  nome: string
  qtd: number
}

interface AvaliacaoRow {
  id: string
  nota: number
  comentario: string | null
  criado_em: string
  profiles: { nome: string | null } | { nome: string | null }[] | null
}

/* ── Helpers de período ─────────────────────────────────── */

function calcPeriodo(
  periodo: Periodo,
  dataInicio?: Date,
  dataFim?: Date,
): { inicioP: Date; fimP: Date; dias: number } | null {
  const fimP = new Date()
  fimP.setHours(23, 59, 59, 999)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  if (periodo === 'hoje') {
    const dias = Math.ceil((fimP.getTime() - hoje.getTime()) / 86400000)
    return { inicioP: hoje, fimP, dias }
  }
  if (periodo === '7dias') {
    const ini = new Date(hoje)
    ini.setDate(ini.getDate() - 6)
    const dias = Math.ceil((fimP.getTime() - ini.getTime()) / 86400000)
    return { inicioP: ini, fimP, dias }
  }
  if (periodo === '30dias') {
    const ini = new Date(hoje)
    ini.setDate(ini.getDate() - 29)
    const dias = Math.ceil((fimP.getTime() - ini.getTime()) / 86400000)
    return { inicioP: ini, fimP, dias }
  }
  // personalizado
  if (!dataInicio || !dataFim) return null
  const ini = new Date(dataInicio)
  ini.setHours(0, 0, 0, 0)
  const fim = new Date(dataFim)
  fim.setHours(23, 59, 59, 999)
  if (fim < ini) return null
  const dias = Math.ceil((fim.getTime() - ini.getTime()) / 86400000)
  return { inicioP: ini, fimP: fim, dias }
}

function tituloSecao(periodo: Periodo, dataInicio?: Date, dataFim?: Date): string {
  if (periodo === 'hoje') return 'Resumo de hoje'
  if (periodo === '7dias') return 'Últimos 7 dias'
  if (periodo === '30dias') return 'Últimos 30 dias'
  if (dataInicio && dataFim) {
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return `De ${fmt(dataInicio)} até ${fmt(dataFim)}`
  }
  return 'Período personalizado'
}

function tituloProdutos(periodo: Periodo): string {
  if (periodo === 'hoje') return 'Top 5 produtos de hoje'
  if (periodo === '7dias') return 'Top 5 produtos da semana'
  if (periodo === '30dias') return 'Top 5 produtos do mês'
  return 'Top 5 produtos do período'
}

/* ── Queries isoladas (fora do componente) ──────────────── */

async function buscarKPIs(lojaId: string, inicio: Date, fim: Date): Promise<KpiDia> {
  const { data } = await supabase
    .from('pedidos')
    .select('total')
    .eq('loja_id', lojaId)
    .neq('status', 'cancelado')
    .gte('criado_em', inicio.toISOString())
    .lte('criado_em', fim.toISOString())
  const rows = (data ?? []) as { total: number }[]
  return {
    count: rows.length,
    total: rows.reduce((s, p) => s + Number(p.total), 0),
  }
}

async function buscarTop5(lojaId: string, inicio: Date, fim: Date): Promise<TopProduto[]> {
  const { data: pedIds } = await supabase
    .from('pedidos')
    .select('id')
    .eq('loja_id', lojaId)
    .neq('status', 'cancelado')
    .gte('criado_em', inicio.toISOString())
    .lte('criado_em', fim.toISOString())

  const ids = (pedIds ?? []).map((p: { id: string }) => p.id)
  if (ids.length === 0) return []

  const { data: itens } = await supabase
    .from('itens_pedido')
    .select('nome_produto,quantidade')
    .in('pedido_id', ids)

  const mapa: Record<string, number> = {}
  for (const it of (itens as { nome_produto: string; quantidade: number }[] | null) ?? []) {
    mapa[it.nome_produto] = (mapa[it.nome_produto] ?? 0) + Number(it.quantidade)
  }
  return Object.entries(mapa)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, qtd]) => ({ nome, qtd }))
}

async function buscarPedidosBrutos(lojaId: string, inicio: Date, fim: Date): Promise<PedidoBruto[]> {
  const { data } = await supabase
    .from('pedidos')
    .select('criado_em,total')
    .eq('loja_id', lojaId)
    .neq('status', 'cancelado')
    .gte('criado_em', inicio.toISOString())
    .lte('criado_em', fim.toISOString())
  return (data ?? []) as PedidoBruto[]
}

function kpiDeDados(rows: PedidoBruto[]): KpiDia {
  return {
    count: rows.length,
    total: rows.reduce((s, p) => s + Number(p.total), 0),
  }
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function agruparDados(
  pedidos: PedidoBruto[],
  periodo: Periodo,
  inicioP: Date,
  dias: number,
): BarraGrafico[] {
  if (periodo === 'hoje') {
    return Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`,
      valor: pedidos
        .filter(p => new Date(p.criado_em).getHours() === h)
        .reduce((s, p) => s + Number(p.total), 0),
    }))
  }

  function porDia(n: number, inicio: Date, labelFn: (d: Date) => string): BarraGrafico[] {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(inicio)
      d.setDate(d.getDate() + i)
      const dStr = d.toDateString()
      return {
        label: labelFn(d),
        valor: pedidos
          .filter(p => new Date(p.criado_em).toDateString() === dStr)
          .reduce((s, p) => s + Number(p.total), 0),
      }
    })
  }

  function porSemana(numSem: number, inicio: Date): BarraGrafico[] {
    return Array.from({ length: numSem }, (_, si) => {
      const s0 = new Date(inicio)
      s0.setDate(s0.getDate() + si * 7)
      const s1 = new Date(s0)
      s1.setDate(s1.getDate() + 6)
      s1.setHours(23, 59, 59, 999)
      return {
        label: `Sem ${si + 1}`,
        valor: pedidos
          .filter(p => { const d = new Date(p.criado_em); return d >= s0 && d <= s1 })
          .reduce((s, p) => s + Number(p.total), 0),
      }
    })
  }

  if (periodo === '7dias') return porDia(7, inicioP, d => DIAS_SEMANA[d.getDay()])
  if (periodo === '30dias') return porSemana(Math.ceil(dias / 7), inicioP)
  // personalizado
  if (dias <= 14) {
    return porDia(dias, inicioP, d =>
      `${d.getDate()}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
    )
  }
  return porSemana(Math.ceil(dias / 7), inicioP)
}

/* ── Helpers de UI ──────────────────────────────────────── */

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mascararNome(nome: string | null | undefined): string {
  if (!nome?.trim()) return 'Cliente'
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[partes.length - 1][0]}.`
}

type Variacao =
  | { novo: true }
  | { novo: false; texto: string; positiva: boolean }
  | null

function calcVariacao(atual: number, anterior: number): Variacao {
  if (anterior === 0 && atual > 0) return { novo: true }
  if (anterior === 0) return null
  const pct = parseFloat(((atual - anterior) / anterior * 100).toFixed(1))
  const abs = Math.abs(pct).toFixed(1)
  return { novo: false, texto: pct >= 0 ? `↑ ${abs}%` : `↓ ${abs}%`, positiva: pct >= 0 }
}

/* ── Bloco KPI ──────────────────────────────────────────── */

function VariacaoBadge({ v }: { v: Variacao }) {
  if (!v) return null
  if (v.novo) {
    return <span className="text-xs font-medium text-ink-mute">Novo</span>
  }
  return (
    <span className={`text-xs font-semibold ${v.positiva ? 'text-brand-600' : 'text-danger'}`}>
      {v.texto}
    </span>
  )
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} bodyClassName="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="h-5 w-5 rounded bg-line animate-pulse" />
            <div className="h-3 w-10 rounded bg-line animate-pulse" />
          </div>
          <div className="h-7 w-24 rounded bg-line animate-pulse mb-2" />
          <div className="h-3 w-20 rounded bg-line animate-pulse" />
        </Card>
      ))}
    </div>
  )
}

function KpiCards({
  atual, anterior, oculto, periodo, flash,
}: {
  atual: KpiDia
  anterior: KpiDia
  oculto: boolean
  periodo: Periodo
  flash: { pedidos: number; faturamento: number; ticket: number }
}) {
  const ticketAtual    = atual.count    > 0 ? atual.total    / atual.count    : null
  const ticketAnterior = anterior.count > 0 ? anterior.total / anterior.count : null
  const mascarar = (v: string) => oculto ? '••••' : v

  const labelPedidos = periodo === 'hoje' ? 'Pedidos hoje' : 'Pedidos no período'
  const labelFatura  = periodo === 'hoje' ? 'Faturamento do dia' : 'Faturamento'

  const cards = [
    {
      label: labelPedidos,
      valor: mascarar(String(atual.count)),
      icone: <ShoppingBag size={18} strokeWidth={1.75} className="text-brand-500" />,
      variacao: calcVariacao(atual.count, anterior.count),
      atalho: '/painel/pedidos',
      flashKey: flash.pedidos,
    },
    {
      label: labelFatura,
      valor: mascarar(formatarReal(atual.total)),
      icone: <DollarSign size={18} strokeWidth={1.75} className="text-brand-500" />,
      variacao: calcVariacao(atual.total, anterior.total),
      atalho: '/painel/conta?tab=loja',
      flashKey: flash.faturamento,
    },
    {
      label: 'Ticket médio',
      valor: mascarar(ticketAtual != null ? formatarReal(ticketAtual) : '—'),
      icone: <Receipt size={18} strokeWidth={1.75} className="text-brand-500" />,
      variacao: ticketAtual != null && ticketAnterior != null
        ? calcVariacao(ticketAtual, ticketAnterior)
        : ticketAtual != null && anterior.count === 0
          ? ({ novo: true }) as Variacao
          : null,
      atalho: null,
      flashKey: flash.ticket,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map(c => (
        <Card key={c.label} bodyClassName="p-4">
          <div className="flex items-center justify-between mb-2">
            {c.icone}
            <VariacaoBadge v={c.variacao} />
          </div>
          <p className="text-2xl font-bold text-ink leading-tight">
            <span key={c.flashKey} className={c.flashKey > 0 ? 'animate-kpi-flash rounded-sm' : ''}>
              {c.valor}
            </span>
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-ink-mute">{c.label}</p>
            {c.atalho && (
              <Link
                href={c.atalho}
                aria-label={`Configurar ${c.label}`}
                className="text-ink-mute hover:text-ink-soft transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Settings size={12} strokeWidth={1.75} />
              </Link>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

/* ── Filtro de período ──────────────────────────────────── */

function FiltroPeriodo({
  periodo, setPeriodo, dataInicio, setDataInicio, dataFim, setDataFim, rightSlot,
}: {
  periodo: Periodo
  setPeriodo: (p: Periodo) => void
  dataInicio: Date | undefined
  setDataInicio: (d: Date | undefined) => void
  dataFim: Date | undefined
  setDataFim: (d: Date | undefined) => void
  rightSlot?: React.ReactNode
}) {
  const chipBase = [
    'inline-flex items-center justify-center min-h-[36px] px-4 rounded-full',
    'text-sm font-medium transition-all duration-150 whitespace-nowrap',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
  ].join(' ')
  const ativo   = 'bg-brand-500 text-surface'
  const inativo = 'bg-surface border border-line text-ink-soft hover:border-brand-300 hover:text-brand-700'

  function chipClass(id: Periodo) {
    return [chipBase, periodo === id ? ativo : inativo].join(' ')
  }

  function toDateInput(d: Date | undefined): string {
    if (!d) return ''
    return d.toISOString().split('T')[0]
  }
  function fromDateInput(s: string): Date | undefined {
    if (!s) return undefined
    return new Date(s + 'T00:00:00')
  }

  const inputClass = [
    'h-[48px] w-full rounded-md border border-line px-3',
    'text-sm text-ink bg-surface',
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
    'transition-shadow duration-150',
  ].join(' ')

  return (
    <div className="flex flex-col gap-3">
      {/* Chips + botão de exportação */}
      <div className="flex items-center gap-2">
        {/* Chips — rolam horizontalmente em telas pequenas */}
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0"
          style={{ scrollbarWidth: 'none' }}
        >
          <button className={chipClass('hoje')} onClick={() => setPeriodo('hoje')}>
            Hoje
          </button>

          {/* 7 dias, 30 dias e Personalizado — bloqueados no plano Grátis */}
          <PlanGate
            feature="relatorios"
            variant="compact"
            fallback="7 dias · 30 dias · Personalizado"
          >
            <div className="flex items-center gap-2">
              <button className={chipClass('7dias')} onClick={() => setPeriodo('7dias')}>
                7 dias
              </button>
              <button className={chipClass('30dias')} onClick={() => setPeriodo('30dias')}>
                30 dias
              </button>
              <button className={chipClass('personalizado')} onClick={() => setPeriodo('personalizado')}>
                Personalizado
              </button>
            </div>
          </PlanGate>
        </div>

        {/* Slot direito fixo (ex: botão Exportar CSV) */}
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>

      {/* Inputs de data — só aparecem no modo personalizado */}
      {periodo === 'personalizado' && (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-medium text-ink-soft">De</label>
            <input
              type="date"
              value={toDateInput(dataInicio)}
              onChange={e => setDataInicio(fromDateInput(e.target.value))}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-medium text-ink-soft">Até</label>
            <input
              type="date"
              value={toDateInput(dataFim)}
              min={toDateInput(dataInicio)}
              onChange={e => setDataFim(fromDateInput(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Gráfico de faturamento ─────────────────────────────── */

const SKEL_PCTS = [60, 80, 45, 90, 70]

function GraficoFaturamento({
  pedidos, carregando, periodo, dataInicio, dataFim,
}: {
  pedidos: PedidoBruto[]
  carregando: boolean
  periodo: Periodo
  dataInicio: Date | undefined
  dataFim: Date | undefined
}) {
  const [tooltip, setTooltip] = useState<{ label: string; valor: number; index: number } | null>(null)

  const range  = calcPeriodo(periodo, dataInicio, dataFim)
  const barras = range ? agruparDados(pedidos, periodo, range.inicioP, range.dias) : []

  const BAR_H  = 156
  const maximo = Math.max(...barras.map(b => b.valor), 0)
  const soma   = barras.reduce((s, b) => s + b.valor, 0)
  const media  = barras.length > 0 ? soma / barras.length : 0
  const mediaPx = maximo > 0 ? (media / maximo) * BAR_H : 0

  const vazio    = !carregando && maximo === 0
  const skeletonN = periodo === 'hoje' ? 12 : periodo === '30dias' ? 5 : 7

  const fmtEixo = (v: number) =>
    `R$ ${Math.round(v).toLocaleString('pt-BR')}`

  return (
    <PlanGate
      feature="relatorios"
      fallback="Veja o gráfico de faturamento com o plano Crescimento ou superior"
    >
      <div>
        <div className="flex items-baseline gap-2 mb-3">
          <SectionTitle>Faturamento por período</SectionTitle>
          <span className="text-xs text-ink-mute">
            {tituloSecao(periodo, dataInicio, dataFim)}
          </span>
        </div>

        <Card bodyClassName="p-4">
          {carregando ? (
            /* Skeleton */
            <div className="pl-10">
              <div className="flex items-end gap-[4px]" style={{ height: `${BAR_H}px` }}>
                {Array.from({ length: skeletonN }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-line animate-pulse"
                    style={{ height: `${SKEL_PCTS[i % SKEL_PCTS.length]}%` }}
                  />
                ))}
              </div>
              <div className="h-px bg-line" />
              <div className="flex gap-[4px] mt-1.5">
                {Array.from({ length: skeletonN }, (_, i) => (
                  <div key={i} className="flex-1 h-2 rounded bg-line animate-pulse" />
                ))}
              </div>
            </div>
          ) : vazio ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center gap-2" style={{ height: '120px' }}>
              <BarChart2 size={32} strokeWidth={1.5} className="text-ink-mute" />
              <p className="text-sm text-ink-mute">Sem faturamento neste período</p>
            </div>
          ) : (
            /* Gráfico — mt-6 reserva espaço pro tooltip acima da barra mais alta */
            <div className="relative pl-10 mt-6">
              {/* Eixo Y — 3 labels: máx, metade, zero */}
              <div
                className="absolute left-0 flex flex-col justify-between pointer-events-none"
                style={{ top: 0, height: `${BAR_H}px` }}
              >
                <span className="text-[10px] text-ink-mute leading-none">{fmtEixo(maximo)}</span>
                <span className="text-[10px] text-ink-mute leading-none">{fmtEixo(maximo / 2)}</span>
                <span className="text-[10px] text-ink-mute leading-none">R$ 0</span>
              </div>

              {/* Área das barras */}
              <div
                className="relative flex items-end gap-[4px]"
                style={{ height: `${BAR_H}px` }}
              >
                {/* Linha de média */}
                {media > 0 && (
                  <div
                    className="absolute w-full flex items-center pointer-events-none"
                    style={{ bottom: `${mediaPx.toFixed(1)}px` }}
                  >
                    <div className="flex-1 border-t border-dashed border-ink-mute" />
                    <span className="ml-1 text-[10px] text-ink-mute whitespace-nowrap bg-surface pl-0.5 leading-none">
                      méd. {formatarReal(media)}
                    </span>
                  </div>
                )}

                {/* Barras */}
                {barras.map((b, i) => {
                  const pct  = maximo > 0 ? (b.valor / maximo * 100) : 0
                  const hVal = b.valor > 0
                    ? `max(${pct.toFixed(1)}%, 4px)`
                    : '0px'
                  const showLabel = periodo === 'hoje' ? i % 6 === 0 : true

                  return (
                    <div
                      key={i}
                      className="relative flex-1 h-full flex flex-col justify-end"
                      onMouseEnter={() => setTooltip({ label: b.label, valor: b.valor, index: i })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {/* Tooltip */}
                      {tooltip?.index === i && b.valor > 0 && (
                        <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-10 bg-ink text-surface text-[11px] px-2 py-1 rounded-md whitespace-nowrap pointer-events-none shadow-sm">
                          {b.label} — {formatarReal(b.valor)}
                        </div>
                      )}

                      {/* Barra */}
                      <div
                        className="w-full bg-brand-500 rounded-t cursor-pointer transition-opacity duration-150"
                        style={{
                          height: hVal,
                          opacity: tooltip?.index === i ? 0.75 : 1,
                        }}
                      />

                      {/* Label abaixo */}
                      <span className="absolute -bottom-5 left-0 right-0 text-center text-[10px] text-ink-mute leading-none truncate">
                        {showLabel ? b.label : ''}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Linha separadora + espaço das labels */}
              <div className="border-t border-line mt-0" style={{ height: '20px' }} />
            </div>
          )}
        </Card>
      </div>
    </PlanGate>
  )
}

/* ── Breakdown por produto (relatório mensal) ───────────── */

interface ItemBreakdown {
  nome_produto: string
  quantidade: number
  subtotal: number
  pedido?: { id: string }
}

interface MetricasMes {
  faturamento: number
  pedidos: number
  topProduto: { nome: string; unidades: number } | null
}

interface ProdutoAgrupado {
  nome: string
  unidades: number
  receita: number
  percentual: string
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function BreakdownProdutos({ lojaId, refreshKey: externalRefreshKey = 0 }: { lojaId: string; refreshKey?: number }) {
  const hoje = new Date()
  const [mes, setMes] = useState({ year: hoje.getFullYear(), month: hoje.getMonth() })
  const [produtos, setProdutos] = useState<ProdutoAgrupado[]>([])
  const [totalReceita, setTotalReceita] = useState(0)
  const [totalUnidades, setTotalUnidades] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [metricasAtual, setMetricasAtual] = useState<MetricasMes>({ faturamento: 0, pedidos: 0, topProduto: null })
  const [metricasAnterior, setMetricasAnterior] = useState<MetricasMes>({ faturamento: 0, pedidos: 0, topProduto: null })

  const podeProximo =
    mes.year < hoje.getFullYear() ||
    (mes.year === hoje.getFullYear() && mes.month < hoje.getMonth())

  function navMes(dir: -1 | 1) {
    setMes(m => {
      let novoMes = m.month + dir
      let novoAno = m.year
      if (novoMes < 0) { novoMes = 11; novoAno-- }
      if (novoMes > 11) { novoMes = 0; novoAno++ }
      return { year: novoAno, month: novoMes }
    })
  }

  useEffect(() => {
    let ativo = true

    async function buscar() {
      setCarregando(true)
      const inicioAtual    = new Date(mes.year, mes.month, 1)
      const fimAtual       = new Date(mes.year, mes.month + 1, 0, 23, 59, 59, 999)
      const inicioAnterior = new Date(mes.year, mes.month - 1, 1)
      const fimAnterior    = new Date(mes.year, mes.month, 0, 23, 59, 59, 999)

      const seletor = `
        nome_produto,
        quantidade,
        subtotal,
        pedido:pedidos!inner(
          id,
          loja_id,
          status,
          criado_em
        )
      `

      const [resAtual, resAnterior] = await Promise.all([
        supabase
          .from('itens_pedido')
          .select(seletor)
          .eq('pedido.loja_id', lojaId)
          .neq('pedido.status', 'cancelado')
          .gte('pedido.criado_em', inicioAtual.toISOString())
          .lte('pedido.criado_em', fimAtual.toISOString()),
        supabase
          .from('itens_pedido')
          .select(seletor)
          .eq('pedido.loja_id', lojaId)
          .neq('pedido.status', 'cancelado')
          .gte('pedido.criado_em', inicioAnterior.toISOString())
          .lte('pedido.criado_em', fimAnterior.toISOString()),
      ])

      if (!ativo) return

      // ── Mês atual ──────────────────────────────────────
      const itensAtual = (resAtual.data ?? []) as unknown as ItemBreakdown[]

      const agrupado = itensAtual.reduce<Record<string, { unidades: number; receita: number }>>(
        (acc, item) => {
          if (!acc[item.nome_produto]) acc[item.nome_produto] = { unidades: 0, receita: 0 }
          acc[item.nome_produto].unidades += Number(item.quantidade)
          acc[item.nome_produto].receita  += Number(item.subtotal)
          return acc
        },
        {},
      )

      const totalRec = Object.values(agrupado).reduce((s, p) => s + p.receita, 0)
      const totalUni = Object.values(agrupado).reduce((s, p) => s + p.unidades, 0)

      const ordenados: ProdutoAgrupado[] = Object.entries(agrupado)
        .sort((a, b) => b[1].receita - a[1].receita)
        .map(([nome, p]) => ({
          nome,
          unidades: p.unidades,
          receita: p.receita,
          percentual: totalRec > 0 ? (p.receita / totalRec * 100).toFixed(1) : '0.0',
        }))

      const pedidosAtualSet = new Set(itensAtual.map(it => it.pedido?.id).filter(Boolean))
      const topAtual = ordenados.length > 0
        ? { nome: ordenados[0].nome, unidades: Math.round(ordenados[0].unidades) }
        : null

      // ── Mês anterior ──────────────────────────────────
      const itensAnterior = (resAnterior.data ?? []) as unknown as ItemBreakdown[]

      const agrupadoAnt = itensAnterior.reduce<Record<string, { unidades: number; receita: number }>>(
        (acc, item) => {
          if (!acc[item.nome_produto]) acc[item.nome_produto] = { unidades: 0, receita: 0 }
          acc[item.nome_produto].unidades += Number(item.quantidade)
          acc[item.nome_produto].receita  += Number(item.subtotal)
          return acc
        },
        {},
      )

      const totalRecAnt = Object.values(agrupadoAnt).reduce((s, p) => s + p.receita, 0)
      const pedidosAntSet = new Set(itensAnterior.map(it => it.pedido?.id).filter(Boolean))
      const sortedAnt = Object.entries(agrupadoAnt).sort((a, b) => b[1].unidades - a[1].unidades)
      const topAnterior = sortedAnt.length > 0
        ? { nome: sortedAnt[0][0], unidades: Math.round(sortedAnt[0][1].unidades) }
        : null

      // ── State ──────────────────────────────────────────
      setProdutos(ordenados)
      setTotalReceita(totalRec)
      setTotalUnidades(totalUni)
      setMetricasAtual({ faturamento: totalRec, pedidos: pedidosAtualSet.size, topProduto: topAtual })
      setMetricasAnterior({ faturamento: totalRecAnt, pedidos: pedidosAntSet.size, topProduto: topAnterior })
      setCarregando(false)
    }

    buscar()
    return () => { ativo = false }
  }, [lojaId, mes, externalRefreshKey])

  const labelMes = `${MESES_PT[mes.month]} ${mes.year}`
  const estrela  = produtos[0] ?? null

  const tmAtual    = metricasAtual.pedidos    > 0 ? metricasAtual.faturamento    / metricasAtual.pedidos    : null
  const tmAnterior = metricasAnterior.pedidos > 0 ? metricasAnterior.faturamento / metricasAnterior.pedidos : null
  const vTicket: Variacao = tmAtual != null && tmAnterior != null
    ? calcVariacao(tmAtual, tmAnterior)
    : tmAtual != null && metricasAnterior.pedidos === 0
      ? { novo: true }
      : null

  const vEstrela = estrela && metricasAnterior.topProduto?.nome === estrela.nome
    ? calcVariacao(Math.round(estrela.unidades), metricasAnterior.topProduto!.unidades)
    : null
  const mostrarLinhaExtra = vEstrela !== null && !vEstrela.novo

  return (
    <PlanGate feature="relatorios">
      <div className="flex flex-col gap-4">

        {/* Cabeçalho + navegação de mês */}
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Produtos mais vendidos</SectionTitle>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => navMes(-1)}
              aria-label="Mês anterior"
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-soft hover:bg-brand-50 hover:text-brand-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <span className="text-sm font-medium text-ink w-[120px] text-center select-none">
              {labelMes}
            </span>
            <button
              type="button"
              onClick={() => navMes(1)}
              disabled={!podeProximo}
              aria-label="Próximo mês"
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-soft hover:bg-brand-50 hover:text-brand-700 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* 3 cards de comparativo mês atual vs anterior */}
        {carregando ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} bodyClassName="p-4">
                <div className="h-3 w-20 rounded bg-line animate-pulse mb-3" />
                <div className="h-7 w-28 rounded bg-line animate-pulse mb-2" />
                <div className="h-3 w-24 rounded bg-line animate-pulse" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card bodyClassName="p-4">
              <p className="text-xs font-medium text-ink-mute mb-2">Faturamento</p>
              <p className="text-2xl font-bold text-ink leading-tight">{formatarReal(metricasAtual.faturamento)}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-ink-mute">vs {formatarReal(metricasAnterior.faturamento)}</p>
                <VariacaoBadge v={calcVariacao(metricasAtual.faturamento, metricasAnterior.faturamento)} />
              </div>
            </Card>
            <Card bodyClassName="p-4">
              <p className="text-xs font-medium text-ink-mute mb-2">Pedidos</p>
              <p className="text-2xl font-bold text-ink leading-tight">{metricasAtual.pedidos}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-ink-mute">vs {metricasAnterior.pedidos}</p>
                <VariacaoBadge v={calcVariacao(metricasAtual.pedidos, metricasAnterior.pedidos)} />
              </div>
            </Card>
            <Card bodyClassName="p-4">
              <p className="text-xs font-medium text-ink-mute mb-2">Ticket médio</p>
              <p className="text-2xl font-bold text-ink leading-tight">
                {tmAtual != null ? formatarReal(tmAtual) : '—'}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-ink-mute">
                  {tmAnterior != null ? `vs ${formatarReal(tmAnterior)}` : 'sem dados anteriores'}
                </p>
                <VariacaoBadge v={vTicket} />
              </div>
            </Card>
          </div>
        )}

        {/* Tabela + produto estrela */}
        {carregando ? (
          /* Skeleton 5 linhas */
          <Card bodyClassName="p-4">
            <div className="flex flex-col divide-y divide-line">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 animate-pulse">
                  <div className="h-3 flex-1 rounded bg-line" />
                  <div className="h-3 w-10 rounded bg-line" />
                  <div className="h-3 w-20 rounded bg-line" />
                  <div className="h-3 w-16 rounded bg-line" />
                </div>
              ))}
            </div>
          </Card>
        ) : produtos.length === 0 ? (
          /* Empty state */
          <Card bodyClassName="p-10">
            <div className="flex flex-col items-center gap-2">
              <BarChart2 size={32} strokeWidth={1.25} className="text-ink-mute" />
              <p className="text-sm text-ink-mute text-center">
                Nenhum pedido registrado em {labelMes}.
              </p>
            </div>
          </Card>
        ) : (
          <>
            {/* Card destaque — produto estrela */}
            {estrela && (
              <div id="produto-estrela-mes" className="flex items-start gap-3 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
                <Star size={18} strokeWidth={1.75} className="text-brand-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm text-ink-soft leading-snug">
                    <span className="font-semibold text-ink">Produto estrela do mês:</span>{' '}
                    {estrela.nome} —{' '}
                    {Math.round(estrela.unidades)} unidades · {formatarReal(estrela.receita)}
                  </p>
                  {mostrarLinhaExtra && vEstrela && !vEstrela.novo && (
                    <p className="text-xs text-ink-mute leading-snug">
                      (também foi o top do mês passado,{' '}
                      <span className={vEstrela.positiva ? 'text-brand-600' : 'text-danger'}>
                        {vEstrela.texto}
                      </span>
                      {' '}nas unidades)
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tabela */}
            <Card bodyClassName="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                {/* Cabeçalho */}
                <div className="grid grid-cols-[1fr_56px_100px_140px] gap-x-3 px-4 py-2.5 border-b border-line bg-bg min-w-[400px]">
                  <span className="text-[11px] font-semibold text-ink-mute uppercase tracking-wide">Produto</span>
                  <span className="text-[11px] font-semibold text-ink-mute uppercase tracking-wide text-right">Unid.</span>
                  <span className="text-[11px] font-semibold text-ink-mute uppercase tracking-wide text-right">Receita</span>
                  <span className="text-[11px] font-semibold text-ink-mute uppercase tracking-wide text-right">% do total</span>
                </div>

                {/* Linhas */}
                <div className="divide-y divide-line min-w-[400px]">
                  {produtos.map((p, i) => (
                    <div
                      key={p.nome}
                      className="grid grid-cols-[1fr_56px_100px_140px] gap-x-3 px-4 py-3 items-center"
                    >
                      {/* Nome + badge Top */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm text-ink truncate">{p.nome}</span>
                        {i === 0 && (
                          <span className="shrink-0 inline-flex items-center text-[11px] font-semibold text-accent bg-accent/10 rounded-full px-2 py-0.5 leading-none">
                            ⭐ Top
                          </span>
                        )}
                      </div>

                      {/* Unidades */}
                      <span className="text-sm text-ink-soft text-right tabular-nums">
                        {Math.round(p.unidades)}
                      </span>

                      {/* Receita */}
                      <span className="text-sm font-semibold text-brand-700 text-right tabular-nums whitespace-nowrap">
                        {formatarReal(p.receita)}
                      </span>

                      {/* % + barra */}
                      <div className="flex items-center gap-2 justify-end">
                        <div className="flex-1 h-1 rounded-full overflow-hidden bg-line">
                          <div
                            className="h-1 rounded-full bg-brand-500 transition-all duration-300"
                            style={{ width: `${p.percentual}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink-soft tabular-nums w-9 text-right shrink-0">
                          {p.percentual}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rodapé totais */}
                <div className="grid grid-cols-[1fr_56px_100px_140px] gap-x-3 px-4 py-3 border-t-2 border-line bg-bg items-center min-w-[400px]">
                  <span className="text-sm font-bold text-ink">TOTAL</span>
                  <span className="text-sm font-bold text-ink text-right tabular-nums">
                    {Math.round(totalUnidades)}
                  </span>
                  <span className="text-sm font-bold text-brand-700 text-right tabular-nums whitespace-nowrap">
                    {formatarReal(totalReceita)}
                  </span>
                  <span className="text-sm font-bold text-ink text-right">100%</span>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </PlanGate>
  )
}

/* ── Pedidos em andamento ───────────────────────────────── */

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function PedidosAndamento({ pedidos }: { pedidos: PedidoAndamento[] }) {
  const mostrar = pedidos.slice(0, 5)
  const temMais = pedidos.length > 5

  return (
    <Card bodyClassName="p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>Pedidos em andamento</SectionTitle>
        <Link
          href="/painel/pedidos"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          Ver pedidos
        </Link>
      </div>

      {mostrar.length === 0 ? (
        <p className="text-sm text-ink-mute py-4 text-center">Nenhum pedido em andamento agora.</p>
      ) : (
        <div className="flex flex-col divide-y divide-line">
          {mostrar.map(p => (
            <div key={p.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{p.nome_cliente}</p>
                <p className="text-xs text-ink-mute">{formatarHora(p.criado_em)}</p>
              </div>
              <span className="text-sm font-semibold text-brand-700 shrink-0">{formatarReal(p.total)}</span>
              <StatusBadge status={p.status} />
            </div>
          ))}
          {temMais && (
            <div className="pt-2.5">
              <Link
                href="/painel/pedidos"
                className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                Ver todos ({pedidos.length})
              </Link>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

/* ── Top 5 produtos ─────────────────────────────────────── */

function TopProdutos({ produtos, titulo }: { produtos: TopProduto[]; titulo: string }) {
  if (produtos.length === 0) {
    return (
      <Card bodyClassName="p-4">
        <SectionTitle className="mb-3">{titulo}</SectionTitle>
        <p className="text-sm text-ink-mute py-4 text-center">Sem vendas neste período.</p>
      </Card>
    )
  }

  return (
    <Card bodyClassName="p-4">
      <SectionTitle className="mb-3">{titulo}</SectionTitle>
      <div className="flex flex-col divide-y divide-line">
        {produtos.map((it, i) => (
          <div key={i} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
            <span className="text-xs font-bold text-brand-700 bg-brand-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span className="flex-1 text-sm text-ink truncate">{it.nome}</span>
            <span className="text-sm font-semibold text-ink shrink-0">{it.qtd}x</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ── Últimas avaliações ─────────────────────────────────── */

function Estrelas({ nota }: { nota: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={14}
          strokeWidth={1.75}
          className={i < nota ? 'fill-accent text-accent' : 'text-line'}
        />
      ))}
    </div>
  )
}

function UltimasAvaliacoes({ avaliacoes }: { avaliacoes: AvaliacaoRow[] }) {
  if (avaliacoes.length === 0) return null

  return (
    <Card bodyClassName="p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>Últimas avaliações</SectionTitle>
        <Link
          href="/painel/conta?tab=avaliacoes"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          Ver todas
        </Link>
      </div>
      <div className="flex flex-col divide-y divide-line">
        {avaliacoes.map(av => (
          <div key={av.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <Estrelas nota={av.nota} />
              <span className="text-xs text-ink-mute shrink-0">
                {mascararNome(
                  Array.isArray(av.profiles) ? av.profiles[0]?.nome : av.profiles?.nome
                )}
              </span>
            </div>
            {av.comentario && (
              <p className="text-sm text-ink-soft leading-relaxed line-clamp-2">{av.comentario}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ── Onboarding: primeiros passos ───────────────────────── */

interface PrimeirosPassosProps {
  temLoja: boolean
  temCategoria: boolean
  temProduto: boolean
}

function PrimeirosPassos({ temLoja, temCategoria, temProduto }: PrimeirosPassosProps) {
  const passos = [
    { feito: temLoja,      bloqueado: false,    titulo: 'Criar sua loja',                 href: '/painel',            cta: 'Criar' },
    { feito: temCategoria, bloqueado: !temLoja, titulo: 'Adicionar categorias',           href: '/painel/categorias', cta: 'Adicionar' },
    { feito: temProduto,   bloqueado: !temLoja, titulo: 'Cadastrar seu primeiro produto', href: '/painel/produtos',   cta: 'Cadastrar' },
  ]
  const concluidos = passos.filter(p => p.feito).length

  return (
    <Card bodyClassName="p-6">
      <h2 className="text-[18px] font-semibold text-ink">Primeiros passos</h2>
      <p className="text-sm text-ink-soft mt-1 mb-4">
        {concluidos} de 3 concluídos · finalize para publicar sua loja.
      </p>

      <ul className="flex flex-col divide-y divide-line">
        {passos.map((passo, i) => (
          <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span
              className={[
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                passo.feito
                  ? 'bg-brand-500 text-surface'
                  : passo.bloqueado
                    ? 'border border-line text-ink-mute'
                    : 'border border-brand-300 text-brand-600',
              ].join(' ')}
            >
              {passo.feito
                ? <Check size={14} strokeWidth={3} />
                : <span className="text-xs font-semibold">{i + 1}</span>}
            </span>

            <span
              className={[
                'flex-1 text-sm font-medium leading-snug',
                passo.feito
                  ? 'text-ink-mute line-through'
                  : passo.bloqueado
                    ? 'text-ink-mute'
                    : 'text-ink',
              ].join(' ')}
            >
              {passo.titulo}
            </span>

            {!passo.feito && (
              passo.bloqueado ? (
                <span className="inline-flex items-center gap-1 text-xs text-ink-mute shrink-0">
                  <Lock size={12} strokeWidth={1.75} />
                  Crie a loja
                </span>
              ) : (
                <Link
                  href={passo.href}
                  className="shrink-0 inline-flex items-center justify-center min-h-[36px] px-3 rounded-md text-xs font-semibold bg-surface text-brand-700 border border-line hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {passo.cta}
                </Link>
              )
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ── Loja no ar ─────────────────────────────────────────── */

function LojaNoAr({ slug, origin }: { slug: string; origin: string }) {
  const [copiado, setCopiado] = useState(false)
  const link = origin ? `${origin}/loja/${slug}` : `/loja/${slug}`
  const { isLimitReached } = usePlan()
  const limitReached = isLimitReached()

  function copiar() {
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Card bodyClassName="p-6">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
          <Check size={20} strokeWidth={2.5} className="text-brand-600" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold text-ink">Sua loja está no ar!</h2>
          <p className="text-sm text-ink-soft mt-1 leading-snug">
            Compartilhe o link abaixo para começar a receber pedidos.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-line bg-bg px-3 py-2.5">
        <span className="text-sm text-ink-soft break-all">{link}</span>
      </div>

      <div className="flex gap-3 mt-3">
        <Button variant="secondary" className="flex-1" onClick={copiar}>
          {copiado
            ? <><Check size={16} strokeWidth={2.5} />Copiado!</>
            : <><Copy size={16} strokeWidth={1.75} />Copiar link</>}
        </Button>
        <a
          href={`/loja/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-md font-semibold text-sm bg-brand-500 text-surface hover:bg-brand-600 active:scale-[0.98] transition-all duration-150 ease-out shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Ver minha loja
        </a>
      </div>

      {limitReached && (
        <div className="mt-4 flex items-start gap-3 bg-danger/10 rounded-xl px-4 py-3">
          <AlertCircle size={18} strokeWidth={1.75} className="text-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-danger leading-snug">
              Pedidos bloqueados — limite do mês atingido. Faça upgrade para continuar recebendo.
            </p>
            <Link
              href="/painel/planos"
              className="mt-2 inline-flex items-center text-sm font-semibold text-danger hover:opacity-80 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger rounded"
            >
              Ver planos →
            </Link>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ── Página ─────────────────────────────────────────────── */

export default function Painel() {
  const router = useRouter()
  const { lojaId: lojaIdFromRole, papel, isLoading: roleLoading } = useRole()

  const [userId, setUserId]     = useState<string | null>(null)
  const [loja, setLoja]         = useState<Loja | null | undefined>(undefined)
  const [origin, setOrigin]     = useState('')

  // Onboarding
  const [temCategoria, setTemCategoria] = useState(false)
  const [temProduto, setTemProduto]     = useState(false)

  // KPIs com período
  const [kpiAtual,      setKpiAtual]      = useState<KpiDia>({ count: 0, total: 0 })
  const [kpiAnterior,   setKpiAnterior]   = useState<KpiDia>({ count: 0, total: 0 })
  const [kpiCarregando, setKpiCarregando] = useState(true)
  const [periodo,       setPeriodo]       = useState<Periodo>('hoje')
  const [dataInicio,    setDataInicio]    = useState<Date | undefined>()
  const [dataFim,       setDataFim]       = useState<Date | undefined>()

  // Dados em tempo real (não afetados pelo filtro)
  const [valoresOcultos, setValoresOcultos] = useState(false)
  const [andamento,      setAndamento]      = useState<PedidoAndamento[]>([])
  const [avaliacoes,     setAvaliacoes]     = useState<AvaliacaoRow[]>([])

  // Top produtos e dados brutos do período (para gráfico)
  const [topProdutos,   setTopProdutos]   = useState<TopProduto[]>([])
  const [pedidosBrutos, setPedidosBrutos] = useState<PedidoBruto[]>([])

  // Exportação CSV
  const [exportando, setExportando] = useState(false)

  // Gatilho de recarga em tempo real (incrementa a cada mudança em pedidos)
  const [refreshKey, setRefreshKey] = useState(0)
  const refreshKeyRef = useRef(0)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevKpiRef    = useRef<KpiDia>({ count: 0, total: 0 })
  const [flashCards, setFlashCards] = useState({ pedidos: 0, faturamento: 0, ticket: 0 })

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // ── Inicialização: auth + loja + dados em tempo real ────
  // Aguarda useRole resolver (funciona para dono, gerente e dono sem loja ainda)
  useEffect(() => {
    if (roleLoading) return

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserId(user.id)

      // Dono recém-cadastrado ainda sem loja — mostra tela de onboarding
      if (!lojaIdFromRole) {
        setLoja(null)
        return
      }

      // Busca pelo ID resolvido pelo useRole — funciona para dono e gerente
      const { data: lojaData } = await supabase
        .from('lojas')
        .select('*')
        .eq('id', lojaIdFromRole)
        .maybeSingle()

      const lojaEncontrada = lojaData ? (lojaData as Loja) : null
      setLoja(lojaEncontrada)

      if (!lojaEncontrada) return

      const lojaId = lojaEncontrada.id

      const [catCheck, prodCheck, avaliacoesRes] = await Promise.all([
        supabase.from('categorias').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
        supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
        supabase
          .from('avaliacoes')
          .select('id,nota,comentario,criado_em,profiles:cliente_id(nome)')
          .eq('loja_id', lojaId)
          .order('criado_em', { ascending: false })
          .limit(3),
      ])

      setTemCategoria((catCheck.count ?? 0) > 0)
      setTemProduto((prodCheck.count ?? 0) > 0)
      setAvaliacoes((avaliacoesRes.data ?? []) as AvaliacaoRow[])
    }

    init()
  }, [router, lojaIdFromRole, roleLoading])

  // ── Pedidos em andamento — 1ª carga + recarga a cada novo pedido ────────
  useEffect(() => {
    const id = loja?.id
    if (!id) return
    let ativo = true
    supabase
      .from('pedidos')
      .select('id,total,status,criado_em,nome_cliente')
      .eq('loja_id', id)
      .in('status', ['recebido', 'preparando', 'saiu_entrega'])
      .order('criado_em', { ascending: false })
      .then(({ data }) => {
        if (ativo) setAndamento((data ?? []) as PedidoAndamento[])
      })
    return () => { ativo = false }
  }, [loja?.id, refreshKey])

  // ── Realtime: atualiza o painel sempre que um pedido muda na loja ───────
  useEffect(() => {
    const id = loja?.id
    if (!id) return

    const channel = supabase
      .channel(`dashboard-pedidos-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            toast.success('Novo pedido recebido!')
          }
          // Debounce: agrupa rajadas de eventos antes de recalcular
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            setRefreshKey(k => k + 1)
            debounceRef.current = null
          }, 800)
        },
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [loja?.id])

  // ── KPIs + Top5 — recarregam ao mudar período ───────────
  useEffect(() => {
    const id = loja?.id
    if (!id) return

    const range = calcPeriodo(periodo, dataInicio, dataFim)
    if (!range) return // personalizado sem datas preenchidas

    const { inicioP, fimP, dias } = range
    const fimAnt    = new Date(inicioP.getTime() - 1)
    const inicioAnt = new Date(inicioP)
    inicioAnt.setDate(inicioAnt.getDate() - dias)
    inicioAnt.setHours(0, 0, 0, 0)

    // Recarga em tempo real (novo pedido) não mostra skeleton — só 1ª carga/troca de período
    const ehRecargaRealtime = refreshKeyRef.current !== refreshKey
    refreshKeyRef.current = refreshKey
    if (!ehRecargaRealtime) setKpiCarregando(true)
    let ativo = true

    Promise.all([
      buscarPedidosBrutos(id, inicioP, fimP),  // período atual (raw — para KPI + gráfico)
      buscarKPIs(id, inicioAnt, fimAnt),        // período anterior (só agregado)
      buscarTop5(id, inicioP, fimP),
    ]).then(([brutos, anterior, top]) => {
      if (!ativo) return
      const novoAtual = kpiDeDados(brutos)

      // Flash nos cards cujo valor mudou — só em atualizações de realtime
      if (ehRecargaRealtime) {
        const prev = prevKpiRef.current
        const prevTicket = prev.count > 0 ? prev.total / prev.count : 0
        const novTicket  = novoAtual.count > 0 ? novoAtual.total / novoAtual.count : 0
        if (novoAtual.count !== prev.count)
          setFlashCards(f => ({ ...f, pedidos: f.pedidos + 1 }))
        if (novoAtual.total !== prev.total)
          setFlashCards(f => ({ ...f, faturamento: f.faturamento + 1 }))
        if (Math.round(novTicket * 100) !== Math.round(prevTicket * 100))
          setFlashCards(f => ({ ...f, ticket: f.ticket + 1 }))
      }
      prevKpiRef.current = novoAtual

      setKpiAtual(novoAtual)
      setPedidosBrutos(brutos)
      setKpiAnterior(anterior)
      setTopProdutos(top)
      setKpiCarregando(false)
    })

    return () => { ativo = false }
  }, [loja?.id, periodo, dataInicio, dataFim, refreshKey])

  async function exportarCSV() {
    const range = calcPeriodo(periodo, dataInicio, dataFim)
    if (!range || !loja) return
    const { inicioP, fimP } = range

    setExportando(true)
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id, criado_em, nome_cliente, telefone_cliente, endereco_entrega,
          forma_pagamento, status, total, taxa_entrega, observacoes,
          itens_pedido ( nome_produto, quantidade, unidade, preco_unitario, subtotal )
        `)
        .eq('loja_id', loja.id)
        .gte('criado_em', inicioP.toISOString())
        .lte('criado_em', fimP.toISOString())
        .order('criado_em', { ascending: false })

      if (error) throw error

      const pedidos = (data ?? []) as PedidoCSVRow[]

      if (pedidos.length === 0) {
        toast.info('Nenhum pedido no período selecionado.')
        return
      }

      function escapeCsv(val: unknown): string {
        const str = String(val ?? '')
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"'
        }
        return str
      }

      const PGTO: Record<string, string> = {
        pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro',
      }
      const STS: Record<string, string> = {
        recebido: 'Recebido', preparando: 'Preparando',
        saiu_entrega: 'Saiu para entrega', entregue: 'Entregue', cancelado: 'Cancelado',
      }

      const headers = [
        'Pedido', 'Data', 'Hora', 'Cliente', 'Telefone', 'Endereço',
        'Itens', 'Subtotal Produtos', 'Taxa Entrega', 'Total', 'Pagamento', 'Status',
      ].join(',')

      const linhas = pedidos.map(p => {
        const dt   = new Date(p.criado_em)
        const taxa = Number(p.taxa_entrega) || 0
        const tot  = Number(p.total) || 0

        const itensStr = (p.itens_pedido ?? []).map(it => {
          const un = it.unidade ? ` (${it.unidade})` : ''
          return `${it.quantidade}x ${it.nome_produto}${un} ${formatarReal(Number(it.subtotal))}`
        }).join('; ')

        return [
          escapeCsv(p.id.slice(0, 8)),
          escapeCsv(dt.toLocaleDateString('pt-BR')),
          escapeCsv(dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
          escapeCsv(p.nome_cliente || 'Anônimo'),
          escapeCsv(p.telefone_cliente || ''),
          escapeCsv(p.endereco_entrega || ''),
          escapeCsv(itensStr),
          escapeCsv(formatarReal(tot - taxa)),
          escapeCsv(formatarReal(taxa)),
          escapeCsv(formatarReal(tot)),
          escapeCsv(PGTO[p.forma_pagamento] ?? p.forma_pagamento),
          escapeCsv(STS[p.status] ?? p.status),
        ].join(',')
      })

      // Rodapé de totais (excluindo cancelados)
      const ativos      = pedidos.filter(p => p.status !== 'cancelado')
      const somaTotal   = ativos.reduce((s, p) => s + (Number(p.total) || 0), 0)
      const somaTaxa    = ativos.reduce((s, p) => s + (Number(p.taxa_entrega) || 0), 0)
      const somaSubtot  = somaTotal - somaTaxa
      const totalRow = [
        escapeCsv('TOTAL'), '', '', '', '', '',
        escapeCsv(`${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}`),
        escapeCsv(formatarReal(somaSubtot)),
        escapeCsv(formatarReal(somaTaxa)),
        escapeCsv(formatarReal(somaTotal)),
        '', '',
      ].join(',')

      const csvContent = [headers, ...linhas, totalRow].join('\n')

      // Nome do arquivo
      function fmtFn(d: Date) {
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
      }
      const hoje = new Date()
      let nomeArquivo: string
      if (periodo === 'hoje')       nomeArquivo = `odecasa-pedidos-${fmtFn(hoje)}.csv`
      else if (periodo === '7dias') nomeArquivo = `odecasa-pedidos-7dias-${fmtFn(hoje)}.csv`
      else if (periodo === '30dias')nomeArquivo = `odecasa-pedidos-30dias-${fmtFn(hoje)}.csv`
      else nomeArquivo = `odecasa-pedidos-${fmtFn(dataInicio!)}-a-${fmtFn(dataFim!)}.csv`

      const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href  = url
      link.download = nomeArquivo
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível exportar. Tente novamente.')
    } finally {
      setExportando(false)
    }
  }

  if (loja === undefined || !userId) return null

  const temLoja = loja !== null
  const onboardingCompleto = temLoja && temCategoria && temProduto

  return (
    <main className="py-8">
      <PageContainer size="reading" className="flex flex-col gap-6">

        {/* Banner de limite de plano */}
        <PlanLimitBanner />

        {/* Onboarding: exibe checklist enquanto incompleto */}
        {!onboardingCompleto && (
          <PrimeirosPassos
            temLoja={temLoja}
            temCategoria={temCategoria}
            temProduto={temProduto}
          />
        )}

        {/* Formulário de criação — para donos sem loja (incluindo recém-cadastrados) */}
        {!temLoja && (papel === 'dono' || papel === null) && (
          <StoreInfoCard
            userId={userId}
            loja={null}
            onSalvo={novaLoja => {
              setLoja(novaLoja)
              toast.success('Loja criada!')
            }}
          />
        )}

        {/* Dashboard operacional (quando há loja) */}
        {temLoja && (
          <>
            {/* Boas-vindas */}
            <div>
              <span className="w-16 h-16 rounded-full overflow-hidden bg-brand-50 border border-line flex items-center justify-center shrink-0 shadow-sm mb-3">
                {loja.logo_url ? (
                  <img src={loja.logo_url} alt={loja.nome} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-brand-700 select-none leading-none">
                    {loja.nome.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <h1 className="text-2xl font-bold text-ink leading-tight">
                Boas-vindas e boas-vendas, <span className="text-brand-500">{loja.nome}</span>!
              </h1>
              <p className="text-sm text-ink-soft mt-1">Acompanhe seus pedidos e o desempenho da sua loja.</p>
            </div>

            {/* Filtro de período + KPIs */}
            <div className="flex flex-col gap-3">
              <FiltroPeriodo
                periodo={periodo}
                setPeriodo={setPeriodo}
                dataInicio={dataInicio}
                setDataInicio={setDataInicio}
                dataFim={dataFim}
                setDataFim={setDataFim}
                rightSlot={
                  <PlanGate
                    feature="relatorios"
                    variant="compact"
                    fallback="Exportar CSV"
                  >
                    <button
                      onClick={exportarCSV}
                      disabled={exportando || kpiCarregando}
                      className={[
                        'inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-md',
                        'text-sm font-semibold bg-surface border border-line text-brand-700',
                        'hover:bg-brand-50 transition-colors duration-150',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      ].join(' ')}
                    >
                      {exportando
                        ? <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                        : <Download size={15} strokeWidth={1.75} />
                      }
                      {exportando ? 'Exportando...' : 'Exportar CSV'}
                    </button>
                  </PlanGate>
                }
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-semibold text-ink">
                    {tituloSecao(periodo, dataInicio, dataFim)}
                  </h2>
                  <span
                    title="Atualização em tempo real"
                    aria-label="Dados em tempo real"
                    className="w-2 h-2 rounded-full bg-brand-500 animate-live-dot shrink-0"
                  />
                  <button
                    onClick={() => setValoresOcultos(o => !o)}
                    aria-label={valoresOcultos ? 'Mostrar valores' : 'Ocultar valores'}
                    className="text-ink-mute hover:text-ink-soft transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  >
                    {valoresOcultos
                      ? <EyeOff size={16} strokeWidth={1.75} />
                      : <Eye size={16} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              {kpiCarregando
                ? <KpiSkeleton />
                : (
                  <KpiCards
                    atual={kpiAtual}
                    anterior={kpiAnterior}
                    oculto={valoresOcultos}
                    periodo={periodo}
                    flash={flashCards}
                  />
                )
              }
            </div>

            {/* Gráfico de faturamento (segue o período, gateado por plano) */}
            <GraficoFaturamento
              pedidos={pedidosBrutos}
              carregando={kpiCarregando}
              periodo={periodo}
              dataInicio={dataInicio}
              dataFim={dataFim}
            />

            {/* Breakdown por produto — relatório mensal */}
            <BreakdownProdutos lojaId={loja.id} refreshKey={refreshKey} />

            {/* Pedidos em andamento — tempo real, não afetado pelo filtro */}
            <PedidosAndamento pedidos={andamento} />

            {/* Top produtos (período) + Avaliações (tempo real) */}
            <div className="grid md:grid-cols-2 gap-4">
              <TopProdutos produtos={topProdutos} titulo={tituloProdutos(periodo)} />
              <UltimasAvaliacoes avaliacoes={avaliacoes} />
            </div>
          </>
        )}

      </PageContainer>
    </main>
  )
}
