import { describe, expect, it } from 'vitest'
import { formatarDataISO, parseDataISO, somarDias, somarMesesComAjuste } from './dataISO'

describe('parseDataISO / formatarDataISO', () => {
  it('faz o round-trip sem perder zeros à esquerda', () => {
    expect(parseDataISO('2026-07-04')).toEqual({ ano: 2026, mes: 7, dia: 4 })
    expect(formatarDataISO(2026, 7, 4)).toBe('2026-07-04')
  })
})

describe('somarDias', () => {
  it('soma dias dentro do mesmo mês', () => {
    expect(somarDias('2026-07-04', 3)).toBe('2026-07-07')
  })

  it('atravessa a virada do mês e do ano corretamente', () => {
    expect(somarDias('2026-07-30', 3)).toBe('2026-08-02')
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('somarMesesComAjuste', () => {
  it('soma meses mantendo o mesmo dia quando ele existe no mês de destino', () => {
    expect(somarMesesComAjuste('2026-01-15', 1)).toBe('2026-02-15')
    expect(somarMesesComAjuste('2026-01-15', 3)).toBe('2026-04-15')
  })

  it('ajusta pro último dia do mês quando o dia original não existe nele', () => {
    expect(somarMesesComAjuste('2026-01-31', 1)).toBe('2026-02-28') // 2026 não é bissexto
    expect(somarMesesComAjuste('2024-01-31', 1)).toBe('2024-02-29') // 2024 é bissexto
    expect(somarMesesComAjuste('2026-01-31', 3)).toBe('2026-04-30')
  })

  it('atravessa a virada do ano', () => {
    expect(somarMesesComAjuste('2026-11-15', 2)).toBe('2027-01-15')
  })
})
