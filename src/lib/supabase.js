import { createClient } from '@supabase/supabase-js'

// ⚠️ Configure suas variáveis de ambiente no StackBlitz:
// Clique no ícone de cadeado (Secrets) e adicione:
//   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
//   VITE_SUPABASE_ANON_KEY=sua-chave-anon
//
// Nunca coloque a service_role key no frontend.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas. ' +
    'Adicione-as nas Secrets do StackBlitz.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export const TABLE_ESTOQUE = 'painel_estoque'
export const TABLE_INVENTARIO = 'painel_inventario'
