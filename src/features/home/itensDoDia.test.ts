import { describe, expect, it } from 'vitest'
import { itensDoDia } from './itensDoDia'
import { calcularLinhasDoMes } from './linhasDoMes'
import type { Categoria, CompraParcelada, Entrada, Gasto } from '../../types/domain'

const categorias: Categoria[] = [{ id: 'mercado', nome: 'Mercado', ativa: true }]

function linhaComMovimentos(entradas: Entrada[], gastos: Gasto[]) {
  return calcularLinhasDoMes(entradas, gastos, [], 2026, 7, '2026-07-31')[3] // dia 4
}

describe('itensDoDia', () => {
  it('filtro "entradas" só traz as entradas do dia, com a descrição como rótulo', () => {
    const linha = linhaComMovimentos(
      [{ id: 'e1', usuarioId: 'u', valor: 4500, data: '2026-07-04', descricao: 'Salário Cynthia' }],
      [{ id: 'g1', categoriaId: 'mercado', usuarioId: 'u', valor: 100, data: '2026-07-04', meioPagamento: 'dinheiro' }],
    )

    const itens = itensDoDia(linha, 'entradas', categorias, [])

    expect(itens).toEqual([
      {
        id: 'e1',
        tipo: 'entrada',
        valor: 4500,
        data: '2026-07-04',
        rotulo: 'Salário Cynthia',
        recorrenciaId: undefined,
        numeroOcorrencia: undefined,
      },
    ])
  })

  it('filtro "saidas" traz os gastos com o nome da categoria resolvido', () => {
    const linha = linhaComMovimentos(
      [],
      [{ id: 'g1', categoriaId: 'mercado', usuarioId: 'u', valor: 100, data: '2026-07-04', meioPagamento: 'dinheiro' }],
    )

    const itens = itensDoDia(linha, 'saidas', categorias, [])

    expect(itens).toEqual([
      {
        id: 'g1',
        tipo: 'saida',
        valor: 100,
        data: '2026-07-04',
        rotulo: 'Mercado',
        descricao: undefined,
        meioPagamento: 'dinheiro',
        categoriaId: 'mercado',
        parcela: undefined,
        compraParceladaId: undefined,
        recorrenciaId: undefined,
        numeroOcorrencia: undefined,
      },
    ])
  })

  it('filtro "cartao" traz só os gastos no cartão, ignorando os em dinheiro', () => {
    const linha = linhaComMovimentos(
      [],
      [
        { id: 'g1', categoriaId: 'mercado', usuarioId: 'u', valor: 100, data: '2026-07-04', meioPagamento: 'dinheiro' },
        { id: 'g2', categoriaId: 'mercado', usuarioId: 'u', valor: 50, data: '2026-07-04', meioPagamento: 'cartao' },
      ],
    )

    const itens = itensDoDia(linha, 'cartao', categorias, [])

    expect(itens.map((i) => i.id)).toEqual(['g2'])
  })

  it('filtro "todas" junta entradas e saídas do dia', () => {
    const linha = linhaComMovimentos(
      [{ id: 'e1', usuarioId: 'u', valor: 4500, data: '2026-07-04' }],
      [{ id: 'g1', categoriaId: 'mercado', usuarioId: 'u', valor: 100, data: '2026-07-04', meioPagamento: 'dinheiro' }],
    )

    const itens = itensDoDia(linha, 'todas', categorias, [])

    expect(itens.map((i) => i.id)).toEqual(['e1', 'g1'])
  })

  it('filtro "todas" traz entrada + saída em dinheiro + saída no cartão juntos, nenhum tipo fica de fora', () => {
    const linha = linhaComMovimentos(
      [{ id: 'e1', usuarioId: 'u', valor: 4500, data: '2026-07-04', descricao: 'Salário Cynthia' }],
      [
        { id: 'g1', categoriaId: 'mercado', usuarioId: 'u', valor: 100, data: '2026-07-04', meioPagamento: 'dinheiro' },
        { id: 'g2', categoriaId: 'mercado', usuarioId: 'u', valor: 50, data: '2026-07-04', meioPagamento: 'cartao' },
      ],
    )

    const itens = itensDoDia(linha, 'todas', categorias, [])

    expect(itens.map((i) => i.id)).toEqual(['e1', 'g1', 'g2'])
    expect(itens.map((i) => i.tipo)).toEqual(['entrada', 'saida', 'saida'])
    expect(itens.find((i) => i.id === 'g2')?.meioPagamento).toBe('cartao')
  })

  it('traz a descrição do gasto quando ela existir', () => {
    const linha = linhaComMovimentos(
      [],
      [
        {
          id: 'g1',
          categoriaId: 'mercado',
          usuarioId: 'u',
          valor: 250,
          data: '2026-07-04',
          meioPagamento: 'dinheiro',
          descricao: 'ração, areia, churu — compra grande do mês',
        },
      ],
    )

    const itens = itensDoDia(linha, 'saidas', categorias, [])

    expect(itens[0].descricao).toBe('ração, areia, churu — compra grande do mês')
  })

  it('não traz descrição quando o gasto não tem uma', () => {
    const linha = linhaComMovimentos(
      [],
      [{ id: 'g1', categoriaId: 'mercado', usuarioId: 'u', valor: 100, data: '2026-07-04', meioPagamento: 'dinheiro' }],
    )

    const itens = itensDoDia(linha, 'saidas', categorias, [])

    expect(itens[0].descricao).toBeUndefined()
  })

  it('filtro "diarios" nunca tem itens, mesmo com lançamentos no dia', () => {
    const linha = linhaComMovimentos(
      [{ id: 'e1', usuarioId: 'u', valor: 4500, data: '2026-07-04' }],
      [{ id: 'g1', categoriaId: 'mercado', usuarioId: 'u', valor: 100, data: '2026-07-04', meioPagamento: 'dinheiro' }],
    )

    expect(itensDoDia(linha, 'diarios', categorias, [])).toEqual([])
  })

  it('traz o selo de parcela quando o gasto vem de uma compra parcelada', () => {
    const comprasParceladas: CompraParcelada[] = [
      { id: 'compra-1', categoriaId: 'mercado', valorTotal: 400, numeroParcelas: 4, dataCompra: '2026-07-04' },
    ]
    const linha = linhaComMovimentos(
      [],
      [
        {
          id: 'g1',
          categoriaId: 'mercado',
          usuarioId: 'u',
          valor: 100,
          data: '2026-07-04',
          meioPagamento: 'cartao',
          compraParceladaId: 'compra-1',
          numeroParcela: 2,
        },
      ],
    )

    const itens = itensDoDia(linha, 'saidas', categorias, comprasParceladas)

    expect(itens[0].parcela).toEqual({ numero: 2, total: 4 })
  })

  it('usa "Categoria removida" quando a categoria do gasto não existe mais na lista', () => {
    const linha = linhaComMovimentos(
      [],
      [{ id: 'g1', categoriaId: 'inexistente', usuarioId: 'u', valor: 100, data: '2026-07-04', meioPagamento: 'dinheiro' }],
    )

    const itens = itensDoDia(linha, 'saidas', categorias, [])

    expect(itens[0].rotulo).toBe('Categoria removida')
  })
})
