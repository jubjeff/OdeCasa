'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check, Copy, ShoppingBag, DollarSign, Receipt, Star, Lock, Settings, Eye, EyeOff,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageContainer } from '@/components/ui/PageContainer'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { StatusBadge, type OrderStatus } from '@/components/ui/StatusBadge'
import { StoreInfoCard, type Loja } from '@/components/account/StoreInfoCard'
import { toast } from 'sonner'

/* ── Tipos ─────────────────────────────────────────────── */

interface KpiDia {
  count: number
  total: number
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

/* ── Helpers ────────────────────────────────────────────── */

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

function calcVariacao(hoje: number, ontem: number): Variacao {
  if (ontem === 0 && hoje > 0) return { novo: true }
  if (ontem === 0) return null
  const pct = Math.round(((hoje - ontem) / ontem) * 100)
  return { novo: false, texto: pct >= 0 ? `↑ ${pct}%` : `↓ ${Math.abs(pct)}%`, positiva: pct >= 0 }
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

function KpiCards({ hoje, ontem, oculto }: { hoje: KpiDia; ontem: KpiDia; oculto: boolean }) {
  const ticketHoje   = hoje.count  > 0 ? hoje.total / hoje.count   : null
  const ticketOntem  = ontem.count > 0 ? ontem.total / ontem.count : null
  const mascarar = (v: string) => oculto ? '••••' : v

  const cards = [
    {
      label: 'Pedidos hoje',
      valor: mascarar(String(hoje.count)),
      icone: <ShoppingBag size={18} strokeWidth={1.75} className="text-brand-500" />,
      variacao: calcVariacao(hoje.count, ontem.count),
      atalho: '/painel/pedidos',
    },
    {
      label: 'Faturamento do dia',
      valor: mascarar(formatarReal(hoje.total)),
      icone: <DollarSign size={18} strokeWidth={1.75} className="text-brand-500" />,
      variacao: calcVariacao(hoje.total, ontem.total),
      atalho: '/painel/conta?tab=loja',
    },
    {
      label: 'Ticket médio',
      valor: mascarar(ticketHoje != null ? formatarReal(ticketHoje) : '—'),
      icone: <Receipt size={18} strokeWidth={1.75} className="text-brand-500" />,
      variacao: ticketHoje != null && ticketOntem != null
        ? calcVariacao(ticketHoje, ticketOntem)
        : ticketHoje != null && ontem.count === 0
          ? ({ novo: true }) as Variacao
          : null,
      atalho: null,
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
          <p className="text-2xl font-bold text-ink leading-tight">{c.valor}</p>
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

/* ── Top 5 produtos da semana ───────────────────────────── */

function TopProdutos({ produtos }: { produtos: TopProduto[] }) {
  if (produtos.length === 0) {
    return (
      <Card bodyClassName="p-4">
        <SectionTitle className="mb-3">Top 5 produtos da semana</SectionTitle>
        <p className="text-sm text-ink-mute py-4 text-center">Sem vendas nos últimos 7 dias.</p>
      </Card>
    )
  }

  return (
    <Card bodyClassName="p-4">
      <SectionTitle className="mb-3">Top 5 produtos da semana</SectionTitle>
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
    </Card>
  )
}

/* ── Página ─────────────────────────────────────────────── */

export default function Painel() {
  const router = useRouter()
  const [userId, setUserId]     = useState<string | null>(null)
  const [loja, setLoja]         = useState<Loja | null | undefined>(undefined)
  const [origin, setOrigin]     = useState('')

  // Onboarding
  const [temCategoria, setTemCategoria] = useState(false)
  const [temProduto, setTemProduto]     = useState(false)

  // Dashboard data
  const [kpiHoje, setKpiHoje]           = useState<KpiDia>({ count: 0, total: 0 })
  const [kpiOntem, setKpiOntem]         = useState<KpiDia>({ count: 0, total: 0 })
  const [valoresOcultos, setValoresOcultos] = useState(false)
  const [andamento, setAndamento]       = useState<PedidoAndamento[]>([])
  const [topProdutos, setTopProdutos]   = useState<TopProduto[]>([])
  const [avaliacoes, setAvaliacoes]     = useState<AvaliacaoRow[]>([])

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserId(user.id)

      const { data: lojaData } = await supabase
        .from('lojas')
        .select('*')
        .eq('dono_id', user.id)
        .maybeSingle()

      const lojaEncontrada = lojaData ? (lojaData as Loja) : null
      setLoja(lojaEncontrada)

      if (!lojaEncontrada) return

      const lojaId = lojaEncontrada.id

      // Datas de referência
      const hojeInicio = new Date()
      hojeInicio.setHours(0, 0, 0, 0)
      const ontemInicio = new Date(hojeInicio)
      ontemInicio.setDate(hojeInicio.getDate() - 1)
      const semanaAtras = new Date()
      semanaAtras.setDate(semanaAtras.getDate() - 7)

      // Carregar tudo em paralelo
      const [
        catCheck,
        prodCheck,
        pedidosHojeRes,
        pedidosOntemRes,
        andamentoRes,
        pedidos7dRes,
        avaliacoesRes,
      ] = await Promise.all([
        supabase.from('categorias').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
        supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
        supabase
          .from('pedidos')
          .select('id,total,status')
          .eq('loja_id', lojaId)
          .neq('status', 'cancelado')
          .gte('criado_em', hojeInicio.toISOString()),
        supabase
          .from('pedidos')
          .select('id,total,status')
          .eq('loja_id', lojaId)
          .neq('status', 'cancelado')
          .gte('criado_em', ontemInicio.toISOString())
          .lt('criado_em', hojeInicio.toISOString()),
        supabase
          .from('pedidos')
          .select('id,total,status,criado_em,nome_cliente')
          .eq('loja_id', lojaId)
          .in('status', ['recebido', 'preparando', 'saiu_entrega'])
          .order('criado_em', { ascending: false }),
        supabase
          .from('pedidos')
          .select('id')
          .eq('loja_id', lojaId)
          .neq('status', 'cancelado')
          .gte('criado_em', semanaAtras.toISOString()),
        supabase
          .from('avaliacoes')
          .select('id,nota,comentario,criado_em,profiles:cliente_id(nome)')
          .eq('loja_id', lojaId)
          .order('criado_em', { ascending: false })
          .limit(3),
      ])

      setTemCategoria((catCheck.count ?? 0) > 0)
      setTemProduto((prodCheck.count ?? 0) > 0)

      // KPIs de hoje
      const hoje = (pedidosHojeRes.data ?? []) as { total: number; status: string }[]
      setKpiHoje({
        count: hoje.length,
        total: hoje.reduce((s, p) => s + Number(p.total), 0),
      })

      // KPIs de ontem
      const ontem = (pedidosOntemRes.data ?? []) as { total: number; status: string }[]
      setKpiOntem({
        count: ontem.length,
        total: ontem.reduce((s, p) => s + Number(p.total), 0),
      })

      // Pedidos em andamento
      setAndamento((andamentoRes.data ?? []) as PedidoAndamento[])

      // Top 5 produtos da semana
      const ids7d = (pedidos7dRes.data ?? []).map((p: { id: string }) => p.id)
      if (ids7d.length > 0) {
        const { data: itens } = await supabase
          .from('itens_pedido')
          .select('nome_produto,quantidade')
          .in('pedido_id', ids7d)

        const mapa: Record<string, number> = {}
        for (const it of (itens as { nome_produto: string; quantidade: number }[] | null) ?? []) {
          mapa[it.nome_produto] = (mapa[it.nome_produto] ?? 0) + Number(it.quantidade)
        }
        setTopProdutos(
          Object.entries(mapa)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([nome, qtd]) => ({ nome, qtd })),
        )
      }

      // Avaliações
      setAvaliacoes((avaliacoesRes.data ?? []) as AvaliacaoRow[])
    }

    init()
  }, [router])

  if (loja === undefined || !userId) return null

  const temLoja = loja !== null
  const onboardingCompleto = temLoja && temCategoria && temProduto

  return (
    <main className="py-8">
      <PageContainer size="reading" className="flex flex-col gap-6">

        {/* Onboarding: exibe checklist enquanto incompleto */}
        {!onboardingCompleto && (
          <PrimeirosPassos
            temLoja={temLoja}
            temCategoria={temCategoria}
            temProduto={temProduto}
          />
        )}

        {/* Formulário de criação quando não há loja ainda */}
        {!temLoja && (
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
              <h1 className="text-2xl font-bold text-ink leading-tight">Boas-vindas e boas-vendas, <span className="text-brand-500">{loja.nome}</span>!</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-ink-soft">Acompanhe seus pedidos e o desempenho da sua loja.</p>
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

            {/* KPIs */}
            <KpiCards hoje={kpiHoje} ontem={kpiOntem} oculto={valoresOcultos} />

            {/* Pedidos em andamento */}
            <PedidosAndamento pedidos={andamento} />

            {/* Top produtos + Avaliações lado a lado no desktop */}
            <div className="grid md:grid-cols-2 gap-4">
              <TopProdutos produtos={topProdutos} />
              <UltimasAvaliacoes avaliacoes={avaliacoes} />
            </div>
          </>
        )}

      </PageContainer>
    </main>
  )
}
