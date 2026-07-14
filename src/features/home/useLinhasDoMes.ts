import { useCallback, useEffect, useState } from 'react'
import {
  fetchCategorias,
  fetchComprasParceladas,
  fetchEntradasDoMes,
  fetchFechamentosConfirmados,
  fetchGastosDoMes,
  fetchTodasPrevisoes,
  fetchPrimeiraDataComMovimento,
} from '../../lib/queries'
import { formatarDataISO, hojeISO } from '../../lib/dataISO'
import { calcularLinhasDoMes, calcularMesesAnteriores, proximoSaldoInicial } from './linhasDoMes'
import type { LinhaDia } from './linhasDoMes'
import { getDiasNoMes } from '../budget/calculations'
import { categoriasComPrevistoEfetivo } from '../budget/previsaoEfetiva'
import { gerarOcorrenciasRecorrentesPendentes } from '../lancamento/gerarOcorrenciasRecorrentes'
import type { Categoria, CompraParcelada } from '../../types/domain'

export function useLinhasDoMes(ano: number, mes: number) {
  const [linhas, setLinhas] = useState<LinhaDia[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [comprasParceladas, setComprasParceladas] = useState<CompraParcelada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)

    const hoje = hojeISO()
    const diasNoMesVisualizado = getDiasNoMes(ano, mes)
    const fimDoMesVisualizado = formatarDataISO(ano, mes, diasNoMesVisualizado)

    // Ao navegar pra um mês futuro, garante que recorrências indeterminadas
    // já estejam materializadas até o fim desse mês (senão a ocorrência
    // daquele mês simplesmente não existiria ainda como gasto/entrada real).
    const { erro: erroGerar } = await gerarOcorrenciasRecorrentesPendentes(fimDoMesVisualizado)
    if (erroGerar) {
      setErro(erroGerar)
      setCarregando(false)
      return
    }

    const [categoriasResp, comprasParceladasResp, primeiraDataResp, fechamentosResp, previsoesResp] =
      await Promise.all([
        fetchCategorias(),
        fetchComprasParceladas(),
        fetchPrimeiraDataComMovimento(),
        fetchFechamentosConfirmados(),
        fetchTodasPrevisoes(),
      ])

    const primeiroErro =
      categoriasResp.erro ??
      comprasParceladasResp.erro ??
      primeiraDataResp.erro ??
      fechamentosResp.erro ??
      previsoesResp.erro
    if (primeiroErro) {
      setErro(primeiroErro)
      setCarregando(false)
      return
    }

    const mesesFechadosComConfirmacao = new Set(
      fechamentosResp.dados.map(({ ano: anoFechado, mes: mesFechado }) => `${anoFechado}-${mesFechado}`),
    )

    // Meses entre o lançamento mais antigo e o mês visualizado: o saldo
    // final de cada um vira o saldo inicial do próximo, até chegar no mês
    // que o usuário está vendo — assim a visão fica contínua, não reseta.
    const mesesAnteriores = calcularMesesAnteriores(primeiraDataResp.dados, ano, mes)
    const todosOsMeses = [...mesesAnteriores, { ano, mes }]

    const respostasPorMes = await Promise.all(
      todosOsMeses.map(({ ano: anoDoMes, mes: mesDoMes }) =>
        Promise.all([fetchGastosDoMes(anoDoMes, mesDoMes), fetchEntradasDoMes(anoDoMes, mesDoMes)]),
      ),
    )

    const erroDeAlgumMes = respostasPorMes
      .flat()
      .map((resposta) => resposta.erro)
      .find((erroDoMes) => erroDoMes)
    if (erroDeAlgumMes) {
      setErro(erroDeAlgumMes)
      setCarregando(false)
      return
    }

    let saldoRodando = 0
    for (let i = 0; i < mesesAnteriores.length; i++) {
      const { ano: anoDoMes, mes: mesDoMes } = mesesAnteriores[i]
      const [gastosResp, entradasResp] = respostasPorMes[i]

      const linhasDoMesAnterior = calcularLinhasDoMes(
        entradasResp.dados,
        gastosResp.dados,
        categoriasComPrevistoEfetivo(categoriasResp.dados, previsoesResp.dados, anoDoMes, mesDoMes),
        anoDoMes,
        mesDoMes,
        hoje,
        comprasParceladasResp.dados,
        saldoRodando,
      )
      const saldoFinalDoMes = linhasDoMesAnterior[linhasDoMesAnterior.length - 1]?.saldoAcumulado ?? saldoRodando
      const mesFoiFechadoComConfirmacao = mesesFechadosComConfirmacao.has(`${anoDoMes}-${mesDoMes}`)
      saldoRodando = proximoSaldoInicial(saldoFinalDoMes, mesFoiFechadoComConfirmacao)
    }

    const [gastosVisto, entradasVisto] = respostasPorMes[respostasPorMes.length - 1]

    setLinhas(
      calcularLinhasDoMes(
        entradasVisto.dados,
        gastosVisto.dados,
        categoriasComPrevistoEfetivo(categoriasResp.dados, previsoesResp.dados, ano, mes),
        ano,
        mes,
        hoje,
        comprasParceladasResp.dados,
        saldoRodando,
      ),
    )
    setCategorias(categoriasResp.dados)
    setComprasParceladas(comprasParceladasResp.dados)
    setCarregando(false)
  }, [ano, mes])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { linhas, categorias, comprasParceladas, carregando, erro, recarregar: carregar }
}
