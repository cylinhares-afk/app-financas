import { criarCategoria, criarCompraParcelada, criarGasto, criarRecorrencia } from '../../lib/queries'
import { calcularParcelas } from '../lancamento/parcelamento'
import { gerarOcorrenciasRecorrentesPendentes } from '../lancamento/gerarOcorrenciasRecorrentes'
import type { LinhaCSVValidada } from './csvImportacao'
import type { Cartao } from '../../types/domain'

export interface FalhaImportacaoCSV {
  linha: number
  mensagem: string
}

export interface ResultadoImportacaoCSV {
  sucesso: number
  falhas: FalhaImportacaoCSV[]
}

/** Só entra em ação depois que o usuário confirma a prévia — cria de fato,
 * pela mesma sequência de chamadas que a tela de Registro já usa pra cada
 * tipo (ver TelaLancamento.tsx). Linhas já validadas por parseCSVImportacao
 * ainda podem falhar aqui (erro de rede/Supabase), então cada linha é
 * tratada de forma independente — uma falha não derruba as outras. */
export async function executarImportacaoCSV(
  linhas: LinhaCSVValidada[],
  cartoesPorId: Map<string, Cartao>,
  usuarioId: string,
): Promise<ResultadoImportacaoCSV> {
  const falhas: FalhaImportacaoCSV[] = []
  let sucesso = 0

  // Categorias novas primeiro — uma vez cada, reaproveitando o id em todas
  // as linhas que a referenciam.
  const nomesCategoriasNovas = [
    ...new Set(linhas.map((linha) => linha.categoriaNomeNova).filter((nome): nome is string => Boolean(nome))),
  ]
  const idsPorCategoriaNova = new Map<string, string>()
  for (const nome of nomesCategoriasNovas) {
    const { id, erro } = await criarCategoria(nome)
    if (erro || !id) {
      const mensagem = `não foi possível criar a categoria "${nome}": ${erro ?? 'erro desconhecido'}`
      for (const linha of linhas.filter((l) => l.categoriaNomeNova === nome)) {
        falhas.push({ linha: linha.linha, mensagem })
      }
      continue
    }
    idsPorCategoriaNova.set(nome, id)
  }

  let houveRecorrenciaCriada = false

  for (const linha of linhas) {
    if (falhas.some((falha) => falha.linha === linha.linha)) continue // categoria dela já falhou acima

    const categoriaId = linha.categoriaId ?? (linha.categoriaNomeNova ? idsPorCategoriaNova.get(linha.categoriaNomeNova) : undefined)
    if (!categoriaId) {
      falhas.push({ linha: linha.linha, mensagem: 'categoria não pôde ser resolvida' })
      continue
    }

    const cartao = linha.cartaoId ? cartoesPorId.get(linha.cartaoId) : undefined
    const erro = await criarLancamento(linha, categoriaId, cartao, usuarioId)

    if (erro) {
      falhas.push({ linha: linha.linha, mensagem: erro })
      continue
    }

    if (linha.tipo === 'recorrente') houveRecorrenciaCriada = true
    sucesso++
  }

  // Materializa, de uma vez só, as ocorrências vencidas até hoje de TODAS as
  // recorrências criadas no lote — mesma função que já roda toda vez que o
  // app abre (ver App.tsx).
  if (houveRecorrenciaCriada) {
    await gerarOcorrenciasRecorrentesPendentes()
  }

  return { sucesso, falhas }
}

async function criarLancamento(
  linha: LinhaCSVValidada,
  categoriaId: string,
  cartao: Cartao | undefined,
  usuarioId: string,
): Promise<string | null> {
  if (linha.tipo === 'unico') {
    const { erro } = await criarGasto({
      categoriaId,
      usuarioId,
      valor: linha.valor,
      data: linha.data,
      meioPagamento: linha.meioPagamento,
      cartaoId: linha.cartaoId,
      cartaoDiaFechamento: cartao?.diaFechamento,
      cartaoDiaVencimento: cartao?.diaVencimento,
      descricao: linha.descricao,
    })
    return erro
  }

  if (linha.tipo === 'parcelado') {
    if (linha.parcelasTotal === undefined) return 'parcelas_total ausente (não deveria acontecer numa linha já validada)'

    // O CSV dá o valor de CADA parcela — o total é um múltiplo exato dele,
    // então calcularParcelas devolve cada parcela com esse mesmo valor,
    // sem sobra de centavos pra distribuir.
    const valorTotal = Math.round(linha.valor * linha.parcelasTotal * 100) / 100

    const { id: compraId, erro: erroCompra } = await criarCompraParcelada({
      categoriaId,
      valorTotal,
      numeroParcelas: linha.parcelasTotal,
      dataCompra: linha.data,
      descricao: linha.descricao,
    })
    if (erroCompra || !compraId) return erroCompra ?? 'erro ao criar a compra parcelada'

    const parcelas = calcularParcelas(valorTotal, linha.parcelasTotal, linha.data)
    for (const parcela of parcelas) {
      const { erro: erroParcela } = await criarGasto({
        categoriaId,
        usuarioId,
        valor: parcela.valor,
        data: parcela.data,
        meioPagamento: 'cartao',
        cartaoId: linha.cartaoId,
        cartaoDiaFechamento: cartao?.diaFechamento,
        cartaoDiaVencimento: cartao?.diaVencimento,
        descricao: linha.descricao,
        compraParceladaId: compraId,
        numeroParcela: parcela.numero,
      })
      if (erroParcela) return erroParcela
    }
    return null
  }

  // recorrente
  if (linha.frequencia === undefined) return 'frequencia ausente (não deveria acontecer numa linha já validada)'

  const { erro } = await criarRecorrencia({
    tipoMovimento: 'saida',
    categoriaId,
    usuarioId,
    valor: linha.valor,
    meioPagamento: linha.meioPagamento,
    cartaoId: linha.cartaoId,
    frequencia: linha.frequencia,
    dataInicio: linha.data,
    descricao: linha.descricao,
  })
  return erro
}
