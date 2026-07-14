import { mesAnterior } from '../../lib/navegacaoMes'
import { parseDataISO } from '../../lib/dataISO'
import type { MesAno } from '../../lib/navegacaoMes'

/**
 * Fechamento de mês: só é oferecido sobre o mês imediatamente anterior ao
 * mês REAL de hoje — nunca sobre o mês que o usuário está navegando/vendo
 * na Home (ver useFechamentoPendente, que é quem chama isso com a data real
 * do sistema, não a data visualizada).
 */
export function calcularMesParaFechar(hojeISO: string): MesAno {
  const hoje = parseDataISO(hojeISO)
  return mesAnterior({ ano: hoje.ano, mes: hoje.mes })
}

/**
 * Só oferece o fechamento se: (1) ainda não existe registro de fechamento
 * pra esse mês — existir a linha (confirmado ou não) já marca "já
 * perguntado", garantindo que a oferta aconteça uma única vez; e (2) já
 * existe algum lançamento real desde antes ou dentro desse mês — evita
 * perguntar sobre meses que antecedem o início do uso do app.
 */
export function deveOferecerFechamento(
  mesAFechar: MesAno,
  primeiraDataComMovimentoISO: string | null,
  jaExisteRegistroDeFechamento: boolean,
): boolean {
  if (jaExisteRegistroDeFechamento) return false
  if (!primeiraDataComMovimentoISO) return false

  const primeira = parseDataISO(primeiraDataComMovimentoISO)
  const primeiraEhPosteriorAoMesAFechar =
    primeira.ano > mesAFechar.ano || (primeira.ano === mesAFechar.ano && primeira.mes > mesAFechar.mes)

  return !primeiraEhPosteriorAoMesAFechar
}
