import { describe, expect, it } from 'vitest'
import { getStatusSaldo } from './saldoDiario'

describe('getStatusSaldo', () => {
  it('vermelho quando o saldo é negativo, independente do total de entradas', () => {
    expect(getStatusSaldo(-1, 1000)).toBe('vermelho')
    expect(getStatusSaldo(-1000, 0)).toBe('vermelho')
  })

  it('verde-escuro quando não há entradas registradas e o saldo não é negativo', () => {
    expect(getStatusSaldo(0, 0)).toBe('verde-escuro')
    expect(getStatusSaldo(500, 0)).toBe('verde-escuro')
  })

  it('verde-escuro a partir de 50% do total de entradas', () => {
    expect(getStatusSaldo(500, 1000)).toBe('verde-escuro')
    expect(getStatusSaldo(1000, 1000)).toBe('verde-escuro')
  })

  it('verde-claro entre 20% (inclusive) e 50%', () => {
    expect(getStatusSaldo(200, 1000)).toBe('verde-claro')
    expect(getStatusSaldo(499, 1000)).toBe('verde-claro')
  })

  it('amarelo entre 5% (inclusive) e 20%', () => {
    expect(getStatusSaldo(50, 1000)).toBe('amarelo')
    expect(getStatusSaldo(199, 1000)).toBe('amarelo')
  })

  it('laranja entre 0% (inclusive) e 5%', () => {
    expect(getStatusSaldo(0, 1000)).toBe('laranja')
    expect(getStatusSaldo(49, 1000)).toBe('laranja')
  })
})
