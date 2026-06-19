'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ExternalLink, Star, Copy, Check, Eye, EyeOff, LogOut,
  KeyRound, Users, UserPlus, AlertCircle, CheckCircle, X, RefreshCw,
  ShieldOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { PageContainer } from '@/components/ui/PageContainer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StoreInfoCard, type Loja, type Horarios } from '@/components/account/StoreInfoCard'
import { DistanceDeliveryCard } from '@/components/account/DistanceDeliveryCard'
import { OpeningHoursCard } from '@/components/account/OpeningHoursCard'
import { PlanGate } from '@/components/PlanGate'
import { useRole } from '@/hooks/useRole'

/* ── Abas ───────────────────────────────────────────────── */

const TABS_BASE = [
  { id: 'perfil',     label: 'Perfil' },
  { id: 'loja',       label: 'Loja' },
  { id: 'entrega',    label: 'Entrega' },
  { id: 'horarios',   label: 'Horários' },
  { id: 'pagamentos', label: 'Pagamentos' },
  { id: 'avaliacoes', label: 'Avaliações' },
] as const

const TAB_OPERADORES = { id: 'operadores', label: 'Operadores' } as const

type TabId = typeof TABS_BASE[number]['id'] | 'operadores'

const ALL_TAB_IDS: TabId[] = [...TABS_BASE.map(t => t.id), 'operadores']

function isValidTab(v: string | null): v is TabId {
  return ALL_TAB_IDS.includes(v as TabId)
}

/* ── Badge aberta/fechada ───────────────────────────────── */

type StatusLoja =
  | { tipo: 'aberto'; fecha: string }
  | { tipo: 'fechado'; abre: string; dia: string | null }
  | null

function calcularStatus(horarios: Horarios | null): StatusLoja {
  if (!horarios) return null
  const CHAVES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  const NOMES  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const now = new Date()
  const diaIdx = now.getDay()
  const agora = now.getHours() * 60 + now.getMinutes()
  const toMin = (h: string) => {
    const [hh, mm] = h.split(':').map(Number)
    return hh * 60 + mm
  }

  const hoje = horarios[CHAVES[diaIdx]]
  if (hoje?.aberto) {
    const abre  = toMin(hoje.abre)
    const fecha = toMin(hoje.fecha)
    if (agora >= abre && agora < fecha) return { tipo: 'aberto', fecha: hoje.fecha }
    if (agora < abre) return { tipo: 'fechado', abre: hoje.abre, dia: null }
  }

  for (let i = 1; i <= 7; i++) {
    const idx = (diaIdx + i) % 7
    const d = horarios[CHAVES[idx]]
    if (d?.aberto) return { tipo: 'fechado', abre: d.abre, dia: NOMES[idx] }
  }
  return null
}

/* ── Helpers ────────────────────────────────────────────── */

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function mascararNome(profiles: { nome: string | null } | { nome: string | null }[] | null): string {
  const nome = Array.isArray(profiles) ? profiles[0]?.nome : profiles?.nome
  if (!nome?.trim()) return 'Cliente'
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[partes.length - 1][0]}.`
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  if (p.length === 1) return p[0][0].toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

/* ── Aba Perfil ─────────────────────────────────────────── */

interface ContaInfo { nome: string; email: string }

function TabPerfil({
  conta, userId, onSair,
}: { conta: ContaInfo; userId: string; onSair: () => void }) {
  const [nome, setNome]           = useState(conta.nome)
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)

  // Modal de senha
  const [showSenha, setShowSenha]   = useState(false)
  const [novaSenha, setNovaSenha]   = useState('')
  const [confirmSenha, setConfirmSenha] = useState('')
  const [mostraSenha, setMostraSenha]   = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  async function salvarPerfil() {
    if (!nome.trim()) return
    setSalvandoPerfil(true)
    const { error } = await supabase.auth.updateUser({ data: { nome: nome.trim() } })
    setSalvandoPerfil(false)
    if (error) toast.error('Erro ao salvar: ' + error.message)
    else toast.success('Nome atualizado')
  }

  async function alterarSenha() {
    if (novaSenha.length < 6) { toast.error('A nova senha deve ter no mínimo 6 caracteres.'); return }
    if (novaSenha !== confirmSenha) { toast.error('As senhas não coincidem. Verifique e tente novamente.'); return }
    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setSalvandoSenha(false)
    if (error) { toast.error('Não foi possível alterar a senha. Tente novamente.'); return }
    toast.success('Senha alterada com sucesso.')
    setShowSenha(false)
    setNovaSenha('')
    setConfirmSenha('')
  }

  return (
    <div className="flex flex-col gap-4">
      <Card bodyClassName="p-6">
        <h3 className="text-base font-semibold text-ink mb-4">Informações pessoais</h3>
        <div className="flex flex-col gap-4">
          <Input
            label="Nome"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Seu nome"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">E-mail</label>
            <div className="h-12 flex items-center px-4 rounded-md border border-line bg-bg text-sm text-ink-mute cursor-not-allowed">
              {conta.email}
            </div>
            <p className="text-xs text-ink-mute">O e-mail não pode ser alterado.</p>
          </div>
          <Button onClick={salvarPerfil} disabled={salvandoPerfil} className="w-full sm:w-auto">
            {salvandoPerfil ? 'Salvando...' : 'Salvar nome'}
          </Button>
        </div>
      </Card>

      <Card bodyClassName="p-6">
        <h3 className="text-base font-semibold text-ink mb-2">Segurança</h3>
        <p className="text-sm text-ink-soft mb-4">Altere sua senha de acesso ao painel.</p>
        <Button
          variant="secondary"
          onClick={() => setShowSenha(true)}
          className="gap-2"
        >
          <KeyRound size={16} strokeWidth={1.75} />
          Alterar senha
        </Button>
      </Card>

      <Card bodyClassName="p-6">
        <h3 className="text-base font-semibold text-ink mb-2">Sair da conta</h3>
        <p className="text-sm text-ink-soft mb-4 leading-relaxed">
          Você será desconectado e redirecionado para a tela de login.
        </p>
        <button
          onClick={onSair}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
        >
          <LogOut size={15} strokeWidth={1.75} />
          Sair da conta
        </button>
      </Card>

      {/* Modal alterar senha */}
      {showSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setShowSenha(false)}
            aria-hidden="true"
          />
          <div className="relative bg-surface rounded-xl shadow-lg p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="text-[18px] font-semibold text-ink">Alterar senha</h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Nova senha</label>
              <div className="relative">
                <input
                  type={mostraSenha ? 'text' : 'password'}
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="h-12 w-full rounded-md border border-line bg-surface px-4 pr-12 text-sm text-ink placeholder:text-ink-mute outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setMostraSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink transition-colors"
                  aria-label={mostraSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostraSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Input
              label="Confirmar nova senha"
              type={mostraSenha ? 'text' : 'password'}
              value={confirmSenha}
              onChange={e => setConfirmSenha(e.target.value)}
              placeholder="Repita a nova senha"
            />

            <div className="flex gap-3 pt-1">
              <Button
                variant="secondary"
                onClick={() => setShowSenha(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={alterarSenha}
                disabled={salvandoSenha}
                className="flex-1"
              >
                {salvandoSenha ? 'Salvando...' : 'Alterar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Aba Pagamentos ─────────────────────────────────────── */

function TabPagamentos({ loja }: { loja: Loja }) {
  const [pixAtivo, setPixAtivo]   = useState(loja.chave_pix != null)
  const [chavePix, setChavePix]   = useState(loja.chave_pix ?? '')
  const [copiado, setCopiado]     = useState(false)
  const [salvando, setSalvando]   = useState(false)

  async function salvar() {
    setSalvando(true)
    const { error } = await supabase
      .from('lojas')
      .update({ chave_pix: pixAtivo && chavePix.trim() ? chavePix.trim() : null })
      .eq('id', loja.id)
    setSalvando(false)
    if (error) toast.error('Erro ao salvar: ' + error.message)
    else toast.success('Configurações de pagamento salvas')
  }

  function copiarChave() {
    navigator.clipboard.writeText(chavePix)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const toggleClasses = (ativo: boolean, desabilitado = false) => [
    'relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
    ativo ? 'bg-brand-500' : 'bg-line',
    desabilitado ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
  ].join(' ')

  const thumbClasses = (ativo: boolean) => [
    'absolute top-0.5 left-0.5 w-5 h-5 bg-surface rounded-full shadow-sm transition-transform duration-200',
    ativo ? 'translate-x-5' : 'translate-x-0',
  ].join(' ')

  return (
    <div className="flex flex-col gap-4">
      <Card bodyClassName="p-6">
        <h3 className="text-base font-semibold text-ink mb-1">Formas de pagamento aceitas</h3>
        <p className="text-sm text-ink-soft mb-5 leading-relaxed">
          Configure quais formas de pagamento sua loja aceita na entrega.
        </p>

        <div className="flex flex-col gap-0 divide-y divide-line">
          {/* Dinheiro — sempre ativo */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-ink">Dinheiro</p>
              <p className="text-xs text-ink-mute mt-0.5">Pagamento em espécie na entrega</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-brand-700 bg-brand-100 rounded-full px-2.5 py-1">
                Sempre ativo
              </span>
            </div>
          </div>

          {/* Cartão — sempre ativo */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-ink">Cartão na entrega</p>
              <p className="text-xs text-ink-mute mt-0.5">Débito e crédito via maquininha</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-brand-700 bg-brand-100 rounded-full px-2.5 py-1">
                Sempre ativo
              </span>
            </div>
          </div>

          {/* Pix — configurável */}
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">Pix</p>
                <p className="text-xs text-ink-mute mt-0.5">Transferência instantânea</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pixAtivo}
                onClick={() => setPixAtivo(v => !v)}
                className={toggleClasses(pixAtivo)}
              >
                <span className={thumbClasses(pixAtivo)} />
              </button>
            </div>

            {pixAtivo && (
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm font-medium text-ink">Chave Pix</label>
                <div className="flex gap-2">
                  <input
                    value={chavePix}
                    onChange={e => setChavePix(e.target.value)}
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                    className="flex-1 h-12 rounded-md border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-mute outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  {chavePix && (
                    <button
                      type="button"
                      onClick={copiarChave}
                      title="Copiar chave"
                      className="w-12 h-12 flex items-center justify-center rounded-md border border-line bg-surface text-ink-soft hover:text-brand-700 hover:border-brand-300 transition-colors duration-150"
                    >
                      {copiado ? <Check size={16} strokeWidth={2.5} className="text-brand-600" /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-line mt-2">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar pagamentos'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

/* ── Aba Avaliações ─────────────────────────────────────── */

interface AvaliacaoItem {
  id: string
  nota: number
  comentario: string | null
  criado_em: string
  profiles: { nome: string | null } | { nome: string | null }[] | null
}

function Estrelas({ nota, tamanho = 14 }: { nota: number; tamanho?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={tamanho}
          strokeWidth={1.75}
          className={i < nota ? 'fill-accent text-accent' : 'text-line'}
        />
      ))}
    </div>
  )
}

function TabAvaliacoes({ loja, onIrParaLoja }: { loja: Loja; onIrParaLoja: () => void }) {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoItem[]>([])
  const [media, setMedia]           = useState(0)
  const [total, setTotal]           = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [offset, setOffset]         = useState(0)
  const [temMais, setTemMais]       = useState(false)
  const POR_PAGINA = 10

  useEffect(() => {
    async function carregar() {
      setCarregando(true)

      const [notasRes, listaRes] = await Promise.all([
        supabase.from('avaliacoes').select('nota').eq('loja_id', loja.id),
        supabase
          .from('avaliacoes')
          .select('id,nota,comentario,criado_em,profiles:cliente_id(nome)')
          .eq('loja_id', loja.id)
          .order('criado_em', { ascending: false })
          .range(0, POR_PAGINA),
      ])

      const notas = (notasRes.data ?? []) as { nota: number }[]
      setTotal(notas.length)
      setMedia(notas.length > 0 ? notas.reduce((s, r) => s + r.nota, 0) / notas.length : 0)

      const lista = (listaRes.data ?? []) as AvaliacaoItem[]
      setAvaliacoes(lista)
      setTemMais(lista.length === POR_PAGINA + 1)
      setAvaliacoes(lista.slice(0, POR_PAGINA))
      setOffset(POR_PAGINA)
      setCarregando(false)
    }
    carregar()
  }, [loja.id])

  async function verMais() {
    const { data } = await supabase
      .from('avaliacoes')
      .select('id,nota,comentario,criado_em,profiles:cliente_id(nome)')
      .eq('loja_id', loja.id)
      .order('criado_em', { ascending: false })
      .range(offset, offset + POR_PAGINA)

    const nova = (data ?? []) as AvaliacaoItem[]
    setAvaliacoes(prev => [...prev, ...nova.slice(0, POR_PAGINA)])
    setTemMais(nova.length === POR_PAGINA + 1)
    setOffset(prev => prev + POR_PAGINA)
  }

  if (!loja.avaliacoes_ativas) {
    return (
      <Card bodyClassName="p-6">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Star size={32} strokeWidth={1.25} className="text-line" />
          <p className="text-sm text-ink-soft leading-relaxed">
            Avaliações desativadas — ative em{' '}
            <button
              onClick={onIrParaLoja}
              className="font-medium text-brand-600 hover:text-brand-700 underline transition-colors"
            >
              Configurações da loja
            </button>
            .
          </p>
        </div>
      </Card>
    )
  }

  if (carregando) {
    return (
      <Card bodyClassName="p-6">
        <p className="text-sm text-ink-mute text-center py-4">Carregando avaliações…</p>
      </Card>
    )
  }

  if (total === 0) {
    return (
      <Card bodyClassName="p-6">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Star size={32} strokeWidth={1.25} className="text-line" />
          <p className="text-sm text-ink-soft">Nenhuma avaliação ainda.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo */}
      <Card bodyClassName="p-6">
        <div className="flex items-center gap-5">
          <div className="text-center">
            <p className="text-4xl font-bold text-ink leading-none">{media.toFixed(1)}</p>
            <Estrelas nota={Math.round(media)} tamanho={18} />
            <p className="text-xs text-ink-mute mt-1">{total} avaliação{total !== 1 ? 'ões' : ''}</p>
          </div>
        </div>
      </Card>

      {/* Lista */}
      <Card bodyClassName="p-4">
        <div className="flex flex-col divide-y divide-line">
          {avaliacoes.map(av => (
            <div key={av.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <Estrelas nota={av.nota} />
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-ink-mute">{mascararNome(av.profiles)}</span>
                  <span className="text-xs text-ink-mute">{formatarData(av.criado_em)}</span>
                </div>
              </div>
              {av.comentario && (
                <p className="text-sm text-ink-soft leading-relaxed">{av.comentario}</p>
              )}
            </div>
          ))}
        </div>

        {temMais && (
          <div className="pt-4 border-t border-line mt-2">
            <Button variant="secondary" className="w-full" onClick={verMais}>
              Ver mais
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── Tab Operadores ─────────────────────────────────────── */

interface Operador {
  id: string
  email: string
  papel: 'gerente' | 'atendente' | 'caixa'
  status: 'pendente' | 'ativo' | 'inativo'
  invite_token: string | null
  invite_expires_at: string | null
  user_id: string | null
  criado_em: string
}

const PAPEL_LABEL: Record<string, string> = {
  gerente: 'Gerente', atendente: 'Atendente', caixa: 'Operador de caixa',
}

const PAPEL_STYLE: Record<string, { bg: string; text: string }> = {
  gerente:   { bg: 'var(--color-papel-gerente-bg)',   text: 'var(--color-papel-gerente-text)' },
  atendente: { bg: 'var(--color-papel-atendente-bg)', text: 'var(--color-papel-atendente-text)' },
  caixa:     { bg: 'var(--color-papel-caixa-bg)',     text: 'var(--color-papel-caixa-text)' },
}

function BadgePapel({ papel }: { papel: string }) {
  const s = PAPEL_STYLE[papel] ?? PAPEL_STYLE.caixa
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {PAPEL_LABEL[papel] ?? papel}
    </span>
  )
}

function BadgeStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativo:    'bg-brand-100 text-brand-700',
    pendente: 'bg-accent/15 text-accent',
    inativo:  'bg-line text-ink-mute',
  }
  const label: Record<string, string> = {
    ativo: 'Ativo', pendente: 'Pendente', inativo: 'Inativo',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? map.inativo}`}>
      {label[status] ?? status}
    </span>
  )
}

function TabOperadores({ lojaId, donoId }: { lojaId: string; donoId: string }) {
  const [operadores, setOperadores]   = useState<Operador[]>([])
  const [carregando, setCarregando]   = useState(true)
  const [modalConvite, setModalConvite] = useState(false)
  const [formEmail, setFormEmail]     = useState('')
  const [formPapel, setFormPapel]     = useState<'gerente' | 'atendente' | 'caixa'>('atendente')
  const [gerando, setGerando]         = useState(false)
  const [erroConvite, setErroConvite] = useState<string | null>(null)
  const [linkGerado, setLinkGerado]   = useState<string | null>(null)
  const [copiado, setCopiado]         = useState(false)
  const [modoReenvio, setModoReenvio] = useState(false)
  const [revogarId, setRevogarId]     = useState<string | null>(null)

  async function carregar() {
    const { data } = await supabase
      .from('operadores')
      .select('id, email, papel, status, invite_token, invite_expires_at, user_id, criado_em')
      .eq('loja_id', lojaId)
      .order('criado_em', { ascending: true })
    setOperadores((data as Operador[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [lojaId])

  function resetConvite() {
    setFormEmail('')
    setFormPapel('atendente')
    setLinkGerado(null)
    setErroConvite(null)
    setCopiado(false)
    setModoReenvio(false)
  }

  function fecharModal() { setModalConvite(false); resetConvite() }

  async function gerarLink(email: string, papel: string, opExistente?: string): Promise<string | null> {
    const token = crypto.randomUUID().replace(/-/g, '')
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    if (opExistente) {
      const { error } = await supabase
        .from('operadores')
        .update({ invite_token: token, invite_expires_at: expires, papel })
        .eq('id', opExistente)
      if (error) return null
    } else {
      const { error } = await supabase.from('operadores').insert({
        loja_id: lojaId, email, papel,
        status: 'pendente', convidado_por: donoId,
        invite_token: token, invite_expires_at: expires,
      })
      if (error) return null
    }
    return `${window.location.origin}/convite/${token}`
  }

  async function handleGerar() {
    const email = formEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) { setErroConvite('Informe um endereço de e-mail válido.'); return }
    setGerando(true)
    setErroConvite(null)

    const { data: existente } = await supabase
      .from('operadores')
      .select('id, status')
      .eq('loja_id', lojaId)
      .eq('email', email)
      .maybeSingle()

    if (existente) {
      const op = existente as { id: string; status: string }
      if (op.status === 'ativo') {
        setErroConvite('Este e-mail já faz parte da equipe desta loja.')
        setGerando(false)
        return
      }
      setModoReenvio(true)
      setGerando(false)
      return
    }

    const url = await gerarLink(email, formPapel)
    if (!url) { setErroConvite('Não foi possível gerar o convite. Tente novamente.'); setGerando(false); return }
    setLinkGerado(url)
    await carregar()
    setGerando(false)
  }

  async function handleReenviar() {
    const email = formEmail.trim().toLowerCase()
    setGerando(true)
    const { data: op } = await supabase
      .from('operadores').select('id').eq('loja_id', lojaId).eq('email', email).maybeSingle()
    const url = await gerarLink(email, formPapel, (op as { id: string } | null)?.id)
    if (!url) { setErroConvite('Não foi possível reenviar o convite. Tente novamente.'); setGerando(false); return }
    setLinkGerado(url)
    setModoReenvio(false)
    await carregar()
    setGerando(false)
  }

  async function copiarLinkNovamente(op: Operador) {
    const url = await gerarLink(op.email, op.papel, op.id)
    if (!url) { toast.error('Não foi possível gerar um novo link. Tente novamente.'); return }
    navigator.clipboard.writeText(url)
    toast.success('Novo link copiado! Expira em 48h.')
    await carregar()
  }

  async function revogarAcesso() {
    if (!revogarId) return
    const { error } = await supabase
      .from('operadores').update({ status: 'inativo' }).eq('id', revogarId)
    setRevogarId(null)
    if (error) { toast.error('Não foi possível revogar o acesso. Tente novamente.'); return }
    toast.success('Acesso revogado com sucesso.')
    await carregar()
  }

  function copiarLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <>
      <PlanGate
        feature="multiplos_operadores"
        fallback="Múltiplos operadores requerem um plano superior"
      >
        <div className="flex flex-col gap-4">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink">Equipe da loja</h3>
              <p className="text-xs text-ink-mute mt-0.5">Convide colaboradores e defina o nível de acesso deles.</p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 shrink-0"
              onClick={() => setModalConvite(true)}
            >
              <UserPlus size={15} strokeWidth={2} />
              Convidar
            </Button>
          </div>

          {/* Lista */}
          {carregando ? (
            <Card bodyClassName="p-4">
              <div className="flex flex-col gap-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-line shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-40 rounded bg-line" />
                      <div className="h-3 w-24 rounded bg-line" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : operadores.length === 0 ? (
            <Card bodyClassName="p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
                  <Users size={28} strokeWidth={1.25} className="text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">Nenhum operador cadastrado</p>
                  <p className="text-xs text-ink-mute mt-1 leading-relaxed">
                    Convide sua equipe para ajudar a gerenciar pedidos, produtos e categorias.
                  </p>
                </div>
                <Button onClick={() => setModalConvite(true)} className="gap-2">
                  <UserPlus size={15} strokeWidth={2} />
                  Convidar o primeiro operador
                </Button>
              </div>
            </Card>
          ) : (
            <Card bodyClassName="p-0">
              <div className="divide-y divide-line">
                {operadores.map(op => (
                  <div key={op.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar */}
                    <div className={[
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                      op.status === 'ativo' ? 'bg-brand-500' : 'bg-line',
                    ].join(' ')}>
                      <span className={`text-sm font-bold ${op.status === 'ativo' ? 'text-surface' : 'text-ink-mute'}`}>
                        {op.email.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{op.email}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <BadgePapel papel={op.papel} />
                        <BadgeStatus status={op.status} />
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {op.status === 'pendente' && (
                        <button
                          onClick={() => copiarLinkNovamente(op)}
                          title="Copiar novo link de convite"
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-line bg-surface text-xs font-medium text-ink-soft hover:text-brand-700 hover:border-brand-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          <RefreshCw size={12} strokeWidth={1.75} />
                          Novo link
                        </button>
                      )}
                      {op.status === 'ativo' && (
                        <button
                          onClick={() => setRevogarId(op.id)}
                          title="Revogar acesso"
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-line bg-surface text-xs font-medium text-ink-soft hover:text-danger hover:border-danger/40 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                        >
                          <ShieldOff size={12} strokeWidth={1.75} />
                          Revogar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </PlanGate>

      {/* Modal convidar */}
      {modalConvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/40"
          onClick={fecharModal}
        >
          <div
            className="animate-modal-in bg-surface rounded-xl shadow-lg w-full max-w-sm p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={18} strokeWidth={1.75} className="text-brand-500" />
                <h2 className="text-base font-semibold text-ink">Convidar operador</h2>
              </div>
              <button onClick={fecharModal} aria-label="Fechar"
                className="w-8 h-8 flex items-center justify-center rounded-full text-ink-mute hover:bg-brand-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {modoReenvio ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 bg-accent/10 border border-accent/30 rounded-lg px-3 py-3">
                  <AlertCircle size={16} strokeWidth={1.75} className="text-accent shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-soft leading-snug">
                    Este e-mail já tem um convite pendente. Deseja gerar um novo link?
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setModoReenvio(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={handleReenviar} disabled={gerando}>
                    {gerando ? 'Gerando…' : 'Reenviar'}
                  </Button>
                </div>
              </div>
            ) : linkGerado ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 bg-brand-50 border border-brand-200 rounded-lg px-3 py-3">
                  <CheckCircle size={16} strokeWidth={1.75} className="text-brand-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-brand-700 font-medium leading-snug">Convite gerado!</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-mute">Link de convite</label>
                  <div className="flex gap-2">
                    <input
                      readOnly value={linkGerado}
                      className="flex-1 h-10 px-3 rounded-md border border-line bg-bg text-xs text-ink-soft font-mono outline-none truncate"
                    />
                    <button
                      onClick={() => copiarLink(linkGerado)}
                      className="shrink-0 h-10 px-3 rounded-md border border-line bg-surface text-xs font-medium text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 flex items-center gap-1.5"
                    >
                      {copiado
                        ? <><Check size={13} strokeWidth={2.5} />Copiado</>
                        : <><Copy size={13} strokeWidth={1.75} />Copiar</>}
                    </button>
                  </div>
                  <p className="text-xs text-ink-mute">Envie para {formEmail}. Expira em 48h.</p>
                </div>
                <Button variant="secondary" className="w-full" onClick={fecharModal}>Fechar</Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  <Input
                    id="op-email" label="E-mail do operador" type="email"
                    placeholder="nome@email.com" value={formEmail}
                    onChange={e => { setFormEmail(e.target.value); setErroConvite(null) }}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="op-papel" className="text-sm font-medium text-ink-soft">Papel</label>
                    <select
                      id="op-papel" value={formPapel}
                      onChange={e => setFormPapel(e.target.value as 'gerente' | 'atendente' | 'caixa')}
                      className="h-12 px-3 rounded-md border border-line bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                    >
                      <option value="gerente">Gerente — painel completo</option>
                      <option value="atendente">Atendente — produtos e pedidos</option>
                      <option value="caixa">Operador de caixa — somente pedidos</option>
                    </select>
                  </div>
                  {erroConvite && <p className="text-xs text-danger">{erroConvite}</p>}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="secondary" className="flex-1" onClick={fecharModal}>Cancelar</Button>
                  <Button className="flex-1" onClick={handleGerar} disabled={gerando}>
                    {gerando ? 'Gerando…' : 'Gerar link de convite'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmação revogar */}
      {revogarId && (
        <ConfirmDialog
          mensagem="O operador perderá acesso imediatamente. Deseja continuar?"
          labelConfirmar="Revogar acesso"
          onConfirmar={revogarAcesso}
          onCancelar={() => setRevogarId(null)}
        />
      )}
    </>
  )
}

/* ── Página principal ───────────────────────────────────── */

export default function PainelConta() {
  return (
    <Suspense>
      <PainelContaInner />
    </Suspense>
  )
}

function PainelContaInner() {
  const router     = useRouter()
  const searchParams = useSearchParams()
  const tabParam   = searchParams.get('tab')
  const abaAtiva: TabId = isValidTab(tabParam) ? tabParam : 'perfil'

  const { papel, lojaId, isLoading: roleLoading } = useRole()
  const isDono = papel === 'dono'

  const [userId, setUserId]   = useState<string | null>(null)
  const [conta, setConta]     = useState<ContaInfo | null>(null)
  const [loja, setLoja]       = useState<Loja | null | undefined>(undefined)
  const [origin, setOrigin]   = useState('')

  useEffect(() => { setOrigin(window.location.origin) }, [])

  // Aguarda useRole resolver o lojaId antes de buscar dados da loja
  useEffect(() => {
    if (roleLoading || !lojaId) return
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserId(user.id)
      setConta({
        nome: (user.user_metadata?.nome as string) ?? '',
        email: user.email ?? '',
      })

      // Busca pelo ID resolvido pelo useRole — funciona para dono e gerente
      const { data } = await supabase
        .from('lojas')
        .select('*')
        .eq('id', lojaId)
        .maybeSingle()

      setLoja(data as Loja | null)
    }
    init()
  }, [router, lojaId, roleLoading])

  // Impede acesso direto via URL a abas exclusivas de dono
  useEffect(() => {
    if (roleLoading) return
    if (!isDono && abaAtiva === 'operadores') {
      router.replace('/painel/conta?tab=perfil', { scroll: false })
    }
  }, [roleLoading, isDono, abaAtiva, router])

  function setAba(id: TabId) {
    router.replace(`/painel/conta?tab=${id}`, { scroll: false })
  }

  async function handleSair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loja === undefined || !userId) return null

  const statusLoja = calcularStatus(loja?.horarios ?? null)
  const nomeExibicao = conta?.nome || loja?.nome || 'Painel'

  return (
    <div className="flex-1 overflow-y-auto">
      <PageContainer size="medium" className="py-6 flex flex-col gap-0">

        {/* ── Header ── */}
        <header className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 bg-brand-500 flex items-center justify-center">
            {loja?.logo_url ? (
              <img src={loja.logo_url} alt={loja.nome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-surface">
                {iniciais(nomeExibicao)}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-ink truncate">
                {loja?.nome ?? 'Minha conta'}
              </h1>
              {statusLoja && (
                <span className={[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0',
                  statusLoja.tipo === 'aberto'
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-line text-ink-soft',
                ].join(' ')}>
                  <span className={[
                    'w-1.5 h-1.5 rounded-full',
                    statusLoja.tipo === 'aberto' ? 'bg-brand-500' : 'bg-ink-mute',
                  ].join(' ')} />
                  {statusLoja.tipo === 'aberto' ? 'Aberta agora' : 'Fechada'}
                </span>
              )}
            </div>
            <p className="text-sm text-ink-mute truncate">{conta?.email}</p>
          </div>

          {/* Link ver loja */}
          {loja?.slug && (
            <a
              href={`${origin}/loja/${loja.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-md border border-line bg-surface text-sm font-medium text-brand-700 hover:bg-brand-50 hover:border-brand-300 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <ExternalLink size={15} strokeWidth={1.75} />
              Ver loja
            </a>
          )}
        </header>

        {/* ── Abas: sticky ── */}
        {(() => {
          // Dono vê todas as abas incluindo Operadores; gerente vê o conjunto base
          const tabs = isDono
            ? [...TABS_BASE, TAB_OPERADORES]
            : TABS_BASE
          return (
            <div className="sticky top-14 z-20 bg-bg -mx-4 px-4 pb-0 border-b border-line mb-6">
              {/* Desktop: pills */}
              <nav className="hidden md:flex items-center gap-1 overflow-x-auto" aria-label="Abas">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAba(t.id as TabId)}
                    className={[
                      'flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-t',
                      abaAtiva === t.id
                        ? 'border-brand-500 text-brand-700'
                        : 'border-transparent text-ink-soft hover:text-ink hover:border-line',
                    ].join(' ')}
                    aria-current={abaAtiva === t.id ? 'page' : undefined}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>

              {/* Mobile: select */}
              <div className="md:hidden py-3">
                <select
                  value={abaAtiva}
                  onChange={e => setAba(e.target.value as TabId)}
                  className="w-full h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
                  aria-label="Selecionar aba"
                >
                  {tabs.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })()}

        {/* ── Conteúdo das abas ── */}

        {/* Perfil */}
        <div className={abaAtiva === 'perfil' ? '' : 'hidden'}>
          {conta && (
            <TabPerfil conta={conta} userId={userId} onSair={handleSair} />
          )}
        </div>

        {/* Loja */}
        <div className={abaAtiva === 'loja' ? '' : 'hidden'}>
          {loja === null ? (
            <Card bodyClassName="p-6">
              <p className="text-sm text-ink-soft text-center py-4">
                Nenhuma loja cadastrada. Crie sua loja no{' '}
                <Link href="/painel" className="font-medium text-brand-600 hover:text-brand-700 underline">
                  painel principal
                </Link>
                .
              </p>
            </Card>
          ) : (
            <StoreInfoCard
              userId={userId}
              loja={loja}
              onSalvo={novaLoja => setLoja(novaLoja)}
            />
          )}
        </div>

        {/* Entrega */}
        <div className={abaAtiva === 'entrega' ? '' : 'hidden'}>
          {loja ? (
            <DistanceDeliveryCard loja={loja} />
          ) : (
            <Card bodyClassName="p-6">
              <p className="text-sm text-ink-soft text-center py-4">Cadastre sua loja primeiro.</p>
            </Card>
          )}
        </div>

        {/* Horários */}
        <div className={abaAtiva === 'horarios' ? '' : 'hidden'}>
          {loja ? (
            <OpeningHoursCard loja={loja} />
          ) : (
            <Card bodyClassName="p-6">
              <p className="text-sm text-ink-soft text-center py-4">Cadastre sua loja primeiro.</p>
            </Card>
          )}
        </div>

        {/* Pagamentos */}
        <div className={abaAtiva === 'pagamentos' ? '' : 'hidden'}>
          {loja ? (
            <TabPagamentos loja={loja} />
          ) : (
            <Card bodyClassName="p-6">
              <p className="text-sm text-ink-soft text-center py-4">Cadastre sua loja primeiro.</p>
            </Card>
          )}
        </div>

        {/* Avaliações */}
        <div className={abaAtiva === 'avaliacoes' ? '' : 'hidden'}>
          {loja ? (
            <TabAvaliacoes loja={loja} onIrParaLoja={() => setAba('loja')} />
          ) : (
            <Card bodyClassName="p-6">
              <p className="text-sm text-ink-soft text-center py-4">Cadastre sua loja primeiro.</p>
            </Card>
          )}
        </div>

        {/* Operadores — somente dono */}
        {isDono && abaAtiva === 'operadores' && loja && userId && (
          <TabOperadores lojaId={loja.id} donoId={userId} />
        )}

      </PageContainer>
    </div>
  )
}
