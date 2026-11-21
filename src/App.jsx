import { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabase'
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
  } = useEstoqueData()

  const {
    data: inventarioData,
    loading: loadingInventario,
    error: errorInventario,
    progress: progressInventario,
    reload: carregarInventario,
  } = useInventarioData()

  const loading = loadingEstoque || loadingInventario || buscando
  const progress = Math.round((progressEstoque * 0.7 + progressInventario * 0.3)) || 0

  // Filtra Estoque e Inventário conforme a abrangência do perfil:
  // - Admin / Gerente: acesso total
  // - Coordenador: Regiões selecionadas + filtro granular pelas Unidades marcadas dentro delas
  // - Supervisor: apenas Unidades permitidas
  const { estoqueFiltrado, inventarioFiltrado, unidadesPermitidasSet } = useMemo(() => {
    if (isAdmin || cargoAtual === 'gerente') {
      return {
        estoqueFiltrado: estoqueData,
        inventarioFiltrado: inventarioData,
        unidadesPermitidasSet: null,
      }
    }

    if (cargoAtual === 'coordenador') {
      const regioesSet = new Set(perfilAcesso?.regioes_permitidas || [])
      const unidadesEspecificas = perfilAcesso?.unidades_permitidas || []
      const temFiltroUnidade = unidadesEspecificas.length > 0
      const unidadesSet = new Set(unidadesEspecificas)
      const unidadesLiberadas = new Set()

      const est = estoqueData.filter((row) => {
        const reg = (row['Região'] || row['regiao'] || '').toString().trim()
        const uni = (row['unidade_almoxarifado'] || '').toString().trim()
        if (!regioesSet.has(reg)) return false
        if (temFiltroUnidade && !unidadesSet.has(uni)) return false
        if (uni) unidadesLiberadas.add(uni)
        return true
      })

      const inv = inventarioData.filter((row) => {
        const uni = (row['unidade_almoxarifado'] || '').toString().trim()
        return unidadesLiberadas.has(uni)
      })

      return {
        estoqueFiltrado: est,
        inventarioFiltrado: inv,
        unidadesPermitidasSet: unidadesLiberadas,
      }
    }

    // Supervisor (ou padrão restrito)
    const unidadesSet = new Set(perfilAcesso?.unidades_permitidas || [])
    const est = estoqueData.filter((row) => {
      const uni = (row['unidade_almoxarifado'] || '').toString().trim()
      return unidadesSet.has(uni)
    })
    const inv = inventarioData.filter((row) => {
      const uni = (row['unidade_almoxarifado'] || '').toString().trim()
      return unidadesSet.has(uni)
    })

    return {
      estoqueFiltrado: est,
      inventarioFiltrado: inv,
      unidadesPermitidasSet: unidadesSet,
    }
  }, [estoqueData, inventarioData, isAdmin, cargoAtual, perfilAcesso])

  // Proteção extra: impede acesso à aba 'acessos' se não for admin
  useEffect(() => {
    if (activeTab === 'acessos' && !isAdmin) {
      setActiveTab('pergunte')
    }
  }, [activeTab, isAdmin])

  // 1. Ao abrir o painel, recupera a data do último clique
  useEffect(() => {
    const dataSalva = localStorage.getItem('dataUltimaAtualizacao')
    if (dataSalva) {
      setUltimaAtualizacao(dataSalva)
    }
  }, [])

  // 2. Função mágica do botão
  const handleAtualizarDados = async () => {
    setBuscando(true)
    
    // Força a busca no Supabase
    await Promise.all([carregarEstoque(), carregarInventario()])
    
    // Carimba a hora exata que terminou de puxar
    const agora = new Date().toLocaleString('pt-BR')
    localStorage.setItem('dataUltimaAtualizacao', agora)
    setUltimaAtualizacao(agora)
    
    setBuscando(false)
  }

  // Tela preta de loading se você tiver CLICADO no botão (mas mantendo a sidebar visível!)
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
            label="Sincronizando e atualizando base de dados..."
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
      {/* 🚀 Sidebar Executiva e Controle de Navegação */}
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

      {/* Área Principal com Scroll Independente */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        <main className="flex-1 p-6 lg:p-8">
          
          {(errorEstoque || errorInventario) && (
            <div className="bg-[#990000]/30 border border-red-500 rounded-xl p-4 mb-6 text-sm text-red-200">
              <strong>Erro ao carregar dados:</strong>{' '}
              {errorEstoque || errorInventario}
            </div>
          )}

          {/* Faixa informativa de escopo para Coordenadores e Supervisores */}
          {!isAdmin && cargoAtual !== 'gerente' && estoqueData.length > 0 && (
            <div className="mb-5 px-4 py-2.5 rounded-xl bg-[#121212] border border-[#262626] flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
              <span>
                Visualização filtrada por perfil <strong className="text-white uppercase">{cargoAtual}</strong>:
              </span>
              <span className="font-mono text-[#f58220]">
                {cargoAtual === 'coordenador'
                  ? resumoEscopoCoordenador()
                  : `${unidadesPermitidasSet?.size || 0} unidade(s) liberada(s)`}
              </span>
            </div>
          )}

          {/* Se a aba ativa for Controle de Acessos (Admin), abre direto mesmo antes de sincronizar */}
          {activeTab === 'acessos' && isAdmin ? (
            <div className="animate-fade-in">
              <ControleAcessos
                estoqueData={estoqueData}
                inventarioData={inventarioData}
                currentUserId={user?.id}
              />
            </div>
          ) : !ultimaAtualizacao && estoqueData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
              <div className="bg-[#111] p-8 rounded-2xl border border-[#222] max-w-md">
                <svg className="w-12 h-12 text-[#f58220] mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-lg font-bold text-white mb-2">Base de Dados Vazia</h3>
                <p className="text-sm text-gray-500">
                  O cache está vazio. Clique no botão "Atualizar Dados" no menu lateral para puxar as informações do Supabase pela primeira vez.
                </p>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              {activeTab === 'geral' && <VisaoGeral data={estoqueFiltrado} />}
              {activeTab === 'inventarios' && <PainelInventarios data={inventarioFiltrado} />}
              {activeTab === 'pergunte' && (
                <PergunteAoEstoque data={estoqueFiltrado} loading={loadingEstoque} />
              )}
              {activeTab === 'resumo' && <ResumoEstoque data={estoqueFiltrado} />}
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
    // Verifica sessão ativa ao abrir o app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      carregarPerfilUsuario(session)
    })

    // Escuta login, logout e expiração de token em tempo real
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      carregarPerfilUsuario(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // Tela rápida enquanto checa o token salvo no navegador
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

  // Bloqueia o painel se não estiver autenticado
  if (!session) {
    return <LoginScreen />
  }

  // Bloqueia usuário desativado pelo Admin na tela de Controle de Acessos
  const isAdmin =
    session.user?.app_metadata?.role === 'admin' || perfilAcesso?.cargo === 'admin'
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

  // Libera o painel completo quando autenticado
  return (
    <DashboardContent
      user={session.user}
      perfilAcesso={perfilAcesso}
      onLogout={handleLogout}
    />
  )
}