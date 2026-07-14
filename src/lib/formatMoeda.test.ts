import { describe, expect, it } from 'vitest'
import { semNegativo } from './formatMoeda'

describe('semNegativo', () => {
  it('remove o sinal de menos de qualquer posição', () => {
    expect(semNegativo('-100')).toBe('100')
    expect(semNegativo('1-00')).toBe('100')
  })

  it('não mexe em valores já positivos', () => {
    expect(semNegativo('100')).toBe('100')
    expect(semNegativo('')).toBe('')
  })
})
