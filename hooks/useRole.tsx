'use client'

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/* ── Tipos ────────────────────────────────────────── */

export type Papel = 'dono' | 'gerente' | 'atendente' | 'caixa'

const HIERARQUIA: Record<Papel, number> = {
  dono: 4, gerente: 3, atendente: 2, caixa: 1,
}

interface RoleContextValue {
  papel: Papel | null
  lojaId: string | null
  isLoading: boolean
  hasRole: (min: Papel) => boolean
}

/* ── Context ──────────────────────────────────────── */

const RoleContext = createContext<RoleContextValue | null>(null)

/* ── Provider ─────────────────────────────────────── */

export function RoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [papel, setPapel]     = useState<Papel | null>(null)
  const [lojaId, setLojaId]   = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 1. Tentar como dono
      const { data: lojaData } = await supabase
        .from('lojas')
        .select('id')
        .eq('dono_id', user.id)
        .maybeSingle()

      let resolvedLojaId: string | null = lojaData?.id ?? null

      // 2. Tentar como operador ativo
      if (!resolvedLojaId) {
        const { data: opData } = await supabase
          .from('operadores')
          .select('loja_id')
          .eq('user_id', user.id)
          .eq('status', 'ativo')
          .maybeSingle()
        resolvedLojaId = (opData as { loja_id: string } | null)?.loja_id ?? null
      }

      // Dono recém-cadastrado ainda não tem loja — permite entrar no painel
      // para criar a primeira loja (a página trata papel/lojaId nulos)
      if (!resolvedLojaId) {
        if (ativo) setIsLoading(false)
        return
      }

      const { data: papelData } = await supabase.rpc('meu_papel_na_loja', {
        p_loja_id: resolvedLojaId,
      })

      if (!ativo) return

      if (!papelData) { router.push('/login'); return }

      setLojaId(resolvedLojaId)
      setPapel(papelData as Papel)
      setIsLoading(false)
    }
    carregar()
    return () => { ativo = false }
  }, [router])

  function hasRole(min: Papel): boolean {
    if (!papel) return false
    return HIERARQUIA[papel] >= HIERARQUIA[min]
  }

  return (
    <RoleContext.Provider value={{ papel, lojaId, isLoading, hasRole }}>
      {children}
    </RoleContext.Provider>
  )
}

/* ── Hook ─────────────────────────────────────────── */

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole deve ser usado dentro de RoleProvider')
  return ctx
}
