import type { Categoria } from '../../types/domain'
import type { OrcamentoCategoriaResultado } from './calculations'
import { getStatusOrcamentoCategoria } from './status'
import { formatMoeda } from '../../lib/formatMoeda'

interface CategoriaCardProps {
  categoria: Categoria
  orcamento: OrcamentoCategoriaResultado
  diasNoMes: number
}

export function CategoriaCard({ categoria, orcamento, diasNoMes }: CategoriaCardProps) {
  const status = getStatusOrcamentoCategoria(orcamento, diasNoMes)

  return (
    <article className={`categoria-card categoria-card--${status}`}>
      <header className="categoria-card__header">
        {categoria.cor && (
          <span className="categoria-card__swatch" style={{ background: categoria.cor }} />
        )}
        <h3>{categoria.nome}</h3>
      </header>

      <dl className="categoria-card__linhas">
        <div>
          <dt>Previsto</dt>
          <dd>{formatMoeda(orcamento.previsto)}</dd>
        </div>
        <div>
          <dt>Gasto até hoje</dt>
          <dd>{formatMoeda(orcamento.gastoNoMes)}</dd>
        </div>
        <div>
          <dt>Para gastar</dt>
          <dd>
            {formatMoeda(orcamento.restante)}{' '}
            <span className="categoria-card__detalhe">
              ({orcamento.diasRestantes} {orcamento.diasRestantes === 1 ? 'dia restante' : 'dias restantes'} → {formatMoeda(orcamento.valorDiario)}/dia)
            </span>
          </dd>
        </div>
      </dl>
    </article>
  )
}
