import type { OrcamentoCategoriaResultado } from './calculations'

export type StatusOrcamento = 'verde' | 'amarelo' | 'vermelho'

/**
 * Cor de status por categoria, no espírito verde/amarelo/vermelho do app de referência:
 * vermelho quando já estourou o previsto, amarelo quando o ritmo diário atual
 * caiu bem abaixo da média original da categoria, verde no resto.
 */
export function getStatusOrcamentoCategoria(
  resultado: OrcamentoCategoriaResultado,
  diasNoMes: number,
): StatusOrcamento {
  if (resultado.restante < 0) return 'vermelho'

  const mediaOriginal = resultado.previsto / diasNoMes
  if (mediaOriginal > 0 && resultado.valorDiario < mediaOriginal * 0.5) return 'amarelo'

  return 'verde'
}
