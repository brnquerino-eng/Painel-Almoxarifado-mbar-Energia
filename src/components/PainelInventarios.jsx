import { useMemo, useState, useCallback, useEffect } from 'react'
import Plot from 'react-plotly.js'
import * as XLSX from 'xlsx'
import pptxgen from 'pptxgenjs'

import { fmtBRL, fmtInt, isRotativo } from '../utils/format'
import { FullScreenPortal } from './FullScreenPortal.jsx'
import { CyberMultiSelect } from './CyberMultiSelect.jsx'

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
  autosize: true,
}

export default function PainelInventarios({ data = [] }) {
  const [empresaSel, setEmpresaSel] = useState([])
  const [tipoSel, setTipoSel] = useState([])
  const [anoSel, setAnoSel] = useState([])
  
  const [idInvSel, setIdInvSel] = useState([])
  const [mesClicado, setMesClicado] = useState(null)
  
  const [vis, setVis] = useState({ total: true, geral: false, rotativo: false, divergentes: false })
  const [activeIds, setActiveIds] = useState({}) 
  const [expanded, setExpanded] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalUnidadesSel, setModalUnidadesSel] = useState([])
  const [modalSearch, setModalSearch] = useState('')

  const [selEmpresaRow, setSelEmpresaRow] = useState(null)
  const [selResumoRow, setSelResumoRow] = useState(null)
  const [selEvolucaoRow, setSelEvolucaoRow] = useState(null)
  const [selAcuraciaCard, setSelAcuraciaCard] = useState(null)
  const [selDivRow, setSelDivRow] = useState(null)

  // Suporte global para a tecla ESC (fecha modal, gaveta de detalhamentos e limpa seleções)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false)
        setExpanded(false)
        setSelEmpresaRow(null)
        setSelResumoRow(null)
        setSelEvolucaoRow(null)
        setSelAcuraciaCard(null)
        setSelDivRow(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reseta filtros dependentes ao mudar o período no gráfico mestre
  useEffect(() => {
    setIdInvSel([])
    setTipoSel([])
  }, [mesClicado])

  const toggleVis = useCallback((key) => setVis((v) => ({ ...v, [key]: !v[key] })), [])

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
    let dfBaseAnos = data.filter(r => r.id_inventario && String(r.id_inventario).trim() !== '' && String(r.id_inventario).toLowerCase() !== 'none')
    if (empresaSel.length) dfBaseAnos = dfBaseAnos.filter(r => empresaSel.includes(r.empresa_nome))

    // Identifica o último ano e mês com dados reais na base
    let maxAnoDados = 0
    let maxMesDados = 0
    dfBaseAnos.forEach(r => {
      const a = Number(r.ano_referencia)
      const m = Number(r.mes_referencia)
      if (a && m) {
        if (a > maxAnoDados || (a === maxAnoDados && m > maxMesDados)) {
          maxAnoDados = a
          maxMesDados = m
        }
      }
    })

    let anosAlvo = anoSel.length > 0 ? anoSel.map(String) : null
    if (!anosAlvo || anosAlvo.length === 0) {
      anosAlvo = [...new Set(dfBaseAnos.map(r => String(r.ano_referencia)).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
    }
    if (!anosAlvo.length) {
      anosAlvo = [String(new Date().getFullYear())]
    }

    const grupos = {}
    anosAlvo.sort().forEach(ano => {
      const numAno = Number(ano)
      let limiteMes = 12
      if (numAno === maxAnoDados) {
        limiteMes = maxMesDados
      } else if (numAno > maxAnoDados) {
        limiteMes = 0
      }

      for (let m = 1; m <= limiteMes; m++) {
        const mesStr = String(m)
        const mesFormatado = mesStr.padStart(2, '0')
        const chave = `${ano}-${mesFormatado}`
        const label = formatMesAno(mesStr, ano)
        grupos[chave] = { label, order: chave, total: new Set(), rotativo: new Set(), geral: new Set(), divergentes: new Set() }
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

        const dq = r.diferenca_consolidada ?? r.diferenca_qtd ?? r.qtd_diferenca ?? r.diff_qtd ?? 0
        const dv = r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0
        if (Math.abs(dq) > 0 || Math.abs(dv) !== 0) {
            grupos[chave].divergentes.add(uid)
        }
      }
    })

    const sorted = Object.values(grupos).sort((a, b) => a.order.localeCompare(b.order))

    return {
      x: sorted.map(g => g.label),
      total: sorted.map(g => g.total.size),
      geral: sorted.map(g => g.geral.size),
      rotativo: sorted.map(g => g.rotativo.size),
      divergentes: sorted.map(g => g.divergentes.size)
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
      finalizadosCount: 0, rotativosFinalizadosCount: 0, geralFinalizadosCount: 0, idsPendentes: [], idsComDivergencia: [], linhasDivergentes: [],
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
    
    const rowsDivergentes = dfInv.filter((r) => {
      const dq = r.diferenca_consolidada ?? r.diferenca_qtd ?? r.qtd_diferenca ?? r.diff_qtd ?? 0;
      const dv = r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0;
      return Math.abs(dq) > 0 || Math.abs(dv) !== 0;
    })
    
    const itensDivergentes = rowsDivergentes.length
    const idsComDivergencia = [...new Set(rowsDivergentes.map(r => limparId(r.id_inventario)))].sort((a, b) => Number(a) - Number(b))

    const getQtdDiv = (r) => r.diferenca_consolidada ?? r.diferenca_qtd ?? r.qtd_diferenca ?? r.diff_qtd ?? 0;
    const getValDiv = (r) => r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0;

    const qtdSobrasRaw = dfInv.filter((r) => getQtdDiv(r) > 0).reduce((s, r) => s + Math.abs(getQtdDiv(r)), 0)
    const qtdSobras = qtdSobrasRaw > 0 ? qtdSobrasRaw : dfInv.filter((r) => getValDiv(r) > 0).length
    
    const valSobras = dfInv.filter((r) => getValDiv(r) > 0).reduce((s, r) => s + getValDiv(r), 0)
    
    const qtdPerdasRaw = dfInv.filter((r) => getQtdDiv(r) < 0).reduce((s, r) => s + Math.abs(getQtdDiv(r)), 0)
    const qtdPerdas = qtdPerdasRaw > 0 ? qtdPerdasRaw : dfInv.filter((r) => getValDiv(r) < 0).length
    
    const valPerdas = dfInv.filter((r) => getValDiv(r) < 0).reduce((s, r) => s + getValDiv(r), 0)
    
    const diffLiquida = valSobras + valPerdas
    const linhasSemDiv = totalLinhas - itensDivergentes
    const acuraciaItens = totalLinhas > 0 ? (linhasSemDiv / totalLinhas) * 100 : 100
    
    const divergAbs = dfInv.reduce((s, r) => s + Math.abs(getValDiv(r)), 0)
    const acuraciaValor = valCongelado > 0 ? Math.max(0, (1 - divergAbs / valCongelado) * 100) : (divergAbs === 0 ? 100 : 0)
    
    const acuraciaLiquida = valCongelado > 0 ? Math.max(0, (1 - Math.abs(diffLiquida) / valCongelado) * 100) : (diffLiquida === 0 ? 100 : 0)

    return {
      totalInvs: uniqueInvs.size, invsRotativos, invsGeral,
      finalizadosCount, rotativosFinalizadosCount, geralFinalizadosCount, idsPendentes, idsComDivergencia, linhasDivergentes: rowsDivergentes,
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
    const getQtdDiv = (r) => r.diferenca_consolidada ?? r.diferenca_qtd ?? r.qtd_diferenca ?? r.diff_qtd ?? 0;
    const getValDiv = (r) => r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0;

    const itensDivergentes = dfPrev.filter((r) => Math.abs(getQtdDiv(r)) > 0 || Math.abs(getValDiv(r)) !== 0).length
    const acuFis = totalLinhas > 0 ? ((totalLinhas - itensDivergentes) / totalLinhas) * 100 : 100

    const valCongelado = dfPrev.reduce((s, r) => s + (r.saldo_anterior_val || r.valor_congelado || r.val_congelado || r.saldo_anterior || r.vl_saldo_anterior || 0), 0)
    const divergAbs = dfPrev.reduce((s, r) => s + Math.abs(getValDiv(r)), 0)
    const acuFin = valCongelado > 0 ? Math.max(0, (1 - divergAbs / valCongelado) * 100) : (divergAbs === 0 ? 100 : 0)

    const taxaDiv = totalLinhas > 0 ? (itensDivergentes / totalLinhas) * 100 : 0

    const valSobras = dfPrev.filter((r) => getValDiv(r) > 0).reduce((s, r) => s + getValDiv(r), 0)
    const valPerdas = dfPrev.filter((r) => getValDiv(r) < 0).reduce((s, r) => s + getValDiv(r), 0)
    const impBruto = valCongelado > 0 ? ((Math.abs(valSobras) + Math.abs(valPerdas)) / valCongelado) * 100 : 0

    const diffLiq = valSobras + valPerdas
    const impLiq = valCongelado > 0 ? (diffLiq / valCongelado) * 100 : 0
    const acuLiq = valCongelado > 0 ? Math.max(0, (1 - Math.abs(diffLiq) / valCongelado) * 100) : (diffLiq === 0 ? 100 : 0)

    return { acuFis, acuFin, acuLiq, taxaDiv, impBruto, impLiq, label: prevMonthLabel, hasData: true }
  }, [dfMaster, chartEvolucao.x, mesClicado])

  const handleExportExcel = useCallback(() => {
    if (!dfPainel || dfPainel.length === 0) return alert("Nenhum dado para exportar!");
    
    const wsData = dfPainel.map(row => ({
      'Empresa / Unidade': row.empresa_nome || row.unidade || '—',
      'Nº Inventário': limparId(row.id_inventario),
      'Tipo': row.tipo_inventario || '—',
      'Mês Referência': formatMesAno(row.mes_referencia, row.ano_referencia),
      'Código SKU': row.codigo_produto || row.codigo || '—',
      'Nome do Produto': row.nome_produto ?? row.descricao_produto ?? '—',
      'Qtde Sistema': row.saldo_anterior_consolidado ?? row.saldo_anterior ?? 0,
      'Qtde Físico': row.inventario_consolidado ?? row.quantidade_contada ?? 0,
      'Divergência (Qtde)': row.diferenca_consolidada ?? row.diferenca_qtd ?? 0,
      'Preço Médio (R$)': row.custo_unitario ?? row.preco_medio ?? 0,
      'Divergência (R$)': row.diferenca_val ?? row.val_diferenca ?? 0
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório Geral');
    XLSX.writeFile(wb, `Inventarios_Geral_${mesClicado || 'Completo'}.xlsx`);
  }, [dfPainel, mesClicado]);

  const handleExportPDF = useCallback(() => window.print(), []);

  const handleExportWord = useCallback(() => {
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Relatório de Inventários</title></head>
      <body style="font-family: Arial, sans-serif;">
        <h1 style="color: #f58220;">Relatório Executivo de Inventários - Âmbar Energia</h1>
        <p><strong>Período Analisado:</strong> ${mesClicado || 'Todo o Histórico'}</p>
        <p><strong>Data de Geração:</strong> ${dataAtual}</p>
        <hr/>
        <h3>Resumo da Conciliação</h3>
        <ul>
          <li><strong>Total de Inventários:</strong> ${stats.totalInvs} (Finalizados: ${stats.finalizadosCount})</li>
          <li><strong>Acurácia Física (Itens):</strong> ${stats.acuraciaItens.toFixed(2)}%</li>
          <li><strong>Acurácia Financeira (Bruta):</strong> ${stats.acuraciaValor.toFixed(2)}%</li>
          <li><strong>Acurácia Financeira (Líquida):</strong> ${stats.acuraciaLiquida.toFixed(2)}%</li>
          <li><strong>Valor Congelado (Contábil):</strong> ${fmtBRL(stats.valCongelado)}</li>
          <li><strong>Diferença Líquida Total:</strong> ${fmtBRL(stats.diffLiquida)}</li>
        </ul>
        <hr/>
        <p><em>Relatório gerado automaticamente pelo Painel Gerencial.</em></p>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Executivo_${mesClicado ? mesClicado.replace('/','-') : 'Geral'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [stats, mesClicado]);

  const handleExportPPTX = useCallback(() => {
    const pres = new pptxgen();
    pres.author = 'Painel Gerencial - Âmbar Energia';
    pres.company = 'Âmbar Energia';
    pres.title = 'Relatório de Inventários';
    pres.layout = 'LAYOUT_16x9';

    const slideCapa = pres.addSlide();
    slideCapa.background = { color: '161616' };
    slideCapa.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: '10%', h: '100%', fill: { color: 'f58220' } }); 
    
    slideCapa.addText('ÂMBAR ENERGIA', { 
      x: 1, y: 1.8, w: '80%', color: 'f58220', fontSize: 44, bold: true, align: 'center', fontFace: 'Arial' 
    });
    slideCapa.addText('FECHAMENTO DE ESTOQUE GERENCIAL', { 
      x: 1, y: 2.8, w: '80%', color: 'FFFFFF', fontSize: 26, align: 'center', fontFace: 'Arial' 
    });
    slideCapa.addText(`COMPILADO: ${mesClicado ? mesClicado.toUpperCase() : 'HISTÓRICO COMPLETO'}`, { 
      x: 1, y: 3.5, w: '80%', color: '8c9ba5', fontSize: 16, align: 'center', fontFace: 'Arial', bold: true
    });

    const slideResumo = pres.addSlide();
    slideResumo.background = { color: 'F5F5F5' };
    slideResumo.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: '161616' } });
    slideResumo.addText(`VISÃO GERAL CONSOLIDADA - ${mesClicado || 'GERAL'}`, { 
      x: 0.2, y: 0.1, w: '90%', h: 0.6, color: 'FFFFFF', fontSize: 20, bold: true, fontFace: 'Arial' 
    });

    slideResumo.addText([
      { text: 'Resumo da Conciliação de Inventários\n', options: { fontSize: 18, bold: true, color: '161616' } },
      { text: `\n• Acurácia Física (Itens): ${stats.acuraciaItens.toFixed(2)}%\n`, options: { fontSize: 14, color: '333333' } },
      { text: `• Acurácia Financeira Bruta: ${stats.acuraciaValor.toFixed(2)}%\n`, options: { fontSize: 14, color: '333333' } },
      { text: `• Acurácia Financeira Líquida: ${stats.acuraciaLiquida.toFixed(2)}%\n`, options: { fontSize: 14, color: '333333' } },
      { text: `• Total de SKUs Contados: ${fmtInt(stats.skusContados)}\n`, options: { fontSize: 14, color: '333333' } },
      { text: `• Valor Congelado (Sistema): ${fmtBRL(stats.valCongelado)}\n`, options: { fontSize: 14, color: '333333' } },
      { text: `• Diferença Líquida: ${fmtBRL(stats.diffLiquida)}`, options: { fontSize: 14, color: stats.diffLiquida < 0 ? 'e74c3c' : '2ecc71', bold: true } }
    ], { x: 0.5, y: 1.2, w: '80%', h: 3.5 });

    empresasDisponiveis.forEach(emp => {
      const slideEmp = pres.addSlide();
      slideEmp.background = { color: 'FFFFFF' };

      slideEmp.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: '161616' } });
      slideEmp.addText(`PERFORMANCE ALMOXARIFADO - ${emp.toUpperCase()}`, { 
        x: 0.2, y: 0.1, w: '90%', h: 0.6, color: 'f58220', fontSize: 20, bold: true, fontFace: 'Arial' 
      });

      const dadosEmp = dfInv.filter(r => r.empresa_nome === emp || r.unidade === emp);
      const valCongeladoEmp = dadosEmp.reduce((s, r) => s + (r.saldo_anterior_val || r.valor_congelado || r.val_congelado || r.saldo_anterior || r.vl_saldo_anterior || 0), 0);
      const skusEmp = new Set(dadosEmp.map(r => r.codigo_produto).filter(Boolean)).size;

      const valSobrasEmp = dadosEmp.filter(r => (r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0) > 0).reduce((s, r) => s + (r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0), 0);
      const valPerdasEmp = dadosEmp.filter(r => (r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0) < 0).reduce((s, r) => s + (r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0), 0);
      const diffLiquidaEmp = valSobrasEmp + valPerdasEmp;

      slideEmp.addText('INDICADORES DE FECHAMENTO', { x: 0.5, y: 1.2, w: 4, h: 0.5, color: '161616', fontSize: 16, bold: true });
      
      slideEmp.addText(`Unidade Analisada: ${emp}`, { x: 0.5, y: 1.8, w: 8, color: '555555', fontSize: 14, bold: true });
      slideEmp.addText(`Total de SKUs: ${fmtInt(skusEmp)}`, { x: 0.5, y: 2.2, w: 4, color: '333333', fontSize: 14 });
      slideEmp.addText(`Valor do Estoque (Congelado): ${fmtBRL(valCongeladoEmp)}`, { x: 0.5, y: 2.6, w: 6, color: '333333', fontSize: 14 });
      
      slideEmp.addText(`Sobras (Entradas Físicas): ${fmtBRL(valSobrasEmp)}`, { x: 0.5, y: 3.2, w: 6, color: '2ecc71', fontSize: 14, bold: true });
      slideEmp.addText(`Perdas (Consumo/Divergência): ${fmtBRL(valPerdasEmp)}`, { x: 0.5, y: 3.6, w: 6, color: 'e74c3c', fontSize: 14, bold: true });
      
      slideEmp.addShape(pres.shapes.LINE, { x: 0.5, y: 4.0, w: 8, h: 0, line: { color: 'E0E0E0', width: 1 } });
      
      slideEmp.addText(`Resultado Líquido do Inventário: ${fmtBRL(diffLiquidaEmp)}`, { 
        x: 0.5, y: 4.2, w: 8, color: diffLiquidaEmp < 0 ? 'e74c3c' : '2ecc71', fontSize: 16, bold: true 
      });
    });

    const nomeArquivo = `Apresentacao_Inventarios_${mesClicado ? mesClicado.replace('/','-') : 'Geral'}.pptx`;
    pres.writeFile({ fileName: nomeArquivo });
  }, [stats, empresasDisponiveis, dfInv, mesClicado]);

  const toggleInv = useCallback((emp, uid, checked) => setActiveIds((prev) => ({ ...prev, [`${emp}||${uid}`]: checked })), [])
  const toggleAllEmp = useCallback((emp, ids, selectAll) => { setActiveIds((prev) => { const next = { ...prev }; for (const uid of ids) next[`${emp}||${uid}`] = selectAll; return next }) }, [])

  const unidadesDivergentesOpcoes = useMemo(() => {
    return [...new Set(stats.linhasDivergentes.map(r => r.empresa_nome || r.unidade))].filter(Boolean).sort()
  }, [stats.linhasDivergentes])

  const linhasDivergentesFiltradasModal = useMemo(() => {
    let lista = [...stats.linhasDivergentes]
    if (modalUnidadesSel.length > 0 && !modalUnidadesSel.includes('Todas')) {
      lista = lista.filter(r => modalUnidadesSel.includes(r.empresa_nome || r.unidade))
    }
    if (modalSearch) {
      const s = modalSearch.toLowerCase()
      lista = lista.filter(r => {
        const emp = String(r.empresa_nome || r.unidade || '').toLowerCase()
        const cod = String(r.codigo_produto || r.codigo || '').toLowerCase()
        const nome = String(r.nome_produto || r.descricao_produto || r.nome || r.descricao || '').toLowerCase()
        const id = String(limparId(r.id_inventario)).toLowerCase()
        return emp.includes(s) || cod.includes(s) || nome.includes(s) || id.includes(s)
      })
    }
    return lista
  }, [stats.linhasDivergentes, modalUnidadesSel, modalSearch])

  const exportarExcelDivergencias = useCallback(() => {
    if (!stats.linhasDivergentes.length) return
    const wsData = stats.linhasDivergentes.map(row => ({
      'Unidade': row.empresa_nome || row.unidade || '—',
      'Nº Inventário': limparId(row.id_inventario),
      'Código SKU': row.codigo_produto || row.codigo || '—',
      'Nome do Produto': row.nome_produto ?? row.descricao_produto ?? row.nome ?? row.descricao ?? '—',
      'Sistema': row.saldo_anterior_consolidado ?? row.saldo_anterior ?? row.saldo_sistema ?? 0,
      'Físico': row.inventario_consolidado ?? row.quantidade_contada ?? row.qtd_fisica ?? 0,
      'Divergência': row.diferenca_consolidada ?? row.diferenca_qtd ?? 0,
      'Preço Médio (R$)': row.custo_unitario ?? row.preco_medio ?? 0,
      'Valor Total (R$)': row.diferenca_val ?? row.val_diferenca ?? 0
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Itens Divergentes')
    XLSX.writeFile(wb, `itens_divergentes_${mesClicado || 'atual'}.xlsx`)
  }, [stats.linhasDivergentes, mesClicado])

  if (!data.length) { return <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl text-center py-16 text-muted shadow-xl text-xs">⚠️ Nenhum dado de inventário encontrado na base.</div> }

  const DONUT_LAYOUT = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 0, r: 0, t: 0, b: 0 }, height: 135, showlegend: false }
  const DONUT_HOLE = 0.65 

  const UnifiedRow = ({ id, icon, label, valFoto, valRes }) => {
    const isMatch = valFoto === valRes
    const isActive = selResumoRow === id
    const resColor = isMatch ? 'text-white' : 'text-accent'
    const statusColor = isMatch ? 'text-[#2ecc71]' : 'text-accent'
    const statusIcon = isMatch ? '✓' : '✕'
    
    return (
      <div 
        onClick={() => setSelResumoRow(isActive ? null : id)}
        className={`grid grid-cols-12 items-center py-2.5 border-b border-[#222222] transition-colors rounded-lg px-2 cursor-pointer ${isActive ? 'bg-[#1c1612] border-accent/40 shadow-[inset_0_0_15px_rgba(245,130,32,0.15)]' : 'hover:bg-[#1a1a1a]'}`}
      >
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
        bgcolor: mesClicado === xVal ? 'rgba(52,152,219,0.9)' : 'rgba(22, 22, 22, 0.85)',
        bordercolor: '#3498db', borderwidth: 1, borderpad: 4
      })))
    }
    if (vis.divergentes) {
      anns.push(...chartEvolucao.x.map((xVal, index) => ({
        x: xVal, y: chartEvolucao.divergentes[index], text: `<b>${chartEvolucao.divergentes[index]}</b>`, showarrow: false,
        ax: 0, ay: 54, font: { size: 10, color: '#ffffff', family: 'Inter' },
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
  const getStatusConf = (val) => val >= 95 ? 'EXCELENTE' : val >= 80 ? 'ATENÇÃO' : 'CRÍTICO'

  const corAcuFis = getCor(stats.acuraciaItens)
  const corAcuFin = getCor(stats.acuraciaValor)
  const corAcuLiq = getCor(stats.acuraciaLiquida)

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
      
      <style>{`
        .js-plotly-plot .plotly .cursor-crosshair {
          cursor: pointer !important;
        }
      `}</style>

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
           <button onClick={handleExportPPTX} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#2a1b16] text-[#f58220] border border-[#f58220]/40 hover:bg-[#3a251c] transition-all flex items-center gap-1.5 shadow-sm ml-1 border-l-2 border-l-[#f58220]"><span>📊</span> PPTX</button>
        </div>
      </div>

      {/* BLOCO DE GRÁFICOS E FILTROS */}
      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] relative z-40 flex flex-col transition-all duration-300 space-y-6">
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
                     <CyberMultiSelect options={listasMaster.empresas} selected={empresaSel} onChange={setEmpresaSel} placeholder="Todas as Empresas" />
                  </div>
                  <div>
                     <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">Ano</label>
                     <CyberMultiSelect options={listasMaster.anos} selected={anoSel} onChange={setAnoSel} placeholder="Todos os Anos" />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
               {[ 
                 { key: 'total', label: 'Total Inventários', color: '#f58220', bg: 'rgba(245,130,32,0.15)', shadow: 'rgba(245,130,32,0.3)' }, 
                 { key: 'geral', label: 'Gerais', color: '#3498db', bg: 'rgba(52,152,219,0.15)', shadow: 'rgba(52,152,219,0.3)' }, 
                 { key: 'rotativo', label: 'Rotativos', color: '#2ecc71', bg: 'rgba(46,204,113,0.15)', shadow: 'rgba(46,204,113,0.3)' },
                 { key: 'divergentes', label: 'Divergentes', color: '#e74c3c', bg: 'rgba(231,76,60,0.15)', shadow: 'rgba(231,76,60,0.3)' } 
               ].map(({ key, label, color, bg, shadow }) => {
                  const isActive = vis[key]
                  const hasData = chartEvolucao[key] && chartEvolucao[key].some(v => v > 0)
                  return (
                    <button 
                      key={key} 
                      onClick={() => hasData && toggleVis(key)} 
                      disabled={!hasData} 
                      className={`relative flex items-center justify-center gap-2 px-3 py-2 text-xs transition-all duration-300 rounded-lg overflow-hidden border ${
                        !hasData ? 'opacity-30 grayscale cursor-not-allowed border-transparent text-dark-400 bg-transparent' : 
                        !isActive ? 'text-[#8c9ba5] hover:text-white hover:bg-[#222222]/50 border-[#2A2A2A]' : 
                        'font-bold text-white'
                      }`}
                      style={isActive && hasData ? { borderColor: color, backgroundColor: bg, boxShadow: `0 0 15px ${shadow}, inset 0 0 10px ${bg}` } : {}}
                    >
                      {isActive && hasData && <span className="absolute bottom-0 left-0 w-full h-[3px] transition-all" style={{ backgroundColor: color, boxShadow: `0 -2px 10px ${color}` }} />}
                      <span className={`w-2 h-2 rounded-full transition-all ${!hasData ? 'bg-dark-500' : isActive ? 'animate-pulse' : 'bg-[#555]'}`} style={(isActive && hasData) ? { backgroundColor: color, boxShadow: `0 0 12px ${color}` } : {}} />
                      <span className={isActive ? 'drop-shadow-md tracking-wide text-white truncate' : 'tracking-wide truncate'}>{label}</span>
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
                  vis.geral && { x: chartEvolucao.x, y: chartEvolucao.geral, type: 'scatter', mode: 'lines+markers', line: { color: '#3498db', width: 1.5, dash: 'dash', shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#080808', line: { color: '#3498db', width: 1.5 } }, hoverinfo: 'none', cliponaxis: false },
                  vis.rotativo && { x: chartEvolucao.x, y: chartEvolucao.rotativo, type: 'scatter', mode: 'lines+markers', line: { color: '#2ecc71', width: 1.5, dash: 'longdash', shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#080808', line: { color: '#2ecc71', width: 1.5 } }, hoverinfo: 'none', cliponaxis: false },
                  vis.divergentes && { x: chartEvolucao.x, y: chartEvolucao.divergentes, type: 'scatter', mode: 'lines+markers', line: { color: '#e74c3c', width: 1.5, dash: 'dot', shape: 'spline', smoothing: 1.3 }, marker: { size: 8, color: '#080808', line: { color: '#e74c3c', width: 1.5 } }, hoverinfo: 'none', cliponaxis: false }
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
                    <span className="text-xs text-white tracking-wide font-medium">Filtro ativo por snapshot temporal: <b className="text-accent font-mono text-xs px-2 py-0.5 bg-[#080808] border border-accent/30 rounded shadow-inner ml-1">{mesClicado}</b></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                     {!isCurrentMonth && ( <button onClick={handleGoToCurrent} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-dark-900 font-bold text-xs transition-all duration-300 shadow-md"><span>Voltar ao Atual</span></button> )}
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

         {/* Detalhamentos da Tabela (Ocultável) */}
         <div className="border border-[#2A2A2A] rounded-xl shadow-lg bg-[#111111]/40 transition-colors relative z-30">
            <div 
              role="button" 
              tabIndex={0}
              aria-expanded={expanded}
              onClick={(e) => { if (!e.target.closest('.filtros-tabela')) { setExpanded(!expanded) } }}
              onKeyDown={(e) => { 
                if (e.key === 'Enter' || e.key === ' ') { 
                  e.preventDefault(); 
                  if (!e.target.closest('.filtros-tabela')) setExpanded(!expanded);
                } 
              }}
              className="px-4 py-3 border-b border-[#2A2A2A] bg-[#111111]/80 hover:bg-[#161616] flex items-center justify-between gap-4 cursor-pointer transition-colors w-full rounded-t-xl focus:outline-none focus:ring-1 focus:ring-accent/50"
            >
               <div className="flex items-center gap-3 shrink-0 pointer-events-none">
                  <span className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-inner">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </span>
                  <span className="text-xs font-bold text-white tracking-wide uppercase hover:text-accent transition-colors truncate">INVENTÁRIOS - DETALHAMENTOS</span>
               </div>
               <div className="flex items-center gap-3 shrink-0 filtros-tabela" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 border-r border-[#333] pr-3"><span className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase hidden sm:block">Tipo</span><CyberMultiSelect options={listasMaster.tiposVisual} selected={tipoSel} onChange={setTipoSel} placeholder="Todos" /></div>
                  <div className="flex items-center gap-2 border-r border-[#333] pr-3"><span className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase hidden sm:block">Nº ID</span><CyberMultiSelect options={idsInventariosDisponiveis} selected={idInvSel} onChange={setIdInvSel} placeholder="Todos IDs" /></div>
                  <button onClick={() => setExpanded(!expanded)} tabIndex={-1} className="text-muted text-xs p-1 hover:text-accent transition-colors flex items-center justify-center focus:outline-none">{expanded ? '▲' : '▼'}</button>
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
                  return <EmpresaRow key={emp} emp={emp} dados={d} activeIds={activeIds} onToggle={toggleInv} onToggleAll={toggleAllEmp} isSelected={selEmpresaRow === emp} onSelect={() => setSelEmpresaRow(selEmpresaRow === emp ? null : emp)} />
                })}
              </div>
            )}
         </div>
      </div>

      {/* MASTER COMMAND CENTER (GRID DUPLO) */}
      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden mt-6 relative z-10 transition-all duration-300">
        <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-[#3498db]/50 to-transparent pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#2A2A2A]">
          
          {/* COLUNA ESQUERDA (OPERACIONAL & RAIO-X) */}
          <div className="lg:col-span-6 p-5 sm:p-6 flex flex-col gap-6 bg-[#161616]">
            
            <div>
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#3498db]/15 flex items-center justify-center text-[#3498db] shadow-inner shrink-0 border border-[#3498db]/30">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <h3 className="text-xs font-bold tracking-[0.18em] text-white uppercase">RESUMO DA CONCILIAÇÃO DE INVENTÁRIOS</h3>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-1 border ${is100Percent ? 'text-[#2ecc71] bg-[#2ecc71]/10 border-[#2ecc71]/40' : 'text-accent bg-accent/10 border-accent/40'}`}>
                    {is100Percent ? 'CONCLUÍDO' : 'EM ANDAMENTO'} {is100Percent && <span>✓</span>}
                  </span>
                  <span className={`text-lg font-black font-mono tracking-tighter ${is100Percent ? 'text-[#2ecc71]' : 'text-accent'}`}>{pctConclusao}%</span>
                </div>
              </div>

              <div className="bg-[#111111] border border-[#222222] rounded-xl p-4 shadow-inner flex flex-col mb-5">
                <div className="grid grid-cols-12 pb-3 border-b border-[#333333] mb-2 px-2 text-[10px] font-bold text-[#8c9ba5] uppercase tracking-widest">
                  <div className="col-span-5">Métrica</div>
                  <div className="col-span-3 text-center text-[#60a5fa]">ABERTURA</div>
                  <div className="col-span-3 text-center">ENCERRADO</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="space-y-1">
                  <UnifiedRow id="inv" icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} label="Inventários" valFoto={stats.totalInvs} valRes={stats.finalizadosCount} />
                  <UnifiedRow id="rot" icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} label="Rotativos" valFoto={stats.invsRotativos} valRes={stats.rotativosFinalizadosCount} />
                  <UnifiedRow id="ger" icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} label="Gerais" valFoto={stats.invsGeral} valRes={stats.geralFinalizadosCount} />
                  <UnifiedRow id="loc" icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} label="Locais Estoque" valFoto={stats.qtdeLocaisEstoque} valRes={stats.locaisContados} />
                  <UnifiedRow id="lin" icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>} label="Linhas" valFoto={stats.totalLinhas} valRes={stats.linhasContadas} />
                  <UnifiedRow id="sku" icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} label="SKUs" valFoto={stats.skusUnicos} valRes={stats.skusContados} />
                </div>
              </div>

              <div className="bg-[#0c0c0c] border-t border-x border-[#222222] rounded-t-xl p-4 shadow-inner grid grid-cols-2 gap-3 divide-x divide-[#222222]">
                <div className="flex flex-col justify-center pr-2">
                  <span className="block text-[10px] tracking-[0.15em] text-[#8c9ba5] font-bold uppercase mb-1">VALOR INICIAL</span>
                  <span className="block text-lg font-black text-[#60a5fa] font-mono tracking-tight">{fmtBRL(stats.valCongelado)}</span>
                </div>
                <div className="flex flex-col justify-center pl-4">
                  <span className="block text-[10px] tracking-[0.15em] text-[#8c9ba5] font-bold uppercase mb-1">VALOR CONTADO</span>
                  <span className={`block text-lg font-black font-mono tracking-tight ${corValContado}`}>{fmtBRL(stats.valContado)}</span>
                </div>
              </div>

              <div className="bg-[#101010] border-x border-b border-[#222222] rounded-b-xl p-5 shadow-inner flex flex-col items-center justify-center text-center mb-5">
                <span className="text-[11px] text-[#8c9ba5] uppercase font-bold tracking-[0.2em] mb-1.5">DIFERENÇA LÍQUIDA</span>
                <span className={`text-2xl font-black font-mono tracking-tight ${stats.diffLiquida > 0 ? 'text-[#2ecc71]' : stats.diffLiquida < 0 ? 'text-[#e74c3c]' : 'text-white'}`}>
                  {stats.diffLiquida > 0 ? '+' : ''}{fmtBRL(stats.diffLiquida)}
                </span>
              </div>

              <div className="bg-[#101010] border-x border-t border-[#222222] rounded-t-xl p-5 shadow-inner flex flex-col items-center justify-center text-center">
                <span className="text-[11px] text-[#8c9ba5] uppercase font-bold tracking-[0.2em] mb-1.5">ITENS DIVERGENTES</span>
                <span className="text-2xl font-black font-mono tracking-tight text-white">{fmtInt(stats.itensDivergentes)} <span className="text-sm font-medium text-muted">registros</span></span>
              </div>
              <div className="bg-[#0c0c0c] border-x border-b border-[#222222] rounded-b-xl p-5 shadow-inner grid grid-cols-2 gap-4 divide-x divide-[#222222]">
                <div className="flex flex-col justify-center pr-2">
                  <span className="block text-sm text-[#2ecc71] font-bold uppercase mb-1.5">▲ Sobras (Mais)</span>
                  <span className="block text-xs font-bold bg-[#1a1a1a] border border-[#333] px-2 py-1 rounded w-fit mb-1.5 shadow-sm">
                    <span className="text-[#8c9ba5] font-normal mr-1">Qtde:</span><span className="text-white">{fmtInt(stats.qtdSobras)}</span>
                  </span>
                  <span className="block font-mono font-black text-[#2ecc71] text-base">{fmtBRL(stats.valSobras)}</span>
                </div>
                <div className="flex flex-col justify-center pl-4">
                  <span className="block text-sm text-[#e74c3c] font-bold uppercase mb-1.5">▼ Perdas (Menos)</span>
                  <span className="block text-xs font-bold bg-[#1a1a1a] border border-[#333] px-2 py-1 rounded w-fit mb-1.5 shadow-sm">
                    <span className="text-[#8c9ba5] font-normal mr-1">Qtde:</span><span className="text-white">{fmtInt(stats.qtdPerdas)}</span>
                  </span>
                  <span className="block font-mono font-black text-[#e74c3c] text-base">{fmtBRL(stats.valPerdas)}</span>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-[#2A2A2A]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2A2A2A]">
                <h3 className="text-xs font-bold tracking-[0.18em] text-white uppercase flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  RAIO-X DOS INVENTÁRIOS
                </h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 divide-x divide-[#222222] pt-1">
                <div className="flex flex-col pr-2">
                  <span className="text-sm text-[#f1c40f] font-bold uppercase mb-1.5 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f1c40f] animate-pulse"></span> PENDENTES
                  </span>
                  <span className="text-xs text-muted">Aguardando fechamento: <b className="text-white text-sm ml-1">{stats.idsPendentes.length}</b></span>
                  
                  <div className="flex flex-wrap gap-2 mt-4 content-start">
                    {stats.idsPendentes.length > 0 ? (
                      stats.idsPendentes.map(id => <span key={id} className="bg-[#1a1a1a] border border-[#333] text-[#f1c40f] px-2.5 py-1 rounded text-sm font-mono shadow-sm">{id}</span>)
                    ) : (
                      <span className="text-xs text-[#2ecc71] font-bold">✓ Nenhum pendente</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col pl-4">
                  <span className="text-sm text-accent font-bold uppercase mb-1.5 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse"></span> DIVERGENTES
                  </span>
                  <span className="text-xs text-muted">Com divergência: <b className="text-white text-sm ml-1">{stats.idsComDivergencia.length}</b></span>
                  
                  <div className="flex flex-wrap gap-2 mt-4 content-start max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                    {stats.idsComDivergencia.length > 0 ? (
                      stats.idsComDivergencia.map(id => <span key={id} className="bg-[#1a1a1a] border border-[#333] text-accent px-2.5 py-1 rounded text-sm font-mono shadow-sm">{id}</span>)
                    ) : (
                      <span className="text-xs text-[#2ecc71] font-bold">✓ 100% Exatos</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* COLUNA DIREITA (ACURÁCIAS EXPANDIDAS & EVOLUÇÃO) */}
          <div className="lg:col-span-6 flex flex-col justify-between bg-[#161616] divide-y divide-[#2A2A2A]">
            
            <div onClick={() => setSelAcuraciaCard(selAcuraciaCard === 'bruta' ? null : 'bruta')} className={`p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between relative overflow-hidden group transition-colors flex-1 cursor-pointer ${selAcuraciaCard === 'bruta' ? 'bg-[#1c1612] shadow-[inset_0_0_20px_rgba(245,130,32,0.1)]' : 'hover:bg-[#1a1a1a]'}`}>
              <div className="w-full sm:w-2/3 flex flex-col items-center sm:items-start text-center sm:text-left mb-4 sm:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg shadow-inner border" style={{ backgroundColor: `${corAcuFin}15`, color: corAcuFin, borderColor: `${corAcuFin}40` }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-xs sm:text-sm font-black tracking-[0.1em] text-white uppercase">ACURÁCIA FINANCEIRA (BRUTA)</h3>
                </div>
                <p className="text-[11px] text-muted leading-relaxed mb-3">Impacto financeiro absoluto no saldo contábil.</p>
                <div className="flex items-center gap-2 mb-3 bg-[#0a0a0a] border border-[#222222] px-2.5 py-1.5 rounded-lg text-[11px] font-mono shadow-inner">
                   <span className="text-[#8c9ba5] uppercase font-bold">Impacto Bruto:</span><span className="text-[#e74c3c] font-bold">{atualImpBruto.toFixed(2)}%</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border shadow-sm" style={{ backgroundColor: `${corAcuFin}15`, borderColor: `${corAcuFin}35`, color: corAcuFin }}>
                   <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: corAcuFin }}></span><span>CONFIABILIDADE: {getStatusConf(atualAcuFin)}</span>
                </div>
              </div>
              <div className="w-full sm:w-1/3 flex justify-center items-center pointer-events-none relative min-w-[130px]">
                <Plot data={[{ type: "pie", values: [stats.acuraciaValor, Math.max(0, 100 - stats.acuraciaValor)], hole: DONUT_HOLE, sort: false, direction: 'clockwise', rotation: 90, textinfo: 'none', hoverinfo: 'none', marker: { colors: [corAcuFin, '#2A2A2A'], line: { width: 0 } } }]} layout={{ ...DONUT_LAYOUT, height: 130, annotations: [{ text: `${stats.acuraciaValor.toFixed(2)}%`, font: { size: 16, color: corAcuFin, family: 'Inter', weight: 900 }, showarrow: false, x: 0.5, y: 0.5 }] }} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', maxWidth: '130px' }} />
              </div>
            </div>

            <div onClick={() => setSelAcuraciaCard(selAcuraciaCard === 'liquida' ? null : 'liquida')} className={`p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between relative overflow-hidden group transition-colors flex-1 cursor-pointer ${selAcuraciaCard === 'liquida' ? 'bg-[#1c1612] shadow-[inset_0_0_20px_rgba(245,130,32,0.1)]' : 'hover:bg-[#1a1a1a]'}`}>
              <div className="w-full sm:w-2/3 flex flex-col items-center sm:items-start text-center sm:text-left mb-4 sm:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg shadow-inner border" style={{ backgroundColor: `${corAcuLiq}15`, color: corAcuLiq, borderColor: `${corAcuLiq}40` }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-xs sm:text-sm font-black tracking-[0.1em] text-white uppercase">ACURÁCIA FINANCEIRA (LÍQUIDA)</h3>
                </div>
                <p className="text-[11px] text-muted leading-relaxed mb-3">Impacto financeiro real compensado.</p>
                <div className="flex items-center gap-2 mb-3 bg-[#0a0a0a] border border-[#222222] px-2.5 py-1.5 rounded-lg text-[11px] font-mono shadow-inner">
                   <span className="text-[#8c9ba5] uppercase font-bold">Impacto Líquido:</span><span className="text-[#e74c3c] font-bold">{atualImpLiq > 0 ? '+' : ''}{atualImpLiq.toFixed(2)}%</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border shadow-sm" style={{ backgroundColor: `${corAcuLiq}15`, borderColor: `${corAcuLiq}35`, color: corAcuLiq }}>
                   <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: corAcuLiq }}></span><span>CONFIABILIDADE: {getStatusConf(atualAcuLiq)}</span>
                </div>
              </div>
              <div className="w-full sm:w-1/3 flex justify-center items-center pointer-events-none relative min-w-[130px]">
                <Plot data={[{ type: "pie", values: [stats.acuraciaLiquida, Math.max(0, 100 - stats.acuraciaLiquida)], hole: DONUT_HOLE, sort: false, direction: 'clockwise', rotation: 90, textinfo: 'none', hoverinfo: 'none', marker: { colors: [corAcuLiq, '#2A2A2A'], line: { width: 0 } } }]} layout={{ ...DONUT_LAYOUT, height: 130, annotations: [{ text: `${stats.acuraciaLiquida.toFixed(2)}%`, font: { size: 16, color: corAcuLiq, family: 'Inter', weight: 900 }, showarrow: false, x: 0.5, y: 0.5 }] }} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', maxWidth: '130px' }} />
              </div>
            </div>

            <div onClick={() => setSelAcuraciaCard(selAcuraciaCard === 'fisica' ? null : 'fisica')} className={`p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between relative overflow-hidden group transition-colors flex-1 cursor-pointer ${selAcuraciaCard === 'fisica' ? 'bg-[#1c1612] shadow-[inset_0_0_20px_rgba(245,130,32,0.1)]' : 'hover:bg-[#1a1a1a]'}`}>
              <div className="w-full sm:w-2/3 flex flex-col items-center sm:items-start text-center sm:text-left mb-4 sm:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg shadow-inner border" style={{ backgroundColor: `${corAcuFis}15`, color: corAcuFis, borderColor: `${corAcuFis}40` }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <h3 className="text-xs sm:text-sm font-black tracking-[0.1em] text-white uppercase">ACURÁCIA FÍSICA (ITENS)</h3>
                </div>
                <p className="text-[11px] text-muted leading-relaxed mb-3">Precisão da contagem física linha a linha.</p>
                <div className="flex items-center gap-2 mb-3 bg-[#0a0a0a] border border-[#222222] px-2.5 py-1.5 rounded-lg text-[11px] font-mono shadow-inner">
                   <span className="text-[#8c9ba5] uppercase font-bold">Taxa de Divergência:</span><span className="text-[#e74c3c] font-bold">{atualTaxaDiv.toFixed(2)}%</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border shadow-sm" style={{ backgroundColor: `${corAcuFis}15`, borderColor: `${corAcuFis}35`, color: corAcuFis }}>
                   <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: corAcuFis }}></span><span>CONFIABILIDADE: {getStatusConf(atualAcuFis)}</span>
                </div>
              </div>
              <div className="w-full sm:w-1/3 flex justify-center items-center pointer-events-none relative min-w-[130px]">
                <Plot data={[{ type: "pie", values: [stats.acuraciaItens, Math.max(0, 100 - stats.acuraciaItens)], hole: DONUT_HOLE, sort: false, direction: 'clockwise', rotation: 90, textinfo: 'none', hoverinfo: 'none', marker: { colors: [corAcuFis, '#2A2A2A'], line: { width: 0 } } }]} layout={{ ...DONUT_LAYOUT, height: 130, annotations: [{ text: `${stats.acuraciaItens.toFixed(2)}%`, font: { size: 16, color: corAcuFis, family: 'Inter', weight: 900 }, showarrow: false, x: 0.5, y: 0.5 }] }} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', maxWidth: '130px' }} />
              </div>
            </div>

            <div className="p-4 sm:p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2A2A2A]">
                <h3 className="text-xs font-bold tracking-[0.18em] text-white uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                  EVOLUÇÃO COMPARATIVA
                </h3>
                <span className="text-[10px] font-mono text-accent bg-accent/10 border border-accent/30 px-2 py-0.5 rounded">
                  {mesClicado || 'Atual'} vs {prevMetrics.label}
                </span>
              </div>
              <div className="bg-[#111111] border border-[#222222] rounded-xl p-3 shadow-inner overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#333333] text-[10px] font-bold text-[#8c9ba5] uppercase tracking-wider pb-2">
                      <th className="py-2.5 px-3">Indicador</th>
                      <th className="py-2.5 px-3 text-right">Atual</th>
                      <th className="py-2.5 px-3 text-right">Anterior</th>
                      <th className="py-2.5 px-3 text-right">Variação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]">
                    <tr onClick={() => setSelEvolucaoRow(selEvolucaoRow === 'fisica' ? null : 'fisica')} className={`cursor-pointer transition-colors ${selEvolucaoRow === 'fisica' ? 'bg-[#1c1612] shadow-[inset_0_0_15px_rgba(245,130,32,0.1)]' : 'hover:bg-[#1a1a1a]'}`}>
                      <td className="py-3 px-3 font-medium text-white">Acurácia Física (Itens)</td>
                      <td className="py-3 px-3 text-right font-mono text-[#60a5fa]">{atualAcuFis.toFixed(2)}%</td>
                      <td className="py-3 px-3 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.acuFis.toFixed(2)}%` : '—'}</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${diffAcuFis >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                        {diffAcuFis >= 0 ? `+${diffAcuFis.toFixed(2)} pp` : `${diffAcuFis.toFixed(2)} pp`}
                      </td>
                    </tr>
                    <tr onClick={() => setSelEvolucaoRow(selEvolucaoRow === 'fin_bruta' ? null : 'fin_bruta')} className={`cursor-pointer transition-colors ${selEvolucaoRow === 'fin_bruta' ? 'bg-[#1c1612] shadow-[inset_0_0_15px_rgba(245,130,32,0.1)]' : 'hover:bg-[#1a1a1a]'}`}>
                      <td className="py-3 px-3 font-medium text-white">Acurácia Financeira Bruta</td>
                      <td className="py-3 px-3 text-right font-mono text-[#60a5fa]">{atualAcuFin.toFixed(2)}%</td>
                      <td className="py-3 px-3 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.acuFin.toFixed(2)}%` : '—'}</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${diffAcuFin >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                        {diffAcuFin >= 0 ? `+${diffAcuFin.toFixed(2)} pp` : `${diffAcuFin.toFixed(2)} pp`}
                      </td>
                    </tr>
                    <tr onClick={() => setSelEvolucaoRow(selEvolucaoRow === 'fin_liq' ? null : 'fin_liq')} className={`cursor-pointer transition-colors ${selEvolucaoRow === 'fin_liq' ? 'bg-[#1c1612] shadow-[inset_0_0_15px_rgba(245,130,32,0.1)]' : 'hover:bg-[#1a1a1a]'}`}>
                      <td className="py-3 px-3 font-medium text-white">Acurácia Financeira Líquida</td>
                      <td className="py-3 px-3 text-right font-mono text-[#60a5fa]">{atualAcuLiq.toFixed(2)}%</td>
                      <td className="py-3 px-3 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.acuLiq.toFixed(2)}%` : '—'}</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${diffAcuLiq >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                        {diffAcuLiq >= 0 ? `+${diffAcuLiq.toFixed(2)} pp` : `${diffAcuLiq.toFixed(2)} pp`}
                      </td>
                    </tr>
                    <tr onClick={() => setSelEvolucaoRow(selEvolucaoRow === 'taxa' ? null : 'taxa')} className={`cursor-pointer transition-colors ${selEvolucaoRow === 'taxa' ? 'bg-[#1c1612] shadow-[inset_0_0_15px_rgba(245,130,32,0.1)]' : 'hover:bg-[#1a1a1a]'}`}>
                      <td className="py-3 px-3 font-medium text-white">Taxa de Divergência</td>
                      <td className="py-3 px-3 text-right font-mono text-[#60a5fa]">{atualTaxaDiv.toFixed(2)}%</td>
                      <td className="py-3 px-3 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.taxaDiv.toFixed(2)}%` : '—'}</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${diffTaxaDiv <= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                        {diffTaxaDiv >= 0 ? `+${diffTaxaDiv.toFixed(2)} pp` : `${diffTaxaDiv.toFixed(2)} pp`}
                      </td>
                    </tr>
                    <tr onClick={() => setSelEvolucaoRow(selEvolucaoRow === 'imp_liq' ? null : 'imp_liq')} className={`cursor-pointer transition-colors ${selEvolucaoRow === 'imp_liq' ? 'bg-[#1c1612] shadow-[inset_0_0_15px_rgba(245,130,32,0.1)]' : 'hover:bg-[#1a1a1a]'}`}>
                      <td className="py-3 px-3 font-medium text-white">Impacto Líquido (%)</td>
                      <td className="py-3 px-3 text-right font-mono text-[#60a5fa]">{atualImpLiq >= 0 ? `+${atualImpLiq.toFixed(2)}%` : `${atualImpLiq.toFixed(2)}%`}</td>
                      <td className="py-3 px-3 text-right font-mono text-[#8c9ba5]">{prevMetrics.hasData ? `${prevMetrics.impLiq.toFixed(2)}%` : '—'}</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${diffImpLiq <= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                        {diffImpLiq >= 0 ? `+${diffImpLiq.toFixed(2)} pp` : `${diffImpLiq.toFixed(2)} pp`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        {/* FULL WIDTH BOTTOM ROW (TABELA DIVERGÊNCIAS) */}
        <div className="bg-[#0c0c0c] border-t border-[#2A2A2A] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-bold tracking-widest text-[#e74c3c] uppercase flex items-center gap-2">
              <span>⚠️ DETALHAMENTO DE DIVERGÊNCIAS</span>
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted font-mono">{stats.linhasDivergentes.length} registros</span>
              {stats.linhasDivergentes.length > 0 && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1.5 bg-accent/15 border border-accent/40 hover:bg-accent/30 text-accent font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all shadow-sm uppercase tracking-wider"
                >
                  <span>⛶ Expandir Janela / Tela Cheia</span>
                </button>
              )}
            </div>
          </div>

          {stats.linhasDivergentes.length > 0 ? (
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar border border-[#222222] rounded-xl shadow-inner bg-[#111111] max-h-[380px]">
              <table className="w-full text-left text-[10px] whitespace-nowrap relative">
                <thead className="bg-[#1a1a1a] border-b border-[#333333] sticky top-0 z-10">
                  <tr className="text-[#8c9ba5] uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-3">Unidade</th>
                    <th className="py-2.5 px-3">Nº Inv.</th>
                    <th className="py-2.5 px-3">Código SKU</th>
                    <th className="py-2.5 px-3">Nome do Produto</th>
                    <th className="py-2.5 px-3 text-right">Sistema</th>
                    <th className="py-2.5 px-3 text-right">Físico</th>
                    <th className="py-2.5 px-3 text-right">Divergência</th>
                    <th className="py-2.5 px-3 text-right">Preço Médio</th>
                    <th className="py-2.5 px-3 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]">
                  {stats.linhasDivergentes.slice(0, 50).map((row, idx) => {
                    const emp = row.empresa_nome || row.unidade || '—'
                    const idInv = limparId(row.id_inventario)
                    const cod = row.codigo_produto || row.codigo || '—'
                    const nome = row.nome_produto ?? row.descricao_produto ?? row.nome ?? row.descricao ?? row.produto ?? '—'
                    
                    const sis = row.saldo_anterior_consolidado ?? row.saldo_anterior ?? row.saldo_sistema ?? row.qtd_sistema ?? row.sistema ?? 0
                    const fis = row.inventario_consolidado ?? row.quantidade_contada ?? row.qtd_fisica ?? row.fisico ?? 0
                    
                    const divQtd = row.diferenca_consolidada ?? row.diferenca_qtd ?? row.qtd_diferenca ?? row.diff_qtd ?? (fis - sis)
                    const prMedio = row.custo_unitario ?? row.preco_medio ?? row.valor_unitario ?? 0
                    const divVal = row.diferenca_val ?? row.val_diferenca ?? row.diff_val ?? (divQtd * prMedio)
                    
                    const isNeg = divQtd < 0 || divVal < 0
                    const colorClass = isNeg ? 'text-[#e74c3c]' : 'text-white'
                    
                    const rowKey = `${idInv}_${cod}_${idx}`
                    const isActive = selDivRow === rowKey

                    return (
                      <tr 
                        key={idx} 
                        onClick={() => setSelDivRow(isActive ? null : rowKey)}
                        className={`cursor-pointer transition-colors ${isActive ? 'bg-[#1c1612] shadow-[inset_0_0_15px_rgba(245,130,32,0.15)] border-accent/30' : 'hover:bg-[#1f1f1f]'}`}
                      >
                        <td className="py-2.5 px-3 text-white font-medium max-w-[140px] truncate" title={emp}>{emp}</td>
                        <td className="py-2.5 px-3 text-white font-mono">{idInv}</td>
                        <td className="py-2.5 px-3 text-[#60a5fa] font-mono">{cod}</td>
                        <td className="py-2.5 px-3 text-white truncate max-w-[300px]" title={nome}>{nome}</td>
                        <td className="py-2.5 px-3 text-white font-mono text-right">{fmtInt(sis)}</td>
                        <td className="py-2.5 px-3 text-white font-mono text-right">{fmtInt(fis)}</td>
                        <td className={`py-2.5 px-3 font-mono text-right font-bold ${colorClass}`}>{divQtd > 0 ? '+' : ''}{fmtInt(divQtd)}</td>
                        <td className="py-2.5 px-3 text-white font-mono text-right">{fmtBRL(prMedio)}</td>
                        <td className={`py-2.5 px-3 font-mono text-right font-bold ${colorClass}`}>{divVal > 0 ? '+' : ''}{fmtBRL(divVal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-[#111111] border border-[#222222] rounded-xl p-6 text-center flex flex-col items-center justify-center">
              <span className="w-8 h-8 rounded-full bg-[#2ecc71]/10 text-[#2ecc71] border border-[#2ecc71]/30 flex items-center justify-center text-sm font-bold mb-2">✓</span>
              <span className="text-xs text-white font-bold">100% Exato - Sem Divergências</span>
              <span className="text-[10px] text-muted mt-0.5">Não existem divergências cadastradas para o período selecionado.</span>
            </div>
          )}
        </div>

      </div>

      {/* MODAL EM TELA CHEIA */}
      {isModalOpen && (
        <FullScreenPortal onClose={() => setIsModalOpen(false)}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shadow-xl shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-accent text-2xl drop-shadow-[0_0_10px_rgba(245,130,32,0.8)]">⚠️</span>
                <h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa de Itens Divergentes (Tela Cheia)</h2>
                <span className="ml-3 text-xs bg-accent/15 text-accent px-2.5 py-1 rounded-md font-mono border border-accent/30 font-bold shadow-inner">
                  Total filtrado: {Number(linhasDivergentesFiltradasModal.length).toLocaleString('pt-BR')} registros
                </span>
              </div>
              <div className="flex gap-3 items-center">
                <button onClick={exportarExcelDivergencias} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)]"><span>📥</span><span>Baixar Excel Completo</span></button>
                <button onClick={() => setIsModalOpen(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)]"><span>✕</span><span>Fechar Janela</span></button>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#080808] relative space-y-4">
              <div className="absolute top-0 left-1/4 right-1/4 h-[1px] opacity-20 bg-gradient-to-r from-transparent via-accent to-transparent pointer-events-none" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#161616] p-4 rounded-xl border border-[#2A2A2A]">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">Filtrar por Unidade:</label>
                  <CyberMultiSelect options={['Todas', ...unidadesDivergentesOpcoes]} selected={modalUnidadesSel} onChange={setModalUnidadesSel} placeholder="Todas as Unidades" />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">Busca Textual:</label>
                  <input 
                    type="text" 
                    placeholder="Digite código, SKU ou nome do produto..." 
                    value={modalSearch} 
                    onChange={(e) => setModalSearch(e.target.value)} 
                    className="w-full bg-[#111111] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden shadow-2xl h-full flex flex-col flex-grow">
                <div className="overflow-y-auto custom-scrollbar flex-grow max-h-[70vh]">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[#1a1a1a] border-b border-[#333333] sticky top-0 z-10">
                      <tr className="text-[#8c9ba5] uppercase font-bold tracking-wider text-[10px]">
                        <th className="py-3 px-4">Unidade</th>
                        <th className="py-3 px-4">Nº Inv.</th>
                        <th className="py-3 px-4">Código SKU</th>
                        <th className="py-3 px-4 w-full">Nome do Produto</th>
                        <th className="py-3 px-4 text-right">Sistema</th>
                        <th className="py-3 px-4 text-right">Físico</th>
                        <th className="py-3 px-4 text-right">Divergência</th>
                        <th className="py-3 px-4 text-right">Preço Médio</th>
                        <th className="py-3 px-4 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]">
                      {linhasDivergentesFiltradasModal.slice(0, 1000).map((row, idx) => {
                        const emp = row.empresa_nome || row.unidade || '—'
                        const idInv = limparId(row.id_inventario)
                        const cod = row.codigo_produto || row.codigo || '—'
                        const nome = row.nome_produto ?? row.descricao_produto ?? row.nome ?? row.descricao ?? row.produto ?? '—'
                        
                        const sis = row.saldo_anterior_consolidado ?? row.saldo_anterior ?? row.saldo_sistema ?? row.qtd_sistema ?? 0
                        const fis = row.inventario_consolidado ?? row.quantidade_contada ?? row.qtd_fisica ?? 0
                        
                        const divQtd = row.diferenca_consolidada ?? row.diferenca_qtd ?? row.qtd_diferenca ?? (fis - sis)
                        const prMedio = row.custo_unitario ?? row.preco_medio ?? 0
                        const divVal = row.diferenca_val ?? row.val_diferenca ?? (divQtd * prMedio)
                        
                        const isNeg = divQtd < 0 || divVal < 0
                        const colorClass = isNeg ? 'text-[#e74c3c]' : 'text-white'

                        const rowKey = `${idInv}_${cod}_${idx}`
                        const isActive = selDivRow === rowKey

                        return (
                          <tr 
                            key={idx} 
                            onClick={() => setSelDivRow(isActive ? null : rowKey)}
                            className={`cursor-pointer transition-colors ${isActive ? 'bg-[#1c1612] shadow-[inset_0_0_15px_rgba(245,130,32,0.15)] border-accent/30' : 'hover:bg-[#1a1a1a]'}`}
                          >
                            <td className="py-2.5 px-4 text-white font-medium">{emp}</td>
                            <td className="py-2.5 px-4 text-white font-mono">{idInv}</td>
                            <td className="py-2.5 px-4 text-[#60a5fa] font-mono">{cod}</td>
                            <td className="py-2.5 px-4 text-white font-medium truncate max-w-[350px]" title={nome}>{nome}</td>
                            <td className="py-2.5 px-4 text-white font-mono text-right">{fmtInt(sis)}</td>
                            <td className="py-2.5 px-4 text-white font-mono text-right">{fmtInt(fis)}</td>
                            <td className={`py-2.5 px-4 font-mono text-right font-bold ${colorClass}`}>{divQtd > 0 ? '+' : ''}{fmtInt(divQtd)}</td>
                            <td className="py-2.5 px-4 text-white font-mono text-right">{fmtBRL(prMedio)}</td>
                            <td className={`py-2.5 px-4 font-mono text-right font-bold ${colorClass}`}>{divVal > 0 ? '+' : ''}{fmtBRL(divVal)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {linhasDivergentesFiltradasModal.length > 1000 && (
                    <div className="p-4 text-center text-xs text-muted border-t border-[#333]">
                      Mostrando os primeiros 1.000 itens para garantir o desempenho visual. Faça o download em Excel para visualizar todos os {linhasDivergentesFiltradasModal.length} registros.
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </FullScreenPortal>
      )}

    </div>
  )
}

function EmpresaRow({ emp, dados, activeIds, onToggle, onToggleAll, isSelected, onSelect }) {
  const [open, setOpen] = useState(false)
  
  const strGeral = dados.idsGeral.length ? dados.idsGeral.join(', ') : '—'
  const strRot = dados.idsRotativo.length ? dados.idsRotativo.join(', ') : '—'

  return (
    <div 
      onClick={onSelect}
      className={`rounded-xl p-3 transition-all duration-300 cursor-pointer shadow-inner ${
        isSelected ? 'bg-[#1c1612] border border-accent shadow-[0_0_15px_rgba(245,130,32,0.2)]' : 'bg-[#111111] border border-[#2A2A2A] hover:border-[#444]'
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
            <button className="bg-[#1a1a1a] height-auto hover:bg-danger/20 border border-[#2A2A2A] hover:border-danger/50 text-white hover:text-danger text-[10px] py-1.5 px-4 rounded-lg transition-all tracking-widest uppercase shadow-sm" onClick={() => onToggleAll(emp, dados.todosIds, false)}>Desmarcar Todos</button>
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
