export default function Header({ ultimaAtualizacao, onAtualizar, loading, activeTab, setActiveTab }) {
  const menus = [
    { id: 'pergunte', label: 'Pergunte ao Estoque' },
    { id: 'resumo', label: 'Resumo Estoque' },
    { id: 'geral', label: 'Visão Geral' },
    { id: 'inventarios', label: 'Painel de Inventários' }
  ];

  const getMenuIcon = (id, isActive) => {
    const className = `w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-[#f58220]' : 'text-gray-400 group-hover:text-gray-300'}`;
    
    switch (id) {
      case 'pergunte':
        return (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        );
      case 'resumo':
        return (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z" />
          </svg>
        );
      case 'geral':
        return (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
        );
      case 'inventarios':
        return (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <aside className="w-72 bg-[#0c0c0c] border-r border-[#2A2A2A] flex flex-col h-screen shrink-0 relative z-20">
      {/* Topo: Logo e Título */}
      <div className="p-6 flex flex-col gap-5 border-b border-[#2A2A2A]">
        <div className="bg-[#101010] backdrop-blur-md px-6 py-4 rounded-2xl text-center shadow-[0_0_15px_rgba(245,130,32,0.1)] border border-[#f58220]/20 transition-all duration-300 hover:shadow-[0_0_20px_rgba(245,130,32,0.2)]">
          <div className="text-white font-black text-2xl leading-tight tracking-tight drop-shadow-md">
            Âmbar
          </div>
          <div className="text-[#f58220] text-[11px] font-extrabold tracking-[0.3em] uppercase drop-shadow-[0_0_6px_rgba(245,130,32,0.5)] mt-0.5">
            ENERGIA
          </div>
        </div>

        <div>
          <h1 className="text-white text-lg font-black tracking-wide m-0">
            VISÃO ESTOQUE
          </h1>
          <p className="text-gray-400 text-xs mt-1.5 font-medium">
            Gestão e Inventários
          </p>
        </div>
      </div>

      {/* Ação Principal: Botão de Atualização */}
      <div className="p-5 border-b border-[#2A2A2A] bg-[#111111]">
        <button
          onClick={onAtualizar}
          disabled={loading}
          className={`
            relative flex flex-col items-center justify-center w-full px-4 py-2.5 rounded-xl border transition-all duration-300 group
            ${loading 
              ? 'bg-[#1a0f05] border-[#f58220]/50 shadow-[0_0_15px_rgba(245,130,32,0.25)] cursor-wait' 
              : 'bg-[#141414] border-[#2A2A2A] hover:bg-[#18120d] hover:border-[#f58220]/40 hover:shadow-[0_0_12px_rgba(245,130,32,0.15)] cursor-pointer'
            }
          `}
        >
          <span className="absolute inset-0 bg-gradient-to-t from-[#f58220]/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center gap-2 relative z-10">
            {loading ? (
              <svg className="w-4 h-4 text-[#f58220] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-blue-400 group-hover:text-[#f58220] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            )}
            
            <span className={`text-[12px] font-extrabold tracking-[0.05em] uppercase ${loading ? 'text-[#f58220] animate-pulse' : 'text-gray-200 group-hover:text-white transition-colors'}`}>
              {loading ? 'Atualizando...' : 'Atualizar Dados'}
            </span>
          </div>

          <span className={`text-[10px] font-mono mt-1 relative z-10 transition-colors ${loading ? 'text-[#f58220]/70' : 'text-gray-500 group-hover:text-[#f58220]/80'}`}>
            {ultimaAtualizacao ? `Última: ${ultimaAtualizacao}` : 'Base pendente'}
          </span>
        </button>
      </div>

      {/* Menu de Navegação */}
      <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
        {menus.map((menu) => {
          const isActive = activeTab === menu.id;
          return (
            <button
              key={menu.id}
              onClick={() => setActiveTab(menu.id)}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium text-sm text-left
                ${isActive 
                  ? 'bg-[#1a0f05] text-[#f58220] shadow-[inset_4px_0_0_0_#f58220]' 
                  : 'text-gray-400 hover:bg-[#141414] hover:text-gray-200'
                }
              `}
            >
              {getMenuIcon(menu.id, isActive)}
              <span className="truncate">{menu.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Rodapé da Sidebar */}
      <div className="p-4 border-t border-[#2A2A2A] text-center">
        <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">
          Painel Estoque · v3.0
        </span>
      </div>
    </aside>
  );
}