import type { Gasto } from '../../types/domain'
import { parseDataISO } from '../../lib/dataISO'

/**
 * Núcleo do app: orçamento diário por categoria.
 *
 * restante = previsto - gasto_no_mes
 * dias_restantes = dias_do_mes - dia_atual + 1
 * valor_diario = restante / dias_restantes
 *
 * Recalculado a cada gasto lançado, nunca fixo (ver especificação).
 */

export interface OrcamentoCategoriaInput {
  previsto: number
  gastoNoMes: number
  diaAtual: number
  diasNoMes: number
}

export interface OrcamentoCategoriaResultado {
  previsto: number
  gastoNoMes: number
  restante: number
  diasRestantes: number
  valorDiario: number
}

export function getDiasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

export function calcularOrcamentoCategoria(
  input: OrcamentoCategoriaInput,
): OrcamentoCategoriaResultado {
  const { previsto, gastoNoMes, diaAtual, diasNoMes } = input
  const restante = previsto - gastoNoMes
  // diaAtual pode chegar em diasNoMes (último dia); nunca deixamos diasRestantes zerar.
  const diasRestantes = Math.max(1, diasNoMes - diaAtual + 1)
  const valorDiario = restante / diasRestantes

  return { previsto, gastoNoMes, restante, diasRestantes, valorDiario }
}

export interface CategoriaComOrcamento {
  categoriaId: string
  previsto: number
  gastoNoMes: number
}

export interface OrcamentoPorCategoria extends OrcamentoCategoriaResultado {
  categoriaId: string
}

export interface OrcamentoDiarioTotal {
  porCategoria: OrcamentoPorCategoria[]
  totalDiario: number
}

/** Soma do valor_diario de todas as categorias — é isso que aparece como "diário" na home. */
export function calcularOrcamentoDiarioTotal(
  categorias: CategoriaComOrcamento[],
  diaAtual: number,
  diasNoMes: number,
): OrcamentoDiarioTotal {
  const porCategoria = categorias.map((categoria) => ({
    categoriaId: categoria.categoriaId,
    ...calcularOrcamentoCategoria({
      previsto: categoria.previsto,
      gastoNoMes: categoria.gastoNoMes,
      diaAtual,
      diasNoMes,
    }),
  }))

  const totalDiario = porCategoria.reduce((soma, categoria) => soma + categoria.valorDiario, 0)

  return { porCategoria, totalDiario }
}

export interface ResumoCategorias {
  totalPrevisto: number
  totalGasto: number
  sobra: number
  diarioMedio: number
  diarioPrevistoHoje: number
}

/**
 * Resumo agregado do topo da tela Categorias — mesma régua de cada card
 * individual (orçamento comprometido: gasto de cartão conta na hora da
 * compra, não no mês da fatura). Diferente da tela Totais, que usa régua de
 * fluxo de caixa com defasagem de cartão de um mês.
 */
export function calcularResumoCategorias(
  porCategoria: OrcamentoPorCategoria[],
  diaAtual: number,
): ResumoCategorias {
  const totalPrevisto = porCategoria.reduce((soma, categoria) => soma + categoria.previsto, 0)
  const totalGasto = porCategoria.reduce((soma, categoria) => soma + categoria.gastoNoMes, 0)
  const sobra = totalPrevisto - totalGasto
  const diasPassados = Math.max(1, diaAtual)
  const diarioMedio = totalGasto / diasPassados
  const diarioPrevistoHoje = porCategoria.reduce((soma, categoria) => soma + categoria.valorDiario, 0)

  return { totalPrevisto, totalGasto, sobra, diarioMedio, diarioPrevistoHoje }
}

/** Soma os gastos de uma categoria dentro de um mês/ano específico, a partir dos lançamentos. */
export function somarGastosCategoriaNoMes(
  gastos: Gasto[],
  categoriaId: string,
  ano: number,
  mes: number,
): number {
  return gastos
    .filter((gasto) => gasto.categoriaId === categoriaId)
    .filter((gasto) => {
      const data = parseDataISO(gasto.data)
      return data.ano === ano && data.mes === mes
    })
    .reduce((soma, gasto) => soma + gasto.valor, 0)
}
