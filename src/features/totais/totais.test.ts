import { describe, expect, it } from 'vitest'
import { calcularProjecaoMes, calcularTotais } from './totais'

describe('calcularTotais', () => {
  it('calcula performance e custo de vida pela régua de caixa real (cartão que vence nesse mês)', () => {
    const resultado = calcularTotais({
      entradasMes: 9000,
      saidasPixMes: 500,
      saidasTotalMes: 800, // inclui os 300 de cartão do mês atual (informativo)
      cartaoMesAtual: 300,
      cartaoVencendoNoMes: 300,
      totalPrevisto: 1000,
      gastoMedioDia: 30,
      diasNoMes: 30,
    })

    expect(resultado.custoDeVida).toBe(800) // 500 pix + 300 cartão vencendo nesse mês
    expect(resultado.performance).toBe(8200) // 9000 - 500 - 300
  })

  it('não soma a projeção separadamente no custo de vida (evita contar duas vezes)', () => {
    const resultado = calcularTotais({
      entradasMes: 5000,
      saidasPixMes: 1000,
      saidasTotalMes: 1000,
      cartaoMesAtual: 0,
      cartaoVencendoNoMes: 200,
      totalPrevisto: 999, // valor bem diferente, só pra provar que não entra na conta
      gastoMedioDia: 999,
      diasNoMes: 30,
    })

    expect(resultado.custoDeVida).toBe(1200) // 1000 + 200, sem qualquer traço da projeção
  })

  it('performance fica negativa quando os gastos (pix + cartão vencendo nesse mês) superam as entradas', () => {
    const resultado = calcularTotais({
      entradasMes: 1000,
      saidasPixMes: 800,
      saidasTotalMes: 800,
      cartaoMesAtual: 0,
      cartaoVencendoNoMes: 500,
      totalPrevisto: 0,
      gastoMedioDia: 0,
      diasNoMes: 30,
    })

    expect(resultado.performance).toBe(-300) // 1000 - 800 - 500
  })

  it('repassa entradas/saídas/cartão do mês vigente (sem defasagem) pra lista de movimentações', () => {
    const resultado = calcularTotais({
      entradasMes: 9000,
      saidasPixMes: 500,
      saidasTotalMes: 800,
      cartaoMesAtual: 300,
      cartaoVencendoNoMes: 999, // deliberadamente diferente, pra confirmar que não vaza pra cá
      totalPrevisto: 1000,
      gastoMedioDia: 30,
      diasNoMes: 30,
    })

    expect(resultado.entradasMes).toBe(9000)
    expect(resultado.saidasMes).toBe(800)
    expect(resultado.cartaoMes).toBe(300)
  })

  it('calcula a sobra projetada como entradas do mês menos o gasto projetado', () => {
    const resultado = calcularTotais({
      entradasMes: 5000,
      saidasPixMes: 500,
      saidasTotalMes: 500,
      cartaoMesAtual: 0,
      cartaoVencendoNoMes: 0,
      totalPrevisto: 3000,
      gastoMedioDia: 100, // projetado = 100 * 30 = 3000
      diasNoMes: 30,
    })

    expect(resultado.gastoProjetado).toBe(3000)
    expect(resultado.sobraProjetada).toBe(2000) // 5000 - 3000
  })
})

describe('calcularProjecaoMes', () => {
  it('projeta acima do previsto quando o ritmo de gasto é maior que o previsto por dia', () => {
    const resultado = calcularProjecaoMes(3000, 120, 30) // previsto/dia = 100, gastando 120/dia

    expect(resultado.gastoProjetado).toBe(3600)
    expect(resultado.previstoDia).toBe(100)
    expect(resultado.diferenca).toBe(600) // 3600 - 3000, acima do previsto
  })

  it('projeta abaixo do previsto quando o ritmo de gasto é menor que o previsto por dia', () => {
    const resultado = calcularProjecaoMes(3000, 80, 30) // previsto/dia = 100, gastando 80/dia

    expect(resultado.gastoProjetado).toBe(2400)
    expect(resultado.diferenca).toBe(-600) // 2400 - 3000, abaixo do previsto
  })

  it('no último dia do mês, a projeção bate exatamente com o gasto médio já consolidado', () => {
    // gastoMedioDia calculado com diasPassados = diasNoMes (mês já fechado) já embute o total gasto
    const resultado = calcularProjecaoMes(3000, 3300 / 30, 30)

    expect(resultado.gastoProjetado).toBeCloseTo(3300)
  })

  it('previstoDia não recalcula com o tempo, é sempre totalPrevisto / diasNoMes', () => {
    const resultado = calcularProjecaoMes(3100, 999, 31)

    expect(resultado.previstoDia).toBeCloseTo(100)
  })
})
