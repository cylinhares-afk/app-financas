import { hojeISO } from '../../lib/dataISO'
import {
  criarEntrada,
  criarGasto,
  fetchCartoes,
  fetchRecorrencias,
  fetchUltimasOcorrenciasGeradas,
} from '../../lib/queries'
import { calcularOcorrenciasPendentes } from './recorrencia'

/**
 * Roda toda vez que o app abre, e também sempre que a Home navega pra um mês
 * futuro (ver useLinhasDoMes.ts): para cada recorrência ativa, gera como
 * `gastos`/`entradas` normais qualquer ocorrência que já "venceu" até
 * `dataLimiteISO` (hoje, por padrão) e ainda não tinha sido materializada.
 * É assim que uma recorrência "indeterminada" nunca precisa gerar o futuro
 * inteiro de uma vez — só o que já passou do previsto até o limite pedido.
 * Passar um limite além de hoje (ex: fim do mês sendo visualizado na Home)
 * materializa as ocorrências futuras necessárias pra aquele mês aparecer
 * completo — nunca um limite ANTES de hoje, pra não deixar de gerar o que já
 * era esperado até agora.
 */
export async function gerarOcorrenciasRecorrentesPendentes(
  dataLimiteISO?: string,
): Promise<{ erro: string | null }> {
  const [recorrenciasResp, ultimasResp, cartoesResp] = await Promise.all([
    fetchRecorrencias(),
    fetchUltimasOcorrenciasGeradas(),
    fetchCartoes(),
  ])

  const primeiroErro = recorrenciasResp.erro ?? ultimasResp.erro ?? cartoesResp.erro
  if (primeiroErro) return { erro: primeiroErro }

  const cartoesPorId = new Map(cartoesResp.dados.map((cartao) => [cartao.id, cartao]))

  const hoje = hojeISO()
  const limite = dataLimiteISO && dataLimiteISO > hoje ? dataLimiteISO : hoje

  for (const recorrencia of recorrenciasResp.dados) {
    const ultimaOcorrenciaGerada = ultimasResp.dados.get(recorrencia.id) ?? 0
    const pendentes = calcularOcorrenciasPendentes(
      recorrencia.dataInicio,
      recorrencia.frequencia,
      recorrencia.numeroOcorrencias,
      ultimaOcorrenciaGerada,
      limite,
    )

    for (const ocorrencia of pendentes) {
      if (recorrencia.tipoMovimento === 'entrada') {
        const { erro } = await criarEntrada({
          usuarioId: recorrencia.usuarioId,
          valor: recorrencia.valor,
          data: ocorrencia.data,
          descricao: recorrencia.descricao,
          recorrenciaId: recorrencia.id,
          numeroOcorrencia: ocorrencia.numeroOcorrencia,
        })
        if (erro) return { erro }
        continue
      }

      // Cada nova ocorrência é uma "compra nova" na visão do cartão — o
      // snapshot usa o fechamento/vencimento ATUAL do cartão (não o de
      // quando a recorrência foi criada, que pode já ter mudado).
      const cartaoDaOcorrencia = recorrencia.cartaoId ? cartoesPorId.get(recorrencia.cartaoId) : undefined

      const { erro } = await criarGasto({
        // tipoMovimento 'saida' sempre tem categoriaId/meioPagamento (garantido na criação)
        categoriaId: recorrencia.categoriaId as string,
        usuarioId: recorrencia.usuarioId,
        valor: recorrencia.valor,
        data: ocorrencia.data,
        meioPagamento: recorrencia.meioPagamento as 'dinheiro' | 'cartao',
        cartaoId: recorrencia.cartaoId,
        cartaoDiaFechamento: cartaoDaOcorrencia?.diaFechamento,
        cartaoDiaVencimento: cartaoDaOcorrencia?.diaVencimento,
        descricao: recorrencia.descricao,
        recorrenciaId: recorrencia.id,
        numeroOcorrencia: ocorrencia.numeroOcorrencia,
      })
      if (erro) return { erro }
    }
  }

  return { erro: null }
}
