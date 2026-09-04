import React from 'react'

export function ExecutiveCard({
  cardKey, icon, iconBg, title, value, valueAtual = null, valueAnterior = null, invertColor = false,
  variant = 'default', valueFontSize = 'text-base lg:text-lg', alignCenter = false, paddingClass = 'p-5',
  activeCard, onCardClick, children
}) {
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
      onClick={() => onCardClick && onCardClick(cardKey)}
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