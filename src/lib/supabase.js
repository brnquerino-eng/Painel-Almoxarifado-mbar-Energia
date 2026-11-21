import { createClient } from '@supabase/supabase-js'

// ⚠️ Configure suas variáveis de ambiente no StackBlitz / Vercel:
//   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
//   VITE_SUPABASE_ANON_KEY=sua-chave-anon
//
// Nunca coloque a service_role key no frontend.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas. ' +
    'Adicione-as nas Secrets do StackBlitz ou Environment Variables da Vercel.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const TABLE_ESTOQUE = 'painel_estoque'
export const TABLE_INVENTARIO = 'painel_inventario'