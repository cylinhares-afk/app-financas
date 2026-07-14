export interface MesAno {
  ano: number
  mes: number
}

export function nomeDoMes(ano: number, mes: number): string {
  const bruto = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  return bruto.charAt(0).toUpperCase() + bruto.slice(1)
}

export function mesAnterior({ ano, mes }: MesAno): MesAno {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
}

export function mesSeguinte({ ano, mes }: MesAno): MesAno {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 }
}

export type StatusMesVisualizado = 'passado' | 'atual' | 'futuro'

/** Compara um mês navegado (Home/Totais) contra o mês real de hoje — usado pra rotular telas que mudam de nome conforme o mês já foi vivido, está em curso, ou ainda não chegou. */
export function statusMesVisualizado(mesVisualizado: MesAno, hoje: MesAno): StatusMesVisualizado {
  if (mesVisualizado.ano === hoje.ano && mesVisualizado.mes === hoje.mes) return 'atual'

  const ehAntesDeHoje =
    mesVisualizado.ano < hoje.ano || (mesVisualizado.ano === hoje.ano && mesVisualizado.mes < hoje.mes)

  return ehAntesDeHoje ? 'passado' : 'futuro'
}
