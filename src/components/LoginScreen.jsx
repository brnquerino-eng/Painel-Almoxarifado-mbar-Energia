import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          setError('E-mail ou senha inválidos. Verifique suas credenciais.')
        } else {
          setError(authError.message)
        }
      }
    } catch (err) {
      setError('Falha de comunicação com o servidor de autenticação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#080808] text-white font-sans flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow decorativo sutil no fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#f58220]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0c0c0c] border border-[#2A2A2A] rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative z-10">
        {/* Identidade Âmbar Energia (idêntica ao Header) */}
        <div className="bg-[#101010] backdrop-blur-md px-6 py-4 rounded-2xl text-center shadow-[0_0_15px_rgba(245,130,32,0.12)] border border-[#f58220]/25 mb-6">
          <div className="text-white font-black text-3xl leading-tight tracking-tight drop-shadow-md">
            Âmbar
          </div>
          <div className="text-[#f58220] text-xs font-extrabold tracking-[0.35em] uppercase drop-shadow-[0_0_6px_rgba(245,130,32,0.5)] mt-0.5">
            ENERGIA
          </div>
        </div>

        <div className="text-center mb-7">
          <h1 className="text-white text-xl font-black tracking-wide">
            VISÃO ESTOQUE
          </h1>
          <p className="text-gray-400 text-xs mt-1 font-medium">
            Acesso restrito · Gestão de Almoxarifado e Inventários
          </p>
        </div>

        {error && (
          <div className="bg-[#990000]/30 border border-red-500/70 rounded-xl p-3.5 mb-5 text-xs text-red-200 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Campo E-mail */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              E-mail Corporativo
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.nome@ambarenergia.com.br"
                autoComplete="email"
                className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#f58220] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Campo Senha */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#f58220] rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-gray-600 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={loading}
            className={`
              mt-2 w-full py-3.5 px-4 rounded-xl font-extrabold text-xs uppercase tracking-[0.12em] transition-all duration-300 flex items-center justify-center gap-2
              ${loading
                ? 'bg-[#1a0f05] border border-[#f58220]/50 text-[#f58220] cursor-wait'
                : 'bg-[#f58220] hover:bg-[#e07112] text-black shadow-[0_0_20px_rgba(245,130,32,0.25)] hover:shadow-[0_0_25px_rgba(245,130,32,0.45)] cursor-pointer'
              }
            `}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Acessar Painel</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-7 pt-5 border-t border-[#1e1e1e] text-center">
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">
            Painel Estoque · v3.0 · Acesso Monitorado
          </span>
        </div>
      </div>
    </div>
  )
}