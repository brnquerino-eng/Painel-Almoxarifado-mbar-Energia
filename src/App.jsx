import { useState, useEffect } from 'react'
import Header from './components/Header'
import Tabs from './components/Tabs'
import LoadingScreen from './components/LoadingScreen'
import VisaoGeral from './components/VisaoGeral'
import PainelInventarios from './components/PainelInventarios'
import { useEstoqueData } from './hooks/useEstoqueData'
import { useInventarioData } from './hooks/useInventarioData'

const TABS = [
  { id: 'geral', label: 'VISÃO GERAL' },
  { id: 'inventarios', label: 'PAINEL DE INVENTÁRIOS' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('geral')
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

  // Só mostra a tela preta de loading se você tiver CLICADO no botão
  if (loading && buscando) {
    return (
      <div className="min-h-screen bg-[#080808] p-6 text-white">
        <Header />
        <LoadingScreen
          progress={progress}
          label="Sincronizando e atualizando base de dados..."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 text-white">
      <Header />

      {/* 🚀 Painel de Controle com Data da Atualização */}
      <div className="my-4 flex flex-col sm:flex-row items-center justify-between bg-[#141414] p-4 rounded-xl border border-[#2A2A2A] gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Sincronização de Banco de Dados</h2>
          <p className="text-xs text-amber-500 mt-1">
            {ultimaAtualizacao 
              ? `Última atualização feita em: ${ultimaAtualizacao}` 
              : 'Os dados ainda não foram puxados do banco. Clique para sincronizar.'}
          </p>
        </div>
        <button
          onClick={handleAtualizarDados}
          disabled={loading}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md cursor-pointer text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {loading ? 'Atualizando...' : '🔄 Carregar / Atualizar Dados'}
        </button>
      </div>

      {(errorEstoque || errorInventario) && (
        <div className="bg-red-900/30 border border-red-500 rounded-xl p-4 mb-6 text-sm text-red-200">
          <strong>Erro ao carregar dados:</strong>{' '}
          {errorEstoque || errorInventario}
        </div>
      )}

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Se não tem data salva e não tem dado nenhum, avisa para clicar */}
      {!ultimaAtualizacao && estoqueData.length === 0 ? (
        <div className="text-center py-20 text-gray-500 italic bg-[#111] rounded-xl border border-[#222] mt-4">
          O cache está vazio. Clique no botão acima para puxar os dados do Supabase pela primeira vez.
        </div>
      ) : (
        <div className="mt-4">
          {activeTab === 'geral' && <VisaoGeral data={estoqueData} />}
          {activeTab === 'inventarios' && <PainelInventarios data={inventarioData} />}
        </div>
      )}

      <footer className="mt-10 pt-4 border-t border-[#2A2A2A] text-center text-[11px] text-gray-500">
        Visão Executiva de Estoque · Âmbar Energia · React + Supabase
      </footer>
    </div>
  )
}
