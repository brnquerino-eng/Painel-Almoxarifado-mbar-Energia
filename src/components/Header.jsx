export default function Header() {
  return (
    <header className="mb-6 animate-fade-in">
      {/* Estilo local para o fluxo de energia correndo perfeitamente pelo SVG unificado */}
      <style>{`
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
      `}</style>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 px-1">
        {/* Bloco Esquerdo: Logo Escuro com Brilho Suavizado + Títulos Executivos */}
        <div className="flex items-center gap-6">
          {/* Logo com Glow Equilibrado e Sofisticado */}
          <div className="bg-[#101010] backdrop-blur-md px-7 py-3.5 rounded-2xl text-center shadow-[0_0_15px_rgba(245,130,32,0.15)] border border-accent/30 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(245,130,32,0.3)] shrink-0 relative group">
            <span className="absolute inset-0 bg-gradient-to-tr from-accent/10 via-transparent to-transparent rounded-2xl opacity-40 group-hover:opacity-85 transition-opacity" />
            <div className="text-white font-black text-2xl leading-tight tracking-tight relative z-10 drop-shadow-md">
              Âmbar
            </div>
            <div className="text-accent text-[11px] font-extrabold tracking-[0.3em] uppercase relative z-10 drop-shadow-[0_0_6px_rgba(245,130,32,0.5)] mt-0.5">
              ENERGIA
            </div>
          </div>

          {/* Divisor Vertical Gradiente Sci-Fi */}
          <div className="hidden sm:block h-14 w-px bg-gradient-to-b from-transparent via-accent/40 to-transparent" />

          {/* Título Principal com Indicador de Pulso */}
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

        {/* Espaço do Meio: Widget SVG Unificado (Usina Imponente + Feixe Encostado + Casa) */}
        <div className="hidden md:flex items-center justify-center flex-1 max-w-sm mx-4 relative overflow-hidden py-1">
          <svg className="w-full h-12 overflow-visible text-accent" viewBox="0 0 320 30" fill="none">
            
            {/* Ícone da Usina Termelétrica (Maior, Robusto e Imponente) */}
            <g transform="translate(2, -1) scale(1.1)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 12px #f58220)' }}>
              <path d="M2 20h20M6 20v-7c0-2 1-3 2-3s2 1 2 3v7M14 20v-9c0-2 1-3 2-3s2 1 2 3v9M2 16h20" />
            </g>

            {/* Feixe de energia corredor (Afinado para strokeWidth="1.5" e brilho delicado) */}
            <path
              d="M 28 15 L 70 15 L 90 4 L 110 26 L 130 10 L 150 22 L 170 15 L 292 15"
              stroke="#ffaa44"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="60 260"
              className="animate-energy"
              style={{ filter: 'drop-shadow(0 0 6px #f58220)' }}
            />

            {/* Ícone da Casa / Consumidor (Direita, Discreta e Alinhada) */}
            <g transform="translate(294, 5) scale(0.65)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px #f58220)', opacity: 0.75 }}>
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </g>

          </svg>
        </div>

        {/* Badge de Status do Sistema no Lado Direito */}
        <div className="flex items-center gap-2.5 bg-[#141414] border border-[#2A2A2A] px-4 py-2 rounded-xl shadow-inner shrink-0 self-start lg:self-center">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest font-semibold">SISTEMA ATIVO · v2.6</span>
        </div>
      </div>

      {/* Linha Inferior: Efeito Raio Laser Âmbar Luminoso */}
      <div className="relative mt-2">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent to-transparent h-[2px] blur-[1.5px] opacity-75" />
        <div className="relative bg-gradient-to-r from-transparent via-accent to-transparent h-[1.5px] w-full" />
      </div>
    </header>
  )
}