import { Button, Column, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { cores, fontePadrao } from './theme'

/* ── Botão CTA "bulletproof" (funciona no Outlook) ───────────────────── */

export function BotaoCTA({ href, children }: { href: string; children: string }) {
  return (
    <Section style={{ textAlign: 'center' as const, padding: '8px 0 4px' }}>
      <Button
        href={href}
        style={{
          backgroundColor: cores.brand500,
          color: cores.surface,
          fontFamily: fontePadrao,
          fontSize: '16px',
          fontWeight: 600,
          textDecoration: 'none',
          textAlign: 'center' as const,
          display: 'inline-block',
          padding: '14px 32px',
          borderRadius: '12px',
        }}
      >
        {children}
      </Button>
    </Section>
  )
}

/* ── Timeline de status do pedido (4 etapas) ─────────────────────────── */

export type StatusPedido = 'recebido' | 'preparando' | 'saiu_entrega' | 'entregue'

const FLUXO: { key: StatusPedido; label: string }[] = [
  { key: 'recebido',     label: 'Recebido' },
  { key: 'preparando',   label: 'Preparando' },
  { key: 'saiu_entrega', label: 'Saiu p/ entrega' },
  { key: 'entregue',     label: 'Entregue' },
]

function Bolinha({ estado }: { estado: 'concluido' | 'ativo' | 'pendente' }) {
  const cor =
    estado === 'pendente' ? cores.line : cores.brand500
  const corTexto = estado === 'pendente' ? cores.inkMute : cores.surface
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      align="center"
      style={{ margin: '0 auto' }}
    >
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
              backgroundColor: cor,
              borderRadius: '14px',
              textAlign: 'center' as const,
              fontFamily: fontePadrao,
              fontSize: '14px',
              fontWeight: 700,
              lineHeight: '28px',
              color: corTexto,
            }}
          >
            {estado === 'concluido' || estado === 'ativo' ? '✓' : '•'}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function Timeline({ statusAtual }: { statusAtual: StatusPedido }) {
  const indiceAtual = FLUXO.findIndex(s => s.key === statusAtual)

  return (
    <Section
      style={{
        backgroundColor: cores.bg,
        borderRadius: '12px',
        padding: '20px 12px',
        margin: '4px 0 24px',
      }}
    >
      <Row>
        {FLUXO.map((etapa, i) => {
          const estado: 'concluido' | 'ativo' | 'pendente' =
            i < indiceAtual ? 'concluido' : i === indiceAtual ? 'ativo' : 'pendente'
          return (
            <Column
              key={etapa.key}
              align="center"
              style={{ width: '25%', verticalAlign: 'top' as const }}
            >
              <Bolinha estado={estado} />
              <Text
                style={{
                  margin: '8px 0 0',
                  fontFamily: fontePadrao,
                  fontSize: '11px',
                  lineHeight: '1.3',
                  fontWeight: estado === 'ativo' ? 700 : 500,
                  color:
                    estado === 'ativo'
                      ? cores.ink
                      : estado === 'concluido'
                        ? cores.inkSoft
                        : cores.inkMute,
                  textAlign: 'center' as const,
                }}
              >
                {etapa.label}
              </Text>
            </Column>
          )
        })}
      </Row>
    </Section>
  )
}
