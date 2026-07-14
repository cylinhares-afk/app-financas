import { useEffect, useState } from 'react'
import {
  criarFechamentoMensal,
  criarMovimentoEconomia,
  fetchCartoes,
  fetchEntradasDoMes,
  fetchFechamentoMensal,
  fetchGastosDoMes,
  fetchPrimeiraDataComMovimento,
} from '../../lib/queries'
import { hojeISO } from '../../lib/dataISO'
import { calcularPerformance } from '../totais/totais'
import { fetchGastoCartaoVencendoNoMes } from '../cartoes/cartaoVencendoNoMes'
import { calcularMesParaFechar, deveOferecerFechamento } from './fechamentoMes'

export interface FechamentoPendente {
  ano: number
  mes: number
  performance: number
}

/**
 * Verifica, na data real de hoje (não na data que o usuário está
 * navegando), se o mês anterior já pode ser fechado — e se ainda não foi
 * oferecido. Quando `pendente` não é null, o app deve mostrar
 * ModalFechamentoMes; `confirmar`/`recusar` gravam a resposta e nunca mais
 * perguntam sobre aquele mês (ver fechamentoMes.ts).
 */
export function useFechamentoPendente(ativo: boolean) {
  const [pendente, setPendente] = useState<FechamentoPendente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function verificar() {
    setCarregando(true)
    setErro(null)

    const mesAFechar = calcularMesParaFechar(hojeISO())

    const [primeiraDataResp, fechamentoResp] = await Promise.all([
      fetchPrimeiraDataComMovimento(),
      fetchFechamentoMensal(mesAFechar.ano, mesAFechar.mes),
    ])

    const primeiroErro = primeiraDataResp.erro ?? fechamentoResp.erro
    if (primeiroErro) {
      setErro(primeiroErro)
      setCarregando(false)
      return
    }

    if (!deveOferecerFechamento(mesAFechar, primeiraDataResp.dados, Boolean(fechamentoResp.dados))) {
      setPendente(null)
      setCarregando(false)
      return
    }

    const [entradasResp, gastosResp, cartoesResp] = await Promise.all([
      fetchEntradasDoMes(mesAFechar.ano, mesAFechar.mes),
      fetchGastosDoMes(mesAFechar.ano, mesAFechar.mes),
      fetchCartoes(),
    ])

    const erroCalculo = entradasResp.erro ?? gastosResp.erro ?? cartoesResp.erro
    if (erroCalculo) {
      setErro(erroCalculo)
      setCarregando(false)
      return
    }

    const cartaoVencendoNoMesResp = await fetchGastoCartaoVencendoNoMes(
      mesAFechar.ano,
      mesAFechar.mes,
      cartoesResp.dados,
    )
    if (cartaoVencendoNoMesResp.erro) {
      setErro(cartaoVencendoNoMesResp.erro)
      setCarregando(false)
      return
    }

    const entradasMes = entradasResp.dados.reduce((soma, entrada) => soma + entrada.valor, 0)
    const saidasDinheiroMes = gastosResp.dados
      .filter((gasto) => gasto.meioPagamento === 'dinheiro')
      .reduce((soma, gasto) => soma + gasto.valor, 0)

    setPendente({
      ano: mesAFechar.ano,
      mes: mesAFechar.mes,
      performance: calcularPerformance(entradasMes, saidasDinheiroMes, cartaoVencendoNoMesResp.dados),
    })
    setCarregando(false)
  }

  useEffect(() => {
    if (ativo) verificar()
  }, [ativo])

  async function confirmar() {
    if (!pendente) return
    const { erro: erroMovimento } = await criarMovimentoEconomia({
      ano: pendente.ano,
      mes: pendente.mes,
      valor: pendente.performance,
      origem: 'fechamento_mes',
    })
    if (erroMovimento) {
      setErro(erroMovimento)
      return
    }

    const { erro: erroFechamento } = await criarFechamentoMensal({ ...pendente, confirmado: true })
    if (erroFechamento) {
      setErro(erroFechamento)
      return
    }

    setPendente(null)
  }

  async function recusar() {
    if (!pendente) return
    const { erro: erroFechamento } = await criarFechamentoMensal({ ...pendente, confirmado: false })
    if (erroFechamento) {
      setErro(erroFechamento)
      return
    }

    setPendente(null)
  }

  return { pendente, carregando, erro, confirmar, recusar }
}
