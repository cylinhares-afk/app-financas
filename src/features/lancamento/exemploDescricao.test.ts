import { describe, expect, it } from 'vitest'
import { exemploDescricao } from './exemploDescricao'

describe('exemploDescricao', () => {
  it('reconhece a categoria por palavra-chave, sem depender de acento ou maiúscula', () => {
    expect(exemploDescricao('Mercado')).toBe('arroz, feijão, carne, produtos de limpeza')
    expect(exemploDescricao('SAÚDE')).toBe('consulta, remédio, exame de rotina')
    expect(exemploDescricao('educação')).toContain('mensalidade')
  })

  it('casa por substring, então nomes compostos pela usuária continuam funcionando', () => {
    expect(exemploDescricao('Compras casa')).toBe('conserto da torneira, lâmpada, produtos de limpeza')
    expect(exemploDescricao('Compras gatas')).toBe('ração, areia, brinquedo, consulta no veterinário')
    expect(exemploDescricao('Comer fora')).toBe('pizza de sexta, ifood do fim de semana')
  })

  it('cai no exemplo genérico quando a categoria não bate com nenhuma palavra-chave', () => {
    expect(exemploDescricao('Investimentos')).toBe('detalhe do que foi comprado')
    expect(exemploDescricao('')).toBe('detalhe do que foi comprado')
  })

  it('não casa palavra-chave curta escondida no meio de outra palavra (ex: "cão" dentro de "educação")', () => {
    // regressão: "educação" normalizado vira "educacao", que contém as letras
    // de "cao" em sequência sem ser a palavra "cão" de verdade
    expect(exemploDescricao('Educação')).not.toBe('ração, areia, brinquedo, consulta no veterinário')
    expect(exemploDescricao('Educação')).toBe('mensalidade, material escolar, curso online')
  })
})
