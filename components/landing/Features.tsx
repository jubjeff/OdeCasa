import {
  UtensilsCrossed, MessageCircle, LayoutDashboard,
  MapPin, QrCode, Globe,
} from 'lucide-react'

const FEATURES = [
  {
    icon: UtensilsCrossed,
    titulo: 'Cardápio digital',
    descricao: 'Monte seus produtos com foto, descrição, categoria e controle de estoque. Seu cliente navega igual num app.',
  },
  {
    icon: MessageCircle,
    titulo: 'Pedidos pelo WhatsApp',
    descricao: 'Receba aviso direto no seu celular a cada novo pedido. Sem depender de terceiros.',
  },
  {
    icon: LayoutDashboard,
    titulo: 'Painel de gestão',
    descricao: 'Kanban de pedidos, faturamento do dia, ticket médio e status em tempo real. Tudo numa tela só.',
  },
  {
    icon: MapPin,
    titulo: 'Entrega por distância',
    descricao: 'Define o raio de entrega e a taxa é calculada automaticamente pelo endereço do cliente.',
  },
  {
    icon: QrCode,
    titulo: 'Pix integrado',
    descricao: 'QR Code gerado por pedido. O cliente paga direto pra você, sem intermediário e sem taxa.',
  },
  {
    icon: Globe,
    titulo: 'Sua marca, seu link',
    descricao: 'Loja com a cara do seu negócio e link próprio. Compartilha no Instagram, WhatsApp, onde quiser.',
  },
]

export function Features() {
  return (
    <section id="funcionalidades" className="bg-surface py-20 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4">

        {/* Cabeçalho */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-brand-500 uppercase tracking-widest mb-3">Funcionalidades</p>
          <h2 className="text-[30px] sm:text-[36px] font-bold text-ink leading-tight mb-4">
            Tudo que você precisa para vender online
          </h2>
          <p className="text-ink-soft text-lg leading-relaxed">
            Ferramentas pensadas para dono de negócio de bairro, não para grandes redes.
          </p>
        </div>

        {/* Grid de cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icone, titulo, descricao }) => (
            <div
              key={titulo}
              className="bg-bg rounded-xl p-6 border border-line hover:border-brand-200 hover:shadow-md transition-all duration-200 group"
            >
              <div className="w-11 h-11 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors duration-200">
                <Icone
                  size={20}
                  strokeWidth={1.75}
                  className="text-brand-500"
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-base font-semibold text-ink mb-2">{titulo}</h3>
              <p className="text-sm text-ink-soft leading-relaxed">{descricao}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
