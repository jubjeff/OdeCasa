import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { MapPin, Truck, ArrowRight, Sprout, MessageCircle } from 'lucide-react'

/* ── Busca server-side (sem login, chave anon) ───── */

interface Loja {
  nome: string
  slug: string
  endereco: string | null
  taxa_entrega: number
  pedido_minimo: number | null
  whatsapp: string | null
  logo_url: string | null
}

async function getLoja(): Promise<Loja | null> {
  try {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data } = await client
      .from('lojas')
      .select('nome, slug, endereco, taxa_entrega, pedido_minimo, whatsapp, logo_url')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()
    return (data as Loja) ?? null
  } catch {
    return null
  }
}

function formatarReal(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function linkWhatsApp(whatsapp: string, nomeLoja: string): string {
  const d = whatsapp.replace(/\D/g, '')
  const numero = d.startsWith('55') ? d : `55${d}`
  const msg = `Olá! Vim pelo site da ${nomeLoja} 🙂`
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`
}

/* ── Página ──────────────────────────────────────── */

export default async function Home() {
  const loja = await getLoja()

  const entrega = loja
    ? loja.taxa_entrega === 0
      ? 'Entrega grátis'
      : `Entrega ${formatarReal(loja.taxa_entrega)}`
    : ''

  const temWhats = !!loja?.whatsapp?.replace(/\D/g, '')

  return (
    <main className="min-h-screen bg-bg flex flex-col font-sans">

      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-6 py-10">

        {/* Logo da marca */}
        <Image
          src="/odecasa-logo.png"
          alt="ÔdeCasa Delivery"
          width={168}
          height={168}
          className="mx-auto block shrink-0"
          priority
        />

        {loja ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">

            {/* Logo da loja (se houver) */}
            {loja.logo_url && (
              <div className="w-20 h-20 rounded-full overflow-hidden border border-line shadow-sm mb-5 bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={loja.logo_url} alt={loja.nome} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Nome da loja */}
            <h1 className="text-[28px] sm:text-[32px] leading-tight font-bold text-ink max-w-sm">
              {loja.nome}
            </h1>

            {/* Endereço */}
            {loja.endereco && (
              <p className="flex items-center gap-1.5 text-sm text-ink-soft mt-3">
                <MapPin size={15} strokeWidth={1.75} className="shrink-0 text-ink-mute" />
                {loja.endereco}
              </p>
            )}

            {/* Taxa de entrega + pedido mínimo */}
            <div className="mt-5 flex flex-col items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-brand-100 text-brand-700 text-sm font-semibold rounded-full px-3.5 py-1.5">
                <Truck size={15} strokeWidth={1.75} />
                {entrega}
              </span>
              {loja.pedido_minimo != null && loja.pedido_minimo > 0 && (
                <span className="text-sm text-ink-soft">
                  Pedido mínimo {formatarReal(loja.pedido_minimo)}
                </span>
              )}
            </div>

            {/* Ações */}
            <div className="mt-10 w-full flex flex-col gap-3">
              <Link
                href={`/loja/${loja.slug}`}
                className={[
                  'inline-flex items-center justify-center gap-2',
                  'min-h-[52px] px-6 rounded-md',
                  'bg-brand-500 text-surface font-semibold text-base',
                  'hover:bg-brand-600 active:scale-[0.98]',
                  'transition-all duration-150 ease-out shadow-md',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                ].join(' ')}
              >
                Ver cardápio
                <ArrowRight size={18} strokeWidth={2.25} />
              </Link>

              {temWhats && (
                <a
                  href={linkWhatsApp(loja.whatsapp!, loja.nome)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={[
                    'inline-flex items-center justify-center gap-2',
                    'min-h-[52px] px-6 rounded-md',
                    'bg-surface text-brand-700 font-semibold text-base border border-line',
                    'hover:bg-brand-50 active:scale-[0.98]',
                    'transition-all duration-150 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  ].join(' ')}
                >
                  <MessageCircle size={18} strokeWidth={1.75} />
                  Falar no WhatsApp
                </a>
              )}
            </div>
          </div>
        ) : (
          /* Estado "Em breve" */
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mb-6">
              <Sprout size={30} strokeWidth={1.5} className="text-brand-400" />
            </div>
            <h1 className="text-[28px] font-bold text-ink">Em breve</h1>
            <p className="mt-3 text-ink-soft text-base max-w-[260px] leading-relaxed">
              Nossa loja está sendo preparada com muito carinho. Volte logo!
            </p>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="px-6 pb-8 text-center shrink-0">
        <p className="text-ink-mute text-xs">Delivery fresco, com cuidado 💚</p>
      </div>

    </main>
  )
}
