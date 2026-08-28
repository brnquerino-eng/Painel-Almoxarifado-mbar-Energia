export function fmtBRL(val) {
  if (val == null || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

export function fmtInt(val) {
  if (val == null || isNaN(val)) return '0'
  return new Intl.NumberFormat('pt-BR').format(Math.round(val))
}

export function fmtDec(val) {
  if (val == null || isNaN(val)) return '0,00x'
  return (
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val) + 'x'
  )
}

export function fmtMes(val) {
  if (val == null || isNaN(val)) return '0,00'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

export function fmtValorCurto(val) {
  if (val >= 1e9) return `R$ ${(val / 1e9).toFixed(1).replace('.', ',')}B`
  if (val >= 1e6) return `R$ ${(val / 1e6).toFixed(1).replace('.', ',')}M`
  if (val >= 1e3) return `R$ ${(val / 1e3).toFixed(0).replace('.', ',')} mil`
  return fmtBRL(val)
}

export function calcTrend(atual, anterior, invert = false) {
  if (anterior === atual) {
    return { pct: '0,0%', className: 'trend-neutral', arrow: '➖' }
  }
  if (anterior === 0) {
    return {
      pct: '100,0%',
      className: invert ? 'trend-down' : 'trend-up',
      arrow: '🔺',
    }
  }
  const pct = ((atual - anterior) / anterior) * 100
  const pctStr = `${Math.abs(pct).toFixed(1).replace('.', ',')}%`
  if (pct > 0) {
    return {
      pct: pctStr,
      className: invert ? 'trend-down' : 'trend-up',
      arrow: '🔺',
    }
  }
  if (pct < 0) {
    return {
      pct: pctStr,
      className: invert ? 'trend-up' : 'trend-down',
      arrow: '🔻',
    }
  }
  return { pct: '0,0%', className: 'trend-neutral', arrow: '➖' }
}

export function isObsoleto(nomeLocal) {
  if (!nomeLocal) return false
  return String(nomeLocal).toLowerCase().includes('obsoleto')
}

export function isObra(nomeLocal) {
  if (!nomeLocal) return false
  return String(nomeLocal).toLowerCase().includes('obra')
}

export function isCritico(itemCritico) {
  return String(itemCritico) === '1-Sim'
}

export function isRotativo(tipo) {
  const t = String(tipo || '').toLowerCase()
  return t.includes('1') || t.includes('sim') || t.includes('rotativo')
}

export function periodoLabel(mes, ano) {
  const m = String(mes).padStart(2, '0')
  return `${m}/${ano}`
}

export function parsePeriodo(periodo) {
  if (!periodo) return null
  const [m, a] = periodo.split('/')
  return { mes: parseInt(m, 10), ano: parseInt(a, 10) }
}
