import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { BaseLayout } from './BaseLayout'
import { BotaoCTA } from './components'
import { cores, fontePadrao } from './theme'

export interface WelcomeEmailProps {
  nomeDono: string
  nomeLoja: string
  urlPainel: string
}

const titulo = { margin: '0 0 12px', fontFamily: fontePadrao, fontSize: '24px', fontWeight: 700, lineHeight: '1.3', color: cores.ink }
const paragrafo = { margin: '0 0 16px', fontFamily: fontePadrao, fontSize: '16px', lineHeight: '1.6', color: cores.inkSoft }
const passoTexto = { margin: '0', fontFamily: fontePadrao, fontSize: '15px', lineHeight: '1.5', color: cores.ink }

function Passo({ numero, children }: { numero: number; children: React.ReactNode }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ marginBottom: '12px' }}>
      <tbody>
        <tr>
          <td valign="top" width={36} style={{ width: '36px' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td
                    align="center"
                    valign="middle"
                    width={28}
                    height={28}
                    style={{
                      width: '28px',
                      height: '28px',
                      backgroundColor: cores.brand100,
                      borderRadius: '14px',
                      fontFamily: fontePadrao,
                      fontSize: '14px',
                      fontWeight: 700,
                      lineHeight: '28px',
                      color: cores.brand700,
                      textAlign: 'center' as const,
                    }}
                  >
                    {numero}
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
          <td valign="middle">
            <Text style={passoTexto}>{children}</Text>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function WelcomeEmail({ nomeDono, nomeLoja, urlPainel }: WelcomeEmailProps) {
  return (
    <BaseLayout
      preheader={`Bem-vindo ao ÔdeCasa, ${nomeDono}! Sua loja ${nomeLoja} já pode começar a vender.`}
      mostrarDescadastro
      urlDescadastro="#"
    >
      <Text style={titulo}>
        Boas-vindas e boas-vendas, {nomeDono}! 🎉
      </Text>
      <Text style={paragrafo}>
        A loja <strong style={{ color: cores.ink }}>{nomeLoja}</strong> foi criada com sucesso no
        ÔdeCasa. Agora é com você: monte seu cardápio e comece a receber pedidos direto dos seus
        clientes, sem comissão por pedido.
      </Text>

      <Text style={{ ...paragrafo, fontWeight: 600, color: cores.ink, marginBottom: '12px' }}>
        Seus próximos passos:
      </Text>

      <Section style={{ marginBottom: '8px' }}>
        <Passo numero={1}>
          Crie as <strong>categorias</strong> do seu cardápio (ex: Bebidas, Pratos, Sobremesas).
        </Passo>
        <Passo numero={2}>
          Cadastre seus <strong>produtos</strong> com foto, preço e unidade.
        </Passo>
        <Passo numero={3}>
          Compartilhe o link da sua loja e comece a <strong>vender</strong>.
        </Passo>
      </Section>

      <BotaoCTA href={urlPainel}>Ir para o painel</BotaoCTA>
    </BaseLayout>
  )
}

WelcomeEmail.PreviewProps = {
  nomeDono: 'Jefferson',
  nomeLoja: 'Jeff Store',
  urlPainel: 'https://odecasa.com.br/painel',
} satisfies WelcomeEmailProps

export default WelcomeEmail
