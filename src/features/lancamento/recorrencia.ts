import { somarDias, somarMesesComAjuste } from '../../lib/dataISO'
import type { Frequencia } from '../../types/domain'

/**
 * Gasto recorrente (assinatura, aluguel...): mesmo valor se repete a cada
 * ocorrência, por X vezes ou por tempo indeterminado. Diferente de compra
 * parcelada — aqui não geramos todas as ocorrências de uma vez (não faria
 * sentido pro caso indeterminado), geramos só as que já "venceram" até hoje.
 * Essa função é pura: recebe até onde já foi gerado e até quando gerar, e
 * devolve só as ocorrências que faltam.
 */

export function proximaData(dataISO: string, frequencia: Frequencia): string {
  if (frequencia === 'diaria') return somarDias(dataISO, 1)
  if (frequencia === 'semanal') return somarDias(dataISO, 7)
  return somarMesesComAjuste(dataISO, 1)
}

export interface OcorrenciaPendente {
  numeroOcorrencia: number
  data: string
}

export function calcularOcorrenciasPendentes(
  dataInicio: string,
  frequencia: Frequencia,
  numeroOcorrencias: number | undefined,
  ultimaOcorrenciaGerada: number,
  hojeISO: string,
): OcorrenciaPendente[] {
  let dataAtual = dataInicio
  let numero = 1

  // avança até a data da primeira ocorrência ainda não gerada
  while (numero <= ultimaOcorrenciaGerada) {
    dataAtual = proximaData(dataAtual, frequencia)
    numero++
  }

  const pendentes: OcorrenciaPendente[] = []
  while (dataAtual <= hojeISO && (numeroOcorrencias === undefined || numero <= numeroOcorrencias)) {
    pendentes.push({ numeroOcorrencia: numero, data: dataAtual })
    dataAtual = proximaData(dataAtual, frequencia)
    numero++
  }

  return pendentes
}
