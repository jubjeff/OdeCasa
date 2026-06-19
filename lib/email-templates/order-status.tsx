import { Link, Section, Text } from '@react-email/components'
import * as React from 'react'
import { BaseLayout } from './BaseLayout'
import { BotaoCTA, Timeline } from './components'
import { cores, fontePadrao } from './theme'

export type StatusNotificavel = 'preparando' | 'saiu_entrega' | 'entregue'

export interface OrderStatusEmailProps {
  nomeCliente: string
  nomeLoja: string
  numeroPedido: string
  statusAtual: StatusNotificavel
  urlPedido: string
  whatsapp?: string
}

/** Mensagem (emoji + título + descrição) específica de cada status. */
const MENSAGENS: Record<StatusNotificavel, { emoji: string; titulo: string; descricao: string }> = {
  preparando: {
    emoji: '👨‍🍳',
    titulo: 'Seu pedido está sendo preparado!',
    descricao: 'A loja já começou a preparar tudo com carinho. Em breve sai para entrega.',
  },
  saiu_entrega: {
    emoji: '🛵',
    titulo: 'Seu pedido saiu para entrega!',
    descricao: 'Já está a caminho do seu endereço. Fique de olho — não vai demorar.',
  },
  entregue: {
    emoji: '🎉',
    titulo: 'Seu pedido foi entregue!',
    descricao: 'Esperamos que aproveite. Obrigado por comprar com a gente!',
  },
}

const hero = { margin: '0 0 4px', fontFamily: fontePadrao, fontSize: '24px', fontWeight: 700, lineHeight: '1.3', color: cores.ink, textAlign: 'center' as const }
const subHero = { margin: '0 0 8px', fontFamily: fontePadrao, fontSize: '15px', lineHeight: '1.6', color: cores.inkSoft, textAlign: 'center' as const }

export function OrderStatusEmail({
  nomeCliente,
  nomeLoja,
  numeroPedido,
  statusAtual,
  urlPedido,
  whatsapp,
}: OrderStatusEmailProps) {
  const msg = MENSAGENS[statusAtual]

  return (
    <BaseLayout
      preheader={`${msg.titulo} Pedido #${numeroPedido} em ${nomeLoja}.`}
      mostrarDescadastro
      urlDescadastro="#"
    >
      {/* Emoji hero */}
      <Section style={{ textAlign: 'center' as const }}>
        <Text style={{ margin: '0 0 8px', fontSize: '44px', lineHeight: '1', textAlign: 'center' as const }}>
          {msg.emoji}
        </Text>
      </Section>
      <Text style={hero}>{msg.titulo}</Text>
      <Text style={subHero}>
        Olá, {nomeCliente}. Novidades sobre o seu pedido{' '}
        <strong style={{ color: cores.ink }}>#{numeroPedido}</strong> em{' '}
        <strong style={{ color: cores.ink }}>{nomeLoja}</strong>.
      </Text>
      <Text style={{ ...subHero, marginBottom: '20px' }}>{msg.descricao}</Text>

      {/* Timeline com a etapa atual destacada dinamicamente */}
      <Timeline statusAtual={statusAtual} />

      <BotaoCTA href={urlPedido}>Acompanhar pedido</BotaoCTA>

      {whatsapp && (
        <Section
          style={{
            marginTop: '24px',
            backgroundColor: cores.brand50,
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          <Text style={{ margin: '0', fontFamily: fontePadrao, fontSize: '14px', lineHeight: '1.6', color: cores.inkSoft }}>
            Alguma dúvida? Fale com a loja no{' '}
            <Link
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              style={{ color: cores.brand600, fontWeight: 600, textDecoration: 'underline' }}
            >
              WhatsApp
            </Link>
            .
          </Text>
        </Section>
      )}
    </BaseLayout>
  )
}

OrderStatusEmail.PreviewProps = {
  nomeCliente: 'Maria',
  nomeLoja: 'Hortifruti do Zé',
  numeroPedido: '1042',
  statusAtual: 'saiu_entrega',
  urlPedido: 'https://odecasa.com.br/conta',
  whatsapp: '5581996393807',
} satisfies OrderStatusEmailProps

export default OrderStatusEmail
