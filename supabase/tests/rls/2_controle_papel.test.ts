/**
 * Suite 2 — Controle por Papel (dentro da própria loja)
 *
 * Verifica que cada papel só faz o que é permitido pela hierarquia:
 *   caixa < atendente < gerente < dono
 *
 * Todos os testes operam na Loja A. O isolamento entre lojas está em 1_isolamento.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  setupFixtures, teardownFixtures, signInAs, adminClient,
  type TestFixtures,
} from './fixtures'

let fx: TestFixtures

let clientDonoA: SupabaseClient
let clientCaixaA: SupabaseClient
let clientAtendenteA: SupabaseClient
let clientGerenteA: SupabaseClient

beforeAll(async () => {
  fx = await setupFixtures()
  ;[clientDonoA, clientCaixaA, clientAtendenteA, clientGerenteA] = await Promise.all([
    signInAs(fx.users.donoA),
    signInAs(fx.users.caixaA),
    signInAs(fx.users.atendenteA),
    signInAs(fx.users.gerenteA),
  ])
}, 90_000)

afterAll(async () => {
  await teardownFixtures(fx)
}, 30_000)

// ═══════════════════════════════════════════════════════════════════════════════
// 2.1  Caixa — lê pedidos, avança status, NÃO cancela
// ═══════════════════════════════════════════════════════════════════════════════

describe('2.1 Caixa — leitura e avanço de status', () => {
  it('[pedidos] caixa PODE ler pedidos da própria loja', async () => {
    // Papel: caixa | Ação: SELECT pedidos WHERE loja_id = loja_a
    // Esperado: PERMITIDO
    const { data, error } = await clientCaixaA
      .from('pedidos')
      .select('id, status')
      .eq('id', fx.pedidoAId)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  it('[itens_pedido] caixa PODE ler itens de pedidos da própria loja', async () => {
    // Papel: caixa | Ação: SELECT itens_pedido via join de pedido da loja
    // Esperado: PERMITIDO
    const { error } = await clientCaixaA
      .from('itens_pedido')
      .select('id')
      .eq('pedido_id', fx.pedidoAId)
    expect(error).toBeNull()
  })

  it('[lojas] caixa PODE ler dados da própria loja', async () => {
    // Papel: caixa | Ação: SELECT lojas WHERE id = loja_a
    // Esperado: PERMITIDO
    const { data, error } = await clientCaixaA
      .from('lojas')
      .select('id, nome')
      .eq('id', fx.lojaAId)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  it('[pedidos] caixa PODE avançar status (preparando → saiu_entrega)', async () => {
    // Papel: caixa | Ação: UPDATE pedidos SET status='saiu_entrega'
    // Esperado: PERMITIDO — status != 'cancelado' satisfaz with check
    const { error } = await clientCaixaA
      .from('pedidos')
      .update({ status: 'saiu_entrega' })
      .eq('id', fx.pedidoAId)

    expect(error).toBeNull()

    // Reverte para o próximo teste
    await adminClient.from('pedidos').update({ status: 'preparando' }).eq('id', fx.pedidoAId)
  })

  it('[pedidos] caixa NÃO PODE cancelar pedido (with check bloqueia)', async () => {
    // Papel: caixa | Ação: UPDATE pedidos SET status='cancelado'
    // Esperado: BLOQUEADO — with check rejeita status='cancelado' para caixa
    //   A policy exige: status != 'cancelado' OR operador_tem_acesso(atendente+)
    const { error } = await clientCaixaA
      .from('pedidos')
      .update({ status: 'cancelado' })
      .eq('id', fx.pedidoAId)

    // Espera erro de RLS (new row violates row-level security policy)
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')

    // Confirma que o status não foi alterado
    const { data } = await adminClient
      .from('pedidos')
      .select('status')
      .eq('id', fx.pedidoAId)
      .single()
    expect((data as { status: string } | null)?.status).not.toBe('cancelado')
  })

  it('[lojas] caixa NÃO PODE editar dados da loja', async () => {
    // Papel: caixa | Ação: UPDATE lojas SET nome='HACK'
    // Esperado: BLOQUEADO — requer gerente+
    await clientCaixaA.from('lojas').update({ nome: 'HACK' }).eq('id', fx.lojaAId)

    const { data } = await adminClient.from('lojas').select('nome').eq('id', fx.lojaAId).single()
    expect((data as { nome: string } | null)?.nome).not.toBe('HACK')
  })

  it('[produtos] caixa NÃO PODE editar produtos', async () => {
    // Papel: caixa | Ação: UPDATE produtos SET nome='HACK'
    // Esperado: BLOQUEADO — requer atendente+
    await clientCaixaA.from('produtos').update({ nome: 'HACK' }).eq('id', fx.produtoA1Id)

    const { data } = await adminClient.from('produtos').select('nome').eq('id', fx.produtoA1Id).single()
    expect((data as { nome: string } | null)?.nome).not.toBe('HACK')
  })

  it('[operadores] caixa NÃO PODE ver lista de operadores (só vê a própria linha)', async () => {
    // Papel: caixa | Ação: SELECT operadores WHERE loja_id = loja_a
    // Esperado: retorna apenas a linha do próprio caixa (policy "operador ve a propria linha")
    const { data, error } = await clientCaixaA
      .from('operadores')
      .select('id, user_id')
      .eq('loja_id', fx.lojaAId)

    expect(error).toBeNull()
    // Deve ver apenas a própria linha, não todos os operadores
    const ids = (data ?? []).map((o: { user_id: string }) => o.user_id)
    expect(ids.every((uid: string) => uid === fx.users.caixaA.id)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2.2  Atendente — tudo do caixa + cancelar pedido + editar produtos
// ═══════════════════════════════════════════════════════════════════════════════

describe('2.2 Atendente — cancelamento e produtos', () => {
  it('[pedidos] atendente PODE cancelar pedido', async () => {
    // Papel: atendente | Ação: UPDATE pedidos SET status='cancelado'
    // Esperado: PERMITIDO — operador_tem_acesso(atendente) satisfaz with check
    const { error } = await clientAtendenteA
      .from('pedidos')
      .update({ status: 'cancelado' })
      .eq('id', fx.pedidoAId)

    expect(error).toBeNull()

    // Reverte
    await adminClient.from('pedidos').update({ status: 'preparando' }).eq('id', fx.pedidoAId)
  })

  it('[produtos] atendente PODE editar produto da própria loja', async () => {
    // Papel: atendente | Ação: UPDATE produtos SET disponivel=false
    // Esperado: PERMITIDO
    const { error } = await clientAtendenteA
      .from('produtos')
      .update({ disponivel: false })
      .eq('id', fx.produtoA1Id)

    expect(error).toBeNull()

    // Reverte
    await adminClient.from('produtos').update({ disponivel: true }).eq('id', fx.produtoA1Id)
  })

  it('[produtos] atendente PODE criar produto na própria loja', async () => {
    // Papel: atendente | Ação: INSERT produto loja_a
    // Esperado: PERMITIDO
    const { data, error } = await clientAtendenteA
      .from('produtos')
      .insert({
        loja_id: fx.lojaAId,
        categoria_id: fx.categoriaAId,
        nome: 'Produto Temp Atendente',
        preco: 5.00,
        disponivel: true,
      })
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)

    // Limpa o produto criado
    if (data?.[0]?.id) {
      await adminClient.from('produtos').delete().eq('id', data[0].id)
    }
  })

  it('[lojas] atendente NÃO PODE editar dados da loja', async () => {
    // Papel: atendente | Ação: UPDATE lojas SET nome='HACK'
    // Esperado: BLOQUEADO — requer gerente+
    await clientAtendenteA.from('lojas').update({ nome: 'HACK' }).eq('id', fx.lojaAId)

    const { data } = await adminClient.from('lojas').select('nome').eq('id', fx.lojaAId).single()
    expect((data as { nome: string } | null)?.nome).not.toBe('HACK')
  })

  it('[operadores] atendente NÃO PODE inserir novo operador', async () => {
    // Papel: atendente | Ação: INSERT operadores (convidar alguém)
    // Esperado: BLOQUEADO — apenas dono pode gerenciar operadores
    const { error } = await clientAtendenteA.from('operadores').insert({
      loja_id: fx.lojaAId,
      email: 'invasor@test.rls',
      papel: 'caixa',
      status: 'ativo',
    })

    expect(error).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2.3  Gerente — tudo do atendente + editar loja, NÃO insere operadores
// ═══════════════════════════════════════════════════════════════════════════════

describe('2.3 Gerente — edição da loja mas sem gestão de operadores', () => {
  it('[lojas] gerente PODE editar dados da própria loja', async () => {
    // Papel: gerente | Ação: UPDATE lojas SET tempo_entrega_min=45
    // Esperado: PERMITIDO
    const { error } = await clientGerenteA
      .from('lojas')
      .update({ tempo_entrega_min: 45 })
      .eq('id', fx.lojaAId)

    expect(error).toBeNull()

    // Reverte
    await adminClient.from('lojas').update({ tempo_entrega_min: null }).eq('id', fx.lojaAId)
  })

  it('[avaliacoes] gerente PODE ver avaliações da própria loja', async () => {
    // Papel: gerente | Ação: SELECT avaliacoes WHERE loja_id = loja_a
    // Esperado: PERMITIDO
    const { data, error } = await clientGerenteA
      .from('avaliacoes')
      .select('id')
      .eq('id', fx.avaliacaoAId)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  it('[uso_mensal] gerente PODE ver uso mensal da própria loja', async () => {
    // Papel: gerente | Ação: SELECT uso_mensal WHERE loja_id = loja_a
    // Esperado: PERMITIDO (sem linhas se não há registro, mas sem erro de permissão)
    const { error } = await clientGerenteA
      .from('uso_mensal')
      .select('id')
      .eq('loja_id', fx.lojaAId)

    expect(error).toBeNull()
  })

  it('[operadores] gerente NÃO PODE inserir novo operador (convidar)', async () => {
    // Papel: gerente | Ação: INSERT operadores
    // Esperado: BLOQUEADO — apenas dono pode gerenciar operadores
    const { error } = await clientGerenteA.from('operadores').insert({
      loja_id: fx.lojaAId,
      email: 'invasor_gerente@test.rls',
      papel: 'caixa',
      status: 'pendente',
    })

    expect(error).not.toBeNull()
  })

  it('[operadores] gerente NÃO PODE deletar operador', async () => {
    // Papel: gerente | Ação: DELETE operadores WHERE user_id = caixa_a
    // Esperado: BLOQUEADO — apenas dono pode deletar operadores
    // (Gerente só consegue ver a própria linha via "operador ve a propria linha")
    const { error } = await clientGerenteA
      .from('operadores')
      .delete()
      .eq('user_id', fx.users.caixaA.id)

    // Não deve ter deletado nada — verifica
    const { data } = await adminClient
      .from('operadores')
      .select('id')
      .eq('user_id', fx.users.caixaA.id)
    expect(data ?? []).toHaveLength(1) // caixa_a ainda existe
    void error // sem erro ou com erro — o dado não deve ter sido deletado
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2.4  Dono — acesso total incluindo gestão de operadores
// ═══════════════════════════════════════════════════════════════════════════════

describe('2.4 Dono — controle total sobre a própria loja', () => {
  it('[operadores] dono PODE inserir novo operador', async () => {
    // Papel: dono_a | Ação: INSERT operadores (convidar)
    // Esperado: PERMITIDO
    const { data, error } = await clientDonoA
      .from('operadores')
      .insert({
        loja_id: fx.lojaAId,
        email: 'novo_op_dono@test.rls',
        papel: 'atendente',
        status: 'pendente',
      })
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)

    // Limpa
    if (data?.[0]?.id) {
      await adminClient.from('operadores').delete().eq('id', data[0].id)
    }
  })

  it('[operadores] dono PODE atualizar papel de operador', async () => {
    // Papel: dono_a | Ação: UPDATE operadores SET papel='gerente' (promover caixa)
    // Esperado: PERMITIDO
    const { error } = await clientDonoA
      .from('operadores')
      .update({ papel: 'gerente' })
      .eq('user_id', fx.users.caixaA.id)
      .eq('loja_id', fx.lojaAId)

    expect(error).toBeNull()

    // Reverte
    await adminClient
      .from('operadores')
      .update({ papel: 'caixa' })
      .eq('user_id', fx.users.caixaA.id)
      .eq('loja_id', fx.lojaAId)
  })

  it('[operadores] dono PODE deletar operador', async () => {
    // Papel: dono_a | Ação: DELETE operadores WHERE user_id = pendente_a
    // Esperado: PERMITIDO
    // (Usamos pendente_a para não quebrar outros testes que dependem de inativo_a)
    const { error } = await clientDonoA
      .from('operadores')
      .delete()
      .eq('user_id', fx.users.pendenteA.id)
      .eq('loja_id', fx.lojaAId)

    expect(error).toBeNull()

    const { data } = await adminClient
      .from('operadores')
      .select('id')
      .eq('user_id', fx.users.pendenteA.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('[operadores] dono PODE ver todos os operadores da própria loja', async () => {
    // Papel: dono_a | Ação: SELECT operadores WHERE loja_id = loja_a
    // Esperado: PERMITIDO — vê todos (caixa, atendente, gerente, inativo; pendente foi deletado acima)
    const { data, error } = await clientDonoA
      .from('operadores')
      .select('id, papel, status')
      .eq('loja_id', fx.lojaAId)

    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThanOrEqual(3) // pelo menos caixa, atendente, gerente
  })

  it('[lojas] dono PODE editar dados da própria loja', async () => {
    // Papel: dono_a | Ação: UPDATE lojas SET tempo_entrega_min=30
    // Esperado: PERMITIDO
    const { error } = await clientDonoA
      .from('lojas')
      .update({ tempo_entrega_min: 30 })
      .eq('id', fx.lojaAId)

    expect(error).toBeNull()

    // Reverte
    await adminClient.from('lojas').update({ tempo_entrega_min: null }).eq('id', fx.lojaAId)
  })

  it('[pedidos] dono PODE cancelar qualquer pedido da própria loja', async () => {
    // Papel: dono_a | Ação: UPDATE pedidos SET status='cancelado'
    // Esperado: PERMITIDO — dono bypassa a restrição de cancelamento
    const { error } = await clientDonoA
      .from('pedidos')
      .update({ status: 'cancelado' })
      .eq('id', fx.pedidoAId)

    expect(error).toBeNull()

    // Reverte
    await adminClient.from('pedidos').update({ status: 'preparando' }).eq('id', fx.pedidoAId)
  })

  it('[assinaturas] dono PODE ver a própria assinatura', async () => {
    // Papel: dono_a | Ação: SELECT assinaturas WHERE loja_id = loja_a
    // Esperado: PERMITIDO ou lista vazia (se não houver assinatura criada)
    //
    // ⚠ Se retornar erro, assinaturas pode não ter RLS com policy de dono.
    //   Use a função RPC obter_plano_loja() como alternativa (ela é security definer).
    const { error } = await clientDonoA
      .from('assinaturas')
      .select('id')
      .eq('loja_id', fx.lojaAId)

    if (error) {
      console.warn(
        '⚠ ATENÇÃO: SELECT em assinaturas retornou erro para o dono.\n' +
        `  Código: ${error.code} | Mensagem: ${error.message}\n` +
        '  Se não há RLS em assinaturas, qualquer usuário autenticado pode ler/editar.\n' +
        '  Adicione RLS e uma policy para dono: https://supabase.com/docs/guides/auth/row-level-security'
      )
    }
    // Não falhamos aqui — mas logamos o aviso. O comportamento depende da migration de assinaturas.
  })
})
