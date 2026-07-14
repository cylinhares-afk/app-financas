import { formatMoeda } from '../../lib/formatMoeda'
import { nomeDoMes } from '../../lib/navegacaoMes'
import type { FechamentoPendente } from './useFechamentoPendente'

interface ModalFechamentoMesProps {
  pendente: FechamentoPendente
  onConfirmar: () => void
  onRecusar: () => void
}

export function ModalFechamentoMes({ pendente, onConfirmar, onRecusar }: ModalFechamentoMesProps) {
  const positivo = pendente.performance >= 0
  const nome = nomeDoMes(pendente.ano, pendente.mes)

  return (
    <div className="modal-overlay">
      <div className="modal-folha modal-fechamento">
        <h2>Fechamento de {nome}</h2>
        <p className="modal-fechamento__resultado">
          {nome} fechou com{' '}
          <strong className={positivo ? 'tela-totais__valor--positivo' : 'tela-totais__valor--negativo'}>
            {formatMoeda(pendente.performance)}
          </strong>{' '}
          {positivo ? 'de sobra.' : 'no negativo.'}
        </p>
        <p>
          {positivo
            ? 'Quer mover esse valor para as Economias?'
            : 'Quer descontar esse valor da reserva de Economias?'}
        </p>

        <div className="modal-fechamento__acoes">
          <button type="button" className="modal-fechamento__confirmar" onClick={onConfirmar}>
            {positivo ? 'Mover para Economias' : 'Descontar da reserva'}
          </button>
          <button type="button" className="modal-folha__cancelar" onClick={onRecusar}>
            {positivo ? 'Não mover, manter no saldo' : 'Não descontar, manter no saldo'}
          </button>
        </div>
      </div>
    </div>
  )
}
