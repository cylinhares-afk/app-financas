import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatMoeda, semNegativo } from '../../lib/formatMoeda'
import {
  atualizarEntrada,
  atualizarGasto,
  cancelarRecorrenciaAPartirDe,
  excluirCompraParceladaCompleta,
  excluirEntrada,
  excluirGasto,
} from '../../lib/queries'
import type { ItemMovimento } from './itensDoDia'
import type { Categoria } from '../../types/domain'

interface TelaDetalheDiaProps {
  dia: number
  itens: ItemMovimento[]
  categorias: Categoria[]
  onVoltar: () => void
  onNovoLancamento: () => void
  onAlterado: () => Promise<void>
}

interface DadosEdicaoItem {
  valor: number
  data: string
  descricao?: string
  categoriaId?: string
}

interface FormularioEdicaoItemProps {
  item: ItemMovimento
  categorias: Categoria[]
  salvando: boolean
  onSalvar: (dados: DadosEdicaoItem) => void
  onCancelar: () => void
}

function FormularioEdicaoItem({ item, categorias, salvando, onSalvar, onCancelar }: FormularioEdicaoItemProps) {
  const [valor, setValor] = useState(String(item.valor))
  const [data, setData] = useState(item.data)
  const [descricao, setDescricao] = useState(item.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState(item.categoriaId ?? '')
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault()
    setErroLocal(null)

    const valorNumerico = Number(valor.replace(',', '.'))
    if (!valorNumerico || valorNumerico <= 0) {
      setErroLocal('Preencha um valor válido.')
      return
    }
    if (item.tipo === 'saida' && !categoriaId) {
      setErroLocal('Escolha uma categoria.')
      return
    }

    onSalvar({
      valor: valorNumerico,
      data,
      descricao: descricao.trim() || undefined,
      categoriaId: item.tipo === 'saida' ? categoriaId : undefined,
    })
  }

  return (
    <form className="tela-cartoes__form" onSubmit={handleSubmit}>
      {erroLocal && <p className="tela-login__erro">{erroLocal}</p>}

      <label className="tela-lancamento__campo">
        <span>Valor</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          value={valor}
          onChange={(evento) => setValor(semNegativo(evento.target.value))}
        />
      </label>

      {item.tipo === 'saida' && (
        <label className="tela-lancamento__campo">
          <span>Categoria</span>
          <select value={categoriaId} onChange={(evento) => setCategoriaId(evento.target.value)}>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="tela-lancamento__campo">
        <span>{item.tipo === 'entrada' ? 'Origem' : 'Descrição (opcional)'}</span>
        <input type="text" value={descricao} onChange={(evento) => setDescricao(evento.target.value)} />
      </label>

      <label className="tela-lancamento__campo">
        <span>Data</span>
        <input type="date" value={data} onChange={(evento) => setData(evento.target.value)} />
      </label>

      <div className="tela-cartoes__form-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? '…' : 'Salvar'}
        </button>
        <button type="button" className="tela-previsao__voltar" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

type EstadoExclusao = 'nenhum' | 'confirmando' | 'escolhendo'

interface ItemLancamentoProps {
  item: ItemMovimento
  categorias: Categoria[]
  onAlterado: () => Promise<void>
}

function ItemLancamento({ item, categorias, onAlterado }: ItemLancamentoProps) {
  const [editando, setEditando] = useState(false)
  const [estadoExclusao, setEstadoExclusao] = useState<EstadoExclusao>('nenhum')
  const [salvando, setSalvando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvarEdicao(dados: DadosEdicaoItem) {
    setSalvando(true)
    setErro(null)

    const { erro: erroSalvar } =
      item.tipo === 'entrada'
        ? await atualizarEntrada(item.id, { valor: dados.valor, data: dados.data, descricao: dados.descricao })
        : await atualizarGasto(item.id, {
            categoriaId: dados.categoriaId as string,
            valor: dados.valor,
            data: dados.data,
            descricao: dados.descricao,
          })

    setSalvando(false)
    if (erroSalvar) {
      setErro(erroSalvar)
      return
    }

    setEditando(false)
    await onAlterado()
  }

  async function excluirEsteLancamento() {
    setProcessando(true)
    setErro(null)
    const { erro: erroExcluir } = item.tipo === 'entrada' ? await excluirEntrada(item.id) : await excluirGasto(item.id)
    setProcessando(false)

    if (erroExcluir) {
      setErro(erroExcluir)
      setEstadoExclusao('nenhum')
      return
    }
    await onAlterado()
  }

  async function excluirCompraParceladaInteira() {
    if (!item.compraParceladaId) return
    setProcessando(true)
    setErro(null)
    const { erro: erroExcluir } = await excluirCompraParceladaCompleta(item.compraParceladaId)
    setProcessando(false)

    if (erroExcluir) {
      setErro(erroExcluir)
      setEstadoExclusao('nenhum')
      return
    }
    await onAlterado()
  }

  async function excluirRecorrenciaInteira() {
    if (!item.recorrenciaId || item.numeroOcorrencia === undefined) return
    setProcessando(true)
    setErro(null)

    const { erro: erroCancelar } = await cancelarRecorrenciaAPartirDe(item.recorrenciaId, item.numeroOcorrencia)
    if (erroCancelar) {
      setProcessando(false)
      setErro(erroCancelar)
      setEstadoExclusao('nenhum')
      return
    }

    const { erro: erroExcluir } = item.tipo === 'entrada' ? await excluirEntrada(item.id) : await excluirGasto(item.id)
    setProcessando(false)
    if (erroExcluir) {
      setErro(erroExcluir)
      setEstadoExclusao('nenhum')
      return
    }
    await onAlterado()
  }

  if (editando) {
    return (
      <div className="tela-detalhe-dia__item">
        <FormularioEdicaoItem
          item={item}
          categorias={categorias}
          salvando={salvando}
          onSalvar={salvarEdicao}
          onCancelar={() => setEditando(false)}
        />
      </div>
    )
  }

  return (
    <div className="tela-detalhe-dia__item">
      <div className="tela-detalhe-dia__item-principal">
        <span
          className={`tela-totais__icone ${
            item.tipo === 'entrada'
              ? 'tela-totais__icone--entrada'
              : item.meioPagamento === 'cartao'
                ? 'tela-totais__icone--cartao'
                : 'tela-totais__icone--saida'
          }`}
        >
          {item.tipo === 'entrada' ? '↙' : item.meioPagamento === 'cartao' ? 'C' : '↗'}
        </span>

        <div className="tela-detalhe-dia__info">
          <span>{item.rotulo}</span>
          {item.meioPagamento && (
            <span className="tela-detalhe-dia__meio">
              {item.meioPagamento === 'cartao' ? 'Cartão' : 'Dinheiro'}
            </span>
          )}
          {item.descricao && <span className="tela-detalhe-dia__descricao">{item.descricao}</span>}
        </div>

        <div className="tela-detalhe-dia__valor">
          <strong>{formatMoeda(item.valor)}</strong>
          {item.parcela && (
            <span className="tela-home__selo-parcela">
              {item.parcela.numero}/{item.parcela.total}
            </span>
          )}
        </div>
      </div>

      {erro && <p className="tela-login__erro">{erro}</p>}

      <div className="tela-cartoes__acoes">
        {estadoExclusao === 'nenhum' && (
          <>
            <button type="button" onClick={() => setEditando(true)}>
              Editar
            </button>
            <button
              type="button"
              onClick={() => setEstadoExclusao(item.compraParceladaId || item.recorrenciaId ? 'escolhendo' : 'confirmando')}
            >
              Excluir
            </button>
          </>
        )}

        {estadoExclusao === 'confirmando' && (
          <>
            <button
              type="button"
              className="tela-cartoes__excluir-confirmar"
              disabled={processando}
              onClick={excluirEsteLancamento}
            >
              {processando ? '…' : 'Confirmar exclusão?'}
            </button>
            <button type="button" onClick={() => setEstadoExclusao('nenhum')} disabled={processando}>
              Cancelar
            </button>
          </>
        )}

        {estadoExclusao === 'escolhendo' && item.compraParceladaId && (
          <>
            <button type="button" disabled={processando} onClick={excluirEsteLancamento}>
              {processando ? '…' : 'Só esta parcela'}
            </button>
            <button
              type="button"
              className="tela-cartoes__excluir-confirmar"
              disabled={processando}
              onClick={excluirCompraParceladaInteira}
            >
              {processando ? '…' : 'Toda a compra parcelada'}
            </button>
            <button type="button" onClick={() => setEstadoExclusao('nenhum')} disabled={processando}>
              Cancelar
            </button>
          </>
        )}

        {estadoExclusao === 'escolhendo' && item.recorrenciaId && (
          <>
            <button type="button" disabled={processando} onClick={excluirEsteLancamento}>
              {processando ? '…' : 'Só esta ocorrência'}
            </button>
            <button
              type="button"
              className="tela-cartoes__excluir-confirmar"
              disabled={processando}
              onClick={excluirRecorrenciaInteira}
            >
              {processando ? '…' : 'Toda a recorrência'}
            </button>
            <button type="button" onClick={() => setEstadoExclusao('nenhum')} disabled={processando}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function TelaDetalheDia({
  dia,
  itens,
  categorias,
  onVoltar,
  onNovoLancamento,
  onAlterado,
}: TelaDetalheDiaProps) {
  return (
    <div className="tela-detalhe-dia">
      <button type="button" className="tela-previsao__voltar" onClick={onVoltar}>
        ← Voltar
      </button>

      <h2>Dia {dia}</h2>

      {itens.length === 0 ? (
        <p className="tela-categorias__aviso">Nenhum lançamento desse tipo nesse dia.</p>
      ) : (
        <div className="tela-detalhe-dia__lista">
          {itens.map((item) => (
            <ItemLancamento key={item.id} item={item} categorias={categorias} onAlterado={onAlterado} />
          ))}
        </div>
      )}

      <button type="button" className="tela-lancamento__enviar" onClick={onNovoLancamento}>
        + Novo lançamento nesse dia
      </button>
    </div>
  )
}
