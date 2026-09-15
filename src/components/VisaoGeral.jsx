import React, { useMemo, useState, useCallback, useEffect } from 'react'
import Plot from 'react-plotly.js'
import pptxgen from 'pptxgenjs'
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

// COMPONENTES FILHOS E HOOK EXTERNO
import { useInventoryState } from './useInventoryState'
import { FullScreenPortal } from './FullScreenPortal.jsx'
import { CyberMultiSelect } from './CyberMultiSelect.jsx'
import { ExecutiveCard } from './ExecutiveCard.jsx'
import { TabelaGenerica } from './TabelaGenerica.jsx'

// --- CONSTANTES DE FORMATAÇÃO E REGRAS ---
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

const MAPA_ABR_MESES = {
  '01': 'JAN', '1': 'JAN', '02': 'FEV', '2': 'FEV', '03': 'MAR', '3': 'MAR',
  '04': 'ABR', '4': 'ABR', '05': 'MAI', '5': 'MAI', '06': 'JUN', '6': 'JUN',
  '07': 'JUL', '7': 'JUL', '08': 'AGO', '8': 'AGO', '09': 'SET', '9': 'SET',
  '10': 'OUT', '11': 'NOV', '12': 'DEZ'
}

const CODIGOS_INSUMO = ['34854', '34769', '31774', '31776']

function formatarPeriodoTexto(periodoStr) {
  if (!periodoStr) return ''
  const p = parsePeriodo(periodoStr)
  if (!p) return periodoStr
  const nomeMes = MAPA_ABR_MESES[String(p.mes).padStart(2, '0')] || p.mes
  return `${nomeMes}/${String(p.ano).slice(-2)}`
}

function parseNumber(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  let s = String(val).trim().replace(/R\$\s?/gi, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function gerarChaveDuplicidade(nome) {
  if (!nome) return '';
  const clean = String(nome).toUpperCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ') 
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .sort() 
    .join(' ');
  return clean || String(nome).trim().toUpperCase();
}

function aplicarLentesIndependentes(r) {
  const nomeLocal = String(r.nome_local_estoque || '').toUpperCase()
  const unidadeAlmox = String(r.unidade_almoxarifado || '').toUpperCase()
  const isWartsila = nomeLocal.includes('WARTSILA') || unidadeAlmox.includes('WARTSILA')
  const s = String(r.codigo_local_estoque ?? '').trim()
  const codigoLocal = s.replace(/^0+/, '') || s

  const _isObsoleto = isObsoleto(r.nome_local_estoque) || isWartsila
  const _isObra = isObra(r.nome_local_estoque)
  const _isCritico = isCritico(r.item_critico)
  const _isInsumo = CODIGOS_INSUMO.includes(codigoLocal)
  const _isOperacional = !_isObsoleto && !_isObra && !_isCritico && !_isInsumo

  return { ...r, _isObsoleto, _isObra, _isCritico, _isInsumo, _isOperacional }
}

function normUnidade(v) {
  if (v == null) return ''
  return String(v).normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase()
}

function normalizeSelectedUnidades(raw) {
  if (raw == null || raw === '') return []
  const arr = Array.isArray(raw) ? raw : [raw]
  const out = []
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (item == null || item === '') continue
    if (typeof item === 'string' || typeof item === 'number') {
      const n = normUnidade(item)
      if (n) out.push(n)
    } else if (typeof item === 'object') {
      const n = normUnidade(item.value ?? item.label ?? item.id ?? item.nome ?? '')
      if (n) out.push(n)
    }
  }
  return out
}

function filtrarListaFS(lista, { texto, unidades, camposTexto = ['nome', 'codigo'], maxItems = 1000, matchUnidade }) {
  if (!lista || lista.length === 0) {
    return { dados: [], total: 0, unidadesOpcoes: [] }
  }

  const txt = texto ? String(texto).toLowerCase().trim() : ''
  const unidadesNorm = normalizeSelectedUnidades(unidades)
  const temUnidade = unidadesNorm.length > 0
  const setUnidades = temUnidade ? new Set(unidadesNorm) : null

  const matchUnid = matchUnidade || ((item, setU) => setU.has(normUnidade(item.unidade)))

  let filtrada = lista
  if (txt || temUnidade) {
    filtrada = []
    for (let i = 0; i < lista.length; i++) {
      const item = lista[i]
      if (temUnidade && !matchUnid(item, setUnidades)) continue
      if (txt) {
        let hit = false
        for (let c = 0; c < camposTexto.length; c++) {
          const v = item[camposTexto[c]]
          if (v != null && String(v).toLowerCase().includes(txt)) { hit = true; break }
        }
        if (!hit) continue
      }
      filtrada.push(item)
    }
  }

  const setOpts = new Set()
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i]
    if (txt) {
      let hit = false
      for (let c = 0; c < camposTexto.length; c++) {
        const v = item[camposTexto[c]]
        if (v != null && String(v).toLowerCase().includes(txt)) { hit = true; break }
      }
      if (!hit) continue
    }
    if (item.unidade) {
      const n = normUnidade(item.unidade)
      if (n) setOpts.add(n)
    } else if (item.unidades_lista) {
      String(item.unidades_lista).split(',').forEach((u) => {
        const n = normUnidade(u)
        if (n) setOpts.add(n)
      })
    }
  }
  const labelByNorm = new Map()
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i]
    if (item.unidade) {
      const n = normUnidade(item.unidade)
      if (n && setOpts.has(n) && !labelByNorm.has(n)) labelByNorm.set(n, String(item.unidade).trim())
    } else if (item.unidades_lista) {
      String(item.unidades_lista).split(',').forEach((u) => {
        const n = normUnidade(u)
        if (n && setOpts.has(n) && !labelByNorm.has(n)) labelByNorm.set(n, u.trim())
      })
    }
  }
  const unidadesOpcoes = [...setOpts].sort().map((n) => labelByNorm.get(n) || n)

  return {
    dados: filtrada.length > maxItems ? filtrada.slice(0, maxItems) : filtrada,
    total: filtrada.length,
    unidadesOpcoes
  }
}

// --- COMPONENTE PRINCIPAL ---
export default function VisaoGeral({ data }) {
  const { state, dispatch } = useInventoryState()
  const [initialLoad, setInitialLoad] = useState(true)

  const {
    escoposSel, unidadesSel, anosSel, tiposEstoqueSel,
    periodoAtivo, activeCard, selectedBarraRanking,
    selectedBarraExposicao, selectedBarraCritico,
    selectedBarraObsoleto, selectedBarraObra,
    selectedBarraCompraConsumo, selectedBarraVariacao,
    selectedBarraSkus, abaVariacao, abaSkus, abaSkusUnidade, filtroMesParado,
    listaAberta, tabelaExpandida,
    listaMaioresValoresAberta, tabelaMaioresValoresExpandida,
    listaComprasSemConsumoAberta, tabelaComprasSemConsumoExpandida,
    listaDuplicadosAberta, tabelaDuplicadosExpandida
  } = state

  const abaCompraConsumo = state.abaCompraConsumo || 'comparativo'
  const [abaRankingUnidade, setAbaRankingUnidade] = useState('total')

  const [vis, setVis] = useState({ total: true, operacional: false, critico: false, obsoleto: false, obra: false, insumo: false })
  const [visComprasConsumo, setVisComprasConsumo] = useState({ compras: true, consumo: true })
  const [visGiroCobertura, setVisGiroCobertura] = useState({ giro: true, cobertura: true })
  const [exportando, setExportando] = useState(false)

  // ESTADOS PARA OS FILTROS DE TELA CHEIA (FULLSCREEN)
  const [filtroTextoFS, setFiltroTextoFS] = useState('')
  const [filtroUnidadeFS, setFiltroUnidadeFS] = useState([])
  const [filtroMesParadoFS, setFiltroMesParadoFS] = useState([])

  const onChangeUnidadeFS = useCallback((val) => {
    setFiltroUnidadeFS(normalizeSelectedUnidades(val))
  }, [])

  const onChangeTextoFS = useCallback((e) => {
    setFiltroTextoFS(e.target.value)
  }, [])

  const handleCardClick = useCallback((key) => dispatch({ type: 'TOGGLE_ACTIVE_CARD', payload: key }), [dispatch])

  const fecharModalFS = useCallback((field) => {
    dispatch({ type: 'SET_FIELD', field, payload: false })
    setFiltroTextoFS('')
    setFiltroUnidadeFS([])
    setFiltroMesParadoFS([])
  }, [dispatch])

  // --- Controle Global da tecla ESC (Modais FullScreen + Gavetas Normais) ---
  useEffect(() => {
    const algumModalAberto =
      tabelaExpandida ||
      tabelaMaioresValoresExpandida ||
      tabelaComprasSemConsumoExpandida ||
      tabelaDuplicadosExpandida

    const algumaGavetaAberta =
      listaAberta ||
      listaMaioresValoresAberta ||
      listaComprasSemConsumoAberta ||
      listaDuplicadosAberta

    if (!algumModalAberto && !algumaGavetaAberta) return

    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return

      // 1ª camada: Painel do CyberMultiSelect aberto → ignora para o select tratar
      if (document.querySelector('[data-cyber-open="true"]')) {
        return
      }

      // 2ª camada: Foco em input de texto → apenas faz blur
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        e.preventDefault()
        e.stopPropagation()
        active.blur()
        return
      }

      // 3ª camada: Fecha modais de tela cheia se houver algum aberto
      if (algumModalAberto) {
        e.preventDefault()
        e.stopPropagation()
        if (tabelaExpandida) fecharModalFS('tabelaExpandida')
        else if (tabelaMaioresValoresExpandida) fecharModalFS('tabelaMaioresValoresExpandida')
        else if (tabelaComprasSemConsumoExpandida) fecharModalFS('tabelaComprasSemConsumoExpandida')
        else if (tabelaDuplicadosExpandida) fecharModalFS('tabelaDuplicadosExpandida')
        return
      }

      // 4ª camada: Fecha as gavetas normais da dashboard se houver alguma aberta
      if (algumaGavetaAberta) {
        e.preventDefault()
        e.stopPropagation()
        if (listaAberta) dispatch({ type: 'SET_FIELD', field: 'listaAberta', payload: false })
        if (listaMaioresValoresAberta) dispatch({ type: 'SET_FIELD', field: 'listaMaioresValoresAberta', payload: false })
        if (listaComprasSemConsumoAberta) dispatch({ type: 'SET_FIELD', field: 'listaComprasSemConsumoAberta', payload: false })
        if (listaDuplicadosAberta) dispatch({ type: 'SET_FIELD', field: 'listaDuplicadosAberta', payload: false })
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [
    tabelaExpandida,
    tabelaMaioresValoresExpandida,
    tabelaComprasSemConsumoExpandida,
    tabelaDuplicadosExpandida,
    listaAberta,
    listaMaioresValoresAberta,
    listaComprasSemConsumoAberta,
    listaDuplicadosAberta,
    fecharModalFS,
    dispatch,
  ])

  const dadosSanitizados = useMemo(() => {
    if (!data || !Array.isArray(data)) return []
    return data.map(r => {
      let unidadeLimpa = r.unidade_almoxarifado
      if (unidadeLimpa) {
        unidadeLimpa = String(unidadeLimpa).normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase()
      }
      return aplicarLentesIndependentes({ ...r, unidade_almoxarifado: unidadeLimpa })
    })
  }, [data])

  const { unidadesOpcoes, unidadesAtivas, unidadesGerenciais, anoOpcoes } = useMemo(() => {
    if (!dadosSanitizados || dadosSanitizados.length === 0) return { unidadesOpcoes: [], unidadesAtivas: [], unidadesGerenciais: [], anoOpcoes: [] }
    const uniques = [...new Set(dadosSanitizados.map((r) => r.unidade_almoxarifado).filter(Boolean))].sort()
    const ativas = uniques.filter((u) => !String(u).includes('GERENCIAL'))
    const gerenciais = uniques.filter((u) => String(u).includes('GERENCIAL'))
    const anos = [...new Set(dadosSanitizados.map((r) => String(r.ano_referencia)).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
    return { unidadesOpcoes: uniques, unidadesAtivas: ativas, unidadesGerenciais: gerenciais, anoOpcoes: anos }
  }, [dadosSanitizados])

  useEffect(() => {
    if (anoOpcoes && anoOpcoes.length > 0 && initialLoad) {
      dispatch({ type: 'SET_ANOS', payload: [String(anoOpcoes[anoOpcoes.length - 1])] })
      setInitialLoad(false)
    }
  }, [anoOpcoes, initialLoad, dispatch])

  const getUnidadesPermitidas = useCallback((escopos) => {
    if (!escopos || escopos.length === 0) return unidadesOpcoes
    let allowed = []
    if (escopos.includes('Ativa')) allowed = [...allowed, ...unidadesAtivas]
    if (escopos.includes('Gerencial')) allowed = [...allowed, ...unidadesGerenciais]
    return [...new Set(allowed)].sort()
  }, [unidadesOpcoes, unidadesAtivas, unidadesGerenciais])

  const opcoesUnid = useMemo(() => getUnidadesPermitidas(escoposSel), [escoposSel, getUnidadesPermitidas])

  const dfFiltrado = useMemo(() => {
    let df = dadosSanitizados || []
    if (escoposSel.length > 0) {
      const allowed = new Set(getUnidadesPermitidas(escoposSel))
      df = df.filter(r => allowed.has(r.unidade_almoxarifado))
    }
    if (unidadesSel.length > 0) {
      const setU = new Set(unidadesSel)
      df = df.filter(r => setU.has(r.unidade_almoxarifado))
    }
    if (anosSel.length > 0 && anoOpcoes && anosSel.length < anoOpcoes.length) {
      const setA = new Set(anosSel)
      df = df.filter(r => setA.has(String(r.ano_referencia)))
    }
    if (tiposEstoqueSel.length > 0) {
      const querCritico = tiposEstoqueSel.includes('Crítico')
      const querObsoleto = tiposEstoqueSel.includes('Obsoleto')
      const querObra = tiposEstoqueSel.includes('Obra')
      const querInsumo = tiposEstoqueSel.includes('Insumo')
      const querOp = tiposEstoqueSel.includes('Operacional')
      df = df.filter(r =>
        (querCritico && r._isCritico) ||
        (querObsoleto && r._isObsoleto) ||
        (querObra && r._isObra) ||
        (querInsumo && r._isInsumo) ||
        (querOp && r._isOperacional)
      )
    }
    return df
  }, [dadosSanitizados, escoposSel, unidadesSel, anosSel, tiposEstoqueSel, getUnidadesPermitidas, anoOpcoes])

  useEffect(() => {
    dispatch({ type: 'RESET_SELECOES_FILTRO' })
  }, [escoposSel, unidadesSel, anosSel, tiposEstoqueSel, dispatch])

  const periodoMaximo = useMemo(() => {
    const source = dfFiltrado.length ? dfFiltrado : (dadosSanitizados || [])
    if (!source.length) return '01/2026'
    let maxAno = 0, maxMes = 0
    for (const r of source) {
      if (r.tmp_ano_num > maxAno || (r.tmp_ano_num === maxAno && r.tmp_mes_num > maxMes)) { maxAno = r.tmp_ano_num; maxMes = r.tmp_mes_num }
    }
    if (!maxAno) return '01/2026'
    return periodoLabel(maxMes, maxAno)
  }, [dfFiltrado, dadosSanitizados])

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

  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 150)
    return () => { cancelAnimationFrame(id); clearTimeout(t) }
  }, [snapshot.length, periodoEfetivo, dfFiltrado.length, abaCompraConsumo, abaRankingUnidade])

  const {
    metrics, rankingUnidade, rankCritico, rankObsoleto, rankObra, rankOperacional, rankInsumo,
    compraConsumoUnidade, variacaoUnidade, skusUnidade, exposicaoCategorias,
    maioresValoresDataCompleta, comprasSemConsumoDataCompleta, duplicadosDataCompleta
  } = useMemo(() => {
    const empty = {
      metrics: {
        valEstoque: 0, valCompras: 0, valConsumo: 0, valSkus: 0, valInsumo: 0,
        valCritico: 0, valObsoleto: 0, valObra: 0, valOp: 0,
        valEstoquePrev: 0, valComprasPrev: 0, valConsumoPrev: 0, valSkusPrev: 0, valInsumoPrev: 0,
        valCriticoPrev: 0, valObsoletoPrev: 0, valObraPrev: 0
      },
      rankingUnidade: [], rankCritico: [], rankObsoleto: [], rankObra: [], rankOperacional: [], rankInsumo: [],
      compraConsumoUnidade: [], variacaoUnidade: [], skusUnidade: [], exposicaoCategorias: [],
      maioresValoresDataCompleta: [], comprasSemConsumoDataCompleta: [], duplicadosDataCompleta: []
    }
    if (!snapshot.length && !snapshotPrev.length) return empty

    const mapRank = new Map(), mapRankPrev = new Map(), mapCrit = new Map()
    const mapObs = new Map(), mapObra = new Map(), mapOp = new Map(), mapInsumo = new Map()
    const mapCC = new Map(), mapSkus = new Map(), mapChaves = new Map(), mapChavesPorUnidade = new Map()
    const mapSkuAggComprasSemConsumo = new Map()

    let valEstoque = 0, valCompras = 0, valConsumo = 0
    let valCritico = 0, valObsoleto = 0, valObra = 0, valInsumo = 0, valOp = 0
    const skusSet = new Set(), maiores = [], comprasSem = []

    for (const r of snapshot) {
      const u = r.unidade_almoxarifado 
      const val = parseNumber(r.valor_saldo_atual)
      const valEntrada = parseNumber(r.valor_entrada_compras)
      const valSaida = parseNumber(r.valor_saida_cons_interno)
      const qtdAtual = parseNumber(r.qtde_saldo_atual)
      const qtdEntrada = parseNumber(r.qtde_entrada_compras) 
      
      valEstoque += val
      valCompras += valEntrada
      valConsumo += Math.abs(valSaida)

      if (u) mapRank.set(u, (mapRank.get(u) || 0) + val)

      if (r._isCritico) { if (u) mapCrit.set(u, (mapCrit.get(u) || 0) + val); valCritico += val }
      if (r._isObsoleto) { if (u) mapObs.set(u, (mapObs.get(u) || 0) + val); valObsoleto += val }
      if (r._isObra) { if (u) mapObra.set(u, (mapObra.get(u) || 0) + val); valObra += val }
      if (r._isInsumo) { if (u) mapInsumo.set(u, (mapInsumo.get(u) || 0) + val); valInsumo += val }
      if (r._isOperacional) { if (u) mapOp.set(u, (mapOp.get(u) || 0) + val); valOp += val }

      if (u) {
        if (!mapCC.has(u)) mapCC.set(u, { unidade: u, compras: 0, consumo: 0 })
        mapCC.get(u).compras += valEntrada
        mapCC.get(u).consumo += Math.abs(valSaida)
      }

      const precoMedioBase = parseNumber(r.preco_medio)
      const geBase = r.ge || '—'

      if (qtdAtual > 0 && r.codigo_produto) {
        skusSet.add(r.codigo_produto)
        if (u) {
          if (!mapSkus.has(u)) mapSkus.set(u, new Set())
          mapSkus.get(u).add(r.codigo_produto)
          if (r.nome_produto) {
            if (!mapChavesPorUnidade.has(u)) mapChavesPorUnidade.set(u, new Map())
            const mapUnid = mapChavesPorUnidade.get(u)
            const chave = gerarChaveDuplicidade(r.nome_produto)
            if (!mapUnid.has(chave)) mapUnid.set(chave, new Set())
            mapUnid.get(chave).add(r.codigo_produto)
          }
        }
      }

      if (val > 0) {
        const itemCriticoStr = r._isCritico ? 'Sim' : 'Não'
        maiores.push({ 
          _rowKey: `${u}-${r.codigo_produto}`, 
          unidade: u, 
          ge: geBase,
          codigo: r.codigo_produto, 
          nome: r.nome_produto, 
          quantidade: qtdAtual, 
          precoMedio: precoMedioBase,
          itemCritico: itemCriticoStr,
          valor: val 
        })
      }
      
      if (valEntrada > 0 || Math.abs(valSaida) > 0) {
        const skuKey = `${u}-${r.codigo_produto}`
        if (!mapSkuAggComprasSemConsumo.has(skuKey)) {
          mapSkuAggComprasSemConsumo.set(skuKey, { u, cod: r.codigo_produto, nome: r.nome_produto, _isCritico: r._isCritico, _isObsoleto: r._isObsoleto, _isObra: r._isObra, _isInsumo: r._isInsumo, _isOperacional: r._isOperacional, entrada: 0, saida: 0, qtdeComprada: 0 })
        }
        const item = mapSkuAggComprasSemConsumo.get(skuKey)
        item.entrada += valEntrada
        item.saida += Math.abs(valSaida)
        item.qtdeComprada += qtdEntrada
      }

      if (r.nome_produto && u) {
        const chaveGerada = gerarChaveDuplicidade(r.nome_produto)
        if (!mapChaves.has(chaveGerada)) {
          mapChaves.set(chaveGerada, { nomeExemplo: r.nome_produto, skus: new Set(), skusMap: new Map(), unidades: new Set(), quantidade: 0, valor: 0 })
        }
        const item = mapChaves.get(chaveGerada)
        if (r.codigo_produto) {
          item.skus.add(r.codigo_produto)
          if (!item.skusMap.has(r.codigo_produto)) {
            item.skusMap.set(r.codigo_produto, precoMedioBase)
          }
        }
        item.unidades.add(u)
        item.quantidade += qtdAtual
        item.valor += val
      }
    }

    for (const item of mapSkuAggComprasSemConsumo.values()) {
      if (item.entrada > 0.01 && item.saida <= (item.entrada * 0.05)) {
        comprasSem.push({ 
          _rowKey: `${item.u}-${item.cod}`, 
          unidade: item.u, 
          codigo: item.cod, 
          nome: item.nome, 
          flags: { critico: item._isCritico, obsoleto: item._isObsoleto, obra: item._isObra, insumo: item._isInsumo, op: item._isOperacional }, 
          qtdeComprada: item.qtdeComprada,
          comprado: item.entrada,
          consumido: item.saida
        })
      }
    }

    let valEstoquePrev = 0, valComprasPrev = 0, valConsumoPrev = 0
    let valCriticoPrev = 0, valObsoletoPrev = 0, valObraPrev = 0, valInsumoPrev = 0
    const skusPrevSet = new Set()
    
    for (const r of snapshotPrev) {
      const u = r.unidade_almoxarifado
      const val = parseNumber(r.valor_saldo_atual)
      const valEntrada = parseNumber(r.valor_entrada_compras)
      const valSaida = parseNumber(r.valor_saida_cons_interno)
      
      valEstoquePrev += val
      valComprasPrev += valEntrada
      valConsumoPrev += Math.abs(valSaida)
      if (u) mapRankPrev.set(u, (mapRankPrev.get(u) || 0) + val)

      if (r._isCritico) valCriticoPrev += val
      if (r._isObsoleto) valObsoletoPrev += val
      if (r._isObra) valObraPrev += val
      if (r._isInsumo) valInsumoPrev += val
      
      if (parseNumber(r.qtde_saldo_atual) > 0 && r.codigo_produto) skusPrevSet.add(r.codigo_produto)
    }

    const arrVariacao = []
    const todasUnid = new Set([...mapRank.keys(), ...mapRankPrev.keys()])
    for (const u of todasUnid) {
      if (!u) continue
      const atual = mapRank.get(u) || 0, prev = mapRankPrev.get(u) || 0, diff = atual - prev
      if (atual === 0 && prev === 0) continue 
      let pct = 0
      if (prev > 0) pct = (diff / prev) * 100
      else if (atual > 0) pct = 100
      arrVariacao.push({ unidade: u, atual, anterior: prev, diff, pct })
    }

    const mapToSort = (m) => [...m.entries()].filter(([unidade, v]) => unidade && v > 0.01).map(([unidade, valor]) => ({ unidade, valor })).sort((a, b) => a.valor - b.valor)
    
    const exposicao = [
      { name: 'Operacional', value: valOp, color: '#3498db' },
      { name: 'Insumo', value: valInsumo, color: '#f1c40f' },
      { name: 'Obra', value: valObra, color: '#1abc9c' },
      { name: 'Obsoleto', value: valObsoleto, color: '#9b59b6' },
      { name: 'Crítico', value: valCritico, color: '#e74c3c' },
    ].filter(d => d.value > 0).sort((a, b) => a.value - b.value)

    const duplicados = []
    for (const dados of mapChaves.values()) {
      if (dados.skus.size > 1) {
        const precosArr = Array.from(dados.skusMap.entries()).map(([sku, preco]) => `SKU ${sku}: ${fmtBRL(preco)}`)
        duplicados.push({ 
          _rowKey: dados.nomeExemplo, 
          nome: dados.nomeExemplo, 
          qtd_skus: dados.skus.size, 
          skus_lista: Array.from(dados.skus).join(', '), 
          precos_detalhados: precosArr.join(' | '),
          unidades_lista: Array.from(dados.unidades).join(', '), 
          quantidade: dados.quantidade, 
          valor: dados.valor 
        })
      }
    }
    duplicados.sort((a, b) => b.valor - a.valor)
    maiores.sort((a, b) => b.valor - a.valor)
    comprasSem.sort((a, b) => b.comprado - a.comprado)

    const skusUnidadeArr = [...mapSkus.entries()].map(([u, setSkus]) => {
      let duplicadosUnidade = 0
      if (mapChavesPorUnidade.has(u)) {
        for (const setChaves of mapChavesPorUnidade.get(u).values()) {
          if (setChaves.size > 1) duplicadosUnidade += setChaves.size
        }
      }
      return { unidade: u, total: setSkus.size, duplicados: duplicadosUnidade }
    }).filter(d => d.unidade && d.total > 0).sort((a, b) => a.total - b.total)

    return {
      metrics: {
        valEstoque, valCompras, valConsumo, valSkus: skusSet.size, valInsumo,
        valCritico, valObsoleto, valObra, valOp,
        valEstoquePrev, valComprasPrev, valConsumoPrev, valSkusPrev: skusPrevSet.size, valInsumoPrev,
        valCriticoPrev, valObsoletoPrev, valObraPrev
      },
      rankingUnidade: mapToSort(mapRank),
      rankCritico: mapToSort(mapCrit),
      rankObsoleto: mapToSort(mapObs),
      rankObra: mapToSort(mapObra),
      rankOperacional: mapToSort(mapOp),
      rankInsumo: mapToSort(mapInsumo),
      compraConsumoUnidade: [...mapCC.values()].filter((d) => d.unidade && (d.compras > 0.01 || d.consumo > 0.01)).sort((a, b) => (a.compras + a.consumo) - (b.compras + b.consumo)),
      variacaoUnidade: arrVariacao.filter(d => Math.abs(d.diff) > 0.01),
      skusUnidade: skusUnidadeArr,
      exposicaoCategorias: exposicao, 
      maioresValoresDataCompleta: maiores, comprasSemConsumoDataCompleta: comprasSem, duplicadosDataCompleta: duplicados
    }
  }, [snapshot, snapshotPrev])

  const rankingUnidadeAtivo = useMemo(() => {
    switch(abaRankingUnidade) {
      case 'operacional': return rankOperacional || [];
      case 'critico': return rankCritico || [];
      case 'obsoleto': return rankObsoleto || [];
      case 'obra': return rankObra || [];
      case 'insumo': return rankInsumo || [];
      default: return rankingUnidade || [];
    }
  }, [abaRankingUnidade, rankingUnidade, rankOperacional, rankCritico, rankObsoleto, rankObra, rankInsumo])

  const variacaoFiltrada = useMemo(() => {
    if (abaVariacao === 'aumento') return variacaoUnidade.filter(d => d.diff > 0).sort((a, b) => a.diff - b.diff)
    return variacaoUnidade.filter(d => d.diff <= 0).sort((a, b) => b.diff - a.diff)
  }, [variacaoUnidade, abaVariacao])

  const skusUnidadeFiltrado = useMemo(() => {
    return skusUnidade.map(d => ({
        unidade: d.unidade,
        total: abaSkusUnidade === 'duplicados' ? d.duplicados : d.total
    })).filter(d => d.total > 0).sort((a, b) => a.total - b.total);
  }, [skusUnidade, abaSkusUnidade])

  // =========================================================================
  // LOGICA PADRONIZADA DE TABELAS (GAVETA 50 | FULLSCREEN 1000)
  // =========================================================================

  const maioresValoresGaveta = useMemo(() => maioresValoresDataCompleta.slice(0, 50), [maioresValoresDataCompleta])
  const filtroUnidadeFSKey = filtroUnidadeFS.join('\0')

  const { dados: maioresValoresFS, total: maioresValoresFSTotal, unidadesOpcoes: unidadesFSMaioresValores } = useMemo(
    () => filtrarListaFS(maioresValoresDataCompleta, { texto: filtroTextoFS, unidades: filtroUnidadeFS, camposTexto: ['nome', 'codigo'], maxItems: 1000 }),
    [maioresValoresDataCompleta, filtroTextoFS, filtroUnidadeFSKey]
  )

  const comprasSemConsumoGaveta = useMemo(() => comprasSemConsumoDataCompleta.slice(0, 50), [comprasSemConsumoDataCompleta])

  const { dados: comprasSemConsumoFS, total: comprasSemConsumoFSTotal, unidadesOpcoes: unidadesFSComprasSemConsumo } = useMemo(
    () => filtrarListaFS(comprasSemConsumoDataCompleta, { texto: filtroTextoFS, unidades: filtroUnidadeFS, camposTexto: ['nome', 'codigo'], maxItems: 1000 }),
    [comprasSemConsumoDataCompleta, filtroTextoFS, filtroUnidadeFSKey]
  )

  const duplicadosGaveta = useMemo(() => duplicadosDataCompleta.slice(0, 50), [duplicadosDataCompleta])

  const { dados: duplicadosFS, total: duplicadosFSTotal, unidadesOpcoes: unidadesFSDuplicados } = useMemo(
    () => filtrarListaFS(duplicadosDataCompleta, {
      texto: filtroTextoFS, unidades: filtroUnidadeFS, camposTexto: ['nome', 'skus_lista'], maxItems: 1000,
      matchUnidade: (item, setU) => {
        const raw = item.unidades_lista
        if (!raw) return false
        const parts = String(raw).split(',')
        for (let i = 0; i < parts.length; i++) {
          if (setU.has(normUnidade(parts[i]))) return true
        }
        return false
      }
    }),
    [duplicadosDataCompleta, filtroTextoFS, filtroUnidadeFSKey]
  )

  // =========================================================================

  const timeSeriesAgg = useMemo(() => {
    const map = new Map()
    for (const r of dfFiltrado) {
      const key = `${r.tmp_ano_num}-${String(r.tmp_mes_num).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, { periodo: periodoLabel(r.tmp_mes_num, r.ano_referencia), ano: r.tmp_ano_num, mes: r.tmp_mes_num, total: 0, operacional: 0, critico: 0, obsoleto: 0, obra: 0, insumo: 0, compras: 0, consumo: 0, comprasSemConsumo: 0, skus: new Set(), chavesMap: new Map() })
      
      const item = map.get(key)
      const val = parseNumber(r.valor_saldo_atual)
      const valEntrada = parseNumber(r.valor_entrada_compras)
      const valSaida = parseNumber(r.valor_saida_cons_interno)

      item.total += val
      if (r._isOperacional) item.operacional += val
      if (r._isCritico) item.critico += val
      if (r._isObsoleto) item.obsoleto += val
      if (r._isObra) item.obra += val
      if (r._isInsumo) item.insumo += val
      item.compras += valEntrada
      item.consumo += Math.abs(valSaida)
      
      if (valEntrada > 0.01 && Math.abs(valSaida) <= (valEntrada * 0.05)) {
        item.comprasSemConsumo += valEntrada;
      }

      if (parseNumber(r.qtde_saldo_atual) > 0 && r.codigo_produto) {
        item.skus.add(r.codigo_produto)
        if (r.nome_produto && r.unidade_almoxarifado) {
          const chave = gerarChaveDuplicidade(r.nome_produto)
          if (!item.chavesMap.has(chave)) item.chavesMap.set(chave, new Set())
          item.chavesMap.get(chave).add(r.codigo_produto)
        }
      }
    }
    const sorted = [...map.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    return {
      total: sorted.map(d => ({ periodo: d.periodo, valor: d.total })), 
      operacional: sorted.map(d => ({ periodo: d.periodo, valor: d.operacional })),
      critico: sorted.map(d => ({ periodo: d.periodo, valor: d.critico })),
      obsoleto: sorted.map(d => ({ periodo: d.periodo, valor: d.obsoleto })), 
      obra: sorted.map(d => ({ periodo: d.periodo, valor: d.obra })),
      insumo: sorted.map(d => ({ periodo: d.periodo, valor: d.insumo })),
      comprasConsumo: sorted.map(d => ({ periodo: d.periodo, compras: d.compras, consumo: d.consumo })),
      comprasSemConsumoEvolucao: sorted.map(d => ({ periodo: d.periodo, valor: d.comprasSemConsumo })),
      skus: sorted.map(d => {
        let skusDupCount = 0
        for (const skusSet of d.chavesMap.values()) if (skusSet.size > 1) skusDupCount += skusSet.size
        return { periodo: d.periodo, total: d.skus.size, duplicados: skusDupCount }
      })
    }
  }, [dfFiltrado])

  const { giroMensal, giroAnual, coberturaMeses, coberturaAnos, giroMensalPrev, coberturaMesesPrev, giroCoberturaTempo } = useMemo(() => {
    const empty = { giroMensal: 0, giroAnual: 0, coberturaMeses: 0, coberturaAnos: 0, giroMensalPrev: 0, coberturaMesesPrev: 0, monthlyRaw: [], giroCoberturaTempo: [] }
    if (!dfFiltrado.length) return empty
    const p = parsePeriodo(periodoEfetivo)
    if (!p) return empty

    const map = new Map()
    for (const r of dfFiltrado) {
      const key = `${r.tmp_ano_num}-${r.tmp_mes_num}`
      if (!map.has(key)) map.set(key, { ano: r.tmp_ano_num, mes: r.tmp_mes_num, estoque_op: 0, consumo_op: 0 })
      const item = map.get(key)
      if (!r._isCritico && !r._isObsoleto) {
        item.estoque_op += parseNumber(r.valor_saldo_atual)
        item.consumo_op += Math.abs(parseNumber(r.valor_saida_cons_interno))
      }
    }
    const monthly = [...map.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes)

    let accEst = 0, accCon = 0
    const giroCoberturaTempo = monthly.map((row, i) => {
      accEst += row.estoque_op; accCon += row.consumo_op; const n = i + 1; const estMed = accEst / n; const conMed = accCon / n
      return { periodo: periodoLabel(row.mes, row.ano), giro: estMed > 0 ? conMed / estMed : 0, cobertura: conMed > 0 ? estMed / conMed : 0 }
    })

    const subAtual = monthly.filter((m) => m.ano === p.ano && m.mes <= p.mes && m.estoque_op > 0)
    let giroMensal = 0, giroAnual = 0, coberturaMeses = 0, coberturaAnos = 0
    if (subAtual.length) {
      const estMed = subAtual.reduce((s, m) => s + m.estoque_op, 0) / subAtual.length
      const conMed = subAtual.reduce((s, m) => s + m.consumo_op, 0) / subAtual.length
      if (estMed > 0) { giroMensal = conMed / estMed; giroAnual = giroMensal * 12 }
      if (conMed > 0) { coberturaMeses = estMed / conMed; coberturaAnos = coberturaMeses / 12 }
    }

    const mTetoPrev = p.mes > 1 ? p.mes - 1 : 12, anoPrev = p.mes > 1 ? p.ano : p.ano - 1
    const subPrev = monthly.filter((m) => m.ano === anoPrev && m.mes <= mTetoPrev && m.estoque_op > 0)
    let giroMensalPrev = 0, coberturaMesesPrev = 0
    if (subPrev.length) {
      const estMedP = subPrev.reduce((s, m) => s + m.estoque_op, 0) / subPrev.length
      const conMedP = subPrev.reduce((s, m) => s + m.consumo_op, 0) / subPrev.length
      if (estMedP > 0) giroMensalPrev = conMedP / estMedP
      if (conMedP > 0) coberturaMesesPrev = estMedP / conMedP
    }
    return { giroMensal, giroAnual, coberturaMeses, coberturaAnos, giroMensalPrev, coberturaMesesPrev, monthlyRaw: monthly, giroCoberturaTempo }
  }, [dfFiltrado, periodoEfetivo])

  // --- LÓGICA DE ITENS PARADOS ---
  const itensParados = useMemo(() => {
    const p = parsePeriodo(periodoEfetivo)
    if (!p || !dfFiltrado.length) return []
    const snapshotIdx = p.ano * 12 + p.mes
    
    const calc = dfFiltrado.filter((r) => {
      if (!r.unidade_almoxarifado || !r.tmp_ano_num || !r.tmp_mes_num) return false
      const rowIdx = r.tmp_ano_num * 12 + r.tmp_mes_num
      return rowIdx <= snapshotIdx && !r._isCritico && !r._isObsoleto
    }).map((r) => ({ ...r, tempo_idx: r.tmp_ano_num * 12 + r.tmp_mes_num }))

    const ultimoMov = new Map(), primeiroHist = new Map()
    for (const r of calc) {
      const key = `${r.unidade_almoxarifado}||${r.codigo_produto}`
      if (Math.abs(parseNumber(r.valor_saida_cons_interno)) > 0 && r.tempo_idx > (ultimoMov.get(key) || 0)) {
        ultimoMov.set(key, r.tempo_idx)
      }
      if (r.tempo_idx < (primeiroHist.get(key) ?? Infinity)) {
        primeiroHist.set(key, r.tempo_idx)
      }
    }

    const snapAtual = calc.filter((r) => r.tmp_ano_num === p.ano && r.tmp_mes_num === p.mes && parseNumber(r.qtde_saldo_atual) > 0 && r.codigo_produto)
    const result = []

    for (const r of snapAtual) {
      if (!r.unidade_almoxarifado) continue
      const key = `${r.unidade_almoxarifado}||${r.codigo_produto}`
      let ultimo = ultimoMov.get(key)
      if (ultimo == null) {
        const prim = primeiroHist.get(key)
        ultimo = prim != null ? prim - 1 : snapshotIdx
      }
      const mesesParado = Math.max(0, snapshotIdx - ultimo)
      
      if (mesesParado >= 3) {
        result.push({ 
          _rowKey: `${r.unidade_almoxarifado}-${r.codigo_produto}-${mesesParado}`, 
          unidade: r.unidade_almoxarifado, 
          codigo: r.codigo_produto, 
          nome: r.nome_produto, 
          quantidade: parseNumber(r.qtde_saldo_atual), 
          valor: parseNumber(r.valor_saldo_atual), 
          mesesParado 
        })
      }
    }
    
    return result.sort((a, b) => b.valor - a.valor) // Lista pura (sem filtros da gaveta)
  }, [dfFiltrado, periodoEfetivo])

  const mesesParadosOpcoes = useMemo(() => [...new Set(itensParados.map(i => i.mesesParado))].sort((a, b) => a - b).map(String), [itensParados])

  const paradosChart = useMemo(() => {
    const map = new Map()
    for (const item of itensParados) {
      const m = item.mesesParado
      if (!map.has(m)) map.set(m, { meses: m, label: `${m} Meses`, valor: 0, skus: 0 })
      const obj = map.get(m)
      obj.valor += item.valor; obj.skus += 1
    }
    return [...map.values()].sort((a, b) => a.meses - b.meses)
  }, [itensParados])

  // Lógica de filtro temporário apenas para o GRÁFICO e GAVETA (Se clicou no gráfico)
  const itensParadosParaExportar = useMemo(() => {
    let lista = itensParados
    if (filtroMesParado) {
      lista = itensParados.filter(item => item.mesesParado === filtroMesParado)
    }
    return [...lista]
  }, [itensParados, filtroMesParado])

  // Tabela que abre em linha (Gaveta) SEMPRE EXIBE A LISTA LIMPA OU O FILTRO DO GRÁFICO (Sem herdar filtros antigos)
  const itensParadosGaveta = useMemo(() => itensParadosParaExportar.slice(0, 50), [itensParadosParaExportar])

  // Base para o FullScreen (Recebe o Filtro de Meses FullScreen exclusivo)
  const itensParadosPreFS = useMemo(() => {
    let lista = itensParados
    
    // 1. Se clicou no gráfico da dashboard, respeita esse filtro na FS
    if (filtroMesParado) {
      lista = lista.filter(item => item.mesesParado === filtroMesParado)
    }
    
    // 2. Se usou o select de múltiplos meses no modo Tela Cheia, aplica também
    if (filtroMesParadoFS && filtroMesParadoFS.length > 0) {
      const setM = new Set(filtroMesParadoFS.map(String));
      lista = lista.filter(item => setM.has(String(item.mesesParado)));
    }
    
    return lista;
  }, [itensParados, filtroMesParado, filtroMesParadoFS]);

  const {
    dados: itensParadosFS,
    total: itensParadosFSTotal,
    unidadesOpcoes: unidadesFSParados
  } = useMemo(
    () => filtrarListaFS(itensParadosPreFS, {
      texto: filtroTextoFS,
      unidades: filtroUnidadeFS,
      camposTexto: ['nome', 'codigo'],
      maxItems: 1000
    }),
    [itensParadosPreFS, filtroTextoFS, filtroUnidadeFSKey]
  )

  // ==================== EXPORTAÇÕES COMPLETAS ====================
  // (Funções de Exportação Excel omitidas por brevidade, permanecem inalteradas)
  const exportarExcelMaioresValores = useCallback(() => { /* ... */ }, [maioresValoresDataCompleta, periodoEfetivo])
  const exportarExcelDuplicados = useCallback(() => { /* ... */ }, [duplicadosDataCompleta, periodoEfetivo])
  const exportarExcelComprasSemConsumo = useCallback(() => { /* ... */ }, [comprasSemConsumoDataCompleta, periodoEfetivo])
  const exportarExcelParados = useCallback(() => { /* ... */ }, [itensParadosParaExportar, periodoEfetivo])
  const exportarPowerPoint = useCallback(() => { /* ... */ }, [periodoEfetivo, metrics, escoposSel, tiposEstoqueSel])

  const toggleVis = useCallback((key) => setVis((v) => ({ ...v, [key]: !v[key] })), [])
  const toggleVisComprasConsumo = useCallback((key) => setVisComprasConsumo((v) => ({ ...v, [key]: !v[key] })), [])
  const toggleVisGiroCobertura = useCallback((key) => setVisGiroCobertura((v) => ({ ...v, [key]: !v[key] })), [])

  const handleChartClick = useCallback((event) => {
    if (event?.points?.[0]?.x) dispatch({ type: 'SET_PERIODO_ATIVO', payload: event.points[0].x })
  }, [dispatch])

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
    if (!periodoEfetivo || !timeSeriesAgg[aggKey].length) return []
    const index = timeSeriesAgg[aggKey].findIndex((d) => d.periodo === periodoEfetivo)
    if (index === -1) return []
    return [
      { type: 'line', xref: 'x', yref: 'paper', x0: index, x1: index, y0: 0, y1: 1, line: { color: colorBase, width: 1.5, dash: 'dot' }, layer: 'below' },
      { type: 'rect', xref: 'x', yref: 'paper', x0: index - 0.15, x1: index + 0.15, y0: 0, y1: 1, fillcolor: colorBase.replace('1)', '0.08)'), line: { width: 0 }, layer: 'below' },
    ]
  }

  const chartShapes = useMemo(() => getChartShapes('total', 'rgba(245, 130, 32, 1)'), [timeSeriesAgg.total, periodoEfetivo])
  const chartShapesSkus = useMemo(() => getChartShapes('skus', abaSkus === 'duplicados' ? 'rgba(241, 196, 15, 1)' : 'rgba(245, 130, 32, 1)'), [timeSeriesAgg.skus, periodoEfetivo, abaSkus])
  
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
    const createAnns = (dataArr, color, yOffset) => dataArr.map(d => {
      const isSelected = d.periodo === periodoEfetivo
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
  }, [timeSeriesAgg, vis, periodoEfetivo])

  const maxValRanking = useMemo(() => Math.max(...rankingUnidadeAtivo.map((d) => d.valor), 1), [rankingUnidadeAtivo])
  
  const colorMapRanking = { total: '#f58220', operacional: '#3498db', critico: '#e74c3c', obsoleto: '#9b59b6', obra: '#1abc9c', insumo: '#f1c40f' };
  const activeRankColor = colorMapRanking[abaRankingUnidade] || '#f58220';

  const plotDataRanking = useMemo(() => [
    {
      type: 'bar', orientation: 'h',
      y: rankingUnidadeAtivo.map((d) => d.unidade),
      x: rankingUnidadeAtivo.map(() => maxValRanking * 1.25),
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
        const textColor = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'
        return `<span style="color: ${textColor}; margin-left: 6px;">${rawText}</span>`
      }),
      textfont: { size: 10, family: 'Inter', weight: 600 },
      marker: {
        color: activeRankColor,
        opacity: rankingUnidadeAtivo.map((d) => (!selectedBarraRanking || d.unidade === selectedBarraRanking) ? 1 : 0.2),
        line: { color: '#080808', width: 1 }
      },
      hoverinfo: 'none'
    }
  ], [rankingUnidadeAtivo, selectedBarraRanking, maxValRanking, activeRankColor])

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

  const colsMaioresValores = useMemo(() => [
    { key: 'unidade', label: 'Unidade', className: 'text-white font-medium' },
    { key: 'codigo', label: 'Código SKU', className: 'text-accent font-mono' },
    { key: 'nome', label: 'Nome do Produto', className: 'text-white truncate max-w-[220px]', title: (i) => i.nome, render: (i) => i.nome || '—' },
    { key: 'ge', label: 'GE', className: 'text-muted font-medium text-center' },
    { key: 'itemCritico', label: 'Crítico', align: 'center', render: (i) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${i.itemCritico === 'Sim' ? 'bg-[#e74c3c]/15 text-[#e74c3c] border-[#e74c3c]/30' : 'bg-dark-500/20 text-muted border-dark-500/30'}`}>
          {i.itemCritico}
        </span>
      )
    },
    { key: 'quantidade', label: 'Quantidade', align: 'right', className: 'font-mono text-white', render: (i) => Number(i.quantidade).toLocaleString('pt-BR') },
    { key: 'precoMedio', label: 'Preço Médio', align: 'right', className: 'font-mono text-accent', render: (i) => fmtBRL(i.precoMedio) },
    { key: 'valor', label: 'Valor em Estoque', align: 'right', className: 'font-mono text-[#3498db] font-bold', render: (i) => fmtBRL(i.valor) },
  ], [])

  const colsDuplicados = useMemo(() => [
    { key: 'nome', label: 'Nome do Produto (Agrupado)', className: 'text-white font-medium max-w-[220px] truncate', title: (i) => i.nome },
    { key: 'qtd_skus', label: 'Qtd SKUs', align: 'center', render: (i) => (<span className="px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm border bg-[#f1c40f]/15 text-[#f1c40f] border-[#f1c40f]/30">{i.qtd_skus} SKUs</span>) },
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
      )
    },
    { key: 'qtdeComprada', label: 'Qtde Comprada', align: 'right', className: 'font-mono text-white', render: (i) => Number(i.qtdeComprada).toLocaleString('pt-BR') },
    { key: 'comprado', label: 'Valor Comprado', align: 'right', className: 'font-mono text-[#e74c3c] font-bold', render: (i) => fmtBRL(i.comprado) },
    { key: 'consumido', label: 'Valor Consumido', align: 'right', className: 'font-mono text-muted font-bold', render: (i) => fmtBRL(i.consumido) },
  ], [])

  const colsParados = useMemo(() => [
    { key: 'unidade', label: 'Unidade', className: 'text-white font-medium' },
    { key: 'codigo', label: 'Código SKU', className: 'text-accent font-mono' },
    { key: 'nome', label: 'Nome do Produto', className: 'text-white truncate max-w-[280px]', title: (i) => i.nome, render: (i) => i.nome || '—' },
    { key: 'quantidade', label: 'Quantidade', align: 'right', className: 'font-mono text-white', render: (i) => Number(i.quantidade).toLocaleString('pt-BR') },
    { key: 'valor', label: 'Valor Parado', align: 'right', className: 'font-mono text-[#2ecc71] font-bold', render: (i) => fmtBRL(i.valor) },
    { key: 'mesesParado', label: 'Meses Parado', align: 'center', render: (i) => (<span className="px-2.5 py-1 rounded-md bg-[#2A1610] text-[#f58220] border border-[#f58220]/30 text-[10px] font-bold shadow-sm group-hover:bg-[#f58220]/15 transition-colors">{i.mesesParado} Meses</span>) },
  ], [])

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
  };
  // --- INÍCIO DA PARTE 2 (Retorno JSX) ---
  return (
    <div className="space-y-6 animate-fade-in bg-[#080808] min-h-screen p-2 sm:p-4 text-white relative">
      <style>{`
        .js-plotly-plot .plotly .cursor-crosshair { cursor: pointer !important; }
        /* Remove a linha de foco (outline) padrão do navegador ao navegar pelo teclado */
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
          <button onClick={exportarPowerPoint} disabled={exportando} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#121212] hover:bg-[#1a1a1a] border border-[#2A2A2A] hover:border-[#f58220]/50 text-white font-bold text-[11px] tracking-widest shadow-sm transition-all disabled:opacity-50 disabled:cursor-wait">
            <svg className="w-4 h-4 text-[#f58220]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            <span>{exportando ? 'Gerando...' : 'PPTX'}</span>
          </button>
        </div>
      </div>

      {/* --- FILTROS E GRÁFICO PRINCIPAL --- */}
      <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_40px_rgba(245,130,32,0.2)] group">
        <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#2A2A2A]">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase mb-1 flex items-center gap-3">Painel Gerencial Âmbar Energia</div>
            <h2 className="text-base font-bold text-white flex items-center gap-2.5 tracking-wide">
              <svg className="w-5 h-5 text-accent shrink-0 drop-shadow-[0_0_8px_rgba(245,130,32,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              EVOLUÇÃO TEMPORAL DO ESTOQUE (R$)
            </h2>
          </div>

          <div className="flex flex-wrap items-end gap-3 z-30">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5">Categoria</label>
              <CyberMultiSelect 
                options={['Operacional', 'Crítico', 'Obsoleto', 'Obra', 'Insumo']} 
                selected={tiposEstoqueSel} 
                onChange={(val) => dispatch({ type: 'SET_TIPOS_ESTOQUE', payload: val })} 
                placeholder={tiposEstoqueSel.length === 0 || tiposEstoqueSel.length === 5 ? 'Todas as Categorias' : tiposEstoqueSel.join(', ')} 
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 flex items-center gap-1.5">Unidade</label>
              <CyberMultiSelect 
                options={['Ativa', 'Gerencial']} 
                selected={escoposSel} 
                onChange={(val) => dispatch({ type: 'SET_ESCOPOS', payload: val })} 
                placeholder={escoposSel.length === 0 || escoposSel.length === 2 ? 'Todas' : escoposSel.join(', ')} 
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
                options={anoOpcoes} 
                selected={anosSel} 
                onChange={(val) => dispatch({ type: 'SET_ANOS', payload: val })} 
                placeholder={anosSel.length === 0 || anosSel.length === anoOpcoes.length ? 'Todos os Anos' : anosSel.join(', ')} 
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
                  size: timeSeriesAgg.total.map(d => d.periodo === periodoEfetivo ? 12 : 10), 
                  color: timeSeriesAgg.total.map(d => d.periodo === periodoEfetivo ? '#f58220' : '#080808'), 
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
                  size: timeSeriesAgg.operacional.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                  color: timeSeriesAgg.operacional.map(d => d.periodo === periodoEfetivo ? '#3498db' : '#080808'), 
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
                  size: timeSeriesAgg.critico.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                  color: timeSeriesAgg.critico.map(d => d.periodo === periodoEfetivo ? '#e74c3c' : '#080808'), 
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
                  size: timeSeriesAgg.obsoleto.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                  color: timeSeriesAgg.obsoleto.map(d => d.periodo === periodoEfetivo ? '#9b59b6' : '#080808'), 
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
                  size: timeSeriesAgg.obra.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                  color: timeSeriesAgg.obra.map(d => d.periodo === periodoEfetivo ? '#1abc9c' : '#080808'), 
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
                  size: timeSeriesAgg.insumo.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                  color: timeSeriesAgg.insumo.map(d => d.periodo === periodoEfetivo ? '#f1c40f' : '#080808'), 
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
                showgrid: false, 
                zeroline: false, 
                tickmode: 'array', 
                tickvals: timeSeriesAgg.total.map(d => d.periodo), 
                ticktext: timeSeriesAgg.total.map(d => {
                  const isSelected = d.periodo === periodoEfetivo
                  const label = formatarPeriodoTexto(d.periodo)
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

        <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111111]/60 border border-[#2A2A2A]/50 rounded-xl py-2.5 px-4 mx-auto shadow-inner w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2 w-full">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-accent shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-[11px] text-[#8c9ba5] tracking-wide font-medium">
                Visualizando período: <strong className="text-white text-xs px-1.5 py-0.5 rounded bg-[#222] border border-[#333] ml-0.5">{formatarPeriodoTexto(periodoEfetivo)}</strong>
              </span>
            </div>
          </div>
          
          <button
            onClick={() => dispatch({ type: 'RESET_FILTROS_GERAIS', payload: anoOpcoes[anoOpcoes.length - 1] })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-[#8c9ba5] hover:text-white border border-[#333] hover:border-[#555] transition-all text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Restaurar Filtro Padrão
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
                <span className="text-[10px] text-muted font-medium mt-0.5 block">Top SKUs por capital na composição atual (Snapshot: {formatarPeriodoTexto(periodoEfetivo)})</span>
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
          <div className="w-5 h-5 rounded-md bg-[#16221d] flex items-center justify-center text-[#2ecc71] shadow-inner"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08-.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
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
          <ExecutiveCard cardKey="skus" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>} iconBg="bg-[#1c1c1c]" title="SKUs ÚNICOS" value={fmtInt(metrics.valSkus)} valueAtual={metrics.valSkus} valueAnterior={metrics.valSkusPrev} valueFontSize="text-base lg:text-lg text-white font-black" alignCenter={true} invertColor={true} variant="default" />
          <ExecutiveCard cardKey="giro" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} iconBg="bg-[#1c1c1c]" title="GIRO" value={""} valueAtual={giroMensal} valueAnterior={giroMensalPrev} variant="default">
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1.5 text-center transition-colors shadow-inner">
                <span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">MENSAL</span>
                <span className="text-base font-black text-white font-mono">{fmtDec(giroMensal)}</span>
              </div>
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1.5 text-center transition-colors shadow-inner">
                <span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">ANUAL</span>
                <span className="text-base font-black text-white font-mono">{fmtDec(giroAnual)}</span>
              </div>
            </div>
          </ExecutiveCard>
          <ExecutiveCard cardKey="cobertura" activeCard={activeCard} onCardClick={handleCardClick} paddingClass="py-3 px-5" icon={<svg className="w-4 h-4 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} iconBg="bg-[#1c1c1c]" title="COBERTURA" value={""} valueAtual={coberturaMeses} valueAnterior={coberturaMesesPrev} invertColor={true} variant="default">
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1.5 text-center transition-colors shadow-inner">
                <span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">MENSAL</span>
                <span className="text-base font-black text-white font-mono">{fmtMes(coberturaMeses)}</span>
              </div>
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1.5 text-center transition-colors shadow-inner">
                <span className="text-[9px] tracking-[0.15em] text-[#8c9ba5] font-bold block mb-1">ANUAL</span>
                <span className="text-base font-black text-white font-mono">{fmtMes(coberturaAnos)}</span>
              </div>
            </div>
          </ExecutiveCard>
        </div>
      </div>

      {/* --- RANKING + EXPOSIÇÃO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        
        {/* GRÁFICO PRINCIPAL DE ESTOQUE */}
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
                xaxis: { showgrid: false, showticklabels: false, zeroline: false, range: [0, maxValRanking * 1.25] },
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
            <div className={`w-8 h-8 rounded-lg bg-[#16221d] flex items-center justify-center border shadow-inner shrink-0 ${abaCompraConsumo === 'sem_consumo' ? 'border-[#e74c3c]/30' : 'border-[#2ecc71]/30'}`}>
              <svg className={`w-4 h-4 ${abaCompraConsumo === 'sem_consumo' ? 'text-[#e74c3c]' : 'text-[#2ecc71]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            </div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">EVOLUÇÃO TEMPORAL COMPRA x CONSUMO (R$)</h2>
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
                size: timeSeriesAgg.comprasConsumo.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                color: timeSeriesAgg.comprasConsumo.map(d => d.periodo === periodoEfetivo ? '#e74c3c' : '#080808'), 
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
                size: timeSeriesAgg.comprasConsumo.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                color: timeSeriesAgg.comprasConsumo.map(d => d.periodo === periodoEfetivo ? '#2ecc71' : '#080808'), 
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
                size: timeSeriesAgg.comprasSemConsumoEvolucao.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                color: timeSeriesAgg.comprasSemConsumoEvolucao.map(d => d.periodo === periodoEfetivo ? '#e74c3c' : '#080808'), 
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
              showgrid: false, 
              zeroline: false, 
              tickmode: 'array', 
              tickvals: timeSeriesAgg.comprasConsumo.map(d => d.periodo), 
              ticktext: timeSeriesAgg.comprasConsumo.map(d => {
                const isSelected = d.periodo === periodoEfetivo
                const label = formatarPeriodoTexto(d.periodo)
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
              <div><span className="text-xs font-bold text-[#e74c3c] uppercase tracking-wider block">{listaComprasSemConsumoAberta ? 'Fechar Lista de Compras sem Consumo' : 'Alerta: Compras realizadas com Baixo Consumo'}</span><span className="text-[10px] text-muted font-medium mt-0.5 block">Itens comprados no mês que tiveram pouca ou nenhuma saída registrada na unidade (Snapshot: {formatarPeriodoTexto(periodoEfetivo)})</span></div>
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
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">EVOLUÇÃO TEMPORAL DE SKUs (QTDE)</span>
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
          data={[{
            x: timeSeriesAgg.skus.map((d) => d.periodo),
            y: timeSeriesAgg.skus.map((d) => abaSkus === 'duplicados' ? d.duplicados : d.total),
            type: 'scatter',
            mode: 'lines+markers+text',
            text: timeSeriesAgg.skus.map((d) => fmtInt(abaSkus === 'duplicados' ? d.duplicados : d.total)),
            textposition: 'top center',
            textfont: { color: 'white', size: 11, family: 'Inter' },
            line: { color: abaSkus === 'duplicados' ? '#f1c40f' : '#3498db', width: 2, shape: 'spline', smoothing: 1.3 },
            marker: { 
              size: timeSeriesAgg.skus.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
              color: timeSeriesAgg.skus.map(d => d.periodo === periodoEfetivo ? (abaSkus === 'duplicados' ? '#f1c40f' : '#3498db') : '#080808'), 
              line: { color: abaSkus === 'duplicados' ? '#f1c40f' : '#3498db', width: 1.5 } 
            },
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
            xaxis: { 
              showgrid: false, 
              zeroline: false, 
              tickmode: 'array', 
              tickvals: timeSeriesAgg.skus.map(d => d.periodo), 
              ticktext: timeSeriesAgg.skus.map(d => {
                const isSelected = d.periodo === periodoEfetivo
                const label = formatarPeriodoTexto(d.periodo)
                return isSelected ? `<span style="color: #f58220; font-weight: 900;">• ${label} •</span>` : label
              }), 
              tickpad: 12, 
              automargin: true, 
              range: [-0.6, Math.max(timeSeriesAgg.skus.length - 0.4, 1)] 
            },
            yaxis: { showgrid: true, gridcolor: '#2A2A2A', zeroline: false, showticklabels: false, range: [0, (Math.max(...timeSeriesAgg.skus.map((d) => abaSkus === 'duplicados' ? d.duplicados : d.total), 10) || 10) * 1.25] }
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
                <span className="text-[10px] text-muted font-medium mt-0.5 block">Identifica produtos com o mesmo padrão descritivo (ignora pontuação) sob múltiplos códigos (Snapshot: {formatarPeriodoTexto(periodoEfetivo)})</span>
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
                  size: giroCoberturaTempo.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                  color: giroCoberturaTempo.map(d => d.periodo === periodoEfetivo ? '#3498db' : '#080808'), 
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
                  size: giroCoberturaTempo.map(d => d.periodo === periodoEfetivo ? 11 : 8), 
                  color: giroCoberturaTempo.map(d => d.periodo === periodoEfetivo ? '#f58220' : '#080808'), 
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
                showgrid: false, 
                zeroline: false, 
                tickmode: 'array', 
                tickvals: giroCoberturaTempo.map(d => d.periodo), 
                ticktext: giroCoberturaTempo.map(d => {
                  const isSelected = d.periodo === periodoEfetivo
                  const label = formatarPeriodoTexto(d.periodo)
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
            
            {/* GAVETA INLINE: ITENS PARADOS (SEM FILTROS DE TELA CHEIA) */}
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

      {/* MODAL FULLSCREEN: ITENS PARADOS */}
      {tabelaExpandida && (
        <FullScreenPortal onClose={() => fecharModalFS('tabelaExpandida')}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col backdrop-blur-sm animate-fade-in">
            
            {/* Header */}
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
                <button 
                  onClick={() => fecharModalFS('tabelaExpandida')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Fechar Janela</span>
                </button>
              </div>
            </div>

            {/* Barra de Filtros Tela Cheia */}
            <div className="flex flex-col sm:flex-row gap-4 px-6 py-3 bg-[#161616] border-b border-[#2A2A2A] shrink-0">
              {/* FILTRO 1: UNIDADE */}
              <div className="w-full sm:w-64">
                <CyberMultiSelect 
                  options={unidadesFSParados} 
                  selected={filtroUnidadeFS} 
                  onChange={onChangeUnidadeFS} 
                  placeholder="Unidades" 
                />
              </div>

              {/* FILTRO 2: MESES PARADOS */}
              <div className="w-full sm:w-56">
                <CyberMultiSelect 
                  options={mesesParadosOpcoes} 
                  selected={filtroMesParadoFS} 
                  onChange={(val) => setFiltroMesParadoFS(val)} 
                  placeholder="Meses Parado" 
                />
              </div>

              {/* FILTRO 3: BUSCA POR TEXTO */}
              <div className="flex-1 relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  placeholder="Buscar produto por nome ou código..." 
                  value={filtroTextoFS}
                  onChange={onChangeTextoFS}
                  className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-accent text-xs transition-colors"
                />
              </div>
            </div>

            {/* Tabela de Dados */}
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

      {/* MODAL: MAIORES VALORES */}
      {tabelaMaioresValoresExpandida && (
        <FullScreenPortal onClose={() => fecharModalFS('tabelaMaioresValoresExpandida')}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            
            {/* Header */}
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

            {/* Barra de Filtros Fullscreen */}
            <div className="flex flex-col sm:flex-row gap-4 px-6 py-3 bg-[#161616] border-b border-[#2A2A2A] shrink-0">
              {/* FILTRO 1: UNIDADE */}
              <div className="w-full sm:w-80">
                <CyberMultiSelect 
                  options={unidadesFSMaioresValores} 
                  selected={filtroUnidadeFS} 
                  onChange={onChangeUnidadeFS} 
                  placeholder="Filtrar por Unidades" 
                />
              </div>
              {/* FILTRO 2: TEXTO */}
              <div className="flex-1 relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  placeholder="Buscar produto por nome ou código..." 
                  value={filtroTextoFS}
                  onChange={onChangeTextoFS}
                  className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#3498db] text-xs transition-colors"
                />
              </div>
            </div>

            {/* Corpo da Tabela */}
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

      {/* MODAL: COMPRAS SEM CONSUMO */}
      {tabelaComprasSemConsumoExpandida && (
        <FullScreenPortal onClose={() => fecharModalFS('tabelaComprasSemConsumoExpandida')}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            
            {/* Header */}
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

            {/* Barra de Filtros Fullscreen */}
            <div className="flex flex-col sm:flex-row gap-4 px-6 py-3 bg-[#161616] border-b border-[#2A2A2A] shrink-0">
              {/* FILTRO 1: UNIDADE */}
              <div className="w-full sm:w-80">
                <CyberMultiSelect 
                  options={unidadesFSComprasSemConsumo} 
                  selected={filtroUnidadeFS} 
                  onChange={onChangeUnidadeFS} 
                  placeholder="Filtrar por Unidades" 
                />
              </div>
              {/* FILTRO 2: TEXTO */}
              <div className="flex-1 relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  placeholder="Buscar produto por nome ou código..." 
                  value={filtroTextoFS}
                  onChange={onChangeTextoFS}
                  className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#e74c3c] text-xs transition-colors"
                />
              </div>
            </div>

            {/* Corpo da Tabela */}
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

      {/* MODAL: CADASTROS DUPLICADOS */}
      {tabelaDuplicadosExpandida && (
        <FullScreenPortal onClose={() => fecharModalFS('tabelaDuplicadosExpandida')}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            
            {/* Header */}
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
            
            {/* Barra de Filtros Fullscreen */}
            <div className="flex flex-col sm:flex-row gap-4 px-6 py-3 bg-[#161616] border-b border-[#2A2A2A] shrink-0">
              {/* FILTRO 1: UNIDADE */}
              <div className="w-full sm:w-80">
                <CyberMultiSelect 
                  options={unidadesFSDuplicados} 
                  selected={filtroUnidadeFS} 
                  onChange={onChangeUnidadeFS} 
                  placeholder="Filtrar por Unidades" 
                />
              </div>
              {/* FILTRO 2: TEXTO */}
              <div className="flex-1 relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c9ba5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  placeholder="Buscar produto por nome ou código..." 
                  value={filtroTextoFS}
                  onChange={onChangeTextoFS}
                  className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#f1c40f] text-xs transition-colors"
                />
              </div>
            </div>

            {/* Corpo da Tabela */}
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