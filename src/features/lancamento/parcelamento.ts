import { somarMesesComAjuste } from '../../lib/dataISO'

/**
 * Compra parcelada: valor total dividido em X parcelas fixas, uma por mês,
 * cada uma sabendo sua posição (ex: "3 de 4"). Diferente de recorrência —
 * aqui o número de parcelas é sempre conhecido de antemão, então geramos
 * todas de uma vez, já na criação da compra.
 *
 * Trabalhamos em centavos pra dividir o valor sem erro de arredondamento:
 * os centavos que sobram da divisão inteira vão para as primeiras parcelas.
 */

export interface Parcela {
  numero: number
  totalParcelas: number
  valor: number
  data: string
}

export function calcularParcelas(
  valorTotal: number,
  numeroParcelas: number,
  dataCompra: string,
): Parcela[] {
  const totalCentavos = Math.round(valorTotal * 100)
  const baseCentavos = Math.floor(totalCentavos / numeroParcelas)
  const centavosRestantes = totalCentavos - baseCentavos * numeroParcelas

  const parcelas: Parcela[] = []
  for (let numero = 1; numero <= numeroParcelas; numero++) {
    const centavos = baseCentavos + (numero <= centavosRestantes ? 1 : 0)
    parcelas.push({
      numero,
      totalParcelas: numeroParcelas,
      valor: centavos / 100,
      data: numero === 1 ? dataCompra : somarMesesComAjuste(dataCompra, numero - 1),
    })
  }

  return parcelas
}
