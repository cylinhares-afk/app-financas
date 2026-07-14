import { supabase } from './supabase'
import type {
  Cartao,
  Categoria,
  CompraParcelada,
  Entrada,
  FechamentoMensal,
  Frequencia,
  Gasto,
  MeioPagamento,
  MovimentoEconomia,
  OrigemMovimentoEconomia,
  PrevisaoMensal,
  Recorrencia,
  TipoMovimento,
} from '../types/domain'

/**
 * Início (inclusive) e fim (exclusivo) do mês, como "AAAA-MM-DD" — usar `< fim`
 * em vez de `<= AAAA-MM-31` evita datas inválidas em meses com menos de 31 dias.
 */
function limitesDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  const anoProximoMes = mes === 12 ? ano + 1 : ano
  const proximoMes = mes === 12 ? 1 : mes + 1
  return {
    inicio: `${ano}-${String(mes).padStart(2, '0')}-01`,
    fim: `${anoProximoMes}-${String(proximoMes).padStart(2, '0')}-01`,
  }
}

export async function fetchCategorias(): Promise<{ dados: Categoria[]; erro: string | null }> {
  const { data, error } = await supabase.from('categorias').select('id, nome, cor, ativa').order('nome')
  return { dados: data ?? [], erro: error?.message ?? null }
}

export async function atualizarCategoria(id: string, nome: string): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('categorias').update({ nome }).eq('id', id)
  return { erro: error?.message ?? null }
}

/** "Excluir" uma categoria é arquivá-la — nunca um delete de verdade, pra preservar o histórico de gastos já lançados. */
export async function arquivarCategoria(id: string): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('categorias').update({ ativa: false }).eq('id', id)
  return { erro: error?.message ?? null }
}

export async function fetchCartoes(): Promise<{ dados: Cartao[]; erro: string | null }> {
  const { data, error } = await supabase
    .from('cartoes')
    .select('id, nome, dia_fechamento, dia_vencimento')
    .order('nome')

  const dados: Cartao[] = (data ?? []).map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    diaFechamento: linha.dia_fechamento,
    diaVencimento: linha.dia_vencimento,
  }))

  return { dados, erro: error?.message ?? null }
}

export interface DadosCartao {
  nome: string
  diaFechamento: number
  diaVencimento: number
}

export async function criarCartao(cartao: DadosCartao): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase
    .from('cartoes')
    .insert({ nome: cartao.nome, dia_fechamento: cartao.diaFechamento, dia_vencimento: cartao.diaVencimento })
    .select('id')
    .single()

  return { id: data?.id ?? null, erro: error?.message ?? null }
}

export async function atualizarCartao(id: string, cartao: DadosCartao): Promise<{ erro: string | null }> {
  const { error } = await supabase
    .from('cartoes')
    .update({ nome: cartao.nome, dia_fechamento: cartao.diaFechamento, dia_vencimento: cartao.diaVencimento })
    .eq('id', id)

  return { erro: error?.message ?? null }
}

export async function excluirCartao(id: string): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('cartoes').delete().eq('id', id)
  return { erro: error?.message ?? null }
}

/**
 * Data do lançamento mais antigo já registrado (entrada ou gasto) — usada
 * como âncora pra encadear o saldo acumulado mês a mês na Home (ver
 * calcularMesesAnteriores). Sem nenhum lançamento ainda, devolve null.
 */
export async function fetchPrimeiraDataComMovimento(): Promise<{
  dados: string | null
  erro: string | null
}> {
  const [gastosResp, entradasResp] = await Promise.all([
    supabase.from('gastos').select('data').order('data', { ascending: true }).limit(1),
    supabase.from('entradas').select('data').order('data', { ascending: true }).limit(1),
  ])

  const erro = gastosResp.error?.message ?? entradasResp.error?.message ?? null
  const datas = [gastosResp.data?.[0]?.data, entradasResp.data?.[0]?.data].filter(
    (data): data is string => Boolean(data),
  )
  const dados = datas.length > 0 ? datas.sort()[0] : null

  return { dados, erro }
}

/**
 * Todas as previsões já definidas manualmente, de qualquer categoria e mês —
 * base pra resolver o previsto EFETIVO de um mês qualquer (herança do último
 * valor definido antes dele, ver src/features/budget/previsaoEfetiva.ts).
 * Poucas linhas ao longo dos anos, então buscar tudo de uma vez é mais
 * simples (e mais barato) do que uma query por mês.
 */
export async function fetchTodasPrevisoes(): Promise<{ dados: PrevisaoMensal[]; erro: string | null }> {
  const { data, error } = await supabase
    .from('previsoes_mensais')
    .select('id, categoria_id, ano, mes, valor_previsto')

  const dados: PrevisaoMensal[] = (data ?? []).map((linha) => ({
    id: linha.id,
    categoriaId: linha.categoria_id,
    ano: linha.ano,
    mes: linha.mes,
    valorPrevisto: Number(linha.valor_previsto),
  }))

  return { dados, erro: error?.message ?? null }
}

export async function fetchGastosDoMes(
  ano: number,
  mes: number,
): Promise<{ dados: Gasto[]; erro: string | null }> {
  const { inicio, fim } = limitesDoMes(ano, mes)

  const { data, error } = await supabase
    .from('gastos')
    .select(
      'id, categoria_id, usuario_id, valor, data, descricao, meio_pagamento, cartao_id, cartao_dia_fechamento, cartao_dia_vencimento, compra_parcelada_id, numero_parcela, recorrencia_id, numero_ocorrencia',
    )
    .gte('data', inicio)
    .lt('data', fim)

  const dados: Gasto[] = (data ?? []).map((linha) => ({
    id: linha.id,
    categoriaId: linha.categoria_id,
    usuarioId: linha.usuario_id,
    valor: Number(linha.valor),
    data: linha.data,
    descricao: linha.descricao ?? undefined,
    meioPagamento: linha.meio_pagamento,
    cartaoId: linha.cartao_id ?? undefined,
    cartaoDiaFechamento: linha.cartao_dia_fechamento ?? undefined,
    cartaoDiaVencimento: linha.cartao_dia_vencimento ?? undefined,
    compraParceladaId: linha.compra_parcelada_id ?? undefined,
    numeroParcela: linha.numero_parcela ?? undefined,
    recorrenciaId: linha.recorrencia_id ?? undefined,
    numeroOcorrencia: linha.numero_ocorrencia ?? undefined,
  }))

  return { dados, erro: error?.message ?? null }
}

export async function fetchComprasParceladas(): Promise<{
  dados: CompraParcelada[]
  erro: string | null
}> {
  const { data, error } = await supabase
    .from('compras_parceladas')
    .select('id, categoria_id, valor_total, numero_parcelas, data_compra')

  const dados: CompraParcelada[] = (data ?? []).map((linha) => ({
    id: linha.id,
    categoriaId: linha.categoria_id,
    valorTotal: Number(linha.valor_total),
    numeroParcelas: linha.numero_parcelas,
    dataCompra: linha.data_compra,
  }))

  return { dados, erro: error?.message ?? null }
}

export async function fetchEntradasDoMes(
  ano: number,
  mes: number,
): Promise<{ dados: Entrada[]; erro: string | null }> {
  const { inicio, fim } = limitesDoMes(ano, mes)

  const { data, error } = await supabase
    .from('entradas')
    .select('id, usuario_id, valor, data, descricao, recorrencia_id, numero_ocorrencia')
    .gte('data', inicio)
    .lt('data', fim)

  const dados: Entrada[] = (data ?? []).map((linha) => ({
    id: linha.id,
    usuarioId: linha.usuario_id,
    valor: Number(linha.valor),
    data: linha.data,
    descricao: linha.descricao ?? undefined,
    recorrenciaId: linha.recorrencia_id ?? undefined,
    numeroOcorrencia: linha.numero_ocorrencia ?? undefined,
  }))

  return { dados, erro: error?.message ?? null }
}

export interface NovaEntrada {
  usuarioId: string
  valor: number
  data: string
  descricao?: string
  recorrenciaId?: string
  numeroOcorrencia?: number
}

export async function criarEntrada(entrada: NovaEntrada): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('entradas').insert({
    usuario_id: entrada.usuarioId,
    valor: entrada.valor,
    data: entrada.data,
    descricao: entrada.descricao || null,
    recorrencia_id: entrada.recorrenciaId ?? null,
    numero_ocorrencia: entrada.numeroOcorrencia ?? null,
  })
  return { erro: error?.message ?? null }
}

export async function criarCategoria(
  nome: string,
  cor?: string,
): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase.from('categorias').insert({ nome, cor }).select('id').single()
  return { id: data?.id ?? null, erro: error?.message ?? null }
}

export interface NovoGasto {
  categoriaId: string
  usuarioId: string
  valor: number
  data: string
  meioPagamento: 'dinheiro' | 'cartao'
  cartaoId?: string
  // Snapshot do fechamento/vencimento do cartão selecionado, capturado pelo
  // chamador NO MOMENTO da criação — nunca recalculado depois (ver
  // faturaCartao.ts). Só faz sentido quando cartaoId está presente.
  cartaoDiaFechamento?: number
  cartaoDiaVencimento?: number
  descricao?: string
  compraParceladaId?: string
  numeroParcela?: number
  recorrenciaId?: string
  numeroOcorrencia?: number
}

export async function criarGasto(gasto: NovoGasto): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('gastos').insert({
    categoria_id: gasto.categoriaId,
    usuario_id: gasto.usuarioId,
    valor: gasto.valor,
    data: gasto.data,
    meio_pagamento: gasto.meioPagamento,
    cartao_id: gasto.cartaoId ?? null,
    cartao_dia_fechamento: gasto.cartaoDiaFechamento ?? null,
    cartao_dia_vencimento: gasto.cartaoDiaVencimento ?? null,
    descricao: gasto.descricao || null,
    compra_parcelada_id: gasto.compraParceladaId ?? null,
    numero_parcela: gasto.numeroParcela ?? null,
    recorrencia_id: gasto.recorrenciaId ?? null,
    numero_ocorrencia: gasto.numeroOcorrencia ?? null,
  })
  return { erro: error?.message ?? null }
}

export interface EdicaoGasto {
  categoriaId: string
  valor: number
  data: string
  descricao?: string
}

export async function atualizarGasto(id: string, gasto: EdicaoGasto): Promise<{ erro: string | null }> {
  const { error } = await supabase
    .from('gastos')
    .update({
      categoria_id: gasto.categoriaId,
      valor: gasto.valor,
      data: gasto.data,
      descricao: gasto.descricao || null,
    })
    .eq('id', id)
  return { erro: error?.message ?? null }
}

export async function excluirGasto(id: string): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('gastos').delete().eq('id', id)
  return { erro: error?.message ?? null }
}

export interface EdicaoEntrada {
  valor: number
  data: string
  descricao?: string
}

export async function atualizarEntrada(id: string, entrada: EdicaoEntrada): Promise<{ erro: string | null }> {
  const { error } = await supabase
    .from('entradas')
    .update({ valor: entrada.valor, data: entrada.data, descricao: entrada.descricao || null })
    .eq('id', id)
  return { erro: error?.message ?? null }
}

export async function excluirEntrada(id: string): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('entradas').delete().eq('id', id)
  return { erro: error?.message ?? null }
}

/** Apaga a compra parcelada inteira — cascade apaga todas as parcelas (gastos), passadas e futuras. */
export async function excluirCompraParceladaCompleta(compraParceladaId: string): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('compras_parceladas').delete().eq('id', compraParceladaId)
  return { erro: error?.message ?? null }
}

/**
 * "Cancela" uma recorrência a partir de uma ocorrência específica: trava
 * numero_ocorrencias no que já veio antes dela, pra nenhuma ocorrência
 * nesse número ou depois ser gerada de novo — sem apagar as ocorrências
 * anteriores já materializadas (essas continuam intactas em `gastos`/`entradas`).
 */
export async function cancelarRecorrenciaAPartirDe(
  recorrenciaId: string,
  numeroOcorrencia: number,
): Promise<{ erro: string | null }> {
  const { error } = await supabase
    .from('recorrencias')
    .update({ numero_ocorrencias: Math.max(0, numeroOcorrencia - 1) })
    .eq('id', recorrenciaId)
  return { erro: error?.message ?? null }
}

export interface NovaCompraParcelada {
  categoriaId: string
  valorTotal: number
  numeroParcelas: number
  dataCompra: string
  descricao?: string
}

export async function criarCompraParcelada(
  compra: NovaCompraParcelada,
): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase
    .from('compras_parceladas')
    .insert({
      categoria_id: compra.categoriaId,
      valor_total: compra.valorTotal,
      numero_parcelas: compra.numeroParcelas,
      data_compra: compra.dataCompra,
      descricao: compra.descricao || null,
    })
    .select('id')
    .single()

  return { id: data?.id ?? null, erro: error?.message ?? null }
}

export interface NovaRecorrencia {
  tipoMovimento: TipoMovimento
  categoriaId?: string // obrigatório só para saída
  usuarioId: string
  valor: number
  meioPagamento?: MeioPagamento // obrigatório só para saída
  cartaoId?: string // só quando meioPagamento === 'cartao'
  frequencia: Frequencia
  dataInicio: string
  numeroOcorrencias?: number
  descricao?: string // origem, quando for entrada
}

export async function criarRecorrencia(
  recorrencia: NovaRecorrencia,
): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase
    .from('recorrencias')
    .insert({
      tipo_movimento: recorrencia.tipoMovimento,
      categoria_id: recorrencia.categoriaId ?? null,
      usuario_id: recorrencia.usuarioId,
      valor: recorrencia.valor,
      meio_pagamento: recorrencia.meioPagamento ?? null,
      cartao_id: recorrencia.cartaoId ?? null,
      frequencia: recorrencia.frequencia,
      data_inicio: recorrencia.dataInicio,
      numero_ocorrencias: recorrencia.numeroOcorrencias ?? null,
      descricao: recorrencia.descricao || null,
    })
    .select('id')
    .single()

  return { id: data?.id ?? null, erro: error?.message ?? null }
}

export async function fetchRecorrencias(): Promise<{ dados: Recorrencia[]; erro: string | null }> {
  const { data, error } = await supabase
    .from('recorrencias')
    .select(
      'id, tipo_movimento, categoria_id, usuario_id, valor, meio_pagamento, cartao_id, descricao, frequencia, data_inicio, numero_ocorrencias',
    )

  const dados: Recorrencia[] = (data ?? []).map((linha) => ({
    id: linha.id,
    tipoMovimento: linha.tipo_movimento,
    categoriaId: linha.categoria_id ?? undefined,
    usuarioId: linha.usuario_id,
    valor: Number(linha.valor),
    meioPagamento: linha.meio_pagamento ?? undefined,
    cartaoId: linha.cartao_id ?? undefined,
    descricao: linha.descricao ?? undefined,
    frequencia: linha.frequencia,
    dataInicio: linha.data_inicio,
    numeroOcorrencias: linha.numero_ocorrencias ?? undefined,
  }))

  return { dados, erro: error?.message ?? null }
}

/** Última posição (numero_ocorrencia) já gerada, por recorrência (procura em gastos e em entradas). */
export async function fetchUltimasOcorrenciasGeradas(): Promise<{
  dados: Map<string, number>
  erro: string | null
}> {
  const [gastosResp, entradasResp] = await Promise.all([
    supabase.from('gastos').select('recorrencia_id, numero_ocorrencia').not('recorrencia_id', 'is', null),
    supabase.from('entradas').select('recorrencia_id, numero_ocorrencia').not('recorrencia_id', 'is', null),
  ])

  const dados = new Map<string, number>()
  for (const linha of [...(gastosResp.data ?? []), ...(entradasResp.data ?? [])]) {
    const atual = dados.get(linha.recorrencia_id) ?? 0
    if (linha.numero_ocorrencia > atual) dados.set(linha.recorrencia_id, linha.numero_ocorrencia)
  }

  return { dados, erro: gastosResp.error?.message ?? entradasResp.error?.message ?? null }
}

export async function definirPrevisaoMensal(
  categoriaId: string,
  ano: number,
  mes: number,
  valorPrevisto: number,
): Promise<{ erro: string | null }> {
  const { error } = await supabase
    .from('previsoes_mensais')
    .upsert(
      { categoria_id: categoriaId, ano, mes, valor_previsto: valorPrevisto },
      { onConflict: 'categoria_id,ano,mes' },
    )
  return { erro: error?.message ?? null }
}

export async function fetchSaldoInicialEconomias(): Promise<{ dados: number; erro: string | null }> {
  const { data, error } = await supabase
    .from('economias_saldo_inicial')
    .select('valor')
    .eq('id', true)
    .maybeSingle()
  return { dados: Number(data?.valor ?? 0), erro: error?.message ?? null }
}

export async function definirSaldoInicialEconomias(valor: number): Promise<{ erro: string | null }> {
  const { error } = await supabase
    .from('economias_saldo_inicial')
    .upsert({ id: true, valor, atualizado_em: new Date().toISOString() }, { onConflict: 'id' })
  return { erro: error?.message ?? null }
}

export async function fetchMovimentosEconomias(): Promise<{
  dados: MovimentoEconomia[]
  erro: string | null
}> {
  const { data, error } = await supabase
    .from('economias_movimentos')
    .select('id, ano, mes, valor, origem, criado_em')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })
    .order('criado_em', { ascending: false })

  const dados: MovimentoEconomia[] = (data ?? []).map((linha) => ({
    id: linha.id,
    ano: linha.ano,
    mes: linha.mes,
    valor: Number(linha.valor),
    origem: linha.origem,
    criadoEm: linha.criado_em,
  }))

  return { dados, erro: error?.message ?? null }
}

export interface NovoMovimentoEconomia {
  ano: number
  mes: number
  valor: number
  origem: OrigemMovimentoEconomia
}

export async function criarMovimentoEconomia(
  movimento: NovoMovimentoEconomia,
): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('economias_movimentos').insert({
    ano: movimento.ano,
    mes: movimento.mes,
    valor: movimento.valor,
    origem: movimento.origem,
  })
  return { erro: error?.message ?? null }
}

export async function fetchFechamentoMensal(
  ano: number,
  mes: number,
): Promise<{ dados: FechamentoMensal | null; erro: string | null }> {
  const { data, error } = await supabase
    .from('fechamentos_mensais')
    .select('id, ano, mes, performance, confirmado')
    .eq('ano', ano)
    .eq('mes', mes)
    .maybeSingle()

  const dados: FechamentoMensal | null = data
    ? {
        id: data.id,
        ano: data.ano,
        mes: data.mes,
        performance: Number(data.performance),
        confirmado: data.confirmado,
      }
    : null

  return { dados, erro: error?.message ?? null }
}

/** Meses (ano/mes) cujo fechamento foi confirmado — quebra o encadeamento do saldo acumulado da Home. */
export async function fetchFechamentosConfirmados(): Promise<{
  dados: { ano: number; mes: number }[]
  erro: string | null
}> {
  const { data, error } = await supabase.from('fechamentos_mensais').select('ano, mes').eq('confirmado', true)
  return { dados: data ?? [], erro: error?.message ?? null }
}

export interface NovoFechamentoMensal {
  ano: number
  mes: number
  performance: number
  confirmado: boolean
}

export async function criarFechamentoMensal(
  fechamento: NovoFechamentoMensal,
): Promise<{ erro: string | null }> {
  const { error } = await supabase.from('fechamentos_mensais').insert({
    ano: fechamento.ano,
    mes: fechamento.mes,
    performance: fechamento.performance,
    confirmado: fechamento.confirmado,
  })
  return { erro: error?.message ?? null }
}
