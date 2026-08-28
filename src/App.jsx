import { useState } from 'react'
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

  const {
    data: estoqueData,
    loading: loadingEstoque,
    error: errorEstoque,
    progress: progressEstoque,
  } = useEstoqueData()

  const {
    data: inventarioData,
    loading: loadingInventario,
    error: errorInventario,
    progress: progressInventario,
  } = useInventarioData()

  const loading = loadingEstoque || loadingInventario
  const progress =
    Math.round((progressEstoque * 0.7 + progressInventario * 0.3)) || 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] p-6 text-white">
        <Header />
        <LoadingScreen
          progress={progress}
          label="Carregando e normalizando base de dados..."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 text-white">
      <Header />

      {(errorEstoque || errorInventario) && (
        <div className="bg-red-900/30 border border-danger rounded-xl p-4 mb-6 text-sm text-red-200">
          <strong>Erro ao carregar dados:</strong>{' '}
          {errorEstoque || errorInventario}
          <p className="mt-2 text-xs text-muted">
            Verifique se as variáveis{' '}
            <code className="text-accent">VITE_SUPABASE_URL</code> e{' '}
            <code className="text-accent">VITE_SUPABASE_ANON_KEY</code> estão
            configuradas nas Secrets do StackBlitz.
          </p>
        </div>
      )}

      {/* 🚀 Barra de Abas Estilo Command Center com Glow e Ícones Vetoriais */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'geral' && <VisaoGeral data={estoqueData} />}
      {activeTab === 'inventarios' && (
        <PainelInventarios data={inventarioData} />
      )}

      <footer className="mt-10 pt-4 border-t border-[#2A2A2A] text-center text-[11px] text-muted">
        Visão Executiva de Estoque · Âmbar Energia · React + Supabase
      </footer>
    </div>
  )
}