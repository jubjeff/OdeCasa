import { Fragment } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const PASSOS = [
  {
    numero: '01',
    titulo: 'Cadastre sua loja',
    descricao: 'Crie sua conta, informe o nome, endereço e horário de funcionamento. Leva menos de 2 minutos.',
  },
  {
    numero: '02',
    titulo: 'Monte seu cardápio',
    descricao: 'Adicione produtos com foto e preço, organize por categorias e defina sua área de entrega.',
  },
  {
    numero: '03',
    titulo: 'Compartilhe o link',
    descricao: 'Poste no Instagram, mande no grupo do WhatsApp e os pedidos chegam direto no painel.',
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-bg py-20 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-4">

        {/* Cabeçalho */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-brand-500 uppercase tracking-widest mb-3">Como funciona</p>
          <h2 className="text-[30px] sm:text-[36px] font-bold text-ink leading-tight mb-4">
            Do zero à primeira venda em minutos
          </h2>
          <p className="text-ink-soft text-lg leading-relaxed">
            Você não precisa saber nada de tecnologia. Se sabe usar o WhatsApp, você consegue.
          </p>
        </div>

        {/* Passos — desktop: linha com setas; mobile: coluna */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-2">
          {PASSOS.map((passo, i) => (
            <Fragment key={passo.numero}>
              {/* Card do passo */}
              <div className="flex lg:flex-col items-start lg:items-center flex-1 gap-5 lg:gap-0 lg:text-center bg-surface rounded-xl border border-line p-7 hover:shadow-md transition-shadow duration-200">
                <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center shadow-sm shrink-0 lg:mb-5">
                  <span className="text-surface font-bold text-xl">{passo.numero}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink mb-2">{passo.titulo}</h3>
                  <p className="text-ink-soft text-sm leading-relaxed">{passo.descricao}</p>
                </div>
              </div>

              {/* Seta entre passos — só no desktop */}
              {i < PASSOS.length - 1 && (
                <div className="hidden lg:flex items-center self-center shrink-0 px-1 mt-0">
                  <ArrowRight
                    size={22}
                    strokeWidth={1.75}
                    className="text-brand-300"
                    aria-hidden="true"
                  />
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-md bg-brand-500 text-surface font-semibold text-base hover:bg-brand-600 active:scale-[0.98] transition-all duration-150 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Começar agora, é grátis →
          </Link>
        </div>

      </div>
    </section>
  )
}
