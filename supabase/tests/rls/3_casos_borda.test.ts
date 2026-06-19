/**
 * Suite 3 — Casos de Borda
 *
 * Testa situações limite que poderiam enganar as policies:
 *   • Operador inativo (linha existe, status='inativo')
 *   • Operador pendente (convite não aceito)
 *   • Usuário autenticado sem nenhuma loja
 *   • Tentativas de "pular" a hierarquia via queries diretas
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  setupFixtures, teardownFixtures, signInAs,
  type TestFixtures,
} from './fixtures'

let fx: TestFixtures

let clientInativoA: SupabaseClient
let clientPendenteA: SupabaseClient
let clientSemLoja: SupabaseClient
let clientClienteA: SupabaseClient

beforeAll(async () => {
  fx = await setupFixtures()
  ;[clientInativoA, clientPendenteA, clientSemLoja, clientClienteA] = await Promise.all([
    signInAs(fx.users.inativoA),
    signInAs(fx.users.pendenteA),
    signInAs(fx.users.semLoja),
    signInAs(fx.users.clienteA),
  ])
}, 90_000)

afterAll(async () => {
  await teardownFixtures(fx)
}, 30_000)

// ═══════════════════════════════════════════════════════════════════════════════
// 3.1  Operador inativo — sem nenhum acesso
// ═══════════════════════════════════════════════════════════════════════════════

describe('3.1 Operador inativo — linha existe na tabela mas status=inativo', () => {
  it('[pedidos] inativo NÃO vê pedidos da loja_a', async () => {
    // Papel: caixa com status=inativo | Ação: SELECT pedidos
    // Esperado: BLOQUEADO — operador_tem_acesso exige status='ativo'
    const { data } = await clientInativoA
      .from('pedidos')
      .select('id')
      .eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[produtos] inativo NÃO vê produtos da loja_a', async () => {
    // Papel: inativo | Ação: SELECT produtos WHERE loja_id = loja_a
    // Esperado: BLOQUEADO
    const { data } = await clientInativoA
      .from('produtos')
      .select('id')
      .eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[categorias] inativo NÃO vê categorias da loja_a', async () => {
    // Papel: inativo | Ação: SELECT categorias
    // Esperado: BLOQUEADO
    const { data } = await clientInativoA
      .from('categorias')
      .select('id')
      .eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[lojas] inativo NÃO vê a loja_a', async () => {
    // Papel: inativo | Ação: SELECT lojas WHERE id = loja_a
    // Esperado: BLOQUEADO
    const { data } = await clientInativoA
      .from('lojas')
      .select('id')
      .eq('id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[pedidos] inativo NÃO pode atualizar status de pedido', async () => {
    // Papel: inativo | Ação: UPDATE pedidos SET status='saiu_entrega'
    // Esperado: BLOQUEADO — using clause falha pois operador_tem_acesso é false
    await clientInativoA
      .from('pedidos')
      .update({ status: 'saiu_entrega' })
      .eq('id', fx.pedidoAId)

    const { adminClient } = await import('./fixtures')
    const { data } = await adminClient
      .from('pedidos')
      .select('status')
      .eq('id', fx.pedidoAId)
      .single()
    expect((data as { status: string } | null)?.status).toBe('preparando')
  })

  it('[operadores] inativo SÓ vê a própria linha (não toda a lista)', async () => {
    // Papel: inativo | Ação: SELECT operadores WHERE loja_id = loja_a
    // Esperado: apenas a própria linha (policy "operador ve a propria linha" não exige status=ativo)
    // NOTA: A policy de leitura da própria linha não tem restrição de status —
    //       o operador inativo ainda consegue ver o próprio convite/registro.
    const { data, error } = await clientInativoA
      .from('operadores')
      .select('user_id')
      .eq('loja_id', fx.lojaAId)

    expect(error).toBeNull()
    const userIds = (data ?? []).map((o: { user_id: string }) => o.user_id)
    // Deve ver só a própria linha
    expect(userIds.every((uid: string) => uid === fx.users.inativoA.id)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3.2  Operador pendente — convite não aceito, sem acesso
// ═══════════════════════════════════════════════════════════════════════════════

describe('3.2 Operador pendente — convite não aceito (status=pendente)', () => {
  it('[pedidos] pendente NÃO vê pedidos da loja_a', async () => {
    // Papel: caixa com status=pendente | Ação: SELECT pedidos
    // Esperado: BLOQUEADO — operador_tem_acesso exige status='ativo'
    const { data } = await clientPendenteA
      .from('pedidos')
      .select('id')
      .eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[produtos] pendente NÃO vê produtos da loja_a', async () => {
    // Papel: pendente | Ação: SELECT produtos
    // Esperado: BLOQUEADO
    const { data } = await clientPendenteA
      .from('produtos')
      .select('id')
      .eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[lojas] pendente NÃO vê a loja_a', async () => {
    // Papel: pendente | Ação: SELECT lojas WHERE id = loja_a
    // Esperado: BLOQUEADO
    const { data } = await clientPendenteA
      .from('lojas')
      .select('id')
      .eq('id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[pedidos] pendente NÃO pode atualizar status', async () => {
    // Papel: pendente | Ação: UPDATE pedidos SET status='saiu_entrega'
    // Esperado: BLOQUEADO
    await clientPendenteA
      .from('pedidos')
      .update({ status: 'saiu_entrega' })
      .eq('id', fx.pedidoAId)

    const { adminClient } = await import('./fixtures')
    const { data } = await adminClient
      .from('pedidos')
      .select('status')
      .eq('id', fx.pedidoAId)
      .single()
    expect((data as { status: string } | null)?.status).toBe('preparando')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3.3  Usuário sem loja — autenticado mas sem nenhum vínculo
// ═══════════════════════════════════════════════════════════════════════════════

describe('3.3 Usuário autenticado sem vínculo com nenhuma loja', () => {
  it('[lojas] sem_loja recebe lista vazia', async () => {
    // Papel: sem_loja | Ação: SELECT lojas
    // Esperado: BLOQUEADO — sem loja como dono nem operador
    const { data } = await clientSemLoja.from('lojas').select('id')
    // Pode receber lista vazia ou apenas lojas onde é dono/operador (nenhuma)
    expect(data ?? []).toHaveLength(0)
  })

  it('[pedidos] sem_loja recebe lista vazia', async () => {
    // Papel: sem_loja | Ação: SELECT pedidos
    // Esperado: BLOQUEADO — não é dono nem operador de nenhuma loja
    const { data } = await clientSemLoja.from('pedidos').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('[produtos] sem_loja recebe lista vazia', async () => {
    // Papel: sem_loja | Ação: SELECT produtos
    // Esperado: BLOQUEADO
    const { data } = await clientSemLoja.from('produtos').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('[categorias] sem_loja recebe lista vazia', async () => {
    // Papel: sem_loja | Ação: SELECT categorias
    // Esperado: BLOQUEADO
    const { data } = await clientSemLoja.from('categorias').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('[operadores] sem_loja recebe lista vazia', async () => {
    // Papel: sem_loja | Ação: SELECT operadores
    // Esperado: BLOQUEADO — não tem linha na tabela, nenhuma policy se aplica
    const { data } = await clientSemLoja.from('operadores').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('[lojas] sem_loja NÃO pode inserir loja diretamente via API', async () => {
    // Papel: sem_loja | Ação: INSERT lojas
    // Esperado: BLOQUEADO — não há policy de INSERT para authenticated (só service role cria lojas)
    const { error } = await clientSemLoja.from('lojas').insert({
      nome: 'Loja Invasora',
      slug: 'loja-invasora-rls',
      dono_id: fx.users.semLoja.id,
      ativo: true,
    })
    expect(error).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3.4  Cliente autenticado — só vê os próprios pedidos
// ═══════════════════════════════════════════════════════════════════════════════

describe('3.4 Cliente autenticado — acesso restrito aos próprios pedidos', () => {
  it('[pedidos] cliente PODE ver os próprios pedidos', async () => {
    // Papel: cliente_a | Ação: SELECT pedidos WHERE id = pedido_a
    // Esperado: PERMITIDO — policy "pedidos: cliente ve os proprios" (cliente_id = auth.uid())
    const { data, error } = await clientClienteA
      .from('pedidos')
      .select('id, status')
      .eq('id', fx.pedidoAId)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  it('[pedidos] cliente NÃO vê pedidos de outros clientes', async () => {
    // Papel: cliente_a | Ação: SELECT pedidos WHERE loja_id = loja_a (pedidos de outros)
    // Esperado: só retorna os pedidos que são do próprio cliente_a
    //   (a policy filtra por cliente_id = auth.uid())
    const { data } = await clientClienteA
      .from('pedidos')
      .select('id, cliente_id')
      .eq('loja_id', fx.lojaAId)

    // Todos os pedidos retornados devem ser do próprio cliente
    const outrasLinhas = (data ?? []).filter(
      (p: { cliente_id: string }) => p.cliente_id !== fx.users.clienteA.id
    )
    expect(outrasLinhas).toHaveLength(0)
  })

  it('[itens_pedido] cliente PODE ver itens dos próprios pedidos', async () => {
    // Papel: cliente_a | Ação: SELECT itens_pedido WHERE pedido_id = pedido_a
    // Esperado: PERMITIDO (sem erro — 0 ou mais itens)
    const { error } = await clientClienteA
      .from('itens_pedido')
      .select('id')
      .eq('pedido_id', fx.pedidoAId)

    expect(error).toBeNull()
  })

  it('[produtos] cliente NÃO pode ver produtos via tabela direta (sem policy de authenticated)', async () => {
    // Papel: cliente_a | Ação: SELECT produtos WHERE loja_id = loja_a
    // Esperado: BLOQUEADO — cliente autenticado sem papel não tem policy de produtos
    //   (a policy de produtos só cobre dono e atendente+)
    //
    // ⚠ Se este teste falhar (retornar dados), existe uma policy excessivamente permissiva em produtos.
    const { data } = await clientClienteA
      .from('produtos')
      .select('id')
      .eq('loja_id', fx.lojaAId)

    expect(data ?? []).toHaveLength(0)
  })

  it('[lojas] cliente NÃO pode ver dados da loja via tabela direta', async () => {
    // Papel: cliente_a | Ação: SELECT lojas WHERE id = loja_a
    // Esperado: BLOQUEADO — cliente não é dono nem operador
    const { data } = await clientClienteA
      .from('lojas')
      .select('id')
      .eq('id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[pedidos] cliente NÃO pode atualizar status do próprio pedido', async () => {
    // Papel: cliente_a | Ação: UPDATE pedidos SET status='entregue'
    // Esperado: BLOQUEADO — não há policy de UPDATE para cliente (só dono/operador)
    await clientClienteA
      .from('pedidos')
      .update({ status: 'entregue' })
      .eq('id', fx.pedidoAId)

    const { adminClient } = await import('./fixtures')
    const { data } = await adminClient
      .from('pedidos')
      .select('status')
      .eq('id', fx.pedidoAId)
      .single()
    expect((data as { status: string } | null)?.status).toBe('preparando')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3.5  Função helper meu_papel_na_loja
// ═══════════════════════════════════════════════════════════════════════════════

describe('3.5 RPC meu_papel_na_loja retorna o papel correto', () => {
  it('dono_a recebe "dono" para loja_a', async () => {
    const clientDonoA = await signInAs(fx.users.donoA)
    const { data, error } = await clientDonoA
      .rpc('meu_papel_na_loja', { p_loja_id: fx.lojaAId })

    expect(error).toBeNull()
    expect(data).toBe('dono')
  })

  it('caixa_a recebe "caixa" para loja_a', async () => {
    const clientCaixaA = await signInAs(fx.users.caixaA)
    const { data, error } = await clientCaixaA
      .rpc('meu_papel_na_loja', { p_loja_id: fx.lojaAId })

    expect(error).toBeNull()
    expect(data).toBe('caixa')
  })

  it('inativo_a recebe null para loja_a (inativo não conta como ativo)', async () => {
    const clientInativoA = await signInAs(fx.users.inativoA)
    const { data, error } = await clientInativoA
      .rpc('meu_papel_na_loja', { p_loja_id: fx.lojaAId })

    expect(error).toBeNull()
    // Inativo não é considerado ativo → function retorna null
    expect(data).toBeNull()
  })

  it('sem_loja recebe null para loja_a', async () => {
    const clientSemLoja = await signInAs(fx.users.semLoja)
    const { data, error } = await clientSemLoja
      .rpc('meu_papel_na_loja', { p_loja_id: fx.lojaAId })

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('dono_a recebe null para loja_b (não é dono nem operador)', async () => {
    const clientDonoA = await signInAs(fx.users.donoA)
    const { data, error } = await clientDonoA
      .rpc('meu_papel_na_loja', { p_loja_id: fx.lojaBId })

    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})
