'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'

/* ── Tipos ──────────────────────────────────────────────── */

interface PlanoFeatures {
  pedidos_ilimitados: boolean
  relatorios: boolean
  multiplos_operadores: boolean
  suporte_prioritario: boolean
  [key: string]: boolean
}

interface Plano {
  id: string
  nome: string
  preco_mensal: number
  limite_pedidos_mes: number | null
  features: PlanoFeatures
}

interface Assinatura {
  status: 'trial' | 'ativa' | 'vencida' | 'cancelada'
  vence_em: string | null
}

interface UsoMes {
  count: number
  limite: number | null
  percentual: number
}

interface PlanContextValue {
  plano: Plano
  assinatura: Assinatura
  usoMes: UsoMes
  isLoading: boolean
  hasFeature: (key: string) => boolean
  isLimitReached: () => boolean
  isNearLimit: () => boolean
  refetch: () => void
}

/* ── Fallback (plano grátis sem assinatura) ─────────────── */

const PLANO_GRATIS_DEFAULT: Plano = {
  id: 'gratis',
  nome: 'Grátis',
  preco_mensal: 0,
  limite_pedidos_mes: 30,
  features: {
    pedidos_ilimitados: false,
    relatorios: false,
    multiplos_operadores: false,
    suporte_prioritario: false,
  },
}

const ASSINATURA_DEFAULT: Assinatura = {
  status: 'ativa',
  vence_em: null,
}

function buildUsoMes(count: number, limite: number | null): UsoMes {
  const percentual =
    limite != null && limite > 0 ? Math.min(100, Math.round((count / limite) * 100)) : 0
  return { count, limite, percentual }
}

/* ── Context ────────────────────────────────────────────── */

const PlanContext = createContext<PlanContextValue | null>(null)

/* ── Provider ───────────────────────────────────────────── */

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plano, setPlano]           = useState<Plano>(PLANO_GRATIS_DEFAULT)
  const [assinatura, setAssinatura] = useState<Assinatura>(ASSINATURA_DEFAULT)
  const [usoMes, setUsoMes]         = useState<UsoMes>(buildUsoMes(0, 30))
  const [isLoading, setIsLoading]   = useState(true)
  const [tick, setTick]             = useState(0)

  // Força nova busca — chamar após criar loja ou mudar de plano
  function refetch() { setTick(t => t + 1) }

  useEffect(() => {
    let ativo = true
    setIsLoading(true)

    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!ativo || !user) { setIsLoading(false); return }

      const { data: loja } = await supabase
        .from('lojas')
        .select('id')
        .eq('dono_id', user.id)
        .maybeSingle()

      if (!ativo) return

      // Fallback para gerentes: busca via tabela operadores
      let lojaId = loja?.id ?? null
      if (!lojaId) {
        const { data: op } = await supabase
          .from('operadores')
          .select('loja_id')
          .eq('user_id', user.id)
          .eq('status', 'ativo')
          .maybeSingle()
        lojaId = (op as { loja_id: string } | null)?.loja_id ?? null
      }

      if (!ativo) return
      if (!lojaId) { setIsLoading(false); return }

      // Primeiro dia do mês corrente (formato YYYY-MM-DD)
      const agora = new Date()
      const primeiroDiaMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`

      // obter_plano_loja é security definer — funciona para dono E operadores.
      // Consulta direta a assinaturas seria bloqueada pelo RLS para operadores.
      const [planoRes, usoRes] = await Promise.all([
        supabase.rpc('obter_plano_loja', { p_loja_id: lojaId }),
        supabase
          .from('uso_mensal')
          .select('pedidos_count')
          .eq('loja_id', lojaId)
          .eq('mes', primeiroDiaMes)
          .maybeSingle(),
      ])

      if (!ativo) return

      const dadosPlano = planoRes.data as {
        assinatura_status: 'trial' | 'ativa' | 'vencida' | 'cancelada'
        vence_em: string | null
        plano_id: string
        plano_nome: string
        preco_mensal: number
        limite_pedidos_mes: number | null
        features: PlanoFeatures
      } | null

      if (dadosPlano) {
        const planoData: Plano = {
          id: dadosPlano.plano_id,
          nome: dadosPlano.plano_nome,
          preco_mensal: dadosPlano.preco_mensal,
          limite_pedidos_mes: dadosPlano.limite_pedidos_mes,
          features: dadosPlano.features,
        }
        setPlano(planoData)
        setAssinatura({ status: dadosPlano.assinatura_status, vence_em: dadosPlano.vence_em ?? null })
        const count = usoRes.data?.pedidos_count ?? 0
        setUsoMes(buildUsoMes(count, planoData.limite_pedidos_mes))
      } else {
        // Sem assinatura cadastrada para esta loja: usar fallback grátis
        const count = usoRes.data?.pedidos_count ?? 0
        setUsoMes(buildUsoMes(count, PLANO_GRATIS_DEFAULT.limite_pedidos_mes))
      }

      setIsLoading(false)
    }

    carregar()
    return () => { ativo = false }
  }, [tick])

  function hasFeature(key: string): boolean {
    return plano.features[key] === true
  }

  function isLimitReached(): boolean {
    return usoMes.limite !== null && usoMes.count >= usoMes.limite
  }

  function isNearLimit(): boolean {
    return usoMes.limite !== null && usoMes.count >= usoMes.limite * 0.8
  }

  return (
    <PlanContext.Provider value={{ plano, assinatura, usoMes, isLoading, hasFeature, isLimitReached, isNearLimit, refetch }}>
      {children}
    </PlanContext.Provider>
  )
}

/* ── Hook público ───────────────────────────────────────── */

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan deve ser usado dentro de <PlanProvider>')
  return ctx
}
