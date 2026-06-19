import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-bg pt-16 pb-20 lg:pt-24 lg:pb-32">
      {/* Gradiente de fundo sutil */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50/60 via-transparent to-transparent" />

      <div className="relative max-w-6xl mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* ── Conteúdo ─── */}
          <div className="flex-1 text-center lg:text-left max-w-2xl mx-auto lg:mx-0">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-700 text-sm font-semibold rounded-full px-4 py-1.5 mb-7">
              <span aria-hidden="true">🌿</span>
              Sem comissão por pedido
            </div>

            {/* H1 */}
            <h1 className="text-[38px] sm:text-[46px] lg:text-[54px] font-bold text-ink leading-[1.12] tracking-tight mb-5">
              Seu delivery,{' '}
              <span className="text-brand-500">do seu jeito.</span>
              <br />
              Direto com o cliente.
            </h1>

            {/* Subtítulo */}
            <p className="text-lg text-ink-soft leading-relaxed mb-9 max-w-[480px] mx-auto lg:mx-0">
              Crie a página da sua loja, receba pedidos e gerencie tudo num
              painel feito pra dono de negócio de bairro. Sem comissão.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-7">
              <Link
                href="/cadastro"
                className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-md bg-brand-500 text-surface font-semibold text-base hover:bg-brand-600 active:scale-[0.98] transition-all duration-150 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                Criar minha loja grátis →
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-md border border-line bg-surface text-brand-700 font-semibold text-base hover:bg-brand-50 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Ver como funciona
              </a>
            </div>

            {/* Linha de confiança */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span className="text-brand-500 font-bold">✓</span> Sem cartão de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-brand-500 font-bold">✓</span> Pronto em 5 minutos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-brand-500 font-bold">✓</span> Suporte em português
              </span>
            </div>
          </div>

          {/* ── Mockup de celular ─── */}
          <div className="hidden lg:block relative shrink-0">
            <div className="relative w-[270px]">

              {/* Frame do celular */}
              <div className="w-[270px] h-[540px] rounded-[2.25rem] bg-ink overflow-hidden shadow-2xl border-[7px] border-ink ring-2 ring-brand-200/20">
                {/* Conteúdo da tela */}
                <div className="w-full h-full bg-bg flex flex-col text-[10px]">

                  {/* TopBar falsa */}
                  <div className="bg-surface border-b border-line px-3 py-2.5 flex items-center gap-2 shrink-0">
                    <div className="w-7 h-7 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center shrink-0">
                      <span className="text-brand-700 font-bold" style={{ fontSize: '8px' }}>HV</span>
                    </div>
                    <span className="font-semibold text-ink flex-1">Hortifrúti Verde</span>
                    <div className="w-7 h-7 flex items-center justify-center">
                      <ShoppingCart size={13} strokeWidth={1.75} className="text-ink" />
                    </div>
                  </div>

                  {/* Categorias falsas */}
                  <div className="bg-surface border-b border-line px-3 py-2 flex gap-2 shrink-0">
                    {['Tudo', 'Frutas', 'Legumes', 'Orgânicos'].map((c, i) => (
                      <span
                        key={c}
                        className={[
                          'rounded-full px-2.5 py-0.5 text-[9px] font-semibold whitespace-nowrap',
                          i === 0 ? 'bg-brand-100 text-brand-700' : 'bg-bg border border-line text-ink-soft',
                        ].join(' ')}
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Produtos falsos */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    {[
                      { nome: 'Cesta Orgânica', preco: 'R$ 28,90', cor: 'brand-100' },
                      { nome: 'Mamão Formosa',  preco: 'R$ 12,50', cor: 'brand-50'  },
                      { nome: 'Cenoura Baby',   preco: 'R$ 8,90',  cor: 'brand-100' },
                      { nome: 'Tomate Grape',   preco: 'R$ 9,90',  cor: 'brand-50'  },
                    ].map((p) => (
                      <div key={p.nome} className="flex items-center gap-2.5 px-3 py-2 border-b border-line">
                        <div className={`w-10 h-10 rounded-lg bg-${p.cor} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-ink leading-tight">{p.nome}</p>
                          <p className="text-brand-700 font-bold mt-0.5">{p.preco}</p>
                        </div>
                        <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                          <span className="text-surface font-bold" style={{ fontSize: '10px', lineHeight: 1 }}>+</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Barra do carrinho */}
                  <div className="mx-3 mb-3 mt-auto">
                    <div className="bg-brand-500 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-surface font-semibold">Ver carrinho (2)</span>
                      <span className="text-surface font-bold">R$ 41,40</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Card flutuante — novo pedido */}
              <div className="animate-float absolute -right-16 top-14 bg-surface rounded-2xl shadow-lg border border-line p-3 min-w-[160px]">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl" aria-hidden="true">🛵</span>
                  <div>
                    <p className="text-xs font-semibold text-ink leading-tight">Novo pedido</p>
                    <p className="text-sm font-bold text-brand-700">R$ 47,80</p>
                  </div>
                </div>
              </div>

              {/* Card flutuante — avaliação */}
              <div className="animate-float-delayed absolute -left-16 bottom-28 bg-surface rounded-2xl shadow-lg border border-line p-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl" aria-hidden="true">⭐</span>
                  <div>
                    <p className="text-xs font-semibold text-ink leading-tight">Avaliação</p>
                    <p className="text-sm font-bold text-brand-700">5,0 ★★★★★</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
