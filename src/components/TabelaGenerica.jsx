import React, { useState, useEffect, useRef } from 'react'

export function TabelaGenerica({ dados = [], columns = [], highlightColor = '#f58220', emptyMessage = 'Nenhum item encontrado.' }) {
  const [indexSel, setIndexSel] = useState(null)
  const contRef = useRef(null)

  useEffect(() => {
    setIndexSel(null)
  }, [dados])

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
            {columns.map((col) => (
              <th
                key={col.key}
                className={`p-3.5 text-[#8c9ba5] font-bold text-xs uppercase tracking-wider ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222222]/50">
          {(dados || []).length > 0 ? (
            dados.map((item, idx) => {
              const isSelected = indexSel === idx
              return (
                <tr
                  key={item._rowKey || idx}
                  data-index={idx}
                  onClick={() => setIndexSel(prev => prev === idx ? null : idx)}
                  className={`cursor-pointer transition-colors group ${isSelected ? 'bg-[#2a2a2a]' : 'hover:bg-[#1a1a1a]'}`}
                  style={isSelected ? { boxShadow: `inset 4px 0 0 0 ${highlightColor}` } : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`p-3.5 text-xs ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.className || 'text-white'}`}
                      title={col.title ? col.title(item) : undefined}
                    >
                      {col.render ? col.render(item) : item[col.key]}
                    </td>
                  ))}
                </tr>
              )
            })
          ) : (
            <tr>
              <td colSpan={columns.length || 1} className="text-center py-8 text-muted text-sm tracking-wide">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}