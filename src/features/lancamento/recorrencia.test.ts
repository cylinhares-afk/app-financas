import { describe, expect, it } from 'vitest'
import { calcularOcorrenciasPendentes, proximaData } from './recorrencia'

describe('proximaData', () => {
  it('avança 1 dia, 7 dias ou 1 mês (com ajuste) conforme a frequência', () => {
    expect(proximaData('2026-07-04', 'diaria')).toBe('2026-07-05')
    expect(proximaData('2026-07-04', 'semanal')).toBe('2026-07-11')
    expect(proximaData('2026-01-31', 'mensal')).toBe('2026-02-28')
  })
})

describe('calcularOcorrenciasPendentes', () => {
  it('gera todas as ocorrências mensais desde o início até hoje quando nada foi gerado ainda', () => {
    const pendentes = calcularOcorrenciasPendentes('2026-05-10', 'mensal', undefined, 0, '2026-07-15')

    expect(pendentes).toEqual([
      { numeroOcorrencia: 1, data: '2026-05-10' },
      { numeroOcorrencia: 2, data: '2026-06-10' },
      { numeroOcorrencia: 3, data: '2026-07-10' },
    ])
  })

  it('só gera o que falta a partir da última ocorrência já gerada', () => {
    const pendentes = calcularOcorrenciasPendentes('2026-05-10', 'mensal', undefined, 2, '2026-07-15')

    expect(pendentes).toEqual([{ numeroOcorrencia: 3, data: '2026-07-10' }])
  })

  it('não gera nada além de hoje, mesmo indeterminado', () => {
    const pendentes = calcularOcorrenciasPendentes('2026-07-01', 'diaria', undefined, 0, '2026-07-04')

    expect(pendentes).toEqual([
      { numeroOcorrencia: 1, data: '2026-07-01' },
      { numeroOcorrencia: 2, data: '2026-07-02' },
      { numeroOcorrencia: 3, data: '2026-07-03' },
      { numeroOcorrencia: 4, data: '2026-07-04' },
    ])
  })

  it('respeita o número de ocorrências quando não é indeterminado, mesmo que ainda estivesse "no prazo"', () => {
    const pendentes = calcularOcorrenciasPendentes('2026-07-01', 'semanal', 2, 0, '2026-12-31')

    expect(pendentes).toEqual([
      { numeroOcorrencia: 1, data: '2026-07-01' },
      { numeroOcorrencia: 2, data: '2026-07-08' },
    ])
  })

  it('não gera nada quando já está tudo em dia', () => {
    const pendentes = calcularOcorrenciasPendentes('2026-07-01', 'mensal', undefined, 1, '2026-07-15')
    expect(pendentes).toEqual([])
  })

  it('não gera nada quando a data de início ainda está no futuro', () => {
    const pendentes = calcularOcorrenciasPendentes('2026-08-01', 'mensal', undefined, 0, '2026-07-15')
    expect(pendentes).toEqual([])
  })
})
