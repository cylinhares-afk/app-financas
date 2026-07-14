import { useEffect, useState } from 'react'
import { atualizarCartao, criarCartao, excluirCartao, fetchCartoes } from '../../lib/queries'
import type { DadosCartao } from '../../lib/queries'
import type { Cartao } from '../../types/domain'

export function useCartoes() {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    setErro(null)

    const { dados, erro: erroBusca } = await fetchCartoes()
    if (erroBusca) {
      setErro(erroBusca)
      setCarregando(false)
      return
    }

    setCartoes(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionar(dados: DadosCartao): Promise<boolean> {
    const { erro: erroCriar } = await criarCartao(dados)
    if (erroCriar) {
      setErro(erroCriar)
      return false
    }
    await carregar()
    return true
  }

  async function editar(id: string, dados: DadosCartao): Promise<boolean> {
    const { erro: erroEditar } = await atualizarCartao(id, dados)
    if (erroEditar) {
      setErro(erroEditar)
      return false
    }
    await carregar()
    return true
  }

  async function excluir(id: string): Promise<boolean> {
    const { erro: erroExcluir } = await excluirCartao(id)
    if (erroExcluir) {
      setErro(erroExcluir)
      return false
    }
    await carregar()
    return true
  }

  return { cartoes, carregando, erro, adicionar, editar, excluir }
}
