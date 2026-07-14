import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Usuario } from '../../types/domain'

const CHAVE_STORAGE = 'financas:perfil-ativo-id'

export function usePerfilAtivo(autenticado: boolean) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [perfilAtivoId, setPerfilAtivoId] = useState<string | null>(() =>
    localStorage.getItem(CHAVE_STORAGE),
  )
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!autenticado) {
      setUsuarios([])
      setCarregando(true)
      return
    }

    supabase
      .from('usuarios')
      .select('id, nome')
      .order('nome')
      .then(({ data, error }) => {
        setUsuarios(data ?? [])
        setErro(error ? `${error.message} (${error.code ?? 'sem código'})` : null)
        setCarregando(false)
      })
  }, [autenticado])

  const selecionar = useCallback((id: string) => {
    localStorage.setItem(CHAVE_STORAGE, id)
    setPerfilAtivoId(id)
  }, [])

  const limpar = useCallback(() => {
    localStorage.removeItem(CHAVE_STORAGE)
    setPerfilAtivoId(null)
  }, [])

  const perfilAtivo = usuarios.find((usuario) => usuario.id === perfilAtivoId) ?? null

  return { usuarios, perfilAtivo, carregando, erro, selecionar, limpar }
}
