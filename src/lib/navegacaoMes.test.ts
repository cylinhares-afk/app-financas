import { describe, expect, it } from 'vitest'
import { statusMesVisualizado } from './navegacaoMes'

describe('statusMesVisualizado', () => {
  const hoje = { ano: 2026, mes: 7 }

  it('mesmo ano/mês de hoje é "atual"', () => {
    expect(statusMesVisualizado({ ano: 2026, mes: 7 }, hoje)).toBe('atual')
  })

  it('mês anterior no mesmo ano é "passado"', () => {
    expect(statusMesVisualizado({ ano: 2026, mes: 6 }, hoje)).toBe('passado')
  })

  it('mês seguinte no mesmo ano é "futuro"', () => {
    expect(statusMesVisualizado({ ano: 2026, mes: 8 }, hoje)).toBe('futuro')
  })

  it('atravessa a virada de ano corretamente', () => {
    expect(statusMesVisualizado({ ano: 2025, mes: 12 }, hoje)).toBe('passado')
    expect(statusMesVisualizado({ ano: 2027, mes: 1 }, hoje)).toBe('futuro')
  })
})
