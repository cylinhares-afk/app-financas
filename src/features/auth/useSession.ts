import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_evento, novaSession) => {
      setSession(novaSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  return { session, carregando }
}
