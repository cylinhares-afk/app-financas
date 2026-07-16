/**
 * Tela Totais: régua de caixa real, diferente da régua de orçamento
 * comprometido usada em Categorias/Home. A diferença central é o cartão: uma
 * compra no cartão só "pesa" no caixa no mês em que a fatura VENCE de
 * verdade (fechamento + vencimento de cada cartão, ver
 * ../cartoes/faturaCartao.ts) — não no mês da compra, nem numa suposição
 * fixa de "sempre o mês seguinte".
 *
 * performance   = entradas do mês − saídas via pix do mês − cartão que vence nesse mês
 * custo de vida = saídas via pix do mês + cartão que vence nesse mês
 *
 * Projeção do mês e ritmo de economia usam a régua de orçamento
 * comprometido (mesma de calcularResumoCategorias em budget/calculations.ts)
 * pro gasto médio diário — diferente da régua de caixa real usada em
 * performance/custo de vida acima. "Economizado" fica de fora desta versão
 * (a definir depois).
 */

export interface DadosTotais {
  entradasMes: number
  saidasPixMes: number
  saidasTotalMes: number // informativo (todos os meios), pra lista de movimentações
  cartaoMesAtual: number // informativo, pra lista de movimentações
  cartaoVencendoNoMes: number // usado nos cálculos de caixa real
  totalPrevisto: number // soma do previsto de todas as categorias (régua de orçamento comprometido)
  gastoMedioDia: number // total gasto até hoje (régua de orçamento) ÷ dias já passados
  diasNoMes: number
}

export interface ResultadoTotais {
  performance: number
  custoDeVida: number
  entradasMes: number
  saidasMes: number
  cartaoMes: number
  totalPrevisto: number
  gastoProjetado: number
  diferencaProjecao: number
  previstoDia: number
  gastoMedioDia: number
  sobraProjetada: number
}

export interface ProjecaoMes {
  gastoProjetado: number
  diferenca: number
  previstoDia: number
}

/**
 * "Se eu continuar gastando nesse ritmo, como o mês fecha?" — projeta o
 * gasto médio diário observado até agora (régua de orçamento comprometido,
 * mesma de calcularResumoCategorias) pros dias restantes do mês.
 * previstoDia é fixo (totalPrevisto ÷ dias do mês), não recalcula com o
 * tempo — é só a referência de "quanto seria o ideal por dia".
 */
export function calcularProjecaoMes(
  totalPrevisto: number,
  gastoMedioDia: number,
  diasNoMes: number,
): ProjecaoMes {
  const gastoProjetado = gastoMedioDia * diasNoMes
  const previstoDia = totalPrevisto / diasNoMes
  const diferenca = gastoProjetado - totalPrevisto

  return { gastoProjetado, diferenca, previstoDia }
}

/**
 * Núcleo da régua de caixa real — extraída à parte porque o fechamento de
 * mês (Economias) também precisa do mesmo número, sem o resto de
 * DadosTotais que só serve pra tela Totais (ver useFechamentoPendente).
 */
export function calcularPerformance(
  entradasMes: number,
  saidasPixMes: number,
  cartaoVencendoNoMes: number,
): number {
  return entradasMes - saidasPixMes - cartaoVencendoNoMes
}

export function calcularTotais(dados: DadosTotais): ResultadoTotais {
  const custoDeVida = dados.saidasPixMes + dados.cartaoVencendoNoMes
  const performance = calcularPerformance(dados.entradasMes, dados.saidasPixMes, dados.cartaoVencendoNoMes)
  const { gastoProjetado, diferenca, previstoDia } = calcularProjecaoMes(
    dados.totalPrevisto,
    dados.gastoMedioDia,
    dados.diasNoMes,
  )
  // Proxy pra "entradas do mês inteiro": assume que a renda já caiu até
  // agora (válido na maioria dos meses; entrada atrasada, ex. PJ, deixa
  // esse número impreciso naquele mês específico — limitação conhecida).
  const sobraProjetada = dados.entradasMes - gastoProjetado

  return {
    performance,
    custoDeVida,
    entradasMes: dados.entradasMes,
    saidasMes: dados.saidasTotalMes,
    cartaoMes: dados.cartaoMesAtual,
    totalPrevisto: dados.totalPrevisto,
    gastoProjetado,
    diferencaProjecao: diferenca,
    previstoDia,
    gastoMedioDia: dados.gastoMedioDia,
    sobraProjetada,
  }
}
