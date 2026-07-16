import { Home, BarChart3, PiggyBank, type LucideIcon } from 'lucide-react'
import type { Aba } from '@/types/navegacao'

interface NavItem {
  aba: Aba
  rotulo: string
  Icone: LucideIcon
}

// Os 3 destinos da navegação primária (sidebar em desktop, bottom tab bar em
// mobile). Cartões e Registro ficam de fora de propósito — ver navegacao.ts.
export const NAV_ITENS: NavItem[] = [
  { aba: 'home', rotulo: 'Home', Icone: Home },
  { aba: 'analise', rotulo: 'Análise', Icone: BarChart3 },
  { aba: 'economias', rotulo: 'Economias', Icone: PiggyBank },
]
