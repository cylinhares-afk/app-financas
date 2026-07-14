/**
 * Exemplo de placeholder pro campo "Descrição", condizente com a categoria
 * escolhida — categorias são texto livre (o usuário nomeia como quiser), então
 * casamos por palavra-chave no nome, não por um id fixo. Sem nenhuma palavra
 * reconhecida, cai num exemplo genérico.
 */

const EXEMPLOS_POR_PALAVRA_CHAVE: { palavras: string[]; exemplo: string }[] = [
  { palavras: ['mercado', 'supermercado', 'feira', 'hortifruti'], exemplo: 'arroz, feijão, carne, produtos de limpeza' },
  { palavras: ['casa', 'moradia', 'aluguel', 'condominio'], exemplo: 'conserto da torneira, lâmpada, produtos de limpeza' },
  { palavras: ['delivery', 'comer fora', 'restaurante', 'ifood', 'lanche'], exemplo: 'pizza de sexta, ifood do fim de semana' },
  { palavras: ['uber', 'transporte', '99', 'taxi', 'combustivel', 'gasolina', 'estacionamento'], exemplo: 'corrida pro aeroporto, gasolina do mês' },
  { palavras: ['saude', 'farmacia', 'remedio', 'medico', 'dentista'], exemplo: 'consulta, remédio, exame de rotina' },
  { palavras: ['lazer', 'cinema', 'viagem', 'diversao', 'show'], exemplo: 'cinema, ingresso do show, passeio do fim de semana' },
  { palavras: ['gata', 'gato', 'pet', 'cachorro', 'cao'], exemplo: 'ração, areia, brinquedo, consulta no veterinário' },
  { palavras: ['roupa', 'vestuario', 'calcado'], exemplo: 'calça, tênis, roupa de trabalho' },
  { palavras: ['educacao', 'curso', 'escola', 'faculdade', 'livro'], exemplo: 'mensalidade, material escolar, curso online' },
  { palavras: ['assinatura', 'streaming'], exemplo: 'Netflix, Spotify, plano do celular' },
  { palavras: ['presente', 'aniversario'], exemplo: 'presente de aniversário, lembrancinha' },
  { palavras: ['trabalho', 'ferramenta', 'escritorio'], exemplo: 'material de escritório, ferramenta pro freela' },
  { palavras: ['beleza', 'cabelo', 'salao', 'estetica'], exemplo: 'corte de cabelo, manicure, produtos de higiene' },
]

const EXEMPLO_GENERICO = 'detalhe do que foi comprado'

const REGEX_DIACRITICOS = /[̀-ͯ]/g

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(REGEX_DIACRITICOS, '')
}

/**
 * A palavra-chave precisa começar num limite de palavra (`\b`), mas aceita
 * sufixo solto depois (`\w*`) pra cobrir plural — "gata" casa com "gatas".
 * Sem o `\b` inicial, "educação" (normalizado "educacao") "casaria" com a
 * palavra-chave "cao" só por conter essas letras em sequência no meio.
 */
function contemPalavra(texto: string, palavra: string): boolean {
  return new RegExp(`\\b${palavra}\\w*\\b`).test(texto)
}

export function exemploDescricao(nomeCategoria: string): string {
  const nomeNormalizado = normalizar(nomeCategoria)
  const grupo = EXEMPLOS_POR_PALAVRA_CHAVE.find(({ palavras }) =>
    palavras.some((palavra) => contemPalavra(nomeNormalizado, palavra)),
  )
  return grupo?.exemplo ?? EXEMPLO_GENERICO
}
