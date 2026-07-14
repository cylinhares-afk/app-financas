import { mesSeguinte } from '../../lib/navegacaoMes'
import type { MesAno } from '../../lib/navegacaoMes'
import { calcularPerformance } from '../totais/totais'

/** Lista os meses de `inicio` até `fim`, inclusive nos dois extremos. */
export function listarMesesEntre(inicio: MesAno, fim: MesAno): MesAno[] {
  const meses: MesAno[] = []
  let atual = inicio

  while (atual.ano < fim.ano || (atual.ano === fim.ano && atual.mes <= fim.mes)) {
    meses.push(atual)
    atual = mesSeguinte(atual)
  }

  return meses
}

export interface DadosMesProjetado extends MesAno {
  /** Entradas já lançadas + entradas recorrentes configuradas que caem nesse mês (ver useProjecaoReserva). */
  entradasPrevistas: number
  /** Previsto de todas as categorias nesse mês — já cobre parcelas/gastos pontuais futuros já sabidos. */
  saidasPrevistas: number
  /** Gasto real de cartão que efetivamente vence nesse mês (fechamento/vencimento reais, mesmo cálculo da Performance/Totais). */
  cartaoVencendoNoMes: number
}

export interface MesProjetado extends DadosMesProjetado {
  sobraPrevista: number
  /** Saldo da reserva acumulado até (e incluindo) esse mês, assumindo fechamento sempre confirmado. */
  saldoReservaProjetado: number
}

/**
 * Projeção de quanto a reserva de Economias deve acumular, mês a mês, se
 * cada fechamento de mês for sempre confirmado (a favor, na direção do
 * resultado — ver useFechamentoPendente). Reaproveita a mesma fórmula da
 * Performance real (calcularPerformance), só que com valores estimados no
 * lugar de gasto real (ver useProjecaoReserva pra como cada campo é
 * calculado).
 */
export function calcularProjecaoReserva(
  saldoAtualReserva: number,
  dadosPorMes: DadosMesProjetado[],
): MesProjetado[] {
  let saldoAcumulado = saldoAtualReserva

  return dadosPorMes.map((dados) => {
    const sobraPrevista = calcularPerformance(dados.entradasPrevistas, dados.saidasPrevistas, dados.cartaoVencendoNoMes)
    saldoAcumulado += sobraPrevista
    return { ...dados, sobraPrevista, saldoReservaProjetado: saldoAcumulado }
  })
}
