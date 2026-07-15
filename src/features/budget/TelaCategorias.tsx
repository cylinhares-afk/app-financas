import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useOrcamentoMensal } from './useOrcamentoMensal'
import { calcularResumoCategorias } from './calculations'
import { CategoriaCard } from './CategoriaCard'
import { formatMoeda, semNegativo } from '../../lib/formatMoeda'
import { mesAnterior, mesSeguinte, nomeDoMes } from '../../lib/navegacaoMes'
import type { MesAno } from '../../lib/navegacaoMes'
import { resolverPrevisaoEfetiva } from './previsaoEfetiva'
import { arquivarCategoria, atualizarCategoria, criarCategoria, definirPrevisaoMensal } from '../../lib/queries'
import type { PrevisaoMensal } from '../../types/domain'

interface TelaCategoriasProps {
  // Quando true, a tela já abre no modo de edição do previsto — usado
  // quando se chega aqui com a intenção explícita de editar (Menu, ou o
  // atalho "+ nova categoria" do Registro), em vez do modo de visualização
  // normal (navegação direta pela aba Categorias).
  iniciarEmEdicao?: boolean
  // Quando informado, veio do atalho "+ nova categoria" do Registro: ao criar
  // uma categoria com sucesso, volta automaticamente já com ela selecionada.
  aoCriarCategoria?: (categoriaId: string) => void
  // Só existe (e só faz sentido mostrar um "← Voltar") quando aoCriarCategoria
  // também existe — veio do Registro e precisa de um jeito de voltar pra lá
  // mesmo sem ter criado uma categoria nova.
  onVoltar?: () => void
}

const hoje = new Date()
const ANO_ATUAL = hoje.getFullYear()
const MES_ATUAL = hoje.getMonth() + 1

function rotuloOrigem(efetiva: PrevisaoMensal | null, mesVisualizado: MesAno): string {
  if (!efetiva) return 'nunca definido'
  if (efetiva.ano === mesVisualizado.ano && efetiva.mes === mesVisualizado.mes) return 'definido neste mês'
  return `herdado de ${nomeDoMes(efetiva.ano, efetiva.mes)}`
}

export function TelaCategorias({ iniciarEmEdicao, aoCriarCategoria, onVoltar }: TelaCategoriasProps) {
  const [mesVisualizado, setMesVisualizado] = useState<MesAno>({ ano: ANO_ATUAL, mes: MES_ATUAL })
  const { categorias, todasPrevisoes, orcamento, diasNoMes, diaAtual, carregando, erro, recarregar } =
    useOrcamentoMensal(mesVisualizado.ano, mesVisualizado.mes)

  const [modoEdicao, setModoEdicao] = useState(Boolean(iniciarEmEdicao))
  const [valores, setValores] = useState<Record<string, string>>({})
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [salvoId, setSalvoId] = useState<string | null>(null)
  const [erroEdicao, setErroEdicao] = useState<string | null>(null)

  const [nomeNovaCategoria, setNomeNovaCategoria] = useState('')
  const [criandoCategoria, setCriandoCategoria] = useState(false)

  const [editandoNomeId, setEditandoNomeId] = useState<string | null>(null)
  const [nomeEmEdicao, setNomeEmEdicao] = useState('')
  const [salvandoNomeId, setSalvandoNomeId] = useState<string | null>(null)
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  // Valor efetivo (com herança) de cada categoria pro mês visualizado —
  // atualizado sempre que a lista de categorias, o histórico de previsões
  // ou o mês navegado mudam (inclusive depois de salvar, via recarregar()).
  useEffect(() => {
    if (categorias.length === 0) return

    setValores(
      Object.fromEntries(
        categorias.map((categoria) => {
          const previsoesDaCategoria = todasPrevisoes.filter((p) => p.categoriaId === categoria.id)
          const efetiva = resolverPrevisaoEfetiva(previsoesDaCategoria, mesVisualizado.ano, mesVisualizado.mes)
          return [categoria.id, efetiva ? String(efetiva.valorPrevisto) : '']
        }),
      ),
    )
  }, [categorias, todasPrevisoes, mesVisualizado])

  async function handleSalvarPrevisao(categoriaId: string) {
    const valor = Number(valores[categoriaId]?.replace(',', '.') ?? 0)
    setSalvandoId(categoriaId)
    setSalvoId(null)
    setErroEdicao(null)

    const { erro: erroSalvar } = await definirPrevisaoMensal(
      categoriaId,
      mesVisualizado.ano,
      mesVisualizado.mes,
      valor,
    )
    setSalvandoId(null)

    if (erroSalvar) {
      setErroEdicao(erroSalvar)
      return
    }

    await recarregar()
    setSalvoId(categoriaId)
    setTimeout(() => setSalvoId((atual) => (atual === categoriaId ? null : atual)), 1500)
  }

  async function handleCriarCategoria(evento: FormEvent) {
    evento.preventDefault()
    if (!nomeNovaCategoria.trim()) return

    setCriandoCategoria(true)
    const { id, erro: erroCriar } = await criarCategoria(nomeNovaCategoria.trim())
    setCriandoCategoria(false)

    if (erroCriar) {
      setErroEdicao(erroCriar)
      return
    }

    if (aoCriarCategoria && id) {
      aoCriarCategoria(id)
      return
    }

    setNomeNovaCategoria('')
    await recarregar()
  }

  function iniciarEdicaoNome(categoriaId: string, nomeAtual: string) {
    setConfirmandoExclusaoId(null)
    setNomeEmEdicao(nomeAtual)
    setEditandoNomeId(categoriaId)
  }

  async function salvarNome(categoriaId: string) {
    if (!nomeEmEdicao.trim()) return

    setSalvandoNomeId(categoriaId)
    setErroEdicao(null)
    const { erro: erroSalvar } = await atualizarCategoria(categoriaId, nomeEmEdicao.trim())
    setSalvandoNomeId(null)

    if (erroSalvar) {
      setErroEdicao(erroSalvar)
      return
    }

    setEditandoNomeId(null)
    await recarregar()
  }

  async function excluirCategoria(categoriaId: string) {
    setExcluindoId(categoriaId)
    setErroEdicao(null)
    const { erro: erroExcluir } = await arquivarCategoria(categoriaId)
    setExcluindoId(null)

    if (erroExcluir) {
      setErroEdicao(erroExcluir)
      setConfirmandoExclusaoId(null)
      return
    }

    setConfirmandoExclusaoId(null)
    await recarregar()
  }

  if (carregando) return <p className="tela-categorias__aviso">Carregando…</p>

  if (erro) return <p className="tela-categorias__aviso">Erro ao carregar categorias: {erro}</p>

  const resumo = calcularResumoCategorias(orcamento.porCategoria, diaAtual)
  const jaEstaNoMesAtual = mesVisualizado.ano === ANO_ATUAL && mesVisualizado.mes === MES_ATUAL

  return (
    <div className="tela-categorias">
      {onVoltar && (
        <button type="button" className="tela-previsao__voltar" onClick={onVoltar}>
          ← Voltar
        </button>
      )}

      <div className="tela-home__cabecalho">
        <div className="tela-home__navegacao-mes">
          <button
            type="button"
            className="tela-home__seta"
            onClick={() => setMesVisualizado(mesAnterior(mesVisualizado))}
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <span>{nomeDoMes(mesVisualizado.ano, mesVisualizado.mes)}</span>
          <button
            type="button"
            className="tela-home__seta"
            onClick={() => setMesVisualizado(mesSeguinte(mesVisualizado))}
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          className={`tela-home__hoje ${jaEstaNoMesAtual ? 'tela-home__hoje--atual' : ''}`}
          onClick={() => setMesVisualizado({ ano: ANO_ATUAL, mes: MES_ATUAL })}
        >
          Hoje
        </button>
      </div>

      <div className="tela-categorias__resumo">
        <div className="tela-categorias__resumo-linha">
          <span>Total previsto</span>
          <strong>{formatMoeda(resumo.totalPrevisto)}</strong>
        </div>
        <div className="tela-categorias__resumo-linha">
          <span>Total gasto até hoje</span>
          <strong>{formatMoeda(resumo.totalGasto)}</strong>
        </div>
        <div className="tela-categorias__resumo-linha">
          <span>Sobra</span>
          <strong className={resumo.sobra < 0 ? 'tela-categorias__valor--negativo' : ''}>
            {formatMoeda(resumo.sobra)}
          </strong>
        </div>
        <div className="tela-categorias__resumo-comparacao">
          <div>
            <span>Diário médio</span>
            <strong>{formatMoeda(resumo.diarioMedio)}</strong>
          </div>
          <div>
            <span>Diário previsto</span>
            <strong>{formatMoeda(resumo.diarioPrevistoHoje)}</strong>
          </div>
        </div>
      </div>

      {categorias.length === 0 && !modoEdicao ? (
        <div className="tela-categorias__vazio">
          <p>Nenhuma categoria cadastrada ainda.</p>
          <button type="button" onClick={() => setModoEdicao(true)}>
            Cadastrar categorias e previsão do mês
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="tela-categorias__editar"
            onClick={() => {
              setErroEdicao(null)
              setModoEdicao((atual) => !atual)
            }}
          >
            {modoEdicao ? 'Ver categorias' : 'Editar previsão do mês'}
          </button>

          {modoEdicao ? (
            <>
              <p className="tela-login__subtitulo">
                Um mês sem edição própria repete automaticamente o último valor definido pra essa categoria.
                Edite só quando o valor desse mês for diferente do padrão.
              </p>

              {erroEdicao && <p className="tela-login__erro">{erroEdicao}</p>}

              <div className="tela-previsao__lista">
                {categorias.map((categoria) => {
                  const previsoesDaCategoria = todasPrevisoes.filter((p) => p.categoriaId === categoria.id)
                  const efetiva = resolverPrevisaoEfetiva(
                    previsoesDaCategoria,
                    mesVisualizado.ano,
                    mesVisualizado.mes,
                  )

                  return (
                    <div key={categoria.id} className="tela-categorias__item-edicao">
                      <div className="tela-previsao__linha">
                        <div className="tela-previsao__categoria">
                          {editandoNomeId === categoria.id ? (
                            <input
                              type="text"
                              value={nomeEmEdicao}
                              onChange={(evento) => setNomeEmEdicao(evento.target.value)}
                              autoFocus
                            />
                          ) : (
                            <span>{categoria.nome}</span>
                          )}
                          <span className="tela-previsao__origem">{rotuloOrigem(efetiva, mesVisualizado)}</span>
                        </div>
                        <div className="tela-previsao__valor-wrapper">
                          <span className="tela-previsao__prefixo">R$</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            placeholder="0,00"
                            value={valores[categoria.id] ?? ''}
                            onChange={(evento) =>
                              setValores((atual) => ({ ...atual, [categoria.id]: semNegativo(evento.target.value) }))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          disabled={salvandoId === categoria.id}
                          onClick={() => handleSalvarPrevisao(categoria.id)}
                        >
                          {salvandoId === categoria.id ? '…' : salvoId === categoria.id ? 'Salvo ✓' : 'Salvar'}
                        </button>
                      </div>

                      <div className="tela-cartoes__acoes">
                        {editandoNomeId === categoria.id ? (
                          <>
                            <button
                              type="button"
                              disabled={salvandoNomeId === categoria.id}
                              onClick={() => salvarNome(categoria.id)}
                            >
                              {salvandoNomeId === categoria.id ? '…' : 'Salvar nome'}
                            </button>
                            <button type="button" onClick={() => setEditandoNomeId(null)}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => iniciarEdicaoNome(categoria.id, categoria.nome)}>
                              Renomear
                            </button>
                            {confirmandoExclusaoId === categoria.id ? (
                              <button
                                type="button"
                                className="tela-cartoes__excluir-confirmar"
                                disabled={excluindoId === categoria.id}
                                onClick={() => excluirCategoria(categoria.id)}
                              >
                                {excluindoId === categoria.id ? '…' : 'Confirmar exclusão?'}
                              </button>
                            ) : (
                              <button type="button" onClick={() => setConfirmandoExclusaoId(categoria.id)}>
                                Excluir
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <form className="tela-previsao__nova-categoria" onSubmit={handleCriarCategoria}>
                <input
                  type="text"
                  placeholder="nova categoria (ex: Farmácia)"
                  value={nomeNovaCategoria}
                  onChange={(evento) => setNomeNovaCategoria(evento.target.value)}
                />
                <button type="submit" disabled={criandoCategoria}>
                  {criandoCategoria ? 'Adicionando…' : 'Adicionar categoria'}
                </button>
              </form>
            </>
          ) : (
            <div className="tela-categorias__lista">
              {categorias.map((categoria) => {
                const resultado = orcamento.porCategoria.find((item) => item.categoriaId === categoria.id)
                if (!resultado) return null
                return (
                  <CategoriaCard
                    key={categoria.id}
                    categoria={categoria}
                    orcamento={resultado}
                    diasNoMes={diasNoMes}
                  />
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
