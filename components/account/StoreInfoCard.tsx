'use client'

import { useState } from 'react'
import { ImageIcon, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

/* ── Tipos exportados ───────────────────────────────────── */

export interface HorarioDia {
  aberto: boolean
  abre: string
  fecha: string
}
export type Horarios = Record<string, HorarioDia>

export interface FaixaEntrega {
  distancia_ate: number
  taxa: number
}

export interface Loja {
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
  horarios: Horarios | null
  tempo_entrega_min: number | null
  latitude: number | null
  longitude: number | null
  raio_maximo_km: number | null
  faixas_entrega: FaixaEntrega[] | null
  avaliacoes_ativas: boolean
}

interface FormValues {
  nome: string
  slug: string
  whatsapp: string
  cep: string
  endereco: string
  taxa_entrega: string
  pedido_minimo: string
  chave_pix: string
  tempo_entrega_min: string
  raio_maximo_km: string
}

type Feedback = { tipo: 'sucesso' | 'erro'; texto: string }

/* ── Helpers exportados ─────────────────────────────────── */

export function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/* ── Helpers internos ───────────────────────────────────── */

const FORM_VAZIO: FormValues = {
  nome: '',
  slug: '',
  whatsapp: '',
  cep: '',
  endereco: '',
  taxa_entrega: '0',
  pedido_minimo: '',
  chave_pix: '',
  tempo_entrega_min: '',
  raio_maximo_km: '',
}

function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function lojaParaForm(l: Loja): FormValues {
  return {
    nome: l.nome,
    slug: l.slug,
    whatsapp: l.whatsapp ?? '',
    cep: '',
    endereco: l.endereco ?? '',
    taxa_entrega: String(l.taxa_entrega),
    pedido_minimo: l.pedido_minimo != null ? String(l.pedido_minimo) : '',
    chave_pix: l.chave_pix ?? '',
    tempo_entrega_min: l.tempo_entrega_min != null ? String(l.tempo_entrega_min) : '',
    raio_maximo_km: l.raio_maximo_km != null ? String(l.raio_maximo_km) : '',
  }
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
  loja: Loja | null
  onSalvo: (loja: Loja) => void
  onCancelar?: () => void
}

function LojaForm({ userId, loja, onSalvo, onCancelar }: LojaFormProps) {
  const [form, setForm] = useState<FormValues>(
    loja ? lojaParaForm(loja) : FORM_VAZIO
  )
  const [slugManual, setSlugManual] = useState(loja !== null)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

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

  function handleCampo(campo: Exclude<keyof FormValues, 'nome' | 'slug' | 'cep'>) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [campo]: e.target.value }))
  }

  async function handleCep(valor: string) {
    const digits = valor.replace(/\D/g, '').slice(0, 8)
    const formatado = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    setForm(prev => ({ ...prev, cep: formatado }))
    if (digits.length === 8) {
      setBuscandoCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
        const data = await res.json()
        if (!data.erro) {
          const partes = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean)
          setForm(prev => ({ ...prev, cep: formatado, endereco: partes.join(', ') }))
        }
      } catch { /* silent */ }
      setBuscandoCep(false)
    }
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
      tempo_entrega_min: form.tempo_entrega_min ? parseInt(form.tempo_entrega_min, 10) : null,
      raio_maximo_km: form.raio_maximo_km ? parseFloat(form.raio_maximo_km) : null,
    }

    const isNovaLoja = !loja
    const { error } = isNovaLoja
      ? await supabase.from('lojas').insert({ ...payload, dono_id: userId, ativo: true })
      : await supabase.from('lojas').update(payload).eq('id', loja.id)

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

    const { data } = await supabase
      .from('lojas')
      .select('*')
      .eq('dono_id', userId)
      .maybeSingle()

    setSalvando(false)

    if (data) {
      onSalvo(data as Loja)

      if (isNovaLoja) {
        const { data: userData } = await supabase.auth.getUser()
        const emailDono = userData?.user?.email
        const nomeDono = userData?.user?.user_metadata?.nome ?? 'Lojista'
        if (emailDono) {
          fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo:      'boas_vindas',
              email:     emailDono,
              nome_dono: nomeDono,
              nome_loja: payload.nome,
            }),
          }).catch(() => {})
        }
      }
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

        <div className="flex flex-col gap-1.5">
          <Input
            label="CEP"
            id="cep"
            value={form.cep}
            onChange={e => handleCep(e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
          />
          {buscandoCep && (
            <p className="text-xs text-ink-mute">Buscando endereço…</p>
          )}
        </div>

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

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Tempo médio de entrega"
            id="tempo_entrega_min"
            type="text"
            inputMode="numeric"
            suffix="min"
            value={form.tempo_entrega_min}
            onChange={e =>
              setForm(prev => ({ ...prev, tempo_entrega_min: e.target.value.replace(/\D/g, '') }))
            }
            placeholder="ex: 30"
          />
          <Input
            label="Raio máximo de entrega"
            id="raio_maximo_km"
            type="number"
            min="1"
            step="0.5"
            suffix="km"
            value={form.raio_maximo_km}
            onChange={handleCampo('raio_maximo_km')}
            placeholder="ex: 10"
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
    {
      label: 'Tempo médio de entrega',
      valor: loja.tempo_entrega_min != null
        ? `${loja.tempo_entrega_min}–${loja.tempo_entrega_min + 15} min`
        : null,
    },
    {
      label: 'Raio máximo de entrega',
      valor: loja.raio_maximo_km != null ? `${loja.raio_maximo_km} km` : null,
    },
  ].filter((l): l is { label: string; valor: string } => l.valor != null)

  return (
    <Card bodyClassName="p-6">
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

/* ── Componente público ─────────────────────────────────── */

interface StoreInfoCardProps {
  userId: string
  loja: Loja | null
  onSalvo: (loja: Loja) => void
}

export function StoreInfoCard({ userId, loja: lojaInicial, onSalvo }: StoreInfoCardProps) {
  const [loja, setLoja] = useState<Loja | null>(lojaInicial)
  const [editando, setEditando] = useState(false)

  function handleSalvo(novaLoja: Loja) {
    setLoja(novaLoja)
    setEditando(false)
    onSalvo(novaLoja)
  }

  if (loja === null || editando) {
    return (
      <LojaForm
        userId={userId}
        loja={loja}
        onSalvo={handleSalvo}
        onCancelar={loja ? () => setEditando(false) : undefined}
      />
    )
  }

  return (
    <LojaInfo
      loja={loja}
      onEditar={() => setEditando(true)}
      onLogoAtualizada={url => setLoja(prev => prev ? { ...prev, logo_url: url } : prev)}
    />
  )
}
