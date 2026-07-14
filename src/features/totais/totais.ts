/**
 * Tela Totais: régua de caixa real, diferente da régua de orçamento
 * comprometido usada em Categorias/Home. A diferença central é o cartão: uma
 * compra no cartão só "pesa" no caixa no mês em que a fatura VENCE de
 * verdade (fechamento + vencimento de cada cartão, ver
 * ../cartoes/faturaCartao.ts) — não no mês da compra, nem numa suposição
 * fixa de "sempre o mês seguinte".
 *
 * performance   = entradas do mês − saídas em dinheiro do mês − cartão que vence nesse mês
 * custo de vida = saídas em dinheiro do mês + cartão que vence nesse mês
 *
 * "Diário médio" mudou pra tela Categorias (lá é feito com a régua de
 * orçamento comprometido — ver calcularResumoCategorias). "Economizado"
 * fica de fora desta versão (a definir depois).
 */

export interface DadosTotais {
  entradasMes: number
  saidasDinheiroMes: number
  saidasTotalMes: number // informativo (todos os meios), pra lista de movimentações
  cartaoMesAtual: number // informativo, pra lista de movimentações
  cartaoVencendoNoMes: number // usado nos cálculos de caixa real
  diarioHoje: number // "diário disponível hoje", mesmo valor mostrado em Categorias/Home
}

export interface ResultadoTotais {
  performance: number
  custoDeVida: number
  entradasMes: number
  saidasMes: number
  cartaoMes: number
  diarioHoje: number
}

/**
 * Núcleo da régua de caixa real — extraída à parte porque o fechamento de
 * mês (Economias) também precisa do mesmo número, sem o resto de
 * DadosTotais que só serve pra tela Totais (ver useFechamentoPendente).
 */
export function calcularPerformance(
  entradasMes: number,
  saidasDinheiroMes: number,
  cartaoVencendoNoMes: number,
): number {
  return entradasMes - saidasDinheiroMes - cartaoVencendoNoMes
}

export function calcularTotais(dados: DadosTotais): ResultadoTotais {
  const custoDeVida = dados.saidasDinheiroMes + dados.cartaoVencendoNoMes
  const performance = calcularPerformance(dados.entradasMes, dados.saidasDinheiroMes, dados.cartaoVencendoNoMes)

  return {
    performance,
    custoDeVida,
    entradasMes: dados.entradasMes,
    saidasMes: dados.saidasTotalMes,
    cartaoMes: dados.cartaoMesAtual,
    diarioHoje: dados.diarioHoje,
  }
}
