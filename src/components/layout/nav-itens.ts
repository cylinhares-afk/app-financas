import { Home, Tag, BarChart3, PiggyBank, type LucideIcon } from 'lucide-react'
import type { Aba } from '@/types/navegacao'

interface NavItem {
  aba: Aba
  rotulo: string
  Icone: LucideIcon
}

// Os 4 destinos da navegação primária (sidebar em desktop, bottom tab bar em
// mobile). Cartões e Registro ficam de fora de propósito — ver navegacao.ts.
export const NAV_ITENS: NavItem[] = [
  { aba: 'home', rotulo: 'Home', Icone: Home },
  { aba: 'categorias', rotulo: 'Categorias', Icone: Tag },
  { aba: 'totais', rotulo: 'Totais', Icone: BarChart3 },
  { aba: 'economias', rotulo: 'Economias', Icone: PiggyBank },
]
