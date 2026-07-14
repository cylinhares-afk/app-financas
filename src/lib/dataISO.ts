/**
 * Datas do Postgres chegam como "AAAA-MM-DD". Evitamos `new Date(string)` para
 * ler ano/mês/dia porque o parser trata isso como UTC meia-noite — em
 * timezones atrás de UTC, `.getDate()`/`.getMonth()` podem devolver o dia
 * anterior. Parseamos a string diretamente em vez disso.
 */
export function parseDataISO(dataISO: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  return { ano, mes, dia }
}

export function formatarDataISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function hojeISO(): string {
  const hoje = new Date()
  return formatarDataISO(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate())
}

/**
 * Soma dias a uma data ISO usando componentes locais (não string parseada),
 * então não sofre o problema de fuso horário do `new Date(string)`.
 */
export function somarDias(dataISO: string, dias: number): string {
  const { ano, mes, dia } = parseDataISO(dataISO)
  const data = new Date(ano, mes - 1, dia + dias)
  return formatarDataISO(data.getFullYear(), data.getMonth() + 1, data.getDate())
}

/**
 * Soma meses a uma data ISO, ajustando ("clamp") pro último dia do mês de
 * destino quando o dia original não existe nele — ex: 31/jan + 1 mês vira
 * 28/fev (ou 29 em bissexto), em vez de "estourar" pra março.
 */
export function somarMesesComAjuste(dataISO: string, meses: number): string {
  const { ano, mes, dia } = parseDataISO(dataISO)
  const indiceMes = mes - 1 + meses
  const novoAno = ano + Math.floor(indiceMes / 12)
  const novoMes = ((indiceMes % 12) + 12) % 12
  const diasNoNovoMes = new Date(novoAno, novoMes + 1, 0).getDate()
  const novoDia = Math.min(dia, diasNoNovoMes)
  return formatarDataISO(novoAno, novoMes + 1, novoDia)
}
