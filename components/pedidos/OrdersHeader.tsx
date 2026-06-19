'use client'

import { Plus, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { formatPrice } from '@/lib/pedidos/format'

type FiltroData   = 'hoje' | 'ontem' | '7dias'
type FiltroOrigem = 'todos' | 'delivery' | 'manual'

interface KPIs {
  total: number
  faturamento: number
  ticketMedio: number
}

interface OrdersHeaderProps {
  filtroData: FiltroData
  filtroOrigem: FiltroOrigem
  verCancelados: boolean
  kpis: KPIs
  countDelivery: number
  countManual: number
  countCancelados: number
  somAtivo: boolean
  atualizando: boolean
  podeNovoManual: boolean
  onFiltroData: (v: FiltroData) => void
  onFiltroOrigem: (v: FiltroOrigem) => void
  onVerCancelados: (v: boolean) => void
  onAtivarSom: () => void
  onAtualizar: () => void
  onNovoManual: () => void
}

const OPCOES_DATA: { value: FiltroData; label: string }[] = [
  { value: 'hoje',  label: 'Hoje'           },
  { value: 'ontem', label: 'Ontem'          },
  { value: '7dias', label: 'Últimos 7 dias' },
]

export function OrdersHeader({
  filtroData,
  filtroOrigem,
  verCancelados,
  kpis,
  countDelivery,
  countManual,
  countCancelados,
  somAtivo,
  atualizando,
  podeNovoManual,
  onFiltroData,
  onFiltroOrigem,
  onVerCancelados,
  onAtivarSom,
  onAtualizar,
  onNovoManual,
}: OrdersHeaderProps) {
  const total = kpis.total

  return (
    <div className="px-4 py-3 border-b border-line bg-surface space-y-3">

      {/* Linha principal */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Título */}
        <h1 className="text-2xl font-bold text-ink shrink-0">Pedidos</h1>

        {/* Select de período */}
        <select
          value={filtroData}
          onChange={e => onFiltroData(e.target.value as FiltroData)}
          className="h-9 rounded-md border border-line bg-surface text-sm text-ink px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4QTkxOEEiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0ibTYgOSA2IDYgNi02Ii8+PC9zdmc+')] bg-no-repeat bg-[right_8px_center]"
          aria-label="Período"
        >
          {OPCOES_DATA.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Tabs de tipo + Cancelados */}
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          {/* Filtros de origem — ficam ativos mesmo na vista cancelados */}
          <Chip
            selected={filtroOrigem === 'todos' && !verCancelados}
            onClick={() => { onFiltroOrigem('todos'); onVerCancelados(false) }}
            className="text-xs !px-3 !h-8"
          >
            Todos{total > 0 && !verCancelados ? ` (${total})` : ''}
          </Chip>
          <Chip
            selected={filtroOrigem === 'delivery' && !verCancelados}
            onClick={() => { onFiltroOrigem('delivery'); onVerCancelados(false) }}
            className="text-xs !px-3 !h-8"
          >
            Delivery{countDelivery > 0 && !verCancelados ? ` (${countDelivery})` : ''}
          </Chip>
          <Chip
            selected={filtroOrigem === 'manual' && !verCancelados}
            onClick={() => { onFiltroOrigem('manual'); onVerCancelados(false) }}
            className="text-xs !px-3 !h-8"
          >
            Balcão{countManual > 0 && !verCancelados ? ` (${countManual})` : ''}
          </Chip>

          {/* Separador */}
          <span className="w-px h-5 bg-line mx-1 shrink-0" aria-hidden="true" />

          {/* Tab Cancelados */}
          <button
            type="button"
            onClick={() => onVerCancelados(!verCancelados)}
            className={[
              'shrink-0 px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger',
              verCancelados
                ? 'bg-danger/15 text-danger'
                : 'bg-surface border border-line text-ink-mute hover:bg-danger/5 hover:text-danger hover:border-danger/30',
            ].join(' ')}
          >
            Cancelados{countCancelados > 0 ? ` (${countCancelados})` : ''}
          </button>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 shrink-0">
          {somAtivo ? (
            <div
              role="button"
              aria-label="Som ativo"
              onClick={onAtivarSom}
              className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer hover:bg-brand-50 transition-colors duration-150"
            >
              <Volume2 size={18} strokeWidth={1.75} className="text-brand-500" />
            </div>
          ) : (
            <IconButton onClick={onAtivarSom} aria-label="Ativar som de pedidos">
              <VolumeX size={18} strokeWidth={1.75} className="text-ink-mute" />
            </IconButton>
          )}
          <IconButton onClick={onAtualizar} disabled={atualizando} aria-label="Atualizar pedidos">
            <RefreshCw
              size={18}
              strokeWidth={1.75}
              className={`text-ink ${atualizando ? 'animate-spin' : ''}`}
            />
          </IconButton>
          {podeNovoManual && (
            <Button onClick={onNovoManual} className="!min-h-[36px] text-sm px-3 gap-1.5 shrink-0">
              <Plus size={15} strokeWidth={2} />
              Novo pedido
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {!verCancelados ? (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-ink-mute">
            <span className="font-semibold text-ink">{kpis.total}</span>
            {' '}{kpis.total === 1 ? 'pedido' : 'pedidos'}
          </span>
          <span className="text-line select-none">·</span>
          <span className="text-ink-mute">{formatPrice(kpis.faturamento)}</span>
          {kpis.total > 0 && (
            <>
              <span className="text-line select-none">·</span>
              <span className="text-ink-mute">
                Ticket médio <span className="font-semibold text-ink">{formatPrice(kpis.ticketMedio)}</span>
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-danger font-semibold">{countCancelados}</span>
          <span className="text-ink-mute">{countCancelados === 1 ? 'pedido cancelado' : 'pedidos cancelados'} neste período</span>
        </div>
      )}
    </div>
  )
}
