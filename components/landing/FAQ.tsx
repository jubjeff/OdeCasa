'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const PERGUNTAS = [
  {
    pergunta: 'Preciso pagar comissão por pedido?',
    resposta:
      'Não. O ÔdeCasa cobra apenas uma mensalidade fixa, sem nenhuma taxa sobre os pedidos. Tudo que o cliente paga vai direto pra você.',
  },
  {
    pergunta: 'Funciona pra qualquer tipo de negócio?',
    resposta:
      'Sim. Quitanda, marmita, açaí, hortifrúti, confeitaria, mercadinho — qualquer loja de bairro que queira vender online. Se você vende, a gente te ajuda a digitalizar.',
  },
  {
    pergunta: 'E se eu não souber mexer com tecnologia?',
    resposta:
      'A gente configura com você. O suporte é por WhatsApp, em português, com paciência. Muitos dos nossos clientes nunca tinham criado nada online antes.',
  },
  {
    pergunta: 'Como recebo o pagamento dos pedidos?',
    resposta:
      'Direto do cliente, sem intermediário. Você aceita Pix (com QR Code gerado automaticamente por pedido) ou combina pagamento na entrega. O dinheiro vai pra sua conta.',
  },
  {
    pergunta: 'Meu cliente precisa baixar algum aplicativo?',
    resposta:
      'Não precisa. A loja funciona pelo navegador do celular, sem instalação. É só o cliente clicar no link que você compartilhou.',
  },
]

export function FAQ() {
  const [aberta, setAberta] = useState<number | null>(null)

  return (
    <section className="bg-surface py-20 scroll-mt-24">
      <div className="max-w-3xl mx-auto px-4">

        {/* Cabeçalho */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-brand-500 uppercase tracking-widest mb-3">Dúvidas frequentes</p>
          <h2 className="text-[30px] sm:text-[36px] font-bold text-ink leading-tight">
            Respondendo antes que você pergunte
          </h2>
        </div>

        {/* Accordion */}
        <div className="divide-y divide-line border-t border-b border-line">
          {PERGUNTAS.map((item, i) => {
            const estaAberta = aberta === i
            return (
              <div key={i}>
                <button
                  onClick={() => setAberta(estaAberta ? null : i)}
                  aria-expanded={estaAberta}
                  aria-controls={`faq-resposta-${i}`}
                  className="flex items-center justify-between w-full py-5 text-left gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset rounded"
                >
                  <span className="text-base font-semibold text-ink">{item.pergunta}</span>
                  <ChevronDown
                    size={20}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={[
                      'text-ink-mute shrink-0 transition-transform duration-200',
                      estaAberta ? 'rotate-180' : '',
                    ].join(' ')}
                  />
                </button>
                <div
                  id={`faq-resposta-${i}`}
                  className={[
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    estaAberta ? 'max-h-48 pb-5' : 'max-h-0',
                  ].join(' ')}
                >
                  <p className="text-ink-soft leading-relaxed">{item.resposta}</p>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
