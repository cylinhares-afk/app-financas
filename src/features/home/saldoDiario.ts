/**
 * Escala de cor do saldo projetado da Home, relativa ao total de entradas do
 * mês (quem monta o saldo em si é linhasDoMes.ts — aqui fica só a régua de
 * cor, que é pura e reutilizável).
 *
 * Faixas definidas pelo usuário:
 *   saldo negativo        -> vermelho
 *   0%  a 5%  do total     -> laranja
 *   5%  a 20% do total     -> amarelo
 *   20% a 50% do total     -> verde-claro
 *   >= 50% do total        -> verde-escuro
 */

export type StatusSaldo = 'verde-escuro' | 'verde-claro' | 'amarelo' | 'laranja' | 'vermelho'

export function getStatusSaldo(saldo: number, totalEntradasMes: number): StatusSaldo {
  if (saldo < 0) return 'vermelho'

  // Sem entradas no mês pra comparar: um saldo não-negativo é o melhor caso possível.
  if (totalEntradasMes <= 0) return 'verde-escuro'

  const percentual = saldo / totalEntradasMes
  if (percentual >= 0.5) return 'verde-escuro'
  if (percentual >= 0.2) return 'verde-claro'
  if (percentual >= 0.05) return 'amarelo'
  return 'laranja'
}
