import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCartoes } from './useCartoes'
import type { DadosCartao } from '../../lib/queries'
import type { Cartao } from '../../types/domain'

interface TelaCartoesProps {
  onVoltar: () => void
}

const CARTAO_VAZIO: DadosCartao = { nome: '', diaFechamento: 1, diaVencimento: 10 }

interface CartaoFormProps {
  valorInicial: DadosCartao
  textoBotao: string
  salvando: boolean
  onSalvar: (dados: DadosCartao) => void
  onCancelar?: () => void
}

function CartaoForm({ valorInicial, textoBotao, salvando, onSalvar, onCancelar }: CartaoFormProps) {
  const [nome, setNome] = useState(valorInicial.nome)
  const [diaFechamento, setDiaFechamento] = useState(String(valorInicial.diaFechamento))
  const [diaVencimento, setDiaVencimento] = useState(String(valorInicial.diaVencimento))
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault()
    setErroLocal(null)

    const fechamento = Number(diaFechamento)
    const vencimento = Number(diaVencimento)

    if (!nome.trim()) {
      setErroLocal('Dê um nome pro cartão.')
      return
    }
    if (!Number.isInteger(fechamento) || fechamento < 1 || fechamento > 31) {
      setErroLocal('Dia de fechamento precisa ser um número entre 1 e 31.')
      return
    }
    if (!Number.isInteger(vencimento) || vencimento < 1 || vencimento > 31) {
      setErroLocal('Dia de vencimento precisa ser um número entre 1 e 31.')
      return
    }

    onSalvar({ nome: nome.trim(), diaFechamento: fechamento, diaVencimento: vencimento })
  }

  return (
    <form className="tela-cartoes__form" onSubmit={handleSubmit}>
      {erroLocal && <p className="tela-login__erro">{erroLocal}</p>}

      <label className="tela-lancamento__campo">
        <span>Nome</span>
        <input type="text" placeholder="ex: Nubank" value={nome} onChange={(evento) => setNome(evento.target.value)} />
      </label>

      <div className="tela-cartoes__dias">
        <label className="tela-lancamento__campo">
          <span>Dia de fechamento</span>
          <input
            type="number"
            min={1}
            max={31}
            value={diaFechamento}
            onChange={(evento) => setDiaFechamento(evento.target.value)}
          />
        </label>
        <label className="tela-lancamento__campo">
          <span>Dia de vencimento</span>
          <input
            type="number"
            min={1}
            max={31}
            value={diaVencimento}
            onChange={(evento) => setDiaVencimento(evento.target.value)}
          />
        </label>
      </div>

      <div className="tela-cartoes__form-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? '…' : textoBotao}
        </button>
        {onCancelar && (
          <button type="button" className="tela-previsao__voltar" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

interface LinhaCartaoProps {
  cartao: Cartao
  onEditar: (id: string, dados: DadosCartao) => Promise<boolean>
  onExcluir: (id: string) => Promise<boolean>
}

function LinhaCartao({ cartao, onEditar, onExcluir }: LinhaCartaoProps) {
  const [editando, setEditando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  if (editando) {
    return (
      <div className="tela-cartoes__linha">
        <CartaoForm
          valorInicial={cartao}
          textoBotao="Salvar"
          salvando={salvando}
          onSalvar={async (dados) => {
            setSalvando(true)
            const sucesso = await onEditar(cartao.id, dados)
            setSalvando(false)
            if (sucesso) setEditando(false)
          }}
          onCancelar={() => setEditando(false)}
        />
      </div>
    )
  }

  return (
    <div className="tela-cartoes__linha">
      <div className="tela-cartoes__info">
        <strong>{cartao.nome}</strong>
        <span className="tela-previsao__origem">
          fecha dia {cartao.diaFechamento}, vence dia {cartao.diaVencimento}
        </span>
      </div>
      <div className="tela-cartoes__acoes">
        <button type="button" onClick={() => setEditando(true)}>
          Editar
        </button>
        {confirmandoExclusao ? (
          <button
            type="button"
            className="tela-cartoes__excluir-confirmar"
            disabled={excluindo}
            onClick={async () => {
              setExcluindo(true)
              const sucesso = await onExcluir(cartao.id)
              setExcluindo(false)
              if (!sucesso) setConfirmandoExclusao(false)
            }}
          >
            {excluindo ? '…' : 'Confirmar exclusão?'}
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmandoExclusao(true)}>
            Excluir
          </button>
        )}
      </div>
    </div>
  )
}

export function TelaCartoes({ onVoltar }: TelaCartoesProps) {
  const { cartoes, carregando, erro, adicionar, editar, excluir } = useCartoes()
  const [mostrandoForm, setMostrandoForm] = useState(false)
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  return (
    <div className="tela-cartoes">
      <button type="button" className="tela-previsao__voltar" onClick={onVoltar}>
        ← Voltar
      </button>

      <h2>Cartões</h2>
      <p className="tela-login__subtitulo">
        O dia de fechamento e de vencimento de cada cartão define em qual mês uma compra no cartão realmente pesa
        no fluxo de caixa (Sobrou, Custo de vida e a projeção de Economias).
      </p>

      {erro && <p className="tela-login__erro">{erro}</p>}

      {carregando ? (
        <p>Carregando…</p>
      ) : (
        <div className="tela-cartoes__lista">
          {cartoes.length === 0 && !mostrandoForm && (
            <p className="tela-categorias__aviso">Nenhum cartão cadastrado ainda.</p>
          )}
          {cartoes.map((cartao) => (
            <LinhaCartao key={cartao.id} cartao={cartao} onEditar={editar} onExcluir={excluir} />
          ))}
        </div>
      )}

      {mostrandoForm ? (
        <CartaoForm
          valorInicial={CARTAO_VAZIO}
          textoBotao="Adicionar cartão"
          salvando={salvandoNovo}
          onSalvar={async (dados) => {
            setSalvandoNovo(true)
            const sucesso = await adicionar(dados)
            setSalvandoNovo(false)
            if (sucesso) setMostrandoForm(false)
          }}
          onCancelar={() => setMostrandoForm(false)}
        />
      ) : (
        <button type="button" className="tela-cartoes__novo" onClick={() => setMostrandoForm(true)}>
          + novo cartão
        </button>
      )}
    </div>
  )
}
