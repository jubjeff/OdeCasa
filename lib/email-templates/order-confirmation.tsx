import { Hr, Link, Section, Text } from '@react-email/components'
import * as React from 'react'
import { BaseLayout } from './BaseLayout'
import { BotaoCTA, Timeline } from './components'
import { cores, fontePadrao, formatarReal } from './theme'

export interface ItemPedido {
  nome: string
  quantidade: number
  subtotal: number
}

export interface OrderConfirmationEmailProps {
  nomeCliente: string
  nomeLoja: string
  numeroPedido: string
  itens: ItemPedido[]
  taxaEntrega: number
  total: number
  urlPedido: string
  whatsapp?: string
}

const hero = { margin: '0 0 4px', fontFamily: fontePadrao, fontSize: '24px', fontWeight: 700, lineHeight: '1.3', color: cores.ink, textAlign: 'center' as const }
const subHero = { margin: '0 0 20px', fontFamily: fontePadrao, fontSize: '15px', lineHeight: '1.6', color: cores.inkSoft, textAlign: 'center' as const }
const tdItem = { padding: '10px 0', fontFamily: fontePadrao, fontSize: '15px', lineHeight: '1.4', color: cores.ink, borderBottom: `1px solid ${cores.line}`, verticalAlign: 'top' as const }
const tdValor = { ...tdItem, textAlign: 'right' as const, whiteSpace: 'nowrap' as const, fontWeight: 600 }
const tdResumo = { padding: '6px 0', fontFamily: fontePadrao, fontSize: '15px', color: cores.inkSoft }
const tdResumoValor = { ...tdResumo, textAlign: 'right' as const, color: cores.ink, fontWeight: 600 }

export function OrderConfirmationEmail({
  nomeCliente,
  nomeLoja,
  numeroPedido,
  itens,
  taxaEntrega,
  total,
  urlPedido,
  whatsapp,
}: OrderConfirmationEmailProps) {
  return (
    <BaseLayout
      preheader={`Pedido #${numeroPedido} confirmado em ${nomeLoja}. Já estamos cuidando de tudo!`}
      mostrarDescadastro
      urlDescadastro="#"
    >
      {/* Hero */}
      <Section style={{ textAlign: 'center' as const, marginBottom: '4px' }}>
        <table role="presentation" cellPadding={0} cellSpacing={0} align="center" style={{ margin: '0 auto 16px' }}>
          <tbody>
            <tr>
              <td
                align="center"
                valign="middle"
                width={56}
                height={56}
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: cores.brand100,
                  borderRadius: '28px',
                  fontSize: '28px',
                  lineHeight: '56px',
                  textAlign: 'center' as const,
                  color: cores.brand600,
                }}
              >
                ✓
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
      <Text style={hero}>Pedido confirmado!</Text>
      <Text style={subHero}>
        Olá, {nomeCliente}. Recebemos seu pedido <strong style={{ color: cores.ink }}>#{numeroPedido}</strong> em{' '}
        <strong style={{ color: cores.ink }}>{nomeLoja}</strong>.
      </Text>

      {/* Timeline — etapa inicial: recebido */}
      <Timeline statusAtual="recebido" />

      {/* Itens */}
      <Text style={{ margin: '0 0 4px', fontFamily: fontePadrao, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: cores.inkMute }}>
        Resumo do pedido
      </Text>
      <table role="presentation" cellPadding={0} cellSpacing={0} width="100%">
        <tbody>
          {itens.map((item, i) => (
            <tr key={i}>
              <td style={tdItem}>
                <span style={{ color: cores.inkMute, fontWeight: 600 }}>{item.quantidade}×</span> {item.nome}
              </td>
              <td style={tdValor}>{formatarReal(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totais */}
      <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ marginTop: '12px' }}>
        <tbody>
          <tr>
            <td style={tdResumo}>Taxa de entrega</td>
            <td style={tdResumoValor}>
              {taxaEntrega === 0 ? 'Grátis' : formatarReal(taxaEntrega)}
            </td>
          </tr>
        </tbody>
      </table>
      <Hr style={{ borderColor: cores.line, margin: '8px 0' }} />
      <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ marginBottom: '24px' }}>
        <tbody>
          <tr>
            <td style={{ fontFamily: fontePadrao, fontSize: '17px', fontWeight: 700, color: cores.ink }}>Total</td>
            <td style={{ fontFamily: fontePadrao, fontSize: '20px', fontWeight: 700, color: cores.brand700, textAlign: 'right' as const }}>
              {formatarReal(total)}
            </td>
          </tr>
        </tbody>
      </table>

      <BotaoCTA href={urlPedido}>Acompanhar pedido</BotaoCTA>

      {/* Ajuda */}
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
            Precisa de ajuda com seu pedido? Fale com a loja no{' '}
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

OrderConfirmationEmail.PreviewProps = {
  nomeCliente: 'Maria',
  nomeLoja: 'Hortifruti do Zé',
  numeroPedido: '1042',
  itens: [
    { nome: 'Banana prata (kg)', quantidade: 2, subtotal: 11.8 },
    { nome: 'Tomate italiano (kg)', quantidade: 1, subtotal: 8.5 },
    { nome: 'Alface crespa (un.)', quantidade: 3, subtotal: 9.0 },
  ],
  taxaEntrega: 6,
  total: 35.3,
  urlPedido: 'https://odecasa.com.br/conta',
  whatsapp: '5581996393807',
} satisfies OrderConfirmationEmailProps

export default OrderConfirmationEmail
