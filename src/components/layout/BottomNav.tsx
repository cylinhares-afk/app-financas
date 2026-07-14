import { cn } from '@/lib/utils'
import type { Aba } from '@/types/navegacao'
import { NAV_ITENS } from './nav-itens'

interface BottomNavProps {
  abaAtiva: Aba
  onNavegar: (aba: Aba) => void
}

export function BottomNav({ abaAtiva, onNavegar }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-[var(--nav-bg)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_ITENS.map(({ aba, rotulo, Icone }) => (
        <button
          key={aba}
          type="button"
          onClick={() => onNavegar(aba)}
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors',
            abaAtiva === aba ? 'text-primary' : 'text-white/60'
          )}
        >
          <Icone className="size-5" />
          {rotulo}
        </button>
      ))}
    </nav>
  )
}
