import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginScreen({ isRecoveryMode = false, onRecoveryComplete }) {
  // Modos: 'login' | 'esqueci' | 'solicitar' | 'nova_senha'
  const [modo, setModo] = useState(isRecoveryMode ? 'nova_senha' : 'login')

  // Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Esqueci minha senha
  const [emailRecuperacao, setEmailRecuperacao] = useState('')
  const [recuperacaoEnviada, setRecuperacaoEnviada] = useState(false)

  // Redefinir nova senha (após clicar no link do e-mail)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('')
  const [showNovaSenha, setShowNovaSenha] = useState(false)

  // Solicitação de primeiro acesso
  const [solNome, setSolNome] = useState('')
  const [solEmail, setSolEmail] = useState('')
  const [solCargo, setSolCargo] = useState('supervisor')
  const [solRegiaoUnidade, setSolRegiaoUnidade] = useState('')
  const [solicitacaoEnviada, setSolicitacaoEnviada] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const trocarModo = (novoModo) => {
    setModo(novoModo)
    setError(null)
    setSuccessMsg(null)
    setRecuperacaoEnviada(false)
    setSolicitacaoEnviada(false)
  }

  // 1. Login normal
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
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

  // 2. Enviar link de recuperação de senha para o e-mail do usuário
  const handleEnviarRecuperacao = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const emailLimpo = emailRecuperacao.trim().toLowerCase()
    if (!emailLimpo) {
      setError('Informe o seu e-mail corporativo.')
      return
    }

    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
        redirectTo: window.location.origin,
      })

      if (resetError) {
        setError(resetError.message)
      } else {
        setSuccessMsg(
          `Se o e-mail ${emailLimpo} estiver cadastrado, você receberá em instantes um link oficial para redefinir sua senha. Verifique também a caixa de spam.`
        )
        setEmailRecuperacao('')
        setRecuperacaoEnviada(true)
      }
    } catch (err) {
      setError('Não foi possível solicitar a recuperação de senha agora.')
    } finally {
      setLoading(false)
    }
  }

  // 3. Salvar nova senha após clicar no link recebido por e-mail
  const handleSalvarNovaSenha = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (novaSenha.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (novaSenha !== confirmarNovaSenha) {
      setError('As senhas digitadas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: novaSenha,
      })

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccessMsg('Senha atualizada com sucesso! Entrando no painel...')
        setTimeout(() => {
          if (onRecoveryComplete) onRecoveryComplete()
        }, 1200)
      }
    } catch (err) {
      setError('Erro ao salvar a nova senha.')
    } finally {
      setLoading(false)
    }
  }

  // 4. Enviar pedido de primeiro acesso para aprovação do Admin
  const handleSolicitarAcesso = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const nomeLimpo = solNome.trim()
    const emailLimpo = solEmail.trim().toLowerCase()
    const regUniLimpo = solRegiaoUnidade.trim()

    if (!nomeLimpo || !emailLimpo || !regUniLimpo) {
      setError('Preencha todos os campos obrigatórios para análise do administrador.')
      return
    }

    setLoading(true)
    try {
      const { error: insertError } = await supabase.from('solicitacoes_acesso').insert({
        nome: nomeLimpo,
        email: emailLimpo,
        cargo_solicitado: solCargo,
        regiao_unidade_info: regUniLimpo,
        status: 'pendente',
      })

      if (insertError) {
        setError(`Não foi possível enviar a solicitação: ${insertError.message}`)
      } else {
        setSuccessMsg(
          'Solicitação enviada com sucesso! Assim que o Administrador aprovar e liberar sua abrangência, você poderá acessar o painel.'
        )
        setSolNome('')
        setSolEmail('')
        setSolCargo('supervisor')
        setSolRegiaoUnidade('')
        setSolicitacaoEnviada(true)
      }
    } catch (err) {
      setError('Falha de comunicação ao registrar sua solicitação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#080808] text-white font-sans flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow decorativo sutil no fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#f58220]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0c0c0c] border border-[#2A2A2A] rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative z-10">
        {/* Identidade Âmbar Energia */}
        <div className="bg-[#101010] backdrop-blur-md px-6 py-4 rounded-2xl text-center shadow-[0_0_15px_rgba(245,130,32,0.12)] border border-[#f58220]/25 mb-6">
          <div className="text-white font-black text-3xl leading-tight tracking-tight drop-shadow-md">
            Âmbar
          </div>
          <div className="text-[#f58220] text-xs font-extrabold tracking-[0.35em] uppercase drop-shadow-[0_0_6px_rgba(245,130,32,0.5)] mt-0.5">
            ENERGIA
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-white text-xl font-black tracking-wide">
            {modo === 'login' && 'VISÃO ESTOQUE'}
            {modo === 'esqueci' && 'RECUPERAR SENHA'}
            {modo === 'nova_senha' && 'DEFINIR NOVA SENHA'}
            {modo === 'solicitar' && 'SOLICITAR PRIMEIRO ACESSO'}
          </h1>
          <p className="text-gray-400 text-xs mt-1 font-medium">
            {modo === 'login' && 'Acesso restrito · Gestão de Almoxarifado e Inventários'}
            {modo === 'esqueci' &&
              (recuperacaoEnviada
                ? 'Verifique sua caixa de entrada para continuar'
                : 'Enviaremos um link de redefinição para o seu e-mail')}
            {modo === 'nova_senha' && 'Cadastre sua nova senha pessoal de acesso'}
            {modo === 'solicitar' &&
              (solicitacaoEnviada
                ? 'Pedido registrado na fila de aprovação'
                : 'Seu pedido será analisado e liberado pelo Administrador')}
          </p>
        </div>

        {/* Alerta de Erro */}
        {error && (
          <div className="bg-[#990000]/30 border border-red-500/70 rounded-xl p-3.5 mb-5 text-xs text-red-200 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Alerta de Sucesso */}
        {successMsg && (
          <div className="bg-emerald-950/50 border border-emerald-500/60 rounded-xl p-3.5 mb-5 text-xs text-emerald-200 leading-relaxed">
            {successMsg}
          </div>
        )}

        {/* MODO 1: LOGIN */}
        {modo === 'login' && (
          <>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  E-mail Corporativo
                </label>
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      trocarModo('esqueci')
                      setEmailRecuperacao(email)
                    }}
                    className="text-[11px] font-semibold text-[#f58220] hover:underline cursor-pointer"
                  >
                    Esqueci minha senha
                  </button>
                </div>
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
                {loading ? 'Autenticando...' : 'Acessar Painel'}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-[#1c1c1c] text-center">
              <p className="text-xs text-gray-400">
                Ainda não possui acesso?{' '}
                <button
                  type="button"
                  onClick={() => trocarModo('solicitar')}
                  className="text-[#f58220] font-bold hover:underline cursor-pointer"
                >
                  Solicitar liberação
                </button>
              </p>
            </div>
          </>
        )}

        {/* MODO 2: ESQUECI MINHA SENHA */}
        {modo === 'esqueci' && (
          <div className="flex flex-col gap-3.5">
            {!recuperacaoEnviada ? (
              <form onSubmit={handleEnviarRecuperacao} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Seu E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    required
                    value={emailRecuperacao}
                    onChange={(e) => setEmailRecuperacao(e.target.value)}
                    placeholder="seu.nome@ambarenergia.com.br"
                    className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#f58220] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 w-full py-3.5 px-4 rounded-xl bg-[#f58220] hover:bg-[#e07112] disabled:opacity-50 text-black font-extrabold text-xs uppercase tracking-[0.12em] transition-all cursor-pointer"
                >
                  {loading ? 'Enviando link...' : 'Enviar Link para Meu E-mail'}
                </button>
              </form>
            ) : (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setRecuperacaoEnviada(false)
                    setSuccessMsg(null)
                  }}
                  className="text-[11px] text-gray-400 hover:text-[#f58220] underline cursor-pointer"
                >
                  Não recebeu o e-mail? Enviar novamente
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => trocarModo('login')}
              className="w-full py-2.5 rounded-xl bg-[#141414] hover:bg-[#1c1c1c] text-xs font-bold text-gray-300 cursor-pointer"
            >
              ← Voltar para o Login
            </button>
          </div>
        )}

        {/* MODO 3: DEFINIR NOVA SENHA (APÓS CLICAR NO LINK DO E-MAIL) */}
        {modo === 'nova_senha' && (
          <form onSubmit={handleSalvarNovaSenha} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Nova Senha (mín. 6 caracteres)
              </label>
              <div className="relative">
                <input
                  type={showNovaSenha ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Digite sua nova senha"
                  autoComplete="new-password"
                  className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#f58220] rounded-xl px-4 py-3 pr-16 text-sm text-white placeholder-gray-600 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNovaSenha((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 hover:text-white cursor-pointer"
                >
                  {showNovaSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Confirmar Nova Senha
              </label>
              <input
                type={showNovaSenha ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmarNovaSenha}
                onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#f58220] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-3.5 px-4 rounded-xl bg-[#f58220] hover:bg-[#e07112] disabled:opacity-50 text-black font-extrabold text-xs uppercase tracking-[0.12em] transition-all cursor-pointer"
            >
              {loading ? 'Salvando...' : 'Salvar Nova Senha e Entrar'}
            </button>
          </form>
        )}

        {/* MODO 4: SOLICITAR PRIMEIRO ACESSO */}
        {modo === 'solicitar' && (
          <div className="flex flex-col gap-3.5">
            {!solicitacaoEnviada && (
              <form onSubmit={handleSolicitarAcesso} autoComplete="off" className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={solNome}
                    onChange={(e) => setSolNome(e.target.value)}
                    placeholder="Ex.: Carlos Eduardo Silva"
                    className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#f58220] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    E-mail Corporativo *
                  </label>
                  <input
                    type="email"
                    required
                    value={solEmail}
                    onChange={(e) => setSolEmail(e.target.value)}
                    placeholder="nome.sobrenome@ambarenergia.com.br"
                    className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#f58220] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Perfil / Cargo *
                  </label>
                  <select
                    value={solCargo}
                    onChange={(e) => setSolCargo(e.target.value)}
                    className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#f58220] rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="supervisor">Supervisor de Almoxarifado</option>
                    <option value="coordenador">Coordenador Regional</option>
                    <option value="gerente">Gerente Corporativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Região / Usina(s) que atende *
                  </label>
                  <input
                    type="text"
                    required
                    value={solRegiaoUnidade}
                    onChange={(e) => setSolRegiaoUnidade(e.target.value)}
                    placeholder="Ex.: UTE Uruguaiana / Região Sul"
                    className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#f58220] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full py-3.5 px-4 rounded-xl bg-[#f58220] hover:bg-[#e07112] disabled:opacity-50 text-black font-extrabold text-xs uppercase tracking-[0.12em] transition-all cursor-pointer"
                >
                  {loading ? 'Enviando Pedido...' : 'Enviar Pedido para Aprovação'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => trocarModo('login')}
              className="w-full py-2.5 rounded-xl bg-[#141414] hover:bg-[#1c1c1c] text-xs font-bold text-gray-300 cursor-pointer"
            >
              ← Voltar para o Login
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-[#1e1e1e] text-center">
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">
            Painel Estoque · v3.0 · Acesso Monitorado
          </span>
        </div>
      </div>
    </div>
  )
}