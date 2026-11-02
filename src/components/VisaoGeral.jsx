import React, { useState, useCallback, useEffect, useMemo } from 'react'
import Plot from 'react-plotly.js'
import pptxgen from 'pptxgenjs'
import {
  fmtBRL,
  fmtInt,
  fmtDec,
  fmtMes,
  fmtValorCurto,
  periodoLabel,
  parsePeriodo,
} from '../utils/format'
import * as XLSX from 'xlsx'

import { useInventoryState } from '../hooks/useInventoryState'
import { useVisaoGeralData } from '../hooks/useVisaoGeralData'
import { FullScreenPortal } from './FullScreenPortal.jsx'
import { CyberMultiSelect } from './CyberMultiSelect.jsx'
import { ExecutiveCard } from './ExecutiveCard.jsx'
import { TabelaGenerica } from './TabelaGenerica.jsx'

// --- CONSTANTES DE LAYOUT DOS GRÁFICOS ---
const PLOT_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#8c9ba5', family: 'Inter' },
  margin: { l: 10, r: 10, t: 40, b: 45 },
  showlegend: false,
  hovermode: 'closest',
  dragmode: false,
  autosize: true,
}

// ============================================================================
// COMPONENTE PRINCIPAL (APENAS VISUAL)
// ============================================================================

export default function VisaoGeral({ data }) {
  const { state, dispatch } = useInventoryState()

  // -------------------------------------------------------------------------
  // TODOS OS CÁLCULOS VÊM DO HOOK
  // -------------------------------------------------------------------------
  const {
    // opções de filtros
    opcoesUnid,
    regioesOpcoes,
    segmentosOpcoes,
    anoOpcoesCascata,
    tiposEstoqueOpcoes,
    escoposOpcoes,
    anoOpcoes,

    // período
    periodoEfetivo,
    periodoDisplay,

    // métricas e rankings
    metrics,
    rankingUnidadeAtivo,
    rankCritico,
    rankObsoleto,
    rankObra,
    rankOperacional,
    rankInsumo,
    compraConsumoUnidade,
    variacaoFiltrada,
    skusUnidadeFiltrado,
    exposicaoCategorias,

    // listas detalhadas
    maioresValoresDataCompleta,
    comprasSemConsumoDataCompleta,
    duplicadosDataCompleta,

    // time series
    timeSeriesAgg,

    // giro / cobertura
    giroMensal,
    giroAnual,
    coberturaMeses,
    coberturaAnos,
    giroMensalPrev,
    coberturaMesesPrev,
    giroCoberturaTempo,

    // itens parados
    itensParados,
    mesesParadosOpcoes,
    paradosChart,

    // estado local do ranking
    abaRankingUnidade,
    setAbaRankingUnidade,

    // helpers
    filtrarListaFS,
    formatarPeriodoTexto,
    normalizeSelectedUnidades,
  } = useVisaoGeralData(data, state, dispatch)

  // -------------------------------------------------------------------------
  // ESTADOS PURAMENTE DE UI
  // -------------------------------------------------------------------------
  const {
    escoposSel, unidadesSel, anosSel, tiposEstoqueSel,
    regioesSel = [], segmentosSel = [],
    activeCard, selectedBarraRanking,
    selectedBarraExposicao, selectedBarraCritico,
    selectedBarraObsoleto, selectedBarraObra,
    selectedBarraCompraConsumo, selectedBarraVariacao,
    selectedBarraSkus, abaVariacao, abaSkus, abaSkusUnidade, filtroMesParado,
    listaAberta, tabelaExpandida,
    listaMaioresValoresAberta, tabelaMaioresValoresExpandida,
    listaComprasSemConsumoAberta, tabelaComprasSemConsumoExpandida,
    listaDuplicadosAberta, tabelaDuplicadosExpandida,
    granularidade = 'mensal',
  } = state

  const abaCompraConsumo = state.abaCompraConsumo || 'comparativo'

  const [vis, setVis] = useState({ total: true, operacional: false, critico: false, obsoleto: false, obra: false, insumo: false })
  const [visComprasConsumo, setVisComprasConsumo] = useState({ compras: true, consumo: true })
  const [visGiroCobertura, setVisGiroCobertura] = useState({ giro: true, cobertura: true })
  const [exportando, setExportando] = useState(false)

  const [filtroTextoFS, setFiltroTextoFS] = useState('')
  const [filtroUnidadeFS, setFiltroUnidadeFS] = useState([])
  const [filtroMesParadoFS, setFiltroMesParadoFS] = useState([])

  // -------------------------------------------------------------------------
  // HANDLERS DE UI
  // -------------------------------------------------------------------------
  const onChangeUnidadeFS = useCallback((val) => setFiltroUnidadeFS(normalizeSelectedUnidades(val)), [normalizeSelectedUnidades])
  const onChangeTextoFS = useCallback((e) => setFiltroTextoFS(e.target.value), [])
  const handleCardClick = useCallback((key) => dispatch({ type: 'TOGGLE_ACTIVE_CARD', payload: key }), [dispatch])

  const fecharModalFS = useCallback((field) => {
    dispatch({ type: 'SET_FIELD', field, payload: false })
    setFiltroTextoFS('')
    setFiltroUnidadeFS([])
    setFiltroMesParadoFS([])
  }, [dispatch])

  // Escape key para fechar modais
  useEffect(() => {
    const algumModalAberto = tabelaExpandida || tabelaMaioresValoresExpandida || tabelaComprasSemConsumoExpandida || tabelaDuplicadosExpandida
    const algumaGavetaAberta = listaAberta || listaMaioresValoresAberta || listaComprasSemConsumoAberta || listaDuplicadosAberta

    if (!algumModalAberto && !algumaGavetaAberta) return

    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[data-cyber-open="true"]')) return
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        e.preventDefault(); e.stopPropagation(); active.blur(); return
      }
      if (algumModalAberto) {
        e.preventDefault(); e.stopPropagation()
        if (tabelaExpandida) fecharModalFS('tabelaExpandida')
        else if (tabelaMaioresValoresExpandida) fecharModalFS('tabelaMaioresValoresExpandida')
        else if (tabelaComprasSemConsumoExpandida) fecharModalFS('tabelaComprasSemConsumoExpandida')
        else if (tabelaDuplicadosExpandida) fecharModalFS('tabelaDuplicadosExpandida')
        return
      }
      if (algumaGavetaAberta) {
        e.preventDefault(); e.stopPropagation()
        if (listaAberta) dispatch({ type: 'SET_FIELD', field: 'listaAberta', payload: false })
        if (listaMaioresValoresAberta) dispatch({ type: 'SET_FIELD', field: 'listaMaioresValoresAberta', payload: false })
        if (listaComprasSemConsumoAberta) dispatch({ type: 'SET_FIELD', field: 'listaComprasSemConsumoAberta', payload: false })
        if (listaDuplicadosAberta) dispatch({ type: 'SET_FIELD', field: 'listaDuplicadosAberta', payload: false })
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [
    tabelaExpandida, tabelaMaioresValoresExpandida, tabelaComprasSemConsumoExpandida, tabelaDuplicadosExpandida,
    listaAberta, listaMaioresValoresAberta, listaComprasSemConsumoAberta, listaDuplicadosAberta,
    fecharModalFS, dispatch
  ])

  // Resize effect
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    return () => cancelAnimationFrame(id)
  }, [granularidade, abaCompraConsumo, abaRankingUnidade])

  // -------------------------------------------------------------------------
  // LISTAS FILTRADAS PARA TELA CHEIA / GAVETAS
  // -------------------------------------------------------------------------
  const filtroUnidadeFSKey = filtroUnidadeFS.join('\0')

  const maioresValoresGaveta = useMemo(() => maioresValoresDataCompleta.slice(0, 50), [maioresValoresDataCompleta])
  const { dados: maioresValoresFS, total: maioresValoresFSTotal, unidadesOpcoes: unidadesFSMaioresValores } = useMemo(
    () => filtrarListaFS(maioresValoresDataCompleta, { texto: filtroTextoFS, unidades: filtroUnidadeFS, camposTexto: ['nome', 'codigo'], maxItems: 1000 }),
    [maioresValoresDataCompleta, filtroTextoFS, filtroUnidadeFSKey, filtrarListaFS]
  )

  const comprasSemConsumoGaveta = useMemo(() => comprasSemConsumoDataCompleta.slice(0, 50), [comprasSemConsumoDataCompleta])
  const { dados: comprasSemConsumoFS, total: comprasSemConsumoFSTotal, unidadesOpcoes: unidadesFSComprasSemConsumo } = useMemo(
    () => filtrarListaFS(comprasSemConsumoDataCompleta, { texto: filtroTextoFS, unidades: filtroUnidadeFS, camposTexto: ['nome', 'codigo'], maxItems: 1000 }),
    [comprasSemConsumoDataCompleta, filtroTextoFS, filtroUnidadeFSKey, filtrarListaFS]
  )

  const duplicadosGaveta = useMemo(() => duplicadosDataCompleta.slice(0, 50), [duplicadosDataCompleta])
  const { dados: duplicadosFS, total: duplicadosFSTotal, unidadesOpcoes: unidadesFSDuplicados } = useMemo(
    () => filtrarListaFS(duplicadosDataCompleta, {
      texto: filtroTextoFS,
      unidades: filtroUnidadeFS,
      camposTexto: ['nome', 'skus_lista'],
      maxItems: 1000,
      matchUnidade: (item, setU) => {
        const parts = String(item.unidades_lista || '').split(',')
        return parts.some(p => setU.has(normalizeSelectedUnidades([p])[0] || ''))
      }
    }),
    [duplicadosDataCompleta, filtroTextoFS, filtroUnidadeFSKey, filtrarListaFS, normalizeSelectedUnidades]
  )

  const itensParadosParaExportar = useMemo(() => {
    let lista = itensParados
    if (filtroMesParado) lista = itensParados.filter(item => item.mesesParado === filtroMesParado)
    return [...lista]
  }, [itensParados, filtroMesParado])

  const itensParadosGaveta = useMemo(() => itensParadosParaExportar.slice(0, 50), [itensParadosParaExportar])

  const itensParadosPreFS = useMemo(() => {
    let lista = itensParados
    if (filtroMesParado) lista = lista.filter(item => item.mesesParado === filtroMesParado)
    if (filtroMesParadoFS && filtroMesParadoFS.length > 0) {
      const setM = new Set(filtroMesParadoFS.map(String))
      lista = lista.filter(item => setM.has(String(item.mesesParado)))
    }
    return lista
  }, [itensParados, filtroMesParado, filtroMesParadoFS])

  const { dados: itensParadosFS, total: itensParadosFSTotal, unidadesOpcoes: unidadesFSParados } = useMemo(
    () => filtrarListaFS(itensParadosPreFS, { texto: filtroTextoFS, unidades: filtroUnidadeFS, camposTexto: ['nome', 'codigo'], maxItems: 1000 }),
    [itensParadosPreFS, filtroTextoFS, filtroUnidadeFSKey, filtrarListaFS]
  )

  // -------------------------------------------------------------------------
  // EXPORTAÇÕES
  // -------------------------------------------------------------------------
  const periodoTxtExport = (periodoDisplay || formatarPeriodoTexto(periodoEfetivo)).replace(/\//g, "-")

  const exportarExcelMaioresValores = useCallback(() => {
    setExportando(true)
    setTimeout(() => {
      const dadosExportacao = maioresValoresDataCompleta.map(i => ({
        'Período': periodoTxtExport,
        'Unidade': i.unidade,
        'Código SKU': i.codigo,
        'Nome do Produto': i.nome || '—',
        'GE': i.ge || '—',
        'Crítico': i.itemCritico,
        'Quantidade': i.quantidade,
        'Preço Médio (R$)': i.precoMedio,
        'Valor em Estoque (R$)': i.valor
      }))
      const ws = XLSX.utils.json_to_sheet(dadosExportacao)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Maiores Valores")
      XLSX.writeFile(wb, `Maiores_Valores_Estoque_${periodoTxtExport.replace('/','-')}.xlsx`)
      setExportando(false)
    }, 150)
  }, [maioresValoresDataCompleta, periodoTxtExport])

  const exportarExcelDuplicados = useCallback(() => {
    setExportando(true)
    setTimeout(() => {
      const dadosExportacao = duplicadosDataCompleta.map(i => ({
        'Período': periodoTxtExport,
        'Nome do Produto (Agrupado)': i.nome,
        'Qtd SKUs': i.qtd_skus,
        'Lista de SKUs': i.skus_lista,
        'Qtd Fís.': i.quantidade,
        'Valor Imobilizado (R$)': i.valor
      }))
      const ws = XLSX.utils.json_to_sheet(dadosExportacao)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Duplicados")
      XLSX.writeFile(wb, `Cadastros_Duplicados_${periodoTxtExport.replace('/','-')}.xlsx`)
      setExportando(false)
    }, 150)
  }, [duplicadosDataCompleta, periodoTxtExport])

  const exportarExcelComprasSemConsumo = useCallback(() => {
    setExportando(true)
    setTimeout(() => {
      const dadosExportacao = comprasSemConsumoDataCompleta.map(i => ({
        'Período': periodoTxtExport,
        'Unidade': i.unidade,
        'Código SKU': i.codigo,
        'Nome do Produto': i.nome || '—',
        'Atributos (Lentes)': Object.entries(i.flags).filter(([_, v]) => v).map(([k]) => k).join(', '),
        'Qtde Comprada': i.qtdeComprada,
        'Valor Comprado (R$)': i.comprado,
        'Valor Consumido (R$)': i.consumido
      }))
      const ws = XLSX.utils.json_to_sheet(dadosExportacao)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Compras Sem Consumo")
      XLSX.writeFile(wb, `Compras_Sem_Consumo_${periodoTxtExport.replace('/','-')}.xlsx`)
      setExportando(false)
    }, 150)
  }, [comprasSemConsumoDataCompleta, periodoTxtExport])

  const exportarExcelParados = useCallback(() => {
    setExportando(true)
    setTimeout(() => {
      const dadosExportacao = itensParadosParaExportar.map(i => ({
        'Período': periodoTxtExport,
        'Unidade': i.unidade,
        'Código SKU': i.codigo,
        'Nome do Produto': i.nome || '—',
        'Quantidade': i.quantidade,
        'Valor Parado (R$)': i.valor,
        'Meses Parado': i.mesesParado
      }))
      const ws = XLSX.utils.json_to_sheet(dadosExportacao)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Materiais Parados")
      XLSX.writeFile(wb, `Materiais_Parados_${periodoTxtExport.replace('/','-')}.xlsx`)
      setExportando(false)
    }, 150)
  }, [itensParadosParaExportar, periodoTxtExport])

  const exportarPowerPoint = useCallback(() => {
    setExportando(true)
    setTimeout(() => {
      alert("Integração completa do PPTX precisa de configuração avançada do pptxgenjs com os dados desta view.")
      setExportando(false)
    }, 1000)
  }, [])

  // -------------------------------------------------------------------------
  // TOGGLES DE VISIBILIDADE DOS GRÁFICOS
  // -------------------------------------------------------------------------
  const toggleVis = useCallback((key) => setVis((v) => ({ ...v, [key]: !v[key] })), [])
  const toggleVisComprasConsumo = useCallback((key) => setVisComprasConsumo((v) => ({ ...v, [key]: !v[key] })), [])
  const toggleVisGiroCobertura = useCallback((key) => setVisGiroCobertura((v) => ({ ...v, [key]: !v[key] })), [])

  // -------------------------------------------------------------------------
  // HELPERS DE GRÁFICO
  // -------------------------------------------------------------------------
  const isPeriodSelected = useCallback((d) => {
    if (!periodoEfetivo || !d) return false
    if (d.closingPeriodo && d.closingPeriodo === periodoEfetivo) return true
    if (d.periodo === periodoEfetivo) return true
    return false
  }, [periodoEfetivo])

  const handleChartClick = useCallback((event) => {
    if (!event?.points?.[0]?.x) return
    const clickedLabel = event.points[0].x
    const series = timeSeriesAgg.total || []
    const point = series.find(d => d.periodo === clickedLabel)
    const periodoParaSnapshot = point?.closingPeriodo || clickedLabel
    dispatch({ type: 'SET_PERIODO_ATIVO', payload: periodoParaSnapshot })
  }, [dispatch, timeSeriesAgg.total])

  // Ao mudar granularidade, seleciona o último período
  useEffect(() => {
    const series = timeSeriesAgg.total || []
    if (!series.length) return
    const last = series[series.length - 1]
    const closing = last.closingPeriodo || last.periodo
    if (closing) {
      dispatch({ type: 'SET_PERIODO_ATIVO', payload: closing })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularidade])

  const maxValorGlobal = useMemo(() => {
    let m = 10
    if (vis.total) m = Math.max(m, ...timeSeriesAgg.total.map(d => d.valor))
    if (vis.operacional) m = Math.max(m, ...timeSeriesAgg.operacional.map(d => d.valor))
    if (vis.critico) m = Math.max(m, ...timeSeriesAgg.critico.map(d => d.valor))
    if (vis.obsoleto) m = Math.max(m, ...timeSeriesAgg.obsoleto.map(d => d.valor))
    if (vis.obra) m = Math.max(m, ...timeSeriesAgg.obra.map(d => d.valor))
    if (vis.insumo) m = Math.max(m, ...timeSeriesAgg.insumo.map(d => d.valor))
    return m > 0 ? m : 10
  }, [vis, timeSeriesAgg])

  const getChartShapes = (aggKey, colorBase) => {
    if (!periodoEfetivo || !timeSeriesAgg[aggKey]?.length) return []
    const index = timeSeriesAgg[aggKey].findIndex((d) => isPeriodSelected(d))
    if (index === -1) return []
    return [
      { type: 'line', xref: 'x', yref: 'paper', x0: index, x1: index, y0: 0, y1: 1, line: { color: colorBase, width: 1.5, dash: 'dot' }, layer: 'below' },
      { type: 'rect', xref: 'x', yref: 'paper', x0: index - 0.15, x1: index + 0.15, y0: 0, y1: 1, fillcolor: colorBase.replace('1)', '0.08)'), line: { width: 0 }, layer: 'below' },
    ]
  }

  const chartShapes = useMemo(() => getChartShapes('total', 'rgba(245, 130, 32, 1)'), [timeSeriesAgg.total, periodoEfetivo, isPeriodSelected])
  const chartShapesSkus = useMemo(
    () => getChartShapes('skus', abaSkus === 'duplicados' ? 'rgba(241, 196, 15, 1)' : 'rgba(245, 130, 32, 1)'),
    [timeSeriesAgg.skus, periodoEfetivo, abaSkus, isPeriodSelected]
  )

  const chartShapesGiro = useMemo(() => {
    if (!periodoEfetivo || !giroCoberturaTempo.length) return []
    const index = giroCoberturaTempo.findIndex((d) => d.periodo === periodoEfetivo)
    if (index === -1) return []
    return [
      { type: 'line', xref: 'x', yref: 'paper', x0: index, x1: index, y0: 0, y1: 1, line: { color: '#f58220', width: 1.5, dash: 'dot' }, layer: 'below' },
      { type: 'rect', xref: 'x', yref: 'paper', x0: index - 0.15, x1: index + 0.15, y0: 0, y1: 1, fillcolor: 'rgba(245, 130, 32, 0.08)', line: { width: 0 }, layer: 'below' },
    ]
  }, [giroCoberturaTempo, periodoEfetivo])

  // -------------------------------------------------------------------------
  // RESET DE FILTROS
  // -------------------------------------------------------------------------
  const handleResetFiltros = useCallback(() => {
    dispatch({ type: 'SET_TIPOS_ESTOQUE', payload: [] })
    dispatch({ type: 'SET_ESCOPOS', payload: [] })
    dispatch({ type: 'SET_UNIDADES', payload: [] })
    dispatch({ type: 'SET_FIELD', field: 'regioesSel', payload: [] })
    dispatch({ type: 'SET_FIELD', field: 'segmentosSel', payload: [] })

    if (anoOpcoes && anoOpcoes.length > 0) {
      dispatch({ type: 'SET_ANOS', payload: [String(anoOpcoes[anoOpcoes.length - 1])] })
    } else {
      dispatch({ type: 'SET_ANOS', payload: [] })
    }

    dispatch({ type: 'SET_PERIODO_ATIVO', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'selectedBarraRanking', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'selectedBarraExposicao', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'selectedBarraCritico', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'selectedBarraObsoleto', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'selectedBarraObra', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'selectedBarraCompraConsumo', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'selectedBarraVariacao', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'selectedBarraSkus', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'filtroMesParado', payload: null })
    dispatch({ type: 'SET_FIELD', field: 'granularidade', payload: 'mensal' })

    setVis({ total: true, operacional: false, critico: false, obsoleto: false, obra: false, insumo: false })
  }, [dispatch, anoOpcoes])

  // -------------------------------------------------------------------------
  // FLAGS DE CARD ATIVO
  // -------------------------------------------------------------------------
  const isRankingSelected = activeCard === 'ranking_unidade'
  const isExposicaoSelected = activeCard === 'composicao_estoque'
  const isCompraConsumoSelected = activeCard === 'compra_consumo_unidade'
  const isVariacaoSelected = activeCard === 'variacao_estoque'
  const isSkusUnidadeSelected = activeCard === 'skus_unidade'

  const tabStyles = {
    total: 'bg-[#f58220]/20 text-[#f58220] border-[#f58220]/50 shadow-[0_0_10px_rgba(245,130,32,0.15)]',
    operacional: 'bg-[#3498db]/20 text-[#3498db] border-[#3498db]/50 shadow-[0_0_10px_rgba(52,152,219,0.15)]',
    critico: 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/50 shadow-[0_0_10px_rgba(231,76,60,0.15)]',
    obsoleto: 'bg-[#9b59b6]/20 text-[#9b59b6] border-[#9b59b6]/50 shadow-[0_0_10px_rgba(155,89,182,0.15)]',
    obra: 'bg-[#1abc9c]/20 text-[#1abc9c] border-[#1abc9c]/50 shadow-[0_0_10px_rgba(26,188,156,0.15)]',
    insumo: 'bg-[#f1c40f]/20 text-[#f1c40f] border-[#f1c40f]/50 shadow-[0_0_10px_rgba(241,196,15,0.15)]'
  }

  // -------------------------------------------------------------------------
  // COLUNAS DAS TABELAS
  // -------------------------------------------------------------------------
  const colsMaioresValores = useMemo(() => [
    { key: 'unidade', label: 'Unidade', className: 'text-white font-medium' },
    { key: 'codigo', label: 'Código SKU', className: 'text-accent font-mono' },
    { key: 'nome', label: 'Nome do Produto', className: 'text-white truncate max-w-[220px]', title: (i) => i.nome, render: (i) => i.nome || '—' },
    { key: 'ge', label: 'GE', className: 'text-muted font-medium text-center' },
    { key: 'itemCritico', label: 'Crítico', align: 'center', render: (i) => (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${i.itemCritico === 'Sim' ? 'bg-[#e74c3c]/15 text-[#e74c3c] border-[#e74c3c]/30' : 'bg-dark-500/20 text-muted border-dark-500/30'}`}>
        {i.itemCritico}
      </span>
    )},
    { key: 'quantidade', label: 'Quantidade', align: 'right', className: 'font-mono text-white', render: (i) => Number(i.quantidade).toLocaleString('pt-BR') },
    { key: 'precoMedio', label: 'Preço Médio', align: 'right', className: 'font-mono text-accent', render: (i) => fmtBRL(i.precoMedio) },
    { key: 'valor', label: 'Valor em Estoque', align: 'right', className: 'font-mono text-[#3498db] font-bold', render: (i) => fmtBRL(i.valor) },
  ], [])

  const colsDuplicados = useMemo(() => [
    { key: 'nome', label: 'Nome do Produto (Agrupado)', className: 'text-white font-medium max-w-[220px] truncate', title: (i) => i.nome },
    { key: 'qtd_skus', label: 'Qtd SKUs', align: 'center', render: (i) => (
      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm border bg-[#f1c40f]/15 text-[#f1c40f] border-[#f1c40f]/30">{i.qtd_skus} SKUs</span>
    )},
    { key: 'skus_lista', label: 'Lista de SKUs', className: 'text-[#f1c40f] font-mono text-[10px] max-w-[240px] truncate', title: (i) => i.skus_lista },
    { key: 'quantidade', label: 'Qtd Fís.', align: 'right', className: 'font-mono text-white', render: (i) => Number(i.quantidade).toLocaleString('pt-BR') },
    { key: 'valor', label: 'Valor Imobilizado', align: 'right', className: 'font-mono text-[#f1c40f] font-bold', render: (i) => fmtBRL(i.valor) },
  ], [])

  const colsComprasSemConsumo = useMemo(() => [
    { key: 'unidade', label: 'Unidade', className: 'text-white font-medium' },
    { key: 'codigo', label: 'Código SKU', className: 'text-[#e74c3c] font-mono' },
    { key: 'nome', label: 'Nome do Produto', className: 'text-white truncate max-w-[140px]', title: (i) => i.nome, render: (i) => i.nome || '—' },
    { key: 'flags', label: 'Atributos (Lentes)', align: 'left', render: (i) => (
      <div className="flex flex-wrap gap-1">
        {i.flags.critico && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-[#e74c3c]/15 text-[#e74c3c] border-[#e74c3c]/30">Crítico</span>}
        {i.flags.obsoleto && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-[#9b59b6]/15 text-[#9b59b6] border-[#9b59b6]/30">Obsoleto</span>}
        {i.flags.obra && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-[#1abc9c]/15 text-[#1abc9c] border-[#1abc9c]/30">Obra</span>}
        {i.flags.insumo && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-[#f1c40f]/15 text-[#f1c40f] border-[#f1c40f]/30">Insumo</span>}
        {i.flags.op && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-[#3498db]/15 text-[#3498db] border-[#3498db]/30">Operacional</span>}
      </div>
    )},
    { key: 'qtdeComprada', label: 'Qtde Comprada', align: 'right', className: 'font-mono text-white', render: (i) => Number(i.qtdeComprada).toLocaleString('pt-BR') },
    { key: 'comprado', label: 'Valor Comprado', align: 'right', className: 'font-mono text-[#e74c3c] font-bold', render: (i) => fmtBRL(i.comprado) },
    { key: 'consumido', label: 'Valor Consumido', align: 'right', className: 'font-mono text-[#2ecc71]', render: (i) => fmtBRL(i.consumido) },
  ], [])

  const colsParados = useMemo(() => [
    { key: 'unidade', label: 'Unidade', className: 'text-white font-medium' },
    { key: 'codigo', label: 'Código SKU', className: 'text-accent font-mono' },
    { key: 'nome', label: 'Nome do Produto', className: 'text-white truncate max-w-[220px]', title: (i) => i.nome, render: (i) => i.nome || '—' },
    { key: 'quantidade', label: 'Quantidade', align: 'right', className: 'font-mono text-white', render: (i) => Number(i.quantidade).toLocaleString('pt-BR') },
    { key: 'valor', label: 'Valor Parado', align: 'right', className: 'font-mono text-[#f58220] font-bold', render: (i) => fmtBRL(i.valor) },
    { key: 'mesesParado', label: 'Meses Parado', align: 'center', render: (i) => (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-accent/15 text-accent border-accent/30">{i.mesesParado} meses</span>
    )},
  ], [])

  // -------------------------------------------------------------------------
  // HELPER DE BARRAS HORIZONTAIS INTERATIVAS
  // -------------------------------------------------------------------------
  const makeInteractiveHBar = useCallback((items, color, selectedBar, fieldName) => {
    if (!items.length) return <p className="text-muted text-sm text-center py-10">Sem dados</p>
    const maxValItems = Math.max(...items.map((d) => d.valor ?? d.total), 1)
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Plot
          data={[
            {
              type: 'bar', orientation: 'h',
              y: items.map((d) => d.unidade),
              x: items.map(() => maxValItems * 1.25),
              marker: { color: 'rgba(255, 255, 255, 0.01)' },
              hoverinfo: 'none',
              showlegend: false
            },
            {
              type: 'bar', orientation: 'h',
              y: items.map((d) => d.unidade),
              x: items.map((d) => d.valor ?? d.total),
              cliponaxis: false,
              textposition: 'outside',
              text: items.map((d) => {
                const isSelected = !selectedBar || d.unidade === selectedBar
                const rawText = d.total != null ? `${fmtInt(d.total)} SKUs` : fmtValorCurto(d.valor)
                const textColor = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'
                return `<span style="color: ${textColor}; margin-left: 6px;">${rawText}</span>`
              }),
              textfont: { size: 10, family: 'Inter', weight: 600 },
              marker: {
                color: items.map((d) => (!selectedBar || d.unidade === selectedBar) ? color : 'rgba(255, 255, 255, 0.15)'),
                opacity: items.map((d) => (!selectedBar || d.unidade === selectedBar) ? 1 : 0.3),
                line: { color: '#080808', width: 1 }
              },
              hoverinfo: 'none'
            }
          ]}
          layout={{
            ...PLOT_LAYOUT,
            barmode: 'overlay',
            bargap: 0.4,
            height: Math.max(300, items.length * 32),
            margin: { l: 115, r: 80, t: 10, b: 10 },
            xaxis: { showgrid: false, showticklabels: false, zeroline: false, range: [0, maxValItems * 1.25] },
            yaxis: {
              showgrid: true,
              gridcolor: '#4A4A4A',
              tickson: 'boundaries',
              tickmode: 'array',
              tickvals: items.map((d) => d.unidade),
              ticktext: items.map((d) => {
                const isSelected = !selectedBar || d.unidade === selectedBar
                const textColor = isSelected ? '#d1d8df' : 'rgba(140, 155, 165, 0.3)'
                return `<span style="color: ${textColor};">${d.unidade}&nbsp;&nbsp;</span>`
              }),
              ticklen: 0,
              tickcolor: 'rgba(0,0,0,0)',
              tickpad: 8,
              automargin: true
            }
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', minHeight: 280, cursor: 'pointer' }}
          useResizeHandler
          onClick={(e) => {
            e?.event?.stopPropagation?.()
            e?.event?.preventDefault?.()
            if (e?.points?.[0]?.y) dispatch({ type: 'TOGGLE_FIELD', field: fieldName, payload: e.points[0].y.trim() })
          }}
        />
      </div>
    )
  }, [dispatch])


  const chartAnnotations = useMemo(() => {
    let anns = []
    const createAnns = (dataArr, color, yOffset) => dataArr.map(d => {
      const isSelected = isPeriodSelected(d)
      return {
        x: d.periodo, 
        y: d.valor, 
        text: `<b>${fmtValorCurto(d.valor)}</b>`, 
        showarrow: true, 
        arrowhead: 0, 
        arrowcolor: 'rgba(0,0,0,0)',
        ax: 0, 
        ay: yOffset, 
        font: { size: 10, color: isSelected ? '#080808' : '#ffffff', family: 'Inter' }, 
        bgcolor: isSelected ? color : 'rgba(22, 22, 22, 0.85)', 
        bordercolor: color, 
        borderwidth: 1, 
        borderpad: 4,
      }
    })
    if (vis.total) anns.push(...createAnns(timeSeriesAgg.total, '#f58220', -22))
    if (vis.operacional) anns.push(...createAnns(timeSeriesAgg.operacional, '#3498db', 24))
    if (vis.critico) anns.push(...createAnns(timeSeriesAgg.critico, '#e74c3c', -22))
    if (vis.obsoleto) anns.push(...createAnns(timeSeriesAgg.obsoleto, '#9b59b6', 24))
    if (vis.obra) anns.push(...createAnns(timeSeriesAgg.obra, '#1abc9c', -22))
    if (vis.insumo) anns.push(...createAnns(timeSeriesAgg.insumo, '#f1c40f', 24))
    return anns
  }, [timeSeriesAgg, vis, periodoEfetivo, isPeriodSelected])

  const sumRanking = useMemo(() => rankingUnidadeAtivo.reduce((acc, curr) => acc + curr.valor, 0), [rankingUnidadeAtivo])
  const maxValRanking = useMemo(() => Math.max(...rankingUnidadeAtivo.map((d) => d.valor), 1), [rankingUnidadeAtivo])
  const colorMapRanking = { total: '#f58220', operacional: '#3498db', critico: '#e74c3c', obsoleto: '#9b59b6', obra: '#1abc9c', insumo: '#f1c40f' }
  const activeRankColor = colorMapRanking[abaRankingUnidade] || '#f58220'

  const plotDataRanking = useMemo(() => [
    {
      type: 'bar', orientation: 'h',
      y: rankingUnidadeAtivo.map((d) => d.unidade),
      x: rankingUnidadeAtivo.map(() => maxValRanking * 1.3),
      marker: { color: 'rgba(255, 255, 255, 0.01)' }, 
      hoverinfo: 'none',
      showlegend: false
    },
    {
      type: 'bar', orientation: 'h',
      y: rankingUnidadeAtivo.map((d) => d.unidade),
      x: rankingUnidadeAtivo.map((d) => d.valor),
      cliponaxis: false,
      textposition: 'outside',
      text: rankingUnidadeAtivo.map((d) => {
        const isSelected = !selectedBarraRanking || d.unidade === selectedBarraRanking
        const rawText = fmtValorCurto(d.valor)
        const pct = sumRanking > 0 ? ((d.valor / sumRanking) * 100).toFixed(1) : 0
        const textColor = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'
        const badgeColor = isSelected ? activeRankColor : 'rgba(140, 155, 165, 0.3)'
        return `<span style="color: ${textColor};">${rawText}</span><span style="color: transparent;">__</span><span style="color: ${badgeColor}; font-size: 10px; font-weight: 800;">[ ${pct}% ]</span>`
      }),
      textfont: { size: 10, family: 'Inter', weight: 600 },
      marker: {
        color: activeRankColor,
        opacity: rankingUnidadeAtivo.map((d) => (!selectedBarraRanking || d.unidade === selectedBarraRanking) ? 1 : 0.2),
        line: { color: '#080808', width: 1 }
      },
      hoverinfo: 'none'
    }
  ], [rankingUnidadeAtivo, selectedBarraRanking, maxValRanking, activeRankColor, sumRanking])


  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-fade-in bg-[#080808] min-h-screen p-2 sm:p-4 text-white relative">
      <style>{`
        .js-plotly-plot .plotly .cursor-crosshair { cursor: pointer !important; }
        div:focus, table:focus, tbody:focus, tr:focus, td:focus, [role="button"]:focus { 
          outline: none !important; 
          box-shadow: none !important;
        }
      `}</style>

      {/* --- CABEÇALHO GLOBAL --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2 mt-2 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2a1610] border border-[#f58220]/30 flex items-center justify-center text-[#f58220] shadow-inner shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-black text-white tracking-wider uppercase drop-shadow-sm">GESTÃO E FECHAMENTO EXECUTIVO DE ESTOQUE</h1>
            <span className="text-[10px] text-accent tracking-widest uppercase font-bold">Arquitetura de Lentes Independentes (Volumes Absolutos)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* SELETOR DE GRANULARIDADE TEMPORAL (MENSAL, TRIMESTRE, SEMESTRE, ANUAL) */}
          <div className="flex items-center bg-[#161616] border border-[#2A2A2A] rounded-lg p-1">
            {[
              { key: 'mensal', label: 'Mensal' },
              { key: 'trimestre', label: 'Trimestre' },
              { key: 'semestre', label: 'Semestre' },
              { key: 'anual', label: 'Anual' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => dispatch({ type: 'SET_FIELD', field: 'granularidade', payload: key })}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                  granularidade === key 
                    ? 'bg-accent text-[#080808] shadow' 
                    : 'text-[#8c9ba5] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button onClick={exportarPowerPoint} disabled={exportando} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#121212] hover:bg-[#1a1a1a] border border-[#2A2A2A] hover:border-[#f58220]/50 text-white font-bold text-[11px] tracking-widest shadow-sm transition-all disabled:opacity-50 disabled:cursor-wait">
            <svg className="w-4 h-4 text-[#f58220]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            <span>{exportando ? 'Gerando...' : 'PPTX'}</span>
          </button>
        </div>
      </div>
      {/* --- FILTROS E GRÁFICO PRINCIPAL --- */}
      <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)] group">
        <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#2A2A2A]">
          <div className="shrink-0">
            <div className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase mb-1 flex items-center gap-3">Painel Gerencial Âmbar Energia</div>
            <h2 className="text-base font-bold text-white flex items-center gap-2.5 tracking-wide">
              <svg className="w-5 h-5 text-accent shrink-0 drop-shadow-[0_0_8px_rgba(245,130,32,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              EVOLUÇÃO TEMPORAL DO ESTOQUE (R$) [{granularidade.toUpperCase()}]
            </h2>
          </div>

          <div className="flex flex-row flex-wrap items-end justify-end gap-3 z-30 shrink-0">
            {/* Ordem: Categoria → Segmento → Unidade → Região → Usina → Ano
                A cascata funciona em qualquer sequência de clique (cada lista
                monta opções com base em TODOS os outros filtros). */}
            <div className="min-w-[140px]">
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5">Categoria</label>
              <CyberMultiSelect 
                options={tiposEstoqueOpcoes} 
                selected={tiposEstoqueSel} 
                onChange={(val) => dispatch({ type: 'SET_TIPOS_ESTOQUE', payload: val })} 
                placeholder={tiposEstoqueSel.length === 0 || tiposEstoqueSel.length === tiposEstoqueOpcoes.length ? 'Todas as Categorias' : tiposEstoqueSel.join(', ')} 
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5">Segmento</label>
              <CyberMultiSelect 
                options={segmentosOpcoes} 
                selected={segmentosSel} 
                onChange={(val) => dispatch({ type: 'SET_FIELD', field: 'segmentosSel', payload: val })} 
                placeholder={segmentosSel.length === 0 || segmentosSel.length === segmentosOpcoes.length ? 'Todos' : (segmentosSel.length === 1 ? segmentosSel[0] : `${segmentosSel.length} Sel.`)} 
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5">Unidade</label>
              <CyberMultiSelect 
                options={escoposOpcoes} 
                selected={escoposSel} 
                onChange={(val) => dispatch({ type: 'SET_ESCOPOS', payload: val })} 
                placeholder={escoposSel.length === 0 || escoposSel.length === escoposOpcoes.length ? 'Todas' : escoposSel.join(', ')} 
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5">Região</label>
              <CyberMultiSelect 
                options={regioesOpcoes} 
                selected={regioesSel} 
                onChange={(val) => dispatch({ type: 'SET_FIELD', field: 'regioesSel', payload: val })} 
                placeholder={regioesSel.length === 0 || regioesSel.length === regioesOpcoes.length ? 'Todas' : (regioesSel.length === 1 ? regioesSel[0] : `${regioesSel.length} Sel.`)} 
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5">Usina</label>
              <CyberMultiSelect 
                options={opcoesUnid} 
                selected={unidadesSel} 
                onChange={(val) => dispatch({ type: 'SET_UNIDADES', payload: val })} 
                placeholder={unidadesSel.length === 0 || unidadesSel.length === opcoesUnid.length ? 'Todas as Usinas' : (unidadesSel.length === 1 ? unidadesSel[0] : `${unidadesSel.length} Selecionadas`)} 
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5">Ano</label>
              <CyberMultiSelect 
                options={anoOpcoesCascata} 
                selected={anosSel} 
                onChange={(val) => dispatch({ type: 'SET_ANOS', payload: val })} 
                placeholder={anosSel.length === 0 || anosSel.length === anoOpcoesCascata.length ? 'Todos os Anos' : anosSel.join(', ')} 
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4" role="group" aria-label="Filtros de visualização do gráfico">
          {[ 
            { key: 'total', label: 'Estoque Total', color: '#f58220' }, 
            { key: 'operacional', label: 'Operacional', color: '#3498db' },
            { key: 'critico', label: 'Crítico', color: '#e74c3c' }, 
            { key: 'obsoleto', label: 'Obsoleto', color: '#9b59b6' }, 
            { key: 'obra', label: 'Obra', color: '#1abc9c' }, 
            { key: 'insumo', label: 'Insumo', color: '#f1c40f' } 
          ].map(({ key, label, color }) => {
            const isActive = vis[key], hasData = timeSeriesAgg[key] && timeSeriesAgg[key].some(d => d.valor > 0)
            return (
              <button key={key} onClick={() => hasData && toggleVis(key)} disabled={!hasData} aria-pressed={isActive} className={`relative flex items-center justify-center gap-2 px-4 py-2 text-xs transition-all duration-300 rounded-lg overflow-hidden border border-transparent ${!hasData ? 'opacity-30 grayscale cursor-not-allowed text-dark-400 bg-transparent' : !isActive ? 'text-[#8c9ba5] hover:text-white hover:bg-[#222222]/50 border-[#2A2A2A]/40' : 'text-white font-bold bg-[#2A2A2A]/30 border-[#2A2A2A]'}`}>
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
              vis.total && { 
                x: timeSeriesAgg.total.map((d) => d.periodo), 
                y: timeSeriesAgg.total.map((d) => d.valor), 
                name: 'Estoque Total', 
                type: 'scatter', 
                mode: 'lines+markers', 
                hoverinfo: 'none', 
                line: { color: '#f58220', width: 2, shape: 'spline', smoothing: 1.3 }, 
                marker: { 
                  size: timeSeriesAgg.total.map(d => isPeriodSelected(d) ? 12 : 10), 
                  color: timeSeriesAgg.total.map(d => isPeriodSelected(d) ? '#f58220' : '#080808'), 
                  line: { color: '#f58220', width: 1.5 } 
                }, 
                fill: 'tozeroy', 
                fillgradient: { type: 'vertical', colorscale: [['0', 'rgba(245,130,32,0.35)'], ['1', 'rgba(245,130,32,0.0)']] }, 
                fillcolor: 'rgba(245,130,32,0.15)', 
                cliponaxis: false 
              },
              vis.operacional && timeSeriesAgg.operacional.length > 0 && { 
                x: timeSeriesAgg.operacional.map((d) => d.periodo), 
                y: timeSeriesAgg.operacional.map((d) => d.valor), 
                name: 'Operacional', 
                type: 'scatter', 
                mode: 'lines+markers', 
                hoverinfo: 'none', 
                line: { color: '#3498db', width: 1.5, dash: 'solid', shape: 'spline', smoothing: 1.3 }, 
                marker: { 
                  size: timeSeriesAgg.operacional.map(d => isPeriodSelected(d) ? 11 : 8), 
                  color: timeSeriesAgg.operacional.map(d => isPeriodSelected(d) ? '#3498db' : '#080808'), 
                  line: { color: '#3498db', width: 1.5 } 
                }, 
                cliponaxis: false 
              },
              vis.critico && timeSeriesAgg.critico.length > 0 && { 
                x: timeSeriesAgg.critico.map((d) => d.periodo), 
                y: timeSeriesAgg.critico.map((d) => d.valor), 
                name: 'Crítico', 
                type: 'scatter', 
                mode: 'lines+markers', 
                hoverinfo: 'none', 
                line: { color: '#e74c3c', width: 1.5, dash: 'dash', shape: 'spline', smoothing: 1.3 }, 
                marker: { 
                  size: timeSeriesAgg.critico.map(d => isPeriodSelected(d) ? 11 : 8), 
                  color: timeSeriesAgg.critico.map(d => isPeriodSelected(d) ? '#e74c3c' : '#080808'), 
                  line: { color: '#e74c3c', width: 1.5 } 
                }, 
                cliponaxis: false 
              },
              vis.obsoleto && timeSeriesAgg.obsoleto.length > 0 && { 
                x: timeSeriesAgg.obsoleto.map((d) => d.periodo), 
                y: timeSeriesAgg.obsoleto.map((d) => d.valor), 
                name: 'Obsoleto', 
                type: 'scatter', 
                mode: 'lines+markers', 
                hoverinfo: 'none', 
                line: { color: '#9b59b6', width: 1.5, dash: 'dot', shape: 'spline', smoothing: 1.3 }, 
                marker: { 
                  size: timeSeriesAgg.obsoleto.map(d => isPeriodSelected(d) ? 11 : 8), 
                  color: timeSeriesAgg.obsoleto.map(d => isPeriodSelected(d) ? '#9b59b6' : '#080808'), 
                  line: { color: '#9b59b6', width: 1.5 } 
                }, 
                cliponaxis: false 
              },
              vis.obra && timeSeriesAgg.obra.length > 0 && { 
                x: timeSeriesAgg.obra.map((d) => d.periodo), 
                y: timeSeriesAgg.obra.map((d) => d.valor), 
                name: 'Obra', 
                type: 'scatter', 
                mode: 'lines+markers', 
                hoverinfo: 'none', 
                line: { color: '#1abc9c', width: 1.5, dash: 'longdash', shape: 'spline', smoothing: 1.3 }, 
                marker: { 
                  size: timeSeriesAgg.obra.map(d => isPeriodSelected(d) ? 11 : 8), 
                  color: timeSeriesAgg.obra.map(d => isPeriodSelected(d) ? '#1abc9c' : '#080808'), 
                  line: { color: '#1abc9c', width: 1.5 } 
                }, 
                cliponaxis: false 
              },
              vis.insumo && timeSeriesAgg.insumo.length > 0 && { 
                x: timeSeriesAgg.insumo.map((d) => d.periodo), 
                y: timeSeriesAgg.insumo.map((d) => d.valor), 
                name: 'Insumo', 
                type: 'scatter', 
                mode: 'lines+markers', 
                hoverinfo: 'none', 
                line: { color: '#f1c40f', width: 1.5, dash: 'dashdot', shape: 'spline', smoothing: 1.3 }, 
                marker: { 
                  size: timeSeriesAgg.insumo.map(d => isPeriodSelected(d) ? 11 : 8), 
                  color: timeSeriesAgg.insumo.map(d => isPeriodSelected(d) ? '#f1c40f' : '#080808'), 
                  line: { color: '#f1c40f', width: 1.5 } 
                }, 
                cliponaxis: false 
              },
            ].filter(Boolean)}
            layout={{ 
              ...PLOT_LAYOUT, 
              hovermode: 'closest', 
              height: 350, 
              bargap: 0, 
              margin: { l: 20, r: 20, t: 40, b: 45 }, 
              shapes: chartShapes, 
              annotations: chartAnnotations, 
              xaxis: { 
                type: 'category',
                showgrid: false, 
                zeroline: false, 
                tickmode: 'array', 
                tickvals: timeSeriesAgg.total.map(d => d.periodo), 
                ticktext: timeSeriesAgg.total.map(d => {
                  const isSelected = isPeriodSelected(d)
                  const label = d.periodo
                  return isSelected ? `<span style="color: #f58220; font-weight: 900;">• ${label} •</span>` : label
                }), 
                tickpad: 12, 
                automargin: true, 
                range: [-0.8, Math.max(timeSeriesAgg.total.length - 0.2, 1)] 
              }, 
              yaxis: { showgrid: true, gridcolor: '#222222', zeroline: false, showticklabels: false, range: [-(maxValorGlobal * 0.15), maxValorGlobal * 1.3] } 
            }}
            config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', minHeight: 280, cursor: 'pointer' }} useResizeHandler onClick={handleChartClick}
          />
        </div>

        <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#111111]/60 border border-[#2A2A2A]/50 rounded-xl py-3 px-4 mx-auto shadow-inner w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2 w-full">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-accent shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-[11px] text-[#8c9ba5] tracking-wide font-medium">
                Visualizando período: <strong className="text-white text-xs px-1.5 py-0.5 rounded bg-[#222] border border-[#333] ml-0.5">{periodoDisplay}</strong>
              </span>
            </div>
          </div>
          
          <button
            onClick={handleResetFiltros}
            className="group relative flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#f58220]/20 to-transparent hover:from-[#f58220]/30 border border-[#f58220]/30 hover:border-[#f58220] transition-all duration-300 overflow-hidden shadow-[0_0_10px_rgba(245,130,32,0.1)] hover:shadow-[0_0_20px_rgba(245,130,32,0.3)] whitespace-nowrap"
          >
            <div className="absolute inset-0 bg-[#f58220]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <svg className="w-3.5 h-3.5 text-[#f58220] relative z-10 group-hover:-rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white relative z-10">Restaurar Padrão</span>
          </button>
        </div>

        {/* TABELA GAVETA 1: MAIORES VALORES */}
        <div className="mt-5 border border-[#2A2A2A] rounded-xl bg-[#0c0c0c] overflow-hidden shadow-inner">
          <div 
            role="button" 
            tabIndex={0}
            aria-expanded={listaMaioresValoresAberta}
            onClick={() => dispatch({ type: 'TOGGLE_BOOLEAN', field: 'listaMaioresValoresAberta' })} 
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch({ type: 'TOGGLE_BOOLEAN', field: 'listaMaioresValoresAberta' }) } }}
            className="flex items-center justify-between p-3 sm:p-4 bg-[#161616] hover:bg-[#1a1a1a] cursor-pointer transition-colors border-b border-[#2A2A2A] focus:outline-none focus:bg-[#1a1a1a]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#101820] flex items-center justify-center text-[#3498db] shadow-inner shrink-0 border border-[#3498db]/30">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider block">{listaMaioresValoresAberta ? 'Fechar Maiores Valores de Estoque' : 'Ver Maiores Valores de Estoque'}</span>
                <span className="text-[10px] text-muted font-medium mt-0.5 block">Top SKUs por capital na composição atual (Snapshot: {periodoDisplay})</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-[10px] bg-[#3498db]/15 text-[#3498db] px-2 py-0.5 rounded font-mono border border-[#3498db]/30 font-bold">Total: {Number(maioresValoresDataCompleta.length).toLocaleString('pt-BR')}</span>
              <span className="text-[#3498db]">
                {listaMaioresValoresAberta ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>}
              </span>
            </div>
          </div>
          {listaMaioresValoresAberta && (
            <div className="p-4 space-y-4 animate-fade-in bg-[#121212]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-[#8c9ba5]">Exibindo os itens de maior valor financeiro (Top 50 carregados na visualização rápida).</span>
                <div className="flex items-center gap-2">
                  <button onClick={exportarExcelMaioresValores} disabled={exportando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-sm disabled:opacity-50">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span>{exportando ? 'Exportando...' : 'Exportar Excel'}</span>
                  </button>
                  <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'tabelaMaioresValoresExpandida', payload: true })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162432] hover:bg-[#1c2e40] text-[#3498db] border border-[#3498db]/40 text-xs font-bold transition-all shadow-sm group">
                    <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    <span>Expandir Tabela</span>
                  </button>
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar overscroll-contain border border-[#2A2A2A] rounded-xl bg-[#0c0c0c] scroll-pt-14">
                <TabelaGenerica dados={maioresValoresGaveta} columns={colsMaioresValores} highlightColor="#3498db" emptyMessage="Nenhum item encontrado no período selecionado." />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- LINHA FINANCEIRA --- */}
      <div>
        <div className="flex items-center gap-2 mb-3 ml-2 mt-2">
          <div className="w-5 h-5 rounded-md bg-[#12221d] flex items-center justify-center text-[#2ecc71] shadow-inner"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08-.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">Exposição Financeira Absoluta</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <ExecutiveCard cardKey="estoque" activeCard={activeCard} onCardClick={handleCardClick} valueFontSize="text-base lg:text-lg text-white font-black" alignCenter={true} icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} iconBg="bg-[#1c1c1c]" title="(R$) EST. TOTAL" value={fmtBRL(metrics.valEstoque)} valueAtual={metrics.valEstoque} valueAnterior={metrics.valEstoquePrev} invertColor={true} variant="default" />
          <ExecutiveCard cardKey="critico" activeCard={activeCard} onCardClick={handleCardClick} valueFontSize="text-base lg:text-lg text-white font-black" alignCenter={true} icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} iconBg="bg-[#1c1c1c]" title="(R$) CRÍTICO" value={fmtBRL(metrics.valCritico)} valueAtual={metrics.valCritico} valueAnterior={metrics.valCriticoPrev} variant="critico" />
          <ExecutiveCard cardKey="obsoleto" activeCard={activeCard} onCardClick={handleCardClick} valueFontSize="text-base lg:text-lg text-white font-black" alignCenter={true} icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} iconBg="bg-[#1c1c1c]" title="(R$) OBSOLETO" value={fmtBRL(metrics.valObsoleto)} valueAtual={metrics.valObsoleto} valueAnterior={metrics.valObsoletoPrev} variant="obsoleto" />
          <ExecutiveCard cardKey="obra" activeCard={activeCard} onCardClick={handleCardClick} valueFontSize="text-base lg:text-lg text-white font-black" alignCenter={true} icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} iconBg="bg-[#1c1c1c]" title="(R$) OBRA" value={fmtBRL(metrics.valObra)} valueAtual={metrics.valObra} valueAnterior={metrics.valObraPrev} invertColor={true} variant="obra" />
          <ExecutiveCard cardKey="insumo" activeCard={activeCard} onCardClick={handleCardClick} valueFontSize="text-base lg:text-lg text-white font-black" alignCenter={true} icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} iconBg="bg-[#1c1c1c]" title="(R$) INSUMO" value={fmtBRL(metrics.valInsumo)} valueAtual={metrics.valInsumo} valueAnterior={metrics.valInsumoPrev} invertColor={true} variant="default" />
        </div>
      </div>

      {/* --- LINHA OPERACIONAL GLOBAL --- */}
      <div>
        <div className="flex items-center gap-2 mb-3 ml-2 mt-6">
          <div className="w-5 h-5 rounded-md bg-[#262014] flex items-center justify-center text-accent shadow-inner"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">Movimentação Operacional</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <ExecutiveCard cardKey="compras" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>} iconBg="bg-[#1c1c1c]" title="(R$) COMPRAS" value={fmtBRL(metrics.valCompras)} valueAtual={metrics.valCompras} valueAnterior={metrics.valComprasPrev} valueFontSize="text-base lg:text-lg text-white font-black" alignCenter={true} invertColor={true} variant="default" />
          <ExecutiveCard cardKey="consumo" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>} iconBg="bg-[#1c1c1c]" title="(R$) CONSUMO" value={fmtBRL(metrics.valConsumo)} valueAtual={metrics.valConsumo} valueAnterior={metrics.valConsumoPrev} valueFontSize="text-base lg:text-lg text-white font-black" alignCenter={true} variant="default" />
          <ExecutiveCard cardKey="skus" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>} iconBg="bg-[#1c1c1c]" title="SKUs ÚNICOS" value={fmtInt(metrics.valSkus)} valueAtual={metrics.valSkus} valueAnterior={metrics.valSkusPrev} valueFontSize="text-xl lg:text-xl text-white font-black tracking-tight" alignCenter={true} invertColor={true} variant="default" />
          <ExecutiveCard cardKey="giro" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} iconBg="bg-[#1c1c1c]" title="GIRO" value={""} valueAtual={giroMensal} valueAnterior={giroMensalPrev} variant="default">
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1.5 text-center shadow-inner">
                <span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">MENSAL</span>
                <span className="text-base font-black text-white font-mono">{fmtDec(giroMensal)}</span>
              </div>
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1.5 text-center shadow-inner">
                <span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">ANUAL</span>
                <span className="text-base font-black text-white font-mono">{fmtDec(giroAnual)}</span>
              </div>
            </div>
          </ExecutiveCard>
          <ExecutiveCard cardKey="cobertura" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} iconBg="bg-[#1c1c1c]" title="COBERTURA" value={""} valueAtual={coberturaMeses} valueAnterior={coberturaMesesPrev} invertColor={true} variant="default">
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1.5 text-center shadow-inner">
                <span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">MENSAL</span>
                <span className="text-base font-black text-white font-mono">{fmtMes(coberturaMeses)}</span>
              </div>
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1.5 text-center shadow-inner">
                <span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">ANUAL</span>
                <span className="text-base font-black text-white font-mono">{fmtMes(coberturaAnos)}</span>
              </div>
            </div>
          </ExecutiveCard>
        </div>
      </div>

      {/* --- RANKING + EXPOSIÇÃO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div onClick={() => handleCardClick('ranking_unidade')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isRankingSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612] -translate-y-1.5 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]'}`}>
          {isRankingSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span></span></div>)}
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          
          <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-[#262014] flex items-center justify-center text-accent shadow-inner shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">ESTOQUE POR UNIDADE (R$)</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 z-10 w-full xl:w-auto xl:justify-end">
              {[ 
                { key: 'total', label: 'Total' }, 
                { key: 'operacional', label: 'Operacional' },
                { key: 'critico', label: 'Crítico' }, 
                { key: 'obsoleto', label: 'Obsoleto' }, 
                { key: 'obra', label: 'Obra' }, 
                { key: 'insumo', label: 'Insumo' } 
              ].map(({ key, label }) => (
                <button 
                  key={key} 
                  onClick={(e) => { e.stopPropagation(); setAbaRankingUnidade(key); }}
                  className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md transition-all ${
                    abaRankingUnidade === key 
                      ? tabStyles[key] 
                      : 'bg-[#1a1a1a] text-muted border border-[#2a2a2a] hover:bg-[#222] hover:text-[#d1d8df] shadow-sm'
                  }`}
                >
                  {label}
                </button>
              ))}
              {selectedBarraRanking && (
                <button 
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_FIELD', field: 'selectedBarraRanking', payload: null }); }} 
                  className="flex items-center gap-1 text-[9px] sm:text-[10px] bg-accent/20 text-accent border border-accent/40 px-2.5 py-1.5 rounded-md hover:bg-accent/30 transition-all font-mono font-bold ml-1"
                >
                  Limpar <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-[380px] overflow-y-auto custom-scrollbar overscroll-contain" onClick={(e) => e.stopPropagation()}>
            <Plot
              data={plotDataRanking}
              layout={{
                ...PLOT_LAYOUT,
                barmode: 'overlay', 
                bargap: 0.4,
                height: Math.max(300, rankingUnidadeAtivo.length * 32),
                margin: { l: 115, r: 90, t: 10, b: 10 },
                xaxis: { showgrid: false, showticklabels: false, zeroline: false, range: [0, maxValRanking * 1.3] },
                yaxis: {
                  showgrid: true, gridcolor: '#4A4A4A', tickson: 'boundaries', tickmode: 'array', tickvals: rankingUnidadeAtivo.map((d) => d.unidade),
                  ticktext: rankingUnidadeAtivo.map((d) => {
                    const isSelected = !selectedBarraRanking || d.unidade === selectedBarraRanking
                    const textColor = isSelected ? '#d1d8df' : 'rgba(140, 155, 165, 0.3)'
                    return `<span style="color: ${textColor};">${d.unidade}&nbsp;&nbsp;</span>`
                  }),
                  ticklen: 0, tickcolor: 'rgba(0,0,0,0)', tickpad: 8, automargin: true
                }
              }}
              config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', minHeight: 280, cursor: 'pointer' }} useResizeHandler
              onClick={(e) => { e?.event?.stopPropagation?.(); e?.event?.preventDefault?.(); if (e?.points?.[0]?.y) dispatch({ type: 'TOGGLE_FIELD', field: 'selectedBarraRanking', payload: e.points[0].y.trim() }) }}
            />
          </div>
        </div>

        <div onClick={() => handleCardClick('composicao_estoque')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isExposicaoSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612] -translate-y-1.5 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]'}`}>
          {isExposicaoSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span></span></div>)}
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#161c24] flex items-center justify-center text-[#3498db] shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg></div>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">Composição do Estoque por Categoria (%)</span>
            </div>
            {selectedBarraExposicao && (<button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_FIELD', field: 'selectedBarraExposicao', payload: null }); }} className="flex items-center gap-1 text-[10px] bg-[#3498db]/20 text-[#3498db] border border-[#3498db]/40 px-2 py-0.5 rounded hover:bg-[#3498db]/30 transition-all font-mono z-10 relative">Limpar Foco <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>)}
          </div>
          <p className="text-[10px] text-muted mb-1 px-1">Proporção de cada categoria em relação ao Estoque Total contábil. Devido a sobreposições, a soma pode exceder 100%.</p>
          <div className="flex-grow flex items-center justify-center mt-2" onClick={(e) => e.stopPropagation()}>
            {exposicaoCategorias.length > 0 ? (
              <Plot
                data={[
                  {
                    type: 'pie',
                    labels: exposicaoCategorias.map(d => d.name),
                    values: exposicaoCategorias.map(d => d.value),
                    customdata: exposicaoCategorias.map(d => fmtBRL(d.value)),
                    marker: { 
                      colors: exposicaoCategorias.map(d => (!selectedBarraExposicao || d.name === selectedBarraExposicao) ? d.color : `${d.color}4D`),
                      line: { color: '#161616', width: 2 }
                    },
                    textinfo: 'percent',
                    textfont: { color: '#ffffff', size: 14, family: 'Inter', weight: 800 },
                    hovertemplate: '<b>%{label}</b><br>Valor: %{customdata}<br>Proporção: %{percent}<extra></extra>',
                    automargin: true
                  }
                ]}
                layout={{
                  ...PLOT_LAYOUT,
                  height: 400,
                  margin: { l: 0, r: 0, t: 10, b: 20 },
                  showlegend: true,
                  legend: { orientation: 'h', font: { color: '#8c9ba5', size: 11 }, x: 0.5, y: -0.1, xanchor: 'center' }
                }}
                config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', minHeight: 400, cursor: 'pointer' }} useResizeHandler
                onClick={(e) => { e?.event?.stopPropagation?.(); if (e?.points?.[0]?.label) dispatch({ type: 'TOGGLE_FIELD', field: 'selectedBarraExposicao', payload: e.points[0].label }) }}
              />
            ) : (<p className="text-muted text-center py-16">Sem dados</p>)}
          </div>
        </div>
      </div>

      {/* --- COMPRA x CONSUMO --- */}
      <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] mt-6 relative overflow-hidden transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)] group">
        <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-[#2ecc71]/50 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg bg-[#12221d] flex items-center justify-center border shadow-inner shrink-0 ${abaCompraConsumo === 'sem_consumo' ? 'border-[#e74c3c]/30' : 'border-[#2ecc71]/30'}`}>
              <svg className={`w-4 h-4 ${abaCompraConsumo === 'sem_consumo' ? 'text-[#e74c3c]' : 'text-[#2ecc71]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            </div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">EVOLUÇÃO TEMPORAL COMPRA x CONSUMO (R$) [{granularidade.toUpperCase()}]</h2>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row items-end sm:items-center gap-4 ml-auto">
            <div className={`flex items-center gap-3 text-[11px] font-medium tracking-wider border-r border-[#2A2A2A] pr-4 mr-2 transition-all duration-300 ${abaCompraConsumo === 'sem_consumo' ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
              <button onClick={() => toggleVisComprasConsumo('compras')} className={`flex items-center gap-2 transition-all cursor-pointer ${visComprasConsumo.compras ? 'text-white' : 'text-[#666] opacity-60'}`}>
                <span className={`w-2 h-2 rounded-full ${visComprasConsumo.compras ? 'bg-[#e74c3c]' : 'bg-[#555]'}`}></span><span>Compras</span>
              </button>
              <button onClick={() => toggleVisComprasConsumo('consumo')} className={`flex items-center gap-2 transition-all cursor-pointer ${visComprasConsumo.consumo ? 'text-white' : 'text-[#666] opacity-60'}`}>
                <span className={`w-2 h-2 rounded-full ${visComprasConsumo.consumo ? 'bg-[#2ecc71]' : 'bg-[#555]'}`}></span><span>Consumo</span>
              </button>
            </div>
            
            <div role="tablist" className="flex items-center gap-3 text-[11px] font-medium tracking-wider">
              <button role="tab" aria-selected={abaCompraConsumo === 'comparativo'} onClick={() => dispatch({ type: 'SET_FIELD', field: 'abaCompraConsumo', payload: 'comparativo' })} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer focus:outline-none ${abaCompraConsumo === 'comparativo' ? 'bg-[#2ecc71]/15 border-[#2ecc71]/40 text-white shadow-[0_0_10px_rgba(46,204,113,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
                <span className="relative flex items-center justify-center w-4 h-[2px] bg-[#2ecc71]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${abaCompraConsumo === 'comparativo' ? 'bg-[#2ecc71]' : 'bg-[#555]'}`}></span></span>
                <span>Compra x Consumo</span>
              </button>
              <button role="tab" aria-selected={abaCompraConsumo === 'sem_consumo'} onClick={() => dispatch({ type: 'SET_FIELD', field: 'abaCompraConsumo', payload: 'sem_consumo' })} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer focus:outline-none ${abaCompraConsumo === 'sem_consumo' ? 'bg-[#e74c3c]/15 border-[#e74c3c]/40 text-white shadow-[0_0_10px_rgba(231,76,60,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
                <span className="relative flex items-center justify-center w-4 h-[2px] bg-[#e74c3c]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${abaCompraConsumo === 'sem_consumo' ? 'bg-[#e74c3c]' : 'bg-[#555]'}`}></span></span>
                <span>Compras s/ Consumo</span>
              </button>
            </div>
          </div>
        </div>

        <Plot
          data={abaCompraConsumo === 'comparativo' ? [
            visComprasConsumo.compras && { 
              x: timeSeriesAgg.comprasConsumo.map((d) => d.periodo), 
              y: timeSeriesAgg.comprasConsumo.map((d) => d.compras), 
              name: 'Compras', 
              type: 'scatter', 
              mode: 'lines+markers', 
              line: { color: '#e74c3c', width: 2.5, shape: 'spline', smoothing: 1.3 }, 
              marker: { 
                size: timeSeriesAgg.comprasConsumo.map(d => isPeriodSelected(d) ? 11 : 8), 
                color: timeSeriesAgg.comprasConsumo.map(d => isPeriodSelected(d) ? '#e74c3c' : '#080808'), 
                line: { color: '#e74c3c', width: 1.5 } 
              }, 
              customdata: timeSeriesAgg.comprasConsumo.map((d) => fmtBRL(d.compras)), 
              hovertemplate: '<b>%{x}</b><br>Compras: <span style="color:#e74c3c; font-weight:bold;">%{customdata}</span><extra></extra>' 
            },
            visComprasConsumo.consumo && { 
              x: timeSeriesAgg.comprasConsumo.map((d) => d.periodo), 
              y: timeSeriesAgg.comprasConsumo.map((d) => d.consumo), 
              name: 'Consumo', 
              type: 'scatter', 
              mode: 'lines+markers', 
              line: { color: '#2ecc71', width: 2.5, shape: 'spline', smoothing: 1.3 }, 
              marker: { 
                size: timeSeriesAgg.comprasConsumo.map(d => isPeriodSelected(d) ? 11 : 8), 
                color: timeSeriesAgg.comprasConsumo.map(d => isPeriodSelected(d) ? '#2ecc71' : '#080808'), 
                line: { color: '#2ecc71', width: 1.5 } 
              }, 
              customdata: timeSeriesAgg.comprasConsumo.map((d) => fmtBRL(d.consumo)), 
              hovertemplate: '<b>%{x}</b><br>Consumo: <span style="color:#2ecc71; font-weight:bold;">%{customdata}</span><extra></extra>' 
            },
          ].filter(Boolean) : [
            { 
              x: timeSeriesAgg.comprasSemConsumoEvolucao.map((d) => d.periodo), 
              y: timeSeriesAgg.comprasSemConsumoEvolucao.map((d) => d.valor), 
              name: 'Compras s/ Consumo', 
              type: 'scatter', 
              mode: 'lines+markers', 
              line: { color: '#e74c3c', width: 2.5, shape: 'spline', smoothing: 1.3 }, 
              marker: { 
                size: timeSeriesAgg.comprasSemConsumoEvolucao.map(d => isPeriodSelected(d) ? 11 : 8), 
                color: timeSeriesAgg.comprasSemConsumoEvolucao.map(d => isPeriodSelected(d) ? '#e74c3c' : '#080808'), 
                line: { color: '#e74c3c', width: 1.5 } 
              },
              fill: 'tozeroy', 
              fillgradient: { type: 'vertical', colorscale: [['0', 'rgba(231,76,60,0.35)'], ['1', 'rgba(231,76,60,0.0)']] }, 
              fillcolor: 'rgba(231,76,60,0.15)',
              customdata: timeSeriesAgg.comprasSemConsumoEvolucao.map((d, index, arr) => {
                const prev = index > 0 ? arr[index - 1].valor : d.valor;
                let arrowHtml = '';
                if (index > 0) {
                  if (d.valor > prev) arrowHtml = '<span style="color:#e74c3c; margin-left:6px;">▲</span>';
                  else if (d.valor < prev) arrowHtml = '<span style="color:#2ecc71; margin-left:6px;">▼</span>';
                  else arrowHtml = '<span style="color:#a0a0a0; margin-left:6px;">▬</span>';
                }
                return { val: fmtBRL(d.valor), arrowHtml };
              }), 
              hovertemplate: '<b>%{x}</b><br>Material Sem Consumo: <span style="color:#e74c3c; font-weight:bold;">%{customdata.val}</span>%{customdata.arrowHtml}<extra></extra>' 
            }
          ]}
          layout={{ 
            ...PLOT_LAYOUT, 
            height: 350, 
            showlegend: false, 
            hovermode: 'x unified', 
            hoverlabel: { bgcolor: '#0c0c0c', bordercolor: '#333333', font: { color: '#ffffff', family: 'Inter', size: 12 } }, 
            shapes: chartShapes, 
            xaxis: {
              type: 'category', 
              showgrid: false, 
              zeroline: false, 
              tickmode: 'array', 
              tickvals: timeSeriesAgg.comprasConsumo.map(d => d.periodo), 
              ticktext: timeSeriesAgg.comprasConsumo.map(d => {
                const isSelected = isPeriodSelected(d)
                const label = d.periodo
                return isSelected ? `<span style="color: #f58220; font-weight: 900;">• ${label} •</span>` : label
              }), 
              showspikes: true, 
              spikemode: 'across', 
              spikedash: 'dot', 
              spikecolor: '#555555', 
              spikethickness: 1, 
              tickpad: 12, 
              automargin: true 
            }, 
            yaxis: { showgrid: true, gridcolor: '#222222', zeroline: false, showticklabels: false } 
          }}
          config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', minHeight: 280, cursor: 'pointer' }} useResizeHandler onClick={handleChartClick}
        />

        {/* TABELA GAVETA 2: COMPRAS SEM CONSUMO */}
        <div className="mt-5 border border-[#e74c3c]/30 rounded-xl bg-[#0c0c0c] overflow-hidden shadow-inner">
          <div 
            role="button" 
            tabIndex={0}
            aria-expanded={listaComprasSemConsumoAberta}
            onClick={() => dispatch({ type: 'TOGGLE_BOOLEAN', field: 'listaComprasSemConsumoAberta' })} 
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch({ type: 'TOGGLE_BOOLEAN', field: 'listaComprasSemConsumoAberta' }) } }}
            className="flex items-center justify-between p-3 sm:p-4 bg-[#1a0f0f] hover:bg-[#201212] cursor-pointer transition-colors border-b border-[#e74c3c]/20 focus:outline-none focus:bg-[#201212]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#261010] flex items-center justify-center text-[#e74c3c] shadow-inner shrink-0 border border-[#e74c3c]/30">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div><span className="text-xs font-bold text-[#e74c3c] uppercase tracking-wider block">{listaComprasSemConsumoAberta ? 'Fechar Lista de Compras sem Consumo' : 'Alerta: Compras realizadas com Baixo Consumo'}</span><span className="text-[10px] text-muted font-medium mt-0.5 block">Itens com compra e baixo consumo no período (Snapshot: {periodoDisplay})</span></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-[10px] bg-[#e74c3c]/15 text-[#e74c3c] px-2 py-0.5 rounded font-mono border border-[#e74c3c]/30 font-bold">Total: {Number(comprasSemConsumoDataCompleta.length).toLocaleString('pt-BR')}</span>
              <span className="text-[#e74c3c]">
                {listaComprasSemConsumoAberta ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>}
              </span>
            </div>
          </div>
          {listaComprasSemConsumoAberta && (
            <div className="p-4 space-y-4 animate-fade-in bg-[#120a0a]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-[#e74c3c]/80">Listando materiais com imobilização de caixa no período (Consumo inferior a 5% da compra).</span>
                <div className="flex items-center gap-2">
                  <button onClick={exportarExcelComprasSemConsumo} disabled={exportando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-sm disabled:opacity-50">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span>{exportando ? 'Exportando...' : 'Exportar Excel'}</span>
                  </button>
                  <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'tabelaComprasSemConsumoExpandida', payload: true })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1a1a] hover:bg-[#3a2020] text-[#f58220] border border-[#f58220]/40 text-xs font-bold transition-all shadow-sm group">
                    <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    <span>Expandir Tabela</span>
                  </button>
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar overscroll-contain border border-[#2A2A2A] rounded-xl bg-[#0c0c0c] scroll-pt-14">
                <TabelaGenerica dados={comprasSemConsumoGaveta} columns={colsComprasSemConsumo} highlightColor="#e74c3c" emptyMessage="Base limpa. Toda compra registrada neste mês teve movimentação de consumo saudável." />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- COMPRA x CONSUMO POR UNIDADE + VARIAÇÃO + SKUs --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div onClick={() => handleCardClick('compra_consumo_unidade')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isCompraConsumoSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612] -translate-y-1.5 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]'}`}>
          {isCompraConsumoSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span></span></div>)}
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#262014] flex items-center justify-center text-accent shadow-inner shrink-0"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg></div><span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">COMPRA X CONSUMO POR UNIDADE</span></div>
            {selectedBarraCompraConsumo && (<button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_FIELD', field: 'selectedBarraCompraConsumo', payload: null }); }} className="flex items-center gap-1 text-[10px] bg-accent/20 text-accent border border-accent/40 px-2 py-0.5 rounded hover:bg-accent/30 transition-all font-mono">Limpar <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>)}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted tracking-wider mb-2">
            <span><span className="text-[#2ecc71]">■</span> Consumo</span>
            <span><span className="text-[#e74c3c]">■</span> Compras</span>
          </div>
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain" onClick={(e) => e.stopPropagation()}>
            {compraConsumoUnidade.length ? (() => {
              const maxCC = Math.max(...compraConsumoUnidade.map((d) => Math.max(d.compras, d.consumo)), 1)
              return (
                <Plot
                  data={[
                    {
                      type: 'bar', orientation: 'h', name: 'Hitbox',
                      y: compraConsumoUnidade.map((d) => d.unidade),
                      x: compraConsumoUnidade.map(() => maxCC * 1.25),
                      marker: { color: 'rgba(255, 255, 255, 0.01)' },
                      hoverinfo: 'none',
                      showlegend: false,
                      xaxis: 'x2'
                    },
                    {
                      type: 'bar', orientation: 'h', name: 'Consumo',
                      y: compraConsumoUnidade.map((d) => d.unidade),
                      x: compraConsumoUnidade.map((d) => d.consumo),
                      cliponaxis: false,
                      textposition: 'outside',
                      text: compraConsumoUnidade.map((d) => {
                        const isSelected = !selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo
                        const rawText = fmtValorCurto(d.consumo)
                        const textColor = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'
                        return `<span style="color: ${textColor}; margin-left: 4px;">${rawText}</span>`
                      }),
                      textfont: { size: 10, family: 'Inter' },
                      marker: { color: compraConsumoUnidade.map((d) => (!selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo) ? '#2ecc71' : 'rgba(46,204,113,0.25)'), opacity: compraConsumoUnidade.map((d) => (!selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo) ? 1 : 0.3), line: { color: '#080808', width: 1 } },
                      hoverinfo: 'none'
                    },
                    {
                      type: 'bar', orientation: 'h', name: 'Compras',
                      y: compraConsumoUnidade.map((d) => d.unidade),
                      x: compraConsumoUnidade.map((d) => d.compras),
                      cliponaxis: false,
                      textposition: 'outside',
                      text: compraConsumoUnidade.map((d) => {
                        const isSelected = !selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo
                        const rawText = fmtValorCurto(d.compras)
                        const textColor = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'
                        return `<span style="color: ${textColor}; margin-left: 4px;">${rawText}</span>`
                      }),
                      textfont: { size: 10, family: 'Inter' },
                      marker: { color: compraConsumoUnidade.map((d) => (!selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo) ? '#e74c3c' : 'rgba(231,76,60,0.25)'), opacity: compraConsumoUnidade.map((d) => (!selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo) ? 1 : 0.3), line: { color: '#080808', width: 1 } },
                      hoverinfo: 'none'
                    }
                  ]}
                  layout={{
                    ...PLOT_LAYOUT,
                    barmode: 'group',
                    bargap: 0.35,
                    height: Math.max(280, compraConsumoUnidade.length * 45),
                    margin: { l: 115, r: 90, t: 10, b: 10 },
                    showlegend: false,
                    xaxis: { showgrid: false, showticklabels: false, zeroline: false, range: [0, maxCC * 1.25] },
                    xaxis2: { overlaying: 'x', showgrid: false, zeroline: false, showticklabels: false, range: [0, maxCC * 1.25] },
                    yaxis: {
                      showgrid: true,
                      gridcolor: '#4A4A4A',
                      tickson: 'boundaries',
                      tickmode: 'array',
                      tickvals: compraConsumoUnidade.map((d) => d.unidade),
                      ticktext: compraConsumoUnidade.map((d) => {
                        const isSelected = !selectedBarraCompraConsumo || d.unidade === selectedBarraCompraConsumo
                        const textColor = isSelected ? '#c5d0db' : 'rgba(140, 155, 165, 0.3)'
                        return `<span style="color: ${textColor};">${d.unidade}&nbsp;&nbsp;</span>`
                      }),
                      ticklen: 0,
                      tickcolor: 'rgba(0,0,0,0)',
                      tickpad: 8,
                      automargin: true
                    }
                  }}
                  config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', minHeight: 280, cursor: 'pointer' }} useResizeHandler onClick={(e) => { e?.event?.stopPropagation?.(); e?.event?.preventDefault?.(); if (e?.points?.[0]?.y) dispatch({ type: 'TOGGLE_FIELD', field: 'selectedBarraCompraConsumo', payload: e.points[0].y.trim() }) }}
                />
              )
            })() : (<p className="text-muted text-center py-10">Sem dados</p>)}
          </div>
        </div>

        <div onClick={() => handleCardClick('variacao_estoque')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isVariacaoSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612] -translate-y-1.5 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]'}`}>
          {isVariacaoSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span></span></div>)}
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-[#f58220]/50 to-transparent pointer-events-none" />
          
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#262014] flex items-center justify-center text-[#f58220] shadow-inner shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">VARIAÇÃO DE ESTOQUE (R$)</span>
            </div>
            {selectedBarraVariacao && (<button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_FIELD', field: 'selectedBarraVariacao', payload: null }); }} className="flex items-center gap-1 text-[10px] bg-[#f58220]/20 text-[#f58220] border border-[#f58220]/40 px-2 py-0.5 rounded hover:bg-[#f58220]/30 transition-all font-mono">Limpar <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>)}
          </div>

          <div role="tablist" aria-label="Visualização de Variação" className="flex items-center gap-3 text-[10px] font-medium tracking-wider mb-2">
            <button role="tab" aria-selected={abaVariacao === 'aumento'} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_FIELD', field: 'abaVariacao', payload: 'aumento' }); }} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50 ${abaVariacao === 'aumento' ? 'bg-[#f58220]/15 border-[#f58220]/40 text-white shadow-[0_0_10px_rgba(245,130,32,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
              <span className="relative flex items-center justify-center w-3 h-[2px] bg-[#f58220]"><span className={`absolute w-1.5 h-1.5 rounded-full border border-[#161616] ${abaVariacao === 'aumento' ? 'bg-[#f58220]' : 'bg-[#555]'}`}></span></span>
              <span>Aumentos</span>
            </button>
            <button role="tab" aria-selected={abaVariacao === 'reducao'} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_FIELD', field: 'abaVariacao', payload: 'reducao' }); }} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50 ${abaVariacao === 'reducao' ? 'bg-[#2ecc71]/15 border-[#2ecc71]/40 text-white shadow-[0_0_10px_rgba(46,204,113,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
              <span className="relative flex items-center justify-center w-3 h-[2px] bg-[#2ecc71]"><span className={`absolute w-1.5 h-1.5 rounded-full border border-[#161616] ${abaVariacao === 'reducao' ? 'bg-[#2ecc71]' : 'bg-[#555]'}`}></span></span>
              <span>Reduções / Estável</span>
            </button>
          </div>

          <div className="max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain" onClick={(e) => e.stopPropagation()}>
            {variacaoFiltrada.length ? (() => {
              const maxVar = Math.max(...variacaoFiltrada.map((d) => Math.abs(d.diff)), 1)
              return (
                <Plot
                  data={[
                    {
                      type: 'bar', orientation: 'h',
                      y: variacaoFiltrada.map((d) => d.unidade),
                      x: variacaoFiltrada.map(() => maxVar * 1.35),
                      marker: { color: 'rgba(255, 255, 255, 0.01)' },
                      hoverinfo: 'none',
                      showlegend: false
                    },
                    {
                      type: 'bar', orientation: 'h',
                      y: variacaoFiltrada.map((d) => d.unidade),
                      x: variacaoFiltrada.map((d) => Math.abs(d.diff)),
                      cliponaxis: false,
                      textposition: 'outside',
                      text: variacaoFiltrada.map((d) => {
                         const isSelected = !selectedBarraVariacao || d.unidade === selectedBarraVariacao
                         const valFormatado = fmtValorCurto(Math.abs(d.diff));
                         const textoVal = d.diff > 0 ? `+${valFormatado}` : (d.diff < 0 ? `-${valFormatado}` : valFormatado);
                         const textoPct = d.diff > 0 ? `+${d.pct.toFixed(1).replace('.',',')}%` : `${d.pct.toFixed(1).replace('.',',')}%`;
                         const rawText = `${textoVal} (${textoPct})`;
                         const textColor = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'
                         return `<span style="color: ${textColor}; margin-left: 6px;">${rawText}</span>`
                      }),
                      textfont: { size: 10, family: 'Inter', weight: 600 },
                      marker: {
                        color: variacaoFiltrada.map((d) => (!selectedBarraVariacao || d.unidade === selectedBarraVariacao) ? (abaVariacao === 'aumento' ? '#f58220' : '#2ecc71') : 'rgba(255, 255, 255, 0.15)'),
                        opacity: variacaoFiltrada.map((d) => (!selectedBarraVariacao || d.unidade === selectedBarraVariacao) ? 1 : 0.3),
                        line: { color: '#080808', width: 1 }
                      },
                      hoverinfo: 'none'
                    }
                  ]}
                  layout={{
                    ...PLOT_LAYOUT,
                    barmode: 'overlay',
                    bargap: 0.4,
                    height: Math.max(280, variacaoFiltrada.length * 35),
                    margin: { l: 115, r: 90, t: 10, b: 10 },
                    showlegend: false,
                    xaxis: { showgrid: false, showticklabels: false, zeroline: false, range: [0, maxVar * 1.35] },
                    yaxis: {
                      showgrid: true,
                      gridcolor: '#4A4A4A',
                      tickson: 'boundaries',
                      tickmode: 'array',
                      tickvals: variacaoFiltrada.map((d) => d.unidade),
                      ticktext: variacaoFiltrada.map((d) => {
                        const isSelected = !selectedBarraVariacao || d.unidade === selectedBarraVariacao
                        const textColor = isSelected ? '#c5d0db' : 'rgba(140, 155, 165, 0.3)'
                        return `<span style="color: ${textColor};">${d.unidade}&nbsp;&nbsp;</span>`
                      }),
                      ticklen: 0,
                      tickcolor: 'rgba(0,0,0,0)',
                      tickpad: 8,
                      automargin: true
                    }
                  }}
                  config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', minHeight: 280, cursor: 'pointer' }} useResizeHandler
                  onClick={(e) => { e?.event?.stopPropagation?.(); e?.event?.preventDefault?.(); if (e?.points?.[0]?.y) dispatch({ type: 'TOGGLE_FIELD', field: 'selectedBarraVariacao', payload: e.points[0].y.trim() }) }}
                />
              )
            })() : (<p className="text-muted text-center py-10">Nenhum dado encontrado</p>)}
          </div>
        </div>

        <div onClick={() => handleCardClick('skus_unidade')} className={`bg-[#161616] border rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] transition-all duration-300 transform relative overflow-hidden flex flex-col justify-between group cursor-pointer ${isSkusUnidadeSelected ? 'border-accent shadow-[0_0_25px_rgba(245,130,32,0.35)] bg-[#1c1612] -translate-y-1.5 ring-1 ring-accent/50' : 'border-[#2A2A2A] hover:border-accent/60 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]'}`}>
          {isSkusUnidadeSelected && (<div className="absolute top-2.5 right-2.5 flex items-center justify-center" title="Foco Ativo"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent shadow-[0_0_10px_rgba(245,130,32,0.8)]"></span></span></div>)}
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-lg bg-[#161c24] flex items-center justify-center shadow-inner shrink-0 ${abaSkusUnidade === 'duplicados' ? 'text-[#f1c40f]' : 'text-[#3498db]'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              </div>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">SKUs POR UNIDADE (QTDE)</span>
            </div>
            {selectedBarraSkus && (<button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_FIELD', field: 'selectedBarraSkus', payload: null }); }} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-all font-mono ${abaSkusUnidade === 'duplicados' ? 'bg-[#f1c40f]/20 text-[#f1c40f] border border-[#f1c40f]/40 hover:bg-[#f1c40f]/30' : 'bg-[#3498db]/20 text-[#3498db] border border-[#3498db]/40 hover:bg-[#3498db]/30'}`}>Limpar <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>)}
          </div>

          <div role="tablist" aria-label="Visualização de SKUs Unidade" className="flex items-center gap-3 text-[10px] font-medium tracking-wider mb-2">
            <button role="tab" aria-selected={abaSkusUnidade === 'unicos'} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_FIELD', field: 'abaSkusUnidade', payload: 'unicos' }); }} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50 ${abaSkusUnidade === 'unicos' ? 'bg-[#3498db]/15 border-[#3498db]/40 text-white shadow-[0_0_10px_rgba(52,152,219,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
              <span className="relative flex items-center justify-center w-3 h-[2px] bg-[#3498db]"><span className={`absolute w-1.5 h-1.5 rounded-full border border-[#161616] ${abaSkusUnidade === 'unicos' ? 'bg-[#3498db]' : 'bg-[#555]'}`}></span></span>
              <span>Únicos</span>
            </button>
            <button role="tab" aria-selected={abaSkusUnidade === 'duplicados'} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_FIELD', field: 'abaSkusUnidade', payload: 'duplicados' }); }} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50 ${abaSkusUnidade === 'duplicados' ? 'bg-[#f1c40f]/15 border-[#f1c40f]/40 text-white shadow-[0_0_10px_rgba(241,196,15,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
              <span className="relative flex items-center justify-center w-3 h-[2px] bg-[#f1c40f]"><span className={`absolute w-1.5 h-1.5 rounded-full border border-[#161616] ${abaSkusUnidade === 'duplicados' ? 'bg-[#f1c40f]' : 'bg-[#555]'}`}></span></span>
              <span>Duplicados</span>
            </button>
          </div>

          <div className="max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain mt-2" onClick={(e) => e.stopPropagation()}>
            {makeInteractiveHBar(skusUnidadeFiltrado, abaSkusUnidade === 'duplicados' ? '#f1c40f' : '#3498db', selectedBarraSkus, 'selectedBarraSkus')}
          </div>
        </div>
      </div>

      {/* --- EVOLUÇÃO SKUs --- */}
      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 sm:p-6 shadow-xl mt-6 transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg bg-[#161c24] flex items-center justify-center shadow-inner shrink-0 ${abaSkus === 'duplicados' ? 'text-[#f1c40f]' : 'text-[#3498db]'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10L4 7v10l8 4" /></svg>
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">EVOLUÇÃO TEMPORAL DE SKUs (QTDE) [{granularidade.toUpperCase()}]</span>
          </div>
          
          <div role="tablist" aria-label="Visualização de SKUs" className="flex items-center gap-4 text-[11px] font-medium tracking-wider">
            <button role="tab" aria-selected={abaSkus === 'unicos'} onClick={() => dispatch({ type: 'SET_FIELD', field: 'abaSkus', payload: 'unicos' })} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50 ${abaSkus === 'unicos' ? 'bg-[#3498db]/15 border-[#3498db]/40 text-white shadow-[0_0_10px_rgba(52,152,219,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
              <span className="relative flex items-center justify-center w-4 h-[2px] bg-[#3498db]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${abaSkus === 'unicos' ? 'bg-[#3498db]' : 'bg-[#555]'}`}></span></span>
              <span>SKUs Únicos</span>
            </button>
            <button role="tab" aria-selected={abaSkus === 'duplicados'} onClick={() => dispatch({ type: 'SET_FIELD', field: 'abaSkus', payload: 'duplicados' })} className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50 ${abaSkus === 'duplicados' ? 'bg-[#f1c40f]/15 border-[#f1c40f]/40 text-white shadow-[0_0_10px_rgba(241,196,15,0.2)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#666666] opacity-60'}`}>
              <span className="relative flex items-center justify-center w-4 h-[2px] bg-[#f1c40f]"><span className={`absolute w-2 h-2 rounded-full border-2 border-[#161616] ${abaSkus === 'duplicados' ? 'bg-[#f1c40f]' : 'bg-[#555]'}`}></span></span>
              <span>SKUs Duplicados</span>
            </button>
          </div>
        </div>

        <Plot
          data={[
            {
              x: timeSeriesAgg.skus.map((d) => d.periodo),
              y: timeSeriesAgg.skus.map(() => (Math.max(...timeSeriesAgg.skus.map(s => abaSkus === 'duplicados' ? s.duplicados : s.total), 10) || 10) * 1.38),
              type: 'bar',
              name: 'clickArea',
              marker: { color: 'rgba(52, 152, 219, 0.02)' },
              hoverinfo: 'none',
              showlegend: false,
              cliponaxis: false
            },
            {
              x: timeSeriesAgg.skus.map((d) => d.periodo),
              y: timeSeriesAgg.skus.map((d) => abaSkus === 'duplicados' ? d.duplicados : d.total),
              type: 'scatter',
              mode: 'lines+markers+text',
              text: timeSeriesAgg.skus.map((d) => fmtInt(abaSkus === 'duplicados' ? d.duplicados : d.total)),
              textposition: 'top center',
              textfont: { color: 'white', size: 11, family: 'Inter' },
              line: { color: abaSkus === 'duplicados' ? '#f1c40f' : '#3498db', width: 2, shape: 'spline', smoothing: 1.3 },
              marker: { 
                size: timeSeriesAgg.skus.map(d => isPeriodSelected(d) ? 11 : 8), 
                color: timeSeriesAgg.skus.map(d => isPeriodSelected(d) ? (abaSkus === 'duplicados' ? '#f1c40f' : '#3498db') : '#080808'), 
                line: { color: abaSkus === 'duplicados' ? '#f1c40f' : '#3498db', width: 1.5 } 
              },
              fill: 'tozeroy',
              fillgradient: { type: 'vertical', colorscale: [['0', abaSkus === 'duplicados' ? 'rgba(241,196,15,0.35)' : 'rgba(52,152,219,0.35)'], ['1', abaSkus === 'duplicados' ? 'rgba(241,196,15,0.0)' : 'rgba(52,152,219,0.0)']] },
              fillcolor: abaSkus === 'duplicados' ? 'rgba(241,196,15,0.15)' : 'rgba(52,152,219,0.15)',
              hoverinfo: 'none',
              cliponaxis: false
            }
          ]}
          layout={{
            ...PLOT_LAYOUT,
            height: 330,
            bargap: 0,
            margin: { l: 30, r: 20, t: 55, b: 40 },
            shapes: chartShapesSkus,
            xaxis: {
              type: 'category', 
              showgrid: false, 
              zeroline: false, 
              tickmode: 'array', 
              tickvals: timeSeriesAgg.skus.map(d => d.periodo), 
              ticktext: timeSeriesAgg.skus.map(d => {
                const isSelected = isPeriodSelected(d)
                const label = d.periodo
                return isSelected ? `<span style="color: #f58220; font-weight: 900;">• ${label} •</span>` : label
              }), 
              tickpad: 4, 
              automargin: true, 
              range: [-0.6, Math.max(timeSeriesAgg.skus.length - 0.4, 1)] 
            },
            yaxis: { 
              showgrid: true, 
              gridcolor: '#222222', 
              zeroline: true, 
              zerolinecolor: '#777777', 
              showticklabels: false, 
              range: [
                -((Math.max(...timeSeriesAgg.skus.map((d) => abaSkus === 'duplicados' ? d.duplicados : d.total), 10) || 10) * 0.15), 
                (Math.max(...timeSeriesAgg.skus.map((d) => abaSkus === 'duplicados' ? d.duplicados : d.total), 10) || 10) * 1.38
              ] 
            }
          }}
          config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', minHeight: 300, cursor: 'pointer' }} useResizeHandler onClick={handleChartClick}
        />
        {/* TABELA GAVETA 3: CADASTROS DUPLICADOS */}
        <div className="mt-5 border border-[#f1c40f]/30 rounded-xl bg-[#0c0c0c] overflow-hidden shadow-inner">
          <div 
            role="button" 
            tabIndex={0}
            aria-expanded={listaDuplicadosAberta}
            onClick={() => dispatch({ type: 'TOGGLE_BOOLEAN', field: 'listaDuplicadosAberta' })} 
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch({ type: 'TOGGLE_BOOLEAN', field: 'listaDuplicadosAberta' }) } }}
            className="flex items-center justify-between p-3 sm:p-4 bg-[#1a180f] hover:bg-[#201e12] cursor-pointer transition-colors border-b border-[#f1c40f]/20 focus:outline-none focus:bg-[#201e12]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#262410] flex items-center justify-center text-[#f1c40f] shadow-inner shrink-0 border border-[#f1c40f]/30">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <span className="text-xs font-bold text-[#f1c40f] uppercase tracking-wider block">{listaDuplicadosAberta ? 'Fechar Lista de Duplicados' : 'Alerta: Cadastros Duplicados (Mesmo Nome, SKUs Diferentes)'}</span>
                <span className="text-[10px] text-muted font-medium mt-0.5 block">Identifica produtos com o mesmo padrão descritivo (ignora pontuação) sob múltiplos códigos (Snapshot: {periodoDisplay})</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-[10px] bg-[#f1c40f]/15 text-[#f1c40f] px-2 py-0.5 rounded font-mono border border-[#f1c40f]/30 font-bold">Total: {Number(duplicadosDataCompleta.length).toLocaleString('pt-BR')}</span>
              <span className="text-[#f1c40f]">
                {listaDuplicadosAberta ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>}
              </span>
            </div>
          </div>
          {listaDuplicadosAberta && (
            <div className="p-4 space-y-4 animate-fade-in bg-[#12110a]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-[#f1c40f]/80">Listando materiais com padrão descritivo equivalente, mas SKUs diferentes.</span>
                <div className="flex items-center gap-2">
                  <button onClick={exportarExcelDuplicados} disabled={exportando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a2616] hover:bg-[#3a341c] text-[#f1c40f] border border-[#f1c40f]/40 text-xs font-bold transition-all shadow-sm disabled:opacity-50">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    <span>{exportando ? 'Exportando...' : 'Exportar Excel'}</span>
                  </button>
                  <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'tabelaDuplicadosExpandida', payload: true })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1a1a] hover:bg-[#3a2020] text-[#f58220] border border-[#f58220]/40 text-xs font-bold transition-all shadow-sm group">
                    <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    <span>Expandir Tabela</span>
                  </button>
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar overscroll-contain border border-[#2A2A2A] rounded-xl bg-[#0c0c0c] scroll-pt-14">
                <TabelaGenerica dados={duplicadosGaveta} columns={colsDuplicados} highlightColor="#f1c40f" emptyMessage="Base limpa. Nenhum cadastro duplicado encontrado no período." />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- GIRO x COBERTURA --- */}
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
              visGiroCobertura.giro && { 
                x: giroCoberturaTempo.map((d) => d.periodo), 
                y: giroCoberturaTempo.map((d) => d.giro), 
                name: 'Giro Mensal', 
                type: 'scatter', 
                mode: 'lines+markers', 
                line: { color: '#3498db', width: 2.5, shape: 'spline', smoothing: 1.3 }, 
                marker: { 
                  size: giroCoberturaTempo.map(d => isPeriodSelected(d) ? 11 : 8), 
                  color: giroCoberturaTempo.map(d => isPeriodSelected(d) ? '#3498db' : '#080808'), 
                  line: { color: '#3498db', width: 1.5 } 
                }, 
                customdata: giroCoberturaTempo.map((d) => fmtDec(d.giro)), 
                hovertemplate: '<b>%{x}</b><br>Giro Mensal: <span style="color:#3498db; font-weight:bold;">%{customdata}</span><extra></extra>' 
              },
              visGiroCobertura.cobertura && { 
                x: giroCoberturaTempo.map((d) => d.periodo), 
                y: giroCoberturaTempo.map((d) => d.cobertura), 
                name: 'Cobertura', 
                type: 'scatter', 
                mode: 'lines+markers', 
                yaxis: 'y2', 
                line: { color: '#f58220', width: 2.5, shape: 'spline', smoothing: 1.3 }, 
                marker: { 
                  size: giroCoberturaTempo.map(d => isPeriodSelected(d) ? 11 : 8), 
                  color: giroCoberturaTempo.map(d => isPeriodSelected(d) ? '#f58220' : '#080808'), 
                  line: { color: '#f58220', width: 1.5 } 
                }, 
                customdata: giroCoberturaTempo.map((d) => fmtMes(d.cobertura)), 
                hovertemplate: '<b>%{x}</b><br>Cobertura: <span style="color:#f58220; font-weight:bold;">%{customdata}</span><extra></extra>' 
              },
            ].filter(Boolean)}
            layout={{ 
              ...PLOT_LAYOUT, 
              height: 380, 
              showlegend: false, 
              hovermode: 'x unified', 
              hoverlabel: { bgcolor: '#0c0c0c', bordercolor: '#333333', font: { color: '#ffffff', family: 'Inter', size: 12 } }, 
              shapes: chartShapesGiro, 
              xaxis: {
              type: 'category', 
                showgrid: false, 
                zeroline: false, 
                tickmode: 'array', 
                tickvals: giroCoberturaTempo.map(d => d.periodo), 
                ticktext: giroCoberturaTempo.map(d => {
                  const isSelected = isPeriodSelected(d)
                  const label = d.periodo
                  return isSelected ? `<span style="color: #f58220; font-weight: 900;">• ${label} •</span>` : label
                }), 
                tickpad: 12, 
                automargin: true 
              }, 
              yaxis: { showgrid: true, gridcolor: '#2A2A2A', zeroline: false, showticklabels: false }, 
              yaxis2: { overlaying: 'y', side: 'right', showgrid: false, showticklabels: false } 
            }}
            config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', minHeight: 300, cursor: 'pointer' }} useResizeHandler onClick={handleChartClick}
          />
        ) : (<p className="text-muted text-center py-10">Sem dados suficientes para calcular Giro x Cobertura.</p>)}
      </div>

      {/* --- MATERIAIS PARADOS --- */}
      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 sm:p-6 shadow-xl mt-6 transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase mb-1 flex items-center gap-2"><svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>MATERIAIS PARADOS HÁ MAIS DE 3 MESES (SEM MOVIMENTAÇÃO)</div>
            <p className="text-muted text-xs tracking-wide">Exclui itens marcados com a flag Crítico ou Obsoleto. Contabiliza o ciclo de inatividade considerando também o mês de origem (Efeito Coorte).</p>
          </div>
          {filtroMesParado && (<button onClick={() => dispatch({ type: 'SET_FIELD', field: 'filtroMesParado', payload: null })} className="text-[10px] bg-accent/20 text-accent border border-accent/40 px-3 py-1.5 rounded-lg hover:bg-accent/30 transition-all font-mono font-bold flex items-center gap-1.5 self-start sm:self-auto"><span>Filtrando: {filtroMesParado} Meses</span><span>Limpar <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></span></button>)}
        </div>

        {paradosChart.length > 0 ? (
          <>
            <div className="mb-6 bg-[#101010] p-4 rounded-xl border border-[#222222]">
              <Plot
                data={[{ 
                  type: 'scatter', 
                  mode: 'lines+markers+text', 
                  name: 'Valor Parado (R$)', 
                  x: paradosChart.map((d) => d.label), 
                  y: paradosChart.map((d) => d.valor), 
                  text: paradosChart.map((d) => fmtValorCurto(d.valor)), 
                  textposition: 'top center', 
                  textfont: { color: 'white', size: 11, family: 'Inter', weight: 600 }, 
                  line: { color: '#f58220', width: 3, shape: 'spline', smoothing: 1.3 }, 
                  marker: { 
                    size: paradosChart.map(d => d.meses === filtroMesParado ? 12 : 10), 
                    color: paradosChart.map(d => d.meses === filtroMesParado ? '#f58220' : '#080808'), 
                    line: { color: '#f58220', width: 2 } 
                  }, 
                  fill: 'tozeroy', 
                  fillgradient: { type: 'vertical', colorscale: [['0', 'rgba(245,130,32,0.35)'], ['1', 'rgba(245,130,32,0.0)']] }, 
                  fillcolor: 'rgba(245,130,32,0.15)', 
                  customdata: paradosChart.map((d) => `<span style="color:#2ecc71; font-weight:bold;">${fmtBRL(d.valor)}</span><br>Qtd SKUs: <span style="color:#3498db; font-weight:bold;">${Number(d.skus).toLocaleString('pt-BR')} SKUs</span>`), 
                  hovertemplate: '<b>%{x}</b><br>Valor: %{customdata}<extra></extra>', 
                  cliponaxis: false 
                }]}
                layout={{ 
                  ...PLOT_LAYOUT, 
                  height: 320, 
                  margin: { l: 50, r: 50, t: 65, b: 40 }, 
                  showlegend: false, 
                  hoverlabel: { bgcolor: '#161616', bordercolor: '#2A2A2A', font: { color: '#ffffff', family: 'Inter', size: 12 } }, 
                  xaxis: { 
                    showgrid: false, 
                    tickfont: { color: '#94a3b8', family: 'Inter' }, 
                    ticktext: paradosChart.map(d => {
                      const isSelected = d.meses === filtroMesParado
                      return isSelected ? `<span style="color: #f58220; font-weight: 900;">• ${d.label} •</span>` : d.label
                    }),
                    tickpad: 12, 
                    automargin: true, 
                    range: [-0.8, paradosChart.length] 
                  }, 
                  yaxis: { showgrid: true, gridcolor: '#2A2A2A', showticklabels: false, range: [-(Math.max(...paradosChart.map(d => d.valor), 10) * 0.15), (Math.max(...paradosChart.map(d => d.valor), 10) * 1.45)] } 
                }}
                config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', minHeight: 280, cursor: 'pointer' }} useResizeHandler
                onClick={(e) => { if (e?.points?.[0]?.x) { const num = parseInt(e.points[0].x.replace(/\D/g, '')); dispatch({ type: 'TOGGLE_FIELD', field: 'filtroMesParado', payload: num }) } }}
              />
            </div>
            
            <div className="mt-4 border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden">
              <div 
                role="button"
                tabIndex={0}
                onClick={() => dispatch({ type: 'TOGGLE_BOOLEAN', field: 'listaAberta' })}
                className="flex items-center justify-between p-4 bg-[#181818] hover:bg-[#202020] cursor-pointer transition-colors border-b border-[#2A2A2A]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-accent">
                    <svg className="w-5 h-5 drop-shadow-[0_0_8px_rgba(245,130,32,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {listaAberta ? 'Fechar Lista Completa de Itens Parados' : 'Abrir Lista Completa de Itens Parados'}
                  </span>
                  <span className="ml-2 text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded font-mono border border-accent/30">
                    Total: {Number(itensParadosParaExportar.length).toLocaleString('pt-BR')} registros
                  </span>
                </div>
                <span className="text-accent">
                  {listaAberta ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>}
                </span>
              </div>

              {listaAberta && (
                <div className="p-4 space-y-4 bg-[#121212] animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted">
                      Exibindo os itens mais relevantes ordenados por valor financeiro (Visualização Limpa sem filtros de busca/unidade prévios).
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={exportarExcelParados} disabled={exportando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-sm disabled:opacity-50">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span>{exportando ? 'Exportando...' : 'Exportar Excel'}</span>
                      </button>
                      <button 
                        onClick={() => dispatch({ type: 'SET_FIELD', field: 'tabelaExpandida', payload: true })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1a1a] hover:bg-[#3a2020] text-[#f58220] border border-[#f58220]/40 text-xs font-bold transition-all shadow-sm group"
                      >
                        <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        <span>Expandir Tabela</span>
                      </button>              
                    </div>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto custom-scrollbar border border-[#2A2A2A] rounded-xl bg-[#121212]">
                    <TabelaGenerica dados={itensParadosGaveta} columns={colsParados} highlightColor="#f58220" emptyMessage="Nenhum item encontrado." />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (<p className="text-muted text-center py-8 tracking-wide">Nenhum material operacional parado há mais de 3 meses para o período selecionado.</p>)}
      </div>

      {/* ====================================================================================== */}
      {/* =============================== MODAIS FULLSCREEN ==================================== */}
      {/* ====================================================================================== */}

      {tabelaExpandida && (
        <FullScreenPortal onClose={() => fecharModalFS('tabelaExpandida')}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col backdrop-blur-sm animate-fade-in">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shrink-0 shadow-xl">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-accent drop-shadow-[0_0_10px_rgba(245,130,32,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                <h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa de Itens Parados (Tela Cheia)</h2>
                <span className="ml-3 text-xs bg-accent/15 text-accent px-2.5 py-1 rounded-md font-mono border border-accent/30 font-bold shadow-inner">
                  Exibindo até 1.000 registros | Total Filtrado: {Number(itensParadosFSTotal).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex gap-3 items-center">
                <button onClick={exportarExcelParados} disabled={exportando} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5 disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span>Baixar Base Excel</span>
                </button>
                <button onClick={() => fecharModalFS('tabelaExpandida')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Fechar Janela</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 px-6 py-3 bg-[#161616] border-b border-[#2A2A2A] shrink-0">
              <div className="w-full sm:w-64">
                <CyberMultiSelect options={unidadesFSParados} selected={filtroUnidadeFS} onChange={onChangeUnidadeFS} placeholder="Unidades" />
              </div>
              <div className="w-full sm:w-56">
                <CyberMultiSelect options={mesesParadosOpcoes} selected={filtroMesParadoFS} onChange={(val) => setFiltroMesParadoFS(val)} placeholder="Meses Parado" />
              </div>
              <div className="flex-1 relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Buscar produto por nome ou código..." value={filtroTextoFS} onChange={onChangeTextoFS} className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-accent text-xs transition-colors" />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#080808] relative">
              <div className="border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden shadow-2xl h-full flex flex-col">
                <div className="overflow-y-auto custom-scrollbar flex-grow scroll-pt-14">
                  <TabelaGenerica key={`parados-${filtroUnidadeFSKey}-${filtroMesParadoFS.join()}-${filtroTextoFS}`} dados={itensParadosFS} columns={colsParados} highlightColor="#f58220" />
                </div>
              </div>
            </div>
          </div>
        </FullScreenPortal>
      )}

      {tabelaMaioresValoresExpandida && (
        <FullScreenPortal onClose={() => fecharModalFS('tabelaMaioresValoresExpandida')}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shadow-xl shrink-0">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-[#3498db] drop-shadow-[0_0_10px_rgba(52,152,219,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                <h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa: Maiores Valores de Estoque (Tela Cheia)</h2>
                <span className="ml-3 text-xs bg-[#3498db]/15 text-[#3498db] px-2.5 py-1 rounded-md font-mono border border-[#3498db]/30 font-bold shadow-inner">
                  Exibindo até 1.000 registros | Total Filtrado: {Number(maioresValoresFSTotal).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex gap-3 items-center">
                <button onClick={exportarExcelMaioresValores} disabled={exportando} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5 disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span>Baixar Base Excel</span>
                </button>
                <button onClick={() => fecharModalFS('tabelaMaioresValoresExpandida')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Fechar Janela</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 px-6 py-3 bg-[#161616] border-b border-[#2A2A2A] shrink-0">
              <div className="w-full sm:w-80">
                <CyberMultiSelect options={unidadesFSMaioresValores} selected={filtroUnidadeFS} onChange={onChangeUnidadeFS} placeholder="Filtrar por Unidades" />
              </div>
              <div className="flex-1 relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Buscar produto por nome ou código..." value={filtroTextoFS} onChange={onChangeTextoFS} className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#3498db] text-xs transition-colors" />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#080808] relative">
              <div className="border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden shadow-2xl h-full flex flex-col">
                <div className="overflow-y-auto custom-scrollbar flex-grow scroll-pt-14">
                  <TabelaGenerica key={`maiores-${filtroUnidadeFSKey}-${filtroTextoFS}`} dados={maioresValoresFS} columns={colsMaioresValores} highlightColor="#3498db" />
                </div>
              </div>
            </div>
          </div>
        </FullScreenPortal>
      )}

      {tabelaComprasSemConsumoExpandida && (
        <FullScreenPortal onClose={() => fecharModalFS('tabelaComprasSemConsumoExpandida')}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shadow-xl shrink-0">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-[#e74c3c] drop-shadow-[0_0_10px_rgba(231,76,60,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa: Compras com Consumo Zero (Tela Cheia)</h2>
                <span className="ml-3 text-xs bg-[#e74c3c]/15 text-[#e74c3c] px-2.5 py-1 rounded-md font-mono border border-[#e74c3c]/30 font-bold shadow-inner">
                  Exibindo até 1.000 registros | Total Filtrado: {Number(comprasSemConsumoFSTotal).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex gap-3 items-center">
                <button onClick={exportarExcelComprasSemConsumo} disabled={exportando} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5 disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span>Baixar Base Excel</span>
                </button>
                <button onClick={() => fecharModalFS('tabelaComprasSemConsumoExpandida')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Fechar Janela</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 px-6 py-3 bg-[#161616] border-b border-[#2A2A2A] shrink-0">
              <div className="w-full sm:w-80">
                <CyberMultiSelect options={unidadesFSComprasSemConsumo} selected={filtroUnidadeFS} onChange={onChangeUnidadeFS} placeholder="Filtrar por Unidades" />
              </div>
              <div className="flex-1 relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Buscar produto por nome ou código..." value={filtroTextoFS} onChange={onChangeTextoFS} className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#e74c3c] text-xs transition-colors" />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#080808] relative">
              <div className="border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden shadow-2xl h-full flex flex-col">
                <div className="overflow-y-auto custom-scrollbar flex-grow scroll-pt-14">
                  <TabelaGenerica key={`compras-${filtroUnidadeFSKey}-${filtroTextoFS}`} dados={comprasSemConsumoFS} columns={colsComprasSemConsumo} highlightColor="#e74c3c" />
                </div>
              </div>
            </div>
          </div>
        </FullScreenPortal>
      )}

      {tabelaDuplicadosExpandida && (
        <FullScreenPortal onClose={() => fecharModalFS('tabelaDuplicadosExpandida')}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shadow-xl shrink-0">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-[#f1c40f] drop-shadow-[0_0_10px_rgba(241,196,15,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa: Cadastros Duplicados (Tela Cheia)</h2>
                <span className="ml-3 text-xs bg-[#f1c40f]/15 text-[#f1c40f] px-2.5 py-1 rounded-md font-mono border border-[#f1c40f]/30 font-bold shadow-inner">
                  Exibindo até 1.000 registros | Total Filtrado: {Number(duplicadosFSTotal).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex gap-3 items-center">
                <button onClick={exportarExcelDuplicados} disabled={exportando} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5 disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span>Baixar Base Excel</span>
                </button>
                <button onClick={() => fecharModalFS('tabelaDuplicadosExpandida')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Fechar Janela</span>
                </button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 px-6 py-3 bg-[#161616] border-b border-[#2A2A2A] shrink-0">
              <div className="w-full sm:w-80">
                <CyberMultiSelect options={unidadesFSDuplicados} selected={filtroUnidadeFS} onChange={onChangeUnidadeFS} placeholder="Filtrar por Unidades" />
              </div>
              <div className="flex-1 relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Buscar produto por nome ou código..." value={filtroTextoFS} onChange={onChangeTextoFS} className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#f1c40f] text-xs transition-colors" />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#080808] relative">
              <div className="border border-[#2A2A2A] rounded-xl bg-[#121212] overflow-hidden shadow-2xl h-full flex flex-col">
                <div className="overflow-y-auto custom-scrollbar flex-grow scroll-pt-14">
                  <TabelaGenerica key={`duplicados-${filtroUnidadeFSKey}-${filtroTextoFS}`} dados={duplicadosFS} columns={colsDuplicados} highlightColor="#f1c40f" />
                </div>
              </div> 
            </div>
          </div>
        </FullScreenPortal>
      )}

    </div>
  )
}
