import { describe, expect, it } from 'vitest'
import { parseCSVImportacao, separarNovasEDuplicadas } from './csvImportacao'
import type { Cartao, Categoria } from '../../types/domain'
import type { GastoParaComparacao } from '../../lib/queries'

const categorias: Categoria[] = [{ id: 'mercado-id', nome: 'Mercado', ativa: true }]
const cartoes: Cartao[] = [{ id: 'nubank-id', nome: 'Nubank', diaFechamento: 20, diaVencimento: 1 }]

const CABECALHO = 'data,tipo,parcelas_total,frequencia,valor,categoria,meio_pagamento,cartao,descricao'

function csv(...linhas: string[]): string {
  return [CABECALHO, ...linhas].join('\n')
}

describe('parseCSVImportacao', () => {
  it('lançamento único válido', () => {
    const resultado = parseCSVImportacao(csv('15/01/2026,unico,,,45.90,Mercado,pix,,compra do mês'), categorias, cartoes)

    expect(resultado.erros).toEqual([])
    expect(resultado.linhasValidas).toEqual([
      {
        linha: 2,
        tipo: 'unico',
        data: '2026-01-15',
        valor: 45.9,
        categoriaId: 'mercado-id',
        categoriaNomeNova: undefined,
        meioPagamento: 'pix',
        cartaoId: undefined,
        descricao: 'compra do mês',
        parcelasTotal: undefined,
        frequencia: undefined,
      },
    ])
  })

  it('lançamento recorrente válido, com cartão', () => {
    const resultado = parseCSVImportacao(
      csv('05/01/2026,recorrente,,mensal,55.90,Mercado,cartao,Nubank,Netflix'),
      categorias,
      cartoes,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.linhasValidas[0]).toMatchObject({
      tipo: 'recorrente',
      frequencia: 'mensal',
      cartaoId: 'nubank-id',
      meioPagamento: 'cartao',
    })
  })

  it('lançamento parcelado válido — valor da linha é o de CADA parcela, não o total', () => {
    const resultado = parseCSVImportacao(
      csv('10/01/2026,parcelado,12,,250.00,Mercado,cartao,Nubank,Notebook novo'),
      categorias,
      cartoes,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.linhasValidas[0]).toMatchObject({
      tipo: 'parcelado',
      valor: 250,
      parcelasTotal: 12,
      cartaoId: 'nubank-id',
    })
  })

  it('aceita vírgula como separador decimal no valor (coluna precisa vir entre aspas no CSV)', () => {
    const resultado = parseCSVImportacao(csv('15/01/2026,unico,,,"45,90",Mercado,pix,,'), categorias, cartoes)

    expect(resultado.erros).toEqual([])
    expect(resultado.linhasValidas[0]?.valor).toBe(45.9)
  })

  it('aceita ponto como separador decimal no valor, sem milhar', () => {
    const resultado = parseCSVImportacao(csv('15/01/2026,unico,,,107.99,Mercado,pix,,'), categorias, cartoes)

    expect(resultado.erros).toEqual([])
    expect(resultado.linhasValidas[0]?.valor).toBe(107.99)
  })

  it('aceita formato brasileiro com separador de milhar (ponto) e decimal (vírgula)', () => {
    const resultado = parseCSVImportacao(
      csv(
        '15/01/2026,unico,,,"1.127,52",Mercado,pix,,',
        '16/01/2026,unico,,,"2.800,00",Mercado,pix,,',
        '17/01/2026,unico,,,"12.345,67",Mercado,pix,,', // mais de um milhar
      ),
      categorias,
      cartoes,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.linhasValidas.map((l) => l.valor)).toEqual([1127.52, 2800, 12345.67])
  })

  it('valor acima de mil sem separador de milhar continua funcionando', () => {
    const resultado = parseCSVImportacao(
      csv('15/01/2026,unico,,,1127.52,Mercado,pix,,', '16/01/2026,unico,,,"1127,52",Mercado,pix,,'),
      categorias,
      cartoes,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.linhasValidas.map((l) => l.valor)).toEqual([1127.52, 1127.52])
  })

  it('categoria nova é detectada e reportada uma vez só, mesmo se a linha aparecer mais de uma vez', () => {
    const resultado = parseCSVImportacao(
      csv(
        '01/01/2026,unico,,,10,Beleza,pix,,',
        '02/01/2026,unico,,,20,beleza,pix,,', // mesma categoria, grafia diferente
        '03/01/2026,unico,,,30,Vestuário,pix,,',
      ),
      categorias,
      cartoes,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.categoriasNovas).toEqual(['Beleza', 'Vestuário'])
    expect(resultado.linhasValidas[0].categoriaNomeNova).toBe('Beleza')
    expect(resultado.linhasValidas[1].categoriaNomeNova).toBe('Beleza') // reaproveita a grafia da 1ª linha
    expect(resultado.linhasValidas[0].categoriaId).toBeUndefined()
  })

  it('categoria já existente (case-insensitive) não entra em categoriasNovas', () => {
    const resultado = parseCSVImportacao(csv('01/01/2026,unico,,,10,mercado,pix,,'), categorias, cartoes)

    expect(resultado.categoriasNovas).toEqual([])
    expect(resultado.linhasValidas[0].categoriaId).toBe('mercado-id')
  })

  it('rejeita cartão inexistente com mensagem clara', () => {
    const resultado = parseCSVImportacao(csv('01/01/2026,unico,,,10,Mercado,cartao,Nu,'), categorias, cartoes)

    expect(resultado.linhasValidas).toEqual([])
    expect(resultado.erros).toEqual([{ linha: 2, mensagem: "cartão 'Nu' não encontrado" }])
  })

  it('rejeita compra parcelada com meio_pagamento pix', () => {
    const resultado = parseCSVImportacao(csv('01/01/2026,parcelado,3,,10,Mercado,pix,,'), categorias, cartoes)

    expect(resultado.linhasValidas).toEqual([])
    expect(resultado.erros[0].mensagem).toMatch(/parcelada.*cartao/)
  })

  it('rejeita parcelado sem parcelas_total (ou com valor menor que 2)', () => {
    const semParcelas = parseCSVImportacao(csv('01/01/2026,parcelado,,,10,Mercado,cartao,Nubank,'), categorias, cartoes)
    const parcelaUnica = parseCSVImportacao(csv('01/01/2026,parcelado,1,,10,Mercado,cartao,Nubank,'), categorias, cartoes)

    expect(semParcelas.linhasValidas).toEqual([])
    expect(parcelaUnica.linhasValidas).toEqual([])
  })

  it('rejeita recorrente sem frequencia válida', () => {
    const resultado = parseCSVImportacao(csv('01/01/2026,recorrente,,,10,Mercado,pix,,'), categorias, cartoes)

    expect(resultado.linhasValidas).toEqual([])
    expect(resultado.erros[0].mensagem).toMatch(/frequencia/)
  })

  it('rejeita tipo inválido', () => {
    const resultado = parseCSVImportacao(csv('01/01/2026,esporadico,,,10,Mercado,pix,,'), categorias, cartoes)

    expect(resultado.erros[0].mensagem).toMatch(/tipo inválido/)
  })

  it('rejeita data em formato errado ou inexistente', () => {
    const formatoErrado = parseCSVImportacao(csv('2026-01-15,unico,,,10,Mercado,pix,,'), categorias, cartoes)
    const diaInexistente = parseCSVImportacao(csv('31/02/2026,unico,,,10,Mercado,pix,,'), categorias, cartoes)

    expect(formatoErrado.linhasValidas).toEqual([])
    expect(diaInexistente.linhasValidas).toEqual([])
  })

  it('rejeita valor zero, negativo ou não numérico', () => {
    const zero = parseCSVImportacao(csv('01/01/2026,unico,,,0,Mercado,pix,,'), categorias, cartoes)
    const negativo = parseCSVImportacao(csv('01/01/2026,unico,,,-10,Mercado,pix,,'), categorias, cartoes)
    const texto = parseCSVImportacao(csv('01/01/2026,unico,,,abc,Mercado,pix,,'), categorias, cartoes)

    expect(zero.linhasValidas).toEqual([])
    expect(negativo.linhasValidas).toEqual([])
    expect(texto.linhasValidas).toEqual([])
  })

  it('confirma número da linha (cabeçalho = linha 1) e continua processando após uma linha inválida', () => {
    const resultado = parseCSVImportacao(
      csv(
        '01/01/2026,unico,,,10,Mercado,pix,,ok',
        '02/01/2026,unico,,,-5,Mercado,pix,,invalida',
        '03/01/2026,unico,,,20,Mercado,pix,,ok de novo',
      ),
      categorias,
      cartoes,
    )

    expect(resultado.linhasValidas.map((l) => l.linha)).toEqual([2, 4])
    expect(resultado.erros).toEqual([{ linha: 3, mensagem: 'valor inválido "-5"' }])
  })

  it('linhas vazias no meio do CSV não quebram a numeração nem viram erro', () => {
    const resultado = parseCSVImportacao(
      csv('01/01/2026,unico,,,10,Mercado,pix,,primeira', '', '03/01/2026,unico,,,20,Mercado,pix,,terceira'),
      categorias,
      cartoes,
    )

    expect(resultado.erros).toEqual([])
    expect(resultado.linhasValidas).toHaveLength(2)
  })

  it('não obriga cartão vazio quando meio_pagamento é pix', () => {
    const resultado = parseCSVImportacao(csv('01/01/2026,unico,,,10,Mercado,pix,,'), categorias, cartoes)

    expect(resultado.erros).toEqual([])
    expect(resultado.linhasValidas[0].cartaoId).toBeUndefined()
  })
})

describe('separarNovasEDuplicadas', () => {
  const gastoExistente: GastoParaComparacao = {
    data: '2026-01-15',
    valor: 45.9,
    categoriaId: 'mercado-id',
    meioPagamento: 'pix',
    descricao: 'compra do mês',
  }

  it('linha idêntica a um gasto existente (mesma data/valor/categoria/meio/descrição) é duplicata', () => {
    const { linhasValidas } = parseCSVImportacao(
      csv('15/01/2026,unico,,,45.90,Mercado,pix,,compra do mês'),
      categorias,
      cartoes,
    )

    const { linhasNovas, linhasDuplicadas } = separarNovasEDuplicadas(linhasValidas, [gastoExistente])

    expect(linhasNovas).toEqual([])
    expect(linhasDuplicadas).toHaveLength(1)
  })

  it.each([
    ['data diferente', '16/01/2026,unico,,,45.90,Mercado,pix,,compra do mês'],
    ['valor diferente', '15/01/2026,unico,,,45.91,Mercado,pix,,compra do mês'],
    ['meio de pagamento diferente (precisa de cartão cadastrado)', '15/01/2026,unico,,,45.90,Mercado,cartao,Nubank,compra do mês'],
    ['descrição diferente', '15/01/2026,unico,,,45.90,Mercado,pix,,outra compra'],
  ])('%s → não é duplicata', (_nome, linhaCSV) => {
    const { linhasValidas } = parseCSVImportacao(csv(linhaCSV), categorias, cartoes)

    const { linhasNovas, linhasDuplicadas } = separarNovasEDuplicadas(linhasValidas, [gastoExistente])

    expect(linhasDuplicadas).toEqual([])
    expect(linhasNovas).toHaveLength(1)
  })

  it('categoria diferente (ainda que só o nome mude) não é duplicata', () => {
    const outraCategoria: Categoria = { id: 'outra-id', nome: 'Outra', ativa: true }
    const { linhasValidas } = parseCSVImportacao(
      csv('15/01/2026,unico,,,45.90,Outra,pix,,compra do mês'),
      [...categorias, outraCategoria],
      cartoes,
    )

    const { linhasNovas, linhasDuplicadas } = separarNovasEDuplicadas(linhasValidas, [gastoExistente])

    expect(linhasDuplicadas).toEqual([])
    expect(linhasNovas).toHaveLength(1)
  })

  it('linha com categoria nova nunca é duplicata (não existe gasto pra uma categoria que ainda não existe)', () => {
    const { linhasValidas } = parseCSVImportacao(
      csv('15/01/2026,unico,,,45.90,Categoria Inédita,pix,,compra do mês'),
      categorias,
      cartoes,
    )

    const { linhasNovas, linhasDuplicadas } = separarNovasEDuplicadas(linhasValidas, [gastoExistente])

    expect(linhasDuplicadas).toEqual([])
    expect(linhasNovas).toHaveLength(1)
    expect(linhasNovas[0].categoriaNomeNova).toBe('Categoria Inédita')
  })

  it('sem descrição nos dois lados também bate como duplicata', () => {
    const gastoSemDescricao: GastoParaComparacao = { ...gastoExistente, descricao: undefined }
    const { linhasValidas } = parseCSVImportacao(csv('15/01/2026,unico,,,45.90,Mercado,pix,,'), categorias, cartoes)

    const { linhasDuplicadas } = separarNovasEDuplicadas(linhasValidas, [gastoSemDescricao])

    expect(linhasDuplicadas).toHaveLength(1)
  })

  it('espaços extras na descrição não impedem de reconhecer a duplicata', () => {
    const { linhasValidas } = parseCSVImportacao(
      csv('15/01/2026,unico,,,45.90,Mercado,pix,,"  compra do mês  "'),
      categorias,
      cartoes,
    )

    const { linhasDuplicadas } = separarNovasEDuplicadas(linhasValidas, [gastoExistente])

    expect(linhasDuplicadas).toHaveLength(1)
  })

  it('reimportar o mesmo CSV inteiro: linhas já existentes viram duplicata, só as novas de fato passam', () => {
    const { linhasValidas } = parseCSVImportacao(
      csv(
        '15/01/2026,unico,,,45.90,Mercado,pix,,compra do mês', // já existe
        '20/01/2026,unico,,,30.00,Mercado,pix,,outra compra', // nova
      ),
      categorias,
      cartoes,
    )

    const { linhasNovas, linhasDuplicadas } = separarNovasEDuplicadas(linhasValidas, [gastoExistente])

    expect(linhasDuplicadas).toHaveLength(1)
    expect(linhasNovas).toHaveLength(1)
    expect(linhasNovas[0].descricao).toBe('outra compra')
  })

  it('duas linhas idênticas no mesmo CSV, nenhuma ainda no banco: as duas são novas (só compara contra o banco, não entre linhas do arquivo)', () => {
    const { linhasValidas } = parseCSVImportacao(
      csv(
        '15/01/2026,unico,,,45.90,Mercado,pix,,compra do mês',
        '15/01/2026,unico,,,45.90,Mercado,pix,,compra do mês',
      ),
      categorias,
      cartoes,
    )

    const { linhasNovas, linhasDuplicadas } = separarNovasEDuplicadas(linhasValidas, [])

    expect(linhasDuplicadas).toEqual([])
    expect(linhasNovas).toHaveLength(2)
  })
})
