export type MeioPagamento = 'pix' | 'cartao'

export interface Usuario {
  id: string
  nome: string
}

export interface Categoria {
  id: string
  nome: string
  cor?: string
  // false = arquivada: some dos pickers de novo lançamento e da edição de
  // previsão futura, mas gastos antigos continuam referenciando ela normalmente.
  ativa: boolean
}

export interface Cartao {
  id: string
  nome: string
  diaFechamento: number // 1-31
  diaVencimento: number // 1-31
}

export interface PrevisaoMensal {
  id: string
  categoriaId: string
  ano: number
  mes: number // 1-12
  valorPrevisto: number
}

export interface CompraParcelada {
  id: string
  categoriaId: string
  valorTotal: number
  numeroParcelas: number
  dataCompra: string // ISO date
}

export type Frequencia = 'diaria' | 'semanal' | 'mensal'
export type TipoMovimento = 'entrada' | 'saida'

export interface Recorrencia {
  id: string
  tipoMovimento: TipoMovimento
  categoriaId?: string // só para saída
  usuarioId: string
  valor: number
  meioPagamento?: MeioPagamento // só para saída
  cartaoId?: string // só quando meioPagamento === 'cartao'
  descricao?: string // origem da entrada, ex: "Salário Cynthia"
  frequencia: Frequencia
  dataInicio: string // ISO date
  numeroOcorrencias?: number // undefined = indeterminado
}

export interface Gasto {
  id: string
  categoriaId: string
  usuarioId: string
  valor: number
  data: string // ISO date
  descricao?: string // nota livre do lançamento, ex: "compra grande do mês"
  meioPagamento: MeioPagamento
  cartaoId?: string // só quando meioPagamento === 'cartao'
  // Fechamento/vencimento do cartão NO MOMENTO da compra (snapshot) — usado
  // pra calcular o mês de vencimento sem ser afetado por uma edição
  // posterior do cartão (ver faturaCartao.ts). Ausente em gastos antigos,
  // de antes dessa coluna existir.
  cartaoDiaFechamento?: number
  cartaoDiaVencimento?: number
  compraParceladaId?: string
  numeroParcela?: number // ex: 3 (de 3/4), presente quando vem de uma compra parcelada
  recorrenciaId?: string
  numeroOcorrencia?: number // ex: 5ª cobrança de uma assinatura recorrente
}

export interface Entrada {
  id: string
  usuarioId: string
  valor: number
  data: string // ISO date
  descricao?: string
  recorrenciaId?: string
  numeroOcorrencia?: number
}

export type OrigemMovimentoEconomia = 'fechamento_mes' | 'manual'

/** Aporte (valor positivo) ou retirada (valor negativo) na reserva de Economias. */
export interface MovimentoEconomia {
  id: string
  ano: number
  mes: number
  valor: number
  origem: OrigemMovimentoEconomia
  criadoEm: string
}

/**
 * Registra que o fechamento de um mês já foi OFERECIDO ao usuário — a
 * existência da linha (independente de `confirmado`) é o que impede o app
 * de perguntar de novo sobre aquele mês. `confirmado` é o que quebra o
 * encadeamento do saldo acumulado da Home pro mês seguinte.
 */
export interface FechamentoMensal {
  id: string
  ano: number
  mes: number
  performance: number
  confirmado: boolean
}
