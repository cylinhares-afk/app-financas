import { describe, expect, it } from 'vitest'
import { calcularLinhasDoMes, calcularMesesAnteriores, proximoSaldoInicial } from './linhasDoMes'
import type { CompraParcelada, Entrada, Gasto } from '../../types/domain'

function gasto(parcial: Partial<Gasto> & Pick<Gasto, 'categoriaId' | 'valor' | 'data'>): Gasto {
  return { id: 'g', usuarioId: 'u', meioPagamento: 'dinheiro', ...parcial }
}

function entrada(parcial: Partial<Entrada> & Pick<Entrada, 'valor' | 'data'>): Entrada {
  return { id: 'e', usuarioId: 'u', ...parcial }
}

describe('calcularLinhasDoMes', () => {
  it('totais de entradas/saídas/cartão refletem só os movimentos daquele dia específico', () => {
    const entradas = [entrada({ valor: 9000, data: '2026-07-01' })]
    const gastos = [
      gasto({ categoriaId: 'mercado', valor: 300, data: '2026-07-04', meioPagamento: 'dinheiro' }),
      gasto({ categoriaId: 'mercado', valor: 250, data: '2026-07-06', meioPagamento: 'cartao' }),
    ]

    const linhas = calcularLinhasDoMes(
      entradas,
      gastos,
      [{ categoriaId: 'mercado', previsto: 2000 }],
      2026,
      7,
      '2026-07-31',
    )

    expect(linhas[0].totalEntradas).toBe(9000)
    expect(linhas[0].totalSaidas).toBe(0)
    expect(linhas[3].totalSaidas).toBe(300) // dia 4
    expect(linhas[3].totalCartao).toBe(0)
    expect(linhas[5].totalSaidas).toBe(250) // dia 6
    expect(linhas[5].totalCartao).toBe(250)
  })

  describe('diário (calculado por dia)', () => {
    it('reproduz o exemplo da especificação até hoje, e dias futuros do mês atual repetem o valor de hoje', () => {
      const gastos = [gasto({ categoriaId: 'mercado', valor: 500, data: '2026-07-12' })]
      const categorias = [{ categoriaId: 'mercado', previsto: 2000 }]

      const linhas = calcularLinhasDoMes([], gastos, categorias, 2026, 7, '2026-07-12')

      // antes do gasto (dia 1, passado): restante 2000, dias restantes 31 -> 64.5.../dia
      expect(linhas[0].diario).toBeCloseTo(2000 / 31)
      // no dia do gasto (12 = hoje): restante 1500, dias restantes 20 -> 75/dia (exemplo da spec)
      expect(linhas[11].diario).toBe(75)
      // dias futuros do mesmo mês (13 em diante) repetem o valor de hoje
      expect(linhas[15].diario).toBe(75) // dia 16
      expect(linhas[30].diario).toBe(75) // dia 31 — não explode
    })

    it('mês inteiramente PASSADO: recalcula com o gasto real de cada dia, sem clamping, sem explodir no fim do mês', () => {
      // "hoje" é agosto; julho já acabou inteiro
      const gastos = [gasto({ categoriaId: 'mercado', valor: 500, data: '2026-07-12' })]
      const categorias = [{ categoriaId: 'mercado', previsto: 2000 }]

      const linhas = calcularLinhasDoMes([], gastos, categorias, 2026, 7, '2026-08-05')

      expect(linhas[0].diario).toBeCloseTo(2000 / 31) // dia 1, antes do gasto
      expect(linhas[11].diario).toBe(75) // dia 12, dia do gasto
      // dia 31 (último dia de julho, também já passado): recalcula de verdade,
      // não trava em 75 — dias restantes encolhe até 1, mas isso é fato
      // histórico correto (o mês inteiro já tinha só esse gasto mesmo)
      expect(linhas[30].diario).toBe(1500) // (2000-500)/1
    })

    it('mês inteiramente FUTURO: usa previsto ÷ dias do mês, constante, sem "hoje" pra travar e sem explodir', () => {
      const categorias = [{ categoriaId: 'mercado', previsto: 3100 }] // outubro tem 31 dias -> 100/dia
      // "hoje" é julho; outubro é um mês inteiramente futuro
      const linhas = calcularLinhasDoMes([], [], categorias, 2026, 10, '2026-07-05')

      expect(linhas[0].diario).toBeCloseTo(100)
      expect(linhas[14].diario).toBeCloseTo(100) // meio do mês
      expect(linhas[30].diario).toBeCloseTo(100) // último dia — igual, não explode
    })

    it('soma o diário de várias categorias', () => {
      const categorias = [
        { categoriaId: 'mercado', previsto: 3100 }, // 100/dia em 31 dias
        { categoriaId: 'uber', previsto: 620 }, // 20/dia em 31 dias
      ]

      const linhas = calcularLinhasDoMes([], [], categorias, 2026, 7, '2026-07-01')

      expect(linhas[0].diario).toBeCloseTo(120)
    })
  })

  describe('saldo acumulado', () => {
    it('mantém o saldo acumulado e o status coerentes com o cálculo já existente', () => {
      const entradas = [entrada({ valor: 1000, data: '2026-07-01' })]
      const gastos = [gasto({ categoriaId: 'mercado', valor: 1500, data: '2026-07-31' })]

      const linhas = calcularLinhasDoMes(entradas, gastos, [], 2026, 7, '2026-07-31')

      expect(linhas[30].saldoAcumulado).toBe(-500)
      expect(linhas[30].status).toBe('vermelho')
    })

    it('dias passados sem gasto real não descontam o diário previsto do saldo — é fato consumado, não projeção', () => {
      const categorias = [{ categoriaId: 'mercado', previsto: 3100 }] // ~100/dia em 31 dias, sem nenhum gasto

      const linhas = calcularLinhasDoMes([], [], categorias, 2026, 7, '2026-07-10')

      for (let dia = 1; dia < 10; dia++) {
        expect(linhas[dia - 1].saldoAcumulado).toBe(0)
      }

      const diarioHoje = linhas[9].diario // dia 10 = hoje
      expect(diarioHoje).toBeGreaterThan(0)
      expect(linhas[9].saldoAcumulado).toBeCloseTo(-diarioHoje)
    })

    it('dia passado com gasto real desconta só o gasto — não soma o diário previsto daquele dia por cima', () => {
      const categorias = [{ categoriaId: 'mercado', previsto: 3100 }]
      const gastos = [gasto({ categoriaId: 'mercado', valor: 40, data: '2026-07-05' })]

      const linhas = calcularLinhasDoMes([], gastos, categorias, 2026, 7, '2026-07-10')

      expect(linhas[0].saldoAcumulado).toBe(0)
      expect(linhas[3].saldoAcumulado).toBe(0)
      expect(linhas[4].totalSaidas).toBe(40)
      expect(linhas[4].saldoAcumulado).toBe(-40)
      expect(linhas[5].saldoAcumulado).toBe(-40)
      expect(linhas[8].saldoAcumulado).toBe(-40)
    })

    it('nunca credita saldo de volta quando a projeção de uma categoria é negativa (categoria já estourada)', () => {
      const categorias = [{ categoriaId: 'lazer', previsto: 100 }]
      const gastos = [gasto({ categoriaId: 'lazer', valor: 500, data: '2026-07-01' })]

      const linhas = calcularLinhasDoMes([], gastos, categorias, 2026, 7, '2026-07-01')

      expect(linhas[0].diario).toBeLessThan(0)
      expect(linhas[0].saldoAcumulado).toBe(-500)
    })

    it('dia futuro com gasto real em UMA categoria soma esse real + a projeção só das OUTRAS categorias (sem duplicar)', () => {
      const categorias = [
        { categoriaId: 'mercado', previsto: 3100 }, // dias restantes a partir de hoje (dia 10) = 22
        { categoriaId: 'uber', previsto: 620 },
      ]
      // parcela futura de R$300 na categoria mercado, no dia 20 (futuro)
      const gastos = [
        gasto({ categoriaId: 'mercado', valor: 300, data: '2026-07-20', meioPagamento: 'cartao' }),
      ]

      const linhas = calcularLinhasDoMes([], gastos, categorias, 2026, 7, '2026-07-10')

      const projecaoMercado = 3100 / 22 // travada em hoje, ~140.91/dia
      const projecaoUber = 620 / 22 // uber nunca tem gasto real, sempre usa a projeção

      // dia 19 (futuro, nenhum gasto real ainda): desconta as duas projeções
      expect(linhas[18].saldoAcumulado).toBeCloseTo(linhas[17].saldoAcumulado - projecaoMercado - projecaoUber)

      // dia 20 (tem o gasto real de mercado): desconta os 300 reais de mercado
      // — não a projeção de mercado — mais a projeção de uber, que continua
      // sem gasto real
      expect(linhas[19].saldoAcumulado).toBeCloseTo(linhas[18].saldoAcumulado - 300 - projecaoUber)
    })

    it('usa o saldoInicial como ponto de partida (encadeamento entre meses)', () => {
      const linhas = calcularLinhasDoMes([], [], [], 2026, 7, '2026-07-31', [], 500)

      expect(linhas[0].saldoAcumulado).toBe(500)
      expect(linhas[30].saldoAcumulado).toBe(500)
    })

    it('mês inteiramente futuro sem lançamento real desconta a divisão simples do previsto, de forma constante', () => {
      const categorias = [{ categoriaId: 'mercado', previsto: 3100 }] // outubro: 31 dias -> 100/dia
      const linhas = calcularLinhasDoMes([], [], categorias, 2026, 10, '2026-07-05')

      expect(linhas[0].saldoAcumulado).toBeCloseTo(-100)
      expect(linhas[1].saldoAcumulado).toBeCloseTo(-200)
      expect(linhas[30].saldoAcumulado).toBeCloseTo(-3100) // 31 dias * 100, sem explodir
    })
  })

  it('itensEntradas e itensGastos trazem só os lançamentos daquele dia específico', () => {
    const entradas = [
      entrada({ id: 'e1', valor: 9000, data: '2026-07-01' }),
      entrada({ id: 'e2', valor: 200, data: '2026-07-05' }),
    ]
    const gastos = [
      gasto({ id: 'g1', categoriaId: 'mercado', valor: 300, data: '2026-07-05' }),
      gasto({ id: 'g2', categoriaId: 'mercado', valor: 50, data: '2026-07-06' }),
    ]

    const linhas = calcularLinhasDoMes(entradas, gastos, [], 2026, 7, '2026-07-31')

    expect(linhas[4].itensEntradas.map((e) => e.id)).toEqual(['e2'])
    expect(linhas[4].itensGastos.map((g) => g.id)).toEqual(['g1'])
    expect(linhas[0].itensEntradas.map((e) => e.id)).toEqual(['e1'])
    expect(linhas[0].itensGastos).toEqual([])
  })

  it('marca o selo de parcela (numero/total) nos gastos vindos de compra parcelada', () => {
    const comprasParceladas: CompraParcelada[] = [
      { id: 'compra-1', categoriaId: 'mercado', valorTotal: 1200, numeroParcelas: 4, dataCompra: '2026-07-04' },
    ]
    const gastos = [
      gasto({
        categoriaId: 'mercado',
        valor: 300,
        data: '2026-07-04',
        meioPagamento: 'cartao',
        compraParceladaId: 'compra-1',
        numeroParcela: 1,
      }),
      gasto({ categoriaId: 'mercado', valor: 50, data: '2026-07-06', meioPagamento: 'dinheiro' }),
    ]

    const linhas = calcularLinhasDoMes([], gastos, [], 2026, 7, '2026-07-31', comprasParceladas)

    expect(linhas[3].parcelas).toEqual([{ numeroParcela: 1, totalParcelas: 4 }])
    expect(linhas[5].parcelas).toEqual([]) // gasto sem compra parcelada não tem selo
  })
})

describe('calcularMesesAnteriores', () => {
  it('sem nenhuma data anterior, não há meses pra encadear', () => {
    expect(calcularMesesAnteriores(null, 2026, 7)).toEqual([])
  })

  it('quando a primeira data já é do mês alvo (ou depois), não há meses anteriores', () => {
    expect(calcularMesesAnteriores('2026-07-15', 2026, 7)).toEqual([])
  })

  it('lista os meses entre a primeira data e o mês alvo, dentro do mesmo ano', () => {
    expect(calcularMesesAnteriores('2026-04-10', 2026, 7)).toEqual([
      { ano: 2026, mes: 4 },
      { ano: 2026, mes: 5 },
      { ano: 2026, mes: 6 },
    ])
  })

  it('atravessa a virada de ano corretamente', () => {
    expect(calcularMesesAnteriores('2025-11-20', 2026, 2)).toEqual([
      { ano: 2025, mes: 11 },
      { ano: 2025, mes: 12 },
      { ano: 2026, mes: 1 },
    ])
  })
})

describe('proximoSaldoInicial', () => {
  it('sem fechamento confirmado, o saldo continua pro mês seguinte (comportamento padrão)', () => {
    expect(proximoSaldoInicial(1200, false)).toBe(1200)
    expect(proximoSaldoInicial(-300, false)).toBe(-300)
  })

  it('com fechamento confirmado, o mês seguinte nasce zerado — independente do sinal do saldo', () => {
    expect(proximoSaldoInicial(1200, true)).toBe(0)
    expect(proximoSaldoInicial(-300, true)).toBe(0)
  })
})
