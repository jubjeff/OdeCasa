'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, PackageCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { StatusBadge, type OrderStatus } from './StatusBadge'

/* ── Tipos e helpers ─────────────────────────────── */

interface Notif {
  id: string          // único: `${pedidoId}-${status}-${ts}`
  pedidoId: string
  loja: string
  status: OrderStatus
  ts: number
  lida: boolean
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  recebido: 'Recebido',
  preparando: 'Em preparo',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const MAX_NOTIFS = 30

function tempoRelativo(ts: number): string {
  const seg = Math.floor((Date.now() - ts) / 1000)
  if (seg < 60) return 'agora'
  const min = Math.floor(seg / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.floor(h / 24)} d`
}

function curto(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

/* ── Sininho de notificações do cliente ──────────── */

export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [aberto, setAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Último status conhecido por pedido + nome da loja (não disparam re-render)
  const statusMapRef = useRef<Record<string, OrderStatus>>({})
  const lojaNomeRef = useRef<Record<string, string>>({})

  const persistNotifs = useCallback((lista: Notif[]) => {
    if (!userId) return
    try { localStorage.setItem(`odecasa:notifs:${userId}`, JSON.stringify(lista)) } catch {}
  }, [userId])

  const persistStatus = useCallback(() => {
    if (!userId) return
    try { localStorage.setItem(`odecasa:status:${userId}`, JSON.stringify(statusMapRef.current)) } catch {}
  }, [userId])

  // Detecta mudanças de status numa lista de pedidos e gera notificações.
  // aoVivo = true dispara também um toast (mudança enquanto a página está aberta).
  const aplicar = useCallback((
    itens: { id: string; status: OrderStatus }[],
    aoVivo: boolean,
  ) => {
    const novas: Notif[] = []
    for (const it of itens) {
      const anterior = statusMapRef.current[it.id]
      if (anterior !== undefined && anterior !== it.status) {
        novas.push({
          id: `${it.id}-${it.status}-${Date.now()}`,
          pedidoId: it.id,
          loja: lojaNomeRef.current[it.id] ?? `Pedido #${curto(it.id)}`,
          status: it.status,
          ts: Date.now(),
          lida: false,
        })
      }
      statusMapRef.current[it.id] = it.status
    }
    persistStatus()

    if (novas.length === 0) return

    setNotifs(prev => {
      const atual = [...novas, ...prev].slice(0, MAX_NOTIFS)
      persistNotifs(atual)
      return atual
    })

    if (aoVivo) {
      for (const n of novas) {
        toast(n.loja, {
          description: STATUS_LABEL[n.status],
          icon: <Bell size={18} strokeWidth={1.75} />,
        })
      }
    }
  }, [persistNotifs, persistStatus])

  /* Sessão do cliente */
  useEffect(() => {
    let ativo = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (ativo) setUserId(user?.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => { ativo = false; sub.subscription.unsubscribe() }
  }, [])

  /* Carrega o histórico salvo e concilia com o estado atual dos pedidos */
  useEffect(() => {
    if (!userId) {
      setNotifs([])
      statusMapRef.current = {}
      lojaNomeRef.current = {}
      return
    }

    let persistedNotifs: Notif[] = []
    let persistedStatus: Record<string, OrderStatus> = {}
    try { persistedNotifs = JSON.parse(localStorage.getItem(`odecasa:notifs:${userId}`) || '[]') } catch {}
    try { persistedStatus = JSON.parse(localStorage.getItem(`odecasa:status:${userId}`) || '{}') } catch {}
    statusMapRef.current = persistedStatus
    setNotifs(persistedNotifs)

    let ativo = true
    ;(async () => {
      const { data } = await supabase
        .from('pedidos')
        .select('id,status,lojas(nome)')
        .eq('cliente_id', userId)
      if (!ativo || !data) return

      const itens = (data as Array<{ id: string; status: OrderStatus; lojas: { nome: string } | { nome: string }[] | null }>)
        .map(p => {
          const lj = Array.isArray(p.lojas) ? p.lojas[0] : p.lojas
          lojaNomeRef.current[p.id] = lj?.nome ?? `Pedido #${curto(p.id)}`
          return { id: p.id, status: p.status }
        })

      // Primeira vez (sem histórico salvo): só semeia, sem notificar.
      // Depois: detecta mudanças ocorridas enquanto estava fora (sem toast).
      const primeiraVez = Object.keys(persistedStatus).length === 0
      if (primeiraVez) {
        for (const it of itens) statusMapRef.current[it.id] = it.status
        persistStatus()
      } else {
        aplicar(itens, false)
      }
    })()

    return () => { ativo = false }
  }, [userId, aplicar, persistStatus])

  /* Tempo real + polling de reforço (a cada 20s) */
  useEffect(() => {
    if (!userId) return

    const canal = supabase
      .channel(`notif-pedidos-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `cliente_id=eq.${userId}` },
        payload => {
          const novo = payload.new as { id: string; status: OrderStatus }
          aplicar([{ id: novo.id, status: novo.status }], true)
        },
      )
      .subscribe()

    const intervalo = setInterval(async () => {
      const { data } = await supabase
        .from('pedidos')
        .select('id,status')
        .eq('cliente_id', userId)
      if (data) aplicar(data as { id: string; status: OrderStatus }[], true)
    }, 20000)

    return () => { supabase.removeChannel(canal); clearInterval(intervalo) }
  }, [userId, aplicar])

  /* Fecha o painel ao clicar fora */
  useEffect(() => {
    if (!aberto) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [aberto])

  function toggle() {
    setAberto(a => {
      const novo = !a
      // Ao abrir, marca tudo como lido
      if (novo) {
        setNotifs(prev => {
          const lidas = prev.map(n => (n.lida ? n : { ...n, lida: true }))
          persistNotifs(lidas)
          return lidas
        })
      }
      return novo
    })
  }

  if (!userId) return null

  const naoLidas = notifs.filter(n => !n.lida).length

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={toggle}
        aria-label={naoLidas > 0 ? `Notificações (${naoLidas} novas)` : 'Notificações'}
        aria-expanded={aberto}
        className="relative w-11 h-11 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Bell size={22} strokeWidth={1.75} className="text-ink" />
        {naoLidas > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-surface text-[10px] font-bold flex items-center justify-center">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface rounded-lg shadow-lg border border-line overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold text-ink">Notificações</p>
          </div>

          {notifs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <PackageCheck size={28} strokeWidth={1.25} className="text-ink-mute mx-auto mb-2" />
              <p className="text-sm text-ink-soft">Nenhuma novidade ainda.</p>
              <p className="text-xs text-ink-mute mt-1">Avisamos quando seu pedido mudar de status.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-line">
              {notifs.map(n => (
                <Link
                  key={n.id}
                  href="/conta"
                  onClick={() => setAberto(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-brand-50 transition-colors duration-150"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{n.loja}</p>
                    <p className="text-xs text-ink-mute mt-0.5">
                      Pedido #{curto(n.pedidoId)} · {tempoRelativo(n.ts)}
                    </p>
                  </div>
                  <StatusBadge status={n.status} />
                </Link>
              ))}
            </div>
          )}

          <Link
            href="/conta"
            onClick={() => setAberto(false)}
            className="block px-4 py-3 border-t border-line text-center text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors duration-150"
          >
            Ver meus pedidos
          </Link>
        </div>
      )}
    </div>
  )
}
