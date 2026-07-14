import { describe, expect, it } from 'vitest'
import {
  calcularOrcamentoCategoria,
  calcularOrcamentoDiarioTotal,
  calcularResumoCategorias,
  getDiasNoMes,
  somarGastosCategoriaNoMes,
} from './calculations'
import type { Gasto } from '../../types/domain'

describe('calcularOrcamentoCategoria', () => {
  it('reproduz o exemplo da especificação (Mercado: previsto 2000, gasto 500, 20 dias restantes -> 75/dia)', () => {
    const resultado = calcularOrcamentoCategoria({
      previsto: 2000,
      gastoNoMes: 500,
      diaAtual: 12,
      diasNoMes: 31,
    })

    expect(resultado.restante).toBe(1500)
    expect(resultado.diasRestantes).toBe(20)
    expect(resultado.valorDiario).toBe(75)
  })

  it('recalcula o valor diário depois de um novo gasto, sem precisar de ação manual', () => {
    const antes = calcularOrcamentoCategoria({
      previsto: 2000,
      gastoNoMes: 500,
      diaAtual: 12,
      diasNoMes: 31,
    })
    const depois = calcularOrcamentoCategoria({
      previsto: 2000,
      gastoNoMes: 1500, // gastou 1000 a mais de uma vez
      diaAtual: 12,
      diasNoMes: 31,
    })

    expect(antes.valorDiario).toBe(75)
    expect(depois.valorDiario).toBe(25) // 500 restantes / 20 dias
  })

  it('mostra valor diário negativo quando a categoria estourou o previsto (sem esconder o estouro)', () => {
    const resultado = calcularOrcamentoCategoria({
      previsto: 500,
      gastoNoMes: 800,
      diaAtual: 15,
      diasNoMes: 30,
    })

    expect(resultado.restante).toBe(-300)
    expect(resultado.valorDiario).toBeLessThan(0)
  })

  it('não divide por zero no último dia do mês', () => {
    const resultado = calcularOrcamentoCategoria({
      previsto: 300,
      gastoNoMes: 100,
      diaAtual: 30,
      diasNoMes: 30,
    })

    expect(resultado.diasRestantes).toBe(1)
    expect(resultado.valorDiario).toBe(200)
  })

  it('nunca deixa diasRestantes cair para zero ou negativo mesmo se diaAtual ultrapassar diasNoMes', () => {
    const resultado = calcularOrcamentoCategoria({
      previsto: 300,
      gastoNoMes: 100,
      diaAtual: 32,
      diasNoMes: 30,
    })

    expect(resultado.diasRestantes).toBe(1)
  })

  it('categoria sem nenhum gasto ainda gera o diário máximo possível', () => {
    const resultado = calcularOrcamentoCategoria({
      previsto: 1000,
      gastoNoMes: 0,
      diaAtual: 1,
      diasNoMes: 30,
    })

    expect(resultado.restante).toBe(1000)
    expect(resultado.valorDiario).toBeCloseTo(1000 / 30)
  })
})

describe('calcularOrcamentoDiarioTotal', () => {
  it('soma o valor diário de todas as categorias para o "diário" da home', () => {
    const resultado = calcularOrcamentoDiarioTotal(
      [
        { categoriaId: 'mercado', previsto: 2000, gastoNoMes: 500 },
        { categoriaId: 'delivery', previsto: 400, gastoNoMes: 400 }, // já zerou essa categoria
        { categoriaId: 'uber', previsto: 300, gastoNoMes: 0 },
      ],
      12,
      31,
    )

    // mercado: 1500/20 = 75 | delivery: 0/20 = 0 | uber: 300/20 = 15
    expect(resultado.totalDiario).toBe(90)
    expect(resultado.porCategoria).toHaveLength(3)
    expect(resultado.porCategoria.find((c) => c.categoriaId === 'delivery')?.valorDiario).toBe(0)
  })

  it('categoria estourada reduz o diário total (não fica "oferecendo" o que já foi gasto)', () => {
    const resultado = calcularOrcamentoDiarioTotal(
      [
        { categoriaId: 'mercado', previsto: 2000, gastoNoMes: 500 },
        { categoriaId: 'lazer', previsto: 200, gastoNoMes: 700 }, // estourou 500
      ],
      12,
      31,
    )

    // mercado: 1500/20 = 75 | lazer: -500/20 = -25
    expect(resultado.totalDiario).toBe(50)
  })
})

describe('calcularResumoCategorias', () => {
  it('soma previsto/gasto de todas as categorias e calcula sobra, diário médio e diário previsto (mesma régua dos cards)', () => {
    const { porCategoria } = calcularOrcamentoDiarioTotal(
      [
        { categoriaId: 'mercado', previsto: 2000, gastoNoMes: 500 },
        { categoriaId: 'uber', previsto: 300, gastoNoMes: 100 },
      ],
      10,
      31,
    )

    const resumo = calcularResumoCategorias(porCategoria, 10)

    expect(resumo.totalPrevisto).toBe(2300)
    expect(resumo.totalGasto).toBe(600)
    expect(resumo.sobra).toBe(1700)
    expect(resumo.diarioMedio).toBe(60) // 600 gastos / 10 dias já passados
    // diasRestantes = 31-10+1 = 22 -> mercado 1500/22 + uber 200/22
    expect(resumo.diarioPrevistoHoje).toBeCloseTo(1500 / 22 + 200 / 22)
  })

  it('sobra fica negativa quando o total gasto supera o total previsto', () => {
    const { porCategoria } = calcularOrcamentoDiarioTotal(
      [{ categoriaId: 'lazer', previsto: 200, gastoNoMes: 700 }],
      15,
      30,
    )

    const resumo = calcularResumoCategorias(porCategoria, 15)
    expect(resumo.sobra).toBe(-500)
  })

  it('não divide o diário médio por zero no primeiro dia do mês', () => {
    const { porCategoria } = calcularOrcamentoDiarioTotal(
      [{ categoriaId: 'mercado', previsto: 1000, gastoNoMes: 100 }],
      1,
      30,
    )

    const resumo = calcularResumoCategorias(porCategoria, 1)
    expect(resumo.diarioMedio).toBe(100)
  })
})

describe('getDiasNoMes', () => {
  it('calcula corretamente meses de 28, 30 e 31 dias, incluindo fevereiro bissexto', () => {
    expect(getDiasNoMes(2026, 7)).toBe(31)
    expect(getDiasNoMes(2026, 4)).toBe(30)
    expect(getDiasNoMes(2026, 2)).toBe(28)
    expect(getDiasNoMes(2024, 2)).toBe(29) // bissexto
  })
})

describe('somarGastosCategoriaNoMes', () => {
  const gastos: Gasto[] = [
    { id: '1', categoriaId: 'mercado', usuarioId: 'u1', valor: 100, data: '2026-07-02', meioPagamento: 'dinheiro' },
    { id: '2', categoriaId: 'mercado', usuarioId: 'u1', valor: 50, data: '2026-07-10', meioPagamento: 'cartao' },
    { id: '3', categoriaId: 'mercado', usuarioId: 'u2', valor: 999, data: '2026-06-15', meioPagamento: 'dinheiro' }, // mês diferente
    { id: '4', categoriaId: 'delivery', usuarioId: 'u1', valor: 30, data: '2026-07-05', meioPagamento: 'cartao' }, // categoria diferente
  ]

  it('soma apenas os gastos da categoria e do mês/ano pedidos', () => {
    expect(somarGastosCategoriaNoMes(gastos, 'mercado', 2026, 7)).toBe(150)
  })

  it('retorna 0 quando não há gastos correspondentes', () => {
    expect(somarGastosCategoriaNoMes(gastos, 'saude', 2026, 7)).toBe(0)
  })
})
