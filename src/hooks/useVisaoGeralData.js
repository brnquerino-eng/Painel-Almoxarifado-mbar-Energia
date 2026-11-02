import { useMemo, useState, useCallback, useEffect, useDeferredValue } from 'react'
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

// ============================================================================
// CONSTANTES
// ============================================================================

export const MAPA_ABR_MESES = {
  '01': 'JAN', '1': 'JAN', '02': 'FEV', '2': 'FEV', '03': 'MAR', '3': 'MAR',
  '04': 'ABR', '4': 'ABR', '05': 'MAI', '5': 'MAI', '06': 'JUN', '6': 'JUN',
  '07': 'JUL', '7': 'JUL', '08': 'AGO', '8': 'AGO', '09': 'SET', '9': 'SET',
  '10': 'OUT', '11': 'NOV', '12': 'DEZ'
}

const CAND_REGIAO = ['Região', 'Regiao', 'regiao', 'REGIAO', 'REGIÃO', 'region', 'Region', 'nm_regiao', 'nome_regiao']
const CAND_SEGMENTO = ['Segmento', 'segmento', 'SEGMENTO', 'segment', 'Segment', 'nm_segmento', 'nome_segmento', 'ds_segmento']

// ============================================================================
// FUNÇÕES UTILITÁRIAS PURAS
// ============================================================================

export function formatarPeriodoTexto(periodoStr) {
  if (!periodoStr) return ''
  const p = parsePeriodo(periodoStr)
  if (!p) return periodoStr
  const nomeMes = MAPA_ABR_MESES[String(p.mes).padStart(2, '0')] || p.mes
  return `${nomeMes}/${String(p.ano).slice(-2)}`
}

// Cache parseNumber
const _parseNumberCache = new Map()
const PARSE_CACHE_LIMIT = 8000

export function parseNumber(val) {
  if (val == null) return 0
  if (typeof val === 'number') return val

  const key = typeof val === 'string' ? val : String(val)
  if (_parseNumberCache.has(key)) return _parseNumberCache.get(key)

  let s = key.trim().replace(/R\$\s?/gi, '')
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }

  const n = parseFloat(s)
  const result = isNaN(n) ? 0 : n

  if (_parseNumberCache.size > PARSE_CACHE_LIMIT) _parseNumberCache.clear()
  _parseNumberCache.set(key, result)
  return result
}

// Cache chave duplicidade
const _chaveDupCache = new Map()
const CHAVE_CACHE_LIMIT = 6000

export function gerarChaveDuplicidade(nome) {
  if (!nome) return ''
  const key = String(nome)
  if (_chaveDupCache.has(key)) return _chaveDupCache.get(key)

  const clean = key
    .toUpperCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ')

  const result = clean || key.trim().toUpperCase()

  if (_chaveDupCache.size > CHAVE_CACHE_LIMIT) _chaveDupCache.clear()
  _chaveDupCache.set(key, result)
  return result
}

export function aplicarLentesIndependentes(r) {
  const nomeLocal = (r.nome_local_estoque || '').toUpperCase()
  const unidadeAlmox = (r.unidade_almoxarifado || '').toUpperCase()
  const isWartsila = nomeLocal.includes('WARTSILA') || unidadeAlmox.includes('WARTSILA')

  const s = String(r.codigo_local_estoque ?? '').trim()
  const codigoLocal = s.replace(/^0+/, '') || s
  const codigoProduto = String(r.codigo_produto ?? '').trim()

  const unidadeNorm = unidadeAlmox
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const _isObsoleto = isObsoleto(r.nome_local_estoque) || isWartsila
  const _isObra = isObra(r.nome_local_estoque)
  const _isCritico = isCritico(r.item_critico)

  // ========== REGRA DE INSUMO ==========
  let _isInsumo = false

  if (nomeLocal.includes('INSUMO')) {
    _isInsumo = true
  } else if (unidadeNorm.includes('CANDIOTA') && codigoLocal === '34769') {
    _isInsumo = true
  } else if (
    unidadeNorm.includes('CRUZEIRO DO SUL') &&
    codigoLocal === '38490' &&
    ['1381810', '1384761'].includes(codigoProduto)
  ) {
    _isInsumo = true
  } else if (
    unidadeNorm.includes('FEIJO') &&
    codigoLocal === '38494' &&
    codigoProduto === '1381810'
  ) {
    _isInsumo = true
  } else if (
    (unidadeNorm.includes('GOIANIA II') || unidadeNorm.includes('GOIANA II')) &&
    codigoLocal === '38480' &&
    ['1381810', '1379746'].includes(codigoProduto)
  ) {
    _isInsumo = true
  } else if (unidadeNorm.includes('LAGES') && codigoLocal === '34854') {
    _isInsumo = true
  } else if (
    (unidadeNorm.includes('MONTE C SUCUBA') || unidadeNorm.includes('MONTE C. SUCUBA') || unidadeNorm.includes('MONTE SU CUBA') || unidadeNorm.includes('MONTE C SU CUBA')) &&
    codigoLocal === '38491' &&
    codigoProduto === '189080'
  ) {
    _isInsumo = true
  } else if (
    unidadeNorm.includes('TARAUACA') &&
    codigoLocal === '38492' &&
    codigoProduto === '1381810'
  ) {
    _isInsumo = true
  } else if (
    unidadeNorm.includes('TAMBAQUI') &&
    codigoLocal === '38487' &&
    ['189080', '1341100'].includes(codigoProduto)
  ) {
    _isInsumo = true
  }

  const _isOperacional = !_isObsoleto && !_isObra && !_isCritico && !_isInsumo

  r._isObsoleto = _isObsoleto
  r._isObra = _isObra
  r._isCritico = _isCritico
  r._isInsumo = _isInsumo
  r._isOperacional = _isOperacional
  return r
}

export function normUnidade(v) {
  if (v == null) return ''
  let s = String(v)
  if (/[\u200B-\u200D\uFEFF]/.test(s)) {
    s = s.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '')
  }
  return s.trim().toUpperCase()
}

export function normalizeSelectedUnidades(raw) {
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

function normKeyName(k) {
  return String(k || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_\-]+/g, '')
    .trim()
}

function resolverChave(sample, candidates) {
  if (!sample || typeof sample !== 'object') return null
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (sample[c] != null && String(sample[c]).trim() !== '') return c
  }
  const wanted = new Set(candidates.map(normKeyName))
  const keys = Object.keys(sample)
  for (let i = 0; i < keys.length; i++) {
    if (wanted.has(normKeyName(keys[i]))) return keys[i]
  }
  return null
}

function valorColuna(r, key) {
  if (!key || !r) return ''
  const v = r[key]
  return v == null ? '' : String(v).trim()
}

export function filtrarListaFS(lista, { texto, unidades, camposTexto = ['nome', 'codigo'], maxItems = 1000, matchUnidade }) {
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

// ============================================================================
// HOOK PRINCIPAL DE CÁLCULOS
// ============================================================================

export function useVisaoGeralData(data, state, dispatch) {
  const [initialLoad, setInitialLoad] = useState(true)
  const [abaRankingUnidade, setAbaRankingUnidade] = useState('total')

  const {
    escoposSel, unidadesSel, anosSel, tiposEstoqueSel,
    regioesSel = [], segmentosSel = [],
    periodoAtivo,
    granularidade = 'mensal',
    abaVariacao, abaSkus, abaSkusUnidade, filtroMesParado,
  } = state

  // Deferred values para UI fluida
  const deferredEscoposSel = useDeferredValue(escoposSel)
  const deferredUnidadesSel = useDeferredValue(unidadesSel)
  const deferredAnosSel = useDeferredValue(anosSel)
  const deferredTiposEstoqueSel = useDeferredValue(tiposEstoqueSel)
  const deferredRegioesSel = useDeferredValue(regioesSel)
  const deferredSegmentosSel = useDeferredValue(segmentosSel)

  // -------------------------------------------------------------------------
  // 1. SANITIZAÇÃO DOS DADOS + APLICAÇÃO DAS LENTES
  // -------------------------------------------------------------------------
  const dadosSanitizados = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return []

    let chaveRegiao = null
    let chaveSegmento = null
    const limit = Math.min(data.length, 30)
    for (let i = 0; i < limit && (!chaveRegiao || !chaveSegmento); i++) {
      if (!chaveRegiao) chaveRegiao = resolverChave(data[i], CAND_REGIAO)
      if (!chaveSegmento) chaveSegmento = resolverChave(data[i], CAND_SEGMENTO)
    }

    const out = new Array(data.length)
    for (let i = 0; i < data.length; i++) {
      const original = data[i]
      const r = { ...original }

      if (r.unidade_almoxarifado) {
        r.unidade_almoxarifado = normUnidade(r.unidade_almoxarifado)
      }

      aplicarLentesIndependentes(r)

      r._regiao = valorColuna(r, chaveRegiao)
      r._segmento = valorColuna(r, chaveSegmento)

      out[i] = r
    }
    return out
  }, [data])

  // -------------------------------------------------------------------------
  // 2. CATÁLOGO COMPLETO (não cascateia)
  // -------------------------------------------------------------------------
  const {
    unidadesOpcoes, unidadesAtivas, unidadesGerenciais,
    anoOpcoesAll, regioesOpcoesAll, segmentosOpcoesAll,
  } = useMemo(() => {
    if (!dadosSanitizados || dadosSanitizados.length === 0) {
      return {
        unidadesOpcoes: [], unidadesAtivas: [], unidadesGerenciais: [],
        anoOpcoesAll: [], regioesOpcoesAll: [], segmentosOpcoesAll: [],
      }
    }
    const uniques = [...new Set(dadosSanitizados.map((r) => r.unidade_almoxarifado).filter(Boolean))].sort()
    const ativas = uniques.filter((u) => !String(u).includes('GERENCIAL'))
    const gerenciais = uniques.filter((u) => String(u).includes('GERENCIAL'))
    const anos = [...new Set(dadosSanitizados.map((r) => String(r.ano_referencia)).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
    const regioes = []
    const segmentos = []
    const seenR = new Set()
    const seenS = new Set()
    for (let i = 0; i < dadosSanitizados.length; i++) {
      const r = dadosSanitizados[i]
      if (r._regiao && !seenR.has(r._regiao)) { seenR.add(r._regiao); regioes.push(r._regiao) }
      if (r._segmento && !seenS.has(r._segmento)) { seenS.add(r._segmento); segmentos.push(r._segmento) }
    }
    regioes.sort()
    segmentos.sort()
    return {
      unidadesOpcoes: uniques,
      unidadesAtivas: ativas,
      unidadesGerenciais: gerenciais,
      anoOpcoesAll: anos,
      regioesOpcoesAll: regioes,
      segmentosOpcoesAll: segmentos,
    }
  }, [dadosSanitizados])

  const anoOpcoes = anoOpcoesAll

  // Carrega o último ano por padrão
  useEffect(() => {
    if (anoOpcoesAll && anoOpcoesAll.length > 0 && initialLoad) {
      dispatch({ type: 'SET_ANOS', payload: [String(anoOpcoesAll[anoOpcoesAll.length - 1])] })
      setInitialLoad(false)
    }
  }, [anoOpcoesAll, initialLoad, dispatch])

  const getUnidadesPermitidas = useCallback((escopos) => {
    if (!escopos || escopos.length === 0) return unidadesOpcoes
    let allowed = []
    if (escopos.includes('Ativa')) allowed = [...allowed, ...unidadesAtivas]
    if (escopos.includes('Gerencial')) allowed = [...allowed, ...unidadesGerenciais]
    return [...new Set(allowed)].sort()
  }, [unidadesOpcoes, unidadesAtivas, unidadesGerenciais])

  // -------------------------------------------------------------------------
  // 3. FILTROS EM CASCATA + dfFiltrado
  // -------------------------------------------------------------------------
  const {
    dfFiltrado,
    opcoesUnid,
    regioesOpcoes,
    segmentosOpcoes,
    anoOpcoesCascata,
    tiposEstoqueOpcoes,
    escoposOpcoes,
  } = useMemo(() => {
    const rows = dadosSanitizados || []
    const empty = {
      dfFiltrado: [],
      opcoesUnid: [],
      regioesOpcoes: regioesOpcoesAll,
      segmentosOpcoes: segmentosOpcoesAll,
      anoOpcoesCascata: anoOpcoesAll,
      tiposEstoqueOpcoes: ['Operacional', 'Crítico', 'Obsoleto', 'Obra', 'Insumo'],
      escoposOpcoes: ['Ativa', 'Gerencial'],
    }
    if (!rows.length) return empty

    const escopos = deferredEscoposSel
    const unidades = deferredUnidadesSel
    const anos = deferredAnosSel
    const tipos = deferredTiposEstoqueSel
    const regioes = deferredRegioesSel
    const segmentos = deferredSegmentosSel

    const escopoAllowed = escopos.length > 0 ? new Set(getUnidadesPermitidas(escopos)) : null
    const setU = unidades.length > 0 ? new Set(unidades) : null
    const setA = anos.length > 0 ? new Set(anos.map(String)) : null
    const setR = regioes.length > 0 ? new Set(regioes) : null
    const setS = segmentos.length > 0 ? new Set(segmentos) : null

    const temTipo = tipos.length > 0
    const querCritico = temTipo && tipos.includes('Crítico')
    const querObsoleto = temTipo && tipos.includes('Obsoleto')
    const querObra = temTipo && tipos.includes('Obra')
    const querInsumo = temTipo && tipos.includes('Insumo')
    const querOp = temTipo && tipos.includes('Operacional')

    const df = []
    const setUnid = new Set()
    const setReg = new Set()
    const setSeg = new Set()
    const setAno = new Set()

    let tOp = false, tCrit = false, tObs = false, tObra = false, tIns = false
    let hasAtiva = false, hasGer = false
    let temColunaRegiao = false
    let temColunaSegmento = false

    const len = rows.length
    for (let i = 0; i < len; i++) {
      const r = rows[i]
      const u = r.unidade_almoxarifado
      const reg = r._regiao || ''
      const seg = r._segmento || ''

      if (reg) temColunaRegiao = true
      if (seg) temColunaSegmento = true

      const passEscopo = !escopoAllowed || escopoAllowed.has(u)
      const passUnidade = !setU || setU.has(u)
      const passAno = !setA || setA.has(String(r.ano_referencia))
      const passRegiao = !setR || (reg && setR.has(reg))
      const passSegmento = !setS || (seg && setS.has(seg))

      let passTipo = true
      if (temTipo) {
        passTipo = (querCritico && r._isCritico) ||
                   (querObsoleto && r._isObsoleto) ||
                   (querObra && r._isObra) ||
                   (querInsumo && r._isInsumo) ||
                   (querOp && r._isOperacional)
      }

      if (passEscopo && passUnidade && passAno && passRegiao && passSegmento && passTipo) {
        df.push(r)
      }

      // Cascata de opções
      if (passUnidade && passAno && passRegiao && passSegmento && passTipo) {
        if (u) {
          if (String(u).includes('GERENCIAL')) hasGer = true
          else hasAtiva = true
        }
      }

      if (passEscopo && passAno && passRegiao && passSegmento && passTipo) {
        if (u) setUnid.add(u)
      }

      if (passEscopo && passUnidade && passRegiao && passSegmento && passTipo) {
        if (r.ano_referencia != null && r.ano_referencia !== '') {
          setAno.add(String(r.ano_referencia))
        }
      }

      if (passEscopo && passUnidade && passAno && passSegmento && passTipo) {
        if (reg) setReg.add(reg)
      }

      if (passEscopo && passUnidade && passAno && passRegiao && passTipo) {
        if (seg) setSeg.add(seg)
      }

      if (passEscopo && passUnidade && passAno && passRegiao && passSegmento) {
        if (!tOp && r._isOperacional) tOp = true
        if (!tCrit && r._isCritico) tCrit = true
        if (!tObs && r._isObsoleto) tObs = true
        if (!tObra && r._isObra) tObra = true
        if (!tIns && r._isInsumo) tIns = true
      }
    }

    const tiposArr = []
    if (tOp) tiposArr.push('Operacional')
    if (tCrit) tiposArr.push('Crítico')
    if (tObs) tiposArr.push('Obsoleto')
    if (tObra) tiposArr.push('Obra')
    if (tIns) tiposArr.push('Insumo')

    const escoposArr = []
    if (hasAtiva) escoposArr.push('Ativa')
    if (hasGer) escoposArr.push('Gerencial')

    const sortStr = (s) => [...s].sort()

    return {
      dfFiltrado: df,
      opcoesUnid: sortStr(setUnid),
      regioesOpcoes: setReg.size ? sortStr(setReg) : (temColunaRegiao ? [] : regioesOpcoesAll),
      segmentosOpcoes: setSeg.size ? sortStr(setSeg) : (temColunaSegmento ? [] : segmentosOpcoesAll),
      anoOpcoesCascata: sortStr(setAno).sort((a, b) => Number(a) - Number(b)),
      tiposEstoqueOpcoes: tiposArr.length ? tiposArr : empty.tiposEstoqueOpcoes,
      escoposOpcoes: escoposArr.length ? escoposArr : empty.escoposOpcoes,
    }
  }, [
    dadosSanitizados,
    deferredEscoposSel,
    deferredUnidadesSel,
    deferredAnosSel,
    deferredTiposEstoqueSel,
    deferredRegioesSel,
    deferredSegmentosSel,
    getUnidadesPermitidas,
    anoOpcoesAll,
    regioesOpcoesAll,
    segmentosOpcoesAll,
  ])

  // Limpeza de seleções inválidas
  useEffect(() => {
    let hasChanges = false
    const updates = {}

    if (unidadesSel.length > 0) {
      const set = new Set(opcoesUnid)
      const next = unidadesSel.filter((u) => set.has(u))
      if (next.length !== unidadesSel.length) {
        updates.unidades = next
        hasChanges = true
      }
    }
    if (regioesSel.length > 0) {
      const set = new Set(regioesOpcoes)
      const next = regioesSel.filter((v) => set.has(v))
      if (next.length !== regioesSel.length) {
        updates.regioes = next
        hasChanges = true
      }
    }
    if (segmentosSel.length > 0) {
      const set = new Set(segmentosOpcoes)
      const next = segmentosSel.filter((v) => set.has(v))
      if (next.length !== segmentosSel.length) {
        updates.segmentos = next
        hasChanges = true
      }
    }
    if (anosSel.length > 0 && anoOpcoesCascata.length > 0) {
      const set = new Set(anoOpcoesCascata)
      const next = anosSel.filter((v) => set.has(String(v))).map(String)
      if (next.length !== anosSel.length) {
        updates.anos = next.length > 0 ? next : [anoOpcoesCascata[anoOpcoesCascata.length - 1]]
        hasChanges = true
      }
    }
    if (tiposEstoqueSel.length > 0) {
      const set = new Set(tiposEstoqueOpcoes)
      const next = tiposEstoqueSel.filter((v) => set.has(v))
      if (next.length !== tiposEstoqueSel.length) {
        updates.tipos = next
        hasChanges = true
      }
    }
    if (escoposSel.length > 0) {
      const set = new Set(escoposOpcoes)
      const next = escoposSel.filter((v) => set.has(v))
      if (next.length !== escoposSel.length) {
        updates.escopos = next
        hasChanges = true
      }
    }

    if (!hasChanges) return

    if (updates.unidades) dispatch({ type: 'SET_UNIDADES', payload: updates.unidades })
    if (updates.regioes) dispatch({ type: 'SET_FIELD', field: 'regioesSel', payload: updates.regioes })
    if (updates.segmentos) dispatch({ type: 'SET_FIELD', field: 'segmentosSel', payload: updates.segmentos })
    if (updates.anos) dispatch({ type: 'SET_ANOS', payload: updates.anos })
    if (updates.tipos) dispatch({ type: 'SET_TIPOS_ESTOQUE', payload: updates.tipos })
    if (updates.escopos) dispatch({ type: 'SET_ESCOPOS', payload: updates.escopos })
  }, [opcoesUnid, regioesOpcoes, segmentosOpcoes, anoOpcoesCascata, tiposEstoqueOpcoes, escoposOpcoes, dispatch])

  // Reset de seleções de gráfico quando filtros de alto nível mudam
  useEffect(() => {
    dispatch({ type: 'RESET_SELECOES_FILTRO' })
  }, [escoposSel, unidadesSel, anosSel, tiposEstoqueSel, dispatch])

  // -------------------------------------------------------------------------
  // 4. PERÍODO E SNAPSHOTS
  // -------------------------------------------------------------------------
  const periodoMaximo = useMemo(() => {
    const source = dfFiltrado.length ? dfFiltrado : (dadosSanitizados || [])
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
  }, [dfFiltrado, dadosSanitizados])

  const periodoEfetivo = periodoAtivo || periodoMaximo

  const periodMonths = useMemo(() => {
    const p = parsePeriodo(periodoEfetivo)
    if (!p) return []

    let maxAno = 0, maxMes = 0, minAno = 9999, minMes = 13
    for (const r of dfFiltrado) {
      if (!r.tmp_ano_num || !r.tmp_mes_num) continue
      if (r.tmp_ano_num > maxAno || (r.tmp_ano_num === maxAno && r.tmp_mes_num > maxMes)) {
        maxAno = r.tmp_ano_num; maxMes = r.tmp_mes_num
      }
      if (r.tmp_ano_num < minAno || (r.tmp_ano_num === minAno && r.tmp_mes_num < minMes)) {
        minAno = r.tmp_ano_num; minMes = r.tmp_mes_num
      }
    }
    if (!maxAno) return [{ ano: p.ano, mes: p.mes }]

    const maxIdx = maxAno * 12 + maxMes
    const minIdx = minAno * 12 + minMes

    let startMes, startAno, endMes, endAno

    if (granularidade === 'trimestre') {
      const tri = Math.ceil(p.mes / 3)
      startMes = (tri - 1) * 3 + 1
      startAno = p.ano
      endMes = tri * 3
      endAno = p.ano
    } else if (granularidade === 'semestre') {
      const sem = p.mes <= 6 ? 1 : 2
      startMes = sem === 1 ? 1 : 7
      startAno = p.ano
      endMes = sem === 1 ? 6 : 12
      endAno = p.ano
    } else if (granularidade === 'anual') {
      startMes = 1
      startAno = p.ano
      endMes = 12
      endAno = p.ano
    } else {
      return [{ ano: p.ano, mes: p.mes }]
    }

    let startIdx = startAno * 12 + startMes
    let endIdx = endAno * 12 + endMes
    startIdx = Math.max(startIdx, minIdx)
    endIdx = Math.min(endIdx, maxIdx)

    const months = []
    for (let idx = startIdx; idx <= endIdx; idx++) {
      const ano = Math.floor((idx - 1) / 12)
      const mes = ((idx - 1) % 12) + 1
      months.push({ ano, mes })
    }
    return months.length ? months : [{ ano: p.ano, mes: p.mes }]
  }, [periodoEfetivo, granularidade, dfFiltrado])

  const { snapshot, snapshotPeriodo, snapshotPrev, snapshotPeriodoPrev } = useMemo(() => {
    const p = parsePeriodo(periodoEfetivo)
    if (!p || !dfFiltrado.length) {
      return { snapshot: [], snapshotPeriodo: [], snapshotPrev: [], snapshotPeriodoPrev: [] }
    }

    const snap = dfFiltrado.filter((r) => r.tmp_ano_num === p.ano && r.tmp_mes_num === p.mes)

    const monthSet = new Set(periodMonths.map(m => `${m.ano}-${m.mes}`))
    const snapPeriodo = periodMonths.length > 1
      ? dfFiltrado.filter((r) => monthSet.has(`${r.tmp_ano_num}-${r.tmp_mes_num}`))
      : snap

    let prevMonths = []
    if (granularidade === 'mensal') {
      let mPrev = p.mes - 1, aPrev = p.ano
      if (mPrev === 0) { mPrev = 12; aPrev -= 1 }
      prevMonths = [{ ano: aPrev, mes: mPrev }]
    } else if (granularidade === 'trimestre') {
      const tri = Math.ceil(p.mes / 3)
      let prevTri = tri - 1, prevAno = p.ano
      if (prevTri === 0) { prevTri = 4; prevAno -= 1 }
      const startM = (prevTri - 1) * 3 + 1
      for (let m = startM; m <= startM + 2; m++) prevMonths.push({ ano: prevAno, mes: m })
    } else if (granularidade === 'semestre') {
      const sem = p.mes <= 6 ? 1 : 2
      if (sem === 2) {
        for (let m = 1; m <= 6; m++) prevMonths.push({ ano: p.ano, mes: m })
      } else {
        for (let m = 7; m <= 12; m++) prevMonths.push({ ano: p.ano - 1, mes: m })
      }
    } else {
      for (let m = 1; m <= 12; m++) prevMonths.push({ ano: p.ano - 1, mes: m })
    }

    const lastPrev = prevMonths[prevMonths.length - 1]
    const snapPrev = lastPrev
      ? dfFiltrado.filter((r) => r.tmp_ano_num === lastPrev.ano && r.tmp_mes_num === lastPrev.mes)
      : []

    const prevMonthSet = new Set(prevMonths.map(m => `${m.ano}-${m.mes}`))
    const snapPeriodoPrev = prevMonths.length > 1
      ? dfFiltrado.filter((r) => prevMonthSet.has(`${r.tmp_ano_num}-${r.tmp_mes_num}`))
      : snapPrev

    return {
      snapshot: snap,
      snapshotPeriodo: snapPeriodo,
      snapshotPrev: snapPrev,
      snapshotPeriodoPrev: snapPeriodoPrev,
    }
  }, [dfFiltrado, periodoEfetivo, periodMonths, granularidade])

  // -------------------------------------------------------------------------
  // 5. MÉTRICAS + RANKINGS + LISTAS PRINCIPAIS
  // -------------------------------------------------------------------------
  const {
    metrics, rankingUnidade, rankCritico, rankObsoleto, rankObra, rankOperacional, rankInsumo,
    compraConsumoUnidade, variacaoUnidade, skusUnidade, exposicaoCategorias,
    maioresValoresDataCompleta, comprasSemConsumoDataCompleta, duplicadosDataCompleta
  } = useMemo(() => {
    const empty = {
      metrics: {
        valEstoque: 0, valCompras: 0, valConsumo: 0, valSkus: 0,
        valInsumo: 0, valCritico: 0, valObsoleto: 0, valObra: 0, valOp: 0,
        valEstoquePrev: 0, valComprasPrev: 0, valConsumoPrev: 0, valSkusPrev: 0,
        valInsumoPrev: 0, valCriticoPrev: 0, valObsoletoPrev: 0, valObraPrev: 0
      },
      rankingUnidade: [], rankCritico: [], rankObsoleto: [], rankObra: [], rankOperacional: [], rankInsumo: [],
      compraConsumoUnidade: [], variacaoUnidade: [], skusUnidade: [], exposicaoCategorias: [],
      maioresValoresDataCompleta: [], comprasSemConsumoDataCompleta: [], duplicadosDataCompleta: []
    }

    if (!snapshot.length && !snapshotPrev.length && !(snapshotPeriodo && snapshotPeriodo.length)) {
      return empty
    }

    const mapRank = new Map()
    const mapRankPrev = new Map()
    const mapCrit = new Map()
    const mapObs = new Map()
    const mapObra = new Map()
    const mapOp = new Map()
    const mapInsumo = new Map()
    const mapCC = new Map()
    const mapSkus = new Map()
    const mapChaves = new Map()
    const mapChavesPorUnidade = new Map()
    const mapSkuAggComprasSemConsumo = new Map()

    let valEstoque = 0, valCompras = 0, valConsumo = 0
    let valCritico = 0, valObsoleto = 0, valObra = 0, valInsumo = 0, valOp = 0
    const skusSet = new Set()
    const maiores = []
    const comprasSem = []

    // ESTOQUES (snapshot = fechamento)
    const snapLen = snapshot.length
    for (let i = 0; i < snapLen; i++) {
      const r = snapshot[i]
      const u = r.unidade_almoxarifado
      const val = parseNumber(r.valor_saldo_atual)
      const qtdAtual = parseNumber(r.qtde_saldo_atual)
      const precoMedioBase = parseNumber(r.preco_medio)
      const geBase = r.ge || '—'

      valEstoque += val

      if (u) mapRank.set(u, (mapRank.get(u) || 0) + val)

      if (r._isCritico) {
        if (u) mapCrit.set(u, (mapCrit.get(u) || 0) + val)
        valCritico += val
      }
      if (r._isObsoleto) {
        if (u) mapObs.set(u, (mapObs.get(u) || 0) + val)
        valObsoleto += val
      }
      if (r._isObra) {
        if (u) mapObra.set(u, (mapObra.get(u) || 0) + val)
        valObra += val
      }
      if (r._isInsumo) {
        if (u) mapInsumo.set(u, (mapInsumo.get(u) || 0) + val)
        valInsumo += val
      }
      if (r._isOperacional) {
        if (u) mapOp.set(u, (mapOp.get(u) || 0) + val)
        valOp += val
      }

      if (val > 0) {
        maiores.push({
          _rowKey: `${u}-${r.codigo_produto}`,
          unidade: u,
          ge: geBase,
          codigo: r.codigo_produto,
          nome: r.nome_produto,
          quantidade: qtdAtual,
          precoMedio: precoMedioBase,
          itemCritico: r._isCritico ? 'Sim' : 'Não',
          valor: val
        })
      }

      // Duplicados
      if (r.nome_produto && u) {
        const chaveGerada = gerarChaveDuplicidade(r.nome_produto)
        let item = mapChaves.get(chaveGerada)
        if (!item) {
          item = {
            nomeExemplo: r.nome_produto,
            skus: new Set(),
            skusMap: new Map(),
            unidades: new Set(),
            quantidade: 0,
            valor: 0
          }
          mapChaves.set(chaveGerada, item)
        }
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

    // FLUXOS
    const fonteFluxos = (snapshotPeriodo && snapshotPeriodo.length) ? snapshotPeriodo : snapshot
    const fluxLen = fonteFluxos.length

    for (let i = 0; i < fluxLen; i++) {
      const r = fonteFluxos[i]
      const u = r.unidade_almoxarifado
      const valEntrada = parseNumber(r.valor_entrada_compras)
      const valSaida = Math.abs(parseNumber(r.valor_saida_cons_interno))
      const qtdAtual = parseNumber(r.qtde_saldo_atual)
      const qtdEntrada = parseNumber(r.qtde_entrada_compras)

      valCompras += valEntrada
      valConsumo += valSaida

      if (u) {
        let cc = mapCC.get(u)
        if (!cc) {
          cc = { unidade: u, compras: 0, consumo: 0 }
          mapCC.set(u, cc)
        }
        cc.compras += valEntrada
        cc.consumo += valSaida
      }

      if (qtdAtual > 0 && r.codigo_produto) {
        skusSet.add(r.codigo_produto)
        if (u) {
          let setSkus = mapSkus.get(u)
          if (!setSkus) {
            setSkus = new Set()
            mapSkus.set(u, setSkus)
          }
          setSkus.add(r.codigo_produto)

          if (r.nome_produto) {
            let mapUnid = mapChavesPorUnidade.get(u)
            if (!mapUnid) {
              mapUnid = new Map()
              mapChavesPorUnidade.set(u, mapUnid)
            }
            const chave = gerarChaveDuplicidade(r.nome_produto)
            let setChaves = mapUnid.get(chave)
            if (!setChaves) {
              setChaves = new Set()
              mapUnid.set(chave, setChaves)
            }
            setChaves.add(r.codigo_produto)
          }
        }
      }

      if (valEntrada > 0 || valSaida > 0) {
        const skuKey = `${u}-${r.codigo_produto}`
        let item = mapSkuAggComprasSemConsumo.get(skuKey)
        if (!item) {
          item = {
            u,
            cod: r.codigo_produto,
            nome: r.nome_produto,
            _isCritico: r._isCritico,
            _isObsoleto: r._isObsoleto,
            _isObra: r._isObra,
            _isInsumo: r._isInsumo,
            _isOperacional: r._isOperacional,
            entrada: 0,
            saida: 0,
            qtdeComprada: 0
          }
          mapSkuAggComprasSemConsumo.set(skuKey, item)
        }
        item.entrada += valEntrada
        item.saida += valSaida
        item.qtdeComprada += qtdEntrada
      }
    }

    // Compras sem consumo (regra 5%)
    for (const item of mapSkuAggComprasSemConsumo.values()) {
      if (item.entrada > 0.01 && item.saida <= (item.entrada * 0.05)) {
        comprasSem.push({
          _rowKey: `${item.u}-${item.cod}`,
          unidade: item.u,
          codigo: item.cod,
          nome: item.nome,
          flags: {
            critico: item._isCritico,
            obsoleto: item._isObsoleto,
            obra: item._isObra,
            insumo: item._isInsumo,
            op: item._isOperacional
          },
          qtdeComprada: item.qtdeComprada,
          comprado: item.entrada,
          consumido: item.saida
        })
      }
    }

    // PERÍODO ANTERIOR
    let valEstoquePrev = 0, valComprasPrev = 0, valConsumoPrev = 0
    let valCriticoPrev = 0, valObsoletoPrev = 0, valObraPrev = 0, valInsumoPrev = 0
    const skusPrevSet = new Set()

    const prevLen = snapshotPrev.length
    for (let i = 0; i < prevLen; i++) {
      const r = snapshotPrev[i]
      const u = r.unidade_almoxarifado
      const val = parseNumber(r.valor_saldo_atual)

      valEstoquePrev += val
      if (u) mapRankPrev.set(u, (mapRankPrev.get(u) || 0) + val)

      if (r._isCritico) valCriticoPrev += val
      if (r._isObsoleto) valObsoletoPrev += val
      if (r._isObra) valObraPrev += val
      if (r._isInsumo) valInsumoPrev += val
    }

    const fonteFluxosPrev = (snapshotPeriodoPrev && snapshotPeriodoPrev.length)
      ? snapshotPeriodoPrev
      : snapshotPrev

    const prevFluxLen = fonteFluxosPrev.length
    for (let i = 0; i < prevFluxLen; i++) {
      const r = fonteFluxosPrev[i]
      valComprasPrev += parseNumber(r.valor_entrada_compras)
      valConsumoPrev += Math.abs(parseNumber(r.valor_saida_cons_interno))
      if (parseNumber(r.qtde_saldo_atual) > 0 && r.codigo_produto) {
        skusPrevSet.add(r.codigo_produto)
      }
    }

    // Variação por unidade
    const arrVariacao = []
    const todasUnid = new Set([...mapRank.keys(), ...mapRankPrev.keys()])
    for (const u of todasUnid) {
      if (!u) continue
      const atual = mapRank.get(u) || 0
      const prev = mapRankPrev.get(u) || 0
      const diff = atual - prev
      if (atual === 0 && prev === 0) continue
      let pct = 0
      if (prev > 0) pct = (diff / prev) * 100
      else if (atual > 0) pct = 100
      arrVariacao.push({ unidade: u, atual, anterior: prev, diff, pct })
    }

    const mapToSort = (m) => {
      const arr = []
      for (const [unidade, valor] of m) {
        if (unidade && valor > 0.01) arr.push({ unidade, valor })
      }
      arr.sort((a, b) => a.valor - b.valor)
      return arr
    }

    const exposicao = [
      { name: 'Operacional', value: valOp, color: '#3498db' },
      { name: 'Insumo', value: valInsumo, color: '#f1c40f' },
      { name: 'Obra', value: valObra, color: '#1abc9c' },
      { name: 'Obsoleto', value: valObsoleto, color: '#9b59b6' },
      { name: 'Crítico', value: valCritico, color: '#e74c3c' },
    ].filter(d => d.value > 0).sort((a, b) => a.value - b.value)

    // Duplicados finais
    const duplicados = []
    for (const dados of mapChaves.values()) {
      if (dados.skus.size > 1) {
        const precosArr = []
        for (const [sku, preco] of dados.skusMap) {
          precosArr.push(`SKU ${sku}: ${fmtBRL(preco)}`)
        }
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

    // SKUs por unidade
    const skusUnidadeArr = []
    for (const [u, setSkus] of mapSkus) {
      let duplicadosUnidade = 0
      const mapUnid = mapChavesPorUnidade.get(u)
      if (mapUnid) {
        for (const setChaves of mapUnid.values()) {
          if (setChaves.size > 1) duplicadosUnidade += setChaves.size
        }
      }
      if (u && setSkus.size > 0) {
        skusUnidadeArr.push({ unidade: u, total: setSkus.size, duplicados: duplicadosUnidade })
      }
    }
    skusUnidadeArr.sort((a, b) => a.total - b.total)

    return {
      metrics: {
        valEstoque, valCompras, valConsumo, valSkus: skusSet.size,
        valInsumo, valCritico, valObsoleto, valObra, valOp,
        valEstoquePrev, valComprasPrev, valConsumoPrev, valSkusPrev: skusPrevSet.size,
        valInsumoPrev, valCriticoPrev, valObsoletoPrev, valObraPrev
      },
      rankingUnidade: mapToSort(mapRank),
      rankCritico: mapToSort(mapCrit),
      rankObsoleto: mapToSort(mapObs),
      rankObra: mapToSort(mapObra),
      rankOperacional: mapToSort(mapOp),
      rankInsumo: mapToSort(mapInsumo),
      compraConsumoUnidade: [...mapCC.values()]
        .filter(d => d.unidade && (d.compras > 0.01 || d.consumo > 0.01))
        .sort((a, b) => (a.compras + a.consumo) - (b.compras + b.consumo)),
      variacaoUnidade: arrVariacao.filter(d => Math.abs(d.diff) > 0.01),
      skusUnidade: skusUnidadeArr,
      exposicaoCategorias: exposicao,
      maioresValoresDataCompleta: maiores,
      comprasSemConsumoDataCompleta: comprasSem,
      duplicadosDataCompleta: duplicados
    }
  }, [snapshot, snapshotPrev, snapshotPeriodo, snapshotPeriodoPrev])

  // -------------------------------------------------------------------------
  // 6. DERIVADOS DE RANKING / VARIAÇÃO / SKUs
  // -------------------------------------------------------------------------
  const rankingUnidadeAtivo = useMemo(() => {
    switch (abaRankingUnidade) {
      case 'operacional': return rankOperacional || []
      case 'critico': return rankCritico || []
      case 'obsoleto': return rankObsoleto || []
      case 'obra': return rankObra || []
      case 'insumo': return rankInsumo || []
      default: return rankingUnidade || []
    }
  }, [abaRankingUnidade, rankingUnidade, rankOperacional, rankCritico, rankObsoleto, rankObra, rankInsumo])

  const variacaoFiltrada = useMemo(() => {
    if (abaVariacao === 'aumento') return variacaoUnidade.filter(d => d.diff > 0).sort((a, b) => a.diff - b.diff)
    return variacaoUnidade.filter(d => d.diff <= 0).sort((a, b) => b.diff - a.diff)
  }, [variacaoUnidade, abaVariacao])

  const skusUnidadeFiltrado = useMemo(() =>
    skusUnidade
      .map(d => ({ unidade: d.unidade, total: abaSkusUnidade === 'duplicados' ? d.duplicados : d.total }))
      .filter(d => d.total > 0)
      .sort((a, b) => a.total - b.total),
    [skusUnidade, abaSkusUnidade]
  )

  // -------------------------------------------------------------------------
  // 7. TIME SERIES (evolução temporal)
  // -------------------------------------------------------------------------
  const timeSeriesAgg = useMemo(() => {
    const monthlyMap = new Map()
    const len = dfFiltrado.length

    for (let i = 0; i < len; i++) {
      const r = dfFiltrado[i]
      const ano = r.tmp_ano_num
      const mes = r.tmp_mes_num || 1
      const key = `${ano}-${String(mes).padStart(2, '0')}`

      let item = monthlyMap.get(key)
      if (!item) {
        item = {
          periodo: periodoLabel(mes, r.ano_referencia),
          ano,
          mes,
          sortKey: key,
          total: 0,
          operacional: 0,
          critico: 0,
          obsoleto: 0,
          obra: 0,
          insumo: 0,
          compras: 0,
          consumo: 0,
          comprasSemConsumo: 0,
          skuFluxos: new Map(),
          skus: new Set(),
          chavesMap: new Map(),
        }
        monthlyMap.set(key, item)
      }

      const val = parseNumber(r.valor_saldo_atual)
      const valEntrada = parseNumber(r.valor_entrada_compras)
      const valSaida = Math.abs(parseNumber(r.valor_saida_cons_interno))

      item.total += val
      if (r._isOperacional) item.operacional += val
      if (r._isCritico) item.critico += val
      if (r._isObsoleto) item.obsoleto += val
      if (r._isObra) item.obra += val
      if (r._isInsumo) item.insumo += val

      item.compras += valEntrada
      item.consumo += valSaida

      if ((valEntrada > 0 || valSaida > 0) && r.codigo_produto) {
        const skuKey = `${r.unidade_almoxarifado || ''}||${r.codigo_produto}`
        let flux = item.skuFluxos.get(skuKey)
        if (!flux) {
          flux = { entrada: 0, saida: 0 }
          item.skuFluxos.set(skuKey, flux)
        }
        flux.entrada += valEntrada
        flux.saida += valSaida
      }

      if (parseNumber(r.qtde_saldo_atual) > 0 && r.codigo_produto) {
        item.skus.add(r.codigo_produto)
        if (r.nome_produto && r.unidade_almoxarifado) {
          const chave = gerarChaveDuplicidade(r.nome_produto)
          let setSkus = item.chavesMap.get(chave)
          if (!setSkus) {
            setSkus = new Set()
            item.chavesMap.set(chave, setSkus)
          }
          setSkus.add(r.codigo_produto)
        }
      }
    }

    // Preenche meses sem dado
    if (dadosSanitizados && dadosSanitizados.length > 0) {
      let minAno = 9999, minMes = 13, maxAno = 0, maxMes = 0
      const anosFiltro = anosSel.length > 0 && anoOpcoes && anosSel.length < anoOpcoes.length
        ? new Set(anosSel.map(String))
        : null

      for (let i = 0; i < dadosSanitizados.length; i++) {
        const r = dadosSanitizados[i]
        if (!r.tmp_ano_num || !r.tmp_mes_num) continue
        if (anosFiltro && !anosFiltro.has(String(r.ano_referencia))) continue

        if (r.tmp_ano_num < minAno || (r.tmp_ano_num === minAno && r.tmp_mes_num < minMes)) {
          minAno = r.tmp_ano_num; minMes = r.tmp_mes_num
        }
        if (r.tmp_ano_num > maxAno || (r.tmp_ano_num === maxAno && r.tmp_mes_num > maxMes)) {
          maxAno = r.tmp_ano_num; maxMes = r.tmp_mes_num
        }
      }

      if (minAno <= maxAno) {
        let a = minAno, m = minMes
        while (a < maxAno || (a === maxAno && m <= maxMes)) {
          const key = `${a}-${String(m).padStart(2, '0')}`
          if (!monthlyMap.has(key)) {
            monthlyMap.set(key, {
              periodo: periodoLabel(m, a),
              ano: a,
              mes: m,
              sortKey: key,
              total: 0, operacional: 0, critico: 0, obsoleto: 0, obra: 0, insumo: 0,
              compras: 0, consumo: 0, comprasSemConsumo: 0,
              skuFluxos: new Map(),
              skus: new Set(),
              chavesMap: new Map(),
            })
          }
          m += 1
          if (m > 12) { m = 1; a += 1 }
        }
      }
    }

    for (const item of monthlyMap.values()) {
      let csc = 0
      for (const flux of item.skuFluxos.values()) {
        if (flux.entrada > 0.01 && flux.saida <= flux.entrada * 0.05) {
          csc += flux.entrada
        }
      }
      item.comprasSemConsumo = csc
    }

    const monthlySorted = [...monthlyMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

    const buildReturn = (points) => ({
      total: points.map(d => ({ periodo: d.periodo, closingPeriodo: d.closingPeriodo, valor: d.total })),
      operacional: points.map(d => ({ periodo: d.periodo, closingPeriodo: d.closingPeriodo, valor: d.operacional })),
      critico: points.map(d => ({ periodo: d.periodo, closingPeriodo: d.closingPeriodo, valor: d.critico })),
      obsoleto: points.map(d => ({ periodo: d.periodo, closingPeriodo: d.closingPeriodo, valor: d.obsoleto })),
      obra: points.map(d => ({ periodo: d.periodo, closingPeriodo: d.closingPeriodo, valor: d.obra })),
      insumo: points.map(d => ({ periodo: d.periodo, closingPeriodo: d.closingPeriodo, valor: d.insumo })),
      comprasConsumo: points.map(d => ({ periodo: d.periodo, closingPeriodo: d.closingPeriodo, compras: d.compras, consumo: d.consumo })),
      comprasSemConsumoEvolucao: points.map(d => ({ periodo: d.periodo, closingPeriodo: d.closingPeriodo, valor: d.comprasSemConsumo })),
      skus: points.map(d => {
        let skusDupCount = 0
        for (const skusSet of d.chavesMap.values()) {
          if (skusSet.size > 1) skusDupCount += skusSet.size
        }
        return { periodo: d.periodo, closingPeriodo: d.closingPeriodo, total: d.skus.size, duplicados: skusDupCount }
      }),
    })

    if (granularidade === 'mensal') {
      const points = monthlySorted.map(d => ({
        ...d,
        closingPeriodo: d.periodo,
      }))
      return buildReturn(points)
    }

    // Agregação trimestre / semestre / anual
    const groupMap = new Map()

    for (let i = 0; i < monthlySorted.length; i++) {
      const m = monthlySorted[i]
      let groupKey = ''
      let periodoLabelStr = ''

      if (granularidade === 'trimestre') {
        const tri = Math.ceil(m.mes / 3)
        groupKey = `${m.ano}-T${tri}`
        periodoLabelStr = `T${tri}/${String(m.ano).slice(-2)}`
      } else if (granularidade === 'semestre') {
        const sem = m.mes <= 6 ? 1 : 2
        groupKey = `${m.ano}-S${sem}`
        periodoLabelStr = `S${sem}/${String(m.ano).slice(-2)}`
      } else {
        groupKey = `${m.ano}`
        periodoLabelStr = `Ano ${m.ano}`
      }

      let g = groupMap.get(groupKey)
      if (!g) {
        g = {
          periodo: periodoLabelStr,
          sortKey: groupKey,
          latestMes: -1,
          closingPeriodo: m.periodo,
          total: 0,
          operacional: 0,
          critico: 0,
          obsoleto: 0,
          obra: 0,
          insumo: 0,
          compras: 0,
          consumo: 0,
          comprasSemConsumo: 0,
          skuFluxos: new Map(),
          skus: new Set(),
          chavesMap: new Map(),
        }
        groupMap.set(groupKey, g)
      }

      g.compras += m.compras
      g.consumo += m.consumo

      for (const [skuKey, flux] of m.skuFluxos) {
        let gf = g.skuFluxos.get(skuKey)
        if (!gf) {
          gf = { entrada: 0, saida: 0 }
          g.skuFluxos.set(skuKey, gf)
        }
        gf.entrada += flux.entrada
        gf.saida += flux.saida
      }

      for (const sku of m.skus) g.skus.add(sku)
      for (const [chave, setSkus] of m.chavesMap) {
        let target = g.chavesMap.get(chave)
        if (!target) {
          target = new Set()
          g.chavesMap.set(chave, target)
        }
        for (const sku of setSkus) target.add(sku)
      }

      if (m.mes > g.latestMes) {
        g.latestMes = m.mes
        g.closingPeriodo = m.periodo
        g.total = m.total
        g.operacional = m.operacional
        g.critico = m.critico
        g.obsoleto = m.obsoleto
        g.obra = m.obra
        g.insumo = m.insumo
      }
    }

    for (const g of groupMap.values()) {
      let csc = 0
      for (const flux of g.skuFluxos.values()) {
        if (flux.entrada > 0.01 && flux.saida <= flux.entrada * 0.05) {
          csc += flux.entrada
        }
      }
      g.comprasSemConsumo = csc
    }

    const sorted = [...groupMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    return buildReturn(sorted)
  }, [dfFiltrado, dadosSanitizados, anosSel, anoOpcoes, granularidade])

  const periodoDisplay = useMemo(() => {
    const series = timeSeriesAgg?.total || []
    const point = series.find(d => d.closingPeriodo === periodoEfetivo || d.periodo === periodoEfetivo)
    if (point?.periodo) return point.periodo
    return formatarPeriodoTexto(periodoEfetivo)
  }, [timeSeriesAgg, periodoEfetivo])

  // -------------------------------------------------------------------------
  // 8. GIRO x COBERTURA
  // -------------------------------------------------------------------------
  const { giroMensal, giroAnual, coberturaMeses, coberturaAnos, giroMensalPrev, coberturaMesesPrev, giroCoberturaTempo } = useMemo(() => {
    const empty = {
      giroMensal: 0, giroAnual: 0, coberturaMeses: 0, coberturaAnos: 0,
      giroMensalPrev: 0, coberturaMesesPrev: 0, monthlyRaw: [], giroCoberturaTempo: []
    }
    if (!dfFiltrado.length) return empty
    const p = parsePeriodo(periodoEfetivo)
    if (!p) return empty

    const map = new Map()
    const len = dfFiltrado.length
    for (let i = 0; i < len; i++) {
      const r = dfFiltrado[i]
      if (r._isCritico || r._isObsoleto) continue

      const key = `${r.tmp_ano_num}-${r.tmp_mes_num}`
      let item = map.get(key)
      if (!item) {
        item = { ano: r.tmp_ano_num, mes: r.tmp_mes_num, estoque_op: 0, consumo_op: 0 }
        map.set(key, item)
      }
      item.estoque_op += parseNumber(r.valor_saldo_atual)
      item.consumo_op += Math.abs(parseNumber(r.valor_saida_cons_interno))
    }

    const monthly = [...map.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes)

    let accEst = 0, accCon = 0
    const giroCoberturaTempo = monthly.map((row, i) => {
      accEst += row.estoque_op
      accCon += row.consumo_op
      const n = i + 1
      const estMed = accEst / n
      const conMed = accCon / n
      return {
        periodo: periodoLabel(row.mes, row.ano),
        giro: estMed > 0 ? conMed / estMed : 0,
        cobertura: conMed > 0 ? estMed / conMed : 0
      }
    })

    const monthKeySet = new Set((periodMonths || []).map(m => `${m.ano}-${m.mes}`))
    const subAtual = monthly.filter(m => monthKeySet.has(`${m.ano}-${m.mes}`) && m.estoque_op > 0)

    let giroMensal = 0, giroAnual = 0, coberturaMeses = 0, coberturaAnos = 0
    if (subAtual.length) {
      const estMed = subAtual.reduce((s, m) => s + m.estoque_op, 0) / subAtual.length
      const conMed = subAtual.reduce((s, m) => s + m.consumo_op, 0) / subAtual.length
      if (estMed > 0) {
        giroMensal = conMed / estMed
        giroAnual = giroMensal * 12
      }
      if (conMed > 0) {
        coberturaMeses = estMed / conMed
        coberturaAnos = coberturaMeses / 12
      }
    }

    let giroMensalPrev = 0, coberturaMesesPrev = 0
    if (periodMonths && periodMonths.length) {
      const first = periodMonths[0]
      const n = periodMonths.length
      const firstIdx = first.ano * 12 + first.mes
      const prevEndIdx = firstIdx - 1
      const prevStartIdx = prevEndIdx - n + 1

      const subPrev = monthly.filter(m => {
        const idx = m.ano * 12 + m.mes
        return idx >= prevStartIdx && idx <= prevEndIdx && m.estoque_op > 0
      })

      if (subPrev.length) {
        const estMedP = subPrev.reduce((s, m) => s + m.estoque_op, 0) / subPrev.length
        const conMedP = subPrev.reduce((s, m) => s + m.consumo_op, 0) / subPrev.length
        if (estMedP > 0) giroMensalPrev = conMedP / estMedP
        if (conMedP > 0) coberturaMesesPrev = estMedP / conMedP
      }
    }

    return {
      giroMensal, giroAnual, coberturaMeses, coberturaAnos,
      giroMensalPrev, coberturaMesesPrev,
      monthlyRaw: monthly,
      giroCoberturaTempo
    }
  }, [dfFiltrado, periodoEfetivo, periodMonths])

  // -------------------------------------------------------------------------
  // 9. ITENS PARADOS
  // -------------------------------------------------------------------------
  const itensParados = useMemo(() => {
    const p = parsePeriodo(periodoEfetivo)
    if (!p || !dfFiltrado.length) return []

    const snapshotIdx = p.ano * 12 + p.mes

    const calc = []
    const len = dfFiltrado.length
    for (let i = 0; i < len; i++) {
      const r = dfFiltrado[i]
      if (!r.unidade_almoxarifado || !r.tmp_ano_num || !r.tmp_mes_num) continue
      if (r._isCritico || r._isObsoleto) continue
      const tempoIdx = r.tmp_ano_num * 12 + r.tmp_mes_num
      if (tempoIdx > snapshotIdx) continue
      calc.push({ r, tempo_idx: tempoIdx })
    }

    const ultimoMov = new Map()
    const primeiroHist = new Map()

    for (let i = 0; i < calc.length; i++) {
      const { r, tempo_idx } = calc[i]
      const key = `${r.unidade_almoxarifado}||${r.codigo_produto}`

      if (Math.abs(parseNumber(r.valor_saida_cons_interno)) > 0) {
        const atual = ultimoMov.get(key) || 0
        if (tempo_idx > atual) ultimoMov.set(key, tempo_idx)
      }

      const prim = primeiroHist.get(key)
      if (prim === undefined || tempo_idx < prim) {
        primeiroHist.set(key, tempo_idx)
      }
    }

    const result = []
    for (let i = 0; i < calc.length; i++) {
      const { r, tempo_idx } = calc[i]
      if (r.tmp_ano_num !== p.ano || r.tmp_mes_num !== p.mes) continue
      if (parseNumber(r.qtde_saldo_atual) <= 0 || !r.codigo_produto) continue

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

    result.sort((a, b) => b.valor - a.valor)
    return result
  }, [dfFiltrado, periodoEfetivo])

  const mesesParadosOpcoes = useMemo(
    () => [...new Set(itensParados.map(i => i.mesesParado))].sort((a, b) => a - b).map(String),
    [itensParados]
  )

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

  // -------------------------------------------------------------------------
  // RETORNO DO HOOK
  // -------------------------------------------------------------------------
  return {
    // dados base
    dadosSanitizados,
    dfFiltrado,

    // opções de filtros
    unidadesOpcoes,
    unidadesAtivas,
    unidadesGerenciais,
    anoOpcoes,
    anoOpcoesAll,
    regioesOpcoesAll,
    segmentosOpcoesAll,
    opcoesUnid,
    regioesOpcoes,
    segmentosOpcoes,
    anoOpcoesCascata,
    tiposEstoqueOpcoes,
    escoposOpcoes,

    // período
    periodoMaximo,
    periodoEfetivo,
    periodoDisplay,
    periodMonths,

    // métricas e rankings
    metrics,
    rankingUnidade,
    rankingUnidadeAtivo,
    rankCritico,
    rankObsoleto,
    rankObra,
    rankOperacional,
    rankInsumo,
    compraConsumoUnidade,
    variacaoUnidade,
    variacaoFiltrada,
    skusUnidade,
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

    // helpers exportados
    parseNumber,
    gerarChaveDuplicidade,
    filtrarListaFS,
    formatarPeriodoTexto,
    normalizeSelectedUnidades,
  }
}
