import { useMemo, useState, useCallback, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { fmtBRL, fmtInt, isRotativo } from '../utils/format'

const MAPA_MESES = {
  '1': '01 - Janeiro', '2': '02 - Fevereiro', '3': '03 - Março', '4': '04 - Abril',
  '5': '05 - Maio', '6': '06 - Junho', '7': '07 - Julho', '8': '08 - Agosto',
  '9': '09 - Setembro', '10': '10 - Outubro', '11': '11 - Novembro', '12': '12 - Dezembro',
}

const MAPA_TIPOS = { '0-Não': 'Geral', '1-Sim': 'Rotativo' }
const MAPA_TIPOS_INV = Object.fromEntries(Object.entries(MAPA_TIPOS).map(([k, v]) => [v, k]))

function limparId(val) {
  try { return String(parseInt(Number(val), 10)) } 
  catch { return String(val).trim() }
}

function limparIdLocal(val) {
  if (!val) return ''
  const match = String(val).match(/\d+/)
  return match ? match[0] : String(val).trim()
}

const formatMesAno = (mes, ano) => {
  if (!mes || !ano) return ''
  const nomeMes = MAPA_MESES[String(parseInt(mes, 10))] || String(mes)
  return `${nomeMes.split(' - ')[1].substring(0,3).toUpperCase()}/${String(ano).slice(-2)}`
}

const getMesAtualTag = () => {
  const dataDeHoje = new Date()
  return formatMesAno(String(dataDeHoje.getMonth() + 1), String(dataDeHoje.getFullYear()))
}

const PLOT_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#8c9ba5', family: 'Inter' },
  margin: { l: 20, r: 20, t: 40, b: 45 },
  showlegend: false,
  hovermode: 'closest',
  dragmode: false,
}

// ------------------------------------------------------------------------
// Componente CyberMultiSelect 
// ------------------------------------------------------------------------
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
        <span className="truncate max-w-[140px] font-medium tracking-wide flex items-center gap-1.5 text-xs">
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
              <input type="text" className="w-full bg-[#161616] border border-[#2A2A2A] rounded-md pl-7 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent focus:shadow-[0_0_8px_rgba(245,130,32,0.2)] placeholder-dark-400 font-medium transition-all" placeholder="Digite para buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2 px-1 pb-2 border-b border-[#2A2A2A]">
              <button type="button" onClick={() => onChange([...options])} className="bg-[#1a1a1a] hover:bg-accent/10 hover:text-accent hover:border-accent/50 text-white text-[10px] font-bold py-2 rounded-md transition-all border border-[#2A2A2A] tracking-widest uppercase shadow-sm">Todas</button>
              <button type="button" onClick={() => onChange([])} className="bg-[#1a1a1a] hover:bg-danger/10 hover:text-danger hover:border-danger/50 text-white text-[10px] font-bold py-2 rounded-md transition-all border border-[#2A2A2A] tracking-widest uppercase shadow-sm">Limpar</button>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar p-1 space-y-0.5 mt-1 relative z-50">
              {filtradas.length === 0 && <div className="text-muted text-xs p-3 text-center tracking-wide">Nenhuma opção encontrada</div>}
              {filtradas.map(opt => (
                <label key={String(opt)} className="flex items-center gap-3 px-2.5 py-2 hover:bg-[#222222] rounded-lg cursor-pointer text-xs text-white transition-colors font-medium group">
                  <input type="checkbox" className="hidden" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} />
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all shrink-0 ${selected.includes(opt) ? 'bg-accent border-accent shadow-[0_0_8px_rgba(245,130,32,0.5)]' : 'border-[#444] group-hover:border-accent/50'}`}>
                    {selected.includes(opt) && <svg className="w-2.5 h-2.5 text-[#101010]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
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
// ------------------------------------------------------------------------

export default function PainelInventarios({ data }) {
  const [empresaSel, setEmpresaSel] = useState([])
  const [tipoSel, setTipoSel] = useState([])
  const [anoSel, setAnoSel] = useState([])
  
  const [idInvSel, setIdInvSel] = useState([])
  const [mesClicado, setMesClicado] = useState(null)
  
  const [vis, setVis] = useState({ total: true, geral: false, rotativo: false })
  const [activeCard, setActiveCard] = useState(null)
  const [activeIds, setActiveIds] = useState({}) 
  const [expanded, setExpanded] = useState(false)

  const toggleVis = useCallback((key) => setVis((v) => ({ ...v, [key]: !v[key] })), [])
  const handleCardClick = useCallback((key) => setActiveCard(prev => prev === key ? null : key), [])

  const handleExportExcel = useCallback(() => alert("🚀 EXCEL: Gerando planilha formatadinha!"), [])
  const handleExportPDF = useCallback(() => window.print(), [])
  const handleExportWord = useCallback(() => alert("📝 WORD: Gerando relatório executivo!"), [])

  const dfMaster = useMemo(() => {
    let df = data.filter((r) => r.id_inventario && String(r.id_inventario).trim() !== '' && String(r.id_inventario).toLowerCase() !== 'none')
    if (empresaSel.length) df = df.filter((r) => empresaSel.includes(r.empresa_nome))
    if (anoSel.length) df = df.filter((r) => anoSel.includes(String(r.ano_referencia)))
    return df
  }, [data, empresaSel, anoSel])

  const listasMaster = useMemo(() => {
    const empresas = [...new Set(dfMaster.map((r) => r.empresa_nome).filter(Boolean))].sort()
    const tiposBruto = [...new Set(dfMaster.map((r) => r.tipo_inventario).filter(Boolean))].sort()
    const tiposVisual = tiposBruto.map((t) => MAPA_TIPOS[t] || t)
    const anos = [...new Set(dfMaster.map((r) => r.ano_referencia).filter(Boolean))].sort((a, b) => Number(b) - Number(a))
    return { empresas, tiposVisual, anos }
  }, [dfMaster])

  useMemo(() => {
    if (listasMaster.anos.length && anoSel.length === 0) setAnoSel([listasMaster.anos[0]])
  }, [listasMaster])

  const chartEvolucao = useMemo(() => {
    let anosAlvo = anoSel.length > 0 ? anoSel.map(String) : null
    if (!anosAlvo || anosAlvo.length === 0) {
      let dfBaseAnos = data.filter(r => r.id_inventario && String(r.id_inventario).trim() !== '' && String(r.id_inventario).toLowerCase() !== 'none')
      if (empresaSel.length) dfBaseAnos = dfBaseAnos.filter(r => empresaSel.includes(r.empresa_nome))
      anosAlvo = [...new Set(dfBaseAnos.map(r => String(r.ano_referencia)).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
    }
    if (!anosAlvo.length) {
      anosAlvo = [String(new Date().getFullYear())]
    }

    const agora = new Date()
    const anoAtualNum = agora.getFullYear()
    const mesAtualNum = agora.getMonth() + 1

    const grupos = {}
    anosAlvo.sort().forEach(ano => {
      const numAno = Number(ano)
      const limiteMes = numAno === anoAtualNum ? mesAtualNum : (numAno < anoAtualNum ? 12 : 0)

      for (let m = 1; m <= limiteMes; m++) {
        const mesStr = String(m)
        const mesFormatado = mesStr.padStart(2, '0')
        const chave = `${ano}-${mesFormatado}`
        const label = formatMesAno(mesStr, ano)
        grupos[chave] = { label, order: chave, total: new Set(), rotativo: new Set(), geral: new Set() }
      }
    })

    dfMaster.forEach(r => {
      if (!r.mes_referencia || !r.ano_referencia) return
      const mesFormatado = String(r.mes_referencia).padStart(2, '0')
      const anoFormatado = String(r.ano_referencia)
      const chave = `${anoFormatado}-${mesFormatado}`

      if (grupos[chave]) {
        const uid = limparId(r.id_inventario)
        grupos[chave].total.add(uid)
        if (isRotativo(r.tipo_inventario)) grupos[chave].rotativo.add(uid)
        else grupos[chave].geral.add(uid)
      }
    })

    const sorted = Object.values(grupos).sort((a, b) => a.order.localeCompare(b.order))

    return {
      x: sorted.map(g => g.label),
      total: sorted.map(g => g.total.size),
      geral: sorted.map(g => g.geral.size),
      rotativo: sorted.map(g => g.rotativo.size)
    }
  }, [data, dfMaster, empresaSel, anoSel])

  useEffect(() => {
    if (data && data.length > 0 && chartEvolucao.x.length > 0) {
      const mesAtual = getMesAtualTag()
      if (chartEvolucao.x.includes(mesAtual)) {
        setMesClicado(mesAtual)
      } else {
        setMesClicado(chartEvolucao.x[chartEvolucao.x.length - 1]) 
      }
    }
  }, [data, chartEvolucao.x])

  const handleChartClick = useCallback((event) => {
    if (event.points && event.points.length > 0) {
      const clickedX = event.points[0].x
      setMesClicado(prev => prev === clickedX ? null : clickedX) 
    }
  }, [])

  const handleGoToCurrent = () => {
    const mesAtual = getMesAtualTag()
    if (chartEvolucao.x.includes(mesAtual)) setMesClicado(mesAtual)
    else if (chartEvolucao.x.length > 0) setMesClicado(chartEvolucao.x[chartEvolucao.x.length - 1])
  }

  const mesAtualTag = getMesAtualTag()
  const isCurrentMonth = mesClicado === mesAtualTag || (!chartEvolucao.x.includes(mesAtualTag) && mesClicado === chartEvolucao.x[chartEvolucao.x.length - 1])

  const dfPainel = useMemo(() => {
    let df = dfMaster
    if (mesClicado) df = df.filter(r => formatMesAno(r.mes_referencia, r.ano_referencia) === mesClicado)
    if (tipoSel.length) df = df.filter(r => tipoSel.map(t => MAPA_TIPOS_INV[t] || t).includes(String(r.tipo_inventario)))
    if (idInvSel.length) df = df.filter(r => idInvSel.includes(limparId(r.id_inventario)))
    return df
  }, [dfMaster, mesClicado, tipoSel, idInvSel])

  const idsInventariosDisponiveis = useMemo(() => {
    let dfParaIds = dfMaster
    if (mesClicado) dfParaIds = dfParaIds.filter(r => formatMesAno(r.mes_referencia, r.ano_referencia) === mesClicado)
    if (tipoSel.length) dfParaIds = dfParaIds.filter(r => tipoSel.map(t => MAPA_TIPOS_INV[t] || t).includes(String(r.tipo_inventario)))
    return [...new Set(dfParaIds.map((r) => limparId(r.id_inventario)).filter(Boolean))].sort((a, b) => (Number(a) || 0) - (Number(b) || 0))
  }, [dfMaster, mesClicado, tipoSel])

  const { empresasDisponiveis, dictEmpresas, dfInv } = useMemo(() => {
    const empresas = [...new Set(dfPainel.map((r) => r.empresa_nome).filter(Boolean))].sort()
    const dict = {}
    const excluidos = new Set()

    for (const emp of empresas) {
      const subset = dfPainel.filter((r) => r.empresa_nome === emp)
      const todosIds = [...new Set(subset.map((r) => limparId(r.id_inventario)))].sort((a, b) => (Number(a) || 0) - (Number(b) || 0))
      const idsAtivos = []
      
      for (const uid of todosIds) {
        const key = `${emp}||${uid}`
        if (activeIds[key] !== false) idsAtivos.push(uid)
        else excluidos.add(key)
      }

      const ativosRows = subset.filter((r) => idsAtivos.includes(limparId(r.id_inventario)))
      const idsGeral = [], idsRotativo = []
      const locaisSet = new Set()
      
      for (const row of ativosRows) {
        const uid = limparId(row.id_inventario)
        if (isRotativo(row.tipo_inventario)) { if (!idsRotativo.includes(uid)) idsRotativo.push(uid) } 
        else { if (!idsGeral.includes(uid)) idsGeral.push(uid) }

        const rawLoc = row.id_local_estoque || row.local_estoque_id || row.local_estoque || row.local || row.deposito || row.codigo_local
        const cleanLoc = limparIdLocal(rawLoc)
        if (cleanLoc) locaisSet.add(cleanLoc)
      }

      const locaisEstoqueStr = locaisSet.size > 0 ? Array.from(locaisSet).sort((a, b) => (Number(a) || 0) - (Number(b) || 0)).join(', ') : '—'

      dict[emp] = { todosIds, idsGeral: idsGeral.sort((a, b) => (Number(a) || 0) - (Number(b) || 0)), idsRotativo: idsRotativo.sort((a, b) => (Number(a) || 0) - (Number(b) || 0)), qtdAtiva: idsAtivos.length, locaisEstoqueStr }
    }
    const filtered = excluidos.size ? dfPainel.filter((r) => !excluidos.has(`${r.empresa_nome}||${limparId(r.id_inventario)}`)) : dfPainel
    return { empresasDisponiveis: empresas, dictEmpresas: dict, dfInv: filtered }
  }, [dfPainel, activeIds])

  const stats = useMemo(() => {
    if (!dfInv.length) return {
      totalInvs: 0, invsRotativos: 0, invsGeral: 0, 
      finalizadosCount: 0, rotativosFinalizadosCount: 0, geralFinalizadosCount: 0, idsPendentes: [], idsComDivergencia: [],
      totalLinhas: 0, skusUnicos: 0, valCongelado: 0,
      linhasContadas: 0, skusContados: 0, valContado: 0, itensDivergentes: 0, qtdSobras: 0, valSobras: 0, 
      qtdPerdas: 0, valPerdas: 0, diffLiquida: 0, acuraciaItens: 100, acuraciaValor: 100, acuraciaLiquida: 100, qtdeLocaisEstoque: 0, locaisContados: 0
    }

    const uniqueInvs = new Set(dfInv.map((r) => r.id_inventario))
    let invsRotativos = 0, invsGeral = 0
    for (const invId of uniqueInvs) {
      const tipos = [...new Set(dfInv.filter((r) => r.id_inventario === invId).map((r) => r.tipo_inventario))]
      if (tipos.some(isRotativo)) invsRotativos++
      else invsGeral++
    }

    const invsFinalizadosSet = new Set(
      dfInv.filter(r => r.data_fim && String(r.data_fim).trim() !== '' && String(r.data_fim).toLowerCase() !== 'none' && String(r.data_fim).toLowerCase() !== 'null')
           .map(r => r.id_inventario)
    )

    const idsPendentes = [...uniqueInvs].filter(id => !invsFinalizadosSet.has(id)).map(limparId).sort((a, b) => Number(a) - Number(b))

    let finalizadosCount = invsFinalizadosSet.size
    let rotativosFinalizadosCount = 0
    let geralFinalizadosCount = 0
    for (const invId of invsFinalizadosSet) {
      const tipos = [...new Set(dfInv.filter((r) => r.id_inventario === invId).map((r) => r.tipo_inventario))]
      if (tipos.some(isRotativo)) rotativosFinalizadosCount++
      else geralFinalizadosCount++
    }

    const totalLinhas = dfInv.length
    const skusUnicos = new Set(dfInv.map((r) => r.codigo_produto).filter(Boolean)).size
    
    const valCongelado = dfInv.reduce((s, r) => s + (r.saldo_anterior_val || r.valor_congelado || r.val_congelado || r.saldo_anterior || r.vl_saldo_anterior || 0), 0)
    const locaisSet = new Set(dfInv.map(r => limparIdLocal(r.id_local_estoque || r.local_estoque_id || r.local_estoque || r.local || r.deposito || r.codigo_local)).filter(Boolean))
    
    const qtdeLocaisEstoque = locaisSet.size > 0 ? locaisSet.size : uniqueInvs.size
    const linhasContadas = totalLinhas
    const skusContados = skusUnicos
    const valContado = dfInv.reduce((s, r) => s + (r.saldo_anterior_val || r.valor_congelado || r.val_congelado || r.saldo_anterior || r.vl_saldo_anterior || 0) + (r.diferenca_val || r.val_diferenca || r.diff_val || 0), 0)
    const locaisContados = qtdeLocaisEstoque
    
    const rowsDivergentes = dfInv.filter((r) => Math.abs(r.diferenca_qtd || r.qtd_diferenca || r.diff_qtd || 0) > 0 || Math.abs(r.diferenca_val || r.val_diferenca || r.diff_val || 0) !== 0)
    const itensDivergentes = rowsDivergentes.length
    const idsComDivergencia = [...new Set(rowsDivergentes.map(r => limparId(r.id_inventario)))].sort((a, b) => Number(a) - Number(b))

    const qtdSobrasRaw = dfInv.filter((r) => (r.diferenca_qtd || r.qtd_diferenca || r.diff_qtd || 0) > 0).reduce((s, r) => s + Math.abs(r.diferenca_qtd || r.qtd_diferenca || r.diff_qtd || 0), 0)
    const qtdSobras = qtdSobrasRaw > 0 ? qtdSobrasRaw : dfInv.filter((r) => (r.diferenca_val || r.val_diferenca || r.diff_val || 0) > 0).length
    
    const valSobras = dfInv.filter((r) => (r.diferenca_val || r.val_diferenca || r.diff_val || 0) > 0).reduce((s, r) => s + (r.diferenca_val || r.val_diferenca || r.diff_val || 0), 0)
    
    const qtdPerdasRaw = dfInv.filter((r) => (r.diferenca_qtd || r.qtd_diferenca || r.diff_qtd || 0) < 0).reduce((s, r) => s + Math.abs(r.diferenca_qtd || r.qtd_diferenca || r.diff_qtd || 0), 0)
    const qtdPerdas = qtdPerdasRaw > 0 ? qtdPerdasRaw : dfInv.filter((r) => (r.diferenca_val || r.val_diferenca || r.diff_val || 0) < 0).length
    
    const valPerdas = dfInv.filter((r) => (r.diferenca_val || r.val_diferenca || r.diff_val || 0) < 0).reduce((s, r) => s + (r.diferenca_val || r.val_diferenca || r.diff_val || 0), 0)
    
    const diffLiquida = valSobras + valPerdas
    const linhasSemDiv = totalLinhas - itensDivergentes
    const acuraciaItens = totalLinhas > 0 ? (linhasSemDiv / totalLinhas) * 100 : 100
    
    const divergAbs = dfInv.reduce((s, r) => s + Math.abs(r.diferenca_val || r.val_diferenca || r.diff_val || 0), 0)
    const acuraciaValor = valCongelado > 0 ? Math.max(0, (1 - divergAbs / valCongelado) * 100) : (divergAbs === 0 ? 100 : 0)
    
    const acuraciaLiquida = valCongelado > 0 ? Math.max(0, (1 - Math.abs(diffLiquida) / valCongelado) * 100) : (diffLiquida === 0 ? 100 : 0)

    return {
      totalInvs: uniqueInvs.size, invsRotativos, invsGeral,
      finalizadosCount, rotativosFinalizadosCount, geralFinalizadosCount, idsPendentes, idsComDivergencia,
      totalLinhas, skusUnicos, valCongelado,
      linhasContadas, skusContados, valContado, itensDivergentes, qtdSobras, valSobras, qtdPerdas, 
      valPerdas, diffLiquida, acuraciaItens, acuraciaValor, acuraciaLiquida, qtdeLocaisEstoque, locaisContados
    }
  }, [dfInv])

  const prevMetrics = useMemo(() => {
    if (!chartEvolucao.x.length) return { acuFis: 0, acuFin: 0, acuLiq: 0, taxaDiv: 0, impBruto: 0, impLiq: 0, label: 'Anterior', hasData: false }
    const currentIndex = mesClicado ? chartEvolucao.x.indexOf(mesClicado) : chartEvolucao.x.length - 1
    if (currentIndex <= 0) return { acuFis: 0, acuFin: 0, acuLiq: 0, taxaDiv: 0, impBruto: 0, impLiq: 0, label: 'Início', hasData: false }
    
    const prevMonthLabel = chartEvolucao.x[currentIndex - 1]
    const dfPrev = dfMaster.filter(r => formatMesAno(r.mes_referencia, r.ano_referencia) === prevMonthLabel)
    if (!dfPrev.length) return { acuFis: 0, acuFin: 0, acuLiq: 0, taxaDiv: 0, impBruto: 0, impLiq: 0, label: prevMonthLabel, hasData: false }

    const totalLinhas = dfPrev.length
    const itensDivergentes = dfPrev.filter((r) => Math.abs(r.diferenca_qtd || r.qtd_diferenca || r.diff_qtd || 0) > 0 || Math.abs(r.diferenca_val || r.val_diferenca || r.diff_val || 0) !== 0).length
    const acuFis = totalLinhas > 0 ? ((totalLinhas - itensDivergentes) / totalLinhas) * 100 : 100

    const valCongelado = dfPrev.reduce((s, r) => s + (r.saldo_anterior_val || r.valor_congelado || r.val_congelado || r.saldo_anterior || r.vl_saldo_anterior || 0), 0)
    const divergAbs = dfPrev.reduce((s, r) => s + Math.abs(r.diferenca_val || r.val_diferenca || r.diff_val || 0), 0)
    const acuFin = valCongelado > 0 ? Math.max(0, (1 - divergAbs / valCongelado) * 100) : (divergAbs === 0 ? 100 : 0)

    const taxaDiv = totalLinhas > 0 ? (itensDivergentes / totalLinhas) * 100 : 0

    const valSobras = dfPrev.filter((r) => (r.diferenca_val || r.val_diferenca || r.diff_val || 0) > 0).reduce((s, r) => s + (r.diferenca_val || r.val_diferenca || r.diff_val || 0), 0)
    const valPerdas = dfPrev.filter((r) => (r.diferenca_val || r.val_diferenca || r.diff_val || 0) < 0).reduce((s, r) => s + (r.diferenca_val || r.val_diferenca || r.diff_val || 0), 0)
    const impBruto = valCongelado > 0 ? ((Math.abs(valSobras) + Math.abs(valPerdas)) / valCongelado) * 100 : 0

    const diffLiq = valSobras + valPerdas
    const impLiq = valCongelado > 0 ? (diffLiq / valCongelado) * 100 : 0
    const acuLiq = valCongelado > 0 ? Math.max(0, (1 - Math.abs(diffLiq) / valCongelado) * 100) : (diffLiq === 0 ? 100 : 0)

    return { acuFis, acuFin, acuLiq, taxaDiv, impBruto, impLiq, label: prevMonthLabel, hasData: true }
  }, [dfMaster, chartEvolucao.x, mesClicado])

  const toggleInv = useCallback((emp, uid, checked) => setActiveIds((prev) => ({ ...prev, [`${emp}||${uid}`]: checked })), [])
  const toggleAllEmp = useCallback((emp, ids, selectAll) => { setActiveIds((prev) => { const next = { ...prev }; for (const uid of ids) next[`${emp}||${uid}`] = selectAll; return next }) }, [])

  if (!data.length) { return <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl text-center py-16 text-muted shadow-xl text-xs">⚠️ Nenhum dado de inventário encontrado na base.</div> }

  const isMasterSel = activeCard === 'master_operacional'
  const isAcuFisSel = activeCard === 'acuracia_fisica'
  const isAcuFinSel = activeCard === 'acuracia_financeira'
  const isAcuLiqSel = activeCard === 'acuracia_liquida'
  const isEvolSel = activeCard === 'evolucao_comparativa'

  const DONUT_LAYOUT = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 0, r: 0, t: 0, b: 0 }, height: 150, showlegend: false }

  const UnifiedRow = ({ icon, label, valFoto, valRes }) => {
    const isMatch = valFoto === valRes
    const resColor = isMatch ? 'text-white' : 'text-accent'
    const statusColor = isMatch ? 'text-[#2ecc71]' : 'text-accent'
    const statusIcon = isMatch ? '✓' : '✕'
    
    return (
      <div className="grid grid-cols-12 items-center py-1.5 border-b border-[#222222]/40 hover:bg-[#1a1a1a] transition-colors rounded-lg px-2">
        <div className="col-span-5 flex items-center gap-2">
          <div className="text-[#60a5fa]">{icon}</div>
          <span className="text-xs text-[#8c9ba5] font-medium">{label}</span>
        </div>
        <div className="col-span-3 text-center">
          <span className="font-mono font-bold text-[#60a5fa] text-xs">{fmtInt(valFoto)}</span>
        </div>
        <div className="col-span-3 text-center">
          <span className={`font-mono font-bold text-xs ${resColor}`}>{fmtInt(valRes)}</span>
        </div>
        <div className="col-span-1 text-right">
          <span className={`text-xs font-black ${statusColor}`}>{statusIcon}</span>
        </div>
      </div>
    )
  }

  const maxGrafico = Math.max(...(chartEvolucao.total.length ? chartEvolucao.total : [10]), 10)

  const chartShapes = useMemo(() => {
    if (!mesClicado || !chartEvolucao.x.length) return []
    const index = chartEvolucao.x.indexOf(mesClicado)
    if (index === -1) return []
    return [
      { type: 'line', xref: 'x', yref: 'paper', x0: index, x1: index, y0: 0, y1: 1, line: { color: '#f58220', width: 1.5, dash: 'dot' }, layer: 'below' },
      { type: 'rect', xref: 'x', yref: 'paper', x0: index - 0.15, x1: index + 0.15, y0: 0, y1: 1, fillcolor: 'rgba(245, 130, 32, 0.08)', line: { width: 0 }, layer: 'below' },
    ]
  }, [chartEvolucao.x, mesClicado])

  const chartAnnotations = useMemo(() => {
    let anns = []
    if (vis.total) {
      anns.push(...chartEvolucao.x.map((xVal, index) => ({
        x: xVal, y: chartEvolucao.total[index], text: `<b>${chartEvolucao.total[index]}</b>`, showarrow: false,
        ax: 0, ay: -26, font: { size: 10, color: '#ffffff', family: 'Inter' },
        bgcolor: mesClicado === xVal ? 'rgba(245,130,32,0.9)' : 'rgba(22, 22, 22, 0.85)',
        bordercolor: '#f58220', borderwidth: 1, borderpad: 4
      })))
    }
    if (vis.rotativo) {
      anns.push(...chartEvolucao.x.map((xVal, index) => ({
        x: xVal, y: chartEvolucao.rotativo[index], text: `<b>${chartEvolucao.rotativo[index]}</b>`, showarrow: false,
        ax: 0, ay: 18, font: { size: 10, color: '#ffffff', family: 'Inter' },
        bgcolor: mesClicado === xVal ? 'rgba(46,204,113,0.9)' : 'rgba(22, 22, 22, 0.85)',
        bordercolor: '#2ecc71', borderwidth: 1, borderpad: 4
      })))
    }
    if (vis.geral) {
      anns.push(...chartEvolucao.x.map((xVal, index) => ({
        x: xVal, y: chartEvolucao.geral[index], text: `<b>${chartEvolucao.geral[index]}</b>`, showarrow: false,
        ax: 0, ay: 36, font: { size: 10, color: '#ffffff', family: 'Inter' },
        bgcolor: mesClicado === xVal ? 'rgba(231,76,60,0.9)' : 'rgba(22, 22, 22, 0.85)',
        bordercolor: '#e74c3c', borderwidth: 1, borderpad: 4
      })))
    }
    anns.push(...chartEvolucao.x.map((xVal, index) => ({
      x: xVal, y: 0, yref: 'paper', yanchor: 'top', text: `<b>${xVal}</b>`, showarrow: false,
      ay: 22, font: { size: 10, color: mesClicado === xVal ? '#ffffff' : '#8c9ba5', family: 'Inter' },
      bgcolor: mesClicado === xVal ? 'rgba(245,130,32,0.85)' : 'rgba(0,0,0,0)',
      bordercolor: mesClicado === xVal ? '#f58220' : 'rgba(0,0,0,0)', borderwidth: mesClicado === xVal ? 1 : 0, borderpad: 3
    })))
    return anns
  }, [chartEvolucao, vis, mesClicado])

  const getCor = (val) => val >= 95 ? '#2ecc71' : val >= 80 ? '#f58220' : '#e74c3c'
  const getCorBg = (val) => val >= 95 ? '#111c16' : val >= 80 ? '#1c1612' : '#2a1616'
  const getStatusConf = (val) => val >= 95 ? 'EXCELENTE' : val >= 80 ? 'ATENÇÃO' : 'CRÍTICO'

  const corAcuFis = getCor(stats.acuraciaItens)
  const corAcuFisBg = getCorBg(stats.acuraciaItens)
  const corAcuFin = getCor(stats.acuraciaValor)
  const corAcuFinBg = getCorBg(stats.acuraciaValor)
  const corAcuLiq = getCor(stats.acuraciaLiquida)
  const corAcuLiqBg = getCorBg(stats.acuraciaLiquida)

  const pctConclusao = stats.totalInvs > 0 ? Math.floor((stats.finalizadosCount / stats.totalInvs) * 100) : 100
  const is100Percent = pctConclusao === 100
  const diffValContado = stats.valContado - stats.valCongelado
  const corValContado = diffValContado > 0 ? 'text-accent' : diffValContado < 0 ? 'text-danger' : 'text-white'

  const atualAcuFis = stats.acuraciaItens
  const atualAcuFin = stats.acuraciaValor
  const atualAcuLiq = stats.acuraciaLiquida
  const atualTaxaDiv = stats.totalLinhas > 0 ? (stats.itensDivergentes / stats.totalLinhas) * 100 : 0
  const atualImpBruto = stats.valCongelado > 0 ? ((Math.abs(stats.valSobras) + Math.abs(stats.valPerdas)) / stats.valCongelado) * 100 : 0
  const atualImpLiq = stats.valCongelado > 0 ? (stats.diffLiquida / stats.valCongelado) * 100 : 0

  const diffAcuFis = atualAcuFis - prevMetrics.acuFis
  const diffAcuFin = atualAcuFin - prevMetrics.acuFin
  const diffAcuLiq = atualAcuLiq - prevMetrics.acuLiq
  const diffTaxaDiv = atualTaxaDiv - prevMetrics.taxaDiv
  const diffImpBruto = atualImpBruto - prevMetrics.impBruto
  const diffImpLiq = atualImpLiq - prevMetrics.impLiq

  return (
    <div className="space-y-6 animate-fade-in bg-[#080808] min-h-screen p-2 sm:p-4 text-white relative">
      
      {/* CABEÇALHO SUPERIOR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/40 shadow-inner">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <h2 className="text-white text-sm font-bold tracking-wider uppercase">GESTÃO E FECHAMENTO EXECUTIVO DE INVENTÁRIOS</h2>
        </div>
        
        <div className="flex items-center gap-2 bg-[#161616] border border-[#2A2A2A] rounded-xl p-1 shadow-inner">
           <button onClick={handleExportExcel} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#1a2e22] text-[#2ecc71] border border-[#2ecc71]/40 hover:bg-[#203a2b] transition-all flex items-center gap-1.5 shadow-sm"><span>📥</span> Excel</button>
           <button onClick={handleExportPDF} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#2a1616] text-[#e74c3c] border border-[#e74c3c]/40 hover:bg-[#3a1c1c] transition-all flex items-center gap-1.5 shadow-sm"><span>📄</span> PDF</button>
           <button onClick={handleExportWord} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#162432] text-[#3498db] border border-[#3498db]/40 hover:bg-[#1c2e40] transition-all flex items-center gap-1.5 shadow-sm"><span>📝</span> Word</button>
        </div>
      </div>

      {/* BLOCO MESTRE UNIFICADO (Gráfico + Tabela) */}
      <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] relative z-40 flex flex-col hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)] transition-all duration-300 group space-y-6">
         <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
         
         <div>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 pb-4 border-b border-[#2A2A2A]">
               <div>
                  <div className="text-[10px] font-bold text-accent tracking-[0.2em] uppercase mb-1">Painel Gerencial Âmbar Energia</div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2.5 tracking-wide uppercase">
                    <svg className="w-5 h-5 text-accent shrink-0 drop-shadow-[0_0_8px_rgba(245,130,32,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    Evolução Temporal dos Inventários
                  </h2>
               </div>

               <div className="flex flex-wrap items-end gap-3 z-30">
                  <div>
                     <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">Empresa</label>
                     <CyberMultiSelect options={listasMaster.empresas} selected={empresaSel} onChange={setEmpresaSel} placeholder="Todas" />
                  </div>
                  <div>
                     <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">Ano</label>
                     <CyberMultiSelect options={listasMaster.anos} selected={anoSel} onChange={setAnoSel} placeholder="Todos" />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
               {[ 
                 { key: 'total', label: 'Total Inventários', color: '#f58220', bg: 'rgba(245,130,32,0.15)', shadow: 'rgba(245,130,32,0.3)' }, 
                 { key: 'geral', label: 'Inventários Gerais', color: '#e74c3c', bg: 'rgba(231,76,60,0.15)', shadow: 'rgba(231,76,60,0.3)' }, 
                 { key: 'rotativo', label: 'Inventários Rotativos', color: '#2ecc71', bg: 'rgba(46,204,113,0.15)', shadow: 'rgba(46,204,113,0.3)' } 
               ].map(({ key, label, color, bg, shadow }) => {
                 const isActive = vis[key]
                 const hasData = chartEvolucao[key] && chartEvolucao[key].some(v => v > 0)
                 
                 return (
                   <button 
                     key={key} 
                     onClick={() => hasData && toggleVis(key)} 
                     disabled={!hasData} 
                     className={`relative flex items-center justify-center gap-2 px-4 py-2 text-xs transition-all duration-300 rounded-lg overflow-hidden border ${
                       !hasData ? 'opacity-30 grayscale cursor-not-allowed border-transparent text-dark-400 bg-transparent' : 
                       !isActive ? 'text-[#8c9ba5] hover:text-white hover:bg-[#222222]/50 border-[#2A2A2A]' : 
                       'font-bold text-white'
                     }`}
                     style={isActive && hasData ? {
                       borderColor: color,
                       backgroundColor: bg,
                       boxShadow: `0 0 15px ${shadow}, inset 0 0 10px ${bg}`
                     } : {}}
                   >
                     {isActive && hasData && <span className="absolute bottom-0 left-0 w-full h-[3px] transition-all" style={{ backgroundColor: color, boxShadow: `0 -2px 10px ${color}` }} />}
                     <span className={`w-2 h-2 rounded-full transition-all ${!hasData ? 'bg-dark-500' : isActive ? 'animate-pulse' : 'bg-[#555]'}`} style={(isActive && hasData) ? { backgroundColor: color, boxShadow: `0 0 12px ${color}` } : {}} />
                     <span className={isActive ? 'drop-shadow-md tracking-wide text-white' : 'tracking-wide'}>{label}</span>
                   </button>
                 )
               })}
            </div>
            
            <div className="pt-2 z-10 relative">
              <Plot
                onClick={handleChartClick}
                data={[
                  { x: chartEvolucao.x, y: chartEvolucao.x.map(() => maxGrafico * 1.3), type: 'bar', marker: { color: 'rgba(245, 130, 32, 0.02)' }, hoverinfo: 'none', showlegend: false, cliponaxis: false },
                  vis.total && { x: chartEvolucao.x, y: chartEvolucao.total, type: 'scatter', mode: 'lines+markers', line: { color: '#f58220', width: 2, shape: 'spline', smoothing: 1.3 }, marker: { size: 10, color: '#080808', line: { color: '#f58220', width: 1.5 } }, fill: 'tozeroy', fillgradient: { type: 'vertical', colorscale: [['0', 'rgba(245,130,32,0.35)'], ['1', 'rgba(245,130,32,0.0)']] }, fillcolor: 'rgba(245,130,32,0.15)', hoverinfo: 'none', cliponaxis: false },
                  vis.geral && { x: chartEvolucao.x, y: chartEvolucao.geral, type: 'scatter', mode: 'lines+markers', line: { color: '#e74c3c', width: 1.5, dash: 'dash', shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#080808', line: { color: '#e74c3c', width: 1.5 } }, hoverinfo: 'none', cliponaxis: false },
                  vis.rotativo && { x: chartEvolucao.x, y: chartEvolucao.rotativo, type: 'scatter', mode: 'lines+markers', line: { color: '#2ecc71', width: 1.5, dash: 'longdash', shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#080808', line: { color: '#2ecc71', width: 1.5 } }, hoverinfo: 'none', cliponaxis: false }
                ].filter(Boolean)}
                layout={{
                  ...PLOT_LAYOUT, height: 350, bargap: 0, margin: { l: 20, r: 20, t: 40, b: 45 },
                  xaxis: { showgrid: false, zeroline: false, showticklabels: false, automargin: true },
                  yaxis: { showgrid: true, gridcolor: '#222222', zeroline: false, showticklabels: false, range: [-(maxGrafico * 0.15), maxGrafico * 1.3] },
                  shapes: chartShapes, annotations: chartAnnotations
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', cursor: 'pointer' }} useResizeHandler
              />
            </div>

            <div className="mt-4 pt-4 border-t border-[#2A2A2A] relative z-20">
              {mesClicado ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-accent/15 via-[#161616] to-accent/10 rounded-xl border border-accent/40 shadow-[0_4px_20px_rgba(245,130,32,0.15)] animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/40 shrink-0">
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <span className="text-xs text-white tracking-wide font-medium">
                      Filtro ativo por snapshot temporal: <b className="text-accent font-mono text-xs px-2 py-0.5 bg-[#080808] border border-accent/30 rounded shadow-inner ml-1">{mesClicado}</b>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                     {!isCurrentMonth && (
                       <button onClick={handleGoToCurrent} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-dark-900 font-bold text-xs transition-all duration-300 shadow-md"><span>Voltar ao Atual</span></button>
                     )}
                     <button onClick={() => setMesClicado(null)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-transparent border border-danger/50 hover:bg-danger/10 text-danger font-bold text-xs transition-all duration-300 shadow-md"><span>✖ Remover Filtro</span></button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111111]/60 border border-[#2A2A2A]/50 rounded-xl py-2 px-4 mx-auto shadow-inner w-fit">
                   <div className="flex items-center gap-2 text-center">
                      <svg className="w-4 h-4 text-accent shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-[11px] text-[#8c9ba5] tracking-wide font-medium">Dica: Clique em qualquer ponto/mês do gráfico acima para filtrar todo o painel.</span>
                   </div>
                </div>
              )}
            </div>
         </div>

         <div className="border border-[#2A2A2A] rounded-xl shadow-lg bg-[#111111]/40 transition-colors relative z-30">
            <div 
              className="px-4 py-3 border-b border-[#2A2A2A] bg-[#111111]/80 hover:bg-[#161616] flex items-center justify-between gap-4 cursor-pointer transition-colors w-full rounded-t-xl"
              onClick={(e) => { if (!e.target.closest('.filtros-tabela')) { setExpanded(!expanded) } }}
            >
               <div className="flex items-center gap-3 shrink-0">
                  <span className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-inner">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </span>
                  <span className="text-xs font-bold text-white tracking-wide uppercase hover:text-accent transition-colors truncate">INVENTÁRIOS - DETALHAMENTOS</span>
               </div>

               <div className="flex items-center gap-3 shrink-0 filtros-tabela" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 border-r border-[#333] pr-3">
                     <span className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase hidden sm:block">Tipo</span>
                     <CyberMultiSelect options={listasMaster.tiposVisual} selected={tipoSel} onChange={setTipoSel} placeholder="Todos" />
                  </div>
                  <div className="flex items-center gap-2 border-r border-[#333] pr-3">
                     <span className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase hidden sm:block">Nº ID</span>
                     <CyberMultiSelect options={idsInventariosDisponiveis} selected={idInvSel} onChange={setIdInvSel} placeholder="Todos IDs" />
                  </div>
                  <button onClick={() => setExpanded(!expanded)} className="text-muted text-xs p-1 hover:text-accent transition-colors flex items-center justify-center">{expanded ? '▲' : '▼'}</button>
               </div>
            </div>

            {expanded && (
              <div className="p-4 sm:p-5 bg-[#141414] animate-fade-in space-y-2 rounded-b-xl">
                <div className="bg-[#101010] border border-[#222222] rounded-xl px-3 py-2.5 shadow-inner grid grid-cols-12 gap-0 text-[10px] font-bold text-[#8c9ba5] uppercase tracking-wider items-center">
                  <div className="col-span-2 text-left border-r border-[#222222] pr-2">Nome da Empresa</div>
                  <div className="col-span-1 text-center border-r border-[#222222] px-1">(Qtde) Inv.</div>
                  <div className="col-span-2 text-center border-r border-[#222222] px-2">Local Estoque</div>
                  <div className="col-span-3 text-center border-r border-[#222222] px-2">Nº Inv. Geral</div>
                  <div className="col-span-3 text-center border-r border-[#222222] px-2">Nº Inv. Rotativo</div>
                  <div className="col-span-1 text-center pl-2">Gerenciar</div>
                </div>
                {empresasDisponiveis.map((emp) => {
                  const d = dictEmpresas[emp]
                  if (!d) return null
                  return <EmpresaRow key={emp} emp={emp} dados={d} activeIds={activeIds} onToggle={toggleInv} onToggleAll={toggleAllEmp} />
                })}
              </div>
            )}
         </div>
      </div>

      {/* 🌟 LAYOUT EM DUAS COLUNAS: LADO ESQUERDO (MASTER CARD OPERACIONAL) & LADO DIREITO (ACURÁCIAS + EVOLUÇÃO COMPARATIVA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 relative z-10">
        
        {/* COLUNA ESQUERDA (lg:col-span-6): Master Card Operacional */}
        <div className="lg:col-span-6 flex flex-col">
          <div 
            onClick={() => handleCardClick('master_operacional')}
            className={`bg-[#161616] border rounded-2xl p-5 sm:p-6 transition-all duration-300 transform relative flex flex-col justify-between group cursor-pointer h-full ${
              isMasterSel ? 'border-[#3498db] shadow-[0_0_25px_rgba(52,152,219,0.3)] bg-[#12181d] -translate-y-1 ring-1 ring-[#3498db]/50' : 'border-[#2A2A2A] hover:border-[#3498db]/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(52,152,219,0.15)]'
            }`}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-[#3498db]/50 to-transparent pointer-events-none" />

            {/* Cabeçalho do Master Card */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#3498db]/15 flex items-center justify-center text-[#3498db] shadow-inner shrink-0 border border-[#3498db]/30">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-xs font-bold tracking-[0.18em] text-white uppercase">PAINEL OPERACIONAL</h3>
              </div>
              
              <div className="flex items-center gap-2.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-1 border ${is100Percent ? 'text-[#2ecc71] bg-[#2ecc71]/10 border-[#2ecc71]/40' : 'text-accent bg-accent/10 border-accent/40'}`}>
                  {is100Percent ? 'CONCLUÍDO' : 'EM ANDAMENTO'} <span>{is100Percent ? '✓' : '✕'}</span>
                </span>
                <span className={`text-lg font-black font-mono tracking-tighter ${is100Percent ? 'text-[#2ecc71]' : 'text-accent'}`}>{pctConclusao}%</span>
              </div>
            </div>

            {/* Tabela Unificada: Foto Inicial vs Resultado */}
            <div className="bg-[#101010] border border-[#222222] rounded-xl p-3 shadow-inner flex flex-col mb-4">
              <div className="grid grid-cols-12 pb-2 border-b border-[#333333] mb-1.5 px-2 text-[10px] font-bold text-[#8c9ba5] uppercase tracking-widest">
                <div className="col-span-5">Métrica</div>
                <div className="col-span-3 text-center text-[#60a5fa]">FOTO INICIAL</div>
                <div className="col-span-3 text-center">RESULTADO</div>
                <div className="col-span-1"></div>
              </div>

              <UnifiedRow icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} label="Inventários" valFoto={stats.totalInvs} valRes={stats.finalizadosCount} />
              <UnifiedRow icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} label="Rotativos" valFoto={stats.invsRotativos} valRes={stats.rotativosFinalizadosCount} />
              <UnifiedRow icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} label="Gerais" valFoto={stats.invsGeral} valRes={stats.geralFinalizadosCount} />
              <UnifiedRow icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Locais Estoque" valFoto={stats.qtdeLocaisEstoque} valRes={stats.locaisContados} />
              <UnifiedRow icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>} label="Linhas" valFoto={stats.totalLinhas} valRes={stats.linhasContadas} />
              <UnifiedRow icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} label="SKUs" valFoto={stats.skusUnicos} valRes={stats.skusContados} />
            </div>

            {/* 🌟 VALOR INICIAL & VALOR CONTADO */}
            <div className="bg-[#0c0c0c] border-t border-x border-[#222222] rounded-t-xl p-3 shadow-inner grid grid-cols-2 gap-3 divide-x divide-[#222222]">
              <div className="flex flex-col justify-center pr-2">
                <span className="block text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold uppercase mb-0.5">VALOR INICIAL</span>
                <span className="block text-base font-black text-[#60a5fa] font-mono tracking-tight">{fmtBRL(stats.valCongelado)}</span>
              </div>
              <div className="flex flex-col justify-center pl-3">
                <span className="block text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold uppercase mb-0.5">VALOR CONTADO</span>
                <span className={`block text-base font-black font-mono tracking-tight ${corValContado}`}>
                  {fmtBRL(stats.valContado)}
                </span>
              </div>
            </div>

            {/* 🌟 DIFERENÇA LÍQUIDA */}
            <div className="bg-[#101010] border-x border-b border-[#222222] rounded-b-xl p-4 shadow-inner flex flex-col items-center justify-center text-center mb-4">
              <span className="text-[10px] text-[#8c9ba5] uppercase font-bold tracking-[0.2em] mb-1">DIFERENÇA LÍQUIDA</span>
              <span className={`text-xl font-black font-mono tracking-tight ${stats.diffLiquida > 0 ? 'text-[#2ecc71]' : stats.diffLiquida < 0 ? 'text-[#e74c3c]' : 'text-white'}`}>
                {stats.diffLiquida > 0 ? '+' : ''}{fmtBRL(stats.diffLiquida)}
              </span>
            </div>

            {/* 🌟 ITENS DIVERGENTES E SOBRAS / PERDAS */}
            <div className="bg-[#101010] border-x border-t border-[#222222] rounded-t-xl p-4 shadow-inner flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-[#8c9ba5] uppercase font-bold tracking-[0.2em] mb-1">ITENS DIVERGENTES</span>
              <span className="text-xl font-black font-mono tracking-tight text-white">
                {fmtInt(stats.itensDivergentes)} <span className="text-xs font-medium text-muted">registros</span>
              </span>
            </div>

            <div className="bg-[#0c0c0c] border-x border-b border-[#222222] rounded-b-xl p-4 shadow-inner grid grid-cols-2 gap-3 divide-x divide-[#222222]">
              <div className="flex flex-col justify-center pr-2">
                <span className="block text-xs text-[#2ecc71] font-bold uppercase mb-1">▲ Sobras (Mais)</span>
                <span className="block text-xs text-muted mb-1">Qtde: {fmtInt(stats.qtdSobras)} UN</span>
                <span className="block font-mono font-bold text-[#2ecc71] text-sm">{fmtBRL(stats.valSobras)}</span>
              </div>
              <div className="flex flex-col justify-center pl-4">
                <span className="block text-xs text-[#e74c3c] font-bold uppercase mb-1">▼ Perdas (Menos)</span>
                <span className="block text-xs text-muted mb-1">Qtde: {fmtInt(stats.qtdPerdas)} UN</span>
                <span className="block font-mono font-bold text-[#e74c3c] text-sm">{fmtBRL(stats.valPerdas)}</span>
              </div>
            </div>

            {/* 🌟 NOVO CARTÃO DE RAIO-X DOS INVENTÁRIOS (PENDÊNCIAS E DIVERGÊNCIAS) */}
            <div className="bg-[#101010] border border-[#222222] rounded-xl p-4 shadow-inner mt-4 flex flex-col gap-4 flex-grow">
              <span className="text-xs sm:text-sm text-[#8c9ba5] uppercase font-black tracking-[0.15em] text-center w-full block mb-2">
                RAIO-X DOS INVENTÁRIOS
              </span>
              
              <div className="grid grid-cols-2 gap-4 divide-x divide-[#222222] h-full">
                {/* PENDENTES DE FINALIZAÇÃO */}
                <div className="flex flex-col pr-2">
                  <span className="text-xs text-[#f1c40f] font-bold uppercase mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f1c40f] animate-pulse"></span> Pendentes
                  </span>
                  <span className="text-[10px] text-muted mb-2">Aguardando fechamento: <b className="text-white text-xs ml-1">{stats.idsPendentes.length}</b></span>
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    {stats.idsPendentes.length > 0 ? (
                      stats.idsPendentes.map(id => <span key={id} className="bg-[#1a1a1a] border border-[#333] text-[#f1c40f] px-1.5 py-0.5 rounded text-[10px] font-mono">{id}</span>)
                    ) : (
                      <span className="text-[10px] text-[#2ecc71] font-bold">✓ Nenhum pendente</span>
                    )}
                  </div>
                </div>

                {/* COM DIVERGÊNCIA */}
                <div className="flex flex-col pl-4">
                  <span className="text-xs text-accent font-bold uppercase mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span> Divergentes
                  </span>
                  <span className="text-[10px] text-muted mb-2">Com alguma divergência: <b className="text-white text-xs ml-1">{stats.idsComDivergencia.length}</b></span>
                  <div className="flex flex-wrap gap-1.5 mt-auto max-h-[80px] overflow-y-auto custom-scrollbar pr-1">
                    {stats.idsComDivergencia.length > 0 ? (
                      stats.idsComDivergencia.map(id => <span key={id} className="bg-[#1a1a1a] border border-[#333] text-accent px-1.5 py-0.5 rounded text-[10px] font-mono">{id}</span>)
                    ) : (
                      <span className="text-[10px] text-[#2ecc71] font-bold">✓ 100% Exatos</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* COLUNA DIREITA (lg:col-span-6): Acurácias e Evolução */}
        <div className="lg:col-span-6 space-y-6 flex flex-col">
          
          {/* 1. ACURÁCIA FÍSICA (ITENS) */}
          <div 
            onClick={() => handleCardClick('acuracia_fisica')}
            style={isAcuFisSel ? { backgroundColor: corAcuFisBg, borderColor: corAcuFis, boxShadow: `0 0 25px ${corAcuFis}55` } : {}}
            className={`bg-[#161616] border rounded-2xl p-5 flex flex-col sm:flex-row items-center transition-all duration-300 relative overflow-hidden cursor-pointer group ${
              isAcuFisSel ? 'border-opacity-100 -translate-y-1 ring-1' : 'border-[#2A2A2A] hover:-translate-y-1'
            }`}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent to-transparent pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, transparent, ${corAcuFis}, transparent)` }} />

            <div className="w-full sm:w-1/2 flex flex-col items-center sm:items-start text-center sm:text-left mb-4 sm:mb-0">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 shadow-inner border" style={{ backgroundColor: `${corAcuFis}15`, color: corAcuFis, borderColor: `${corAcuFis}40` }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-sm font-black tracking-[0.1em] text-white uppercase mb-1">ACURÁCIA FÍSICA (ITENS)</h3>
              <p className="text-[11px] text-muted leading-relaxed mb-3">Mede a precisão da contagem física linha a linha.</p>
              
              <div className="flex items-center gap-2 mb-3 bg-[#111111] border border-[#222222] px-2 py-1.5 rounded text-[10px] font-mono shadow-inner">
                 <span className="text-[#8c9ba5] uppercase">Taxa de Divergência:</span>
                 <span className="text-white font-bold">{atualTaxaDiv.toFixed(2)}%</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border shadow-sm" style={{ backgroundColor: `${corAcuFis}15`, borderColor: `${corAcuFis}35`, color: corAcuFis }}>
                 <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: corAcuFis }}></span>
                 <span>STATUS: {getStatusConf(atualAcuFis)}</span>
              </div>
            </div>
            
            <div className="w-full sm:w-1/2 flex justify-center items-center pointer-events-none relative min-w-[150px]">
              <Plot 
                data={[{ type: "pie", values: [stats.acuraciaItens, Math.max(0, 100 - stats.acuraciaItens)], hole: 0.72, sort: false, direction: 'clockwise', rotation: 90, textinfo: 'none', hoverinfo: 'none', marker: { colors: [corAcuFis, '#222222'], line: { width: 0 } } }]}
                layout={{ ...DONUT_LAYOUT, annotations: [{ text: `${stats.acuraciaItens.toFixed(2)}%`, font: { size: 18, color: corAcuFis, family: 'Inter', weight: 900 }, showarrow: false, x: 0.5, y: 0.5 }] }} 
                config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', maxWidth: '160px' }}
              />
            </div>
          </div>

          {/* 2. ACURÁCIA FINANCEIRA (BRUTA) */}
          <div 
            onClick={() => handleCardClick('acuracia_financeira')}
            style={isAcuFinSel ? { backgroundColor: corAcuFinBg, borderColor: corAcuFin, boxShadow: `0 0 25px ${corAcuFin}55` } : {}}
            className={`bg-[#161616] border rounded-2xl p-5 flex flex-col sm:flex-row items-center transition-all duration-300 relative overflow-hidden cursor-pointer group ${
              isAcuFinSel ? 'border-opacity-100 -translate-y-1 ring-1' : 'border-[#2A2A2A] hover:-translate-y-1'
            }`}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent to-transparent pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, transparent, ${corAcuFin}, transparent)` }} />

            <div className="w-full sm:w-1/2 flex flex-col items-center sm:items-start text-center sm:text-left mb-4 sm:mb-0">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 shadow-inner border" style={{ backgroundColor: `${corAcuFin}15`, color: corAcuFin, borderColor: `${corAcuFin}40` }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-sm font-black tracking-[0.1em] text-white uppercase mb-1">ACURÁCIA FINANCEIRA (BRUTA)</h3>
              <p className="text-[11px] text-muted leading-relaxed mb-3">Avalia o impacto financeiro absoluto sobre o saldo contábil.</p>
              
              <div className="flex items-center gap-2 mb-3 bg-[#111111] border border-[#222222] px-2 py-1.5 rounded text-[10px] font-mono shadow-inner">
                 <span className="text-[#8c9ba5] uppercase">Impacto Bruto:</span>
                 <span className="text-white font-bold">{atualImpBruto.toFixed(2)}%</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border shadow-sm" style={{ backgroundColor: `${corAcuFin}15`, borderColor: `${corAcuFin}35`, color: corAcuFin }}>
                 <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: corAcuFin }}></span>
                 <span>STATUS: {getStatusConf(atualAcuFin)}</span>
              </div>
            </div>
            
            <div className="w-full sm:w-1/2 flex justify-center items-center pointer-events-none relative min-w-[150px]">
              <Plot 
                data={[{ type: "pie", values: [stats.acuraciaValor, Math.max(0, 100 - stats.acuraciaValor)], hole: 0.72, sort: false, direction: 'clockwise', rotation: 90, textinfo: 'none', hoverinfo: 'none', marker: { colors: [corAcuFin, '#222222'], line: { width: 0 } } }]}
                layout={{ ...DONUT_LAYOUT, annotations: [{ text: `${stats.acuraciaValor.toFixed(2)}%`, font: { size: 18, color: corAcuFin, family: 'Inter', weight: 900 }, showarrow: false, x: 0.5, y: 0.5 }] }} 
                config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', maxWidth: '160px' }}
              />
            </div>
          </div>

          {/* 3. ACURÁCIA FINANCEIRA (LÍQUIDA) */}
          <div 
            onClick={() => handleCardClick('acuracia_liquida')}
            style={isAcuLiqSel ? { backgroundColor: corAcuLiqBg, borderColor: corAcuLiq, boxShadow: `0 0 25px ${corAcuLiq}55` } : {}}
            className={`bg-[#161616] border rounded-2xl p-5 flex flex-col sm:flex-row items-center transition-all duration-300 relative overflow-hidden cursor-pointer group ${
              isAcuLiqSel ? 'border-opacity-100 -translate-y-1 ring-1' : 'border-[#2A2A2A] hover:-translate-y-1'
            }`}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent to-transparent pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, transparent, ${corAcuLiq}, transparent)` }} />

            <div className="w-full sm:w-1/2 flex flex-col items-center sm:items-start text-center sm:text-left mb-4 sm:mb-0">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 shadow-inner border" style={{ backgroundColor: `${corAcuLiq}15`, color: corAcuLiq, borderColor: `${corAcuLiq}40` }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-sm font-black tracking-[0.1em] text-white uppercase mb-1">ACURÁCIA FINANCEIRA (LÍQUIDA)</h3>
              <p className="text-[11px] text-muted leading-relaxed mb-3">Mede o impacto financeiro real compensado (Sobras vs Perdas).</p>
              
              <div className="flex items-center gap-2 mb-3 bg-[#111111] border border-[#222222] px-2 py-1.5 rounded text-[10px] font-mono shadow-inner">
                 <span className="text-[#8c9ba5] uppercase">Impacto Líquido:</span>
                 <span className="text-white font-bold">{atualImpLiq > 0 ? '+' : ''}{atualImpLiq.toFixed(2)}%</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border shadow-sm" style={{ backgroundColor: `${corAcuLiq}15`, borderColor: `${corAcuLiq}35`, color: corAcuLiq }}>
                 <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: corAcuLiq }}></span>
                 <span>STATUS: {getStatusConf(atualAcuLiq)}</span>
              </div>
            </div>
            
            <div className="w-full sm:w-1/2 flex justify-center items-center pointer-events-none relative min-w-[150px]">
              <Plot 
                data={[{ type: "pie", values: [stats.acuraciaLiquida, Math.max(0, 100 - stats.acuraciaLiquida)], hole: 0.72, sort: false, direction: 'clockwise', rotation: 90, textinfo: 'none', hoverinfo: 'none', marker: { colors: [corAcuLiq, '#222222'], line: { width: 0 } } }]}
                layout={{ ...DONUT_LAYOUT, annotations: [{ text: `${stats.acuraciaLiquida.toFixed(2)}%`, font: { size: 18, color: corAcuLiq, family: 'Inter', weight: 900 }, showarrow: false, x: 0.5, y: 0.5 }] }} 
                config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', maxWidth: '160px' }}
              />
            </div>
          </div>

          {/* EVOLUÇÃO COMPARATIVA */}
          <div 
            onClick={() => handleCardClick('evolucao_comparativa')}
            className={`bg-[#161616] border rounded-2xl p-5 transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
              isEvolSel ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.3)] bg-[#1c1612] -translate-y-1 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.15)]'
            }`}
          >
            <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />

            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2A2A2A]">
              <h3 className="text-xs font-bold tracking-[0.18em] text-white uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                EVOLUÇÃO COMPARATIVA
              </h3>
              <span className="text-[10px] font-mono text-accent bg-accent/10 border border-accent/30 px-2 py-0.5 rounded">
                {mesClicado || 'Atual'} vs {prevMetrics.label}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#2A2A2A] text-[10px] font-bold text-[#8c9ba5] uppercase tracking-wider">
                    <th className="py-2 px-2">Indicador</th>
                    <th className="py-2 px-2 text-right">Atual ({mesClicado || 'Atual'})</th>
                    <th className="py-2 px-2 text-right">Anterior ({prevMetrics.label})</th>
                    <th className="py-2 px-2 text-right">Variação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]">
                  <tr className="hover:bg-[#1f1f1f] transition-colors">
                    <td className="py-2.5 px-2 font-medium text-white">Acurácia Física (Itens)</td>
                    <td className="py-2.5 px-2 text-right font-mono text-white">{atualAcuFis.toFixed(2)}%</td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.acuFis.toFixed(2)}%` : '—'}</td>
                    <td className={`py-2.5 px-2 text-right font-mono font-bold ${diffAcuFis >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                      {diffAcuFis >= 0 ? `+${diffAcuFis.toFixed(2)} pp` : `${diffAcuFis.toFixed(2)} pp`}
                    </td>
                  </tr>

                  <tr className="hover:bg-[#1f1f1f] transition-colors">
                    <td className="py-2.5 px-2 font-medium text-white">Acurácia Fin. Bruta</td>
                    <td className="py-2.5 px-2 text-right font-mono text-white">{atualAcuFin.toFixed(2)}%</td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.acuFin.toFixed(2)}%` : '—'}</td>
                    <td className={`py-2.5 px-2 text-right font-mono font-bold ${diffAcuFin >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                      {diffAcuFin >= 0 ? `+${diffAcuFin.toFixed(2)} pp` : `${diffAcuFin.toFixed(2)} pp`}
                    </td>
                  </tr>

                  <tr className="hover:bg-[#1f1f1f] transition-colors">
                    <td className="py-2.5 px-2 font-medium text-white">Acurácia Fin. Líquida</td>
                    <td className="py-2.5 px-2 text-right font-mono text-white">{atualAcuLiq.toFixed(2)}%</td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.acuLiq.toFixed(2)}%` : '—'}</td>
                    <td className={`py-2.5 px-2 text-right font-mono font-bold ${diffAcuLiq >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                      {diffAcuLiq >= 0 ? `+${diffAcuLiq.toFixed(2)} pp` : `${diffAcuLiq.toFixed(2)} pp`}
                    </td>
                  </tr>

                  <tr className="hover:bg-[#1f1f1f] transition-colors">
                    <td className="py-2.5 px-2 font-medium text-white">Taxa de Divergência (Itens)</td>
                    <td className="py-2.5 px-2 text-right font-mono text-white">{atualTaxaDiv.toFixed(2)}%</td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.taxaDiv.toFixed(2)}%` : '—'}</td>
                    <td className={`py-2.5 px-2 text-right font-mono font-bold ${diffTaxaDiv <= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                      {diffTaxaDiv >= 0 ? `+${diffTaxaDiv.toFixed(2)} pp` : `${diffTaxaDiv.toFixed(2)} pp`}
                    </td>
                  </tr>

                  <tr className="hover:bg-[#1f1f1f] transition-colors">
                    <td className="py-2.5 px-2 font-medium text-white">Impacto Líquido (%)</td>
                    <td className="py-2.5 px-2 text-right font-mono text-white">{atualImpLiq >= 0 ? `+${atualImpLiq.toFixed(2)}%` : `${atualImpLiq.toFixed(2)}%`}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.impLiq.toFixed(2)}%` : '—'}</td>
                    <td className={`py-2.5 px-2 text-right font-mono font-bold ${diffImpLiq <= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                      {diffImpLiq >= 0 ? `+${diffImpLiq.toFixed(2)} pp` : `${diffImpLiq.toFixed(2)} pp`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}

function EmpresaRow({ emp, dados, activeIds, onToggle, onToggleAll }) {
  const [open, setOpen] = useState(false)
  const [isSelectedRow, setIsSelectedRow] = useState(false)
  
  const strGeral = dados.idsGeral.length ? dados.idsGeral.join(', ') : '—'
  const strRot = dados.idsRotativo.length ? dados.idsRotativo.join(', ') : '—'

  return (
    <div 
      onClick={() => setIsSelectedRow(prev => !prev)}
      className={`rounded-xl p-3 transition-all duration-300 cursor-pointer shadow-inner ${
        isSelectedRow ? 'bg-[#1c1612] border border-accent shadow-[0_0_15px_rgba(245,130,32,0.2)]' : 'bg-[#111111] border border-[#2A2A2A] hover:border-[#444]'
      }`}
    >
      <div className="grid grid-cols-12 gap-0 items-center text-xs">
        <div className="col-span-2 text-left text-white font-medium truncate border-r border-[#222222] pr-2" title={emp}>{emp}</div>
        <div className="col-span-1 text-center text-accent font-black border-r border-[#222222] px-1">{dados.qtdAtiva}</div>
        <div className="col-span-2 text-center text-[#60a5fa] font-mono truncate border-r border-[#222222] px-2" title={dados.locaisEstoqueStr}>{dados.locaisEstoqueStr}</div>
        <div className="col-span-3 text-center text-white font-mono truncate border-r border-[#222222] px-2" title={strGeral}>{strGeral}</div>
        <div className="col-span-3 text-center text-white font-mono truncate border-r border-[#222222] px-2" title={strRot}>{strRot}</div>
        <div className="col-span-1 text-center pl-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setOpen(!open)} className={`border text-[10px] px-2.5 py-1.5 rounded-lg transition-all font-bold tracking-wide shadow-sm ${open ? 'bg-danger/20 text-danger border-danger/40 hover:bg-danger/30' : 'bg-accent text-dark-900 border-accent hover:bg-accent/90 shadow-[0_0_10px_rgba(245,130,32,0.3)]'}`}>
            {open ? 'Fechar' : 'Filtrar'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-[#222222] pt-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-3 mb-3">
            <button className="bg-[#1a1a1a] hover:bg-accent/20 border border-[#2A2A2A] hover:border-accent/50 text-white hover:text-accent text-[10px] py-1.5 px-4 rounded-lg transition-all font-bold uppercase tracking-wider shadow-sm" onClick={() => onToggleAll(emp, dados.todosIds, true)}>Marcar Todos</button>
            <button className="bg-[#1a1a1a] hover:bg-danger/20 border border-[#2A2A2A] hover:border-danger/50 text-white hover:text-danger text-[10px] py-1.5 px-4 rounded-lg transition-all border border-[#2A2A2A] tracking-widest uppercase shadow-sm" onClick={() => onToggleAll(emp, dados.todosIds, false)}>Desmarcar Todos</button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-44 overflow-y-auto custom-scrollbar p-1">
            {dados.todosIds.map((uid) => {
              const key = `${emp}||${uid}`
              const checked = activeIds[key] !== false
              return (
                <label key={uid} className={`flex items-center justify-center gap-2 text-xs cursor-pointer py-2 px-2.5 rounded-lg transition-all border ${checked ? 'bg-accent/15 border-accent text-white shadow-inner' : 'bg-[#161616] border-[#2A2A2A] text-muted hover:border-[#444]'}`}>
                  <input type="checkbox" checked={checked} onChange={(e) => onToggle(emp, uid, e.target.checked)} className="accent-accent w-3.5 h-3.5 cursor-pointer rounded-sm" />
                  <span className="font-mono">{uid}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
