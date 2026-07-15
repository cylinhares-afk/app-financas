import { useRef, useState } from 'react'
import { useLinhasDoMes } from './useLinhasDoMes'
import { formatMoeda } from '../../lib/formatMoeda'
import { formatarDataISO } from '../../lib/dataISO'
import { itensDoDia } from './itensDoDia'
import { TelaDetalheDia } from './TelaDetalheDia'
import { mesAnterior, mesSeguinte, nomeDoMes } from '../../lib/navegacaoMes'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table'
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

/** Sem "R$"/símbolo — só pro resumo compacto do filtro "todas", onde até 4
 * pares ícone+valor precisam caber lado a lado na mesma linha do dia. */
function formatValorCompacto(valor: number): string {
  return formatMoeda(valor).replace(/^R\$\s*/, '')
}

/** Resumo compacto do filtro "todas": os 4 tipos SEMPRE aparecem, um por
 * slot de largura fixa (grid, não flex) — é o que garante que o ícone de
 * cada tipo fique numa coluna reta entre os dias, independente do
 * comprimento do valor ao lado ou de o dia ter ou não movimento naquele
 * tipo. Sem movimento: só o ícone, esmaecido. Com movimento: ícone colorido
 * + valor. O detalhe completo por lançamento já existe em TelaDetalheDia,
 * aberta ao toque no dia. */
function ResumoMovimentosDoDia({ linha }: { linha: LinhaDia }) {
  return (
    <div className="tela-home__indicadores">
      {(Object.keys(TIPOS) as Exclude<FiltroHome, 'todas'>[]).map((tipo) => {
        const { icone, classe, valor } = TIPOS[tipo]
        const valorDoTipo = valor(linha)
        const vazio = valorDoTipo === 0
        return (
          <span
            key={tipo}
            className={`tela-home__indicador tela-home__indicador--${classe} ${vazio ? 'tela-home__indicador--vazio' : ''}`}
          >
            <span className="tela-home__indicador-icone">{icone}</span>
            {!vazio && formatValorCompacto(valorDoTipo)}
          </span>
        )
      })}
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
 *
 * Renderiza o próprio <TableRow> (não um <button> por dentro dele): um
 * elemento não-<td>/<th> filho direto de <tr> é reposicionado pelo parser
 * HTML pra fora da tabela inteira (foster parenting) — por isso os handlers
 * de clique vão direto na linha, com role="button"/tabIndex pra manter a
 * semântica e o foco por teclado que o <button> antigo dava de graça.
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
    <TableRow
      role="button"
      tabIndex={0}
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
    </TableRow>
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
        <Table>
          <TableHeader>
            <TableRow>
              {/* sr-only vai no texto, não na própria TableHead: um <th> com
                  position:absolute (o que sr-only faz) sai do fluxo da
                  tabela, e table-layout:fixed usa a 1ª linha (o cabeçalho)
                  pra definir a largura de cada coluna — sem essas células
                  participando do layout normal, as colunas do corpo
                  ficavam com largura errada. */}
              <TableHead className="tela-home__celula tela-home__celula-dia">
                <span className="sr-only">Dia</span>
              </TableHead>
              <TableHead className="tela-home__celula">
                <span className="sr-only">Movimentação</span>
              </TableHead>
              <TableHead className="tela-home__celula tela-home__celula--saldo">
                <span className="sr-only">Saldo acumulado</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
                  <TableCell className={`tela-home__celula tela-home__celula-dia tela-home__celula-dia--${linha.status}`}>
                    <span className="tela-home__dia">{linha.dia}</span>
                  </TableCell>

                  <TableCell className="tela-home__celula">
                    <div className="tela-home__movimentos">
                      {filtro === 'todas' ? (
                        <ResumoMovimentosDoDia linha={linha} />
                      ) : (
                        <ValorTipo tipo={filtro} linha={linha} />
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="tela-home__celula tela-home__celula--saldo">
                    <span className="tela-home__saldo">{formatMoeda(linha.saldoAcumulado)}</span>
                  </TableCell>
                </LinhaDiaClicavel>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
