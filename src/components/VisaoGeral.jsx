import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Plot from 'react-plotly.js'
import {
  fmtBRL,
  fmtInt,
  fmtDec,
  fmtMes,
  fmtValorCurto,
  isObsoleto,
  isObra,
  isCritico,
  periodoLabel,
  parsePeriodo,
} from '../utils/format'
import * as XLSX from 'xlsx'

const PLOT_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#8c9ba5', family: 'Inter' },
  margin: { l: 10, r: 10, t: 40, b: 45 },
  showlegend: false,
  hovermode: 'closest',
  dragmode: false,
}

const MAPA_ABR_MESES = {
  '01': 'JAN', '1': 'JAN', '02': 'FEV', '2': 'FEV', '03': 'MAR', '3': 'MAR',
  '04': 'ABR', '4': 'ABR', '05': 'MAI', '5': 'MAI', '06': 'JUN', '6': 'JUN',
  '07': 'JUL', '7': 'JUL', '08': 'AGO', '8': 'AGO', '09': 'SET', '9': 'SET',
  '10': 'OUT', '11': 'NOV', '12': 'DEZ'
}

function formatarPeriodoTexto(periodoStr) {
  if (!periodoStr) return ''
  const p = parsePeriodo(periodoStr)
  if (!p) return periodoStr
  const nomeMes = MAPA_ABR_MESES[String(p.mes).padStart(2, '0')] || p.mes
  return `${nomeMes}/${String(p.ano).slice(-2)}`
}

function formatarPeriodoElite(periodoStr, periodoEfetivo) {
  if (!periodoStr) return ''
  return formatarPeriodoTexto(periodoStr)
}

const FullScreenPortal = ({ children, onClose }) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEsc = (e) => {
      if (e.key === 'Escape' && typeof onClose === 'function') onClose()
    }
    window.addEventListener('keydown', handleEsc)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  if (!mounted) return null
  return createPortal(children, document.body)
}

const CyberMultiSelect = ({ options = [], selected = [], onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    return options
      .filter(o => String(o).toLowerCase().includes(busca.toLowerCase()))
      .filter(o => String(o).toLowerCase() !== 'todas' && String(o).toLowerCase() !== 'todos')
  }, [options, busca])

  const hasActiveSelection = selected.length > 0 && !selected.includes('Todas') && !selected.includes('Todos')

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
          {selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selecionadas`}
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

const ExecutiveCard = ({ 
  cardKey, icon, iconBg, title, value, valueAtual = null, valueAnterior = null, invertColor = false, 
  variant = 'default', valueFontSize = 'text-base lg:text-lg', alignCenter = false, paddingClass = 'p-5', 
  activeCard, onCardClick, children 
}) => {
  const isSelected = activeCard === cardKey
  const hasTrend = valueAtual != null && valueAnterior != null && valueAnterior !== 0
  const diff = hasTrend ? valueAtual - valueAnterior : 0
  const pct = hasTrend ? (diff / Math.abs(valueAnterior)) * 100 : 0
  const isPositive = pct >= 0

  const themeConfig = {
    default: {
      border: isSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612]' : 'border-[#2A2A2A] hover:border-accent/60',
      glow: isSelected ? 'shadow-[0_20px_40px_rgba(245,130,32,0.25)]' : 'hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]',
      highlight: isSelected ? 'via-accent' : 'via-accent/50',
      pill: invertColor 
        ? (isPositive ? 'bg-danger/15 text-danger border-danger/30 shadow-[0_0_10px_rgba(231,76,60,0.15)]' : 'bg-success/15 text-success border-success/30 shadow-[0_0_10px_rgba(46,204,113,0.15)]')
        : (isPositive ? 'bg-success/15 text-success border-success/30 shadow-[0_0_10px_rgba(46,204,113,0.15)]' : 'bg-danger/15 text-danger border-danger/30 shadow-[0_0_10px_rgba(231,76,60,0.15)]')
    },
    critico: {
      border: isSelected ? 'border-[#e74c3c] shadow-[0_0_25px_rgba(231,76,60,0.4)] bg-[#1c1212]' : 'border-[#2A2A2A] hover:border-[#e74c3c]/80',
      glow: isSelected ? 'shadow-[0_20px_40px_rgba(231,76,60,0.3)]' : 'hover:shadow-[0_15px_35px_rgba(231,76,60,0.25)]',
      highlight: isSelected ? 'via-[#e74c3c]' : 'via-[#e74c3c]/60',
      pill: isPositive ? 'bg-danger/15 text-danger border-danger/30 shadow-[0_0_10px_rgba(231,76,60,0.15)]' : 'bg-success/15 text-success border-success/30'
    },
    obsoleto: {
      border: isSelected ? 'border-[#9b59b6] shadow-[0_0_25px_rgba(155,89,182,0.4)] bg-[#17121c]' : 'border-[#2A2A2A] hover:border-[#9b59b6]/80',
      glow: isSelected ? 'shadow-[0_20px_40px_rgba(155,89,182,0.3)]' : 'hover:shadow-[0_15px_35px_rgba(155,89,182,0.25)]',
      highlight: isSelected ? 'via-[#9b59b6]' : 'via-[#9b59b6]/60',
      pill: isPositive ? 'bg-danger/15 text-danger border-danger/30 shadow-[0_0_10px_rgba(231,76,60,0.15)]' : 'bg-success/15 text-success border-success/30'
    },
    obra: {
      border: isSelected ? 'border-[#1abc9c] shadow-[0_0_25px_rgba(26,188,156,0.4)] bg-[#111c19]' : 'border-[#2A2A2A] hover:border-[#1abc9c]/80',
      glow: isSelected ? 'shadow-[0_20px_40px_rgba(26,188,156,0.3)]' : 'hover:shadow-[0_15px_35px_rgba(26,188,156,0.25)]',
      highlight: isSelected ? 'via-[#1abc9c]' : 'via-[#1abc9c]/60',
      pill: invertColor 
        ? (isPositive ? 'bg-danger/15 text-danger border-danger/30 shadow-[0_0_10px_rgba(231,76,60,0.15)]' : 'bg-[#1abc9c]/15 text-[#1abc9c] border-[#1abc9c]/30 shadow-[0_0_10px_rgba(26,188,156,0.15)]')
        : (isPositive ? 'bg-[#1abc9c]/15 text-[#1abc9c] border-[#1abc9c]/30 shadow-[0_0_10px_rgba(26,188,156,0.15)]' : 'bg-danger/15 text-danger border-danger/30 shadow-[0_0_10px_rgba(231,76,60,0.15)]')
    }
  }

  const cfg = themeConfig[variant] || themeConfig.default

  return (
    <div 
      onClick={() => onCardClick(cardKey)}
      className={`bg-[#161616] border ${cfg.border} rounded-2xl ${paddingClass} shadow-[0_10px_30px_rgba(0,0,0,0.85)] ${cfg.glow} transition-all duration-300 transform ${isSelected ? '-translate-y-1.5 ring-1 ring-accent/50' : 'hover:-translate-y-1'} relative overflow-hidden flex flex-col justify-between group cursor-pointer`}
    >
      {isSelected && (
        <div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span>
          </span>
        </div>
      )}

      <div className={`absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent ${cfg.highlight} to-transparent pointer-events-none`} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-inner shrink-0 ${iconBg}`}>{icon}</div>
          <span className="text-[10px] font-bold tracking-[0.18em] text-[#8c9ba5] uppercase">{title}</span>
        </div>
        {hasTrend && (
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 font-mono ${cfg.pill}`}>
            <span>{isPositive ? '▲' : '▼'}</span>
            <span>{Math.abs(pct).toFixed(1).replace('.', ',')}%</span>
          </div>
        )}
      </div>

      <div className={`mt-1 ${alignCenter ? 'flex-grow flex flex-col justify-center text-center' : ''}`}>
        <div className={`${valueFontSize} font-black text-white font-mono tracking-tight truncate drop-shadow-sm`}>{value}</div>
      </div>
      {children && <div className="mt-4 pt-3 border-t border-[#222222]">{children}</div>}
    </div>
  )
}

// --- TABELAS COMPONENTIZADAS (Com limite corrigido na navegação por teclado) ---

const TabelaMaioresValores = ({ dados }) => {
  const [indexSel, setIndexSel] = useState(null)
  const contRef = useRef(null)

  const handleKeyDown = (e) => {
    if (!dados || dados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndexSel(prev => (prev === null ? 0 : Math.min(prev + 1, dados.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndexSel(prev => (prev === null ? 0 : Math.max(prev - 1, 0)))
    }
  }

  useEffect(() => {
    if (indexSel !== null && contRef.current) {
      const row = contRef.current.querySelector(`tr[data-index="${indexSel}"]`)
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [indexSel])

  return (
    <div ref={contRef} tabIndex={0} onKeyDown={handleKeyDown} className="outline-none focus:ring-1 focus:ring-accent/40 rounded-xl w-full h-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#111111] border-b border-[#2A2A2A] sticky top-0 z-10 shadow-md">
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Unidade</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Código SKU</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Nome do Produto</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-right">Quantidade</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-right">Valor em Estoque</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222222]/50">
          {dados.length > 0 ? (
            dados.map((item, idx) => {
              const isSelected = indexSel === idx;
              return (
                <tr 
                  key={`${item.unidade}-${item.codigo}-${idx}`}
                  data-index={idx}
                  onClick={() => setIndexSel(prev => prev === idx ? null : idx)}
                  className={`cursor-pointer transition-colors group ${isSelected ? 'bg-[#2a2a2a] shadow-[inset_4px_0_0_0_#3498db]' : 'hover:bg-[#1a1a1a]'}`}
                >
                  <td className="p-3.5 text-white font-medium text-xs">{item.unidade}</td>
                  <td className="p-3.5 text-accent font-mono text-xs">{item.codigo}</td>
                  <td className="p-3.5 text-white text-xs truncate max-w-[280px]" title={item.nome}>{item.nome || '—'}</td>
                  <td className="p-3.5 text-right font-mono text-white text-xs">{Number(item.quantidade).toLocaleString('pt-BR')}</td>
                  <td className="p-3.5 text-right font-mono text-[#3498db] font-bold text-xs">{fmtBRL(item.valor)}</td>
                </tr>
              )
            })
          ) : ( <tr><td colSpan="5" className="text-center py-8 text-muted text-sm tracking-wide">Nenhum item encontrado no período selecionado.</td></tr> )}
        </tbody>
      </table>
    </div>
  )
}

const TabelaDuplicados = ({ dados }) => {
  const [indexSel, setIndexSel] = useState(null)
  const contRef = useRef(null)

  const handleKeyDown = (e) => {
    if (!dados || dados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndexSel(prev => (prev === null ? 0 : Math.min(prev + 1, dados.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndexSel(prev => (prev === null ? 0 : Math.max(prev - 1, 0)))
    }
  }

  useEffect(() => {
    if (indexSel !== null && contRef.current) {
      const row = contRef.current.querySelector(`tr[data-index="${indexSel}"]`)
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [indexSel])

  return (
    <div ref={contRef} tabIndex={0} onKeyDown={handleKeyDown} className="outline-none focus:ring-1 focus:ring-accent/40 rounded-xl w-full h-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#111111] border-b border-[#2A2A2A] sticky top-0 z-10 shadow-md">
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Nome do Produto (Agrupado por Chave)</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-center">Qtd SKUs</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Lista de SKUs</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-right">Qtd Fís.</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-right">Valor em Estoque</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222222]/50">
          {dados.length > 0 ? (
            dados.map((item, idx) => {
              const isSelected = indexSel === idx;
              return (
                <tr 
                  key={`${item.nome}-${idx}`}
                  data-index={idx}
                  onClick={() => setIndexSel(prev => prev === idx ? null : idx)}
                  className={`cursor-pointer transition-colors group ${isSelected ? 'bg-[#2a2a2a] shadow-[inset_4px_0_0_0_#f1c40f]' : 'hover:bg-[#1a1a1a]'}`}
                >
                  <td className="p-3.5 text-white font-medium text-xs max-w-[250px] truncate" title={item.nome}>{item.nome}</td>
                  <td className="p-3.5 text-center">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm border bg-[#f1c40f]/15 text-[#f1c40f] border-[#f1c40f]/30">
                      {item.qtd_skus} SKUs
                    </span>
                  </td>
                  <td className="p-3.5 text-[#f1c40f] font-mono text-[10px] max-w-[200px] truncate" title={item.skus_lista}>{item.skus_lista}</td>
                  <td className="p-3.5 text-right font-mono text-white text-xs">{Number(item.quantidade).toLocaleString('pt-BR')}</td>
                  <td className="p-3.5 text-right font-mono text-[#f1c40f] font-bold text-xs">{fmtBRL(item.valor)}</td>
                </tr>
              )
            })
          ) : ( <tr><td colSpan="5" className="text-center py-8 text-[#2ecc71] font-bold text-sm tracking-wide">🎉 Base limpa! Nenhum cadastro duplicado encontrado no período.</td></tr> )}
        </tbody>
      </table>
    </div>
  )
}

const TabelaComprasSemConsumo = ({ dados }) => {
  const [indexSel, setIndexSel] = useState(null)
  const contRef = useRef(null)

  const handleKeyDown = (e) => {
    if (!dados || dados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndexSel(prev => (prev === null ? 0 : Math.min(prev + 1, dados.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndexSel(prev => (prev === null ? 0 : Math.max(prev - 1, 0)))
    }
  }

  useEffect(() => {
    if (indexSel !== null && contRef.current) {
      const row = contRef.current.querySelector(`tr[data-index="${indexSel}"]`)
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [indexSel])

  return (
    <div ref={contRef} tabIndex={0} onKeyDown={handleKeyDown} className="outline-none focus:ring-1 focus:ring-accent/40 rounded-xl w-full h-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#111111] border-b border-[#2A2A2A] sticky top-0 z-10 shadow-md">
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Unidade</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Código SKU</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Nome do Produto</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-center">Classificação</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-right">Valor Comprado</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-right">Valor Consumido</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222222]/50">
          {dados.length > 0 ? (
            dados.map((item, idx) => {
              const isSelected = indexSel === idx;
              return (
                <tr 
                  key={`${item.unidade}-${item.codigo}-${idx}`}
                  data-index={idx}
                  onClick={() => setIndexSel(prev => prev === idx ? null : idx)}
                  className={`cursor-pointer transition-colors group ${isSelected ? 'bg-[#2a2a2a] shadow-[inset_4px_0_0_0_#e74c3c]' : 'hover:bg-[#1a1a1a]'}`}
                >
                  <td className="p-3.5 text-white font-medium text-xs">{item.unidade}</td>
                  <td className="p-3.5 text-[#e74c3c] font-mono text-xs">{item.codigo}</td>
                  <td className="p-3.5 text-white text-xs truncate max-w-[200px]" title={item.nome}>{item.nome || '—'}</td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm border transition-colors ${
                      item.categoria === 'Obsoleto' ? 'bg-[#9b59b6]/15 text-[#9b59b6] border-[#9b59b6]/30' : item.categoria === 'Crítico' ? 'bg-[#e74c3c]/15 text-[#e74c3c] border-[#e74c3c]/30' : item.categoria === 'Obra' ? 'bg-[#1abc9c]/15 text-[#1abc9c] border-[#1abc9c]/30' : 'bg-[#3498db]/15 text-[#3498db] border-[#3498db]/30'
                    }`}>{item.categoria}</span>
                  </td>
                  <td className="p-3.5 text-right font-mono text-[#e74c3c] font-bold text-xs">{fmtBRL(item.comprado)}</td>
                  <td className="p-3.5 text-right font-mono text-muted font-bold text-xs">R$ 0,00</td>
                </tr>
              )
            })
          ) : ( <tr><td colSpan="6" className="text-center py-8 text-[#2ecc71] font-bold text-sm tracking-wide">🎉 Nenhum item! Toda compra registrada neste mês teve movimentação de consumo.</td></tr> )}
        </tbody>
      </table>
    </div>
  )
}

const TabelaCyberpunk = ({ dados }) => {
  const [indexSel, setIndexSel] = useState(null)
  const contRef = useRef(null)

  const handleKeyDown = (e) => {
    if (!dados || dados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndexSel(prev => (prev === null ? 0 : Math.min(prev + 1, dados.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndexSel(prev => (prev === null ? 0 : Math.max(prev - 1, 0)))
    }
  }

  useEffect(() => {
    if (indexSel !== null && contRef.current) {
      const row = contRef.current.querySelector(`tr[data-index="${indexSel}"]`)
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [indexSel])

  return (
    <div ref={contRef} tabIndex={0} onKeyDown={handleKeyDown} className="outline-none focus:ring-1 focus:ring-accent/40 rounded-xl w-full h-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#111111] border-b border-[#2A2A2A] sticky top-0 z-10 shadow-md">
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Unidade</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Código SKU</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider">Nome do Produto</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-right">Quantidade</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-right">Valor Parado</th>
            <th className="p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider text-center">Meses Parado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222222]/50">
          {dados.length > 0 ? (
            dados.map((item, idx) => {
              const isSelected = indexSel === idx;
              return (
                <tr 
                  key={`${item.unidade}-${item.codigo}-${item.mesesParado}-${idx}`}
                  data-index={idx}
                  onClick={() => setIndexSel(prev => prev === idx ? null : idx)}
                  className={`cursor-pointer transition-colors group ${isSelected ? 'bg-[#2a2a2a] shadow-[inset_4px_0_0_0_#f58220]' : 'hover:bg-[#1a1a1a]'}`}
                >
                  <td className="p-3.5 text-white font-medium text-xs">{item.unidade}</td>
                  <td className="p-3.5 text-accent font-mono text-xs">{item.codigo}</td>
                  <td className="p-3.5 text-white text-xs truncate max-w-[280px]" title={item.nome}>{item.nome || '—'}</td>
                  <td className="p-3.5 text-right font-mono text-white text-xs">{Number(item.quantidade).toLocaleString('pt-BR')}</td>
                  <td className="p-3.5 text-right font-mono text-[#2ecc71] font-bold text-xs">{fmtBRL(item.valor)}</td>
                  <td className="p-3.5 text-center">
                    <span className="px-2.5 py-1 rounded-md bg-[#2A1610] text-[#f58220] border border-[#f58220]/30 text-[10px] font-bold shadow-sm group-hover:bg-[#f58220]/15 transition-colors">{item.mesesParado} Meses</span>
                  </td>
                </tr>
              )
            })
          ) : ( <tr><td colSpan="6" className="text-center py-8 text-muted text-sm tracking-wide">Nenhum item encontrado.</td></tr> )}
        </tbody>
      </table>
    </div>
  )
}

// --- COMPONENTE PRINCIPAL ---

export default function VisaoGeral({ data }) {
  const [escoposSel, setEscoposSel] = useState(['Ativa'])
  const [unidadesSel, setUnidadesSel] = useState([])
  const [anosSel, setAnosSel] = useState([])
  
  // Novo Filtro Global de Tipo de Estoque
  const [tiposEstoqueSel, setTiposEstoqueSel] = useState(['Todos'])
  
  const [periodoAtivo, setPeriodoAtivo] = useState(null)
  const [activeCard, setActiveCard] = useState(null)
  
  const [selectedBarraRanking, setSelectedBarraRanking] = useState(null)
  const [selectedFatiaComposicao, setSelectedFatiaComposicao] = useState(null)
  const [selectedBarraCritico, setSelectedBarraCritico] = useState(null)
  const [selectedBarraObsoleto, setSelectedBarraObsoleto] = useState(null)
  const [selectedBarraObra, setSelectedBarraObra] = useState(null)
  const [selectedBarraCompraConsumo, setSelectedBarraCompraConsumo] = useState(null)
  const [selectedBarraSkus, setSelectedBarraSkus] = useState(null)

  const [filtroMesParado, setFiltroMesParado] = useState(null)
  const [abaSkus, setAbaSkus] = useState('unicos')
  
  const [listaAberta, setListaAberta] = useState(false)
  const [tabelaUnidadesSel, setTabelaUnidadesSel] = useState([])
  const [tabelaMesesSel, setTabelaMesesSel] = useState([])
  const [tabelaExpandida, setTabelaExpandida] = useState(false)

  const [listaMaioresValoresAberta, setListaMaioresValoresAberta] = useState(false)
  const [tabelaMaioresValoresExpandida, setTabelaMaioresValoresExpandida] = useState(false)

  const [listaComprasSemConsumoAberta, setListaComprasSemConsumoAberta] = useState(false)
  const [tabelaComprasSemConsumoExpandida, setTabelaComprasSemConsumoExpandida] = useState(false)
  
  const [listaDuplicadosAberta, setListaDuplicadosAberta] = useState(false)
  const [tabelaDuplicadosExpandida, setTabelaDuplicadosExpandida] = useState(false)

  const [vis, setVis] = useState({ total: true, critico: false, obsoleto: false, obra: false })
  const [visComprasConsumo, setVisComprasConsumo] = useState({ compras: true, consumo: true })
  const [visGiroCobertura, setVisGiroCobertura] = useState({ giro: true, cobertura: true })

  const handleCardClick = useCallback((key) => setActiveCard(prev => prev === key ? null : key), [])

  const { unidadesOpcoes, unidadesAtivas, unidadesGerenciais, anoOpcoes } = useMemo(() => {
    if (!data || data.length === 0) return { unidadesOpcoes: [], unidadesAtivas: [], unidadesGerenciais: [], anoOpcoes: [] }
    const uniques = [...new Set(data.map((r) => r.unidade_almoxarifado).filter(Boolean))].sort()
    const ativas = uniques.filter((u) => !u.includes('GERENCIAL'))
    const gerenciais = uniques.filter((u) => u.includes('GERENCIAL'))
    const anos = [...new Set(data.map((r) => r.ano_referencia).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
    return { unidadesOpcoes: uniques, unidadesAtivas: ativas, unidadesGerenciais: gerenciais, anoOpcoes: anos }
  }, [data])

  useEffect(() => {
    if (anoOpcoes.length > 0 && anosSel.length === 0) setAnosSel([anoOpcoes[anoOpcoes.length - 1]])
  }, [anoOpcoes])

  const opcoesUnid = useMemo(() => {
    if (escoposSel.includes('Todas') || escoposSel.length === 0) return unidadesOpcoes
    let allowed = []
    if (escoposSel.includes('Ativa')) allowed = [...allowed, ...unidadesAtivas]
    if (escoposSel.includes('Gerencial')) allowed = [...allowed, ...unidadesGerenciais]
    return [...new Set(allowed)].sort()
  }, [escoposSel, unidadesOpcoes, unidadesAtivas, unidadesGerenciais])

  const dfFiltrado = useMemo(() => {
    let df = data || []
    
    // Filtro de Escopo e Unidade
    if (!escoposSel.includes('Todas') && escoposSel.length > 0) {
      let allowed = []
      if (escoposSel.includes('Ativa')) allowed = [...allowed, ...unidadesAtivas]
      if (escoposSel.includes('Gerencial')) allowed = [...allowed, ...unidadesGerenciais]
      df = df.filter(r => allowed.includes(r.unidade_almoxarifado))
    }
    if (unidadesSel.length > 0) df = df.filter((r) => unidadesSel.includes(r.unidade_almoxarifado))
    if (anosSel.length > 0) df = df.filter((r) => anosSel.includes(r.ano_referencia))
    
    // Filtro Global de Tipo de Estoque (Cascade para todo o painel)
    if (tiposEstoqueSel.length > 0 && !tiposEstoqueSel.includes('Todos')) {
      df = df.filter(r => {
        const isCrit = isCritico(r.item_critico);
        const isObs = isObsoleto(r.nome_local_estoque);
        const isObr = isObra(r.nome_local_estoque);
        const isOp = !isCrit && !isObs && !isObr;

        return (
          (tiposEstoqueSel.includes('Crítico') && isCrit) ||
          (tiposEstoqueSel.includes('Obsoleto') && isObs) ||
          (tiposEstoqueSel.includes('Obra') && isObr) ||
          (tiposEstoqueSel.includes('Operacional') && isOp)
        );
      })
    }

    return df
  }, [data, escoposSel, unidadesSel, anosSel, unidadesAtivas, unidadesGerenciais, tiposEstoqueSel])

  const periodoMaximo = useMemo(() => {
    const source = dfFiltrado.length ? dfFiltrado : (data || [])
    if (!source.length) return '01/2026'
    let maxAno = 0, maxMes = 0
    for (const r of source) {
      if (r.tmp_ano_num > maxAno || (r.tmp_ano_num === maxAno && r.tmp_mes_num > maxMes)) {
        maxAno = r.tmp_ano_num
        maxMes = r.tmp_mes_num
      }
    }
    if (!maxAno) return '01/2026'
    return periodoLabel(maxMes, maxAno)
  }, [dfFiltrado, data])

  const periodoEfetivo = periodoAtivo || periodoMaximo

  const { snapshot, snapshotPrev } = useMemo(() => {
    const p = parsePeriodo(periodoEfetivo)
    if (!p || !dfFiltrado.length) return { snapshot: [], snapshotPrev: [] }
    const snap = dfFiltrado.filter((r) => r.tmp_ano_num === p.ano && r.tmp_mes_num === p.mes)
    let mPrev = p.mes - 1, aPrev = p.ano
    if (mPrev === 0) { mPrev = 12; aPrev -= 1 }
    const snapPrev = dfFiltrado.filter((r) => r.tmp_ano_num === aPrev && r.tmp_mes_num === mPrev)
    return { snapshot: snap, snapshotPrev: snapPrev }
  }, [dfFiltrado, periodoEfetivo])

  // --- LÓGICA: MAIORES VALORES DE ESTOQUE ---
  const maioresValoresDataCompleta = useMemo(() => {
    if (!snapshot.length) return []
    return [...snapshot]
      .filter(r => (r.valor_saldo_atual || 0) > 0)
      .sort((a, b) => (b.valor_saldo_atual || 0) - (a.valor_saldo_atual || 0))
      .map(r => ({ unidade: r.unidade_almoxarifado, codigo: r.codigo_produto, nome: r.nome_produto, quantidade: r.qtde_saldo_atual || 0, valor: r.valor_saldo_atual || 0 }))
  }, [snapshot])

  const maioresValoresTabela = useMemo(() => {
    return tabelaMaioresValoresExpandida ? maioresValoresDataCompleta.slice(0, 1000) : maioresValoresDataCompleta.slice(0, 12)
  }, [maioresValoresDataCompleta, tabelaMaioresValoresExpandida])

  const exportarExcelMaioresValores = useCallback(() => {
    if (!maioresValoresDataCompleta.length) return
    const wsData = maioresValoresDataCompleta.map(item => ({
      'Unidade': item.unidade,
      'Código SKU': item.codigo,
      'Nome do Produto': item.nome,
      'Quantidade': item.quantidade,
      'Valor em Estoque (R$)': item.valor,
      'Período': formatarPeriodoTexto(periodoEfetivo)
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Maiores Valores')
    XLSX.writeFile(wb, `maiores_valores_estoque_${formatarPeriodoTexto(periodoEfetivo).replace('/', '-')}.xlsx`)
  }, [maioresValoresDataCompleta, periodoEfetivo])

  // --- LÓGICA: CADASTROS DUPLICADOS COM MÉTRICA DE CHAVES ---
  const duplicadosDataCompleta = useMemo(() => {
    if (!snapshot.length) return []

    const mapChaves = new Map()
    for (const r of snapshot) {
      if (!r.nome_produto) continue
      
      const nomeUpper = r.nome_produto.trim().replace(/\s+/g, ' ').toUpperCase()
      const palavras = nomeUpper.split(' ').filter(Boolean)
      palavras.sort()
      const chaveGerada = palavras.join(' ')

      if (!mapChaves.has(chaveGerada)) {
        mapChaves.set(chaveGerada, {
          nomeExemplo: r.nome_produto,
          skus: new Set(),
          unidades: new Set(),
          quantidade: 0,
          valor: 0
        })
      }
      const item = mapChaves.get(chaveGerada)
      if (r.codigo_produto) item.skus.add(r.codigo_produto)
      item.unidades.add(r.unidade_almoxarifado)
      item.quantidade += (r.qtde_saldo_atual || 0)
      item.valor += (r.valor_saldo_atual || 0)
    }

    const duplicados = []
    for (const dados of mapChaves.values()) {
      if (dados.skus.size > 1) {
        duplicados.push({
          nome: dados.nomeExemplo,
          qtd_skus: dados.skus.size,
          skus_lista: Array.from(dados.skus).join(', '),
          unidades_lista: Array.from(dados.unidades).join(', '),
          quantidade: dados.quantidade,
          valor: dados.valor
        })
      }
    }
    return duplicados.sort((a, b) => b.valor - a.valor)
  }, [snapshot])

  const duplicadosTabela = useMemo(() => {
    return tabelaDuplicadosExpandida ? duplicadosDataCompleta.slice(0, 1000) : duplicadosDataCompleta.slice(0, 12)
  }, [duplicadosDataCompleta, tabelaDuplicadosExpandida])

  const exportarExcelDuplicados = useCallback(() => {
    if (!duplicadosDataCompleta.length) return
    const wsData = duplicadosDataCompleta.map(item => ({
      'Nome do Produto': item.nome,
      'Qtd SKUs Diferentes': item.qtd_skus,
      'Códigos SKUs': item.skus_lista,
      'Unidades Afetadas': item.unidades_lista,
      'Quantidade Total': item.quantidade,
      'Valor Imobilizado (R$)': item.valor,
      'Período': formatarPeriodoTexto(periodoEfetivo)
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Cadastros Duplicados')
    XLSX.writeFile(wb, `cadastros_duplicados_${formatarPeriodoTexto(periodoEfetivo).replace('/', '-')}.xlsx`)
  }, [duplicadosDataCompleta, periodoEfetivo])

  // --- LÓGICA: COMPRAS SEM CONSUMO ---
  const comprasSemConsumoDataCompleta = useMemo(() => {
    if (!snapshot.length) return []
    return [...snapshot]
      .filter(r => (r.valor_entrada_compras || 0) > 0 && Math.abs(r.valor_saida_cons_interno || 0) === 0)
      .sort((a, b) => (b.valor_entrada_compras || 0) - (a.valor_entrada_compras || 0))
      .map(r => {
        let categoria = 'Operacional'
        if (isObsoleto(r.nome_local_estoque)) categoria = 'Obsoleto'
        else if (isObra(r.nome_local_estoque)) categoria = 'Obra'
        else if (isCritico(r.item_critico)) categoria = 'Crítico'
        return { unidade: r.unidade_almoxarifado, codigo: r.codigo_produto, nome: r.nome_produto, categoria, comprado: r.valor_entrada_compras || 0 }
      })
  }, [snapshot])

  const comprasSemConsumoTabela = useMemo(() => {
    return tabelaComprasSemConsumoExpandida ? comprasSemConsumoDataCompleta.slice(0, 1000) : comprasSemConsumoDataCompleta.slice(0, 12)
  }, [comprasSemConsumoDataCompleta, tabelaComprasSemConsumoExpandida])

  const exportarExcelComprasSemConsumo = useCallback(() => {
    if (!comprasSemConsumoDataCompleta.length) return
    const wsData = comprasSemConsumoDataCompleta.map(item => ({
      'Unidade': item.unidade,
      'Código SKU': item.codigo,
      'Nome do Produto': item.nome,
      'Classificação': item.categoria,
      'Valor Comprado (R$)': item.comprado,
      'Valor Consumido (R$)': 0,
      'Período': formatarPeriodoTexto(periodoEfetivo)
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Compras s/ Consumo')
    XLSX.writeFile(wb, `compras_sem_consumo_${formatarPeriodoTexto(periodoEfetivo).replace('/', '-')}.xlsx`)
  }, [comprasSemConsumoDataCompleta, periodoEfetivo])

  const timeSeriesAgg = useMemo(() => {
    const map = new Map()
    for (const r of dfFiltrado) {
      const key = `${r.tmp_ano_num}-${String(r.tmp_mes_num).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, { periodo: periodoLabel(r.tmp_mes_num, r.ano_referencia), ano: r.tmp_ano_num, mes: r.tmp_mes_num, total: 0, critico: 0, obsoleto: 0, obra: 0, compras: 0, consumo: 0, skus: new Set(), chavesMap: new Map() })
      const item = map.get(key)
      const val = r.valor_saldo_atual || 0
      item.total += val
      if (isCritico(r.item_critico)) item.critico += val
      if (isObsoleto(r.nome_local_estoque)) item.obsoleto += val
      if (isObra(r.nome_local_estoque)) item.obra += val
      item.compras += r.valor_entrada_compras || 0
      item.consumo += Math.abs(r.valor_saida_cons_interno || 0)
      
      if (r.qtde_saldo_atual > 0 && r.codigo_produto) {
        item.skus.add(r.codigo_produto)
        
        if (r.nome_produto) {
          const nomeUpper = r.nome_produto.trim().replace(/\s+/g, ' ').toUpperCase()
          const palavras = nomeUpper.split(' ').filter(Boolean)
          palavras.sort()
          const chave = palavras.join(' ')
          if (!item.chavesMap.has(chave)) item.chavesMap.set(chave, new Set())
          item.chavesMap.get(chave).add(r.codigo_produto)
        }
      }
    }
    const sorted = [...map.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    return {
      total: sorted.map(d => ({ periodo: d.periodo, valor: d.total })),
      critico: sorted.map(d => ({ periodo: d.periodo, valor: d.critico })),
      obsoleto: sorted.map(d => ({ periodo: d.periodo, valor: d.obsoleto })),
      obra: sorted.map(d => ({ periodo: d.periodo, valor: d.obra })),
      comprasConsumo: sorted.map(d => ({ periodo: d.periodo, compras: d.compras, consumo: d.consumo })),
      skus: sorted.map(d => {
        let skusDupCount = 0;
        for (const skusSet of d.chavesMap.values()) {
          if (skusSet.size > 1) {
            skusDupCount += skusSet.size;
          }
        }
        return { periodo: d.periodo, total: d.skus.size, duplicados: skusDupCount }
      })
    }
  }, [dfFiltrado])

  const sum = (arr, key) => arr.reduce((s, r) => s + (r[key] || 0), 0)

  const metrics = useMemo(() => {
    const valEstoque = sum(snapshot, 'valor_saldo_atual')
    const valCompras = sum(snapshot, 'valor_entrada_compras')
    const valConsumo = snapshot.reduce((s, r) => s + Math.abs(r.valor_saida_cons_interno || 0), 0)
    const valSkus = new Set(snapshot.filter((r) => r.qtde_saldo_atual > 0 && r.codigo_produto).map((r) => r.codigo_produto)).size
    const valCritico = sum(snapshot.filter((r) => isCritico(r.item_critico)), 'valor_saldo_atual')
    const valObsoleto = sum(snapshot.filter((r) => isObsoleto(r.nome_local_estoque)), 'valor_saldo_atual')
    const valObra = sum(snapshot.filter((r) => isObra(r.nome_local_estoque)), 'valor_saldo_atual')

    const valEstoquePrev = sum(snapshotPrev, 'valor_saldo_atual')
    const valComprasPrev = sum(snapshotPrev, 'valor_entrada_compras')
    const valConsumoPrev = snapshotPrev.reduce((s, r) => s + Math.abs(r.valor_saida_cons_interno || 0), 0)
    const valSkusPrev = new Set(snapshotPrev.filter((r) => r.qtde_saldo_atual > 0 && r.codigo_produto).map((r) => r.codigo_produto)).size
    const valCriticoPrev = sum(snapshotPrev.filter((r) => isCritico(r.item_critico)), 'valor_saldo_atual')
    const valObsoletoPrev = sum(snapshotPrev.filter((r) => isObsoleto(r.nome_local_estoque)), 'valor_saldo_atual')
    const valObraPrev = sum(snapshotPrev.filter((r) => isObra(r.nome_local_estoque)), 'valor_saldo_atual')

    return { valEstoque, valCompras, valConsumo, valSkus, valCritico, valObsoleto, valObra, valEstoquePrev, valComprasPrev, valConsumoPrev, valSkusPrev, valCriticoPrev, valObsoletoPrev, valObraPrev }
  }, [snapshot, snapshotPrev])

  const { giroMensal, giroAnual, coberturaMeses, coberturaAnos, giroMensalPrev, coberturaMesesPrev, monthlyRaw } =
    useMemo(() => {
      const empty = { giroMensal: 0, giroAnual: 0, coberturaMeses: 0, coberturaAnos: 0, giroMensalPrev: 0, coberturaMesesPrev: 0, monthlyRaw: [] }
      if (!dfFiltrado.length) return empty
      const p = parsePeriodo(periodoEfetivo)
      if (!p) return empty
      const map = new Map()
      for (const r of dfFiltrado) {
        const key = `${r.tmp_ano_num}-${r.tmp_mes_num}`
        if (!map.has(key)) map.set(key, { ano: r.tmp_ano_num, mes: r.tmp_mes_num, estoque_op: 0, consumo_op: 0 })
        const item = map.get(key)
        if (!isCritico(r.item_critico) && !isObsoleto(r.nome_local_estoque)) {
          item.estoque_op += r.valor_saldo_atual || 0
          item.consumo_op += Math.abs(r.valor_saida_cons_interno || 0)
        }
      }
      const monthly = [...map.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes)
      const subAtual = monthly.filter((m) => m.ano === p.ano && m.mes <= p.mes)
      
      let giroMensal = 0, giroAnual = 0, coberturaMeses = 0, coberturaAnos = 0
      if (subAtual.length) {
        const estMed = subAtual.reduce((s, m) => s + m.estoque_op, 0) / subAtual.length
        const conMed = subAtual.reduce((s, m) => s + m.consumo_op, 0) / subAtual.length
        if (estMed > 0) { giroMensal = conMed / estMed; giroAnual = giroMensal * 12 }
        if (conMed > 0) { coberturaMeses = estMed / conMed; coberturaAnos = coberturaMeses / 12 }
      }
      const mTetoPrev = p.mes > 1 ? p.mes - 1 : 12, anoPrev = p.mes > 1 ? p.ano : p.ano - 1
      const subPrev = monthly.filter((m) => m.ano === anoPrev && m.mes <= mTetoPrev)
      let giroMensalPrev = 0, coberturaMesesPrev = 0
      if (subPrev.length) {
        const estMedP = subPrev.reduce((s, m) => s + m.estoque_op, 0) / subPrev.length
        const conMedP = subPrev.reduce((s, m) => s + m.consumo_op, 0) / subPrev.length
        if (estMedP > 0) giroMensalPrev = conMedP / estMedP
        if (conMedP > 0) coberturaMesesPrev = estMedP / conMedP
      }
      return { giroMensal, giroAnual, coberturaMeses, coberturaAnos, giroMensalPrev, coberturaMesesPrev, monthlyRaw: monthly }
    }, [dfFiltrado, periodoEfetivo])

  const giroCoberturaTempo = useMemo(() => {
    if (!monthlyRaw.length) return []
    return monthlyRaw.map((row) => {
      const sub = monthlyRaw.filter((m) => m.ano === row.ano && m.mes <= row.mes)
      const estMed = sub.reduce((s, m) => s + m.estoque_op, 0) / sub.length
      const conMed = sub.reduce((s, m) => s + m.consumo_op, 0) / sub.length
      return { periodo: periodoLabel(row.mes, row.ano), giro: estMed > 0 ? conMed / estMed : 0, cobertura: conMed > 0 ? estMed / conMed : 0 }
    })
  }, [monthlyRaw])

  const { rankingUnidade, rankCritico, rankObsoleto, rankObra, compraConsumoUnidade, skusUnidade, composicao } = useMemo(() => {
    const mapRank = new Map(), mapCrit = new Map(), mapObs = new Map(), mapObra = new Map(), mapCC = new Map(), mapSkus = new Map()
    let valObs = 0, valObr = 0, valCri = 0

    for (const r of snapshot) {
      const u = r.unidade_almoxarifado
      const val = r.valor_saldo_atual || 0
      mapRank.set(u, (mapRank.get(u) || 0) + val)
      
      const isCrit = isCritico(r.item_critico)
      const isObs = isObsoleto(r.nome_local_estoque)
      const isObr = isObra(r.nome_local_estoque)
      
      if (isObs) {
        mapObs.set(u, (mapObs.get(u) || 0) + val)
        valObs += val
      } else if (isObr) {
        mapObra.set(u, (mapObra.get(u) || 0) + val)
        valObr += val
      } else if (isCrit) {
        mapCrit.set(u, (mapCrit.get(u) || 0) + val)
        valCri += val
      }

      if (!mapCC.has(u)) mapCC.set(u, { unidade: u, compras: 0, consumo: 0 })
      mapCC.get(u).compras += r.valor_entrada_compras || 0
      mapCC.get(u).consumo += Math.abs(r.valor_saida_cons_interno || 0)

      if (r.qtde_saldo_atual > 0 && r.codigo_produto) {
        if (!mapSkus.has(u)) mapSkus.set(u, new Set())
        mapSkus.get(u).add(r.codigo_produto)
      }
    }

    const valOp = Math.max(0, metrics.valEstoque - (valObs + valObr + valCri))
    const comp = [
      { name: 'Estoque Crítico', value: valCri, color: '#e74c3c' },
      { name: 'Estoque Obsoleto', value: valObs, color: '#9b59b6' },
      { name: 'Estoque Obra', value: valObr, color: '#1abc9c' },
      { name: 'Estoque Operacional', value: valOp, color: '#3498db' },
    ].filter((d) => d.value > 0)

    const mapToSort = (m) => [...m.entries()].filter(([, v]) => v > 0).map(([unidade, valor]) => ({ unidade, valor })).sort((a, b) => a.valor - b.valor)
    
    return {
      rankingUnidade: mapToSort(mapRank),
      rankCritico: mapToSort(mapCrit),
      rankObsoleto: mapToSort(mapObs),
      rankObra: mapToSort(mapObra),
      compraConsumoUnidade: [...mapCC.values()].filter((d) => d.compras > 0.01 || d.consumo > 0.01).sort((a, b) => a.compras - b.compras),
      skusUnidade: [...mapSkus.entries()].map(([unidade, set]) => ({ unidade, total: set.size })).sort((a, b) => a.total - b.total),
      composicao: comp
    }
  }, [snapshot, metrics.valEstoque])

  const itensParados = useMemo(() => {
    const p = parsePeriodo(periodoEfetivo)
    if (!p || !dfFiltrado.length) return []
    const snapshotIdx = p.ano * 12 + p.mes
    const calc = dfFiltrado
      .filter((r) => r.tmp_ano_num * 12 + r.tmp_mes_num <= snapshotIdx && !isCritico(r.item_critico) && !isObsoleto(r.nome_local_estoque))
      .map((r) => ({ ...r, tempo_idx: r.tmp_ano_num * 12 + r.tmp_mes_num }))
    
    const ultimoMov = new Map(), primeiroHist = new Map()
    for (const r of calc) {
      const key = `${r.unidade_almoxarifado}||${r.codigo_produto}`
      if (Math.abs(r.valor_saida_cons_interno || 0) > 0) {
        if (r.tempo_idx > (ultimoMov.get(key) || 0)) ultimoMov.set(key, r.tempo_idx)
      }
      if (r.tempo_idx < (primeiroHist.get(key) ?? Infinity)) primeiroHist.set(key, r.tempo_idx)
    }

    const snapAtual = calc.filter((r) => r.tmp_ano_num === p.ano && r.tmp_mes_num === p.mes && r.qtde_saldo_atual > 0 && r.codigo_produto)
    const result = []
    
    for (const r of snapAtual) {
      const key = `${r.unidade_almoxarifado}||${r.codigo_produto}`
      let ultimo = ultimoMov.get(key)
      if (ultimo == null) {
        const prim = primeiroHist.get(key)
        ultimo = prim != null ? prim - 1 : snapshotIdx
      }
      const mesesParado = snapshotIdx - ultimo
      if (mesesParado >= 3) {
        result.push({
          unidade: r.unidade_almoxarifado,
          codigo: r.codigo_produto,
          nome: r.nome_produto,
          quantidade: r.qtde_saldo_atual,
          valor: r.valor_saldo_atual,
          mesesParado
        })
      }
    }
    return result
  }, [dfFiltrado, periodoEfetivo])

  const unidadesParadasOpcoes = useMemo(() => [...new Set(itensParados.map(i => i.unidade))].filter(Boolean).sort(), [itensParados])
  const mesesParadosOpcoes = useMemo(() => [...new Set(itensParados.map(i => i.mesesParado))].sort((a, b) => a - b).map(String), [itensParados])

  const paradosChart = useMemo(() => {
    const map = new Map()
    for (const item of itensParados) {
      const m = item.mesesParado
      if (!map.has(m)) map.set(m, { meses: m, label: `${m} Meses`, valor: 0, skus: 0 })
      const obj = map.get(m)
      obj.valor += item.valor
      obj.skus += 1
    }
    return [...map.values()].sort((a, b) => a.meses - b.meses)
  }, [itensParados])

  const itensParadosFiltradosTabela = useMemo(() => {
    let lista = [...itensParados]
    if (filtroMesParado) lista = lista.filter(item => item.mesesParado === filtroMesParado)
    if (tabelaMesesSel.length > 0 && !tabelaMesesSel.includes('Todos')) lista = lista.filter(item => tabelaMesesSel.includes(String(item.mesesParado)))
    if (tabelaUnidadesSel.length > 0 && !tabelaUnidadesSel.includes('Todas')) lista = lista.filter(item => tabelaUnidadesSel.includes(item.unidade))
    lista.sort((a, b) => b.valor - a.valor)
    return tabelaExpandida ? lista.slice(0, 1000) : lista.slice(0, 50)
  }, [itensParados, filtroMesParado, tabelaMesesSel, tabelaUnidadesSel, tabelaExpandida])

  const itensParadosParaExportar = useMemo(() => {
    let lista = [...itensParados]
    if (filtroMesParado) lista = lista.filter(item => item.mesesParado === filtroMesParado)
    if (tabelaMesesSel.length > 0 && !tabelaMesesSel.includes('Todos')) lista = lista.filter(item => tabelaMesesSel.includes(String(item.mesesParado)))
    if (tabelaUnidadesSel.length > 0 && !tabelaUnidadesSel.includes('Todas')) lista = lista.filter(item => tabelaUnidadesSel.includes(item.unidade))
    return lista.sort((a, b) => b.valor - a.valor)
  }, [itensParados, filtroMesParado, tabelaMesesSel, tabelaUnidadesSel])

  const exportarExcelParados = useCallback(() => {
    if (!itensParadosParaExportar.length) return
    const wsData = itensParadosParaExportar.map(item => ({
      Unidade: item.unidade,
      'Código SKU': item.codigo,
      'Nome do Produto': item.nome,
      Quantidade: item.quantidade,
      'Valor Parado (R$)': item.valor,
      'Meses Inativo': item.mesesParado
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Materiais Parados')
    XLSX.writeFile(wb, 'materiais_parados_completo.xlsx')
  }, [itensParadosParaExportar])

  const toggleVis = useCallback((key) => setVis((v) => ({ ...v, [key]: !v[key] })), [])
  const toggleVisComprasConsumo = useCallback((key) => setVisComprasConsumo((v) => ({ ...v, [key]: !v[key] })), [])
  const toggleVisGiroCobertura = useCallback((key) => setVisGiroCobertura((v) => ({ ...v, [key]: !v[key] })), [])

  const handleChartClick = useCallback((event) => {
    if (event?.points?.[0]?.x) setPeriodoAtivo(event.points[0].x)
  }, [])

  const maxValorGlobal = useMemo(() => {
    let m = 10 
    if (vis.total) m = Math.max(m, ...timeSeriesAgg.total.map(d => d.valor))
    if (vis.critico) m = Math.max(m, ...timeSeriesAgg.critico.map(d => d.valor))
    if (vis.obsoleto) m = Math.max(m, ...timeSeriesAgg.obsoleto.map(d => d.valor))
    if (vis.obra) m = Math.max(m, ...timeSeriesAgg.obra.map(d => d.valor))
    return m > 0 ? m : 10
  }, [vis, timeSeriesAgg])

  const chartShapes = useMemo(() => {
    if (!periodoEfetivo || !timeSeriesAgg.total.length) return []
    const index = timeSeriesAgg.total.findIndex((d) => d.periodo === periodoEfetivo)
    if (index === -1) return []
    return [
      { type: 'line', xref: 'x', yref: 'paper', x0: index, x1: index, y0: 0, y1: 1, line: { color: '#f58220', width: 1.5, dash: 'dot' }, layer: 'below' },
      { type: 'rect', xref: 'x', yref: 'paper', x0: index - 0.15, x1: index + 0.15, y0: 0, y1: 1, fillcolor: 'rgba(245, 130, 32, 0.08)', line: { width: 0 }, layer: 'below' },
    ]
  }, [timeSeriesAgg.total, periodoEfetivo])

  const chartShapesSkus = useMemo(() => {
    if (!periodoEfetivo || !timeSeriesAgg.skus.length) return []
    const index = timeSeriesAgg.skus.findIndex((d) => d.periodo === periodoEfetivo)
    if (index === -1) return []
    const color = abaSkus === 'duplicados' ? '#f1c40f' : '#f58220'
    return [
      { type: 'line', xref: 'x', yref: 'paper', x0: index, x1: index, y0: 0, y1: 1, line: { color: color, width: 1.5, dash: 'dot' }, layer: 'below' },
      { type: 'rect', xref: 'x', yref: 'paper', x0: index - 0.15, x1: index + 0.15, y0: 0, y1: 1, fillcolor: abaSkus === 'duplicados' ? 'rgba(241, 196, 15, 0.08)' : 'rgba(245, 130, 32, 0.08)', line: { width: 0 }, layer: 'below' },
    ]
  }, [timeSeriesAgg.skus, periodoEfetivo, abaSkus])

  const chartShapesGiro = useMemo(() => {
    if (!periodoEfetivo || !giroCoberturaTempo.length) return []
    const index = giroCoberturaTempo.findIndex((d) => d.periodo === periodoEfetivo)
    if (index === -1) return []
    return [
      { type: 'line', xref: 'x', yref: 'paper', x0: index, x1: index, y0: 0, y1: 1, line: { color: '#f58220', width: 1.5, dash: 'dot' }, layer: 'below' },
      { type: 'rect', xref: 'x', yref: 'paper', x0: index - 0.15, x1: index + 0.15, y0: 0, y1: 1, fillcolor: 'rgba(245, 130, 32, 0.08)', line: { width: 0 }, layer: 'below' },
    ]
  }, [giroCoberturaTempo, periodoEfetivo])

  const chartAnnotations = useMemo(() => {
    let anns = []
    const createAnns = (dataArr, color, yOffset) => dataArr.map(d => ({
       x: d.periodo, y: d.valor, text: `<b>${fmtValorCurto(d.valor)}</b>`, showarrow: true, arrowhead: 0, arrowcolor: 'rgba(0,0,0,0)',
       ax: 0, ay: yOffset, font: { size: 10, color: '#ffffff', family: 'Inter' }, bgcolor: 'rgba(22, 22, 22, 0.85)', bordercolor: color, borderwidth: 1, borderpad: 4,
    }))
    if (vis.total) anns.push(...createAnns(timeSeriesAgg.total, 'rgba(245,130,32,0.6)', -22))
    if (vis.critico) anns.push(...createAnns(timeSeriesAgg.critico, 'rgba(231,76,60,0.8)', 24))
    if (vis.obsoleto) anns.push(...createAnns(timeSeriesAgg.obsoleto, 'rgba(155,89,182,0.6)', -22))
    if (vis.obra) anns.push(...createAnns(timeSeriesAgg.obra, 'rgba(26,188,156,0.6)', 24))
    return anns
  }, [timeSeriesAgg, vis])

  const makeInteractiveHBar = useCallback((items, color, selectedBar, setSelectedBar) => {
    if (!items.length) return <p className="text-muted text-sm text-center py-10">Sem dados</p>
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Plot
          data={[{ 
            type: 'bar', orientation: 'h', y: items.map((d) => d.unidade), x: items.map((d) => d.valor ?? d.total), 
            text: items.map((d) => d.total != null ? `${fmtInt(d.total)} SKUs` : fmtValorCurto(d.valor)), 
            textposition: 'auto', textfont: { color: 'white', size: 10, family: 'Inter', weight: 600 }, 
            marker: { 
              color: items.map((d) => (!selectedBar || d.unidade === selectedBar) ? color : 'rgba(255, 255, 255, 0.15)'),
              opacity: items.map((d) => (!selectedBar || d.unidade === selectedBar) ? 1 : 0.3), line: { color: 'rgba(255,255,255,0.08)', width: 1 }
            }, hoverinfo: 'none' 
          }]}
          layout={{ ...PLOT_LAYOUT, height: Math.max(300, items.length * 32), margin: { l: 140, r: 20, t: 10, b: 10 }, xaxis: { showgrid: true, gridcolor: '#1f1f1f', showticklabels: false, zeroline: false }, yaxis: { showgrid: false, tickfont: { size: 11, color: '#d1d8df', family: 'Inter' } } }}
          config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', cursor: 'pointer' }} useResizeHandler
          onClick={(e) => { e?.event?.stopPropagation?.(); e?.event?.preventDefault?.(); if (e?.points?.[0]?.y) setSelectedBar(prev => prev === e.points[0].y.trim() ? null : e.points[0].y.trim()) }}
        />
      </div>
    )
  }, [])

  const isRankingSelected = activeCard === 'ranking_unidade'
  const isComposicaoSelected = activeCard === 'composicao_estoque'
  const isCriticoSelected = activeCard === 'rank_critico'
  const isObsoletoSelected = activeCard === 'rank_obsoleto'
  const isObraSelected = activeCard === 'rank_obra'
  const isCompraConsumoSelected = activeCard === 'compra_consumo_unidade'
  const isSkusUnidadeSelected = activeCard === 'skus_unidade'

  return (
    <div className="space-y-6 animate-fade-in bg-[#080808] min-h-screen p-2 sm:p-4 text-white relative">
      
      <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)] group">
        <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#2A2A2A]">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase mb-1">Painel Gerencial Âmbar Energia</div>
            <h2 className="text-base font-bold text-white flex items-center gap-2.5 tracking-wide">
              <svg className="w-5 h-5 text-accent shrink-0 drop-shadow-[0_0_8px_rgba(245,130,32,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              EVOLUÇÃO TEMPORAL DO ESTOQUE (R$)
            </h2>
          </div>
          
          <div className="flex flex-wrap items-end gap-3 z-30">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>Tipo</label>
              <CyberMultiSelect options={['Todos', 'Operacional', 'Crítico', 'Obsoleto', 'Obra']} selected={tiposEstoqueSel} onChange={setTiposEstoqueSel} placeholder="Todos os Tipos" />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>Unidade</label>
              <CyberMultiSelect options={['Todas', 'Ativa', 'Gerencial']} selected={escoposSel} onChange={(val) => { setEscoposSel(val); setUnidadesSel([]); }} placeholder="Selecione Unidade" />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Local</label>
              <CyberMultiSelect options={opcoesUnid} selected={unidadesSel} onChange={setUnidadesSel} placeholder="Todas as Unidades" />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>Ano</label>
              <CyberMultiSelect options={anoOpcoes} selected={anosSel} onChange={setAnosSel} placeholder="Todos os Anos" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[ { key: 'total', label: 'Estoque Total', color: '#f58220' }, { key: 'critico', label: 'Estoque Crítico', color: '#e74c3c' }, { key: 'obsoleto', label: 'Estoque Obsoleto', color: '#9b59b6' }, { key: 'obra', label: 'Estoque Obra', color: '#1abc9c' } ].map(({ key, label, color }) => {
            const isActive = vis[key], hasData = timeSeriesAgg[key] && timeSeriesAgg[key].some(d => d.valor > 0)
            return (
              <button key={key} onClick={() => hasData && toggleVis(key)} disabled={!hasData} className={`relative flex items-center justify-center gap-2 px-4 py-2 text-xs transition-all duration-300 rounded-lg overflow-hidden border border-transparent ${!hasData ? 'opacity-30 grayscale cursor-not-allowed text-dark-400 bg-transparent' : !isActive ? 'text-[#8c9ba5] hover:text-white hover:bg-[#222222]/50 border-[#2A2A2A]/40' : 'text-white font-bold bg-[#2A2A2A]/30 border-[#2A2A2A]'}`}>
                {isActive && hasData && <span className="absolute bottom-0 left-0 w-full h-[2px] transition-all" style={{ backgroundColor: color, boxShadow: `0 -2px 8px ${color}` }} />}
                <span className={`w-2 h-2 rounded-full transition-all ${!hasData ? 'bg-dark-500' : isActive ? 'animate-pulse' : 'bg-[#555]'}`} style={(isActive && hasData) ? { backgroundColor: color, boxShadow: `0 0 10px ${color}` } : {}} />
                <span className={isActive ? 'drop-shadow-md tracking-wide' : 'tracking-wide'}>{label}</span>
              </button>
            )
          })}
        </div>

        <div className="pt-2 z-10 relative">
          <Plot
            data={[
              { x: timeSeriesAgg.total.map((d) => d.periodo), y: timeSeriesAgg.total.map(() => maxValorGlobal * 1.3), type: 'bar', name: 'clickArea', marker: { color: 'rgba(245, 130, 32, 0.02)' }, hoverinfo: 'none', showlegend: false, cliponaxis: false },
              vis.total && { x: timeSeriesAgg.total.map((d) => d.periodo), y: timeSeriesAgg.total.map((d) => d.valor), name: 'Estoque Total', type: 'scatter', mode: 'lines+markers', hoverinfo: 'none', line: { color: '#f58220', width: 2, shape: 'spline', smoothing: 1.3 }, marker: { size: 10, color: '#080808', line: { color: '#f58220', width: 1.5 } }, fill: 'tozeroy', fillgradient: { type: 'vertical', colorscale: [['0', 'rgba(245,130,32,0.35)'], ['1', 'rgba(245,130,32,0.0)']] }, fillcolor: 'rgba(245,130,32,0.15)', cliponaxis: false },
              vis.critico && timeSeriesAgg.critico.length > 0 && { x: timeSeriesAgg.critico.map((d) => d.periodo), y: timeSeriesAgg.critico.map((d) => d.valor), name: 'Estoque Crítico', type: 'scatter', mode: 'lines+markers', hoverinfo: 'none', line: { color: '#e74c3c', width: 1.5, dash: 'dash', shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#080808', line: { color: '#e74c3c', width: 1.5 } }, cliponaxis: false },
              vis.obsoleto && timeSeriesAgg.obsoleto.length > 0 && { x: timeSeriesAgg.obsoleto.map((d) => d.periodo), y: timeSeriesAgg.obsoleto.map((d) => d.valor), name: 'Estoque Obsoleto', type: 'scatter', mode: 'lines+markers', hoverinfo: 'none', line: { color: '#9b59b6', width: 1.5, dash: 'dot', shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#080808', line: { color: '#9b59b6', width: 1.5 } }, cliponaxis: false },
              vis.obra && timeSeriesAgg.obra.length > 0 && { x: timeSeriesAgg.obra.map((d) => d.periodo), y: timeSeriesAgg.obra.map((d) => d.valor), name: 'Estoque Obra', type: 'scatter', mode: 'lines+markers', hoverinfo: 'none', line: { color: '#1abc9c', width: 1.5, dash: 'longdash', shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#080808', line: { color: '#1abc9c', width: 1.5 } }, cliponaxis: false },
            ].filter(Boolean)}
            layout={{ ...PLOT_LAYOUT, hovermode: 'closest', height: 350, bargap: 0, margin: { l: 20, r: 20, t: 40, b: 45 }, shapes: chartShapes, annotations: chartAnnotations, xaxis: { showgrid: false, zeroline: false, tickmode: 'array', tickvals: timeSeriesAgg.total.map(d => d.periodo), ticktext: timeSeriesAgg.total.map(d => formatarPeriodoElite(d.periodo, periodoEfetivo)), range: [-0.8, Math.max(timeSeriesAgg.total.length - 0.2, 1)] }, yaxis: { showgrid: true, gridcolor: '#222222', zeroline: false, showticklabels: false, range: [-(maxValorGlobal * 0.15), maxValorGlobal * 1.3] } }}
            config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', cursor: 'pointer' }} useResizeHandler onClick={handleChartClick}
          />
        </div>

        {periodoAtivo && periodoAtivo !== periodoMaximo ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 p-3.5 bg-gradient-to-r from-accent/15 via-[#161616] to-accent/10 rounded-xl border border-accent/40 shadow-[0_4px_20px_rgba(245,130,32,0.15)] animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/40 shrink-0"><svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              <span className="text-xs text-white tracking-wide font-medium">Filtro ativo por snapshot temporal: <b className="text-accent font-mono text-xs px-2 py-0.5 bg-[#080808] border border-accent/30 rounded shadow-inner ml-1">{formatarPeriodoTexto(periodoAtivo)}</b></span>
            </div>
            <button onClick={() => setPeriodoAtivo(null)} className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-dark-900 font-bold text-xs transition-all duration-300 shadow-lg hover:shadow-accent/20 transform hover:-translate-y-0.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span>Retornar ao Período Atual ({formatarPeriodoTexto(periodoMaximo)})</span>
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-2 text-center bg-[#111111]/60 border border-[#2A2A2A]/50 rounded-xl py-2 px-4 w-fit mx-auto shadow-inner">
            <svg className="w-4 h-4 text-accent shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-[11px] text-[#8c9ba5] tracking-wide font-medium">Dica: Clique em qualquer ponto/mês do gráfico acima para filtrar todo o painel com o snapshot daquele período.</span>
          </div>
        )}

        <div className="mt-5 border border-[#2A2A2A] rounded-xl bg-[#0c0c0c] overflow-hidden shadow-inner">
          <div onClick={() => setListaMaioresValoresAberta(!listaMaioresValoresAberta)} className="flex items-center justify-between p-3 sm:p-4 bg-[#161616] hover:bg-[#1a1a1a] cursor-pointer transition-colors border-b border-[#2A2A2A]">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#101820] flex items-center justify-center text-[#3498db] shadow-inner shrink-0 border border-[#3498db]/30"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg></div>
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider block">{listaMaioresValoresAberta ? 'Fechar Maiores Valores de Estoque' : 'Ver Maiores Valores de Estoque'}</span>
                <span className="text-[10px] text-muted font-medium mt-0.5 block">Top SKUs por capital imobilizado (Snapshot: {formatarPeriodoTexto(periodoEfetivo)})</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-[10px] bg-[#3498db]/15 text-[#3498db] px-2 py-0.5 rounded font-mono border border-[#3498db]/30 font-bold">Total: {Number(maioresValoresDataCompleta.length).toLocaleString('pt-BR')}</span>
              <span className="text-xs text-[#3498db] font-bold">{listaMaioresValoresAberta ? '▲' : '▼'}</span>
            </div>
          </div>
          {listaMaioresValoresAberta && (
            <div className="p-4 space-y-4 animate-fade-in bg-[#121212]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-[#8c9ba5]">Exibindo os itens de maior valor em estoque para a seleção atual. (Dica: Clique na tabela e use as setas ↑ ↓ do teclado para navegar)</span>
                <div className="flex items-center gap-2">
                  <button onClick={exportarExcelMaioresValores} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-sm"><span>📥</span><span>Exportar Excel</span></button>
                  <button onClick={() => setTabelaMaioresValoresExpandida(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162432] hover:bg-[#1c2e40] text-[#3498db] border border-[#3498db]/40 text-xs font-bold transition-all shadow-sm group"><span className="group-hover:scale-110 transition-transform">📈</span><span>Expandir (1.000)</span></button>
                </div>
              </div>
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain border border-[#2A2A2A] rounded-xl bg-[#0c0c0c]">
                <TabelaMaioresValores dados={maioresValoresTabela} />
              </div>
            </div>
          )}
        </div>

      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 ml-2 mt-2">
          <div className="w-5 h-5 rounded-md bg-[#16221d] flex items-center justify-center text-[#2ecc71] shadow-inner"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">Linha Financeira</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ExecutiveCard cardKey="estoque" activeCard={activeCard} onCardClick={handleCardClick} valueFontSize="text-base lg:text-lg" alignCenter={true} icon={<svg className="w-4 h-4 text-[#2ecc71]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} iconBg="bg-[#16221d]" title="(R$) ESTOQUE" value={fmtBRL(metrics.valEstoque)} valueAtual={metrics.valEstoque} valueAnterior={metrics.valEstoquePrev} invertColor={true} variant="default" />
          <ExecutiveCard cardKey="critico" activeCard={activeCard} onCardClick={handleCardClick} valueFontSize="text-base lg:text-lg" alignCenter={true} icon={<svg className="w-4 h-4 text-[#e74c3c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} iconBg="bg-[#261816]" title="(R$) EST. CRÍTICO" value={fmtBRL(metrics.valCritico)} valueAtual={metrics.valCritico} valueAnterior={metrics.valCriticoPrev} variant="critico" />
          <ExecutiveCard cardKey="obsoleto" activeCard={activeCard} onCardClick={handleCardClick} valueFontSize="text-base lg:text-lg" alignCenter={true} icon={<svg className="w-4 h-4 text-[#9b59b6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} iconBg="bg-[#201826]" title="(R$) EST. OBSOLETO" value={fmtBRL(metrics.valObsoleto)} valueAtual={metrics.valObsoleto} valueAnterior={metrics.valObsoletoPrev} variant="obsoleto" />
          <ExecutiveCard cardKey="obra" activeCard={activeCard} onCardClick={handleCardClick} valueFontSize="text-base lg:text-lg" alignCenter={true} icon={<svg className="w-4 h-4 text-[#1abc9c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} iconBg="bg-[#162222]" title="(R$) EST. OBRA" value={fmtBRL(metrics.valObra)} valueAtual={metrics.valObra} valueAnterior={metrics.valObraPrev} invertColor={true} variant="obra" />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 ml-2 mt-6">
          <div className="w-5 h-5 rounded-md bg-[#262014] flex items-center justify-center text-accent shadow-inner"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">Linha Operacional</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <ExecutiveCard cardKey="compras" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#f1c40f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>} iconBg="bg-[#262014]" title="COMPRAS" value={fmtBRL(metrics.valCompras)} valueAtual={metrics.valCompras} valueAnterior={metrics.valComprasPrev} valueFontSize="text-base lg:text-lg" alignCenter={true} invertColor={true} variant="default" />
          <ExecutiveCard cardKey="consumo" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#e74c3c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>} iconBg="bg-[#261816]" title="CONSUMO" value={fmtBRL(metrics.valConsumo)} valueAtual={metrics.valConsumo} valueAnterior={metrics.valConsumoPrev} valueFontSize="text-base lg:text-lg" alignCenter={true} variant="default" />
          <ExecutiveCard cardKey="skus" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#3498db]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>} iconBg="bg-[#161c24]" title="SKUs ÚNICOS" value={fmtInt(metrics.valSkus)} valueAtual={metrics.valSkus} valueAnterior={metrics.valSkusPrev} valueFontSize="text-lg lg:text-xl" alignCenter={true} invertColor={true} variant="default" />
          <ExecutiveCard cardKey="giro" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#9b59b6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} iconBg="bg-[#1c1624]" title="GIRO" value={""} valueAtual={giroMensal} valueAnterior={giroMensalPrev} variant="default">
            <div className="grid grid-cols-2 gap-2 mt-1"><div className="bg-[#101010] border border-[#222222] rounded-xl p-1.5 text-center transition-colors"><span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">MENSAL</span><span className="text-base font-black text-white font-mono">{fmtDec(giroMensal)}</span></div><div className="bg-[#101010] border border-[#222222] rounded-xl p-1.5 text-center transition-colors"><span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">ANUAL</span><span className="text-base font-black text-white font-mono">{fmtDec(giroAnual)}</span></div></div>
          </ExecutiveCard>
          <ExecutiveCard cardKey="cobertura" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#e67e22]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} iconBg="bg-[#262014]" title="COBERTURA" value={""} valueAtual={coberturaMeses} valueAnterior={coberturaMesesPrev} invertColor={true} variant="default">
            <div className="grid grid-cols-2 gap-2 mt-1"><div className="bg-[#101010] border border-[#222222] rounded-xl p-1.5 text-center transition-colors"><span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">MENSAL</span><span className="text-base font-black text-white font-mono">{fmtMes(coberturaMeses)}</span></div><div className="bg-[#101010] border border-[#222222] rounded-xl p-1.5 text-center transition-colors"><span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">ANUAL</span><span className="text-base font-black text-white font-mono">{fmtMes(coberturaAnos)}</span></div></div>
          </ExecutiveCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div onClick={() => handleCardClick('ranking_unidade')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isRankingSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612] -translate-y-1.5 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]'}`}>
          {isRankingSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span></span></div>)}
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#262014] flex items-center justify-center text-accent shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">ESTOQUE POR UNIDADE (R$)</span></div>
            {selectedBarraRanking && (<button onClick={(e) => { e.stopPropagation(); setSelectedBarraRanking(null); }} className="text-[10px] bg-accent/20 text-accent border border-accent/40 px-2 py-0.5 rounded hover:bg-accent/30 transition-all font-mono">Limpar Foco ✕</button>)}
          </div>
          <div className="max-h-[380px] overflow-y-auto custom-scrollbar overscroll-contain" onClick={(e) => e.stopPropagation()}>
            <Plot data={[{ type: 'bar', orientation: 'h', y: rankingUnidade.map((d) => d.unidade), x: rankingUnidade.map((d) => d.valor), text: rankingUnidade.map((d) => fmtValorCurto(d.valor)), textposition: 'auto', textfont: { color: 'white', size: 10, family: 'Inter', weight: 600 }, marker: { color: rankingUnidade.map((d) => (!selectedBarraRanking || d.unidade === selectedBarraRanking) ? '#f58220' : 'rgba(245, 130, 32, 0.2)'), opacity: rankingUnidade.map((d) => (!selectedBarraRanking || d.unidade === selectedBarraRanking) ? 1 : 0.3), line: { color: 'rgba(255,255,255,0.08)', width: 1 } }, hoverinfo: 'none' }]} layout={{ ...PLOT_LAYOUT, height: Math.max(300, rankingUnidade.length * 32), margin: { l: 140, r: 20, t: 10, b: 10 }, xaxis: { showgrid: true, gridcolor: '#1f1f1f', showticklabels: false, zeroline: false }, yaxis: { showgrid: false, tickfont: { size: 11, color: '#d1d8df', family: 'Inter' } } }} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', cursor: 'pointer' }} useResizeHandler onClick={(e) => { e?.event?.stopPropagation?.(); e?.event?.preventDefault?.(); if (e?.points?.[0]?.y) setSelectedBarraRanking(prev => prev === e.points[0].y.trim() ? null : e.points[0].y.trim()) }} />
          </div>
        </div>

        <div onClick={() => handleCardClick('composicao_estoque')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isComposicaoSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612] -translate-y-1.5 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]'}`}>
          {isComposicaoSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span></span></div>)}
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#161c24] flex items-center justify-center text-[#3498db] shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">COMPOSIÇÃO DO ESTOQUE (%)</span></div>
            {selectedFatiaComposicao && (<button onClick={(e) => { e.stopPropagation(); setSelectedFatiaComposicao(null); }} className="text-[10px] bg-accent/20 text-accent border border-accent/40 px-2 py-0.5 rounded hover:bg-accent/30 transition-all font-mono">Limpar Foco ✕</button>)}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            {composicao.length > 0 ? (
              <Plot data={[{ type: 'pie', labels: composicao.map((d) => d.name), values: composicao.map((d) => d.value), customdata: composicao.map((d) => fmtBRL(d.value)), hole: 0.7, pull: composicao.map((d) => (!selectedFatiaComposicao || d.name === selectedFatiaComposicao) ? 0.05 : 0), marker: { colors: composicao.map((d) => (!selectedFatiaComposicao || d.name === selectedFatiaComposicao) ? d.color : '#222222'), opacity: composicao.map((d) => (!selectedFatiaComposicao || d.name === selectedFatiaComposicao) ? 1 : 0.35), line: { color: '#161616', width: 3 } }, textinfo: 'percent', textposition: 'inside', textfont: { size: 11, color: '#ffffff', family: 'Inter', weight: 'bold' }, hovertemplate: '<b>%{label}</b><br>Valor: %{customdata}<br>Participação: %{percent}<extra></extra>' }]} layout={{ ...PLOT_LAYOUT, height: 380, margin: { l: 20, r: 20, t: 10, b: 10 }, showlegend: true, legend: { orientation: 'h', y: -0.1, x: 0.5, xanchor: 'center', font: { color: '#c5d0db', size: 10, family: 'Inter' } }, annotations: [{ text: `<b>TOTAL</b><br><span style="font-size:16px; font-weight:900; font-family:monospace; color:#ffffff;">${fmtValorCurto(metrics.valEstoque)}</span>`, x: 0.5, y: 0.5, font: { size: 12, color: '#8c9ba5' }, showarrow: false }] }} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', cursor: 'pointer' }} useResizeHandler onClick={(e) => { e?.event?.stopPropagation?.(); e?.event?.preventDefault?.(); if (e?.points?.[0]?.label) setSelectedFatiaComposicao(prev => prev === e.points[0].label ? null : e.points[0].label) }} />
            ) : (<p className="text-muted text-center py-16">Sem dados</p>)}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3 ml-2"><div className="w-5 h-5 rounded-md bg-[#261616] flex items-center justify-center text-[#e74c3c] shadow-inner"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">RANKING POR CATEGORIA E UNIDADE (R$)</span></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div onClick={() => handleCardClick('rank_critico')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isCriticoSelected ? 'border-[#e74c3c] shadow-[0_0_25px_rgba(231,76,60,0.4)] bg-[#1c1212] -translate-y-1.5 ring-1 ring-[#e74c3c]/50' : 'border-[#2A2A2A] hover:border-[#e74c3c]/80 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(231,76,60,0.25)]'}`}>
            {isCriticoSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e74c3c] opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#e74c3c] shadow-[0_0_10px_rgba(231,76,60,0.8)]"></span></span></div>)}
            <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-[#e74c3c]/60 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#261816] flex items-center justify-center text-[#e74c3c] shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#e74c3c] uppercase">EST. CRÍTICO POR UNID</span></div>{selectedBarraCritico && (<button onClick={(e) => { e.stopPropagation(); setSelectedBarraCritico(null); }} className="text-[10px] bg-[#e74c3c]/20 text-[#e74c3c] border border-[#e74c3c]/40 px-2 py-0.5 rounded hover:bg-[#e74c3c]/30 transition-all font-mono">Limpar ✕</button>)}</div>
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain">{makeInteractiveHBar(rankCritico, '#e74c3c', selectedBarraCritico, setSelectedBarraCritico)}</div>
          </div>
          <div onClick={() => handleCardClick('rank_obsoleto')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isObsoletoSelected ? 'border-[#9b59b6] shadow-[0_0_25px_rgba(155,89,182,0.4)] bg-[#17121c] -translate-y-1.5 ring-1 ring-[#9b59b6]/50' : 'border-[#2A2A2A] hover:border-[#9b59b6]/80 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(155,89,182,0.25)]'}`}>
            {isObsoletoSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9b59b6] opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#9b59b6] shadow-[0_0_10px_rgba(155,89,182,0.8)]"></span></span></div>)}
            <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-[#9b59b6]/60 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#201826] flex items-center justify-center text-[#9b59b6] shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#9b59b6] uppercase">EST. OBSOLETO POR UNID</span></div>{selectedBarraObsoleto && (<button onClick={(e) => { e.stopPropagation(); setSelectedBarraObsoleto(null); }} className="text-[10px] bg-[#9b59b6]/20 text-[#9b59b6] border border-[#9b59b6]/40 px-2 py-0.5 rounded hover:bg-[#9b59b6]/30 transition-all font-mono">Limpar ✕</button>)}</div>
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain">{makeInteractiveHBar(rankObsoleto, '#9b59b6', selectedBarraObsoleto, setSelectedBarraObsoleto)}</div>
          </div>
          <div onClick={() => handleCardClick('rank_obra')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isObraSelected ? 'border-[#1abc9c] shadow-[0_0_25px_rgba(26,188,156,0.4)] bg-[#111c19] -translate-y-1.5 ring-1 ring-[#1abc9c]/50' : 'border-[#2A2A2A] hover:border-[#1abc9c]/80 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(26,188,156,0.25)]'}`}>
            {isObraSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1abc9c] opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1abc9c] shadow-[0_0_10px_rgba(26,188,156,0.8)]"></span></span></div>)}
            <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-[#1abc9c]/60 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#162222] flex items-center justify-center text-[#1abc9c] shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#1abc9c] uppercase">EST. OBRA POR UNID</span></div>{selectedBarraObra && (<button onClick={(e) => { e.stopPropagation(); setSelectedBarraObra(null); }} className="text-[10px] bg-[#1abc9c]/20 text-[#1abc9c] border border-[#1abc9c]/40 px-2 py-0.5 rounded hover:bg-[#1abc9c]/30 transition-all font-mono">Limpar ✕</button>)}</div>
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain">{makeInteractiveHBar(rankObra, '#1abc9c', selectedBarraObra, setSelectedBarraObra)}</div>
          </div>
        </div>
      </div>

      <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] mt-6 relative overflow-hidden transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)] group">
        <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-[#2ecc71]/50 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-[#16221d] flex items-center justify-center border border-[#2ecc71]/30 shadow-inner shrink-0"><svg className="w-4 h-4 text-[#2ecc71]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg></div><h2 className="text-sm font-bold text-white tracking-wide uppercase">EVOLUÇÃO TEMPORAL COMPRA x CONSUMO (R$)</h2></div>
          <div className="flex items-center gap-4 text-[11px] font-medium tracking-wider">
            <button onClick={() => toggleVisComprasConsumo('compras')} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer ${visComprasConsumo.compras ? 'bg-[#e74c3c]/15 border-[#e74c3c]/40 text-white shadow-[0_0_10px_rgba(231,76,60,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}><span className="relative flex items-center justify-center w-4 h-[2px] bg-[#e74c3c]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${visComprasConsumo.compras ? 'bg-[#e74c3c]' : 'bg-[#555]'}`}></span></span><span>Compras</span></button>
            <button onClick={() => toggleVisComprasConsumo('consumo')} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer ${visComprasConsumo.consumo ? 'bg-[#2ecc71]/15 border-[#2ecc71]/40 text-white shadow-[0_0_10px_rgba(46,204,113,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}><span className="relative flex items-center justify-center w-4 h-[2px] bg-[#2ecc71]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${visComprasConsumo.consumo ? 'bg-[#2ecc71]' : 'bg-[#555]'}`}></span></span><span>Consumo</span></button>
          </div>
        </div>
        <Plot
          data={[
            visComprasConsumo.compras && { x: timeSeriesAgg.comprasConsumo.map((d) => d.periodo), y: timeSeriesAgg.comprasConsumo.map((d) => d.compras), name: 'Compras', type: 'scatter', mode: 'lines+markers', line: { color: '#e74c3c', width: 2.5, shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#e74c3c', line: { color: '#161616', width: 1.5 } }, customdata: timeSeriesAgg.comprasConsumo.map((d) => fmtBRL(d.compras)), hovertemplate: '<b>%{x}</b><br>Compras: <span style="color:#e74c3c; font-weight:bold;">%{customdata}</span><extra></extra>' },
            visComprasConsumo.consumo && { x: timeSeriesAgg.comprasConsumo.map((d) => d.periodo), y: timeSeriesAgg.comprasConsumo.map((d) => d.consumo), name: 'Consumo', type: 'scatter', mode: 'lines+markers', line: { color: '#2ecc71', width: 2.5, shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#2ecc71', line: { color: '#161616', width: 1.5 } }, customdata: timeSeriesAgg.comprasConsumo.map((d) => fmtBRL(d.consumo)), hovertemplate: '<b>%{x}</b><br>Consumo: <span style="color:#2ecc71; font-weight:bold;">%{customdata}</span><extra></extra>' },
          ].filter(Boolean)}
          layout={{ ...PLOT_LAYOUT, height: 350, showlegend: false, hovermode: 'x unified', hoverlabel: { bgcolor: '#0c0c0c', bordercolor: '#333333', font: { color: '#ffffff', family: 'Inter', size: 12 } }, shapes: chartShapes, xaxis: { showgrid: false, zeroline: false, tickmode: 'array', tickvals: timeSeriesAgg.comprasConsumo.map(d => d.periodo), ticktext: timeSeriesAgg.comprasConsumo.map(d => formatarPeriodoElite(d.periodo, periodoEfetivo)), showspikes: true, spikemode: 'across', spikedash: 'dot', spikecolor: '#555555', spikethickness: 1 }, yaxis: { showgrid: true, gridcolor: '#222222', zeroline: false, showticklabels: false } }}
          config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', cursor: 'pointer' }} useResizeHandler onClick={handleChartClick}
        />

        <div className="mt-5 border border-[#e74c3c]/30 rounded-xl bg-[#0c0c0c] overflow-hidden shadow-inner">
          <div onClick={() => setListaComprasSemConsumoAberta(!listaComprasSemConsumoAberta)} className="flex items-center justify-between p-3 sm:p-4 bg-[#1a0f0f] hover:bg-[#201212] cursor-pointer transition-colors border-b border-[#e74c3c]/20">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#261010] flex items-center justify-center text-[#e74c3c] shadow-inner shrink-0 border border-[#e74c3c]/30"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              <div><span className="text-xs font-bold text-[#e74c3c] uppercase tracking-wider block">{listaComprasSemConsumoAberta ? 'Fechar Lista de Compras sem Consumo' : 'Alerta: Compras realizadas com Consumo Zero'}</span><span className="text-[10px] text-muted font-medium mt-0.5 block">Itens comprados no mês, mas que não tiveram nenhuma saída registrada (Snapshot: {formatarPeriodoTexto(periodoEfetivo)})</span></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-[10px] bg-[#e74c3c]/15 text-[#e74c3c] px-2 py-0.5 rounded font-mono border border-[#e74c3c]/30 font-bold">Total: {Number(comprasSemConsumoDataCompleta.length).toLocaleString('pt-BR')}</span>
              <span className="text-xs text-[#e74c3c] font-bold">{listaComprasSemConsumoAberta ? '▲' : '▼'}</span>
            </div>
          </div>
          {listaComprasSemConsumoAberta && (
            <div className="p-4 space-y-4 animate-fade-in bg-[#120a0a]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-[#e74c3c]/80">Listando materiais com imobilização de caixa injustificada no período (R$ Comprado &gt; 0 e R$ Consumido = 0).</span>
                <div className="flex items-center gap-2">
                  <button onClick={exportarExcelComprasSemConsumo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-sm"><span>📥</span><span>Exportar Excel</span></button>
                  <button onClick={() => setTabelaComprasSemConsumoExpandida(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1a1a] hover:bg-[#3a2020] text-[#f58220] border border-[#f58220]/40 text-xs font-bold transition-all shadow-sm group"><span className="group-hover:scale-110 transition-transform">📈</span><span>Expandir (1.000)</span></button>
                </div>
              </div>
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain border border-[#2A2A2A] rounded-xl bg-[#0c0c0c]">
                <TabelaComprasSemConsumo dados={comprasSemConsumoTabela} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div onClick={() => handleCardClick('compra_consumo_unidade')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isCompraConsumoSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612] -translate-y-1.5 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]'}`}>
          {isCompraConsumoSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span></span></div>)}
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#262014] flex items-center justify-center text-accent shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">COMPRA X CONSUMO POR UNIDADE</span></div>
            <div className="flex items-center gap-3 text-[11px] text-muted tracking-wider"><span><span className="text-[#e74c3c]">■</span> Compras</span><span><span className="text-[#2ecc71]">■</span> Consumo</span></div>
          </div>
          <div className="max-h-[380px] overflow-y-auto custom-scrollbar overscroll-contain" onClick={(e) => e.stopPropagation()}>
            {compraConsumoUnidade.length ? (
              <Plot
                data={[
                  { type: 'bar', orientation: 'h', name: 'Compras', y: compraConsumoUnidade.map((d) => d.unidade), x: compraConsumoUnidade.map((d) => d.compras), text: compraConsumoUnidade.map((d) => fmtValorCurto(d.compras)), textposition: 'auto', textfont: { color: 'white', size: 10, family: 'Inter' }, marker: { color: compraConsumoUnidade.map((d) => (!selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo) ? '#e74c3c' : 'rgba(231,76,60,0.25)'), opacity: compraConsumoUnidade.map((d) => (!selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo) ? 1 : 0.3) }, hoverinfo: 'none' },
                  { type: 'bar', orientation: 'h', name: 'Consumo', y: compraConsumoUnidade.map((d) => d.unidade), x: compraConsumoUnidade.map((d) => d.consumo), text: compraConsumoUnidade.map((d) => fmtValorCurto(d.consumo)), textposition: 'auto', textfont: { color: 'white', size: 10, family: 'Inter' }, marker: { color: compraConsumoUnidade.map((d) => (!selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo) ? '#2ecc71' : 'rgba(46,204,113,0.25)'), opacity: compraConsumoUnidade.map((d) => (!selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo) ? 1 : 0.3) }, hoverinfo: 'none' },
                ]}
                layout={{ ...PLOT_LAYOUT, barmode: 'group', height: Math.max(300, compraConsumoUnidade.length * 55), margin: { l: 130, r: 30, t: 10, b: 10 }, showlegend: false, xaxis: { showgrid: false, showticklabels: false, zeroline: false }, yaxis: { showgrid: false, tickfont: { size: 10, color: '#c5d0db', family: 'Inter' } } }}
                config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', cursor: 'pointer' }} useResizeHandler onClick={(e) => { e?.event?.stopPropagation?.(); e?.event?.preventDefault?.(); if (e?.points?.[0]?.y) setSelectedBarraCompraConsumo(prev => prev === e.points[0].y.trim() ? null : e.points[0].y.trim()) }}
              />
            ) : (<p className="text-muted text-center py-10">Sem dados</p>)}
          </div>
        </div>

        <div onClick={() => handleCardClick('skus_unidade')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isSkusUnidadeSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612] -translate-y-1.5 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]'}`}>
          {isSkusUnidadeSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span></span></div>)}
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#161c24] flex items-center justify-center text-[#3498db] shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">SKUs POR UNIDADE (QTDE)</span></div>
            {selectedBarraSkus && (<button onClick={(e) => { e.stopPropagation(); setSelectedBarraSkus(null); }} className="text-[10px] bg-accent/20 text-accent border border-accent/40 px-2 py-0.5 rounded hover:bg-accent/30 transition-all font-mono">Limpar Foco ✕</button>)}
          </div>
          <div className="max-h-[380px] overflow-y-auto custom-scrollbar overscroll-contain">
            {makeInteractiveHBar(skusUnidade, '#3498db', selectedBarraSkus, setSelectedBarraSkus)}
          </div>
        </div>
      </div>

      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 sm:p-6 shadow-xl mt-6 transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg bg-[#161c24] flex items-center justify-center shadow-inner shrink-0 ${abaSkus === 'duplicados' ? 'text-[#f1c40f]' : 'text-[#3498db]'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">EVOLUÇÃO TEMPORAL DE SKUs (QTDE)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium tracking-wider">
            <button onClick={() => setAbaSkus('unicos')} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer ${abaSkus === 'unicos' ? 'bg-[#3498db]/15 border-[#3498db]/40 text-white shadow-[0_0_10px_rgba(52,152,219,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
              <span className="relative flex items-center justify-center w-4 h-[2px] bg-[#3498db]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${abaSkus === 'unicos' ? 'bg-[#3498db]' : 'bg-[#555]'}`}></span></span>
              <span>SKUs Únicos</span>
            </button>
            <button onClick={() => setAbaSkus('duplicados')} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer ${abaSkus === 'duplicados' ? 'bg-[#f1c40f]/15 border-[#f1c40f]/40 text-white shadow-[0_0_10px_rgba(241,196,15,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
              <span className="relative flex items-center justify-center w-4 h-[2px] bg-[#f1c40f]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${abaSkus === 'duplicados' ? 'bg-[#f1c40f]' : 'bg-[#555]'}`}></span></span>
              <span>SKUs Duplicados</span>
            </button>
          </div>
        </div>
        
        <Plot 
          data={[{ 
            x: timeSeriesAgg.skus.map((d) => d.periodo), 
            y: timeSeriesAgg.skus.map((d) => abaSkus === 'duplicados' ? d.duplicados : d.total), 
            type: 'scatter', 
            mode: 'lines+markers+text', 
            text: timeSeriesAgg.skus.map((d) => fmtInt(abaSkus === 'duplicados' ? d.duplicados : d.total)), 
            textposition: 'top center', 
            textfont: { color: 'white', size: 11, family: 'Inter' }, 
            line: { color: abaSkus === 'duplicados' ? '#f1c40f' : '#3498db', width: 2, shape: 'spline', smoothing: 1.3 }, 
            marker: { size: 8, color: '#080808', line: { color: abaSkus === 'duplicados' ? '#f1c40f' : '#3498db', width: 1.5 } }, 
            fill: 'tozeroy', 
            fillgradient: { type: 'vertical', colorscale: [['0', abaSkus === 'duplicados' ? 'rgba(241,196,15,0.35)' : 'rgba(52,152,219,0.35)'], ['1', abaSkus === 'duplicados' ? 'rgba(241,196,15,0.0)' : 'rgba(52,152,219,0.0)']] }, 
            fillcolor: abaSkus === 'duplicados' ? 'rgba(241,196,15,0.15)' : 'rgba(52,152,219,0.15)', 
            hoverinfo: 'none',
            cliponaxis: false
          }]} 
          layout={{ 
            ...PLOT_LAYOUT, 
            height: 330, 
            margin: { l: 30, r: 20, t: 40, b: 40 }, 
            shapes: chartShapesSkus, 
            xaxis: { showgrid: false, zeroline: false, tickmode: 'array', tickvals: timeSeriesAgg.skus.map(d => d.periodo), ticktext: timeSeriesAgg.skus.map(d => formatarPeriodoElite(d.periodo, periodoEfetivo)), range: [-0.6, Math.max(timeSeriesAgg.skus.length - 0.4, 1)] }, 
            yaxis: { showgrid: true, gridcolor: '#2A2A2A', zeroline: false, showticklabels: false, range: [0, (Math.max(...timeSeriesAgg.skus.map((d) => abaSkus === 'duplicados' ? d.duplicados : d.total), 10) || 10) * 1.25] } 
          }} 
          config={{ displayModeBar: false, responsive: true }} style={{ width: '100%' }} useResizeHandler 
        />

        <div className="mt-5 border border-[#f1c40f]/30 rounded-xl bg-[#0c0c0c] overflow-hidden shadow-inner">
          <div onClick={() => setListaDuplicadosAberta(!listaDuplicadosAberta)} className="flex items-center justify-between p-3 sm:p-4 bg-[#1a180f] hover:bg-[#201e12] cursor-pointer transition-colors border-b border-[#f1c40f]/20">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#262410] flex items-center justify-center text-[#f1c40f] shadow-inner shrink-0 border border-[#f1c40f]/30">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <span className="text-xs font-bold text-[#f1c40f] uppercase tracking-wider block">{listaDuplicadosAberta ? 'Fechar Lista de Duplicados' : 'Alerta: Cadastros Duplicados (Mesmo Nome por Chave de Palavras, SKUs Diferentes)'}</span>
                <span className="text-[10px] text-muted font-medium mt-0.5 block">Identifica produtos com o mesmo padrão descritivo sob múltiplos códigos (Snapshot: {formatarPeriodoTexto(periodoEfetivo)})</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-[10px] bg-[#f1c40f]/15 text-[#f1c40f] px-2 py-0.5 rounded font-mono border border-[#f1c40f]/30 font-bold">Total: {Number(duplicadosDataCompleta.length).toLocaleString('pt-BR')}</span>
              <span className="text-xs text-[#f1c40f] font-bold">{listaDuplicadosAberta ? '▲' : '▼'}</span>
            </div>
          </div>
          {listaDuplicadosAberta && (
            <div className="p-4 space-y-4 animate-fade-in bg-[#12110a]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-[#f1c40f]/80">Listando materiais com padrão descritivo equivalente (palavras ordenadas), mas SKUs diferentes. Ordenado pelo impacto financeiro.</span>
                <div className="flex items-center gap-2">
                  <button onClick={exportarExcelDuplicados} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a2616] hover:bg-[#3a341c] text-[#f1c40f] border border-[#f1c40f]/40 text-xs font-bold transition-all shadow-sm"><span>📥</span><span>Exportar Excel</span></button>
                  <button onClick={() => setTabelaDuplicadosExpandida(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1a1a] hover:bg-[#3a2020] text-[#f58220] border border-[#f58220]/40 text-xs font-bold transition-all shadow-sm group"><span className="group-hover:scale-110 transition-transform">📈</span><span>Expandir (1.000)</span></button>
                </div>
              </div>
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain border border-[#2A2A2A] rounded-xl bg-[#0c0c0c]">
                <TabelaDuplicados dados={duplicadosTabela} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 sm:p-6 shadow-xl mt-6 transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#1c1624] flex items-center justify-center text-[#9b59b6] shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">EVOLUÇÃO TEMPORAL DE GIRO x COBERTURA (MENSAL)</span></div>
          <div className="flex items-center gap-4 text-[11px] font-medium tracking-wider">
            <button onClick={() => toggleVisGiroCobertura('giro')} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer ${visGiroCobertura.giro ? 'bg-[#3498db]/15 border-[#3498db]/40 text-white shadow-[0_0_10px_rgba(52,152,219,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}><span className="relative flex items-center justify-center w-4 h-[2px] bg-[#3498db]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${visGiroCobertura.giro ? 'bg-[#3498db]' : 'bg-[#555]'}`}></span></span><span>Giro Mensal</span></button>
            <button onClick={() => toggleVisGiroCobertura('cobertura')} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer ${visGiroCobertura.cobertura ? 'bg-[#f58220]/15 border-[#f58220]/40 text-white shadow-[0_0_10px_rgba(245,130,32,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}><span className="relative flex items-center justify-center w-4 h-[2px] bg-[#f58220]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${visGiroCobertura.cobertura ? 'bg-[#f58220]' : 'bg-[#555]'}`}></span></span><span>Cobertura</span></button>
          </div>
        </div>
        {giroCoberturaTempo.length ? (
          <Plot
            data={[
              visGiroCobertura.giro && { x: giroCoberturaTempo.map((d) => d.periodo), y: giroCoberturaTempo.map((d) => d.giro), name: 'Giro Mensal', type: 'scatter', mode: 'lines+markers', line: { color: '#3498db', width: 2.5, shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#3498db', line: { color: '#fff', width: 1.5 } }, customdata: giroCoberturaTempo.map((d) => fmtDec(d.giro)), hovertemplate: '<b>%{x}</b><br>Giro Mensal: <span style="color:#3498db; font-weight:bold;">%{customdata}</span><extra></extra>' },
              visGiroCobertura.cobertura && { x: giroCoberturaTempo.map((d) => d.periodo), y: giroCoberturaTempo.map((d) => d.cobertura), name: 'Cobertura', type: 'scatter', mode: 'lines+markers', yaxis: 'y2', line: { color: '#f58220', width: 2.5, shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#f58220', line: { color: '#fff', width: 1.5 } }, customdata: giroCoberturaTempo.map((d) => fmtMes(d.cobertura)), hovertemplate: '<b>%{x}</b><br>Cobertura: <span style="color:#f58220; font-weight:bold;">%{customdata}</span><extra></extra>' },
            ].filter(Boolean)}
            layout={{ ...PLOT_LAYOUT, height: 380, showlegend: false, hovermode: 'x unified', hoverlabel: { bgcolor: '#0c0c0c', bordercolor: '#333333', font: { color: '#ffffff', family: 'Inter', size: 12 } }, shapes: chartShapesGiro, xaxis: { showgrid: false, zeroline: false, tickmode: 'array', tickvals: giroCoberturaTempo.map(d => d.periodo), ticktext: giroCoberturaTempo.map(d => formatarPeriodoElite(d.periodo, periodoEfetivo)) }, yaxis: { showgrid: true, gridcolor: '#2A2A2A', zeroline: false, showticklabels: false }, yaxis2: { overlaying: 'y', side: 'right', showgrid: false, showticklabels: false } }}
            config={{ displayModeBar: false, responsive: true }} style={{ width: '100%' }} useResizeHandler
          />
        ) : (<p className="text-muted text-center py-10">Sem dados suficientes para calcular Giro x Cobertura.</p>)}
      </div>

      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 sm:p-6 shadow-xl mt-6 transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase mb-1 flex items-center gap-2"><svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>MATERIAIS PARADOS HÁ MAIS DE 3 MESES (SEM MOVIMENTAÇÃO)</div>
            <p className="text-muted text-xs tracking-wide">Exclui itens Críticos e Obsoletos. Contabiliza o ciclo de inatividade considerando também o mês de origem (Efeito Coorte).</p>
          </div>
          {filtroMesParado && (<button onClick={() => setFiltroMesParado(null)} className="text-[10px] bg-accent/20 text-accent border border-accent/40 px-3 py-1.5 rounded-lg hover:bg-accent/30 transition-all font-mono font-bold flex items-center gap-1.5 self-start sm:self-auto"><span>Filtrando: {filtroMesParado} Meses</span><span>✕ Limpar</span></button>)}
        </div>

        {paradosChart.length > 0 ? (
          <>
            <div className="mb-6 bg-[#101010] p-4 rounded-xl border border-[#222222]">
              <Plot
                data={[{ type: 'scatter', mode: 'lines+markers+text', name: 'Valor Parado (R$)', x: paradosChart.map((d) => d.label), y: paradosChart.map((d) => d.valor), text: paradosChart.map((d) => fmtValorCurto(d.valor)), textposition: 'top center', textfont: { color: 'white', size: 11, family: 'Inter', weight: 600 }, line: { color: '#f58220', width: 3, shape: 'spline', smoothing: 1.3 }, marker: { size: 10, color: '#080808', line: { color: '#f58220', width: 2 } }, fill: 'tozeroy', fillgradient: { type: 'vertical', colorscale: [['0', 'rgba(245,130,32,0.35)'], ['1', 'rgba(245,130,32,0.0)']] }, fillcolor: 'rgba(245,130,32,0.15)', customdata: paradosChart.map((d) => `<span style="color:#2ecc71; font-weight:bold;">${fmtBRL(d.valor)}</span><br>Qtd SKUs: <span style="color:#3498db; font-weight:bold;">${Number(d.skus).toLocaleString('pt-BR')} SKUs</span>`), hovertemplate: '<b>%{x}</b><br>Valor: %{customdata}<extra></extra>', cliponaxis: false }]}
                layout={{ ...PLOT_LAYOUT, height: 320, margin: { l: 50, r: 50, t: 65, b: 40 }, showlegend: false, hoverlabel: { bgcolor: '#161616', bordercolor: '#2A2A2A', font: { color: '#ffffff', family: 'Inter', size: 12 } }, xaxis: { showgrid: false, tickfont: { color: '#94a3b8', family: 'Inter' }, range: [-0.8, paradosChart.length] }, yaxis: { showgrid: true, gridcolor: '#2A2A2A', showticklabels: false, range: [-(Math.max(...paradosChart.map(d => d.valor), 10) * 0.15), (Math.max(...paradosChart.map(d => d.valor), 10) * 1.45)] } }}
                config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', cursor: 'pointer' }} useResizeHandler
                onClick={(e) => { if (e?.points?.[0]?.x) { const num = parseInt(e.points[0].x.replace(/\D/g, '')); setFiltroMesParado(prev => prev === num ? null : num) } }}
              />
            </div>
            <div className="mt-4 border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden">
              <div onClick={() => setListaAberta(!listaAberta)} className="flex items-center justify-between p-4 bg-[#181818] hover:bg-[#202020] cursor-pointer transition-colors border-b border-[#2A2A2A]">
                <div className="flex items-center gap-2.5"><span className="text-accent text-sm">📂</span><span className="text-xs font-bold text-white uppercase tracking-wider">{listaAberta ? 'Fechar Lista Completa de Itens Parados' : 'Abrir Lista Completa de Itens Parados'}</span><span className="ml-2 text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded font-mono border border-accent/30">Total: {Number(itensParados.length).toLocaleString('pt-BR')} registros</span></div>
                <span className="text-xs text-accent font-bold">{listaAberta ? '▲' : '▼'}</span>
              </div>
              {listaAberta && (
                <div className="p-4 space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#161616] p-3.5 rounded-xl border border-[#2A2A2A]">
                    <div><label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">Filtrar por Unidade:</label><CyberMultiSelect options={['Todas', ...unidadesParadasOpcoes]} selected={tabelaUnidadesSel} onChange={setTabelaUnidadesSel} placeholder="Todas as Unidades" /></div>
                    <div><label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">Filtrar por Tempo Parado:</label><CyberMultiSelect options={['Todos', ...mesesParadosOpcoes]} selected={tabelaMesesSel} onChange={setTabelaMesesSel} placeholder="Todos os Meses" /></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted">Exibindo os itens mais relevantes ordenados por valor financeiro.</span>
                    <div className="flex items-center gap-2">
                      <button onClick={exportarExcelParados} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-sm"><span>📥</span><span>Exportar Excel</span></button>
                      <button onClick={() => setTabelaExpandida(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#2a2a2a] text-white border border-[#333] text-xs font-bold transition-all shadow-sm group"><span className="group-hover:scale-110 transition-transform">📈</span><span>Expandir Janela</span></button>
                    </div>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto custom-scrollbar overscroll-contain border border-[#2A2A2A] rounded-xl bg-[#121212]">
                    <TabelaCyberpunk dados={itensParadosFiltradosTabela} />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (<p className="text-muted text-center py-8 tracking-wide">Nenhum material operacional parado há mais de 3 meses para o período selecionado.</p>)}
      </div>

      {tabelaExpandida && (
        <FullScreenPortal onClose={() => setTabelaExpandida(false)}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shadow-xl shrink-0">
              <div className="flex items-center gap-3"><span className="text-accent text-2xl drop-shadow-[0_0_10px_rgba(245,130,32,0.8)]">📂</span><h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa de Itens Parados (Tela Cheia)</h2><span className="ml-3 text-xs bg-accent/15 text-accent px-2.5 py-1 rounded-md font-mono border border-accent/30 font-bold shadow-inner">Exibindo até 1.000 registros mais relevantes (Total filtrado: {Number(itensParadosParaExportar.length).toLocaleString('pt-BR')})</span></div>
              <div className="flex gap-3 items-center">
                  <button onClick={exportarExcelParados} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5"><span>📥</span><span>Baixar Excel Completo</span></button>
                  <button onClick={() => setTabelaExpandida(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5"><span>✕</span><span>Fechar Janela</span></button>
              </div>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#080808] relative"><div className="absolute top-0 left-1/4 right-1/4 h-[1px] opacity-20 bg-gradient-to-r from-transparent via-accent to-transparent pointer-events-none" /><div className="border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden shadow-2xl h-full flex flex-col"><div className="overflow-y-auto custom-scrollbar flex-grow"><TabelaCyberpunk dados={itensParadosFiltradosTabela} /></div></div></div>
          </div>
        </FullScreenPortal>
      )}

      {tabelaMaioresValoresExpandida && (
        <FullScreenPortal onClose={() => setTabelaMaioresValoresExpandida(false)}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shadow-xl shrink-0">
              <div className="flex items-center gap-3"><span className="text-[#3498db] text-2xl drop-shadow-[0_0_10px_rgba(52,152,219,0.8)]">📈</span><h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa: Maiores Valores de Estoque (Tela Cheia)</h2><span className="ml-3 text-xs bg-[#3498db]/15 text-[#3498db] px-2.5 py-1 rounded-md font-mono border border-[#3498db]/30 font-bold shadow-inner">Exibindo até 1.000 registros (Total no período selecionado: {Number(maioresValoresDataCompleta.length).toLocaleString('pt-BR')})</span></div>
              <div className="flex gap-3 items-center">
                  <button onClick={exportarExcelMaioresValores} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5"><span>📥</span><span>Baixar Excel Completo</span></button>
                  <button onClick={() => setTabelaMaioresValoresExpandida(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5"><span>✕</span><span>Fechar Janela</span></button>
              </div>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#080808] relative"><div className="absolute top-0 left-1/4 right-1/4 h-[1px] opacity-20 bg-gradient-to-r from-transparent via-[#3498db] to-transparent pointer-events-none" /><div className="border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden shadow-2xl h-full flex flex-col"><div className="overflow-y-auto custom-scrollbar flex-grow"><TabelaMaioresValores dados={maioresValoresTabela} /></div></div></div>
          </div>
        </FullScreenPortal>
      )}

      {tabelaComprasSemConsumoExpandida && (
        <FullScreenPortal onClose={() => setTabelaComprasSemConsumoExpandida(false)}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shadow-xl shrink-0">
              <div className="flex items-center gap-3"><span className="text-[#e74c3c] text-2xl drop-shadow-[0_0_10px_rgba(231,76,60,0.8)]">⚠️</span><h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa: Compras com Consumo Zero (Tela Cheia)</h2><span className="ml-3 text-xs bg-[#e74c3c]/15 text-[#e74c3c] px-2.5 py-1 rounded-md font-mono border border-[#e74c3c]/30 font-bold shadow-inner">Exibindo até 1.000 registros (Total no período: {Number(comprasSemConsumoDataCompleta.length).toLocaleString('pt-BR')})</span></div>
              <div className="flex gap-3 items-center">
                  <button onClick={exportarExcelComprasSemConsumo} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5"><span>📥</span><span>Baixar Excel Completo</span></button>
                  <button onClick={() => setTabelaComprasSemConsumoExpandida(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5"><span>✕</span><span>Fechar Janela</span></button>
              </div>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#080808] relative"><div className="absolute top-0 left-1/4 right-1/4 h-[1px] opacity-20 bg-gradient-to-r from-transparent via-[#e74c3c] to-transparent pointer-events-none" /><div className="border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden shadow-2xl h-full flex flex-col"><div className="overflow-y-auto custom-scrollbar flex-grow"><TabelaComprasSemConsumo dados={comprasSemConsumoTabela} /></div></div></div>
          </div>
        </FullScreenPortal>
      )}

      {tabelaDuplicadosExpandida && (
        <FullScreenPortal onClose={() => setTabelaDuplicadosExpandida(false)}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shadow-xl shrink-0">
              <div className="flex items-center gap-3"><span className="text-[#f1c40f] text-2xl drop-shadow-[0_0_10px_rgba(241,196,15,0.8)]">⚠️</span><h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa: Cadastros Duplicados (Tela Cheia)</h2><span className="ml-3 text-xs bg-[#f1c40f]/15 text-[#f1c40f] px-2.5 py-1 rounded-md font-mono border border-[#f1c40f]/30 font-bold shadow-inner">Exibindo até 1.000 registros (Total no período: {Number(duplicadosDataCompleta.length).toLocaleString('pt-BR')})</span></div>
              <div className="flex gap-3 items-center">
                  <button onClick={exportarExcelDuplicados} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5"><span>📥</span><span>Baixar Excel Completo</span></button>
                  <button onClick={() => setTabelaDuplicadosExpandida(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5"><span>✕</span><span>Fechar Janela</span></button>
              </div>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#080808] relative"><div className="absolute top-0 left-1/4 right-1/4 h-[1px] opacity-20 bg-gradient-to-r from-transparent via-[#f1c40f] to-transparent pointer-events-none" /><div className="border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden shadow-2xl h-full flex flex-col"><div className="overflow-y-auto custom-scrollbar flex-grow"><TabelaDuplicados dados={duplicadosTabela} /></div></div></div>
          </div>
        </FullScreenPortal>
      )}

    </div>
  )
}
