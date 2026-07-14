import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FabProps {
  onClick: () => void
}

export function Fab({ onClick }: FabProps) {
  return (
    <Button
      onClick={onClick}
      aria-label="Novo lançamento"
      className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+12px)] z-50 size-14 rounded-full shadow-lg md:hidden [&_svg]:size-6"
    >
      <Plus />
    </Button>
  )
}
