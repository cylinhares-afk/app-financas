import { useState } from 'react'
import { TelaTotais } from '../totais/TelaTotais'
import { TelaCategorias } from '../budget/TelaCategorias'
import { mesAnterior, mesSeguinte, nomeDoMes } from '../../lib/navegacaoMes'
import type { MesAno } from '../../lib/navegacaoMes'

const hoje = new Date()
const ANO_ATUAL = hoje.getFullYear()
const MES_ATUAL = hoje.getMonth() + 1

type SubAba = 'totais' | 'categorias'

interface TelaAnaliseProps {
  // Quando true, a tela já abre na sub-aba Categorias em modo de edição —
  // usado pelo atalho "+ nova categoria" do Registro.
  categoriasEmEdicao?: boolean
  aoCriarCategoria?: (categoriaId: string) => void
  // Só existe (e só faz sentido mostrar um "← Voltar") quando aoCriarCategoria
  // também existe — veio do Registro e precisa de um jeito de voltar pra lá
  // mesmo sem ter criado uma categoria nova.
  onVoltarParaLancamento?: () => void
}

export function TelaAnalise({ categoriasEmEdicao, aoCriarCategoria, onVoltarParaLancamento }: TelaAnaliseProps) {
  const [mesVisualizado, setMesVisualizado] = useState<MesAno>({ ano: ANO_ATUAL, mes: MES_ATUAL })
  const [subAba, setSubAba] = useState<SubAba>(categoriasEmEdicao ? 'categorias' : 'totais')

  const jaEstaNoMesAtual = mesVisualizado.ano === ANO_ATUAL && mesVisualizado.mes === MES_ATUAL

  return (
    <div className="tela-analise">
      {onVoltarParaLancamento && (
        <button type="button" className="tela-previsao__voltar" onClick={onVoltarParaLancamento}>
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

      <div className="tela-analise__abas">
        <button
          type="button"
          className={`tela-analise__aba ${subAba === 'totais' ? 'tela-analise__aba--ativa' : ''}`}
          onClick={() => setSubAba('totais')}
        >
          Totais
        </button>
        <button
          type="button"
          className={`tela-analise__aba ${subAba === 'categorias' ? 'tela-analise__aba--ativa' : ''}`}
          onClick={() => setSubAba('categorias')}
        >
          Categorias
        </button>
      </div>

      {subAba === 'totais' ? (
        <TelaTotais mesVisualizado={mesVisualizado} />
      ) : (
        <TelaCategorias
          mesVisualizado={mesVisualizado}
          iniciarEmEdicao={categoriasEmEdicao}
          aoCriarCategoria={aoCriarCategoria}
        />
      )}
    </div>
  )
}
