import { describe, expect, it } from 'vitest'
import { filtrarGastosCartaoVencendoNoMes, mesVencimentoDoGasto } from './faturaCartao'
import type { CartaoParaFatura } from './faturaCartao'
import type { Gasto } from '../../types/domain'

function gasto(parcial: Partial<Gasto> & Pick<Gasto, 'valor' | 'data'>): Gasto {
  return { id: 'g', categoriaId: 'c', usuarioId: 'u', meioPagamento: 'cartao', ...parcial }
}

describe('mesVencimentoDoGasto', () => {
  it('compra antes (ou no dia) do fechamento cai na fatura que fecha nesse mesmo mês', () => {
    expect(mesVencimentoDoGasto(20, 27, '2026-07-15')).toEqual({ ano: 2026, mes: 7 })
    expect(mesVencimentoDoGasto(20, 27, '2026-07-20')).toEqual({ ano: 2026, mes: 7 })
  })

  it('compra depois do fechamento cai na fatura do mês seguinte', () => {
    expect(mesVencimentoDoGasto(20, 27, '2026-07-25')).toEqual({ ano: 2026, mes: 8 })
  })

  it('vencimento depois do fechamento: fatura vence no mesmo mês em que fechou', () => {
    // fecha dia 20 de julho, vence dia 27 de julho (mesmo mês)
    expect(mesVencimentoDoGasto(20, 27, '2026-07-15')).toEqual({ ano: 2026, mes: 7 })
  })

  it('vencimento antes do fechamento: fatura vence só no mês seguinte ao fechamento', () => {
    // compra dia 15/jul fecha em julho (fechamento dia 20), mas vence só em agosto (dia 5 < dia 20)
    expect(mesVencimentoDoGasto(20, 5, '2026-07-15')).toEqual({ ano: 2026, mes: 8 })
    // compra dia 25/jul fecha em agosto, e vence só em setembro (lag de 2 meses no total)
    expect(mesVencimentoDoGasto(20, 5, '2026-07-25')).toEqual({ ano: 2026, mes: 9 })
  })

  it('atravessa a virada de ano corretamente', () => {
    expect(mesVencimentoDoGasto(20, 27, '2026-12-25')).toEqual({ ano: 2027, mes: 1 })
  })

  it('cartão tipo "Amazon" (fecha dia 20, vence dia 1): compra depois do fechamento vence 2 meses depois da compra', () => {
    // compra 26/06 é depois do fechamento (dia 20) -> cai na fatura que fecha em 20/07;
    // como o vencimento (dia 1) é antes do fechamento (dia 20), essa fatura só vence em agosto.
    expect(mesVencimentoDoGasto(20, 1, '2026-06-26')).toEqual({ ano: 2026, mes: 8 })
  })
})

describe('filtrarGastosCartaoVencendoNoMes', () => {
  it('soma corretamente compras de cartões diferentes que vencem no mesmo mês-alvo, com ciclos diferentes', () => {
    const cartaoA: CartaoParaFatura = { id: 'a', diaFechamento: 20, diaVencimento: 27 } // fecha e vence no mesmo mês
    const cartaoB: CartaoParaFatura = { id: 'b', diaFechamento: 5, diaVencimento: 12 } // fecha cedo, vence cedo
    const cartoesPorId = new Map([
      ['a', cartaoA],
      ['b', cartaoB],
    ])

    const gastos = [
      // cartão A: compra dia 15/jul -> fecha jul, vence jul
      gasto({ valor: 100, data: '2026-07-15', cartaoId: 'a' }),
      // cartão A: compra dia 25/jul -> fecha ago, vence ago (não deveria entrar em julho)
      gasto({ valor: 200, data: '2026-07-25', cartaoId: 'a' }),
      // cartão B: compra dia 10/jul (depois do fechamento dia 5) -> fecha ago, vence ago
      gasto({ valor: 300, data: '2026-07-10', cartaoId: 'b' }),
      // cartão B: compra dia 20/jun (depois do fechamento dia 5) -> fecha jul, vence jul
      gasto({ valor: 50, data: '2026-06-20', cartaoId: 'b' }),
      // gasto em dinheiro não entra nunca
      gasto({ valor: 999, data: '2026-07-15', cartaoId: 'a', meioPagamento: 'dinheiro' }),
    ]

    const vencendoEmJulho = filtrarGastosCartaoVencendoNoMes(gastos, cartoesPorId, 2026, 7)
    expect(vencendoEmJulho.reduce((soma, g) => soma + g.valor, 0)).toBe(150) // 100 (A) + 50 (B)

    const vencendoEmAgosto = filtrarGastosCartaoVencendoNoMes(gastos, cartoesPorId, 2026, 8)
    expect(vencendoEmAgosto.reduce((soma, g) => soma + g.valor, 0)).toBe(500) // 200 (A) + 300 (B)
  })

  it('gasto de cartão sem cartaoId nem snapshot cai no fallback antigo: sempre mês seguinte à compra', () => {
    const gastos = [gasto({ valor: 100, data: '2026-07-15' })] // sem cartaoId nem snapshot
    const cartoesPorId = new Map<string, CartaoParaFatura>()

    expect(filtrarGastosCartaoVencendoNoMes(gastos, cartoesPorId, 2026, 8)).toHaveLength(1)
    expect(filtrarGastosCartaoVencendoNoMes(gastos, cartoesPorId, 2026, 7)).toHaveLength(0)
  })

  it('usa o snapshot gravado no gasto, não o cartão atual — editar o cartão depois não recalcula compras já lançadas', () => {
    // cartão HOJE fecha dia 5 (mudou depois da compra), mas a compra foi
    // feita quando o cartão fechava dia 20 — o snapshot da compra tem que
    // prevalecer sobre esse cadastro atual.
    const cartaoAtualizado: CartaoParaFatura = { id: 'a', diaFechamento: 5, diaVencimento: 12 }
    const cartoesPorId = new Map([['a', cartaoAtualizado]])

    const gastoComSnapshotAntigo = gasto({
      valor: 100,
      data: '2026-07-15',
      cartaoId: 'a',
      cartaoDiaFechamento: 20,
      cartaoDiaVencimento: 27,
    })

    // pelo snapshot (fecha 20, vence 27): compra dia 15 -> fecha e vence em julho
    expect(filtrarGastosCartaoVencendoNoMes([gastoComSnapshotAntigo], cartoesPorId, 2026, 7)).toHaveLength(1)
    // se usasse o cartão atual (fecha dia 5) a compra teria fechado em agosto — não deve acontecer
    expect(filtrarGastosCartaoVencendoNoMes([gastoComSnapshotAntigo], cartoesPorId, 2026, 8)).toHaveLength(0)
  })
})
