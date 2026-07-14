const formatador = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatMoeda(valor: number): string {
  return formatador.format(valor)
}

/** Tira qualquer "-" digitado — usado no onChange dos campos de valor monetário, que nunca aceitam negativo. */
export function semNegativo(valor: string): string {
  return valor.replace(/-/g, '')
}
