import { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabase'
import { GLOBAL_CACHE_KEYS } from './lib/cacheUtils'
import LoginScreen from './components/LoginScreen'
import Header from './components/Header'
import LoadingScreen from './components/LoadingScreen'
import VisaoGeral from './components/VisaoGeral'
import PainelInventarios from './components/PainelInventarios'
import PergunteAoEstoque from './components/PergunteAoEstoque'
import ResumoEstoque from './components/ResumoEstoque'
import ControleAcessos from './components/ControleAcessos'
import { useEstoqueData } from './hooks/useEstoqueData'
import { useInventarioData } from './hooks/useInventarioData'

function DashboardContent({ user, perfilAcesso, onLogout }) {
  const [activeTab, setActiveTab] = useState('pergunte')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [buscando, setBuscando] = useState(false)

  const isAdmin =
    user?.app_metadata?.role === 'admin' || perfilAcesso?.cargo === 'admin'
  const cargoAtual = isAdmin ? 'admin' : perfilAcesso?.cargo || 'supervisor'

  const {
    data: estoqueData,
    loading: loadingEstoque,
    error: errorEstoque,
    progress: progressEstoque,
    reload: carregarEstoque,
  } = useEstoqueData({
    userId: user?.id,
    isAdmin,
    perfilAcesso,
  })

  const {
    data: inventarioData,
    loading: loadingInventario,
    error: errorInventario,
    progress: progressInventario,
    reload: carregarInventario,
  } = useInventarioData({
    userId: user?.id,
    isAdmin,
    perfilAcesso,
  })

  const loading = loadingEstoque || loadingInventario || buscando
  const progress = Math.round((progressEstoque * 0.7 + progressInventario * 0.3)) || 0

  const unidadesPermitidasSet = useMemo(() => {
    if (isAdmin || cargoAtual === 'gerente') return null
    return new Set(
      (perfilAcesso?.unidades_permitidas || []).map((u) => u.toString().trim().toUpperCase())
    )
  }, [isAdmin, cargoAtual, perfilAcesso])

  useEffect(() => {
    if (activeTab === 'acessos' && !isAdmin) {
      setActiveTab('pergunte')
    }
  }, [activeTab, isAdmin])

  useEffect(() => {
    const dataSalva = localStorage.getItem(GLOBAL_CACHE_KEYS.ULTIMA_CARGA)
    setUltimaAtualizacao(dataSalva || null)
  }, [])

  const handleAtualizarDados = async () => {
    setBuscando(true)
    await Promise.all([carregarEstoque(), carregarInventario()])
    const agora = new Date().toLocaleString('pt-BR')
    localStorage.setItem(GLOBAL_CACHE_KEYS.ULTIMA_CARGA, agora)
    setUltimaAtualizacao(agora)
    setBuscando(false)
  }

  if (loading && buscando) {
    return (
      <div className="flex h-screen w-full bg-[#080808] overflow-hidden text-white font-sans">
        <Header
          ultimaAtualizacao={ultimaAtualizacao}
          onAtualizar={handleAtualizarDados}
          loading={buscando}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userEmail={user?.email}
          userCargo={cargoAtual}
          isAdmin={isAdmin}
          onLogout={onLogout}
        />
        <div className="flex-1 flex flex-col relative">
          <LoadingScreen
            progress={progress}
            label={
              isAdmin || cargoAtual === 'gerente'
                ? 'Atualizando disco local com a base corporativa...'
                : 'Atualizando disco local com suas unidades autorizadas...'
            }
          />
        </div>
      </div>
    )
  }

  const resumoEscopoCoordenador = () => {
    const regs = perfilAcesso?.regioes_permitidas || []
    const unis = perfilAcesso?.unidades_permitidas || []
    if (regs.length === 0) return 'Nenhuma região configurada'
    return `Regiões: ${regs.join(', ')} (${unis.length} unidade(s) ativa(s))`
  }

  return (
    <div className="flex h-screen w-full bg-[#080808] overflow-hidden text-white font-sans">
      <Header
        ultimaAtualizacao={ultimaAtualizacao}
        onAtualizar={handleAtualizarDados}
        loading={buscando}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userEmail={user?.email}
        userCargo={cargoAtual}
        isAdmin={isAdmin}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        <main className="flex-1 p-6 lg:p-8">
          {(errorEstoque || errorInventario) && (
            <div className="bg-[#990000]/30 border border-red-500 rounded-xl p-4 mb-6 text-sm text-red-200">
              <strong>Erro ao carregar dados:</strong>{' '}
              {errorEstoque || errorInventario}
            </div>
          )}

          {!isAdmin && cargoAtual !== 'gerente' && (
            <div className="mb-5 px-4 py-2.5 rounded-xl bg-[#121212] border border-[#262626] flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
              <span>
                Leitura do disco filtrada para <strong className="text-white uppercase">{cargoAtual}</strong>:
              </span>
              <span className="font-mono text-[#f58220]">
                {cargoAtual === 'coordenador'
                  ? resumoEscopoCoordenador()
                  : `${(perfilAcesso?.unidades_permitidas || []).join(', ') || 'Nenhuma unidade'} (${unidadesPermitidasSet?.size || 0})`}
              </span>
            </div>
          )}

          {activeTab === 'acessos' && isAdmin ? (
            <div className="animate-fade-in">
              <ControleAcessos
                estoqueData={estoqueData}
                inventarioData={inventarioData}
                currentUserId={user?.id}
              />
            </div>
          ) : estoqueData.length === 0 && !loadingEstoque ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
              <div className="bg-[#111] p-8 rounded-2xl border border-[#222] max-w-md">
                <svg className="w-12 h-12 text-[#f58220] mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-lg font-bold text-white mb-2">
                  {ultimaAtualizacao ? 'Nenhuma Movimentação no Disco para o Seu Perfil' : 'Base de Dados Vazia'}
                </h3>
                <p className="text-sm text-gray-500">
                  {ultimaAtualizacao
                    ? 'A carga salva neste computador ainda não contém registros das suas unidades. Clique em "Atualizar Dados" no menu lateral para sincronizar suas usinas.'
                    : 'O disco local está vazio. Clique no botão "Atualizar Dados" no menu lateral para carregar as informações pela primeira vez.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              {activeTab === 'geral' && <VisaoGeral data={estoqueData} />}
              {activeTab === 'inventarios' && <PainelInventarios data={inventarioData} />}
              {activeTab === 'pergunte' && (
                <PergunteAoEstoque data={estoqueData} loading={loadingEstoque} />
              )}
              {activeTab === 'resumo' && <ResumoEstoque data={estoqueData} />}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [perfilAcesso, setPerfilAcesso] = useState(null)
  const [verificandoSessao, setVerificandoSessao] = useState(true)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)

  const carregarPerfilUsuario = async (currentSession) => {
    if (!currentSession?.user) {
      setPerfilAcesso(null)
      setVerificandoSessao(false)
      return
    }

    const { data } = await supabase
      .from('perfis_acesso')
      .select('*')
      .eq('user_id', currentSession.user.id)
      .maybeSingle()

    setPerfilAcesso(data || null)
    setVerificandoSessao(false)
  }

  useEffect(() => {
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      setIsRecoveryMode(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      carregarPerfilUsuario(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true)
      }

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setPerfilAcesso(null)
        setVerificandoSessao(false)
        return
      }

      setVerificandoSessao(true)
      setSession(newSession)
      carregarPerfilUsuario(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    setIsRecoveryMode(false)
    setPerfilAcesso(null)
    await supabase.auth.signOut()
  }

  if (verificandoSessao) {
    return (
      <div className="h-screen w-full bg-[#080808] flex flex-col items-center justify-center text-white gap-3">
        <div className="w-8 h-8 border-2 border-[#f58220] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
          Verificando acesso...
        </span>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen />
  }

  const isAdmin =
    session.user?.app_metadata?.role === 'admin' || perfilAcesso?.cargo === 'admin'

  const trocaObrigatoriaAtiva = Boolean(perfilAcesso?.trocar_senha_obrigatoria) && !isAdmin

  if (isRecoveryMode || trocaObrigatoriaAtiva) {
    return (
      <LoginScreen
        isRecoveryMode={isRecoveryMode}
        forcePasswordChange={trocaObrigatoriaAtiva}
        userEmail={session.user?.email || ''}
        onRecoveryComplete={() => {
          setIsRecoveryMode(false)
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname)
          }
          setVerificandoSessao(true)
          carregarPerfilUsuario(session)
        }}
      />
    )
  }

  if (perfilAcesso && perfilAcesso.ativo === false && !isAdmin) {
    return (
      <div className="h-screen w-full bg-[#080808] flex flex-col items-center justify-center text-white p-6">
        <div className="bg-[#111] border border-red-500/40 rounded-2xl p-8 max-w-md text-center space-y-4">
          <h2 className="text-lg font-black text-red-400">Acesso Suspenso</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            Seu usuário (<span className="text-gray-200">{session.user.email}</span>) está temporariamente desativado pelo administrador do sistema.
          </p>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-xs font-bold text-white cursor-pointer"
          >
            Sair e trocar de conta
          </button>
        </div>
      </div>
    )
  }

  return (
    <DashboardContent
      key={session.user.id}
      user={session.user}
      perfilAcesso={perfilAcesso}
      onLogout={handleLogout}
    />
  )
}