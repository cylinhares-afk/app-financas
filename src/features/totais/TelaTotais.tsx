import { useState } from 'react'
import { useTotais } from './useTotais'
import { formatMoeda } from '../../lib/formatMoeda'
import { statusMesVisualizado } from '../../lib/navegacaoMes'
import type { MesAno } from '../../lib/navegacaoMes'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'

const hoje = new Date()
const ANO_ATUAL = hoje.getFullYear()
const MES_ATUAL = hoje.getMonth() + 1

// "Performance" muda de nome conforme o mês navegado: em curso, já fechado
// ou ainda por vir — a fórmula (entradas − saídas pix − cartão do mês
// anterior) é sempre a mesma, só a leitura temporal muda (ver
// statusMesVisualizado).
const ROTULO_SOBRA: Record<ReturnType<typeof statusMesVisualizado>, string> = {
  atual: 'Sobrou até hoje',
  passado: 'Sobrou no mês',
  futuro: 'Previsão de sobra',
}

const EXPLICACAO_SOBRA =
  'É quanto dinheiro sobrou (ou faltou) de verdade neste mês. Conta o que entrou, menos o que você gastou em dinheiro/PIX, menos a fatura do cartão que venceu agora (referente a compras de meses passados — compras no cartão feitas neste mês só entram na conta no mês em que a fatura vencer).'
const EXPLICACAO_CUSTO_DE_VIDA =
  'É quanto você gastou de verdade neste mês, sem comparar com o que entrou. Conta o que saiu em dinheiro/PIX, mais a fatura do cartão que venceu agora.'
const EXPLICACAO_DIARIO =
  'Compara o que você planejou gastar por dia em cada categoria com o quanto realmente gastou, somando os dias já passados do mês. Não é dinheiro que saiu de verdade — é só um termômetro pra saber se você está no ritmo do que planejou, ou já passou dele.'

/** Ícone "ⓘ" ao lado do rótulo de cada linha — abre a explicação completa
 * ao tocar (clique/tap, via Popover) ou passar o mouse (hover, desktop). */
function InfoLinha({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false)

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="tela-totais__info"
          aria-label="Mais informações"
          onMouseEnter={() => setAberto(true)}
          onMouseLeave={() => setAberto(false)}
        >
          ⓘ
        </button>
      </PopoverTrigger>
      <PopoverContent className="tela-totais__info-conteudo">{texto}</PopoverContent>
    </Popover>
  )
}

interface TelaTotaisProps {
  mesVisualizado: MesAno
}

export function TelaTotais({ mesVisualizado }: TelaTotaisProps) {
  const { dados, carregando, erro } = useTotais(mesVisualizado.ano, mesVisualizado.mes)

  if (carregando) return <p className="tela-categorias__aviso">Carregando…</p>

  if (erro) return <p className="tela-categorias__aviso">Erro ao carregar totais: {erro}</p>

  if (!dados) return null

  const performancePositiva = dados.performance >= 0
  const custoDentroDaRenda = dados.custoDeVida <= dados.entradasMes
  const diarioAbaixoDoPlanejado = dados.diarioHoje >= 0
  const rotuloSobra = ROTULO_SOBRA[statusMesVisualizado(mesVisualizado, { ano: ANO_ATUAL, mes: MES_ATUAL })]

  return (
    <div className="tela-totais">
      <h3 className="tela-totais__secao">Cálculos do mês</h3>

      <div className="tela-totais__linha">
        <div className="tela-totais__rotulos">
          <span className="tela-totais__rotulo">
            {rotuloSobra}
            <InfoLinha texto={EXPLICACAO_SOBRA} />
          </span>
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
          <span className="tela-totais__rotulo">
            Custo de vida
            <InfoLinha texto={EXPLICACAO_CUSTO_DE_VIDA} />
          </span>
          <span className="tela-totais__legenda">
            {custoDentroDaRenda ? 'dentro da renda' : 'acima da renda'}
          </span>
        </div>
        <strong>{formatMoeda(dados.custoDeVida)}</strong>
      </div>

      <h3 className="tela-totais__secao">Ritmo diário</h3>

      <div className="tela-totais__linha">
        <div className="tela-totais__rotulos">
          <span className="tela-totais__rotulo">
            Diário
            <InfoLinha texto={EXPLICACAO_DIARIO} />
          </span>
          <span className="tela-totais__legenda">
            {diarioAbaixoDoPlanejado ? 'abaixo do planejado' : 'acima do planejado'}
          </span>
        </div>
        <strong>{formatMoeda(dados.diarioHoje)}</strong>
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
          <span className="tela-totais__icone tela-totais__icone--cartao">C</span>
          <span className="tela-totais__mov-rotulo">Cartão</span>
          <strong>{formatMoeda(dados.cartaoMes)}</strong>
        </div>
      </div>
    </div>
  )
}
