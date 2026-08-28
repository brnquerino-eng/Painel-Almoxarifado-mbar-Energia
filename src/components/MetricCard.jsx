import { calcTrend } from '../utils/format'
import clsx from 'clsx'

export default function MetricCard({
  icon,
  iconBg,
  title,
  value,
  valueAtual,
  valueAnterior,
  invertColor = false,
  fontSize = 'text-[22px]',
  children,
}) {
  const trend = calcTrend(valueAtual, valueAnterior, invertColor)

  return (
    <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 sm:p-5 min-h-[130px] flex flex-col justify-between shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:border-[#f58220]/40 hover:shadow-[0_8px_24px_rgba(245,130,32,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* 🚀 Tech Badge: Fundo translúcido com borda suave */}
          <div
            className={clsx(
              'w-9 h-9 rounded-xl flex items-center justify-center text-[15px] shrink-0 border border-white/5 shadow-inner',
              iconBg
            )}
          >
            {icon}
          </div>
          {/* 🚀 Tipografia Gringa: Espaçada e técnica */}
          <span className="text-[#8c9ba5] text-[10px] font-bold tracking-[0.15em] uppercase leading-tight mt-0.5">
            {title}
          </span>
        </div>
        {/* 🚀 Micro-pílula de Trend */}
        <div
          className={clsx(
            'flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono whitespace-nowrap shadow-sm border border-white/5',
            trend.className
          )}
        >
          {trend.arrow} {trend.pct}
        </div>
      </div>

      {children ? (
        children
      ) : (
        <div
          className={clsx(
            'text-white font-black text-center font-mono mt-4 whitespace-nowrap tracking-tight drop-shadow-sm',
            fontSize
          )}
        >
          {value}
        </div>
      )}
    </div>
  )
}
