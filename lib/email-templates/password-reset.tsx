import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { BaseLayout } from './BaseLayout'
import { BotaoCTA } from './components'
import { cores, fontePadrao } from './theme'

export interface PasswordResetEmailProps {
  nomeDestinatario: string
  urlReset: string
  /** Texto legível do prazo de expiração (ex: "1 hora", "30 minutos"). */
  expiraEm: string
}

const titulo = { margin: '0 0 12px', fontFamily: fontePadrao, fontSize: '24px', fontWeight: 700, lineHeight: '1.3', color: cores.ink }
const paragrafo = { margin: '0 0 16px', fontFamily: fontePadrao, fontSize: '16px', lineHeight: '1.6', color: cores.inkSoft }

export function PasswordResetEmail({
  nomeDestinatario,
  urlReset,
  expiraEm,
}: PasswordResetEmailProps) {
  return (
    // E-mail transacional de segurança: SEM link de descadastro.
    <BaseLayout preheader="Redefinição de senha do seu acesso ÔdeCasa.">
      <Text style={titulo}>Redefinição de senha</Text>
      <Text style={paragrafo}>
        Olá, {nomeDestinatario}. Recebemos um pedido para redefinir a senha da sua conta no
        ÔdeCasa. Clique no botão abaixo para criar uma nova senha.
      </Text>

      <BotaoCTA href={urlReset}>Redefinir senha</BotaoCTA>

      <Section
        style={{
          marginTop: '24px',
          backgroundColor: cores.bg,
          borderRadius: '12px',
          padding: '16px 20px',
        }}
      >
        <Text style={{ margin: '0 0 8px', fontFamily: fontePadrao, fontSize: '14px', lineHeight: '1.6', color: cores.inkSoft }}>
          ⏱️ Por segurança, este link expira em <strong style={{ color: cores.ink }}>{expiraEm}</strong>.
        </Text>
        <Text style={{ margin: '0', fontFamily: fontePadrao, fontSize: '14px', lineHeight: '1.6', color: cores.inkSoft }}>
          🔒 Se não foi você quem solicitou, pode ignorar este e-mail com segurança — sua senha
          atual continua valendo e nada será alterado.
        </Text>
      </Section>

      <Text style={{ margin: '20px 0 0', fontFamily: fontePadrao, fontSize: '13px', lineHeight: '1.6', color: cores.inkMute }}>
        Se o botão não funcionar, copie e cole este endereço no navegador:
        <br />
        <span style={{ color: cores.brand600, wordBreak: 'break-all' as const }}>{urlReset}</span>
      </Text>
    </BaseLayout>
  )
}

PasswordResetEmail.PreviewProps = {
  nomeDestinatario: 'Jefferson',
  urlReset: 'https://odecasa.com.br/redefinir-senha?token=exemplo-abc123',
  expiraEm: '1 hora',
} satisfies PasswordResetEmailProps

export default PasswordResetEmail
