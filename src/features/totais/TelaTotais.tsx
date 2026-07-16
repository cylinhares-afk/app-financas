import { useState } from 'react'
import { useTotais } from './useTotais'
import { useEconomias } from '../economias/useEconomias'
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
  // Só é lido quando sobraProjetada < 0 (ver seção Ritmo de economia) — mesmo
  // saldo acumulado (sem filtro de mês) já exibido na tela Economias.
  const {
    saldoTotal: saldoEconomias,
    carregando: carregandoEconomias,
    erro: erroEconomias,
  } = useEconomias()

  if (carregando) return <p className="tela-categorias__aviso">Carregando…</p>

  if (erro) return <p className="tela-categorias__aviso">Erro ao carregar totais: {erro}</p>

  if (!dados) return null

  const performancePositiva = dados.performance >= 0
  const custoDentroDaRenda = dados.custoDeVida <= dados.entradasMes
  const projecaoAcimaDoPrevisto = dados.diferencaProjecao > 0
  const vaiSobrar = dados.sobraProjetada >= 0
  const faltante = -dados.sobraProjetada
  const diferencaReserva = saldoEconomias - faltante
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

      <h3 className="tela-totais__secao">Projeção do mês</h3>

      <p className="tela-totais__frase">
        No ritmo atual, o mês deve fechar em <strong>{formatMoeda(dados.gastoProjetado)}</strong>
      </p>
      <p className="tela-totais__frase-legenda">
        {formatMoeda(Math.abs(dados.diferencaProjecao))} {projecaoAcimaDoPrevisto ? 'acima' : 'abaixo'} do previsto (
        {formatMoeda(dados.totalPrevisto)})
      </p>
      <div className="tela-totais__frase-detalhes">
        <div>
          <span>Previsto/dia</span>
          <strong>{formatMoeda(dados.previstoDia)}</strong>
        </div>
        <div>
          <span>Gasto médio/dia</span>
          <strong>{formatMoeda(dados.gastoMedioDia)}</strong>
        </div>
      </div>

      <h3 className="tela-totais__secao">Ritmo de economia</h3>

      {vaiSobrar ? (
        <p className="tela-totais__frase">
          Nesse ritmo, deve sobrar <strong>{formatMoeda(dados.sobraProjetada)}</strong> até o fim do mês
        </p>
      ) : (
        <>
          <p className="tela-totais__frase">Nesse ritmo não vai sobrar nada esse mês</p>
          <p className="tela-totais__frase">
            Vai faltar: <strong>{formatMoeda(faltante)}</strong>
          </p>
          {carregandoEconomias ? (
            <p className="tela-totais__frase">Economias atuais: carregando…</p>
          ) : erroEconomias ? (
            <p className="tela-totais__frase">Não foi possível carregar o saldo de Economias.</p>
          ) : (
            <>
              <p className="tela-totais__frase">
                Economias atuais: <strong>{formatMoeda(saldoEconomias)}</strong>
              </p>
              <p className="tela-totais__frase">
                {diferencaReserva >= 0 ? (
                  <>
                    A reserva cobre esse mês, com <strong>{formatMoeda(diferencaReserva)}</strong> de sobra
                  </>
                ) : (
                  <>
                    Mesmo usando a reserva, ainda faltariam <strong>{formatMoeda(Math.abs(diferencaReserva))}</strong>
                  </>
                )}
              </p>
            </>
          )}
        </>
      )}

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
