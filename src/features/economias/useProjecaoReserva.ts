import { useEffect, useState } from 'react'
import {
  fetchCategorias,
  fetchCartoes,
  fetchEntradasDoMes,
  fetchTodasPrevisoes,
  fetchRecorrencias,
  fetchUltimasOcorrenciasGeradas,
} from '../../lib/queries'
import { formatarDataISO, hojeISO, parseDataISO } from '../../lib/dataISO'
import { getDiasNoMes } from '../budget/calculations'
import { categoriasComPrevistoEfetivo } from '../budget/previsaoEfetiva'
import { fetchGastoCartaoVencendoNoMes } from '../cartoes/cartaoVencendoNoMes'
import type { MesAno } from '../../lib/navegacaoMes'
import { calcularOcorrenciasPendentes } from '../lancamento/recorrencia'
import { calcularProjecaoReserva, listarMesesEntre } from './projecaoReserva'
import type { DadosMesProjetado, MesProjetado } from './projecaoReserva'

/**
 * Projeção da reserva de Economias entre hoje e um mês-alvo futuro,
 * assumindo que cada fechamento de mês vai ser confirmado. NÃO escreve nada
 * no banco — diferente de gerarOcorrenciasRecorrentesPendentes (que
 * materializa ocorrências reais quando a Home navega pro futuro), aqui as
 * ocorrências recorrentes ainda não geradas são só calculadas em memória
 * (calcularOcorrenciasPendentes), porque isso é uma simulação, não um
 * lançamento de verdade.
 *
 * Entradas de cada mês projetado = entradas já lançadas (reais, incluindo
 * recorrências já materializadas) + entradas recorrentes configuradas que
 * ainda não foram materializadas mas caem nesse mês (sem duplicar: a
 * contagem de "última ocorrência gerada" garante que cada ocorrência entra
 * uma única vez, materializada OU calculada, nunca as duas).
 */
export function useProjecaoReserva(
  mesAlvoAno: number | null,
  mesAlvoMes: number | null,
  saldoAtualReserva: number,
) {
  const [projecao, setProjecao] = useState<MesProjetado[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (mesAlvoAno === null || mesAlvoMes === null) {
      setProjecao(null)
      return
    }
    const mesAlvo: MesAno = { ano: mesAlvoAno, mes: mesAlvoMes }

    async function carregar() {
      setCarregando(true)
      setErro(null)

      const hoje = parseDataISO(hojeISO())
      const meses = listarMesesEntre({ ano: hoje.ano, mes: hoje.mes }, mesAlvo)
      const fimMesAlvo = formatarDataISO(mesAlvo.ano, mesAlvo.mes, getDiasNoMes(mesAlvo.ano, mesAlvo.mes))

      const [recorrenciasResp, ultimasResp, categoriasResp, previsoesResp, cartoesResp] = await Promise.all([
        fetchRecorrencias(),
        fetchUltimasOcorrenciasGeradas(),
        fetchCategorias(),
        fetchTodasPrevisoes(),
        fetchCartoes(),
      ])

      const primeiroErro =
        recorrenciasResp.erro ?? ultimasResp.erro ?? categoriasResp.erro ?? previsoesResp.erro ?? cartoesResp.erro
      if (primeiroErro) {
        setErro(primeiroErro)
        setCarregando(false)
        return
      }

      // Ocorrências de ENTRADA recorrente que ainda não foram materializadas
      // como `entradas` de verdade, até o fim do mês-alvo — puramente
      // calculado, sem tocar no banco (ver doc do hook).
      const entradasRecorrentesPendentes = recorrenciasResp.dados
        .filter((recorrencia) => recorrencia.tipoMovimento === 'entrada')
        .flatMap((recorrencia) =>
          calcularOcorrenciasPendentes(
            recorrencia.dataInicio,
            recorrencia.frequencia,
            recorrencia.numeroOcorrencias,
            ultimasResp.dados.get(recorrencia.id) ?? 0,
            fimMesAlvo,
          ).map((ocorrencia) => ({ data: ocorrencia.data, valor: recorrencia.valor })),
        )

      const resultadosPorMes = await Promise.all(
        meses.map(async (mesDoLoop): Promise<{ dados: DadosMesProjetado | null; erro: string | null }> => {
          const [entradasResp, cartaoVencendoNoMesResp] = await Promise.all([
            fetchEntradasDoMes(mesDoLoop.ano, mesDoLoop.mes),
            fetchGastoCartaoVencendoNoMes(mesDoLoop.ano, mesDoLoop.mes, cartoesResp.dados),
          ])

          const erroDoMes = entradasResp.erro ?? cartaoVencendoNoMesResp.erro
          if (erroDoMes) return { dados: null, erro: erroDoMes }

          const entradasReais = entradasResp.dados.reduce((soma, entrada) => soma + entrada.valor, 0)
          const entradasRecorrentesDoMes = entradasRecorrentesPendentes
            .filter((ocorrencia) => {
              const data = parseDataISO(ocorrencia.data)
              return data.ano === mesDoLoop.ano && data.mes === mesDoLoop.mes
            })
            .reduce((soma, ocorrencia) => soma + ocorrencia.valor, 0)

          const previstoPorCategoria = categoriasComPrevistoEfetivo(
            categoriasResp.dados,
            previsoesResp.dados,
            mesDoLoop.ano,
            mesDoLoop.mes,
          )
          const saidasPrevistas = previstoPorCategoria.reduce((soma, categoria) => soma + categoria.previsto, 0)

          return {
            dados: {
              ano: mesDoLoop.ano,
              mes: mesDoLoop.mes,
              entradasPrevistas: entradasReais + entradasRecorrentesDoMes,
              saidasPrevistas,
              cartaoVencendoNoMes: cartaoVencendoNoMesResp.dados,
            },
            erro: null,
          }
        }),
      )

      const erroDeAlgumMes = resultadosPorMes.map((resultado) => resultado.erro).find((erroDoMes) => erroDoMes)
      if (erroDeAlgumMes) {
        setErro(erroDeAlgumMes)
        setCarregando(false)
        return
      }

      const dadosPorMes = resultadosPorMes.map((resultado) => resultado.dados as DadosMesProjetado)
      setProjecao(calcularProjecaoReserva(saldoAtualReserva, dadosPorMes))
      setCarregando(false)
    }

    carregar()
  }, [mesAlvoAno, mesAlvoMes, saldoAtualReserva])

  return { projecao, carregando, erro }
}
