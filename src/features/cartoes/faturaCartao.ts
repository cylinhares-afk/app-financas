import { parseDataISO } from '../../lib/dataISO'
import { mesSeguinte } from '../../lib/navegacaoMes'
import type { MesAno } from '../../lib/navegacaoMes'
import type { Gasto } from '../../types/domain'

export interface CartaoParaFatura {
  id: string
  diaFechamento: number // 1-31
  diaVencimento: number // 1-31
}

/**
 * Mês/ano em que uma compra no cartão efetivamente VENCE — pesa no fluxo de
 * caixa (Performance/Sobrou, Custo de vida, projeção de Economias) só
 * quando a fatura que a contém vence, não no mês da compra. Duas etapas:
 *
 * 1. Em qual fatura a compra cai: se o dia da compra é até o dia de
 *    fechamento, cai na fatura que fecha NESSE mesmo mês; depois do
 *    fechamento, cai na fatura que só fecha no mês seguinte.
 * 2. Quando essa fatura vence: se o dia de vencimento é igual ou depois do
 *    dia de fechamento, vence no MESMO mês do fechamento (ex: fecha dia 20,
 *    vence dia 27); se é antes, vence no mês SEGUINTE ao fechamento (ex:
 *    fecha dia 20, vence dia 5 do mês seguinte).
 *
 * `diaFechamento`/`diaVencimento` vêm do SNAPSHOT gravado no gasto no
 * momento da compra (Gasto.cartaoDiaFechamento/cartaoDiaVencimento) — nunca
 * de uma consulta ao cartão atual, pra uma edição posterior do cartão não
 * mudar retroativamente o vencimento de compras já lançadas (ver
 * obterRegrasFatura). O lag entre mês da compra e mês de vencimento é
 * sempre 0, 1 ou 2 meses (nunca mais) — usado por cartaoVencendoNoMes.ts
 * pra saber quantos meses de compras candidatas buscar.
 */
export function mesVencimentoDoGasto(diaFechamento: number, diaVencimento: number, dataCompraISO: string): MesAno {
  const { ano, mes, dia } = parseDataISO(dataCompraISO)
  const mesFechamento: MesAno = dia <= diaFechamento ? { ano, mes } : mesSeguinte({ ano, mes })
  return diaVencimento >= diaFechamento ? mesFechamento : mesSeguinte(mesFechamento)
}

/**
 * Regras de fatura (fechamento/vencimento) efetivas de um gasto: o
 * snapshot gravado nele mesmo tem prioridade (é o que valia quando a
 * compra foi feita); só cai pro cartão ATUAL como fallback em gastos
 * lançados antes dessa coluna existir (têm cartaoId mas não o snapshot).
 * Sem nenhum dos dois, devolve null (fallback final: sempre mês seguinte).
 */
function obterRegrasFatura(
  gasto: Gasto,
  cartoesPorId: Map<string, CartaoParaFatura>,
): { diaFechamento: number; diaVencimento: number } | null {
  if (gasto.cartaoDiaFechamento != null && gasto.cartaoDiaVencimento != null) {
    return { diaFechamento: gasto.cartaoDiaFechamento, diaVencimento: gasto.cartaoDiaVencimento }
  }

  const cartao = gasto.cartaoId ? cartoesPorId.get(gasto.cartaoId) : undefined
  return cartao ? { diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento } : null
}

/**
 * Filtra, dentre gastos de cartão candidatos (de qualquer mês de compra), só
 * os que efetivamente vencem no mês (ano, mes) alvo.
 */
export function filtrarGastosCartaoVencendoNoMes(
  gastosCandidatos: Gasto[],
  cartoesPorId: Map<string, CartaoParaFatura>,
  ano: number,
  mes: number,
): Gasto[] {
  return gastosCandidatos.filter((gasto) => {
    if (gasto.meioPagamento !== 'cartao') return false

    const regras = obterRegrasFatura(gasto, cartoesPorId)
    const vencimento = regras
      ? mesVencimentoDoGasto(regras.diaFechamento, regras.diaVencimento, gasto.data)
      : mesSeguinte(parseDataISO(gasto.data))

    return vencimento.ano === ano && vencimento.mes === mes
  })
}
