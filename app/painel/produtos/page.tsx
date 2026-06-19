'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ImageIcon, Pencil, Trash2, Plus, X } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageContainer } from '@/components/ui/PageContainer'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'

/* ── Tipos ───────────────────────────────────────── */

interface Loja { id: string; nome: string }

interface Categoria { id: string; nome: string; ordem: number }

interface Produto {
  id: string
  loja_id: string
  categoria_id: string | null
  nome: string
  descricao: string | null
  preco: number
  preco_original: number | null
  unidade: string
  estoque: number | null
  controla_estoque: boolean
  foto_url: string | null
  disponivel: boolean
  atualizado_em: string
}

interface FormValues {
  nome: string
  categoria_id: string
  preco: string
  preco_original: string
  unidade: string
  descricao: string
  controla_estoque: boolean
  estoque: string
  disponivel: boolean
}

/* ── Constantes ──────────────────────────────────── */

const UNIDADES = [
  { value: 'un',      label: 'Unidade'  },
  { value: 'kg',      label: 'Quilo'    },
  { value: 'g',       label: 'Grama'    },
  { value: 'maco',    label: 'Maço'     },
  { value: 'duzia',   label: 'Dúzia'    },
  { value: 'l',       label: 'Litro'    },
  { value: 'bandeja', label: 'Bandeja'  },
]

const FORM_VAZIO: FormValues = {
  nome: '',
  categoria_id: '',
  preco: '',
  preco_original: '',
  unidade: 'un',
  descricao: '',
  controla_estoque: false,
  estoque: '',
  disponivel: true,
}

/* ── Helpers ─────────────────────────────────────── */

function parsePrecoBR(valor: string): number {
  return parseFloat(valor.replace(',', '.').replace(/[^\d.]/g, '')) || 0
}

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function labelUnidade(un: string): string {
  return UNIDADES.find(u => u.value === un)?.label ?? un
}

/* Badge de estoque — só quando controla_estoque = true */
function badgeEstoque(produto: Produto): { label: string; cls: string } | null {
  if (!produto.controla_estoque) return null
  const e = produto.estoque ?? 0
  if (e <= 0) return { label: 'Fora de estoque', cls: 'bg-danger/15 text-danger' }
  if (e < 5)  return { label: 'Estoque baixo',   cls: 'bg-accent/15 text-accent' }
  return { label: 'Em estoque', cls: 'bg-brand-100 text-brand-700' }
}

function produtoParaForm(p: Produto): FormValues {
  return {
    nome: p.nome,
    categoria_id: p.categoria_id ?? '',
    preco: p.preco.toFixed(2).replace('.', ','),
    preco_original: p.preco_original != null ? p.preco_original.toFixed(2).replace('.', ',') : '',
    unidade: p.unidade,
    descricao: p.descricao ?? '',
    controla_estoque: p.controla_estoque,
    estoque: p.estoque != null ? String(p.estoque) : '',
    disponivel: p.disponivel,
  }
}

/* ── Classe base para <select> ───────────────────── */

const SELECT_CLASS = [
  'h-12 w-full rounded-md border border-line bg-surface px-4',
  'text-sm text-ink',
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
  'transition-shadow duration-150',
].join(' ')

/* ── Formulário de produto ───────────────────────── */

interface ProdutoFormProps {
  loja: Loja
  categorias: Categoria[]
  produto: Produto | null
  formId: string
  onSalvo: () => void
  onSalvandoChange: (v: boolean) => void
}

function ProdutoForm({ loja, categorias, produto, formId, onSalvo, onSalvandoChange }: ProdutoFormProps) {
  const [form, setForm]             = useState<FormValues>(produto ? produtoParaForm(produto) : FORM_VAZIO)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  /* ── Estado de foto ─────────────────────────────── */
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null)
  // previewUrl: blob (arquivo recém-selecionado) ou URL do Storage (produto existente)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(produto?.foto_url ?? null)
  const [erroUpload, setErroUpload]   = useState<string | null>(null)

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArquivoFoto(file)
    setPreviewUrl(URL.createObjectURL(file))
    setErroUpload(null)
  }

  function set<K extends keyof FormValues>(campo: K, valor: FormValues[K]) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function mudarSalvando(v: boolean) {
    setSalvando(v)
    onSalvandoChange(v)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mudarSalvando(true)
    setErro(null)
    setErroUpload(null)

    /* ── Upload da foto (se houver arquivo novo) ── */
    let fotoUrl: string | null = produto?.foto_url ?? null
    let uploadFalhou = false

    if (arquivoFoto) {
      const ext  = arquivoFoto.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${loja.id}/${crypto.randomUUID()}.${ext}`

      const { error: erroStorage } = await supabase.storage
        .from('produtos')
        .upload(path, arquivoFoto)

      if (erroStorage) {
        setErroUpload(`Não foi possível enviar a imagem: ${erroStorage.message}`)
        uploadFalhou = true
        // fotoUrl mantém o valor anterior — demais campos ainda serão salvos
      } else {
        const { data } = supabase.storage.from('produtos').getPublicUrl(path)
        fotoUrl = data.publicUrl
      }
    }

    /* ── Salvar produto ─────────────────────────── */
    const payload = {
      nome:              form.nome.trim(),
      categoria_id:      form.categoria_id || null,
      preco:             parsePrecoBR(form.preco),
      preco_original:    form.preco_original.trim() ? parsePrecoBR(form.preco_original) : null,
      unidade:           form.unidade,
      descricao:         form.descricao.trim() || null,
      controla_estoque:  form.controla_estoque,
      estoque:           form.controla_estoque ? (parseFloat(form.estoque) || 0) : null,
      disponivel:        form.disponivel,
      foto_url:          fotoUrl,
    }

    const { error } = produto
      ? await supabase.from('produtos').update(payload).eq('id', produto.id)
      : await supabase.from('produtos').insert({ ...payload, loja_id: loja.id })

    mudarSalvando(false)

    if (error) {
      setErro(error.message)
    } else if (uploadFalhou) {
      // Produto salvo sem a nova foto — mantém o formulário aberto
      // para que o usuário veja a mensagem de erro do upload
    } else {
      onSalvo()
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* ── Campo de foto ──────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">
            Foto{' '}
            <span className="text-ink-mute font-normal">(opcional)</span>
          </span>

          {previewUrl ? (
            /* Prévia da imagem */
            <div className="flex flex-col gap-2">
              <div className="aspect-[4/3] overflow-hidden rounded-md bg-brand-50">
                <img
                  src={previewUrl}
                  alt="Prévia"
                  className="w-full h-full object-cover"
                />
              </div>
              <label
                htmlFor="prod-foto"
                className={[
                  'inline-flex items-center justify-center gap-2 cursor-pointer',
                  'min-h-[48px] px-5 rounded-md font-semibold text-sm',
                  'bg-surface text-brand-700 border border-line',
                  'hover:bg-brand-50 transition-all duration-150 ease-out',
                ].join(' ')}
              >
                Trocar foto
              </label>
            </div>
          ) : (
            /* Área de seleção (sem imagem) */
            <label
              htmlFor="prod-foto"
              className={[
                'flex flex-col items-center justify-center gap-2 cursor-pointer',
                'aspect-[4/3] rounded-md border-2 border-dashed border-line',
                'text-ink-mute hover:border-brand-300 hover:bg-brand-50',
                'transition-colors duration-150',
              ].join(' ')}
            >
              <ImageIcon size={28} strokeWidth={1.5} />
              <span className="text-sm">Clique para adicionar foto</span>
              <span className="text-xs">JPG, PNG, WEBP · máx. 5 MB</span>
            </label>
          )}

          {/* Input file oculto */}
          <input
            id="prod-foto"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFotoChange}
          />

          {erroUpload && (
            <p className="text-sm text-danger">{erroUpload}</p>
          )}
        </div>

        {/* Nome */}
        <Input
          label="Nome"
          id="prod-nome"
          value={form.nome}
          onChange={e => set('nome', e.target.value)}
          placeholder="Ex.: Tomate cereja"
          required
        />

        {/* Categoria */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prod-categoria" className="text-sm font-medium text-ink">
            Categoria{' '}
            <span className="text-ink-mute font-normal">(opcional)</span>
          </label>
          <select
            id="prod-categoria"
            value={form.categoria_id}
            onChange={e => set('categoria_id', e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Sem categoria</option>
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        {/* Preço + Unidade */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Preço (R$)"
            id="prod-preco"
            value={form.preco}
            onChange={e => set('preco', e.target.value)}
            placeholder="0,00"
            required
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prod-unidade" className="text-sm font-medium text-ink">
              Unidade
            </label>
            <select
              id="prod-unidade"
              value={form.unidade}
              onChange={e => set('unidade', e.target.value)}
              className={SELECT_CLASS}
            >
              {UNIDADES.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Preço original (desconto) */}
        <Input
          label={<>Preço original <span className="text-ink-mute font-normal">(opcional — preencha para exibir desconto)</span></>}
          id="prod-preco-original"
          value={form.preco_original}
          onChange={e => set('preco_original', e.target.value)}
          placeholder="0,00"
        />

        {/* Descrição */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prod-descricao" className="text-sm font-medium text-ink">
            Descrição{' '}
            <span className="text-ink-mute font-normal">(opcional)</span>
          </label>
          <textarea
            id="prod-descricao"
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="Detalhes sobre o produto…"
            rows={3}
            className={[
              'w-full rounded-md border border-line bg-surface px-4 py-3',
              'text-sm text-ink placeholder:text-ink-mute resize-none',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
              'transition-shadow duration-150',
            ].join(' ')}
          />
        </div>

        {/* Controlar estoque */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.controla_estoque}
              onChange={e => set('controla_estoque', e.target.checked)}
              className="w-5 h-5 rounded accent-brand-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-ink">Controlar estoque</span>
          </label>

          {form.controla_estoque && (
            <Input
              label="Quantidade em estoque"
              id="prod-estoque"
              type="number"
              min="0"
              step="0.001"
              value={form.estoque}
              onChange={e => set('estoque', e.target.value)}
              placeholder="0"
            />
          )}
        </div>

        {/* Toggle disponível */}
        <div className="flex items-center justify-between rounded-md border border-line px-4 py-3">
          <span className="text-sm font-medium text-ink">Disponível para venda</span>
          <button
            type="button"
            role="switch"
            aria-checked={form.disponivel}
            onClick={() => set('disponivel', !form.disponivel)}
            className={[
              'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full',
              'transition-colors duration-200 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              form.disponivel ? 'bg-brand-500' : 'bg-line',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-5 w-5 rounded-full bg-surface shadow-sm',
                'transition-transform duration-200 ease-out',
                form.disponivel ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>

        {erro && <p className="text-sm text-danger">{erro}</p>}

      </form>
  )
}

/* ── Modal / drawer de produto ───────────────────── */

interface ProdutoModalProps {
  open: boolean
  loja: Loja
  categorias: Categoria[]
  produto: Produto | null
  onSalvo: () => void
  onFechar: () => void
}

const FORM_ID = 'produto-form'

function ProdutoModal({ open, loja, categorias, produto, onSalvo, onFechar }: ProdutoModalProps) {
  const [visivel, setVisivel]   = useState(false)
  const [salvando, setSalvando] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setSalvando(false)
      requestAnimationFrame(() => setVisivel(true))
      document.body.style.overflow = 'hidden'
    } else {
      setVisivel(false)
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onFechar])

  if (!open && !visivel) return null

  return (
    <div
      ref={overlayRef}
      className={[
        'fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end',
        'transition-colors duration-200',
        visivel ? 'bg-ink/40' : 'bg-transparent',
      ].join(' ')}
      onClick={e => { if (e.target === overlayRef.current) onFechar() }}
      role="dialog"
      aria-modal="true"
      aria-label={produto ? 'Editar produto' : 'Novo produto'}
    >
      {/* Painel deslizante */}
      <div
        className={[
          'relative bg-surface flex flex-col',
          'w-full md:w-[500px] md:h-full',
          'rounded-t-2xl md:rounded-none md:rounded-l-2xl',
          'shadow-lg max-h-[92dvh] md:max-h-full',
          'transition-transform duration-200 ease-out',
          visivel ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho fixo */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line shrink-0">
          <h2 className="text-lg font-semibold text-ink">
            {produto ? 'Editar produto' : 'Novo produto'}
          </h2>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
          >
            <X size={18} strokeWidth={1.75} className="text-ink-soft" />
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <ProdutoForm
            loja={loja}
            categorias={categorias}
            produto={produto}
            formId={FORM_ID}
            onSalvo={onSalvo}
            onSalvandoChange={setSalvando}
          />
        </div>

        {/* Rodapé fixo com botões sempre visíveis */}
        <div className="shrink-0 px-5 py-4 border-t border-line flex gap-3">
          <Button
            type="submit"
            form={FORM_ID}
            disabled={salvando}
            className="flex-1"
          >
            {salvando ? 'Salvando…' : 'Salvar produto'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onFechar}
            disabled={salvando}
            className="shrink-0"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Card de produto (listagem) ──────────────────── */

interface ProdutoCardProps {
  produto: Produto
  categoriaNome: string | undefined
  onEditar: () => void
  onExcluir: () => void
  onToggleDisponivel: () => void
}

function ProdutoCard({ produto, categoriaNome, onEditar, onExcluir, onToggleDisponivel }: ProdutoCardProps) {
  const estoque = badgeEstoque(produto)

  return (
    <Card bodyClassName="p-0" className="flex flex-col">
      {/* Foto quadrada — placeholder verde quando não há imagem */}
      <div className="relative aspect-square overflow-hidden bg-brand-50">
        {produto.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={produto.foto_url} alt={produto.nome} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={36} strokeWidth={1.25} className="text-brand-200" />
          </div>
        )}

        {/* Badge de estoque sobre a foto */}
        {estoque && (
          <span className={`absolute top-2 left-2 text-[11px] font-semibold rounded-full px-2 py-0.5 ${estoque.cls}`}>
            {estoque.label}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-3 flex flex-col flex-1">
        {/* Nome + switch de disponibilidade */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-ink leading-snug line-clamp-2 flex-1">
            {produto.nome}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={produto.disponivel}
            title={produto.disponivel ? 'Disponível' : 'Indisponível'}
            aria-label={produto.disponivel ? 'Disponível (tocar para ocultar)' : 'Indisponível (tocar para exibir)'}
            onClick={onToggleDisponivel}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              produto.disponivel ? 'bg-brand-500' : 'bg-line',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-4 w-4 rounded-full bg-surface shadow-sm transition-transform duration-200',
                produto.disponivel ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>

        {/* Descrição curta */}
        {produto.descricao && (
          <p className="text-xs text-ink-mute mt-1 line-clamp-2 leading-snug">{produto.descricao}</p>
        )}

        {/* Preço */}
        <p className="text-[16px] font-bold text-brand-700 mt-2">
          {formatarReal(produto.preco)}
          <span className="text-xs font-normal text-ink-mute"> / {labelUnidade(produto.unidade)}</span>
        </p>

        {/* Categoria */}
        {categoriaNome && (
          <p className="text-xs text-ink-mute mt-1">{categoriaNome}</p>
        )}

        {/* Ações em ícone (tooltip via title) */}
        <div className="flex gap-1 mt-3 pt-2 border-t border-line justify-end">
          <button
            type="button"
            title="Editar produto"
            aria-label="Editar produto"
            onClick={onEditar}
            className="w-9 h-9 flex items-center justify-center rounded-full text-brand-700 hover:bg-brand-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Pencil size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            title="Excluir produto"
            aria-label="Excluir produto"
            onClick={onExcluir}
            className="w-9 h-9 flex items-center justify-center rounded-full text-danger hover:bg-danger/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </Card>
  )
}

/* ── Página principal ────────────────────────────── */

export default function Produtos() {
  const { lojaId } = useRole()

  const [loja, setLoja]               = useState<Loja | null | undefined>(undefined)
  const [categorias, setCategorias]   = useState<Categoria[]>([])
  const [produtos, setProdutos]       = useState<Produto[]>([])

  const [formAberto, setFormAberto]           = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null)
  const [dialogo, setDialogo]                 = useState<{ mensagem: string; onConfirmar: () => void } | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)

  /* ── Inicialização ──────────────────────────── */

  useEffect(() => {
    if (!lojaId) return
    async function init() {
      const { data } = await supabase.from('lojas').select('id, nome').eq('id', lojaId).single()
      const lojaEncontrada = data ? (data as Loja) : null
      setLoja(lojaEncontrada)
      if (lojaEncontrada) {
        await Promise.all([buscarCategorias(lojaEncontrada.id), buscarProdutos(lojaEncontrada.id)])
      }
    }
    init()
  }, [lojaId])

  /* ── Buscas ─────────────────────────────────── */

  async function buscarCategorias(lojaId: string) {
    const { data } = await supabase
      .from('categorias')
      .select('id, nome, ordem')
      .eq('loja_id', lojaId)
      .order('ordem')
    setCategorias((data as Categoria[]) ?? [])
  }

  async function buscarProdutos(lojaId: string) {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('loja_id', lojaId)
      .order('nome')
    setProdutos((data as Produto[]) ?? [])
  }

  /* ── Ações ──────────────────────────────────── */

  function abrirNovoProduto() {
    setProdutoEditando(null)
    setFormAberto(true)
  }

  function abrirEdicao(produto: Produto) {
    setProdutoEditando(produto)
    setFormAberto(true)
  }

  function fecharForm() {
    setFormAberto(false)
    setProdutoEditando(null)
  }

  async function handleSalvo() {
    fecharForm()
    if (loja) await buscarProdutos(loja.id)
    toast.success('Produto salvo')
  }

  async function toggleDisponivel(produto: Produto) {
    // Atualização otimista; reverte buscando de novo em caso de erro
    setProdutos(prev => prev.map(p => p.id === produto.id ? { ...p, disponivel: !p.disponivel } : p))
    const { error } = await supabase
      .from('produtos')
      .update({ disponivel: !produto.disponivel })
      .eq('id', produto.id)
    if (error) {
      toast.error('Não foi possível atualizar a disponibilidade')
      if (loja) await buscarProdutos(loja.id)
    } else {
      toast.success(produto.disponivel ? 'Produto ocultado' : 'Produto disponível')
    }
  }

  function excluir(produto: Produto) {
    setDialogo({
      mensagem: `Excluir o produto "${produto.nome}"?`,
      onConfirmar: async () => {
        setDialogo(null)
        const { error } = await supabase.from('produtos').delete().eq('id', produto.id)
        if (error) { toast.error('Não foi possível excluir o produto'); return }
        if (loja) await buscarProdutos(loja.id)
        toast.success('Produto excluído')
      },
    })
  }

  /* ── Render ─────────────────────────────────── */

  if (loja === undefined) {
    return (
      <main className="py-8">
        <PageContainer size="wide" className="flex flex-col gap-6">
          <Skeleton className="h-7 w-40" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-lg overflow-hidden shadow-sm">
                <Skeleton className="aspect-square rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </PageContainer>
      </main>
    )
  }

  if (loja === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <Card bodyClassName="p-8 text-center max-w-sm">
          <p className="text-base font-semibold text-ink mb-1">
            Nenhuma loja encontrada
          </p>
          <p className="text-sm text-ink-soft mb-6">
            Crie sua loja primeiro para cadastrar produtos.
          </p>
          <Link href="/painel">
            <Button className="w-full">Ir para o painel</Button>
          </Link>
        </Card>
      </main>
    )
  }

  const categoriaMap = Object.fromEntries(categorias.map(c => [c.id, c.nome]))

  const produtosFiltrados = filtroCategoria === 'sem-categoria'
    ? produtos.filter(p => !p.categoria_id)
    : filtroCategoria
      ? produtos.filter(p => p.categoria_id === filtroCategoria)
      : produtos

  const catsComProdutos = categorias.filter(c => produtos.some(p => p.categoria_id === c.id))
  const temSemCategoria = produtos.some(p => !p.categoria_id)

  return (
    <>
      <main className="py-8">
        <PageContainer size="wide" className="flex flex-col gap-6">

          {/* Topo: título + Novo produto */}
          <SectionTitle
            count={produtosFiltrados.length}
            action={
              <Button onClick={abrirNovoProduto} className="!min-h-[40px] text-sm px-4">
                <Plus size={16} strokeWidth={2} />
                Novo produto
              </Button>
            }
          >
            Produtos
          </SectionTitle>

          {/* Filtro por categoria */}
          {(catsComProdutos.length > 0 || temSemCategoria) && (
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mt-2">
              <Chip
                selected={filtroCategoria === null}
                variant="solid"
                onClick={() => setFiltroCategoria(null)}
              >
                Todos
              </Chip>
              {catsComProdutos.map(c => (
                <Chip
                  key={c.id}
                  selected={filtroCategoria === c.id}
                  variant="solid"
                  onClick={() => setFiltroCategoria(c.id)}
                >
                  {c.nome}
                </Chip>
              ))}
              {temSemCategoria && (
                <Chip
                  selected={filtroCategoria === 'sem-categoria'}
                  variant="solid"
                  onClick={() => setFiltroCategoria('sem-categoria')}
                >
                  Sem categoria
                </Chip>
              )}
            </div>
          )}

          {/* Lista */}
          {produtos.length === 0 ? (
            <Card bodyClassName="p-10 text-center">
              <ImageIcon size={32} strokeWidth={1.25} className="text-ink-mute mx-auto mb-3" />
              <p className="text-sm font-semibold text-ink">Nenhum produto cadastrado</p>
              <p className="text-xs text-ink-mute mt-1">Toque em "Novo produto" para começar.</p>
            </Card>
          ) : produtosFiltrados.length === 0 ? (
            <Card bodyClassName="p-10 text-center">
              <ImageIcon size={32} strokeWidth={1.25} className="text-ink-mute mx-auto mb-3" />
              <p className="text-sm font-semibold text-ink">Nenhum produto nesta categoria</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {produtosFiltrados.map(p => (
                <ProdutoCard
                  key={p.id}
                  produto={p}
                  categoriaNome={p.categoria_id ? categoriaMap[p.categoria_id] : undefined}
                  onEditar={() => abrirEdicao(p)}
                  onExcluir={() => excluir(p)}
                  onToggleDisponivel={() => toggleDisponivel(p)}
                />
              ))}
            </div>
          )}

        </PageContainer>
      </main>

      {/* Modal de criação / edição de produto */}
      <ProdutoModal
        open={formAberto}
        loja={loja}
        categorias={categorias}
        produto={produtoEditando}
        onSalvo={handleSalvo}
        onFechar={fecharForm}
      />

      {/* Diálogo de confirmação de exclusão */}
      {dialogo && (
        <ConfirmDialog
          mensagem={dialogo.mensagem}
          onConfirmar={dialogo.onConfirmar}
          onCancelar={() => setDialogo(null)}
        />
      )}
    </>
  )
}
