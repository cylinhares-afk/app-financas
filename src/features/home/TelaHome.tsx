import { useRef, useState } from 'react'
import { useLinhasDoMes } from './useLinhasDoMes'
import { formatMoeda } from '../../lib/formatMoeda'
import { formatarDataISO } from '../../lib/dataISO'
import { itensDoDia } from './itensDoDia'
import { TelaDetalheDia } from './TelaDetalheDia'
import { mesAnterior, mesSeguinte, nomeDoMes } from '../../lib/navegacaoMes'
import type { FiltroHome, LinhaDia } from './linhasDoMes'

export type { FiltroHome }

interface TelaHomeProps {
  onDiaClicado: (dataISO: string, filtro: FiltroHome) => void
}

const TIPOS: Record<
  Exclude<FiltroHome, 'todas'>,
  { rotulo: string; icone: string; classe: string; valor: (linha: LinhaDia) => number }
> = {
  entradas: { rotulo: 'entradas', icone: '↙', classe: 'entrada', valor: (l) => l.totalEntradas },
  saidas: { rotulo: 'saídas', icone: '↗', classe: 'saida', valor: (l) => l.totalSaidas },
  diarios: { rotulo: 'diários', icone: 'D', classe: 'diario', valor: (l) => l.diario },
  cartao: { rotulo: 'cartão', icone: 'C', classe: 'cartao', valor: (l) => l.totalCartao },
}

const DURACAO_SEGURAR_MS = 800

const hoje = new Date()
const ANO_ATUAL = hoje.getFullYear()
const MES_ATUAL = hoje.getMonth() + 1
const DIA_ATUAL = hoje.getDate()

function ValorTipo({ tipo, linha }: { tipo: Exclude<FiltroHome, 'todas'>; linha: LinhaDia }) {
  const { icone, classe, valor } = TIPOS[tipo]
  const valorDoTipo = valor(linha)
  const vazio = valorDoTipo === 0

  return (
    <div className={`tela-home__movimento tela-home__movimento--${classe} ${vazio ? 'tela-home__movimento--vazio' : ''}`}>
      <span className="tela-home__icone">{icone}</span>
      <span>{formatMoeda(valorDoTipo)}</span>
      {tipo === 'cartao' &&
        linha.parcelas.map((parcela, indice) => (
          <span key={indice} className="tela-home__selo-parcela">
            {parcela.numeroParcela}/{parcela.totalParcelas}
          </span>
        ))}
    </div>
  )
}

interface LinhaDiaClicavelProps {
  linha: LinhaDia
  ehHoje: boolean
  temItens: boolean
  onTapRapido: () => void
  onSegurar: () => void
  children: React.ReactNode
}

/**
 * Toque rápido e "segurar" (~1s) fazem coisas diferentes (ver TelaHome), então
 * não dá pra usar só onClick — Pointer Events cobrem mouse e toque com a
 * mesma API. onClick fica de fora de propósito: o navegador já dispara um
 * "click" nativo depois do pointerup, então tratar os dois duplicaria a ação.
 */
function LinhaDiaClicavel({ linha, ehHoje, temItens, onTapRapido, onSegurar, children }: LinhaDiaClicavelProps) {
  const timeoutRef = useRef<number | null>(null)
  const disparouSegurarRef = useRef(false)

  function limparTimeout() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  function handlePointerDown() {
    disparouSegurarRef.current = false
    timeoutRef.current = window.setTimeout(() => {
      disparouSegurarRef.current = true
      onSegurar()
    }, DURACAO_SEGURAR_MS)
  }

  function handlePointerUp() {
    limparTimeout()
    if (!disparouSegurarRef.current) onTapRapido()
  }

  function handleKeyDown(evento: React.KeyboardEvent) {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault()
      onTapRapido()
    }
  }

  return (
    <button
      type="button"
      className={`tela-home__linha ${ehHoje ? 'tela-home__linha--hoje' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={limparTimeout}
      onPointerCancel={limparTimeout}
      onContextMenu={(evento) => evento.preventDefault()}
      onKeyDown={handleKeyDown}
      aria-label={temItens ? `Dia ${linha.dia}, ver lançamentos` : `Dia ${linha.dia}, novo lançamento`}
    >
      {children}
    </button>
  )
}

export function TelaHome({ onDiaClicado }: TelaHomeProps) {
  const [filtro, setFiltro] = useState<FiltroHome>('saidas')
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null)
  const [mesVisualizado, setMesVisualizado] = useState({ ano: ANO_ATUAL, mes: MES_ATUAL })

  const { linhas, categorias, comprasParceladas, carregando, erro, recarregar } = useLinhasDoMes(
    mesVisualizado.ano,
    mesVisualizado.mes,
  )

  function irParaMesAnterior() {
    setDiaSelecionado(null)
    setMesVisualizado(mesAnterior(mesVisualizado))
  }

  function irParaMesSeguinte() {
    setDiaSelecionado(null)
    setMesVisualizado(mesSeguinte(mesVisualizado))
  }

  function irParaHoje() {
    setDiaSelecionado(null)
    setMesVisualizado({ ano: ANO_ATUAL, mes: MES_ATUAL })
  }

  const jaEstaNoMesAtual = mesVisualizado.ano === ANO_ATUAL && mesVisualizado.mes === MES_ATUAL

  if (carregando) return <p className="tela-categorias__aviso">Carregando…</p>

  if (erro) return <p className="tela-categorias__aviso">Erro ao carregar a Home: {erro}</p>

  const linhaSelecionada = linhas.find((linha) => linha.dia === diaSelecionado)

  if (diaSelecionado !== null && linhaSelecionada) {
    const itens = itensDoDia(linhaSelecionada, filtro, categorias, comprasParceladas)
    return (
      <TelaDetalheDia
        dia={diaSelecionado}
        itens={itens}
        categorias={categorias}
        onVoltar={() => setDiaSelecionado(null)}
        onNovoLancamento={() => {
          onDiaClicado(formatarDataISO(mesVisualizado.ano, mesVisualizado.mes, diaSelecionado), filtro)
          setDiaSelecionado(null)
        }}
        onAlterado={recarregar}
      />
    )
  }

  return (
    <div className="tela-home">
      <div className="tela-home__cabecalho">
        <div className="tela-home__navegacao-mes">
          <button type="button" className="tela-home__seta" onClick={irParaMesAnterior} aria-label="Mês anterior">
            ‹
          </button>
          <span>{nomeDoMes(mesVisualizado.ano, mesVisualizado.mes)}</span>
          <button type="button" className="tela-home__seta" onClick={irParaMesSeguinte} aria-label="Próximo mês">
            ›
          </button>
        </div>
        <button
          type="button"
          className={`tela-home__hoje ${jaEstaNoMesAtual ? 'tela-home__hoje--atual' : ''}`}
          onClick={irParaHoje}
        >
          Hoje
        </button>
      </div>

      <select
        className="tela-home__filtro"
        value={filtro}
        onChange={(evento) => setFiltro(evento.target.value as FiltroHome)}
      >
        <option value="todas">todas</option>
        <option value="entradas">entradas</option>
        <option value="saidas">saídas</option>
        <option value="diarios">diários</option>
        <option value="cartao">cartão</option>
      </select>

      <div className="tela-home__lista">
        {linhas.map((linha) => {
          const temItens = itensDoDia(linha, filtro, categorias, comprasParceladas).length > 0
          const dataISOdoDia = formatarDataISO(mesVisualizado.ano, mesVisualizado.mes, linha.dia)
          const ehHoje =
            linha.dia === DIA_ATUAL && mesVisualizado.ano === ANO_ATUAL && mesVisualizado.mes === MES_ATUAL

          return (
            <LinhaDiaClicavel
              key={linha.dia}
              linha={linha}
              ehHoje={ehHoje}
              temItens={temItens}
              onTapRapido={() => (temItens ? setDiaSelecionado(linha.dia) : onDiaClicado(dataISOdoDia, filtro))}
              onSegurar={() => onDiaClicado(dataISOdoDia, filtro)}
            >
              <span className="tela-home__dia">{linha.dia}</span>

              <div className="tela-home__movimentos">
                {filtro === 'todas' ? (
                  (Object.keys(TIPOS) as Exclude<FiltroHome, 'todas'>[]).map((tipo) => (
                    <ValorTipo key={tipo} tipo={tipo} linha={linha} />
                  ))
                ) : (
                  <ValorTipo tipo={filtro} linha={linha} />
                )}
              </div>

              <span className={`tela-home__saldo tela-home__saldo--${linha.status}`}>
                {formatMoeda(linha.saldoAcumulado)}
              </span>
            </LinhaDiaClicavel>
          )
        })}
      </div>
    </div>
  )
}
