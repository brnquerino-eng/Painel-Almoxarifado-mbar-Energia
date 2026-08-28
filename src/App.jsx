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
  // Nova variável para saber se você já apertou o botão
  const [dadosCarregados, setDadosCarregados] = useState(false)

  const {
    data: estoqueData,
    loading: loadingEstoque,
    error: errorEstoque,
    progress: progressEstoque,
    reload: carregarEstoque // Usando a sua função nativa do hook!
  } = useEstoqueData()

  const {
    data: inventarioData,
    loading: loadingInventario,
    error: errorInventario,
    progress: progressInventario,
    reload: carregarInventario // Usando a sua função nativa do hook!
  } = useInventarioData()

  const loading = loadingEstoque || loadingInventario
  const progress = Math.round((progressEstoque * 0.7 + progressInventario * 0.3)) || 0

  // Função que o botão vai chamar
  const handleAtualizarDados = () => {
    setDadosCarregados(true)
    carregarEstoque()
    carregarInventario()
  }

  // Sua tela de carregamento original, acionada só após o clique
  if (loading && dadosCarregados) {
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

      {/* 🚀 Painel com o Botão de Carga Manual */}
      <div className="my-4 flex flex-col sm:flex-row items-center justify-between bg-[#141414] p-4 rounded-xl border border-[#2A2A2A] gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Controle Manual de Dados</h2>
          <p className="text-xs text-gray-400">O painel permanece em repouso até que você clique no botão ao lado.</p>
        </div>
        <button
          onClick={handleAtualizarDados}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md cursor-pointer text-sm flex items-center justify-center gap-2"
        >
          🔄 Carregar / Atualizar Dados
        </button>
      </div>

      {(errorEstoque || errorInventario) && (
        <div className="bg-red-900/30 border border-red-500 rounded-xl p-4 mb-6 text-sm text-red-200">
          <strong>Erro ao carregar dados:</strong>{' '}
          {errorEstoque || errorInventario}
        </div>
      )}

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Só exibe os gráficos se o botão já foi apertado alguma vez */}
      {!dadosCarregados && estoqueData.length === 0 ? (
        <div className="text-center py-20 text-gray-500 italic bg-[#111] rounded-xl border border-[#222] mt-4">
          Nenhum dado carregado. Clique no botão acima para puxar as informações, meu caro.
        </div>
      ) : (
        <div className="mt-4">
          {activeTab === 'geral' && <VisaoGeral data={estoqueData} />}
          {activeTab === 'inventarios' && (
            <PainelInventarios data={inventarioData} />
          )}
        </div>
      )}

      <footer className="mt-10 pt-4 border-t border-[#2A2A2A] text-center text-[11px] text-gray-500">
        Visão Executiva de Estoque · Âmbar Energia · React + Supabase
      </footer>
    </div>
  )
}