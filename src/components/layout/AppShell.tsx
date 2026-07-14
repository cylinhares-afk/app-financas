import type { ReactNode } from 'react'
import type { Aba } from '@/types/navegacao'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { Fab } from './Fab'

interface AppShellProps {
  abaAtiva: Aba
  onNavegar: (aba: Aba) => void
  perfilNome: string
  onNovoLancamento: () => void
  onAbrirCartoes: () => void
  onTrocarPerfil: () => void
  children: ReactNode
}

export function AppShell({
  abaAtiva,
  onNavegar,
  perfilNome,
  onNovoLancamento,
  onAbrirCartoes,
  onTrocarPerfil,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Sidebar abaAtiva={abaAtiva} onNavegar={onNavegar} />

      <div className="flex flex-1 flex-col">
        <Header
          perfilNome={perfilNome}
          onNovoLancamento={onNovoLancamento}
          onAbrirCartoes={onAbrirCartoes}
          onTrocarPerfil={onTrocarPerfil}
        />

        <main className="flex-1 pb-24 md:pb-6">
          <div className="mx-auto w-full max-w-2xl px-4 py-4 md:px-6 md:py-6">{children}</div>
        </main>
      </div>

      <BottomNav abaAtiva={abaAtiva} onNavegar={onNavegar} />
      <Fab onClick={onNovoLancamento} />
    </div>
  )
}
