import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LoginScreen from './components/LoginScreen'
import Header from './components/Header'
import LoadingScreen from './components/LoadingScreen'
import VisaoGeral from './components/VisaoGeral'
import PainelInventarios from './components/PainelInventarios'
import PergunteAoEstoque from './components/PergunteAoEstoque'
import ResumoEstoque from './components/ResumoEstoque'
import { useEstoqueData } from './hooks/useEstoqueData'
import { useInventarioData } from './hooks/useInventarioData'

function DashboardContent({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('pergunte')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)
  const [buscando, setBuscando] = useState(false)

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

          {/* Se não tem data salva e não tem dado nenhum, avisa para clicar */}
          {!ultimaAtualizacao && estoqueData.length === 0 ? (
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
  const [verificandoSessao, setVerificandoSessao] = useState(true)

  useEffect(() => {
    // Verifica sessão ativa ao abrir o app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setVerificandoSessao(false)
    })

    // Escuta login, logout e expiração de token em tempo real
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setVerificandoSessao(false)
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

  // Libera o painel completo quando autenticado
  return <DashboardContent user={session.user} onLogout={handleLogout} />
}