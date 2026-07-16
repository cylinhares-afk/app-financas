import { useEffect, useState } from 'react'
import { fetchCategorias, fetchCartoes, fetchEntradasDoMes, fetchGastosDoMes, fetchTodasPrevisoes } from '../../lib/queries'
import {
  calcularOrcamentoDiarioTotal,
  getDiasNoMes,
  somarGastosCategoriaNoMes,
} from '../budget/calculations'
import { categoriasComPrevistoEfetivo } from '../budget/previsaoEfetiva'
import { fetchGastoCartaoVencendoNoMes } from '../cartoes/cartaoVencendoNoMes'
import { calcularTotais } from './totais'
import type { ResultadoTotais } from './totais'

export function useTotais(ano: number, mes: number) {
  const [dados, setDados] = useState<ResultadoTotais | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro(null)

      const hoje = new Date()
      const anoAtual = hoje.getFullYear()
      const mesAtual = hoje.getMonth() + 1
      const diasNoMes = getDiasNoMes(ano, mes)

      const [entradasResp, gastosResp, categoriasResp, previsoesResp, cartoesResp] = await Promise.all([
        fetchEntradasDoMes(ano, mes),
        fetchGastosDoMes(ano, mes),
        fetchCategorias(),
        fetchTodasPrevisoes(),
        fetchCartoes(),
      ])

      const primeiroErro =
        entradasResp.erro ?? gastosResp.erro ?? categoriasResp.erro ?? previsoesResp.erro ?? cartoesResp.erro
      if (primeiroErro) {
        setErro(primeiroErro)
        setCarregando(false)
        return
      }

      const cartaoVencendoNoMesResp = await fetchGastoCartaoVencendoNoMes(ano, mes, cartoesResp.dados)
      if (cartaoVencendoNoMesResp.erro) {
        setErro(cartaoVencendoNoMesResp.erro)
        setCarregando(false)
        return
      }

      const entradasMes = entradasResp.dados.reduce((soma, entrada) => soma + entrada.valor, 0)
      const saidasPixMes = gastosResp.dados
        .filter((gasto) => gasto.meioPagamento === 'pix')
        .reduce((soma, gasto) => soma + gasto.valor, 0)
      const saidasTotalMes = gastosResp.dados.reduce((soma, gasto) => soma + gasto.valor, 0)
      const cartaoMesAtual = gastosResp.dados
        .filter((gasto) => gasto.meioPagamento === 'cartao')
        .reduce((soma, gasto) => soma + gasto.valor, 0)
      const cartaoVencendoNoMes = cartaoVencendoNoMesResp.dados

      // O "diário" precisa de um dia de referência dentro do mês visualizado:
      // no mês atual é hoje mesmo; num mês já passado, o último dia (estado
      // final, com o gasto real do mês inteiro já consumado); num mês
      // inteiramente futuro, o primeiro dia (ainda sem nenhum gasto,
      // equivale a previsto ÷ dias do mês).
      const ehMesAtual = ano === anoAtual && mes === mesAtual
      const ehMesFuturo = ano > anoAtual || (ano === anoAtual && mes > mesAtual)
      const diaDeReferencia = ehMesAtual ? hoje.getDate() : ehMesFuturo ? 1 : diasNoMes

      const previstoPorCategoria = categoriasComPrevistoEfetivo(categoriasResp.dados, previsoesResp.dados, ano, mes)
      const categoriasComOrcamento = categoriasResp.dados.map((categoria) => ({
        categoriaId: categoria.id,
        previsto: previstoPorCategoria.find((c) => c.categoriaId === categoria.id)?.previsto ?? 0,
        gastoNoMes: somarGastosCategoriaNoMes(gastosResp.dados, categoria.id, ano, mes),
      }))
      const { totalDiario } = calcularOrcamentoDiarioTotal(categoriasComOrcamento, diaDeReferencia, diasNoMes)

      setDados(
        calcularTotais({
          entradasMes,
          saidasPixMes,
          saidasTotalMes,
          cartaoMesAtual,
          cartaoVencendoNoMes,
          diarioHoje: totalDiario,
        }),
      )
      setCarregando(false)
    }

    carregar()
  }, [ano, mes])

  return { dados, carregando, erro }
}
