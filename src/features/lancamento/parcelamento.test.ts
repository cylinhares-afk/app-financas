import { describe, expect, it } from 'vitest'
import { calcularParcelas } from './parcelamento'

describe('calcularParcelas', () => {
  it('divide igualmente quando o valor é múltiplo do número de parcelas', () => {
    const parcelas = calcularParcelas(2000, 4, '2026-07-04')

    expect(parcelas).toEqual([
      { numero: 1, totalParcelas: 4, valor: 500, data: '2026-07-04' },
      { numero: 2, totalParcelas: 4, valor: 500, data: '2026-08-04' },
      { numero: 3, totalParcelas: 4, valor: 500, data: '2026-09-04' },
      { numero: 4, totalParcelas: 4, valor: 500, data: '2026-10-04' },
    ])
  })

  it('distribui os centavos que sobram sem perder nem inventar dinheiro', () => {
    const parcelas = calcularParcelas(100, 3, '2026-07-04')

    const valores = parcelas.map((p) => p.valor)
    expect(valores).toEqual([33.34, 33.33, 33.33])
    expect(valores.reduce((soma, v) => soma + v, 0)).toBeCloseTo(100, 2)
  })

  it('cada parcela sabe sua posição e o total', () => {
    const parcelas = calcularParcelas(300, 3, '2026-07-04')
    expect(parcelas.map((p) => `${p.numero}/${p.totalParcelas}`)).toEqual(['1/3', '2/3', '3/3'])
  })

  it('avança a data mês a mês, com ajuste de fim de mês', () => {
    const parcelas = calcularParcelas(400, 4, '2026-01-31')
    expect(parcelas.map((p) => p.data)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })
})
