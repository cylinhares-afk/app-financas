import type { PrevisaoMensal } from '../../types/domain'

function comparaAnoMes(a: { ano: number; mes: number }, b: { ano: number; mes: number }): number {
  return a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes
}

/**
 * Previsão EFETIVA de uma categoria num mês: a edição manual mais recente
 * feita NAQUELE mês ou ANTES dele — nunca olha pra frente, então editar um
 * mês futuro nunca muda retroativamente um mês passado. Sem nenhuma edição
 * até ali (nem nesse mês, nem antes), devolve null — não existia previsão
 * pra essa época, ponto (equivalente a 0 pra quem só quer o valor).
 *
 * Meses sem edição própria "herdam" o resultado daqui automaticamente: como
 * a busca já inclui "esse mês ou antes", um mês sem linha própria cai
 * naturalmente na edição mais recente de um mês anterior.
 */
export function resolverPrevisaoEfetiva(
  previsoesDaCategoria: PrevisaoMensal[],
  ano: number,
  mes: number,
): PrevisaoMensal | null {
  const candidatas = previsoesDaCategoria.filter((previsao) => comparaAnoMes(previsao, { ano, mes }) <= 0)
  if (candidatas.length === 0) return null

  return candidatas.reduce((maisRecente, atual) =>
    comparaAnoMes(atual, maisRecente) > 0 ? atual : maisRecente,
  )
}

export interface CategoriaComPrevistoEfetivo {
  categoriaId: string
  previsto: number
}

/** Mesma resolução acima, mas pra todas as categorias de uma vez — o formato que os cálculos de orçamento consomem. */
export function categoriasComPrevistoEfetivo(
  categorias: { id: string }[],
  todasPrevisoes: PrevisaoMensal[],
  ano: number,
  mes: number,
): CategoriaComPrevistoEfetivo[] {
  return categorias.map((categoria) => {
    const previsoesDaCategoria = todasPrevisoes.filter((previsao) => previsao.categoriaId === categoria.id)
    const efetiva = resolverPrevisaoEfetiva(previsoesDaCategoria, ano, mes)
    return { categoriaId: categoria.id, previsto: efetiva?.valorPrevisto ?? 0 }
  })
}
