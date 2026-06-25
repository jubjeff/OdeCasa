import { Text } from '@react-email/components'
import * as React from 'react'
import { BaseLayout } from './BaseLayout'
import { BotaoCTA } from './components'
import { cores, fontePadrao } from './theme'

export interface ConfirmacaoContaEmailProps {
  nomeDestinatario: string
  urlConfirmacao: string
}

const titulo = { margin: '0 0 12px', fontFamily: fontePadrao, fontSize: '24px', fontWeight: 700, lineHeight: '1.3', color: cores.ink }
const paragrafo = { margin: '0 0 16px', fontFamily: fontePadrao, fontSize: '16px', lineHeight: '1.6', color: cores.inkSoft }

export function ConfirmacaoContaEmail({ nomeDestinatario, urlConfirmacao }: ConfirmacaoContaEmailProps) {
  return (
    <BaseLayout preheader="Confirme seu endereço de e-mail para acessar o ÔdeCasa.">
      <Text style={titulo}>Confirme seu e-mail</Text>
      <Text style={paragrafo}>
        Olá, {nomeDestinatario}! Clique no botão abaixo para confirmar seu endereço de e-mail e
        concluir o cadastro no ÔdeCasa.
      </Text>

      <BotaoCTA href={urlConfirmacao}>Confirmar e-mail</BotaoCTA>

      <Text style={{ margin: '20px 0 0', fontFamily: fontePadrao, fontSize: '13px', lineHeight: '1.6', color: cores.inkMute }}>
        Se não foi você quem criou esta conta, pode ignorar este e-mail com segurança.
        <br /><br />
        Se o botão não funcionar, copie e cole este endereço no navegador:{' '}
        <span style={{ color: cores.brand600, wordBreak: 'break-all' as const }}>{urlConfirmacao}</span>
      </Text>
    </BaseLayout>
  )
}

ConfirmacaoContaEmail.PreviewProps = {
  nomeDestinatario: 'Jefferson',
  urlConfirmacao: 'https://odecasa.store/auth/confirm?token=exemplo-abc123',
} satisfies ConfirmacaoContaEmailProps

export default ConfirmacaoContaEmail
