/**
 * Suite 1 — Isolamento Multi-tenant
 *
 * Garante que nenhum usuário acessa dados de uma loja que não é a sua.
 * Este é o requisito de segurança mais crítico do sistema.
 *
 * Topology de teste:
 *   Loja A (dono_a)  ←  testamos que atores da Loja B/externos NÃO acessam
 *   Loja B (dono_b)  ←  testamos que atores da Loja A NÃO acessam
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  setupFixtures, teardownFixtures, signInAs, anonClient,
  type TestFixtures,
} from './fixtures'

let fx: TestFixtures

// Clientes autenticados — criados uma vez por arquivo para economizar round-trips
let clientDonoB: SupabaseClient
let clientCaixaA: SupabaseClient

beforeAll(async () => {
  fx = await setupFixtures()
  ;[clientDonoB, clientCaixaA] = await Promise.all([
    signInAs(fx.users.donoB),
    signInAs(fx.users.caixaA),
  ])
}, 90_000)

afterAll(async () => {
  await teardownFixtures(fx)
}, 30_000)

// ═══════════════════════════════════════════════════════════════════════════════
// 1.1  Dono da Loja B NÃO acessa nada da Loja A
// ═══════════════════════════════════════════════════════════════════════════════

describe('1.1 Dono de outra loja (dono_b) não acessa dados da Loja A', () => {
  it('[lojas] SELECT na loja_a retorna vazio', async () => {
    // Papel: dono_b | Ação: SELECT lojas WHERE id = loja_a
    // Esperado: BLOQUEADO (lista vazia)
    const { data } = await clientDonoB.from('lojas').select('id').eq('id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[pedidos] SELECT filtrando loja_a retorna vazio', async () => {
    // Papel: dono_b | Ação: SELECT pedidos WHERE loja_id = loja_a
    // Esperado: BLOQUEADO
    const { data } = await clientDonoB.from('pedidos').select('id').eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[pedidos] SELECT pelo id exato do pedido retorna vazio', async () => {
    // Papel: dono_b | Ação: SELECT pedidos WHERE id = pedido_a
    // Esperado: BLOQUEADO — mesmo sabendo o UUID do pedido
    const { data } = await clientDonoB.from('pedidos').select('id').eq('id', fx.pedidoAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[produtos] SELECT filtrando loja_a retorna vazio', async () => {
    // Papel: dono_b | Ação: SELECT produtos WHERE loja_id = loja_a
    // Esperado: BLOQUEADO
    const { data } = await clientDonoB.from('produtos').select('id').eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[categorias] SELECT filtrando loja_a retorna vazio', async () => {
    // Papel: dono_b | Ação: SELECT categorias WHERE loja_id = loja_a
    // Esperado: BLOQUEADO
    const { data } = await clientDonoB.from('categorias').select('id').eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[operadores] SELECT de operadores da loja_a retorna vazio', async () => {
    // Papel: dono_b | Ação: SELECT operadores WHERE loja_id = loja_a
    // Esperado: BLOQUEADO (dono_b não é dono da loja_a, nem operador)
    const { data } = await clientDonoB.from('operadores').select('id').eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[lojas] UPDATE na loja_a NÃO é permitido', async () => {
    // Papel: dono_b | Ação: UPDATE lojas SET nome='HACK' WHERE id = loja_a
    // Esperado: BLOQUEADO (0 linhas afetadas — using clause não satisfeita)
    const { error } = await clientDonoB
      .from('lojas')
      .update({ nome: 'HACK' })
      .eq('id', fx.lojaAId)
    // RLS silenciosamente afeta 0 linhas (using clause falhou)
    expect(error).toBeNull() // sem erro, mas...

    // Verifica que o nome não mudou usando admin
    const { data } = await import('./fixtures').then(m =>
      m.adminClient.from('lojas').select('nome').eq('id', fx.lojaAId).single()
    )
    expect((data as { nome: string } | null)?.nome).not.toBe('HACK')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 1.2  Operador ativo da Loja A NÃO acessa dados da Loja B
// ═══════════════════════════════════════════════════════════════════════════════

describe('1.2 Operador ativo da Loja A (caixa_a) não acessa dados da Loja B', () => {
  it('[lojas] SELECT na loja_b retorna vazio', async () => {
    // Papel: caixa_a (ativo) | Ação: SELECT lojas WHERE id = loja_b
    // Esperado: BLOQUEADO — operador_tem_acesso só retorna true para loja_a
    const { data } = await clientCaixaA.from('lojas').select('id').eq('id', fx.lojaBId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[produtos] SELECT filtrando loja_b retorna vazio', async () => {
    // Papel: caixa_a | Ação: SELECT produtos WHERE loja_id = loja_b
    // Esperado: BLOQUEADO — mesmo sabendo o loja_id da Loja B
    const { data } = await clientCaixaA.from('produtos').select('id').eq('loja_id', fx.lojaBId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[produtos] SELECT pelo id exato do produto da loja_b retorna vazio', async () => {
    // Papel: caixa_a | Ação: SELECT produtos WHERE id = produto_b
    // Esperado: BLOQUEADO
    const { data } = await clientCaixaA.from('produtos').select('id').eq('id', fx.produtoBId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[categorias] SELECT filtrando loja_b retorna vazio', async () => {
    // Papel: caixa_a | Ação: SELECT categorias WHERE loja_id = loja_b
    // Esperado: BLOQUEADO
    const { data } = await clientCaixaA.from('categorias').select('id').eq('loja_id', fx.lojaBId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[pedidos] SELECT filtrando loja_b retorna vazio', async () => {
    // Papel: caixa_a | Ação: SELECT pedidos WHERE loja_id = loja_b
    // Esperado: BLOQUEADO
    const { data } = await clientCaixaA.from('pedidos').select('id').eq('loja_id', fx.lojaBId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[produtos] UPDATE em produto da loja_b não afeta o dado', async () => {
    // Papel: caixa_a | Ação: UPDATE produtos SET nome='HACK' WHERE id = produto_b
    // Esperado: BLOQUEADO (caixa não tem nem acesso a produtos — requer atendente+)
    await clientCaixaA.from('produtos').update({ nome: 'HACK' }).eq('id', fx.produtoBId)

    const { adminClient } = await import('./fixtures')
    const { data } = await adminClient.from('produtos').select('nome').eq('id', fx.produtoBId).single()
    expect((data as { nome: string } | null)?.nome).not.toBe('HACK')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 1.3  Cliente anônimo — acesso ao catálogo público
// ═══════════════════════════════════════════════════════════════════════════════

describe('1.3 Cliente anônimo — acesso somente ao catálogo público', () => {
  it('[produtos] anon só vê produtos disponíveis de loja ativa', async () => {
    // Papel: anônimo | Ação: SELECT produtos WHERE id IN (prod_a1, prod_a2)
    // Esperado: PERMITIDO para prod_a1 (disponível), BLOQUEADO para prod_a2 (indisponível)
    //
    // ⚠ Se este teste falhar com "permission denied", significa que falta uma
    //   policy de SELECT para anon em produtos. Ver migrations para adicionar:
    //   create policy "produtos: leitura publica" on produtos
    //     for select to anon
    //     using (disponivel = true and exists (
    //       select 1 from lojas where lojas.id = produtos.loja_id and lojas.ativo = true
    //     ));
    const { data, error } = await anonClient
      .from('produtos')
      .select('id, disponivel')
      .in('id', [fx.produtoA1Id, fx.produtoA2Id])

    if (error?.code === '42501' || error?.message?.includes('permission denied')) {
      throw new Error(
        '❌ MIGRATION FALTANDO: anon não pode ler produtos.\n' +
        'Adicione uma policy de SELECT para anon em produtos (ver comentário no teste).'
      )
    }

    const ids = (data ?? []).map((p: { id: string }) => p.id)
    expect(ids).toContain(fx.produtoA1Id)      // disponível=true → deve aparecer
    expect(ids).not.toContain(fx.produtoA2Id)  // disponível=false → não deve aparecer
  })

  it('[lojas] anon NÃO consegue listar a tabela lojas diretamente', async () => {
    // Papel: anônimo | Ação: SELECT lojas WHERE id = loja_a
    // Esperado: BLOQUEADO (nenhuma policy de anon em lojas)
    const { data } = await anonClient.from('lojas').select('id').eq('id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[pedidos] anon NÃO consegue ver pedidos', async () => {
    // Papel: anônimo | Ação: SELECT pedidos
    // Esperado: BLOQUEADO
    const { data } = await anonClient.from('pedidos').select('id').eq('id', fx.pedidoAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('[operadores] anon NÃO consegue ver operadores', async () => {
    // Papel: anônimo | Ação: SELECT operadores
    // Esperado: BLOQUEADO
    const { data } = await anonClient.from('operadores').select('id').eq('loja_id', fx.lojaAId)
    expect(data ?? []).toHaveLength(0)
  })
})
