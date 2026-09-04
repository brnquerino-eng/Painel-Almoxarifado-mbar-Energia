import React, { useState, useMemo, useCallback } from 'react'

export function CyberMultiSelect({ options = [], selected = [], onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    return (options || []).filter(o => String(o).toLowerCase().includes(busca.toLowerCase()))
  }, [options, busca])

  const isAllSelected = selected.length === 0 || (options.length > 0 && selected.length === options.length)

  const labelText = useMemo(() => {
    if (isAllSelected) return placeholder
    if (selected.length === 1) return selected[0]
    return `${selected.length} selecionadas`
  }, [selected, options, placeholder, isAllSelected])

  const hasActiveSelection = !isAllSelected

  const toggleOption = useCallback((opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(item => item !== opt))
    } else {
      onChange([...selected, opt])
    }
  }, [selected, onChange])

  return (
    <div className="relative">
      <div
        className={`transition-all duration-300 rounded-lg px-3 py-1.5 text-xs text-white cursor-pointer min-w-[170px] h-[34px] flex justify-between items-center group ${
          hasActiveSelection
            ? 'bg-gradient-to-r from-[#161616] via-[#1c1612] to-[#161616] border border-accent/70 shadow-[0_0_15px_rgba(245,130,32,0.22)]'
            : 'bg-[#161616] border border-[#2A2A2A] hover:border-accent/50 shadow-inner'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate max-w-[140px] font-medium tracking-wide flex items-center gap-1.5">
          {hasActiveSelection && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shadow-[0_0_8px_#f58220]" />}
          {labelText}
        </span>
        <span className={`text-[10px] transition-transform duration-300 ${hasActiveSelection ? 'text-accent font-bold' : 'text-muted group-hover:text-accent'}`}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-full left-0 mt-1.5 w-full min-w-[240px] bg-[#161616] border border-[#2A2A2A] rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.9)] z-50 flex flex-col overflow-hidden animate-fade-in p-1.5">
            <div className="p-1.5 border-b border-[#2A2A2A] bg-[#0c0c0c] rounded-lg mb-1.5 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent/80 text-[11px]">🔍</span>
              <input
                type="text"
                className="w-full bg-[#161616] border border-[#2A2A2A] rounded-md pl-7 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent focus:shadow-[0_0_8px_rgba(245,130,32,0.2)] placeholder-dark-400 font-medium transition-all"
                placeholder="Digite para buscar..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2 px-1 pb-2 border-b border-[#2A2A2A]">
              <button
                type="button"
                onClick={() => onChange([...options])}
                className="bg-[#1a1a1a] hover:bg-accent/10 hover:text-accent hover:border-accent/50 text-white text-[10px] font-bold py-2 rounded-md transition-all border border-[#2A2A2A] tracking-widest uppercase shadow-sm"
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="bg-[#1a1a1a] hover:bg-danger/10 hover:text-danger hover:border-danger/50 text-white text-[10px] font-bold py-2 rounded-md transition-all border border-[#2A2A2A] tracking-widest uppercase shadow-sm"
              >
                Limpar
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto custom-scrollbar overscroll-contain p-1 space-y-0.5 mt-1">
              {filtradas.length === 0 && <div className="text-muted text-xs p-3 text-center tracking-wide">Nenhuma opção encontrada</div>}
              {filtradas.map(opt => (
                <label key={String(opt)} className="flex items-center gap-3 px-2.5 py-2 hover:bg-[#222222] rounded-lg cursor-pointer text-xs text-white transition-colors font-medium group">
                  <input type="checkbox" className="hidden" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} />
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all shrink-0 ${selected.includes(opt) ? 'bg-accent border-accent shadow-[0_0_8px_rgba(245,130,32,0.5)]' : 'border-[#444] group-hover:border-accent/50'}`}>
                    {selected.includes(opt) && (
                      <svg className="w-2.5 h-2.5 text-[#101010]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="truncate">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}