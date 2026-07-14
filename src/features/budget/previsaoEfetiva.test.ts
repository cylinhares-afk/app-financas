import { describe, expect, it } from 'vitest'
import { categoriasComPrevistoEfetivo, resolverPrevisaoEfetiva } from './previsaoEfetiva'
import type { PrevisaoMensal } from '../../types/domain'

function previsao(parcial: Partial<PrevisaoMensal> & Pick<PrevisaoMensal, 'ano' | 'mes' | 'valorPrevisto'>): PrevisaoMensal {
  return { id: 'p', categoriaId: 'gatas', ...parcial }
}

describe('resolverPrevisaoEfetiva', () => {
  it('sem nenhuma previsão, devolve null (nunca existiu previsão pra essa categoria)', () => {
    expect(resolverPrevisaoEfetiva([], 2026, 7)).toBeNull()
  })

  it('mês com edição própria usa o valor daquele mês', () => {
    const previsoes = [previsao({ ano: 2026, mes: 7, valorPrevisto: 300 })]
    expect(resolverPrevisaoEfetiva(previsoes, 2026, 7)?.valorPrevisto).toBe(300)
  })

  it('mês sem edição própria herda o valor do mês anterior mais recente que foi editado', () => {
    const previsoes = [
      previsao({ ano: 2026, mes: 3, valorPrevisto: 200 }),
      previsao({ ano: 2026, mes: 7, valorPrevisto: 300 }),
    ]
    // agosto não tem edição própria: herda de julho (mais recente <= agosto)
    expect(resolverPrevisaoEfetiva(previsoes, 2026, 8)?.valorPrevisto).toBe(300)
    // maio também herda de julho? Não — maio é ANTES de julho, então só enxerga março.
    expect(resolverPrevisaoEfetiva(previsoes, 2026, 5)?.valorPrevisto).toBe(200)
  })

  it('mês anterior à primeira edição de todas não herda nada (null)', () => {
    const previsoes = [previsao({ ano: 2026, mes: 7, valorPrevisto: 300 })]
    expect(resolverPrevisaoEfetiva(previsoes, 2026, 1)).toBeNull()
  })

  it('editar um mês futuro não altera o valor efetivo de meses passados (nunca olha pra frente)', () => {
    const previsoes = [previsao({ ano: 2026, mes: 7, valorPrevisto: 300 })]
    // edição em setembro (futura em relação a julho)
    const previsoesComFutura = [...previsoes, previsao({ ano: 2026, mes: 9, valorPrevisto: 800 })]

    expect(resolverPrevisaoEfetiva(previsoesComFutura, 2026, 7)?.valorPrevisto).toBe(300)
    expect(resolverPrevisaoEfetiva(previsoesComFutura, 2026, 8)?.valorPrevisto).toBe(300)
  })

  it('meses depois da edição futura, sem edição própria, herdam o novo valor', () => {
    const previsoes = [
      previsao({ ano: 2026, mes: 7, valorPrevisto: 300 }),
      previsao({ ano: 2026, mes: 9, valorPrevisto: 800 }),
    ]
    expect(resolverPrevisaoEfetiva(previsoes, 2026, 9)?.valorPrevisto).toBe(800)
    expect(resolverPrevisaoEfetiva(previsoes, 2026, 10)?.valorPrevisto).toBe(800)
    expect(resolverPrevisaoEfetiva(previsoes, 2027, 1)?.valorPrevisto).toBe(800)
  })

  it('atravessa a virada de ano corretamente', () => {
    const previsoes = [previsao({ ano: 2025, mes: 12, valorPrevisto: 150 })]
    expect(resolverPrevisaoEfetiva(previsoes, 2026, 1)?.valorPrevisto).toBe(150)
  })
})

describe('categoriasComPrevistoEfetivo', () => {
  it('resolve cada categoria de forma independente, e usa 0 quando nunca houve previsão', () => {
    const categorias = [{ id: 'gatas' }, { id: 'mercado' }]
    const todasPrevisoes = [
      previsao({ categoriaId: 'gatas', ano: 2026, mes: 7, valorPrevisto: 300 }),
      previsao({ categoriaId: 'mercado', ano: 2026, mes: 9, valorPrevisto: 2000 }), // só existe a partir de setembro
    ]

    const resultado = categoriasComPrevistoEfetivo(categorias, todasPrevisoes, 2026, 8)

    expect(resultado.find((c) => c.categoriaId === 'gatas')?.previsto).toBe(300) // herda de julho
    expect(resultado.find((c) => c.categoriaId === 'mercado')?.previsto).toBe(0) // agosto é antes de setembro
  })
})
