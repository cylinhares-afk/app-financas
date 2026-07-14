import { useCallback, useEffect, useState } from 'react'
import { fetchCategorias, fetchGastosDoMes, fetchTodasPrevisoes } from '../../lib/queries'
import { calcularOrcamentoDiarioTotal, getDiasNoMes, somarGastosCategoriaNoMes } from './calculations'
import type { OrcamentoDiarioTotal } from './calculations'
import { categoriasComPrevistoEfetivo } from './previsaoEfetiva'
import type { Categoria, PrevisaoMensal } from '../../types/domain'

const hoje = new Date()
const ANO_ATUAL = hoje.getFullYear()
const MES_ATUAL = hoje.getMonth() + 1

export function useOrcamentoMensal(ano: number, mes: number) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [todasPrevisoes, setTodasPrevisoes] = useState<PrevisaoMensal[]>([])
  const [orcamento, setOrcamento] = useState<OrcamentoDiarioTotal>({ porCategoria: [], totalDiario: 0 })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [diasNoMes, setDiasNoMes] = useState(() => getDiasNoMes(ano, mes))
  const [diaAtual, setDiaAtual] = useState(() => new Date().getDate())

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)

    const diasNoMesVisualizado = getDiasNoMes(ano, mes)
    setDiasNoMes(diasNoMesVisualizado)

    // "Dia de referência" pro cálculo do diário — mesma régua já usada em
    // Totais: no mês atual é hoje mesmo; num mês já passado, o último dia
    // (mês inteiro já consumado, estado final); num mês inteiramente
    // futuro, o primeiro dia (nada ainda gasto, previsto ÷ dias do mês).
    const ehMesAtual = ano === ANO_ATUAL && mes === MES_ATUAL
    const ehMesFuturo = ano > ANO_ATUAL || (ano === ANO_ATUAL && mes > MES_ATUAL)
    const diaDeReferencia = ehMesAtual ? new Date().getDate() : ehMesFuturo ? 1 : diasNoMesVisualizado
    setDiaAtual(diaDeReferencia)

    const [categoriasResp, previsoesResp, gastosResp] = await Promise.all([
      fetchCategorias(),
      fetchTodasPrevisoes(),
      fetchGastosDoMes(ano, mes),
    ])

    const primeiroErro = categoriasResp.erro ?? previsoesResp.erro ?? gastosResp.erro
    if (primeiroErro) {
      setErro(primeiroErro)
      setCarregando(false)
      return
    }

    // Categoria arquivada some da lista visível (cards e edição de
    // previsão), mas o resumo/diário abaixo continua somando o orçamento de
    // TODAS as categorias — arquivar não deve fazer o gasto real do mês
    // "desaparecer" da soma total.
    setCategorias(categoriasResp.dados.filter((categoria) => categoria.ativa))
    setTodasPrevisoes(previsoesResp.dados)

    const previstoPorCategoria = categoriasComPrevistoEfetivo(categoriasResp.dados, previsoesResp.dados, ano, mes)
    const categoriasComOrcamento = categoriasResp.dados.map((categoria) => ({
      categoriaId: categoria.id,
      previsto: previstoPorCategoria.find((c) => c.categoriaId === categoria.id)?.previsto ?? 0,
      gastoNoMes: somarGastosCategoriaNoMes(gastosResp.dados, categoria.id, ano, mes),
    }))

    setOrcamento(calcularOrcamentoDiarioTotal(categoriasComOrcamento, diaDeReferencia, diasNoMesVisualizado))
    setCarregando(false)
  }, [ano, mes])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { categorias, todasPrevisoes, orcamento, diasNoMes, diaAtual, carregando, erro, recarregar: carregar }
}
