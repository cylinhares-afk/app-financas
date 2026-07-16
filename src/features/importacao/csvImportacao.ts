import * as Papa from 'papaparse'
import { formatarDataISO } from '../../lib/dataISO'
import type { GastoParaComparacao } from '../../lib/queries'
import type { Cartao, Categoria, Frequencia, MeioPagamento } from '../../types/domain'

/**
 * Importação em massa de SAÍDAS via CSV — entradas continuam sendo
 * lançadas manualmente. Reproduz exatamente o que a tela de Registro já
 * faz hoje pra cada tipo (ver TelaLancamento.tsx e executarImportacaoCSV.ts):
 *   - unico: um gasto normal.
 *   - recorrente: uma recorrência de verdade (sem número de ocorrências —
 *     o formato do CSV não tem essa coluna, então toda recorrência
 *     importada nasce indeterminada, igual ao padrão mais comum de
 *     migração de histórico: assinatura/aluguel contínuo).
 *   - parcelado: uma compra parcelada de verdade. O valor da coluna é o
 *     de CADA parcela (não o total) — sempre exige meio_pagamento=cartao,
 *     porque é assim que compra parcelada já funciona no app hoje (o
 *     Registro nem deixa escolher outro meio pra esse tipo).
 *
 * Este módulo só faz parse + validação + detecção de duplicata (tudo puro,
 * sem tocar no Supabase — quem já existe no banco é passado de fora) —
 * quem escreve de fato é executarImportacaoCSV.ts, chamado só depois que
 * o usuário confirma a prévia.
 */

export type TipoLancamentoCSV = 'unico' | 'recorrente' | 'parcelado'

export interface LinhaCSVValidada {
  linha: number // número da linha no arquivo (cabeçalho = linha 1)
  tipo: TipoLancamentoCSV
  data: string // ISO
  valor: number // valor de CADA parcela, se parcelado
  categoriaId?: string // presente quando a categoria já existe
  categoriaNomeNova?: string // presente quando precisa ser criada na confirmação
  meioPagamento: MeioPagamento
  cartaoId?: string
  descricao?: string
  parcelasTotal?: number // só parcelado
  frequencia?: Frequencia // só recorrente
}

export interface ErroLinhaCSV {
  linha: number
  mensagem: string
}

export interface ResultadoParseCSV {
  linhasValidas: LinhaCSVValidada[]
  erros: ErroLinhaCSV[]
  // nomes únicos (case-insensitive, grafia da primeira ocorrência), na
  // ordem em que apareceram no CSV.
  categoriasNovas: string[]
}

export const MODELO_CSV = `data,tipo,parcelas_total,frequencia,valor,categoria,meio_pagamento,cartao,descricao
15/01/2026,unico,,,45.90,Mercado,pix,,compra do mês
05/01/2026,recorrente,,mensal,55.90,Assinaturas,cartao,Nubank,Netflix
10/01/2026,parcelado,12,,250.00,Eletrônicos,cartao,Nubank,Notebook novo
`

function parseDataCSV(valor: string): string | null {
  const partes = valor.trim().split('/')
  if (partes.length !== 3) return null

  const [diaTexto, mesTexto, anoTexto] = partes
  if (anoTexto.length !== 4) return null

  const dia = Number(diaTexto)
  const mes = Number(mesTexto)
  const ano = Number(anoTexto)
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(ano)) return null

  // Confere que é uma data real (ex: 31/02 não vira "03/03" silenciosamente).
  const data = new Date(ano, mes - 1, dia)
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null

  return formatarDataISO(ano, mes, dia)
}

/**
 * Aceita tanto o formato brasileiro com separador de milhar ("1.127,52")
 * quanto formatos simples sem milhar, com ponto OU vírgula como decimal
 * ("107.99" ou "107,99"). Quando os dois caracteres aparecem juntos, o que
 * vem por último no texto é o separador decimal — o outro é descartado por
 * ser separador de milhar (funciona tanto pra "1.127,52" quanto pro
 * eventual "1,127.52" em formato americano). Com um só dos dois (ou
 * nenhum), esse único caractere já é tratado como decimal, sem exigir
 * milhar — é assim que "107.99"/"107,99" continuam funcionando.
 */
function parseValorCSV(valor: string): number | null {
  const texto = valor.trim()
  const posicaoPonto = texto.lastIndexOf('.')
  const posicaoVirgula = texto.lastIndexOf(',')

  let textoNormalizado: string
  if (posicaoPonto !== -1 && posicaoVirgula !== -1) {
    textoNormalizado =
      posicaoVirgula > posicaoPonto
        ? texto.replaceAll('.', '').replace(',', '.') // "1.127,52" -> "1127.52"
        : texto.replaceAll(',', '') // "1,127.52" -> "1127.52"
  } else if (posicaoVirgula !== -1) {
    textoNormalizado = texto.replace(',', '.') // "107,99" -> "107.99"
  } else {
    textoNormalizado = texto // "107.99" ou "1200" já estão prontos
  }

  const numero = Number(textoNormalizado)
  if (!Number.isFinite(numero) || numero <= 0) return null
  return numero
}

export function parseCSVImportacao(
  conteudoCSV: string,
  categoriasExistentes: Categoria[],
  cartoesExistentes: Cartao[],
): ResultadoParseCSV {
  const linhasValidas: LinhaCSVValidada[] = []
  const erros: ErroLinhaCSV[] = []
  const categoriasNovas: string[] = []
  const categoriasNovasPorChave = new Map<string, string>()

  const categoriasPorNome = new Map(categoriasExistentes.map((categoria) => [categoria.nome.trim().toLowerCase(), categoria]))
  const cartoesPorNome = new Map(cartoesExistentes.map((cartao) => [cartao.nome.trim(), cartao]))

  const { data: todasAsLinhas } = Papa.parse<string[]>(conteudoCSV, { skipEmptyLines: true })
  const linhasDeDados = todasAsLinhas.slice(1) // linha 1 é o cabeçalho

  linhasDeDados.forEach((colunas, indice) => {
    const numeroLinha = indice + 2

    function registrarErro(mensagem: string) {
      erros.push({ linha: numeroLinha, mensagem })
    }

    const [dataRaw, tipoRaw, parcelasRaw, frequenciaRaw, valorRaw, categoriaRaw, meioPagamentoRaw, cartaoRaw, descricaoRaw] =
      colunas.map((coluna) => coluna ?? '')

    const tipo = tipoRaw.trim().toLowerCase()
    if (tipo !== 'unico' && tipo !== 'recorrente' && tipo !== 'parcelado') {
      registrarErro(`tipo inválido "${tipoRaw.trim()}" (use unico, recorrente ou parcelado)`)
      return
    }

    const dataISO = parseDataCSV(dataRaw)
    if (!dataISO) {
      registrarErro(`data inválida "${dataRaw.trim()}" (use o formato dd/mm/aaaa)`)
      return
    }

    const valor = parseValorCSV(valorRaw)
    if (valor === null) {
      registrarErro(`valor inválido "${valorRaw.trim()}"`)
      return
    }

    const meioPagamento = meioPagamentoRaw.trim().toLowerCase()
    if (meioPagamento !== 'pix' && meioPagamento !== 'cartao') {
      registrarErro(`meio_pagamento inválido "${meioPagamentoRaw.trim()}" (use pix ou cartao)`)
      return
    }

    if (tipo === 'parcelado' && meioPagamento !== 'cartao') {
      registrarErro('compra parcelada precisa ter meio_pagamento "cartao"')
      return
    }

    let parcelasTotal: number | undefined
    if (tipo === 'parcelado') {
      const numeroParcelas = Number(parcelasRaw.trim())
      if (!Number.isInteger(numeroParcelas) || numeroParcelas < 2) {
        registrarErro('parcelas_total precisa ser um número inteiro de pelo menos 2 pra lançamentos parcelados')
        return
      }
      parcelasTotal = numeroParcelas
    }

    let frequencia: Frequencia | undefined
    if (tipo === 'recorrente') {
      const frequenciaNormalizada = frequenciaRaw.trim().toLowerCase()
      if (frequenciaNormalizada !== 'mensal' && frequenciaNormalizada !== 'semanal' && frequenciaNormalizada !== 'diaria') {
        registrarErro('frequencia é obrigatória (mensal, semanal ou diaria) pra lançamentos recorrentes')
        return
      }
      frequencia = frequenciaNormalizada
    }

    const categoriaNome = categoriaRaw.trim()
    if (!categoriaNome) {
      registrarErro('categoria é obrigatória')
      return
    }

    let categoriaId: string | undefined
    let categoriaNomeNova: string | undefined
    const chaveCategoria = categoriaNome.toLowerCase()
    const categoriaExistente = categoriasPorNome.get(chaveCategoria)
    if (categoriaExistente) {
      categoriaId = categoriaExistente.id
    } else {
      const grafiaJaVista = categoriasNovasPorChave.get(chaveCategoria)
      if (grafiaJaVista) {
        categoriaNomeNova = grafiaJaVista
      } else {
        categoriaNomeNova = categoriaNome
        categoriasNovasPorChave.set(chaveCategoria, categoriaNome)
        categoriasNovas.push(categoriaNome)
      }
    }

    let cartaoId: string | undefined
    if (meioPagamento === 'cartao') {
      const cartaoNome = cartaoRaw.trim()
      if (!cartaoNome) {
        registrarErro('cartão é obrigatório quando meio_pagamento é "cartao"')
        return
      }
      const cartaoExistente = cartoesPorNome.get(cartaoNome)
      if (!cartaoExistente) {
        registrarErro(`cartão '${cartaoNome}' não encontrado`)
        return
      }
      cartaoId = cartaoExistente.id
    }

    linhasValidas.push({
      linha: numeroLinha,
      tipo,
      data: dataISO,
      valor,
      categoriaId,
      categoriaNomeNova,
      meioPagamento,
      cartaoId,
      descricao: descricaoRaw.trim() || undefined,
      parcelasTotal,
      frequencia,
    })
  })

  return { linhasValidas, erros, categoriasNovas }
}

export interface ResultadoDeduplicacao {
  linhasNovas: LinhaCSVValidada[]
  linhasDuplicadas: LinhaCSVValidada[]
}

/** Chave de comparação pra achar duplicata: mesma categoria, meio de
 * pagamento, data, valor (em centavos, pra não sofrer de imprecisão de
 * ponto flutuante) e descrição (comparada só com espaços nas pontas
 * removidos) — exatamente os 5 campos pedidos. */
function chaveDeDuplicata(campos: {
  categoriaId: string
  meioPagamento: MeioPagamento
  data: string
  valor: number
  descricao?: string
}): string {
  const centavos = Math.round(campos.valor * 100)
  const descricaoNormalizada = (campos.descricao ?? '').trim()
  return `${campos.categoriaId}|${campos.meioPagamento}|${campos.data}|${centavos}|${descricaoNormalizada}`
}

/**
 * Separa as linhas já validadas em "novas" (serão importadas) e
 * "duplicadas" (já existe um gasto igual no banco — mesma data, valor,
 * categoria, meio de pagamento e descrição — então são puladas). Existe
 * pra permitir reimportar o mesmo CSV mais de uma vez (ex: depois de
 * corrigir linhas que falharam por outro motivo) sem duplicar o que já
 * entrou com sucesso.
 *
 * Uma linha com categoria NOVA (`categoriaNomeNova`) nunca pode ser
 * duplicata — por definição não existe nenhum gasto no banco referenciando
 * uma categoria que ainda não foi criada.
 *
 * Só compara contra o que já existe no banco (`gastosExistentes`), não
 * entre linhas do próprio CSV — duas linhas idênticas no mesmo arquivo, se
 * nenhuma delas já existir no banco, são importadas as duas.
 */
export function separarNovasEDuplicadas(
  linhasValidas: LinhaCSVValidada[],
  gastosExistentes: GastoParaComparacao[],
): ResultadoDeduplicacao {
  const chavesExistentes = new Set(gastosExistentes.map((gasto) => chaveDeDuplicata(gasto)))

  const linhasNovas: LinhaCSVValidada[] = []
  const linhasDuplicadas: LinhaCSVValidada[] = []

  for (const linha of linhasValidas) {
    const ehDuplicata =
      linha.categoriaId !== undefined &&
      chavesExistentes.has(
        chaveDeDuplicata({
          categoriaId: linha.categoriaId,
          meioPagamento: linha.meioPagamento,
          data: linha.data,
          valor: linha.valor,
          descricao: linha.descricao,
        }),
      )

    if (ehDuplicata) linhasDuplicadas.push(linha)
    else linhasNovas.push(linha)
  }

  return { linhasNovas, linhasDuplicadas }
}
