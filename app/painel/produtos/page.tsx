'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageContainer } from '@/components/ui/PageContainer'

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

function produtoParaForm(p: Produto): FormValues {
  return {
    nome: p.nome,
    categoria_id: p.categoria_id ?? '',
    preco: p.preco.toFixed(2).replace('.', ','),
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
  onSalvo: () => void
  onCancelar: () => void
}

function ProdutoForm({ loja, categorias, produto, onSalvo, onCancelar }: ProdutoFormProps) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
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

    setSalvando(false)

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
    <Card bodyClassName="p-6">
      <h2 className="text-[18px] font-semibold text-ink mb-5">
        {produto ? 'Editar produto' : 'Novo produto'}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

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

        <div className="flex gap-3 mt-1">
          <Button type="submit" disabled={salvando} className="flex-1">
            {salvando ? 'Salvando…' : 'Salvar produto'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}

/* ── Card de produto (listagem) ──────────────────── */

interface ProdutoCardProps {
  produto: Produto
  categoriaNome: string | undefined
  onEditar: () => void
  onExcluir: () => void
}

function ProdutoCard({ produto, categoriaNome, onEditar, onExcluir }: ProdutoCardProps) {
  return (
    <Card bodyClassName="p-0">
      {/* Foto 4:3 — placeholder discreto quando não há imagem */}
      <div className="aspect-[4/3] overflow-hidden bg-brand-50">
        {produto.foto_url ? (
          <img
            src={produto.foto_url}
            alt={produto.nome}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={36} strokeWidth={1.25} className="text-brand-200" />
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4">
        {/* Nome + badge */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-semibold text-ink leading-snug flex-1">
            {produto.nome}
          </p>
          <StatusBadge status={produto.disponivel ? 'disponivel' : 'indisponivel'} />
        </div>

        {/* Preço */}
        <p className="text-[18px] font-bold text-brand-700 mt-1">
          {formatarReal(produto.preco)}
          <span className="text-sm font-normal text-ink-mute">
            {' '}/ {labelUnidade(produto.unidade)}
          </span>
        </p>

        {/* Categoria */}
        {categoriaNome && (
          <p className="text-xs text-ink-mute mt-1">{categoriaNome}</p>
        )}

        {/* Ações */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-line justify-end">
          <Button variant="ghost" onClick={onEditar}>Editar</Button>
          <Button
            variant="ghost"
            className="text-danger hover:bg-danger/10"
            onClick={onExcluir}
          >
            Excluir
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ── Página principal ────────────────────────────── */

export default function Produtos() {
  const router = useRouter()

  const [loja, setLoja]               = useState<Loja | null | undefined>(undefined)
  const [categorias, setCategorias]   = useState<Categoria[]>([])
  const [produtos, setProdutos]       = useState<Produto[]>([])

  const [formAberto, setFormAberto]           = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null)
  const [dialogo, setDialogo]                 = useState<{ mensagem: string; onConfirmar: () => void } | null>(null)

  /* ── Inicialização ──────────────────────────── */

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('lojas')
        .select('id, nome')
        .eq('dono_id', user.id)
        .maybeSingle()

      const lojaEncontrada = data ? (data as Loja) : null
      setLoja(lojaEncontrada)

      if (lojaEncontrada) {
        await Promise.all([
          buscarCategorias(lojaEncontrada.id),
          buscarProdutos(lojaEncontrada.id),
        ])
      }
    }

    init()
  }, [router])

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
  }

  function excluir(produto: Produto) {
    setDialogo({
      mensagem: `Excluir o produto "${produto.nome}"?`,
      onConfirmar: async () => {
        setDialogo(null)
        await supabase.from('produtos').delete().eq('id', produto.id)
        if (loja) await buscarProdutos(loja.id)
      },
    })
  }

  /* ── Render ─────────────────────────────────── */

  if (loja === undefined) return null

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

  return (
    <>
    <main className="min-h-screen bg-bg py-10">
      <PageContainer size="narrow" className="flex flex-col gap-6">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-soft">Produtos</p>
            <p className="text-base font-semibold text-ink mt-0.5">{loja.nome}</p>
          </div>
          <Link href="/painel">
            <Button variant="secondary">← Painel</Button>
          </Link>
        </div>

        {/* Formulário ou botão "Novo produto" */}
        {formAberto ? (
          <ProdutoForm
            loja={loja}
            categorias={categorias}
            produto={produtoEditando}
            onSalvo={handleSalvo}
            onCancelar={fecharForm}
          />
        ) : (
          <Button onClick={abrirNovoProduto} className="w-full">
            + Novo produto
          </Button>
        )}

        {/* Lista */}
        {!formAberto && (
          produtos.length === 0 ? (
            <Card bodyClassName="p-8 text-center">
              <p className="text-sm text-ink-mute">
                Nenhum produto cadastrado ainda.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {produtos.map(p => (
                <ProdutoCard
                  key={p.id}
                  produto={p}
                  categoriaNome={p.categoria_id ? categoriaMap[p.categoria_id] : undefined}
                  onEditar={() => abrirEdicao(p)}
                  onExcluir={() => excluir(p)}
                />
              ))}
            </div>
          )
        )}

      </PageContainer>
    </main>

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
