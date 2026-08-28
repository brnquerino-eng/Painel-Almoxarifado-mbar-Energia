import clsx from 'clsx'

export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#2A2A2A] pb-4 mb-6">
      {tabs.map((tab) => {
        const isActive = active === tab.id

        // Ícones SVG vetoriais exclusivos para cada aba
        const icon = tab.id === 'geral' ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        )

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={
              isActive
                ? {
                    background: 'linear-gradient(135deg, rgba(245,130,32,0.18) 0%, rgba(22,22,22,0.9) 100%)',
                    borderColor: 'rgba(245,130,32,0.5)',
                    boxShadow: '0 0 25px rgba(245,130,32,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                  }
                : {}
            }
            className={clsx(
              'relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs tracking-wider transition-all duration-300 border',
              isActive
                ? 'text-white font-extrabold shadow-lg transform hover:scale-[1.02]'
                : 'text-[#8c9ba5] hover:text-white hover:bg-[#141414] border-[#2A2A2A]/40 bg-[#101010]'
            )}
          >
            {/* Linha de luz inferior de LED na aba ativa */}
            {isActive && (
              <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-accent shadow-[0_0_12px_#f58220] rounded-full" />
            )}

            {/* Ícone Vetorial */}
            <span className="shrink-0 transition-colors" style={{ color: isActive ? '#f58220' : '#8c9ba5' }}>
              {icon}
            </span>

            {/* Texto da Aba */}
            <span className={clsx(isActive ? 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'font-medium')}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}