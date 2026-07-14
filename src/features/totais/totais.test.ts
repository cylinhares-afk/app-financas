import { describe, expect, it } from 'vitest'
import { calcularTotais } from './totais'

describe('calcularTotais', () => {
  it('calcula performance e custo de vida pela régua de caixa real (cartão que vence nesse mês)', () => {
    const resultado = calcularTotais({
      entradasMes: 9000,
      saidasDinheiroMes: 500,
      saidasTotalMes: 800, // inclui os 300 de cartão do mês atual (informativo)
      cartaoMesAtual: 300,
      cartaoVencendoNoMes: 300,
      diarioHoje: 68,
    })

    expect(resultado.custoDeVida).toBe(800) // 500 dinheiro + 300 cartão vencendo nesse mês
    expect(resultado.performance).toBe(8200) // 9000 - 500 - 300
  })

  it('não soma o "diário" separadamente no custo de vida (evita contar duas vezes)', () => {
    const resultado = calcularTotais({
      entradasMes: 5000,
      saidasDinheiroMes: 1000,
      saidasTotalMes: 1000,
      cartaoMesAtual: 0,
      cartaoVencendoNoMes: 200,
      diarioHoje: 999, // valor bem diferente, só pra provar que não entra na conta
    })

    expect(resultado.custoDeVida).toBe(1200) // 1000 + 200, sem qualquer traço do diarioHoje
  })

  it('performance fica negativa quando os gastos (dinheiro + cartão vencendo nesse mês) superam as entradas', () => {
    const resultado = calcularTotais({
      entradasMes: 1000,
      saidasDinheiroMes: 800,
      saidasTotalMes: 800,
      cartaoMesAtual: 0,
      cartaoVencendoNoMes: 500,
      diarioHoje: 0,
    })

    expect(resultado.performance).toBe(-300) // 1000 - 800 - 500
  })

  it('repassa entradas/saídas/cartão do mês vigente (sem defasagem) pra lista de movimentações', () => {
    const resultado = calcularTotais({
      entradasMes: 9000,
      saidasDinheiroMes: 500,
      saidasTotalMes: 800,
      cartaoMesAtual: 300,
      cartaoVencendoNoMes: 999, // deliberadamente diferente, pra confirmar que não vaza pra cá
      diarioHoje: 42,
    })

    expect(resultado.entradasMes).toBe(9000)
    expect(resultado.saidasMes).toBe(800)
    expect(resultado.cartaoMes).toBe(300)
    expect(resultado.diarioHoje).toBe(42)
  })
})
