import { CreditCard, LogOut, Menu as MenuIcon, Plus, Upload, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  perfilNome: string
  onNovoLancamento: () => void
  onAbrirCartoes: () => void
  onAbrirImportarCSV: () => void
  onTrocarPerfil: () => void
}

export function Header({ perfilNome, onNovoLancamento, onAbrirCartoes, onAbrirImportarCSV, onTrocarPerfil }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-end gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:justify-between md:px-6">
      <span className="hidden text-sm font-medium text-muted-foreground md:inline">Finanças</span>
      <div className="flex items-center gap-2">
        <Button onClick={onNovoLancamento} className="hidden md:inline-flex">
          <Plus />
          Novo lançamento
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <MenuIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{perfilNome}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAbrirCartoes}>
              <CreditCard />
              Cartões
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAbrirImportarCSV}>
              <Upload />
              Importar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTrocarPerfil}>
              <Users />
              Trocar perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
