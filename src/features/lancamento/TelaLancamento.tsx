import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  criarCompraParcelada,
  criarEntrada,
  criarGasto,
  criarRecorrencia,
  fetchCartoes,
  fetchCategorias,
} from '../../lib/queries'
import { hojeISO } from '../../lib/dataISO'
import { semNegativo } from '../../lib/formatMoeda'
import { calcularParcelas } from './parcelamento'
import { exemploDescricao } from './exemploDescricao'
import { gerarOcorrenciasRecorrentesPendentes } from './gerarOcorrenciasRecorrentes'
import type { Cartao, Categoria, Frequencia, MeioPagamento, TipoMovimento } from '../../types/domain'

interface TelaLancamentoProps {
  usuarioId: string
  tipoMovimentoInicial: TipoMovimento
  dataInicial: string
  categoriaParaSelecionar: string | null
  onGastoRegistrado: () => void
  onEditarPrevisao: () => void
}

type TipoLancamento = 'unico' | 'recorrente' | 'parcelado'
type Repeticao = 'indeterminado' | 'vezes'

const ORIGENS_ENTRADA = ['Salário Cynthia', 'Salário Mary', 'Freela', 'Outro'] as const

export function TelaLancamento({
  usuarioId,
  tipoMovimentoInicial,
  dataInicial,
  categoriaParaSelecionar,
  onGastoRegistrado,
  onEditarPrevisao,
}: TelaLancamentoProps) {
  const [tipoMovimento, setTipoMovimento] = useState<TipoMovimento>(tipoMovimentoInicial)
  const [tipo, setTipo] = useState<TipoLancamento>('unico')

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [cartaoId, setCartaoId] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(dataInicial || hojeISO())
  const [meioPagamento, setMeioPagamento] = useState<MeioPagamento>('dinheiro')
  const [descricao, setDescricao] = useState('')

  const [origemSelecionada, setOrigemSelecionada] = useState<(typeof ORIGENS_ENTRADA)[number]>(
    ORIGENS_ENTRADA[0],
  )
  const [origemCustomizada, setOrigemCustomizada] = useState('')

  const [frequencia, setFrequencia] = useState<Frequencia>('mensal')
  const [repeticao, setRepeticao] = useState<Repeticao>('indeterminado')
  const [numeroVezes, setNumeroVezes] = useState('12')

  const [numeroParcelas, setNumeroParcelas] = useState('2')

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchCategorias(), fetchCartoes()]).then(
      ([{ dados: categoriasDados, erro: erroCategorias }, { dados: cartoesDados, erro: erroCartoes }]) => {
        // Categoria arquivada não aparece pra novo lançamento — só continua
        // válida nos lançamentos antigos que já a usavam.
        const categoriasAtivas = categoriasDados.filter((categoria) => categoria.ativa)
        setCategorias(categoriasAtivas)
        if (categoriasAtivas.length > 0) setCategoriaId(categoriasAtivas[0].id)
        setCartoes(cartoesDados)
        if (cartoesDados.length > 0) setCartaoId(cartoesDados[0].id)
        setErro(erroCategorias ?? erroCartoes)
        setCarregando(false)
      },
    )
  }, [])

  // Ao voltar da tela de Previsão com uma categoria recém-criada, recarrega a
  // lista (agora incluindo ela) e já deixa selecionada.
  useEffect(() => {
    if (!categoriaParaSelecionar) return
    fetchCategorias().then(({ dados }) => {
      setCategorias(dados.filter((categoria) => categoria.ativa))
      setCategoriaId(categoriaParaSelecionar)
    })
  }, [categoriaParaSelecionar])

  function handleTrocarTipoMovimento(novoTipo: TipoMovimento) {
    setTipoMovimento(novoTipo)
    if (novoTipo === 'entrada' && tipo === 'parcelado') setTipo('unico')
  }

  function limparFormularioEAvisar() {
    setValor('')
    setDescricao('')
    onGastoRegistrado()
  }

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    const valorNumerico = Number(valor.replace(',', '.'))
    if (!valorNumerico || valorNumerico <= 0) {
      setErro('Preencha um valor válido.')
      return
    }

    if (tipoMovimento === 'entrada') {
      const descricaoFinal =
        origemSelecionada === 'Outro' ? origemCustomizada.trim() : origemSelecionada
      if (!descricaoFinal) {
        setErro('Escolha ou digite a origem da entrada.')
        return
      }

      if (tipo === 'unico') {
        setSalvando(true)
        const { erro: erroSalvar } = await criarEntrada({
          usuarioId,
          valor: valorNumerico,
          data,
          descricao: descricaoFinal,
        })
        setSalvando(false)
        if (erroSalvar) {
          setErro(erroSalvar)
          return
        }
        limparFormularioEAvisar()
        return
      }

      // recorrente
      const numeroOcorrencias = repeticao === 'vezes' ? Number(numeroVezes) : undefined
      if (repeticao === 'vezes' && (!numeroOcorrencias || numeroOcorrencias < 1)) {
        setErro('Informe quantas vezes a recorrência deve se repetir.')
        return
      }

      setSalvando(true)
      const { erro: erroCriar } = await criarRecorrencia({
        tipoMovimento: 'entrada',
        usuarioId,
        valor: valorNumerico,
        frequencia,
        dataInicio: data,
        numeroOcorrencias,
        descricao: descricaoFinal,
      })
      if (erroCriar) {
        setSalvando(false)
        setErro(erroCriar)
        return
      }
      const { erro: erroGerar } = await gerarOcorrenciasRecorrentesPendentes()
      setSalvando(false)
      if (erroGerar) {
        setErro(erroGerar)
        return
      }
      limparFormularioEAvisar()
      return
    }

    // saída
    if (!categoriaId) {
      setErro('Escolha (ou crie) uma categoria.')
      return
    }

    const precisaCartao = tipo === 'parcelado' || meioPagamento === 'cartao'
    if (precisaCartao && cartoes.length > 0 && !cartaoId) {
      setErro('Escolha o cartão usado nesse lançamento.')
      return
    }
    const cartaoIdParaSalvar = precisaCartao && cartaoId ? cartaoId : undefined
    // Snapshot do fechamento/vencimento do cartão escolhido, capturado AGORA
    // — uma edição futura do cadastro do cartão não deve mudar o vencimento
    // dessa compra já lançada (ver faturaCartao.ts).
    const cartaoSelecionado = cartaoIdParaSalvar ? cartoes.find((c) => c.id === cartaoIdParaSalvar) : undefined

    const descricaoSaida = descricao.trim() || undefined

    if (tipo === 'unico') {
      setSalvando(true)
      const { erro: erroSalvar } = await criarGasto({
        categoriaId,
        usuarioId,
        valor: valorNumerico,
        data,
        meioPagamento,
        cartaoId: cartaoIdParaSalvar,
        cartaoDiaFechamento: cartaoSelecionado?.diaFechamento,
        cartaoDiaVencimento: cartaoSelecionado?.diaVencimento,
        descricao: descricaoSaida,
      })
      setSalvando(false)
      if (erroSalvar) {
        setErro(erroSalvar)
        return
      }
      limparFormularioEAvisar()
      return
    }

    if (tipo === 'recorrente') {
      const numeroOcorrencias = repeticao === 'vezes' ? Number(numeroVezes) : undefined
      if (repeticao === 'vezes' && (!numeroOcorrencias || numeroOcorrencias < 1)) {
        setErro('Informe quantas vezes a recorrência deve se repetir.')
        return
      }

      setSalvando(true)
      const { erro: erroCriar } = await criarRecorrencia({
        tipoMovimento: 'saida',
        categoriaId,
        usuarioId,
        valor: valorNumerico,
        meioPagamento,
        cartaoId: cartaoIdParaSalvar,
        frequencia,
        dataInicio: data,
        numeroOcorrencias,
        descricao: descricaoSaida,
      })
      if (erroCriar) {
        setSalvando(false)
        setErro(erroCriar)
        return
      }
      const { erro: erroGerar } = await gerarOcorrenciasRecorrentesPendentes()
      setSalvando(false)
      if (erroGerar) {
        setErro(erroGerar)
        return
      }
      limparFormularioEAvisar()
      return
    }

    // parcelado
    const numeroParcelasNumerico = Number(numeroParcelas)
    if (!numeroParcelasNumerico || numeroParcelasNumerico < 2) {
      setErro('Uma compra parcelada precisa de pelo menos 2 parcelas.')
      return
    }

    setSalvando(true)
    const { id: compraId, erro: erroCompra } = await criarCompraParcelada({
      categoriaId,
      valorTotal: valorNumerico,
      numeroParcelas: numeroParcelasNumerico,
      dataCompra: data,
      descricao: descricaoSaida,
    })
    if (erroCompra || !compraId) {
      setSalvando(false)
      setErro(erroCompra ?? 'Erro ao criar a compra parcelada.')
      return
    }

    const parcelas = calcularParcelas(valorNumerico, numeroParcelasNumerico, data)
    for (const parcela of parcelas) {
      const { erro: erroParcela } = await criarGasto({
        categoriaId,
        usuarioId,
        valor: parcela.valor,
        data: parcela.data,
        meioPagamento: 'cartao',
        cartaoId: cartaoIdParaSalvar,
        cartaoDiaFechamento: cartaoSelecionado?.diaFechamento,
        cartaoDiaVencimento: cartaoSelecionado?.diaVencimento,
        descricao: descricaoSaida,
        compraParceladaId: compraId,
        numeroParcela: parcela.numero,
      })
      if (erroParcela) {
        setSalvando(false)
        setErro(erroParcela)
        return
      }
    }

    setSalvando(false)
    limparFormularioEAvisar()
  }

  if (carregando) return <p className="tela-categorias__aviso">Carregando…</p>

  const textoBotao =
    tipoMovimento === 'entrada'
      ? tipo === 'unico'
        ? 'Registrar entrada'
        : 'Criar entrada recorrente'
      : { unico: 'Registrar gasto', recorrente: 'Criar recorrência', parcelado: 'Criar compra parcelada' }[
          tipo
        ]

  const nomeCategoriaSelecionada = categorias.find((categoria) => categoria.id === categoriaId)?.nome ?? ''

  return (
    <form className="tela-lancamento" onSubmit={handleSubmit}>
      <div className="tela-lancamento__tipos">
        <button
          type="button"
          className={tipoMovimento === 'entrada' ? 'tela-lancamento__tipo--ativo' : ''}
          onClick={() => handleTrocarTipoMovimento('entrada')}
        >
          ↙ Entrada
        </button>
        <button
          type="button"
          className={tipoMovimento === 'saida' ? 'tela-lancamento__tipo--ativo' : ''}
          onClick={() => handleTrocarTipoMovimento('saida')}
        >
          ↗ Saída
        </button>
      </div>

      <input
        className="tela-lancamento__valor"
        type="number"
        inputMode="decimal"
        min={0}
        placeholder="0,00"
        value={valor}
        onChange={(evento) => setValor(semNegativo(evento.target.value))}
        autoFocus
      />
      {tipo === 'parcelado' && <p className="tela-lancamento__legenda">valor total da compra</p>}

      {erro && <p className="tela-login__erro">{erro}</p>}

      <div className="tela-lancamento__tipos">
        <button
          type="button"
          className={tipo === 'unico' ? 'tela-lancamento__tipo--ativo' : ''}
          onClick={() => setTipo('unico')}
        >
          Único
        </button>
        <button
          type="button"
          className={tipo === 'recorrente' ? 'tela-lancamento__tipo--ativo' : ''}
          onClick={() => setTipo('recorrente')}
        >
          Recorrente
        </button>
        {tipoMovimento === 'saida' && (
          <button
            type="button"
            className={tipo === 'parcelado' ? 'tela-lancamento__tipo--ativo' : ''}
            onClick={() => setTipo('parcelado')}
          >
            Parcelado
          </button>
        )}
      </div>

      {tipoMovimento === 'entrada' ? (
        <label className="tela-lancamento__campo">
          <span>Origem</span>
          <select
            value={origemSelecionada}
            onChange={(evento) =>
              setOrigemSelecionada(evento.target.value as (typeof ORIGENS_ENTRADA)[number])
            }
          >
            {ORIGENS_ENTRADA.map((origem) => (
              <option key={origem} value={origem}>
                {origem}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="tela-lancamento__campo">
          <span>Categoria</span>
          <div className="tela-lancamento__categoria-linha">
            <select value={categoriaId} onChange={(evento) => setCategoriaId(evento.target.value)}>
              {categorias.length === 0 && <option value="">nenhuma categoria ainda</option>}
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="tela-lancamento__nova-categoria-toggle"
              onClick={onEditarPrevisao}
            >
              + nova
            </button>
          </div>
        </label>
      )}

      {tipoMovimento === 'entrada' && origemSelecionada === 'Outro' && (
        <label className="tela-lancamento__campo">
          <span>Qual origem?</span>
          <input
            type="text"
            placeholder="ex: reembolso, presente..."
            value={origemCustomizada}
            onChange={(evento) => setOrigemCustomizada(evento.target.value)}
            autoFocus
          />
        </label>
      )}

      {tipoMovimento === 'saida' && (
        <label className="tela-lancamento__campo">
          <span>Descrição (opcional)</span>
          <input
            type="text"
            placeholder={`ex: ${exemploDescricao(nomeCategoriaSelecionada)}`}
            value={descricao}
            onChange={(evento) => setDescricao(evento.target.value)}
          />
        </label>
      )}

      <label className="tela-lancamento__campo">
        <span>{tipo === 'parcelado' ? 'Data da compra' : 'Data'}</span>
        <input type="date" value={data} onChange={(evento) => setData(evento.target.value)} />
      </label>

      {tipoMovimento === 'saida' && tipo !== 'parcelado' && (
        <label className="tela-lancamento__campo">
          <span>Meio de pagamento</span>
          <select
            value={meioPagamento}
            onChange={(evento) => setMeioPagamento(evento.target.value as MeioPagamento)}
          >
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao">Cartão</option>
          </select>
        </label>
      )}

      {tipoMovimento === 'saida' &&
        (tipo === 'parcelado' || meioPagamento === 'cartao') &&
        cartoes.length > 0 && (
          <label className="tela-lancamento__campo">
            <span>Cartão</span>
            <select value={cartaoId} onChange={(evento) => setCartaoId(evento.target.value)}>
              {cartoes.map((cartao) => (
                <option key={cartao.id} value={cartao.id}>
                  {cartao.nome}
                </option>
              ))}
            </select>
          </label>
        )}

      {tipo === 'recorrente' && (
        <>
          <label className="tela-lancamento__campo">
            <span>Repete</span>
            <select
              value={frequencia}
              onChange={(evento) => setFrequencia(evento.target.value as Frequencia)}
            >
              <option value="diaria">Diariamente</option>
              <option value="semanal">Semanalmente</option>
              <option value="mensal">Mensalmente</option>
            </select>
          </label>

          <label className="tela-lancamento__campo">
            <span>Por quanto tempo</span>
            <select
              value={repeticao}
              onChange={(evento) => setRepeticao(evento.target.value as Repeticao)}
            >
              <option value="indeterminado">Por tempo indeterminado</option>
              <option value="vezes">Um número de vezes</option>
            </select>
          </label>

          {repeticao === 'vezes' && (
            <label className="tela-lancamento__campo">
              <span>Quantas vezes</span>
              <input
                type="number"
                min={1}
                value={numeroVezes}
                onChange={(evento) => setNumeroVezes(evento.target.value)}
              />
            </label>
          )}
        </>
      )}

      {tipo === 'parcelado' && (
        <>
          <label className="tela-lancamento__campo">
            <span>Número de parcelas</span>
            <input
              type="number"
              min={2}
              value={numeroParcelas}
              onChange={(evento) => setNumeroParcelas(evento.target.value)}
            />
          </label>
          <p className="tela-lancamento__legenda">
            Compra parcelada é sempre no cartão. Cada parcela vira um gasto automático no mês
            correspondente, descontando do previsto da categoria normalmente.
          </p>
        </>
      )}

      <button type="submit" className="tela-lancamento__enviar" disabled={salvando}>
        {salvando ? 'Salvando…' : textoBotao}
      </button>
    </form>
  )
}
