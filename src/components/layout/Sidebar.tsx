import { cn } from '@/lib/utils'
import type { Aba } from '@/types/navegacao'
import { NAV_ITENS } from './nav-itens'

interface SidebarProps {
  abaAtiva: Aba
  onNavegar: (aba: Aba) => void
}

export function Sidebar({ abaAtiva, onNavegar }: SidebarProps) {
  return (
    <aside className="hidden md:sticky md:top-0 md:flex md:h-svh md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-border md:bg-card md:p-3">
      <div className="px-2 py-3 text-lg font-semibold text-foreground">Finanças</div>
      <nav className="flex flex-col gap-1">
        {NAV_ITENS.map(({ aba, rotulo, Icone }) => (
          <button
            key={aba}
            type="button"
            onClick={() => onNavegar(aba)}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              abaAtiva === aba
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icone className="size-5" />
            {rotulo}
          </button>
        ))}
      </nav>
    </aside>
  )
}
