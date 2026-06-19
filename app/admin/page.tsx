'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Search, Store, SearchX, ExternalLink, ShieldCheck,
  X, ChevronDown, AlertTriangle, TrendingUp, Clock,
  AlertCircle, ArrowUpCircle, Calendar,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/ui/TopBar'
import { PageContainer } from '@/components/ui/PageContainer'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { IconButton } from '@/components/ui/IconButton'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
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

interface PlanoInfo {
  id: string
  nome: string
  preco_mensal: number
}

interface AssinaturaInfo {
  id: string
  plano_id: string
  plano_nome: string
  status: 'trial' | 'ativa' | 'vencida' | 'cancelada'
  vence_em: string | null
}

interface LojaView extends LojaRow {
  dono: Dono | null
  pedidos: number
  assinatura: AssinaturaInfo | null
}

interface Kpis {
  totalLojas: number
  lojasAtivas: number
  totalPedidos: number
  faturamento: number
}

interface SaudeDados {
  mrr: number
  assinaturasAtivas: number
  trialOuGratis: number
  assinaturasVencidaCancelada: number
  distribuicao: { nome: string; count: number; pct: number }[]
  vencendo: LojaView[]
}

type FiltroPlano = 'todos' | 'gratis' | 'crescimento' | 'bairro_plus' | 'vencidos'

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

/* ── Badge de status da loja ─────────────────────── */

function StatusLoja({ ativo }: { ativo: boolean }) {
  return (
    <span className={[
      'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap',
      ativo ? 'bg-brand-100 text-brand-700' : 'bg-line text-ink-mute',
    ].join(' ')}>
      {ativo ? 'Ativa' : 'Inativa'}
    </span>
  )
}

/* ── Badge de status da assinatura ───────────────── */

const ASSINATURA_STATUS_STYLE: Record<AssinaturaInfo['status'], string> = {
  ativa:     'bg-brand-100 text-brand-700',
  trial:     'bg-line text-ink-soft',
  vencida:   'bg-danger/10 text-danger',
  cancelada: 'bg-line text-ink-mute',
}

const ASSINATURA_STATUS_LABEL: Record<AssinaturaInfo['status'], string> = {
  ativa:     'Ativa',
  trial:     'Trial',
  vencida:   'Vencida',
  cancelada: 'Cancelada',
}

function PlanoBadge({ assinatura, onClick }: {
  assinatura: AssinaturaInfo | null
  onClick: () => void
}) {
  const plano  = assinatura?.plano_nome ?? 'Sem plano'
  const status = assinatura?.status     ?? 'cancelada'

  return (
    <button
      onClick={onClick}
      title="Editar plano"
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
        'transition-opacity duration-150 hover:opacity-80',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        ASSINATURA_STATUS_STYLE[status],
      ].join(' ')}
    >
      {plano}
      <span className="opacity-60">·</span>
      {ASSINATURA_STATUS_LABEL[status]}
      <ChevronDown size={11} strokeWidth={2} className="opacity-60" />
    </button>
  )
}

/* ── Saúde da plataforma ─────────────────────────── */

function corBarra(nome: string): { bg: string; style?: Record<string, string> } {
  const n = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (n.includes('bairro')) return { bg: '', style: { backgroundColor: '#534AB7' } }
  if (n.includes('grat'))   return { bg: 'bg-line' }
  return { bg: 'bg-brand-500' }
}

function SaudeSection({
  lojas, planos, upgradesMes, onRenovar,
}: {
  lojas: LojaView[] | undefined
  planos: PlanoInfo[]
  upgradesMes: number
  onRenovar: (loja: LojaView) => void
}) {
  const saude = useMemo<SaudeDados | null>(() => {
    if (!lojas) return null

    const planoPrecoPorId: Record<string, number> = {}
    for (const p of planos) planoPrecoPorId[p.id] = p.preco_mensal

    let mrr = 0
    let assinaturasAtivas = 0
    let trialOuGratis = 0
    let assinaturasVencidaCancelada = 0

    for (const l of lojas) {
      const s   = l.assinatura?.status
      const pid = l.assinatura?.plano_id
      if (s === 'ativa') {
        assinaturasAtivas++
        mrr += planoPrecoPorId[pid ?? ''] ?? 0
      } else if (s === 'trial' || pid === 'gratis' || !l.assinatura) {
        trialOuGratis++
      } else if (s === 'vencida' || s === 'cancelada') {
        assinaturasVencidaCancelada++
      }
    }

    // Distribuição por plano
    const contagem: Record<string, number> = {}
    for (const l of lojas) {
      const nome = l.assinatura?.plano_nome ?? 'Grátis'
      contagem[nome] = (contagem[nome] ?? 0) + 1
    }
    const distribuicao = Object.entries(contagem)
      .map(([nome, count]) => ({
        nome,
        count,
        pct: lojas.length > 0 ? Math.round((count / lojas.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Vencendo em breve (hoje → +7 dias, apenas ativas)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const em7 = new Date(hoje)
    em7.setDate(em7.getDate() + 7)

    const vencendo = lojas
      .filter(l => {
        if (!l.assinatura?.vence_em || l.assinatura.status !== 'ativa') return false
        const d = new Date(l.assinatura.vence_em)
        return d >= hoje && d <= em7
      })
      .sort((a, b) =>
        new Date(a.assinatura!.vence_em!).getTime() -
        new Date(b.assinatura!.vence_em!).getTime(),
      )

    return { mrr, assinaturasAtivas, trialOuGratis, assinaturasVencidaCancelada, distribuicao, vencendo }
  }, [lojas, planos])

  const skeleton = !lojas
  const temVencendo = !skeleton && (saude?.vencendo.length ?? 0) > 0

  /* ── KPI cards ── */
  const vencCan = saude?.assinaturasVencidaCancelada ?? 0

  const kpiItems = saude
    ? [
        {
          label: 'MRR',
          valor: formatarReal(saude.mrr),
          desc:  'receita mensal recorrente',
          icone: <TrendingUp size={18} strokeWidth={1.75} className="text-brand-500" />,
          cor:   'text-ink',
        },
        {
          label: 'Lojas ativas',
          valor: String(saude.assinaturasAtivas),
          desc:  'assinaturas pagas ativas',
          icone: <Store size={18} strokeWidth={1.75} className="text-brand-500" />,
          cor:   'text-ink',
        },
        {
          label: 'Em trial / Grátis',
          valor: String(saude.trialOuGratis),
          desc:  'potenciais upgrades',
          icone: <Clock size={18} strokeWidth={1.75} className="text-ink-mute" />,
          cor:   'text-ink',
        },
        {
          label: 'Vencidas / Canceladas',
          valor: String(vencCan),
          desc:  'requerem atenção',
          icone: <AlertCircle size={18} strokeWidth={1.75}
                   className={vencCan > 0 ? 'text-danger' : 'text-brand-500'} />,
          cor:   vencCan > 0 ? 'text-danger' : 'text-brand-600',
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Saúde da plataforma</SectionTitle>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {skeleton
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} bodyClassName="p-4">
                <div className="h-5 w-5 rounded bg-line animate-pulse mb-3" />
                <div className="h-6 w-16 rounded bg-line animate-pulse mb-1" />
                <div className="h-3 w-24 rounded bg-line animate-pulse" />
              </Card>
            ))
          : kpiItems.map(k => (
              <Card key={k.label} bodyClassName="p-4">
                <div className="mb-3">{k.icone}</div>
                <p className={['text-xl font-bold leading-tight', k.cor].join(' ')}>
                  {k.valor}
                </p>
                <p className="text-xs text-ink-soft mt-0.5 leading-snug">{k.label}</p>
                <p className="text-xs text-ink-mute mt-0.5">{k.desc}</p>
              </Card>
            ))
        }
      </div>

      {/* Linha inferior: Distribuição + (Vencendo se houver) + Upgrades */}
      <div className={[
        'grid grid-cols-1 gap-3',
        temVencendo ? 'md:grid-cols-3' : 'md:grid-cols-2',
      ].join(' ')}>

        {/* Distribuição de planos */}
        <Card bodyClassName="p-5">
          <p className="text-sm font-semibold text-ink mb-4">Distribuição de planos</p>

          {skeleton ? (
            <div className="flex flex-col gap-3">
              {[80, 50, 30].map(w => (
                <div key={w} className="flex flex-col gap-1.5">
                  <div className="h-3 rounded bg-line animate-pulse" style={{ width: `${w}%` }} />
                  <div className="h-2 rounded-full bg-line animate-pulse w-full" />
                </div>
              ))}
            </div>
          ) : saude!.distribuicao.length === 0 ? (
            <p className="text-sm text-ink-mute">Sem dados</p>
          ) : (
            <div className="flex flex-col gap-3">
              {saude!.distribuicao.map(d => {
                const { bg, style } = corBarra(d.nome)
                return (
                  <div key={d.nome}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-ink">{d.nome}</span>
                      <span className="text-xs text-ink-mute tabular-nums">
                        {d.count} {d.count === 1 ? 'loja' : 'lojas'} · {d.pct}%
                      </span>
                    </div>
                    {/* Barra CSS pura — 8px, cores por plano */}
                    <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className={['h-full rounded-full transition-all duration-500', bg].join(' ').trim()}
                        style={{ width: `${d.pct}%`, ...style }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Vencendo em breve — oculto quando não há nenhuma */}
        {temVencendo && (
          <Card bodyClassName="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} strokeWidth={1.75} className="text-accent shrink-0" />
              <p className="text-sm font-semibold text-ink">Vencendo nos próximos 7 dias</p>
            </div>
            <div className="flex flex-col gap-2">
              {saude!.vencendo.map(l => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-accent/5 border border-accent/20 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{l.nome}</p>
                    <p className="text-xs text-ink-mute mt-0.5">
                      {l.assinatura?.plano_nome ?? '—'} · vence {formatarData(l.assinatura?.vence_em ?? null)}
                    </p>
                  </div>
                  <button
                    onClick={() => onRenovar(l)}
                    className={[
                      'shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold',
                      'bg-accent/10 text-accent hover:bg-accent/20',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    ].join(' ')}
                  >
                    Renovar
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Upgrades este mês */}
        <Card bodyClassName="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpCircle size={16} strokeWidth={1.75} className="text-brand-500 shrink-0" />
            <p className="text-sm font-semibold text-ink">Upgrades este mês</p>
          </div>

          {skeleton ? (
            <div className="h-12 rounded-lg bg-line animate-pulse" />
          ) : (
            <div className="flex flex-col items-center justify-center py-4 gap-1">
              <p className="text-4xl font-bold text-brand-700 tabular-nums leading-none">
                {upgradesMes}
              </p>
              <p className="text-xs text-ink-mute mt-2 text-center">
                {upgradesMes === 0
                  ? 'Nenhum upgrade registrado ainda.'
                  : upgradesMes === 1
                    ? 'upgrade registrado este mês'
                    : 'upgrades registrados este mês'}
              </p>
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}

/* ── Sheet de edição de assinatura ───────────────── */

interface LogEntry {
  criado_em: string
  plano_anterior: string | null
  plano_novo: string
  observacao: string | null
}

interface AssinaturaSheetProps {
  loja: LojaView
  planos: PlanoInfo[]
  adminId: string
  open: boolean
  onClose: () => void
  onSalvo: (novaAssinatura: AssinaturaInfo) => void
}

function AssinaturaSheet({ loja, planos, adminId, open, onClose, onSalvo }: AssinaturaSheetProps) {
  const [planoId,  setPlanoId]  = useState(loja.assinatura?.plano_id   ?? 'gratis')
  const [status,   setStatus]   = useState<AssinaturaInfo['status']>(loja.assinatura?.status ?? 'ativa')
  const [venceEm,  setVenceEm]  = useState(loja.assinatura?.vence_em?.slice(0, 10) ?? '')
  const [obs,      setObs]      = useState('')
  const [salvando, setSalvando] = useState(false)
  const [visivel,  setVisivel]  = useState(false)
  const [logs,     setLogs]     = useState<LogEntry[]>([])
  const overlayRef              = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setPlanoId(loja.assinatura?.plano_id   ?? 'gratis')
      setStatus(loja.assinatura?.status      ?? 'ativa')
      setVenceEm(loja.assinatura?.vence_em?.slice(0, 10) ?? '')
      setObs('')
      requestAnimationFrame(() => setVisivel(true))
      document.body.style.overflow = 'hidden'
      // Busca últimos 3 registros de log ao abrir
      supabase
        .from('assinatura_logs')
        .select('criado_em, plano_anterior, plano_novo, observacao')
        .eq('loja_id', loja.id)
        .order('criado_em', { ascending: false })
        .limit(3)
        .then(({ data }) => setLogs((data as LogEntry[]) ?? []))
    } else {
      setVisivel(false)
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open, loja.assinatura, loja.id])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open && !visivel) return null

  async function handleSalvar() {
    setSalvando(true)
    const planoAnterior = loja.assinatura?.plano_id ?? null
    const payload = { plano_id: planoId, status, vence_em: venceEm || null }

    // RPC com SECURITY DEFINER — bypassa RLS e valida admin dentro da função
    const { error: errAss } = await supabase.rpc('admin_upsert_assinatura', {
      p_loja_id:  loja.id,
      p_plano_id: payload.plano_id,
      p_status:   payload.status,
      p_vence_em: payload.vence_em ?? null,
    })

    if (errAss) {
      toast.error(`Erro: ${errAss.message}`)
      setSalvando(false)
      return
    }

    await supabase.from('assinatura_logs').insert({
      loja_id:        loja.id,
      admin_id:       adminId,
      plano_anterior: planoAnterior,
      plano_novo:     planoId,
      observacao:     obs.trim() || null,
    })

    const planoNome = planos.find(p => p.id === planoId)?.nome ?? planoId
    onSalvo({ id: loja.assinatura?.id ?? '', plano_id: planoId, plano_nome: planoNome, status, vence_em: venceEm || null })
    toast.success(`Plano de ${loja.nome} atualizado para ${planoNome}.`)

    // Recarrega log para exibir a alteração recém-feita se o sheet reabrir
    supabase
      .from('assinatura_logs')
      .select('criado_em, plano_anterior, plano_novo, observacao')
      .eq('loja_id', loja.id)
      .order('criado_em', { ascending: false })
      .limit(3)
      .then(({ data }) => setLogs((data as LogEntry[]) ?? []))

    setSalvando(false)
    onClose()
  }

  const selectClass = [
    'w-full h-11 rounded-md border border-line bg-surface px-3',
    'text-sm text-ink outline-none appearance-none',
    'transition-shadow duration-150',
    'focus:ring-2 focus:ring-brand-500 focus:border-transparent',
  ].join(' ')

  return (
    <div
      ref={overlayRef}
      className={[
        'fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end',
        'transition-colors duration-200',
        visivel ? 'bg-ink/40' : 'bg-transparent',
      ].join(' ')}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      role="dialog" aria-modal="true" aria-label={`Editar plano de ${loja.nome}`}
    >
      <div
        className={[
          'relative bg-surface flex flex-col',
          'w-full md:w-[400px] md:h-full',
          'rounded-t-2xl md:rounded-none md:rounded-l-2xl',
          'shadow-lg max-h-[92dvh] md:max-h-full',
          'transition-transform duration-200 ease-out',
          visivel ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink leading-snug">
              Gerenciar assinatura
            </h2>
            <p className="text-sm text-ink-mute mt-0.5 truncate">{loja.nome}</p>
          </div>
          <button
            onClick={onClose} aria-label="Fechar"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0 ml-3"
          >
            <X size={18} strokeWidth={1.75} className="text-ink-soft" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 flex flex-col gap-4">
          {/* Plano */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Plano</label>
            <div className="relative">
              <select value={planoId} onChange={e => setPlanoId(e.target.value)} className={selectClass}>
                {planos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome} {p.preco_mensal > 0 ? `— R$ ${p.preco_mensal}/mês` : '— Grátis'}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} strokeWidth={1.75} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Status</label>
            <div className="relative">
              <select value={status} onChange={e => setStatus(e.target.value as AssinaturaInfo['status'])} className={selectClass}>
                <option value="trial">Trial</option>
                <option value="ativa">Ativa</option>
                <option value="vencida">Vencida</option>
                <option value="cancelada">Cancelada</option>
              </select>
              <ChevronDown size={15} strokeWidth={1.75} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
            </div>
          </div>

          {/* Válido até */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">
              Válido até
              <span className="ml-1 text-xs text-ink-mute font-normal">(opcional)</span>
            </label>
            <input
              type="date" value={venceEm} onChange={e => setVenceEm(e.target.value)}
              className={[selectClass, 'cursor-pointer'].join(' ')}
            />
          </div>

          {/* Observação */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">
              Observação
              <span className="ml-1 text-xs text-ink-mute font-normal">(opcional)</span>
            </label>
            <textarea
              value={obs} onChange={e => setObs(e.target.value)} rows={3}
              placeholder='Ex: "Pix de R$49 recebido em 08/06"'
              className={[
                'w-full rounded-md border border-line bg-surface px-3 py-2.5',
                'text-sm text-ink placeholder:text-ink-mute',
                'outline-none resize-none transition-shadow duration-150',
                'focus:ring-2 focus:ring-brand-500 focus:border-transparent',
              ].join(' ')}
            />
          </div>

          {/* Histórico de alterações */}
          {logs.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-line">
              <p className="text-[11px] font-semibold text-ink-mute uppercase tracking-wide">
                Histórico recente
              </p>
              <div className="flex flex-col gap-2">
                {logs.map((log, i) => {
                  const nomeAnterior = planos.find(p => p.id === log.plano_anterior)?.nome
                    ?? log.plano_anterior ?? '—'
                  const nomeNovo = planos.find(p => p.id === log.plano_novo)?.nome
                    ?? log.plano_novo
                  return (
                    <p key={i} className="text-xs text-ink-mute leading-relaxed">
                      <span className="text-ink-soft font-medium">{formatarData(log.criado_em)}</span>
                      {' '}Admin alterou de{' '}
                      <span className="font-medium text-ink-soft">{nomeAnterior}</span>
                      {' '}para{' '}
                      <span className="font-medium text-ink-soft">{nomeNovo}</span>
                      {log.observacao && (
                        <span className="text-ink-mute"> — {log.observacao}</span>
                      )}
                    </p>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-line shrink-0">
          <button
            onClick={handleSalvar} disabled={salvando}
            className={[
              'w-full min-h-[48px] rounded-md text-sm font-semibold text-surface',
              'bg-brand-500 hover:bg-brand-600 active:scale-[0.98]',
              'transition-all duration-150 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {salvando ? 'Salvando…' : 'Salvar alteração'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Toggle ──────────────────────────────────────── */

function Toggle({ ativo, disabled, onChange }: { ativo: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={ativo}
      aria-label={ativo ? 'Desativar loja' : 'Ativar loja'}
      disabled={disabled} onClick={onChange}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        ativo ? 'bg-brand-500' : 'bg-line',
      ].join(' ')}
    >
      <span className={[
        'inline-block h-5 w-5 rounded-full bg-surface shadow-sm',
        'transition-transform duration-150 ease-out',
        ativo ? 'translate-x-[22px]' : 'translate-x-0.5',
      ].join(' ')} />
    </button>
  )
}

/* ── Card de loja ────────────────────────────────── */

function LojaItem({ loja, salvando, onToggle, onEditarPlano }: {
  loja: LojaView
  salvando: boolean
  onToggle: () => void
  onEditarPlano: () => void
}) {
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
        <div className="flex justify-between items-center gap-3">
          <span className="text-ink-soft shrink-0">Plano</span>
          <PlanoBadge assinatura={loja.assinatura} onClick={onEditarPlano} />
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
          target="_blank" rel="noopener noreferrer"
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
  const [autorizado, setAutorizado] = useState<boolean | undefined>(undefined)
  const [adminId,    setAdminId]    = useState('')

  const [lojas,        setLojas]        = useState<LojaView[] | undefined>(undefined)
  const [planos,       setPlanos]       = useState<PlanoInfo[]>([])
  const [kpis,         setKpis]         = useState<Kpis>({ totalLojas: 0, lojasAtivas: 0, totalPedidos: 0, faturamento: 0 })
  const [upgradesMes,  setUpgradesMes]  = useState(0)
  const [busca,        setBusca]        = useState('')
  const [filtro,       setFiltro]       = useState<FiltroPlano>('todos')
  const [atualizando,  setAtualizando]  = useState(false)
  const [salvandoId,   setSalvandoId]   = useState<string | null>(null)
  const [sheetLoja,    setSheetLoja]    = useState<LojaView | null>(null)

  async function carregarDados() {
    // Lojas
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

    // Planos
    const { data: planosData } = await supabase
      .from('planos')
      .select('id, nome, preco_mensal')
      .order('preco_mensal')
    const planosList = (planosData as PlanoInfo[]) ?? []
    setPlanos(planosList)
    const planoNomePorId: Record<string, string> = {}
    for (const p of planosList) planoNomePorId[p.id] = p.nome

    // Assinaturas
    const lojaIds = rows.map(l => l.id)
    const assinaturaPorLoja: Record<string, AssinaturaInfo> = {}
    if (lojaIds.length > 0) {
      const { data: assData } = await supabase
        .from('assinaturas')
        .select('id, loja_id, plano_id, status, vence_em')
        .in('loja_id', lojaIds)
      for (const a of (assData as { id: string; loja_id: string; plano_id: string; status: AssinaturaInfo['status']; vence_em: string | null }[] | null) ?? []) {
        assinaturaPorLoja[a.loja_id] = {
          id:         a.id,
          plano_id:   a.plano_id,
          plano_nome: planoNomePorId[a.plano_id] ?? a.plano_id,
          status:     a.status,
          vence_em:   a.vence_em,
        }
      }
    }

    // Pedidos
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

    // Upgrades este mês — verdadeiro upgrade = plano_novo tem preco_mensal > plano_anterior
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const planoPrecoPorId: Record<string, number> = {}
    for (const p of planosList) planoPrecoPorId[p.id] = p.preco_mensal

    const { data: logsUpgrade } = await supabase
      .from('assinatura_logs')
      .select('plano_anterior, plano_novo')
      .gte('criado_em', inicioMes.toISOString())

    const upgrades = (logsUpgrade ?? []).filter(log => {
      const precoAnterior = planoPrecoPorId[log.plano_anterior ?? ''] ?? 0
      const precoNovo     = planoPrecoPorId[log.plano_novo]     ?? 0
      return precoNovo > precoAnterior
    }).length
    setUpgradesMes(upgrades)

    // Montar view
    const view: LojaView[] = rows.map(l => ({
      ...l,
      dono:       donoPorId[l.dono_id] ?? null,
      pedidos:    pedidosPorLoja[l.id] ?? 0,
      assinatura: assinaturaPorLoja[l.id] ?? null,
    }))

    setLojas(view)
    setKpis({
      totalLojas:   rows.length,
      lojasAtivas:  rows.filter(l => l.ativo).length,
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

      setAdminId(user.id)
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

    if (error) { toast.error('Não foi possível atualizar a loja.'); return }

    setLojas(prev => prev?.map(l => l.id === loja.id ? { ...l, ativo: novoAtivo } : l))
    setKpis(prev => ({ ...prev, lojasAtivas: prev.lojasAtivas + (novoAtivo ? 1 : -1) }))
    toast.success(novoAtivo ? 'Loja ativada' : 'Loja desativada')
  }

  function handleAssinaturaSalva(lojaId: string, novaAss: AssinaturaInfo) {
    setLojas(prev => prev?.map(l => l.id === lojaId ? { ...l, assinatura: novaAss } : l))
    setSheetLoja(prev => prev?.id === lojaId ? { ...prev, assinatura: novaAss } : prev)
  }

  /* Filtro */
  const termo = busca.trim()
  const filtradas = useMemo(() => {
    if (!lojas) return []
    let lista = lojas

    if (filtro !== 'todos') {
      lista = lista.filter(l => {
        if (filtro === 'vencidos') return l.assinatura?.status === 'vencida'
        const nome = normalizar(l.assinatura?.plano_nome ?? '')
        if (filtro === 'gratis')      return nome.includes('grat') || !l.assinatura
        if (filtro === 'crescimento') return nome.includes('crescimento')
        if (filtro === 'bairro_plus') return nome.includes('bairro')
        return true
      })
    }

    if (termo) {
      const alvo = normalizar(termo)
      lista = lista.filter(l => normalizar(l.nome).includes(alvo))
    }

    return lista
  }, [lojas, termo, filtro])

  if (autorizado === undefined) return null

  const kpiCards = [
    { label: 'Lojas',        valor: String(kpis.totalLojas) },
    { label: 'Lojas ativas', valor: String(kpis.lojasAtivas) },
    { label: 'Pedidos',      valor: String(kpis.totalPedidos) },
    { label: 'Faturamento',  valor: formatarReal(kpis.faturamento) },
  ]

  const filtroOpcoes: { id: FiltroPlano; label: string }[] = [
    { id: 'todos',       label: 'Todos' },
    { id: 'gratis',      label: 'Grátis' },
    { id: 'crescimento', label: 'Crescimento' },
    { id: 'bairro_plus', label: 'Bairro+' },
    { id: 'vencidos',    label: 'Vencidos' },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <TopBar
        width="wide"
        left={<span className="inline-flex items-center gap-2 text-brand-600"><ShieldCheck size={20} strokeWidth={1.75} /></span>}
        title="Administração da plataforma"
        right={
          <IconButton onClick={handleAtualizar} aria-label="Atualizar" disabled={atualizando}>
            <RefreshCw size={20} strokeWidth={1.75} className={atualizando ? 'animate-spin' : ''} />
          </IconButton>
        }
      />

      <main className="py-8">
        <PageContainer size="wide" className="flex flex-col gap-8">

          {/* KPIs gerais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpiCards.map(c => (
              <Card key={c.label} bodyClassName="p-4">
                <p className="text-xs text-ink-soft leading-snug">{c.label}</p>
                <p className="text-xl font-bold text-ink mt-1 leading-tight">
                  {lojas === undefined ? '—' : c.valor}
                </p>
              </Card>
            ))}
          </div>

          {/* ── Saúde da plataforma ── */}
          <SaudeSection
            lojas={lojas}
            planos={planos}
            upgradesMes={upgradesMes}
            onRenovar={loja => setSheetLoja(loja)}
          />

          {/* ── Lojas ── */}
          <div className="flex flex-col gap-3">
            <SectionTitle count={filtradas.length}>Lojas</SectionTitle>

            {/* Chips de filtro */}
            <div className="flex flex-wrap gap-2">
              {filtroOpcoes.map(op => (
                <Chip key={op.id} selected={filtro === op.id} onClick={() => setFiltro(op.id)}>
                  {op.label}
                </Chip>
              ))}
            </div>

            {/* Busca */}
            <div className="relative">
              <Search size={18} strokeWidth={1.75} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
              <input
                type="search" inputMode="search"
                value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar loja pelo nome" aria-label="Buscar loja pelo nome"
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
                <p className="text-base font-semibold text-ink">
                  {termo ? `Nenhuma loja encontrada para "${termo}"` : 'Nenhuma loja neste filtro'}
                </p>
                <p className="text-sm text-ink-soft mt-1">
                  {termo ? 'Tente buscar por outro nome.' : 'Tente outro filtro.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {filtradas.map(loja => (
                  <LojaItem
                    key={loja.id}
                    loja={loja}
                    salvando={salvandoId === loja.id}
                    onToggle={() => handleToggle(loja)}
                    onEditarPlano={() => setSheetLoja(loja)}
                  />
                ))}
              </div>
            )}
          </div>

        </PageContainer>
      </main>

      {sheetLoja && (
        <AssinaturaSheet
          loja={sheetLoja}
          planos={planos}
          adminId={adminId}
          open={sheetLoja !== null}
          onClose={() => setSheetLoja(null)}
          onSalvo={novaAss => handleAssinaturaSalva(sheetLoja.id, novaAss)}
        />
      )}
    </div>
  )
}
