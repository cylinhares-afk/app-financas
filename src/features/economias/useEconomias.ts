import { useEffect, useState } from 'react'
import {
  definirSaldoInicialEconomias,
  fetchMovimentosEconomias,
  fetchSaldoInicialEconomias,
} from '../../lib/queries'
import type { MovimentoEconomia } from '../../types/domain'

export function useEconomias() {
  const [saldoInicial, setSaldoInicial] = useState(0)
  const [movimentos, setMovimentos] = useState<MovimentoEconomia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    setErro(null)

    const [saldoResp, movimentosResp] = await Promise.all([
      fetchSaldoInicialEconomias(),
      fetchMovimentosEconomias(),
    ])

    const primeiroErro = saldoResp.erro ?? movimentosResp.erro
    if (primeiroErro) {
      setErro(primeiroErro)
      setCarregando(false)
      return
    }

    setSaldoInicial(saldoResp.dados)
    setMovimentos(movimentosResp.dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvarSaldoInicial(valor: number): Promise<boolean> {
    const { erro: erroSalvar } = await definirSaldoInicialEconomias(valor)
    if (erroSalvar) {
      setErro(erroSalvar)
      return false
    }
    setSaldoInicial(valor)
    return true
  }

  const saldoTotal = saldoInicial + movimentos.reduce((soma, movimento) => soma + movimento.valor, 0)

  return { saldoInicial, movimentos, saldoTotal, carregando, erro, salvarSaldoInicial }
}
