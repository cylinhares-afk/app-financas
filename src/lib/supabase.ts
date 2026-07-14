import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY. Copie .env.example para .env e preencha com os dados do seu projeto Supabase.',
  )
}

// Sessão de longa duração, de propósito: uso pessoal em dispositivos que só
// o casal acessa, sem necessidade de expirar por segurança. persistSession
// grava a sessão no localStorage (sobrevive a fechar o navegador/app);
// autoRefreshToken renova o access token sozinho em background usando o
// refresh token, antes dele expirar — sem isso, mesmo com persistSession, a
// sessão salva ficaria "morta" (token expirado) depois de 1h. A duração
// máxima de cada token é configurada no painel do Supabase (Authentication
// → Sessions), não aqui — ver README para o que checar lá.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
  },
})
