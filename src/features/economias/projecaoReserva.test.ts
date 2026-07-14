import { describe, expect, it } from 'vitest'
import { calcularProjecaoReserva, listarMesesEntre } from './projecaoReserva'

describe('listarMesesEntre', () => {
  it('lista os meses de início a fim, inclusive nos dois extremos', () => {
    expect(listarMesesEntre({ ano: 2026, mes: 7 }, { ano: 2026, mes: 10 })).toEqual([
      { ano: 2026, mes: 7 },
      { ano: 2026, mes: 8 },
      { ano: 2026, mes: 9 },
      { ano: 2026, mes: 10 },
    ])
  })

  it('início igual a fim devolve só esse mês', () => {
    expect(listarMesesEntre({ ano: 2026, mes: 7 }, { ano: 2026, mes: 7 })).toEqual([{ ano: 2026, mes: 7 }])
  })

  it('atravessa a virada de ano', () => {
    expect(listarMesesEntre({ ano: 2026, mes: 11 }, { ano: 2027, mes: 2 })).toEqual([
      { ano: 2026, mes: 11 },
      { ano: 2026, mes: 12 },
      { ano: 2027, mes: 1 },
      { ano: 2027, mes: 2 },
    ])
  })
})

describe('calcularProjecaoReserva', () => {
  it('acumula a sobra prevista de cada mês a partir do saldo atual da reserva', () => {
    const projecao = calcularProjecaoReserva(1000, [
      { ano: 2026, mes: 7, entradasPrevistas: 9000, saidasPrevistas: 5000, cartaoVencendoNoMes: 1000 }, // sobra 3000
      { ano: 2026, mes: 8, entradasPrevistas: 9000, saidasPrevistas: 6000, cartaoVencendoNoMes: 500 }, // sobra 2500
    ])

    expect(projecao[0].sobraPrevista).toBe(3000)
    expect(projecao[0].saldoReservaProjetado).toBe(4000) // 1000 + 3000
    expect(projecao[1].sobraPrevista).toBe(2500)
    expect(projecao[1].saldoReservaProjetado).toBe(6500) // 4000 + 2500
  })

  it('mês com sobra prevista negativa também é somado (pode reduzir a projeção)', () => {
    const projecao = calcularProjecaoReserva(5000, [
      { ano: 2026, mes: 7, entradasPrevistas: 1000, saidasPrevistas: 2000, cartaoVencendoNoMes: 500 }, // sobra -1500
    ])

    expect(projecao[0].sobraPrevista).toBe(-1500)
    expect(projecao[0].saldoReservaProjetado).toBe(3500)
  })

  it('o detalhamento mês a mês soma corretamente até o valor final', () => {
    const dadosPorMes = [
      { ano: 2026, mes: 7, entradasPrevistas: 9000, saidasPrevistas: 7000, cartaoVencendoNoMes: 800 },
      { ano: 2026, mes: 8, entradasPrevistas: 9000, saidasPrevistas: 6500, cartaoVencendoNoMes: 700 },
      { ano: 2026, mes: 9, entradasPrevistas: 9200, saidasPrevistas: 7100, cartaoVencendoNoMes: 900 },
    ]
    const saldoAtual = 12000

    const projecao = calcularProjecaoReserva(saldoAtual, dadosPorMes)
    const somaDasSobras = projecao.reduce((soma, mes) => soma + mes.sobraPrevista, 0)

    expect(projecao[projecao.length - 1].saldoReservaProjetado).toBe(saldoAtual + somaDasSobras)
  })
})
