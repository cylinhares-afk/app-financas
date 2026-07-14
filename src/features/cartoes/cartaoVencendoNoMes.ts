import { fetchGastosDoMes } from '../../lib/queries'
import { mesAnterior } from '../../lib/navegacaoMes'
import type { MesAno } from '../../lib/navegacaoMes'
import type { Cartao } from '../../types/domain'
import { filtrarGastosCartaoVencendoNoMes } from './faturaCartao'

/**
 * Soma o gasto de cartão que efetivamente VENCE no mês (ano, mes) — busca as
 * compras dos até 2 meses anteriores que podem gerar fatura vencendo aqui
 * (mesVencimentoDoGasto nunca tem lag maior que 2 meses entre compra e
 * vencimento) e soma só as que realmente vencem nesse mês, por cartão.
 */
export async function fetchGastoCartaoVencendoNoMes(
  ano: number,
  mes: number,
  cartoes: Cartao[],
): Promise<{ dados: number; erro: string | null }> {
  const mesAlvo: MesAno = { ano, mes }
  const umMesAntes = mesAnterior(mesAlvo)
  const doisMesesAntes = mesAnterior(umMesAntes)
  const mesesCandidatos = [doisMesesAntes, umMesAntes, mesAlvo]

  const respostas = await Promise.all(mesesCandidatos.map((m) => fetchGastosDoMes(m.ano, m.mes)))
  const erro = respostas.map((resposta) => resposta.erro).find((erroDoMes) => erroDoMes)
  if (erro) return { dados: 0, erro }

  const cartoesPorId = new Map(cartoes.map((cartao) => [cartao.id, cartao]))
  const gastosCandidatos = respostas.flatMap((resposta) => resposta.dados)
  const gastosQueVencemNoMes = filtrarGastosCartaoVencendoNoMes(gastosCandidatos, cartoesPorId, ano, mes)

  return { dados: gastosQueVencemNoMes.reduce((soma, gasto) => soma + gasto.valor, 0), erro: null }
}
