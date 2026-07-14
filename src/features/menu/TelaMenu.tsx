import { supabase } from '../../lib/supabase'
import type { Usuario } from '../../types/domain'

interface TelaMenuProps {
  perfilAtivo: Usuario
  onTrocarPerfil: () => void
  onEditarPrevisao: () => void
  onAbrirEconomias: () => void
  onAbrirCartoes: () => void
}

export function TelaMenu({
  perfilAtivo,
  onTrocarPerfil,
  onEditarPrevisao,
  onAbrirEconomias,
  onAbrirCartoes,
}: TelaMenuProps) {
  return (
    <div className="tela-menu">
      <p>
        Você está como <strong>{perfilAtivo.nome}</strong>
      </p>
      <button type="button" onClick={onEditarPrevisao}>
        Categorias e previsão do mês
      </button>
      <button type="button" onClick={onAbrirCartoes}>
        Cartões
      </button>
      <button type="button" onClick={onAbrirEconomias}>
        Economias
      </button>
      <button type="button" onClick={onTrocarPerfil}>
        Trocar perfil
      </button>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    </div>
  )
}
