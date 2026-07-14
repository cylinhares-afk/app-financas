import { formatarDataISO, parseDataISO } from '../../lib/dataISO'
import { calcularOrcamentoCategoria, getDiasNoMes } from '../budget/calculations'
import { getStatusSaldo } from './saldoDiario'
import type { StatusSaldo } from './saldoDiario'
import type { CompraParcelada, Entrada, Gasto } from '../../types/domain'

/**
 * Home: cada dia de um mês (qualquer mês navegado, não só o atual) com o
 * valor de entradas/saídas/cartão daquele dia, o "diário" projetado, os
 * lançamentos individuais (pra lista de detalhe), e o saldo acumulado (com a
 * escala de cor) — que por padrão continua a partir do saldo final do mês
 * anterior, sem resetar a cada mês (ver `saldoInicial` e
 * calcularMesesAnteriores). Essa continuidade só quebra quando o usuário
 * confirma o fechamento de um mês (move o resultado pra Economias) — nesse
 * caso o mês seguinte nasce zerado (ver `proximoSaldoInicial`, usado em
 * useLinhasDoMes.ts).
 *
 * "Diário" de uma categoria, pra um dia (ano/mes/dia) qualquer, segue 3 regras
 * — a mesma lógica de calcularOrcamentoCategoria (restante ÷ dias restantes),
 * mas com o "ponto de referência" diferente conforme o caso:
 *   1. Dia já ACONTECEU (ou é hoje): usa o gasto real acumulado até esse dia
 *      exato, sem clamping — é assim que o valor cai conforme o dinheiro é
 *      gasto ao longo do mês. Vale pra qualquer mês, inclusive um mês inteiro
 *      no passado (nesse caso todo dia cai nessa regra).
 *   2. Dia FUTURO, mas ainda no MÊS ATUAL: trava no valor de hoje (gasto
 *      acumulado até hoje, dias restantes até o fim do mês a partir de hoje).
 *      Sem isso, o mesmo restante fixo dividido por dias restantes cada vez
 *      menores explode perto do fim do mês (bug já visto antes).
 *   3. Dia em um MÊS INTEIRAMENTE FUTURO (nem hoje nem o mês atual estão
 *      nele): não existe "hoje" dentro desse mês pra ancorar uma projeção
 *      dinâmica — a mesma explosão do caso 2 aconteceria de novo perto do fim
 *      desse mês futuro. Em vez disso, usa a divisão simples (previsto ÷ dias
 *      do mês), constante o mês inteiro.
 *
 * Saldo projetado (o que efetivamente desconta do saldo acumulado, dia a
 * dia) segue uma régua diferente da do "diário" exibido:
 *   - Dia já PASSADO: fato consumado — desconta só o gasto real do dia
 *     inteiro. Usar o diário aqui causaria dupla contagem (o diário já
 *     "redistribui" pra frente o previsto de dias sem gasto).
 *   - HOJE ou FUTURO: por CATEGORIA — se já existe lançamento real
 *     registrado nessa categoria nesse dia específico (manual, parcela ou
 *     recorrência), usa o valor real; senão usa a projeção do diário daquela
 *     categoria (nunca negativa, pra não "creditar" saldo de volta). Soma as
 *     duas coisas — nunca é "tudo projeção" nem "tudo lançamento real".
 */

export type FiltroHome = 'entradas' | 'saidas' | 'diarios' | 'cartao' | 'todas'

export interface CategoriaComPrevisto {
  categoriaId: string
  previsto: number
}

export interface ParcelaDoDia {
  numeroParcela: number
  totalParcelas: number
}

export interface LinhaDia {
  dia: number
  saldoAcumulado: number
  status: StatusSaldo
  totalEntradas: number
  totalSaidas: number
  totalCartao: number
  diario: number
  parcelas: ParcelaDoDia[]
  itensEntradas: Entrada[]
  itensGastos: Gasto[]
}

function somaAteDia(gastos: Gasto[], dia: number): number {
  return gastos
    .filter((gasto) => parseDataISO(gasto.data).dia <= dia)
    .reduce((soma, gasto) => soma + gasto.valor, 0)
}

/** Projeção diária (pode ser negativa) de UMA categoria, pra um dia — as 3 regras do topo do arquivo. */
function projecaoDiariaCategoria(
  categoria: CategoriaComPrevisto,
  gastosCategoria: Gasto[],
  dataDoDia: string,
  dia: number,
  diasNoMes: number,
  hojeISO: string,
  ehMesAtual: boolean,
  diaDeHoje: number,
): number {
  if (dataDoDia <= hojeISO) {
    // já aconteceu (ou é hoje): gasto real acumulado até esse dia exato
    const gastoAteDia = somaAteDia(gastosCategoria, dia)
    return calcularOrcamentoCategoria({
      previsto: categoria.previsto,
      gastoNoMes: gastoAteDia,
      diaAtual: dia,
      diasNoMes,
    }).valorDiario
  }

  if (ehMesAtual) {
    // futuro, mas ainda no mês atual: trava no valor de hoje
    const gastoAteDia = somaAteDia(gastosCategoria, diaDeHoje)
    return calcularOrcamentoCategoria({
      previsto: categoria.previsto,
      gastoNoMes: gastoAteDia,
      diaAtual: diaDeHoje,
      diasNoMes,
    }).valorDiario
  }

  // mês inteiramente futuro: sem "hoje" ali dentro, divisão simples
  return categoria.previsto / diasNoMes
}

function calcularDiarioDoDia(
  categorias: CategoriaComPrevisto[],
  gastos: Gasto[],
  ano: number,
  mes: number,
  dia: number,
  diasNoMes: number,
  hojeISO: string,
): number {
  const dataDoDia = formatarDataISO(ano, mes, dia)
  const hoje = parseDataISO(hojeISO)
  const ehMesAtual = ano === hoje.ano && mes === hoje.mes

  return categorias.reduce((soma, categoria) => {
    const gastosCategoria = gastos.filter((gasto) => gasto.categoriaId === categoria.categoriaId)
    return (
      soma +
      projecaoDiariaCategoria(categoria, gastosCategoria, dataDoDia, dia, diasNoMes, hojeISO, ehMesAtual, hoje.dia)
    )
  }, 0)
}

function calcularGastoConsideradoDoDia(
  categorias: CategoriaComPrevisto[],
  gastos: Gasto[],
  itensGastosDoDia: Gasto[],
  totalSaidasDoDia: number,
  ano: number,
  mes: number,
  dia: number,
  diasNoMes: number,
  hojeISO: string,
): number {
  const dataDoDia = formatarDataISO(ano, mes, dia)

  if (dataDoDia < hojeISO) {
    // passado: fato consumado, só o gasto real do dia inteiro
    return totalSaidasDoDia
  }

  const hoje = parseDataISO(hojeISO)
  const ehMesAtual = ano === hoje.ano && mes === hoje.mes

  // Todo gasto real de hoje conta integralmente (mesmo de uma categoria fora
  // da lista `categorias`, por segurança). A projeção só entra pras
  // categorias que NÃO tiveram lançamento nesse dia específico — assim nunca
  // soma as duas coisas pra uma mesma categoria no mesmo dia.
  const categoriasComGastoHoje = new Set(itensGastosDoDia.map((gasto) => gasto.categoriaId))

  const projecaoCategoriasSemGasto = categorias
    .filter((categoria) => !categoriasComGastoHoje.has(categoria.categoriaId))
    .reduce((soma, categoria) => {
      const gastosCategoria = gastos.filter((gasto) => gasto.categoriaId === categoria.categoriaId)
      const projecao = projecaoDiariaCategoria(
        categoria,
        gastosCategoria,
        dataDoDia,
        dia,
        diasNoMes,
        hojeISO,
        ehMesAtual,
        hoje.dia,
      )
      return soma + Math.max(0, projecao)
    }, 0)

  return totalSaidasDoDia + projecaoCategoriasSemGasto
}

function parcelasDoDia(itensGastosDoDia: Gasto[], comprasParceladas: CompraParcelada[]): ParcelaDoDia[] {
  return itensGastosDoDia
    .filter((gasto) => gasto.compraParceladaId && gasto.numeroParcela)
    .map((gasto) => {
      const compra = comprasParceladas.find((c) => c.id === gasto.compraParceladaId)
      return {
        numeroParcela: gasto.numeroParcela as number,
        totalParcelas: compra?.numeroParcelas ?? (gasto.numeroParcela as number),
      }
    })
}

export function calcularLinhasDoMes(
  entradas: Entrada[],
  gastos: Gasto[],
  categorias: CategoriaComPrevisto[],
  ano: number,
  mes: number,
  hojeISO: string,
  comprasParceladas: CompraParcelada[] = [],
  saldoInicial: number = 0,
): LinhaDia[] {
  const diasNoMes = getDiasNoMes(ano, mes)
  const totalEntradasMes = entradas.reduce((soma, entrada) => soma + entrada.valor, 0)

  let saldoAcumulado = saldoInicial
  const linhas: LinhaDia[] = []

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const itensEntradas = entradas.filter((entrada) => parseDataISO(entrada.data).dia === dia)
    const itensGastos = gastos.filter((gasto) => parseDataISO(gasto.data).dia === dia)

    const totalEntradas = itensEntradas.reduce((soma, entrada) => soma + entrada.valor, 0)
    const totalSaidas = itensGastos.reduce((soma, gasto) => soma + gasto.valor, 0)
    const totalCartao = itensGastos
      .filter((gasto) => gasto.meioPagamento === 'cartao')
      .reduce((soma, gasto) => soma + gasto.valor, 0)

    const diario = calcularDiarioDoDia(categorias, gastos, ano, mes, dia, diasNoMes, hojeISO)
    const gastoConsiderado = calcularGastoConsideradoDoDia(
      categorias,
      gastos,
      itensGastos,
      totalSaidas,
      ano,
      mes,
      dia,
      diasNoMes,
      hojeISO,
    )
    saldoAcumulado += totalEntradas - gastoConsiderado

    linhas.push({
      dia,
      saldoAcumulado,
      status: getStatusSaldo(saldoAcumulado, totalEntradasMes),
      totalEntradas,
      totalSaidas,
      totalCartao,
      diario,
      parcelas: parcelasDoDia(itensGastos, comprasParceladas),
      itensEntradas,
      itensGastos,
    })
  }

  return linhas
}

/**
 * Meses entre a primeira data com movimento já registrado (qualquer entrada
 * ou gasto, o mais antigo) e o mês alvo (exclusive) — usado pra encadear o
 * saldo final de cada mês como saldo inicial do próximo, até chegar no mês
 * que o usuário está vendo. Sem nenhum movimento anterior, não há o que
 * encadear.
 */
export function calcularMesesAnteriores(
  primeiraDataISO: string | null,
  anoAlvo: number,
  mesAlvo: number,
): { ano: number; mes: number }[] {
  if (!primeiraDataISO) return []

  const primeira = parseDataISO(primeiraDataISO)
  const meses: { ano: number; mes: number }[] = []

  let ano = primeira.ano
  let mes = primeira.mes

  while (ano < anoAlvo || (ano === anoAlvo && mes < mesAlvo)) {
    meses.push({ ano, mes })
    mes += 1
    if (mes > 12) {
      mes = 1
      ano += 1
    }
  }

  return meses
}

/**
 * Saldo inicial do mês seguinte, no encadeamento da Home — por padrão o
 * saldo continua (mesmo comportamento de sempre), mas se o mês que acabou
 * de fechar teve um fechamento CONFIRMADO (usuário mandou o resultado pra
 * Economias), a corrente quebra ali: o próximo mês nasce zerado. Recusar o
 * fechamento (ou nunca ter sido perguntado) mantém a continuidade — ver
 * useFechamentoPendente.
 */
export function proximoSaldoInicial(saldoFinalDoMes: number, mesFoiFechadoComConfirmacao: boolean): number {
  return mesFoiFechadoComConfirmacao ? 0 : saldoFinalDoMes
}
