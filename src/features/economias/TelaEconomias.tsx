import { useMemo, useState } from 'react'
import { useEconomias } from './useEconomias'
import { useProjecaoReserva } from './useProjecaoReserva'
import { formatMoeda } from '../../lib/formatMoeda'
import { mesSeguinte, nomeDoMes } from '../../lib/navegacaoMes'
import type { OrigemMovimentoEconomia } from '../../types/domain'

const ORIGEM_ROTULO: Record<OrigemMovimentoEconomia, string> = {
  fechamento_mes: 'Fechamento de',
  manual: 'Ajuste manual —',
}

const hoje = new Date()
const ANO_ATUAL = hoje.getFullYear()
const MES_ATUAL = hoje.getMonth() + 1
const PROXIMO_MES = mesSeguinte({ ano: ANO_ATUAL, mes: MES_ATUAL })
const MES_MINIMO_INPUT = `${PROXIMO_MES.ano}-${String(PROXIMO_MES.mes).padStart(2, '0')}`

function paraMesInputValue(valor: string): { ano: number; mes: number } | null {
  if (!valor) return null
  const [anoTexto, mesTexto] = valor.split('-')
  return { ano: Number(anoTexto), mes: Number(mesTexto) }
}

export function TelaEconomias() {
  const { saldoInicial, movimentos, saldoTotal, carregando, erro, salvarSaldoInicial } = useEconomias()
  const [editando, setEditando] = useState(false)
  const [valorEdicao, setValorEdicao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [mesAlvoInput, setMesAlvoInput] = useState('')
  const mesAlvo = useMemo(() => paraMesInputValue(mesAlvoInput), [mesAlvoInput])
  const mesAlvoEhFuturo = Boolean(
    mesAlvo && (mesAlvo.ano > ANO_ATUAL || (mesAlvo.ano === ANO_ATUAL && mesAlvo.mes > MES_ATUAL)),
  )
  const {
    projecao,
    carregando: carregandoProjecao,
    erro: erroProjecao,
  } = useProjecaoReserva(
    mesAlvoEhFuturo ? (mesAlvo?.ano ?? null) : null,
    mesAlvoEhFuturo ? (mesAlvo?.mes ?? null) : null,
    saldoTotal,
  )

  function iniciarEdicao() {
    setValorEdicao(String(saldoInicial))
    setEditando(true)
  }

  async function handleSalvar() {
    const valor = Number(valorEdicao.replace(',', '.'))
    if (Number.isNaN(valor)) return

    setSalvando(true)
    const sucesso = await salvarSaldoInicial(valor)
    setSalvando(false)

    if (sucesso) setEditando(false)
  }

  if (carregando) return <p className="tela-categorias__aviso">Carregando…</p>

  if (erro) return <p className="tela-categorias__aviso">Erro ao carregar Economias: {erro}</p>

  const saldoPositivo = saldoTotal >= 0

  return (
    <div className="tela-economias">
      <h2>Economias</h2>
      <p className="tela-economias__legenda">Reserva de emergência</p>

      <div className="tela-economias__saldo-card">
        <span className="tela-economias__saldo-rotulo">Saldo acumulado</span>
        <strong
          className={`tela-economias__saldo-valor ${
            saldoPositivo ? 'tela-totais__valor--positivo' : 'tela-totais__valor--negativo'
          }`}
        >
          {formatMoeda(saldoTotal)}
        </strong>
      </div>

      <div className="tela-economias__saldo-inicial">
        <span>Saldo inicial cadastrado manualmente</span>
        {editando ? (
          <div className="tela-economias__edicao">
            <input
              type="number"
              inputMode="decimal"
              step={0.01}
              autoFocus
              value={valorEdicao}
              onChange={(evento) => setValorEdicao(evento.target.value)}
            />
            <button type="button" onClick={handleSalvar} disabled={salvando}>
              {salvando ? '…' : 'Salvar'}
            </button>
            <button type="button" onClick={() => setEditando(false)} disabled={salvando}>
              Cancelar
            </button>
          </div>
        ) : (
          <div className="tela-economias__edicao">
            <strong>{formatMoeda(saldoInicial)}</strong>
            <button type="button" onClick={iniciarEdicao}>
              Editar
            </button>
          </div>
        )}
      </div>

      <h3 className="tela-totais__secao">Histórico mês a mês</h3>

      {movimentos.length === 0 ? (
        <p className="tela-categorias__aviso">Nenhum aporte ou retirada ainda.</p>
      ) : (
        <div className="tela-totais__movimentacoes">
          {movimentos.map((movimento) => (
            <div key={movimento.id} className="tela-totais__movimentacao">
              <span className="tela-totais__mov-rotulo">
                {ORIGEM_ROTULO[movimento.origem]} {nomeDoMes(movimento.ano, movimento.mes)}
              </span>
              <strong
                className={
                  movimento.valor >= 0 ? 'tela-totais__valor--positivo' : 'tela-totais__valor--negativo'
                }
              >
                {formatMoeda(movimento.valor)}
              </strong>
            </div>
          ))}
        </div>
      )}

      <h3 className="tela-totais__secao">Projeção de reserva futura</h3>
      <p className="tela-economias__aviso-projecao">
        Projeção estimada: usa o previsto de cada categoria (não o gasto real, que ainda não existe pros meses
        futuros) e as entradas já lançadas ou recorrentes configuradas. Assume que todo fechamento de mês vai ser
        confirmado — pode mudar conforme os meses forem se realizando de fato.
      </p>

      <div className="tela-economias__mes-alvo">
        <label htmlFor="mes-alvo-projecao">Projetar até</label>
        <input
          id="mes-alvo-projecao"
          type="month"
          min={MES_MINIMO_INPUT}
          value={mesAlvoInput}
          onChange={(evento) => setMesAlvoInput(evento.target.value)}
        />
      </div>

      {mesAlvoInput && !mesAlvoEhFuturo && (
        <p className="tela-categorias__aviso">Escolha um mês depois do atual pra projetar.</p>
      )}

      {mesAlvoEhFuturo && carregandoProjecao && <p className="tela-categorias__aviso">Calculando…</p>}

      {mesAlvoEhFuturo && erroProjecao && (
        <p className="tela-categorias__aviso">Erro ao calcular a projeção: {erroProjecao}</p>
      )}

      {mesAlvoEhFuturo && projecao && mesAlvo && (
        <>
          <div className="tela-economias__saldo-card">
            <span className="tela-economias__saldo-rotulo">
              Projeção pra {nomeDoMes(mesAlvo.ano, mesAlvo.mes)}
            </span>
            <strong
              className={`tela-economias__saldo-valor ${
                projecao[projecao.length - 1].saldoReservaProjetado >= 0
                  ? 'tela-totais__valor--positivo'
                  : 'tela-totais__valor--negativo'
              }`}
            >
              {formatMoeda(projecao[projecao.length - 1].saldoReservaProjetado)}
            </strong>
          </div>

          <div className="tela-totais__movimentacoes">
            {projecao.map((mesProjetado) => (
              <div key={`${mesProjetado.ano}-${mesProjetado.mes}`} className="tela-economias__projecao-linha">
                <span className="tela-totais__mov-rotulo">{nomeDoMes(mesProjetado.ano, mesProjetado.mes)}</span>
                <span
                  className={
                    mesProjetado.sobraPrevista >= 0
                      ? 'tela-totais__valor--positivo'
                      : 'tela-totais__valor--negativo'
                  }
                >
                  {formatMoeda(mesProjetado.sobraPrevista)}
                </span>
                <strong>{formatMoeda(mesProjetado.saldoReservaProjetado)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
