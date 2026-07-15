import type { Cartao, Categoria, CompraParcelada, MeioPagamento } from '../../types/domain'
import type { FiltroHome, LinhaDia } from './linhasDoMes'

/**
 * Lançamentos individuais de um dia, já formatados pra exibição — usado tanto
 * pra decidir se um dia "tem lançamento" (toque rápido: lista vs Registro
 * direto) quanto pra montar a tela de detalhe do dia.
 */
export interface ItemMovimento {
  id: string
  tipo: 'entrada' | 'saida'
  valor: number
  data: string // ISO date — usado pra pré-preencher a edição do lançamento
  rotulo: string
  descricao?: string // nota livre do lançamento, quando existir (só faz sentido pra saída)
  meioPagamento?: MeioPagamento // só faz sentido pra saída
  cartaoNome?: string // só quando meioPagamento === 'cartao' e o cartão ainda existe
  categoriaId?: string // só faz sentido pra saída — usado pra editar
  parcela?: { numero: number; total: number }
  compraParceladaId?: string // presente quando o gasto vem de uma compra parcelada (excluir por escopo)
  recorrenciaId?: string // presente quando o lançamento vem de uma recorrência (excluir por escopo)
  numeroOcorrencia?: number
}

export function itensDoDia(
  linha: LinhaDia,
  filtro: FiltroHome,
  categorias: Categoria[],
  comprasParceladas: CompraParcelada[],
  cartoes: Cartao[] = [],
): ItemMovimento[] {
  const itensEntrada: ItemMovimento[] = linha.itensEntradas.map((entrada) => ({
    id: entrada.id,
    tipo: 'entrada',
    valor: entrada.valor,
    data: entrada.data,
    rotulo: entrada.descricao || 'Entrada',
    recorrenciaId: entrada.recorrenciaId,
    numeroOcorrencia: entrada.numeroOcorrencia,
  }))

  const gastosRelevantes =
    filtro === 'cartao'
      ? linha.itensGastos.filter((gasto) => gasto.meioPagamento === 'cartao')
      : linha.itensGastos

  const itensSaida: ItemMovimento[] = gastosRelevantes.map((gasto) => {
    const compra = gasto.compraParceladaId
      ? comprasParceladas.find((c) => c.id === gasto.compraParceladaId)
      : undefined

    return {
      id: gasto.id,
      tipo: 'saida',
      valor: gasto.valor,
      data: gasto.data,
      rotulo: categorias.find((categoria) => categoria.id === gasto.categoriaId)?.nome ?? 'Categoria removida',
      descricao: gasto.descricao,
      meioPagamento: gasto.meioPagamento,
      cartaoNome: gasto.cartaoId ? cartoes.find((cartao) => cartao.id === gasto.cartaoId)?.nome : undefined,
      categoriaId: gasto.categoriaId,
      parcela: gasto.numeroParcela
        ? { numero: gasto.numeroParcela, total: compra?.numeroParcelas ?? gasto.numeroParcela }
        : undefined,
      compraParceladaId: gasto.compraParceladaId,
      recorrenciaId: gasto.recorrenciaId,
      numeroOcorrencia: gasto.numeroOcorrencia,
    }
  })

  if (filtro === 'entradas') return itensEntrada
  if (filtro === 'saidas' || filtro === 'cartao') return itensSaida
  if (filtro === 'todas') return [...itensEntrada, ...itensSaida]
  return [] // 'diarios' é um valor calculado, nunca tem lançamento próprio
}
