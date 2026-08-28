export default function Header({ ultimaAtualizacao, onAtualizar, loading }) {
  return (
    <header className="mb-6 animate-fade-in">
      <style>{`
        /* Animação do feixe de energia */
        @keyframes energyFlow {
          0% { stroke-dashoffset: 320; opacity: 0; }
          15% { opacity: 1; }
          35% { stroke-dashoffset: 0; opacity: 1; }
          45% { opacity: 0; }
          100% { stroke-dashoffset: -320; opacity: 0; }
        }
        .animate-energy {
          animation: energyFlow 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        /* Animação do Planeta recebendo a energia (Sincronizado aos 35%) */
        @keyframes planetGlow {
          0%, 25%, 55%, 100% {
            filter: drop-shadow(0 0 4px #f58220);
            color: #f58220;
          }
          35%, 45% {
            filter: drop-shadow(0 0 18px #ffaa44) brightness(1.3);
            color: #ffdeaa;
          }
        }
        .animate-planet {
          animation: planetGlow 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 px-1">
        {/* Bloco Esquerdo: Logo Escuro com Brilho Suavizado + Títulos Executivos */}
        <div className="flex items-center gap-6">
          <div className="bg-[#101010] backdrop-blur-md px-7 py-3.5 rounded-2xl text-center shadow-[0_0_15px_rgba(245,130,32,0.15)] border border-accent/30 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(245,130,32,0.3)] shrink-0 relative group">
            <span className="absolute inset-0 bg-gradient-to-tr from-accent/10 via-transparent to-transparent rounded-2xl opacity-40 group-hover:opacity-85 transition-opacity" />
            <div className="text-white font-black text-2xl leading-tight tracking-tight relative z-10 drop-shadow-md">
              Âmbar
            </div>
            <div className="text-accent text-[11px] font-extrabold tracking-[0.3em] uppercase relative z-10 drop-shadow-[0_0_6px_rgba(245,130,32,0.5)] mt-0.5">
              ENERGIA
            </div>
          </div>

          <div className="hidden sm:block h-14 w-px bg-gradient-to-b from-transparent via-accent/40 to-transparent" />

          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping shrink-0" />
              <h1 className="text-white text-lg md:text-xl font-black tracking-[0.08em] m-0 drop-shadow-md">
                VISÃO EXECUTIVA DE ESTOQUE
              </h1>
            </div>
            <p className="text-muted text-xs m-0 tracking-wide mt-1 font-medium">
              Valores Consolidados e Gestão de Inventários
            </p>
          </div>
        </div>

        {/* Espaço do Meio: Widget SVG Unificado */}
        <div className="hidden md:flex items-center justify-center flex-1 max-w-sm mx-4 relative overflow-hidden py-1">
          <svg className="w-full h-12 overflow-visible text-accent" viewBox="0 0 320 30" fill="none">
            {/* Ícone Usina */}
            <g transform="translate(2, -1) scale(1.1)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 12px #f58220)' }}>
              <path d="M2 20h20M6 20v-7c0-2 1-3 2-3s2 1 2 3v7M14 20v-9c0-2 1-3 2-3s2 1 2 3v9M2 16h20" />
            </g>
            
            {/* Linha de Energia */}
            <path
              d="M 28 15 L 70 15 L 90 4 L 110 26 L 130 10 L 150 22 L 170 15 L 273 15"
              stroke="#ffaa44"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="60 260"
              className="animate-energy"
              style={{ filter: 'drop-shadow(0 0 6px #f58220)' }}
            />
            
            {/* 🌍 Ícone do Planeta Global (O Brilho acende quando a energia chega!) */}
            <g transform="translate(275, 3) scale(1.15)" className="animate-planet" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <circle cx="12" cy="12" r="10" fill="rgba(245,130,32,0.05)" />
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </g>
          </svg>
        </div>

        {/* Lado Direito: Badge e Botão Interativo Empilhados */}
        <div className="flex flex-col items-start lg:items-end gap-2 shrink-0 self-start lg:self-center mt-2 lg:mt-0">
          
          {/* Card Sistema Ativo (Com LED pulsante realista) */}
          <div className="flex items-center gap-3 bg-[#141414] border border-[#2A2A2A] px-4 py-1.5 rounded-xl shadow-inner w-full lg:w-auto justify-center hover:border-emerald-500/20 transition-colors">
            <div className="relative flex items-center justify-center h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
            </div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest font-semibold">SISTEMA ATIVO · v2.6</span>
          </div>

          {/* 🚀 Botão Card Iluminado e Moderno */}
          <button
            onClick={onAtualizar}
            disabled={loading}
            className={`
              relative flex flex-col items-center justify-center w-full lg:w-auto px-4 py-1.5 rounded-xl border transition-all duration-300 group
              ${loading 
                ? 'bg-[#1a0f05] border-[#f58220]/50 shadow-[0_0_15px_rgba(245,130,32,0.25)] cursor-wait' 
                : 'bg-[#141414] border-[#2A2A2A] hover:bg-[#18120d] hover:border-[#f58220]/40 hover:shadow-[0_0_12px_rgba(245,130,32,0.15)] cursor-pointer'
              }
            `}
          >
            <span className="absolute inset-0 bg-gradient-to-t from-[#f58220]/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex items-center gap-2 relative z-10">
              {loading ? (
                <svg className="w-3.5 h-3.5 text-[#f58220] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-blue-400 group-hover:text-[#f58220] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              )}
              
              <span className={`text-[11px] font-extrabold tracking-[0.05em] uppercase ${loading ? 'text-[#f58220] animate-pulse' : 'text-gray-200 group-hover:text-white transition-colors'}`}>
                {loading ? 'Atualizando...' : 'Atualizar Dados'}
              </span>
            </div>

            <span className={`text-[9.5px] font-mono mt-0.5 relative z-10 transition-colors ${loading ? 'text-[#f58220]/70' : 'text-gray-500 group-hover:text-[#f58220]/80'}`}>
              {ultimaAtualizacao ? `Última: ${ultimaAtualizacao}` : 'Base pendente de carga'}
            </span>
          </button>

        </div>
      </div>

      <div className="relative mt-2">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent to-transparent h-[2px] blur-[1.5px] opacity-75" />
        <div className="relative bg-gradient-to-r from-transparent via-accent to-transparent h-[1.5px] w-full" />
      </div>
    </header>
  )
}
