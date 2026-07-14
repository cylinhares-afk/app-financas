import { useState } from 'react'
import { useTotais } from './useTotais'
import { formatMoeda } from '../../lib/formatMoeda'
import { mesAnterior, mesSeguinte, nomeDoMes, statusMesVisualizado } from '../../lib/navegacaoMes'

const hoje = new Date()
const ANO_ATUAL = hoje.getFullYear()
const MES_ATUAL = hoje.getMonth() + 1

// "Performance" muda de nome conforme o mês navegado: em curso, já fechado
// ou ainda por vir — a fórmula (entradas − saídas dinheiro − cartão do mês
// anterior) é sempre a mesma, só a leitura temporal muda (ver
// statusMesVisualizado).
const ROTULO_SOBRA: Record<ReturnType<typeof statusMesVisualizado>, string> = {
  atual: 'Sobrou até hoje',
  passado: 'Sobrou no mês',
  futuro: 'Previsão de sobra',
}

export function TelaTotais() {
  const [mesVisualizado, setMesVisualizado] = useState({ ano: ANO_ATUAL, mes: MES_ATUAL })
  const { dados, carregando, erro } = useTotais(mesVisualizado.ano, mesVisualizado.mes)

  if (carregando) return <p className="tela-categorias__aviso">Carregando…</p>

  if (erro) return <p className="tela-categorias__aviso">Erro ao carregar totais: {erro}</p>

  if (!dados) return null

  const performancePositiva = dados.performance >= 0
  const custoDentroDaRenda = dados.custoDeVida <= dados.entradasMes
  const jaEstaNoMesAtual = mesVisualizado.ano === ANO_ATUAL && mesVisualizado.mes === MES_ATUAL
  const rotuloSobra = ROTULO_SOBRA[statusMesVisualizado(mesVisualizado, { ano: ANO_ATUAL, mes: MES_ATUAL })]

  return (
    <div className="tela-totais">
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

      <h3 className="tela-totais__secao">Cálculos do mês</h3>

      <div className="tela-totais__linha">
        <div className="tela-totais__rotulos">
          <span className="tela-totais__rotulo">{rotuloSobra}</span>
          <span className="tela-totais__legenda">
            {performancePositiva ? 'sobrou dinheiro' : 'faltou dinheiro'}
          </span>
        </div>
        <strong
          className={
            performancePositiva ? 'tela-totais__valor--positivo' : 'tela-totais__valor--negativo'
          }
        >
          {formatMoeda(dados.performance)}
        </strong>
      </div>

      <div className="tela-totais__linha">
        <div className="tela-totais__rotulos">
          <span className="tela-totais__rotulo">Custo de vida</span>
          <span className="tela-totais__legenda">
            {custoDentroDaRenda ? 'dentro da renda' : 'acima da renda'}
          </span>
        </div>
        <strong>{formatMoeda(dados.custoDeVida)}</strong>
      </div>

      <h3 className="tela-totais__secao">Movimentações do mês</h3>

      <div className="tela-totais__movimentacoes">
        <div className="tela-totais__movimentacao">
          <span className="tela-totais__icone tela-totais__icone--entrada">↙</span>
          <span className="tela-totais__mov-rotulo">Entradas</span>
          <strong>{formatMoeda(dados.entradasMes)}</strong>
        </div>
        <div className="tela-totais__movimentacao">
          <span className="tela-totais__icone tela-totais__icone--saida">↗</span>
          <span className="tela-totais__mov-rotulo">Saídas</span>
          <strong>{formatMoeda(dados.saidasMes)}</strong>
        </div>
        <div className="tela-totais__movimentacao">
          <span className="tela-totais__icone tela-totais__icone--diario">D</span>
          <span className="tela-totais__mov-rotulo">Diário</span>
          <strong>{formatMoeda(dados.diarioHoje)}</strong>
        </div>
        <div className="tela-totais__movimentacao">
          <span className="tela-totais__icone tela-totais__icone--cartao">C</span>
          <span className="tela-totais__mov-rotulo">Cartão</span>
          <strong>{formatMoeda(dados.cartaoMes)}</strong>
        </div>
      </div>
    </div>
  )
}
