'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ImageIcon, Check, Copy, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { PageContainer } from '@/components/ui/PageContainer'

/* ── Tipos ─────────────────────────────────────────────── */

interface Loja {
  id: string
  dono_id: string
  nome: string
  slug: string
  whatsapp: string | null
  endereco: string | null
  taxa_entrega: number
  pedido_minimo: number | null
  ativo: boolean
  logo_url: string | null
  chave_pix: string | null
}

interface FormValues {
  nome: string
  slug: string
  whatsapp: string
  endereco: string
  taxa_entrega: string
  pedido_minimo: string
  chave_pix: string
}

type Feedback = { tipo: 'sucesso' | 'erro'; texto: string }

/* ── Helpers ────────────────────────────────────────────── */

const FORM_VAZIO: FormValues = {
  nome: '',
  slug: '',
  whatsapp: '',
  endereco: '',
  taxa_entrega: '0',
  pedido_minimo: '',
  chave_pix: '',
}

function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, '')     // remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-')            // espaços → hífens
}

function lojaParaForm(l: Loja): FormValues {
  return {
    nome: l.nome,
    slug: l.slug,
    whatsapp: l.whatsapp ?? '',
    endereco: l.endereco ?? '',
    taxa_entrega: String(l.taxa_entrega),
    pedido_minimo: l.pedido_minimo != null ? String(l.pedido_minimo) : '',
    chave_pix: l.chave_pix ?? '',
  }
}

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function aplicarMascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/* ── Formulário (criar e editar) ────────────────────────── */

interface LojaFormProps {
  userId: string
  loja: Loja | null   // null = criar, Loja = editar
  onSalvo: (loja: Loja) => void
  onCancelar?: () => void
}

function LojaForm({ userId, loja, onSalvo, onCancelar }: LojaFormProps) {
  const [form, setForm] = useState<FormValues>(
    loja ? lojaParaForm(loja) : FORM_VAZIO
  )
  // Se estamos editando, o slug já existe: não sobrescrever ao digitar nome
  const [slugManual, setSlugManual] = useState(loja !== null)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  function handleNome(valor: string) {
    setForm(prev => ({
      ...prev,
      nome: valor,
      ...(slugManual ? {} : { slug: gerarSlug(valor) }),
    }))
  }

  function handleSlug(valor: string) {
    setSlugManual(true)
    setForm(prev => ({ ...prev, slug: valor }))
  }

  function handleCampo(campo: Exclude<keyof FormValues, 'nome' | 'slug'>) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [campo]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setFeedback(null)

    const payload = {
      nome: form.nome.trim(),
      slug: form.slug.trim(),
      whatsapp: form.whatsapp.trim() || null,
      endereco: form.endereco.trim() || null,
      taxa_entrega: parseFloat(form.taxa_entrega) || 0,
      pedido_minimo: form.pedido_minimo ? parseFloat(form.pedido_minimo) : null,
      chave_pix: form.chave_pix.trim() || null,
    }

    const { error } = loja
      ? await supabase.from('lojas').update(payload).eq('id', loja.id)
      : await supabase.from('lojas').insert({ ...payload, dono_id: userId, ativo: true })

    if (error) {
      setFeedback({
        tipo: 'erro',
        texto:
          error.code === '23505'
            ? 'Esse endereço de loja já está em uso, escolha outro.'
            : error.message,
      })
      setSalvando(false)
      return
    }

    // Rebuscar para pegar os dados completos (evita chamar .select() após .insert())
    const { data } = await supabase
      .from('lojas')
      .select('*')
      .eq('dono_id', userId)
      .maybeSingle()

    setSalvando(false)

    if (data) {
      onSalvo(data as Loja)
    } else {
      setFeedback({ tipo: 'erro', texto: 'Erro ao carregar os dados salvos.' })
    }
  }

  return (
    <Card bodyClassName="p-6">
      <h2 className="text-[18px] font-semibold text-ink mb-5">
        {loja ? 'Editar loja' : 'Criar minha loja'}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome da loja"
          id="nome"
          value={form.nome}
          onChange={e => handleNome(e.target.value)}
          placeholder="Ex.: Pizza do João"
          required
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Endereço da loja (URL)"
            id="slug"
            value={form.slug}
            onChange={e => handleSlug(e.target.value)}
            placeholder="pizza-do-joao"
            required
          />
          <p className="text-xs text-ink-mute">
            Gerado automaticamente a partir do nome. Só letras, números e hífens.
          </p>
        </div>

        <Input
          label="WhatsApp"
          id="whatsapp"
          type="tel"
          inputMode="tel"
          value={form.whatsapp}
          onChange={e => setForm(prev => ({ ...prev, whatsapp: aplicarMascaraTelefone(e.target.value) }))}
          placeholder="(11) 99999-9999"
        />

        <Input
          label="Endereço"
          id="endereco"
          value={form.endereco}
          onChange={handleCampo('endereco')}
          placeholder="Rua, número, bairro"
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Chave Pix"
            id="chave_pix"
            value={form.chave_pix}
            onChange={handleCampo('chave_pix')}
            placeholder="CPF, telefone, e-mail ou chave aleatória"
          />
          <p className="text-xs text-ink-mute">
            Opcional. Exibida no checkout quando o cliente escolher Pix.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Taxa de entrega (R$)"
            id="taxa_entrega"
            type="number"
            min="0"
            step="0.01"
            value={form.taxa_entrega}
            onChange={handleCampo('taxa_entrega')}
          />
          <Input
            label="Pedido mínimo (R$)"
            id="pedido_minimo"
            type="number"
            min="0"
            step="0.01"
            value={form.pedido_minimo}
            onChange={handleCampo('pedido_minimo')}
            placeholder="Opcional"
          />
        </div>

        {feedback && (
          <p className={`text-sm ${feedback.tipo === 'sucesso' ? 'text-brand-600' : 'text-danger'}`}>
            {feedback.texto}
          </p>
        )}

        <div className="flex gap-3 mt-1">
          <Button type="submit" disabled={salvando} className="flex-1">
            {salvando ? 'Salvando...' : 'Salvar loja'}
          </Button>
          {onCancelar && (
            <Button type="button" variant="secondary" onClick={onCancelar}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}

/* ── Exibição dos dados da loja ─────────────────────────── */

interface LojaInfoProps {
  loja: Loja
  onEditar: () => void
  onLogoAtualizada: (url: string | null) => void
}

function LojaInfo({ loja, onEditar, onLogoAtualizada }: LojaInfoProps) {
  const [enviandoLogo, setEnviandoLogo] = useState(false)

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviandoLogo(true)

    const { error: errUpload } = await supabase.storage
      .from('lojas')
      .upload(`${loja.id}/logo`, file, { upsert: true, contentType: file.type })

    if (!errUpload) {
      const { data: { publicUrl } } = supabase.storage
        .from('lojas')
        .getPublicUrl(`${loja.id}/logo`)
      /* cache-buster para forçar refresh imediato */
      const url = `${publicUrl}?t=${Date.now()}`
      await supabase.from('lojas').update({ logo_url: url }).eq('id', loja.id)
      onLogoAtualizada(url)
    }

    setEnviandoLogo(false)
    e.target.value = ''
  }

  async function handleRemoverLogo() {
    await supabase.storage.from('lojas').remove([`${loja.id}/logo`])
    await supabase.from('lojas').update({ logo_url: null }).eq('id', loja.id)
    onLogoAtualizada(null)
  }

  const linhas = [
    { label: 'WhatsApp',        valor: loja.whatsapp },
    { label: 'Endereço',        valor: loja.endereco },
    { label: 'Chave Pix',       valor: loja.chave_pix },
    { label: 'Taxa de entrega', valor: formatarReal(loja.taxa_entrega) },
    {
      label: 'Pedido mínimo',
      valor: loja.pedido_minimo != null ? formatarReal(loja.pedido_minimo) : null,
    },
  ].filter((l): l is { label: string; valor: string } => l.valor != null)

  return (
    <Card bodyClassName="p-6">
      {/* Logo da loja */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-brand-50 border border-line shrink-0">
          {loja.logo_url ? (
            <img src={loja.logo_url} alt={loja.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={20} strokeWidth={1.25} className="text-brand-200" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={[
            'cursor-pointer text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors',
            enviandoLogo ? 'opacity-50 pointer-events-none' : '',
          ].join(' ')}>
            {enviandoLogo ? 'Enviando…' : loja.logo_url ? 'Alterar logo' : 'Adicionar logo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleLogoUpload}
              disabled={enviandoLogo}
            />
          </label>
          {loja.logo_url && !enviandoLogo && (
            <button
              onClick={handleRemoverLogo}
              className="text-xs text-danger hover:text-danger/80 text-left transition-colors"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink">{loja.nome}</h2>
          <p className="text-sm text-ink-mute mt-0.5">/{loja.slug}</p>
        </div>
        <Button variant="secondary" onClick={onEditar}>
          Editar
        </Button>
      </div>

      {linhas.length > 0 && (
        <div className="border-t border-line">
          {linhas.map(({ label, valor }) => (
            <div
              key={label}
              className="flex justify-between py-3 border-b border-line last:border-0"
            >
              <span className="text-sm text-ink-soft">{label}</span>
              <span className="text-sm font-medium text-ink">{valor}</span>
            </div>
          ))}
        </div>
      )}
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
    { feito: temLoja,      bloqueado: false,    titulo: 'Criar sua loja',                 href: '/painel',           cta: 'Criar' },
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

/* ── Onboarding concluído: loja no ar ───────────────────── */

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
  const [userId, setUserId]   = useState<string | null>(null)
  const [email, setEmail]     = useState<string | null>(null)
  // undefined = carregando; null = sem loja; Loja = tem loja
  const [loja, setLoja]       = useState<Loja | null | undefined>(undefined)
  const [editando, setEditando] = useState(false)

  // Estado de progresso do onboarding
  const [temCategoria, setTemCategoria] = useState(false)
  const [temProduto, setTemProduto]     = useState(false)
  const [origin, setOrigin]             = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setEmail(user.email ?? null)
      setUserId(user.id)

      const { data } = await supabase
        .from('lojas')
        .select('*')
        .eq('dono_id', user.id)
        .maybeSingle()

      const lojaEncontrada = data ? (data as Loja) : null

      // Progresso: tem ao menos 1 categoria e 1 produto?
      if (lojaEncontrada) {
        const [{ count: catCount }, { count: prodCount }] = await Promise.all([
          supabase.from('categorias').select('id', { count: 'exact', head: true }).eq('loja_id', lojaEncontrada.id),
          supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaEncontrada.id),
        ])
        setTemCategoria((catCount ?? 0) > 0)
        setTemProduto((prodCount ?? 0) > 0)
      }

      setLoja(lojaEncontrada)
    }

    init()
  }, [router])

  async function handleSair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleSalvo(novaLoja: Loja) {
    setLoja(novaLoja)
    setEditando(false)
  }

  // Aguardando sessão e dados da loja
  if (loja === undefined || !userId) return null

  const temLoja = loja != null
  const onboardingCompleto = temLoja && temCategoria && temProduto

  return (
    <main className="min-h-screen bg-bg py-10">
      <PageContainer size="narrow" className="flex flex-col gap-6">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-soft">Painel do dono</p>
            <p className="text-base font-semibold text-ink mt-0.5">{email}</p>
          </div>
          <Button
            variant="secondary"
            onClick={handleSair}
            className="text-danger border-danger/30 hover:bg-danger/10"
          >
            Sair
          </Button>
        </div>

        {/* Onboarding: checklist enquanto incompleto; link permanente quando no ar */}
        {onboardingCompleto && loja ? (
          <LojaNoAr slug={loja.slug} origin={origin} />
        ) : (
          <PrimeirosPassos
            temLoja={temLoja}
            temCategoria={temCategoria}
            temProduto={temProduto}
          />
        )}

        {/* Seção da loja */}
        {loja === null ? (
          // Sem loja: exibe formulário de criação
          <LojaForm userId={userId} loja={null} onSalvo={handleSalvo} />
        ) : editando ? (
          // Editando loja existente
          <LojaForm
            userId={userId}
            loja={loja}
            onSalvo={handleSalvo}
            onCancelar={() => setEditando(false)}
          />
        ) : (
          // Exibindo dados da loja
          <LojaInfo
            loja={loja}
            onEditar={() => setEditando(true)}
            onLogoAtualizada={url => setLoja(prev => prev == null ? prev : { ...prev, logo_url: url })}
          />
        )}

        {/* Atalhos de gestão (só quando há loja e não está editando) */}
        {loja && !editando && (
          <div className="flex flex-col gap-3">
            <Link
              href="/painel/pedidos"
              className={[
                'inline-flex items-center justify-center',
                'min-h-[48px] px-4 rounded-md font-semibold text-sm',
                'bg-brand-500 text-surface',
                'hover:bg-brand-600 active:scale-[0.98] transition-all duration-150 ease-out shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              ].join(' ')}
            >
              Ver pedidos
            </Link>

            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/painel/categorias', label: 'Categorias' },
                { href: '/painel/produtos',   label: 'Produtos'   },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'inline-flex items-center justify-center',
                    'min-h-[48px] px-4 rounded-md font-semibold text-sm',
                    'bg-surface text-brand-700 border border-line',
                    'hover:bg-brand-50 transition-all duration-150 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  ].join(' ')}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}

      </PageContainer>
    </main>
  )
}
