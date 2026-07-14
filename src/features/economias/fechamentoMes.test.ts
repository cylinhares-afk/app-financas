import { describe, expect, it } from 'vitest'
import { calcularMesParaFechar, deveOferecerFechamento } from './fechamentoMes'

describe('calcularMesParaFechar', () => {
  it('devolve o mês imediatamente anterior ao mês real de hoje', () => {
    expect(calcularMesParaFechar('2026-07-01')).toEqual({ ano: 2026, mes: 6 })
    expect(calcularMesParaFechar('2026-07-31')).toEqual({ ano: 2026, mes: 6 })
  })

  it('atravessa a virada de ano', () => {
    expect(calcularMesParaFechar('2026-01-15')).toEqual({ ano: 2025, mes: 12 })
  })
})

describe('deveOferecerFechamento', () => {
  const mesAFechar = { ano: 2026, mes: 6 }

  it('não oferece se já existe um registro de fechamento pra esse mês (confirmado ou não)', () => {
    expect(deveOferecerFechamento(mesAFechar, '2026-01-01', true)).toBe(false)
  })

  it('não oferece se nunca houve nenhum lançamento', () => {
    expect(deveOferecerFechamento(mesAFechar, null, false)).toBe(false)
  })

  it('não oferece se o primeiro lançamento é de um mês posterior ao mês a fechar', () => {
    expect(deveOferecerFechamento(mesAFechar, '2026-07-05', false)).toBe(false)
  })

  it('oferece quando há lançamentos desde antes (ou dentro) do mês a fechar e ainda não foi perguntado', () => {
    expect(deveOferecerFechamento(mesAFechar, '2026-01-01', false)).toBe(true)
    expect(deveOferecerFechamento(mesAFechar, '2026-06-20', false)).toBe(true)
  })
})
