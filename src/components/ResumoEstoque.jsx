import React, { useMemo, useState, useEffect, useCallback } from 'react'
import Plot from 'react-plotly.js'
import {
  aplicarLentesIndependentes,
  parseNumber,
  normUnidade,
} from '../hooks/useVisaoGeralData'
import { fmtValorCurto } from '../utils/format'
import { FullScreenPortal } from './FullScreenPortal.jsx'
import { CyberMultiSelect } from './CyberMultiSelect.jsx'

// ============================================================================
// CONSTANTES E HELPERS DE NORMALIZAÇÃO
// ============================================================================

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

const MESES_ORDEM = [
  { num: 1, nome: 'Janeiro', abr: 'JAN' },
  { num: 2, nome: 'Fevereiro', abr: 'FEV' },
  { num: 3, nome: 'Março', abr: 'MAR' },
  { num: 4, nome: 'Abril', abr: 'ABR' },
  { num: 5, nome: 'Maio', abr: 'MAI' },
  { num: 6, nome: 'Junho', abr: 'JUN' },
  { num: 7, nome: 'Julho', abr: 'JUL' },
  { num: 8, nome: 'Agosto', abr: 'AGO' },
  { num: 9, nome: 'Setembro', abr: 'SET' },
  { num: 10, nome: 'Outubro', abr: 'OUT' },
  { num: 11, nome: 'Novembro', abr: 'NOV' },
  { num: 12, nome: 'Dezembro', abr: 'DEZ' },
]

function normalizarNomeUnidadeBase(rawUnidade) {
  let u = normUnidade(rawUnidade)
  if (!u) return 'SEM UNIDADE'

  if (u.includes('NORTE FLU') && u.includes('GERENCIAL')) {
    return 'NORTE FLUMINENSE'
  }

  u = u
    .replace(/\s*-\s*GERENCIAL\b/gi, '')
    .replace(/\s+GERENCIAL\b/gi, '')
    .replace(/\(GERENCIAL\)/gi, '')
    .trim()

  return u || 'SEM UNIDADE'
}

function isUnidadeGerencial(rawUnidade) {
  return normUnidade(rawUnidade).includes('GERENCIAL')
}

function extrairAnoMes(r) {
  const ano = Number(r.tmp_ano_num || r.ano_referencia || 0)
  let mes = Number(r.tmp_mes_num || 0)
  if (!mes && r.mes_referencia != null) {
    const mStr = String(r.mes_referencia).trim().toUpperCase()
    const numDirect = Number(mStr)
    if (!isNaN(numDirect) && numDirect >= 1 && numDirect <= 12) {
      mes = numDirect
    } else {
      const found = MESES_ORDEM.find(
        (m) => m.nome.toUpperCase() === mStr || m.abr === mStr.slice(0, 3)
      )
      if (found) mes = found.num
    }
  }
  return { ano, mes }
}

// Formatação monetária inteira sem casas decimais (ex: R$ 99.449.929)
function fmtBRLInt(val) {
  const num = Math.round(Number(val) || 0)
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

// Formata variação completa com seta, percentual e valor em R$ inteiro
function formatarVariacaoKpi(diffVal, pctVal) {
  const diffArred = Math.round(Number(diffVal) || 0)
  const pct = Number(pctVal) || 0

  const isUp = diffArred > 0
  const isDown = diffArred < 0

  const seta = isUp ? '▲' : isDown ? '▼' : '•'
  const sinalPct = pct > 0 ? '+' : ''
  const pctTexto = `${sinalPct}${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`

  const sinalVal = diffArred > 0 ? '+' : diffArred < 0 ? '-' : ''
  const valAbsFmt = fmtBRLInt(Math.abs(diffArred))

  return {
    seta,
    isUp,
    isDown,
    texto: `${seta} ${pctTexto} (${sinalVal}${valAbsFmt})`,
  }
}

// ============================================================================
// SUBCOMPONENTE DE CARD KPI COM LUZES INDIVIDUAIS E TRAVA DE DESTAQUE
// ============================================================================

function KpiCard({
  id,
  titulo,
  valor,
  diffVal,
  pctVal,
  subtitulo,
  icon,
  cor = '#f58220',
  isLocked = false,
  hasAnyLock = false,
  onToggleLock,
  compacto = false,
}) {
  const varInfo = formatarVariacaoKpi(diffVal, pctVal)
  const [hovered, setHovered] = useState(false)
  const isActive = isLocked || hovered

  return (
    <div
      data-kpi-card="true"
      onClick={() => onToggleLock && onToggleLock(id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: isActive ? cor : '#2A2A2A',
        borderTopColor: isActive ? cor : '#383838',
        boxShadow: isActive
          ? `0 18px 42px ${cor}33, inset 0 1px 0 ${cor}55`
          : '0 10px 30px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
        background: isActive
          ? `linear-gradient(180deg, ${cor}18 0%, #161616 72%)`
          : '#161616',
      }}
      className={`cursor-pointer select-none border rounded-2xl p-4 transition-all duration-300 relative overflow-hidden ${
        isActive ? '-translate-y-0.5' : ''
      } ${hasAnyLock && !isLocked ? 'opacity-45 hover:opacity-95' : 'opacity-100'}`}
    >
      {/* Linha superior iluminada na cor individual do card */}
      <div
        className="absolute top-0 left-1/4 right-1/4 h-[1px] pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isActive ? 0.95 : 0.35,
          background: `linear-gradient(90deg, transparent, ${cor}, transparent)`,
        }}
      />

      {/* Ponto de luz ambiente sutil no canto superior direito */}
      <div
        className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none transition-opacity duration-300"
        style={{
          backgroundColor: cor,
          opacity: isActive ? 0.22 : 0.06,
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-1.5 relative z-10">
        <div className="flex items-center gap-2">
          {icon && (
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-inner border transition-colors"
              style={{
                backgroundColor: `${cor}1f`,
                color: cor,
                borderColor: `${cor}4d`,
              }}
            >
              {icon}
            </div>
          )}
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
              isActive ? 'text-white' : 'text-[#8c9ba5]'
            }`}
          >
            {titulo}
          </span>
        </div>

        {/* Badge de Variação: VERMELHO quando sobe (▲), VERDE quando cai (▼) */}
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-bold font-mono border ${
            varInfo.isUp
              ? 'bg-[#e74c3c]/15 text-[#e74c3c] border-[#e74c3c]/35'
              : varInfo.isDown
              ? 'bg-[#2ecc71]/15 text-[#2ecc71] border-[#2ecc71]/35'
              : 'bg-[#1a1a1a] text-[#8c9ba5] border-[#2A2A2A]'
          }`}
        >
          {varInfo.texto}
        </span>
      </div>

      <div
        className={`mt-3 font-black text-white tracking-tight relative z-10 ${
          compacto ? 'text-lg lg:text-xl' : 'text-xl lg:text-2xl'
        }`}
      >
        {fmtBRLInt(valor)}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#8c9ba5] font-medium relative z-10">
        <span>{subtitulo}</span>
        {isLocked && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
            style={{
              color: cor,
              borderColor: `${cor}55`,
              backgroundColor: `${cor}18`,
            }}
          >
            Em Foco
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ResumoEstoque({ data = [] }) {
  // Estados de Filtro (padrão CyberMultiSelect igual ao VisaoGeral)
  const [anoSel, setAnoSel] = useState('')
  const [mesSel, setMesSel] = useState('')
  const [segmentosSel, setSegmentosSel] = useState([])
  const [regioesSel, setRegioesSel] = useState([])
  const [unidadesSel, setUnidadesSel] = useState([])
  const [buscaTabela, setBuscaTabela] = useState('')

  // Estado de Card Travado para Destaque
  const [lockedCard, setLockedCard] = useState(null)

  // Estado de Tela Cheia da Tabela
  const [tabelaTelaCheia, setTabelaTelaCheia] = useState(false)

  // Ordenação da Tabela
  const [sortCol, setSortCol] = useState('estoqueTotal')
  const [sortDir, setSortDir] = useState('desc')

  const handleToggleLockCard = useCallback((cardId) => {
    setLockedCard((prev) => (prev === cardId ? null : cardId))
  }, [])

  // Destravar card ao clicar fora dos cards ou apertar ESC
  useEffect(() => {
    if (!lockedCard) return
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-kpi-card="true"]')) {
        setLockedCard(null)
      }
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') setLockedCard(null)
    }
    window.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [lockedCard])

  // Fechar FullScreenPortal com ESC
  useEffect(() => {
    if (!tabelaTelaCheia) return
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[data-cyber-open="true"]')) return
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        e.preventDefault()
        active.blur()
        return
      }
      e.preventDefault()
      setTabelaTelaCheia(false)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [tabelaTelaCheia])

  // --------------------------------------------------------------------------
  // 1. PRÉ-PROCESSAMENTO ÚNICO DOS REGISTROS COM AS LENTES OFICIAIS
  // --------------------------------------------------------------------------
  const registrosProcessados = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return []

    return data.map((orig) => {
      const r = { ...orig }
      aplicarLentesIndependentes(r)

      const { ano, mes } = extrairAnoMes(r)
      const rawUnid = normUnidade(r.unidade_almoxarifado)
      const gerencial = isUnidadeGerencial(rawUnid)
      const unidadeBase = normalizarNomeUnidadeBase(rawUnid)
      const segmento = String(r.Segmento ?? r.segmento ?? '').trim() || 'Não Informado'
      const regiao = String(r.Região ?? r.Regiao ?? r.regiao ?? '').trim() || 'Não Informada'

      const saldoVal = parseNumber(r.valor_saldo_atual)

      // Lentes independentes cheias (usadas nos 5 cards de categoria sobre toda a base)
      const isObs = Boolean(r._isObsoleto)
      const isObraRaw = Boolean(r._isObra)
      const isCritRaw = Boolean(r._isCritico)
      const isInsRaw = Boolean(r._isInsumo)
      const isOpRaw = Boolean(r._isOperacional)

      // Classificações deduzidas/líquidas (usadas na tabela por unidade)
      const isObraCritico = !isObs && isObraRaw && isCritRaw
      const isInsumoCritico = !isObs && !isObraCritico && isInsRaw
      const isObraLiquido = !isObs && isObraRaw && !isCritRaw
      const isCriticoLiquido = !isObs && isCritRaw && !isObraRaw && !isInsRaw

      return {
        ano,
        mes,
        unidadeBase,
        gerencial,
        segmento,
        regiao,
        saldoVal,
        isObs,
        isObraRaw,
        isCritRaw,
        isInsRaw,
        isOpRaw,
        isObraCritico,
        isInsumoCritico,
        isObraLiquido,
        isCriticoLiquido,
      }
    })
  }, [data])

  // --------------------------------------------------------------------------
  // 2. OPÇÕES DE FILTROS E SELEÇÃO PADRÃO (ÚLTIMO ANO / ÚLTIMO MÊS DISPONÍVEL)
  // --------------------------------------------------------------------------
  const anosDisponiveis = useMemo(() => {
    const set = new Set()
    registrosProcessados.forEach((r) => {
      if (r.ano > 0) set.add(r.ano)
    })
    return [...set].sort((a, b) => b - a)
  }, [registrosProcessados])

  const mesesDisponiveis = useMemo(() => {
    const anoNum = Number(anoSel)
    const set = new Set()
    registrosProcessados.forEach((r) => {
      if ((!anoNum || r.ano === anoNum) && r.mes >= 1 && r.mes <= 12) {
        set.add(r.mes)
      }
    })
    return [...set]
      .sort((a, b) => a - b)
      .map((m) => MESES_ORDEM.find((x) => x.num === m) || { num: m, nome: String(m), abr: String(m) })
  }, [registrosProcessados, anoSel])

  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anoSel) {
      setAnoSel(String(anosDisponiveis[0]))
    }
  }, [anosDisponiveis, anoSel])

  useEffect(() => {
    if (mesesDisponiveis.length > 0) {
      const existe = mesesDisponiveis.some((m) => String(m.num) === String(mesSel))
      if (!mesSel || !existe) {
        setMesSel(String(mesesDisponiveis[mesesDisponiveis.length - 1].num))
      }
    }
  }, [mesesDisponiveis, mesSel])

  const { segmentosOpcoes, regioesOpcoes, unidadesOpcoes } = useMemo(() => {
    const segSet = new Set()
    const regSet = new Set()
    const uniSet = new Set()

    registrosProcessados.forEach((r) => {
      if (r.segmento) segSet.add(r.segmento)
      if (r.regiao) regSet.add(r.regiao)
      if (r.unidadeBase) uniSet.add(r.unidadeBase)
    })

    return {
      segmentosOpcoes: [...segSet].sort(),
      regioesOpcoes: [...regSet].sort(),
      unidadesOpcoes: [...uniSet].sort(),
    }
  }, [registrosProcessados])

  const handleResetFiltros = useCallback(() => {
    setSegmentosSel([])
    setRegioesSel([])
    setUnidadesSel([])
    setBuscaTabela('')
    setLockedCard(null)
    if (anosDisponiveis.length > 0) {
      setAnoSel(String(anosDisponiveis[0]))
    }
  }, [anosDisponiveis])

  // --------------------------------------------------------------------------
  // 3. CÁLCULO PRINCIPAL: MÊS ATUAL, MÊS ANTERIOR, TABELA POR UNIDADE E SÉRIES
  // --------------------------------------------------------------------------
  const {
    kpis,
    linhasTabela,
    totaisTabela,
    evolucaoMensal,
    top10Pareto,
    periodoLabelAtual,
  } = useMemo(() => {
    const empty = {
      kpis: {
        estoqueAtiva: 0,
        estoqueGerencial: 0,
        estoqueTotal: 0,
        criticoCheio: 0,
        obsoletoCheio: 0,
        obraCheio: 0,
        insumoCheio: 0,
        sparePartsCheio: 0,
        varAtivaDiff: 0,
        varAtivaPct: 0,
        varGerencialDiff: 0,
        varGerencialPct: 0,
        varTotalDiff: 0,
        varTotalPct: 0,
        varCriticoDiff: 0,
        varCriticoPct: 0,
        varObsoletoDiff: 0,
        varObsoletoPct: 0,
        varObraDiff: 0,
        varObraPct: 0,
        varInsumoDiff: 0,
        varInsumoPct: 0,
        varSparePartsDiff: 0,
        varSparePartsPct: 0,
      },
      linhasTabela: [],
      totaisTabela: {
        estoqueAtiva: 0,
        estoqueGerencial: 0,
        estoqueTotal: 0,
        obsoleto: 0,
        critico: 0,
        insumoCritico: 0,
        obraCritico: 0,
        obra: 0,
        spareParts: 0,
      },
      evolucaoMensal: [],
      top10Pareto: [],
      periodoLabelAtual: '—',
    }

    const anoNum = Number(anoSel)
    const mesNum = Number(mesSel)
    if (!anoNum || !mesNum || registrosProcessados.length === 0) return empty

    const prevMes = mesNum === 1 ? 12 : mesNum - 1
    const prevAno = mesNum === 1 ? anoNum - 1 : anoNum

    const setSeg = segmentosSel.length > 0 ? new Set(segmentosSel) : null
    const setReg = regioesSel.length > 0 ? new Set(regioesSel) : null
    const setUni = unidadesSel.length > 0 ? new Set(unidadesSel) : null

    const passDimensoes = (r) => {
      if (setSeg && !setSeg.has(r.segmento)) return false
      if (setReg && !setReg.has(r.regiao)) return false
      if (setUni && !setUni.has(r.unidadeBase)) return false
      return true
    }

    const mapUnidadesAtual = new Map()
    const mapEvolucao = new Map()

    let totAtivaPrev = 0
    let totGerencialPrev = 0
    let totEstoquePrev = 0
    let totCriticoCheioPrev = 0
    let totObsoletoCheioPrev = 0
    let totObraCheioPrev = 0
    let totInsumoCheioPrev = 0
    let totSparePartsCheioPrev = 0

    let totCriticoCheio = 0
    let totObsoletoCheio = 0
    let totObraCheio = 0
    let totInsumoCheio = 0
    let totSparePartsCheio = 0

    for (let i = 0; i < registrosProcessados.length; i++) {
      const r = registrosProcessados[i]
      if (!passDimensoes(r)) continue

      // 1) Série temporal do ano selecionado
      if (r.ano === anoNum && r.mes >= 1 && r.mes <= 12) {
        let ev = mapEvolucao.get(r.mes)
        if (!ev) {
          const infoMes = MESES_ORDEM.find((m) => m.num === r.mes)
          ev = {
            mes: r.mes,
            label: `${infoMes ? infoMes.abr : r.mes}/${String(anoNum).slice(-2)}`,
            estoqueTotal: 0,
            estoqueAtiva: 0,
            estoqueGerencial: 0,
          }
          mapEvolucao.set(r.mes, ev)
        }
        ev.estoqueTotal += r.saldoVal
        if (r.gerencial) ev.estoqueGerencial += r.saldoVal
        else ev.estoqueAtiva += r.saldoVal
      }

      // 2) Mês Anterior (base inteira: Ativa + Gerencial)
      if (r.ano === prevAno && r.mes === prevMes) {
        totEstoquePrev += r.saldoVal
        if (r.gerencial) totGerencialPrev += r.saldoVal
        else totAtivaPrev += r.saldoVal

        if (r.isCritRaw) totCriticoCheioPrev += r.saldoVal
        if (r.isObs) totObsoletoCheioPrev += r.saldoVal
        if (r.isObraRaw) totObraCheioPrev += r.saldoVal
        if (r.isInsRaw) totInsumoCheioPrev += r.saldoVal
        if (r.isOpRaw) totSparePartsCheioPrev += r.saldoVal
      }

      // 3) Mês Atual
      if (r.ano === anoNum && r.mes === mesNum) {
        // Lentes cheias na base inteira (Ativa + Gerencial) para os 5 cards
        if (r.isCritRaw) totCriticoCheio += r.saldoVal
        if (r.isObs) totObsoletoCheio += r.saldoVal
        if (r.isObraRaw) totObraCheio += r.saldoVal
        if (r.isInsRaw) totInsumoCheio += r.saldoVal
        if (r.isOpRaw) totSparePartsCheio += r.saldoVal

        // Detalhamento por unidade na tabela
        let row = mapUnidadesAtual.get(r.unidadeBase)
        if (!row) {
          row = {
            unidade: r.unidadeBase,
            segmento: r.segmento,
            regiao: r.regiao,
            estoqueAtiva: 0,
            estoqueGerencial: 0,
            estoqueTotal: 0,
            obsoleto: 0,
            critico: 0,
            insumoCritico: 0,
            obraCritico: 0,
            obra: 0,
          }
          mapUnidadesAtual.set(r.unidadeBase, row)
        }

        row.estoqueTotal += r.saldoVal

        if (r.gerencial) {
          row.estoqueGerencial += r.saldoVal
        } else {
          row.estoqueAtiva += r.saldoVal

          if (r.isObs) row.obsoleto += r.saldoVal
          else if (r.isObraCritico) row.obraCritico += r.saldoVal
          else if (r.isInsumoCritico) row.insumoCritico += r.saldoVal
          else if (r.isObraLiquido) row.obra += r.saldoVal
          else if (r.isCriticoLiquido) row.critico += r.saldoVal
        }
      }
    }

    const linhas = []
    const totais = {
      estoqueAtiva: 0,
      estoqueGerencial: 0,
      estoqueTotal: 0,
      obsoleto: 0,
      critico: 0,
      insumoCritico: 0,
      obraCritico: 0,
      obra: 0,
      spareParts: 0,
    }

    for (const row of mapUnidadesAtual.values()) {
      const somaEspecial =
        row.obsoleto +
        row.critico +
        row.insumoCritico +
        row.obraCritico +
        row.obra
      const spareParts = Math.max(0, row.estoqueAtiva - somaEspecial)

      const itemFinal = {
        unidade: row.unidade,
        segmento: row.segmento,
        regiao: row.regiao,
        estoqueAtiva: row.estoqueAtiva,
        estoqueGerencial: row.estoqueGerencial,
        estoqueTotal: row.estoqueTotal,
        obsoleto: row.obsoleto,
        critico: row.critico,
        insumoCritico: row.insumoCritico,
        obraCritico: row.obraCritico,
        obra: row.obra,
        spareParts,
      }

      linhas.push(itemFinal)

      totais.estoqueAtiva += itemFinal.estoqueAtiva
      totais.estoqueGerencial += itemFinal.estoqueGerencial
      totais.estoqueTotal += itemFinal.estoqueTotal
      totais.obsoleto += itemFinal.obsoleto
      totais.critico += itemFinal.critico
      totais.insumoCritico += itemFinal.insumoCritico
      totais.obraCritico += itemFinal.obraCritico
      totais.obra += itemFinal.obra
      totais.spareParts += itemFinal.spareParts
    }

    const calcVar = (atual, prev) => {
      const diff = atual - prev
      const pct = prev > 0 ? (diff / prev) * 100 : atual > 0 ? 100 : 0
      return { diff, pct }
    }

    const vAtiva = calcVar(totais.estoqueAtiva, totAtivaPrev)
    const vGerencial = calcVar(totais.estoqueGerencial, totGerencialPrev)
    const vTotal = calcVar(totais.estoqueTotal, totEstoquePrev)
    const vCritico = calcVar(totCriticoCheio, totCriticoCheioPrev)
    const vObsoleto = calcVar(totObsoletoCheio, totObsoletoCheioPrev)
    const vObra = calcVar(totObraCheio, totObraCheioPrev)
    const vInsumo = calcVar(totInsumoCheio, totInsumoCheioPrev)
    const vSpareParts = calcVar(totSparePartsCheio, totSparePartsCheioPrev)

    const evolucaoArr = [...mapEvolucao.values()].sort((a, b) => a.mes - b.mes)

    const top10 = [...linhas]
      .sort((a, b) => b.estoqueTotal - a.estoqueTotal)
      .slice(0, 10)
      .reverse()

    const infoMesAtual = MESES_ORDEM.find((m) => m.num === mesNum)
    const labelPeriodo = `${infoMesAtual ? infoMesAtual.nome : mesNum}/${anoNum}`

    return {
      kpis: {
        estoqueAtiva: totais.estoqueAtiva,
        estoqueGerencial: totais.estoqueGerencial,
        estoqueTotal: totais.estoqueTotal,
        criticoCheio: totCriticoCheio,
        obsoletoCheio: totObsoletoCheio,
        obraCheio: totObraCheio,
        insumoCheio: totInsumoCheio,
        sparePartsCheio: totSparePartsCheio,
        varAtivaDiff: vAtiva.diff,
        varAtivaPct: vAtiva.pct,
        varGerencialDiff: vGerencial.diff,
        varGerencialPct: vGerencial.pct,
        varTotalDiff: vTotal.diff,
        varTotalPct: vTotal.pct,
        varCriticoDiff: vCritico.diff,
        varCriticoPct: vCritico.pct,
        varObsoletoDiff: vObsoleto.diff,
        varObsoletoPct: vObsoleto.pct,
        varObraDiff: vObra.diff,
        varObraPct: vObra.pct,
        varInsumoDiff: vInsumo.diff,
        varInsumoPct: vInsumo.pct,
        varSparePartsDiff: vSpareParts.diff,
        varSparePartsPct: vSpareParts.pct,
      },
      linhasTabela: linhas,
      totaisTabela: totais,
      evolucaoMensal: evolucaoArr,
      top10Pareto: top10,
      periodoLabelAtual: labelPeriodo,
    }
  }, [registrosProcessados, anoSel, mesSel, segmentosSel, regioesSel, unidadesSel])

  // --------------------------------------------------------------------------
  // 4. FILTRO DE BUSCA E ORDENAÇÃO DA TABELA
  // --------------------------------------------------------------------------
  const linhasExibidas = useMemo(() => {
    const q = buscaTabela.trim().toUpperCase()
    const filtradas = q
      ? linhasTabela.filter((l) => l.unidade.includes(q))
      : linhasTabela

    return [...filtradas].sort((a, b) => {
      const va = a[sortCol]
      const vb = b[sortCol]
      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [linhasTabela, buscaTabela, sortCol, sortDir])

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'unidade' ? 'asc' : 'desc')
    }
  }

  // --------------------------------------------------------------------------
  // 5. EXPORTAÇÃO CSV NA SEQUÊNCIA DE COLUNAS
  // --------------------------------------------------------------------------
  const exportarCSV = () => {
    const headers = [
      'Unidade',
      'Estoque Ativa (R$)',
      'Estoque Gerencial (R$)',
      'Estoque Total (R$)',
      'Obsoleto (R$)',
      'Crítico (R$)',
      'Insumo-Crítico (R$)',
      'Obra-Crítico (R$)',
      'Obra (R$)',
      'Spare Parts (R$)',
    ]

    const fmtIntCsv = (n) => String(Math.round(Number(n) || 0))

    const rowsCsv = linhasExibidas.map((r) => [
      `"${r.unidade}"`,
      fmtIntCsv(r.estoqueAtiva),
      fmtIntCsv(r.estoqueGerencial),
      fmtIntCsv(r.estoqueTotal),
      fmtIntCsv(r.obsoleto),
      fmtIntCsv(r.critico),
      fmtIntCsv(r.insumoCritico),
      fmtIntCsv(r.obraCritico),
      fmtIntCsv(r.obra),
      fmtIntCsv(r.spareParts),
    ])

    rowsCsv.push([
      '"TOTAL GERAL"',
      fmtIntCsv(totaisTabela.estoqueAtiva),
      fmtIntCsv(totaisTabela.estoqueGerencial),
      fmtIntCsv(totaisTabela.estoqueTotal),
      fmtIntCsv(totaisTabela.obsoleto),
      fmtIntCsv(totaisTabela.critico),
      fmtIntCsv(totaisTabela.insumoCritico),
      fmtIntCsv(totaisTabela.obraCritico),
      fmtIntCsv(totaisTabela.obra),
      fmtIntCsv(totaisTabela.spareParts),
    ])

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rowsCsv.map((e) => e.join(';'))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Resumo_Estoque_Ambar_${anoSel}_${String(mesSel).padStart(2, '0')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // --------------------------------------------------------------------------
  // 5b. EXPORTAÇÃO PDF EXECUTIVO (mesmo esquema do Painel de Inventários)
  // --------------------------------------------------------------------------
  const exportarPdfResumoEstoque = useCallback(() => {
    if (!linhasExibidas.length) return

    const fmtBRL = (n) =>
      Math.round(Number(n) || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })

    const fmtVar = (diffVal, pctVal) => {
      const diff = Math.round(Number(diffVal) || 0)
      const pct = Number(pctVal) || 0
      const seta = diff > 0 ? '▲' : diff < 0 ? '▼' : '•'
      const sinalPct = pct > 0 ? '+' : ''
      const pctTxt = `${sinalPct}${pct.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`
      const sinalVal = diff > 0 ? '+' : diff < 0 ? '-' : ''
      const valAbs = Math.abs(diff).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      return { texto: `${seta} ${pctTxt} (${sinalVal}${valAbs})`, cor: '#ffffff' }
    }

    const dataGeracao = new Date().toLocaleString('pt-BR')
    const logoSrc = 'data:image/png;base64,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'
    const periodoTitulo = String(periodoLabelAtual || '—')

    const rowHtml = (r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f3f6fb'
      return `
      <tr style="background:${bg};">
        <td class="td-left">${r.unidade}</td>
        <td>${fmtBRL(r.estoqueGerencial)}</td>
        <td>${fmtBRL(r.estoqueAtiva)}</td>
        <td class="td-strong">${fmtBRL(r.estoqueTotal)}</td>
        <td>${fmtBRL(r.obsoleto)}</td>
        <td>${fmtBRL(r.critico)}</td>
        <td>${fmtBRL(r.insumoCritico)}</td>
        <td>${fmtBRL(r.obraCritico)}</td>
        <td>${fmtBRL(r.obra)}</td>
        <td>${fmtBRL(r.spareParts)}</td>
      </tr>`
    }

    const colsHead = `
      <tr class="cols">
        <th>Unidade</th>
        <th>Gerencial</th>
        <th>Estoque</th>
        <th>Total</th>
        <th>Obsoleto</th>
        <th>Crítico</th>
        <th>Insumo-Crítico</th>
        <th>Obra-Crítico</th>
        <th>Obra</th>
        <th>Spare Parts</th>
      </tr>`

    const brandHead = `
      <div class="brand-inner">
        <img src="${logoSrc}" alt="Âmbar Energia" />
        <div>
          <div class="t">Painel de Estoque por Unidade — ${periodoTitulo}</div>
          <div class="s">Âmbar Energia · ${linhasExibidas.length} unidades · Gerado em ${dataGeracao}</div>
        </div>
      </div>`

    const cards = [
      { label: 'Estoque total consolidado', valor: kpis.estoqueTotal, diff: kpis.varTotalDiff, pct: kpis.varTotalPct, cls: 'kpi-c0' },
      { label: 'Estoque ativa', valor: kpis.estoqueAtiva, diff: kpis.varAtivaDiff, pct: kpis.varAtivaPct, cls: 'kpi-c1' },
      { label: 'Estoque gerencial', valor: kpis.estoqueGerencial, diff: kpis.varGerencialDiff, pct: kpis.varGerencialPct, cls: 'kpi-c2' },
      { label: 'Estoque crítico', valor: kpis.criticoCheio, diff: kpis.varCriticoDiff, pct: kpis.varCriticoPct, cls: 'kpi-c3' },
      { label: 'Estoque obsoleto', valor: kpis.obsoletoCheio, diff: kpis.varObsoletoDiff, pct: kpis.varObsoletoPct, cls: 'kpi-c4' },
      { label: 'Estoque obra', valor: kpis.obraCheio, diff: kpis.varObraDiff, pct: kpis.varObraPct, cls: 'kpi-c5' },
      { label: 'Estoque insumo', valor: kpis.insumoCheio, diff: kpis.varInsumoDiff, pct: kpis.varInsumoPct, cls: 'kpi-c6' },
      { label: 'Estoque spare parts', valor: kpis.sparePartsCheio, diff: kpis.varSparePartsDiff, pct: kpis.varSparePartsPct, cls: 'kpi-c7' },
    ]

    const kpisBlock = `
      <div class="kpis">
        ${cards
          .map((c) => {
            const v = fmtVar(c.diff, c.pct)
            return `<div class="kpi ${c.cls}">
              <div class="kpi-top">
                <div class="kpi-label">${c.label}</div>
                <div class="kpi-var">${v.texto}</div>
              </div>
              <div class="kpi-value">${fmtBRL(c.valor)}</div>
            </div>`
          })
          .join('')}
      </div>`

    const totalRow = `
      <tr class="total-row">
        <td>TOTAL</td>
        <td>${fmtBRL(totaisTabela.estoqueGerencial)}</td>
        <td>${fmtBRL(totaisTabela.estoqueAtiva)}</td>
        <td>${fmtBRL(totaisTabela.estoqueTotal)}</td>
        <td>${fmtBRL(totaisTabela.obsoleto)}</td>
        <td>${fmtBRL(totaisTabela.critico)}</td>
        <td>${fmtBRL(totaisTabela.insumoCritico)}</td>
        <td>${fmtBRL(totaisTabela.obraCritico)}</td>
        <td>${fmtBRL(totaisTabela.obra)}</td>
        <td>${fmtBRL(totaisTabela.spareParts)}</td>
      </tr>`

    const PAGE1_SIZE = 20
    const PAGE_SIZE = 24
    const pages = []
    if (linhasExibidas.length <= PAGE1_SIZE) {
      pages.push({ rows: linhasExibidas, showKpis: true, showTotal: true, showCharts: true })
    } else {
      pages.push({ rows: linhasExibidas.slice(0, PAGE1_SIZE), showKpis: true, showTotal: false, showCharts: false })
      let offset = PAGE1_SIZE
      while (offset < linhasExibidas.length) {
        const slice = linhasExibidas.slice(offset, offset + PAGE_SIZE)
        offset += PAGE_SIZE
        const isLast = offset >= linhasExibidas.length
        pages.push({ rows: slice, showKpis: false, showTotal: isLast, showCharts: isLast })
      }
    }

    // --- Gráficos SVG estáticos para o PDF ---
    const fmtCurto = (n) => {
      const v = Math.round(Number(n) || 0)
      if (Math.abs(v) >= 1e9) return `R$ ${(v / 1e9).toFixed(1).replace('.', ',')} bi`
      if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toFixed(1).replace('.', ',')} mi`
      if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} mil`
      return fmtBRL(v)
    }

    const buildEvolucaoSvg = () => {
      const data = Array.isArray(evolucaoMensal) ? evolucaoMensal : []
      if (!data.length) return '<p class="chart-empty">Sem dados de evolução mensal.</p>'

      const W = 520
      const H = 210
      const pad = { l: 52, r: 16, t: 28, b: 36 }
      const innerW = W - pad.l - pad.r
      const innerH = H - pad.t - pad.b
      const maxY = Math.max(...data.map((d) => Math.max(d.estoqueTotal || 0, d.estoqueAtiva || 0)), 1) * 1.12
      const xAt = (i) => pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
      const yAt = (v) => pad.t + innerH - (v / maxY) * innerH

      const pathTotal = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d.estoqueTotal).toFixed(1)}`).join(' ')
      const pathAtiva = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d.estoqueAtiva).toFixed(1)}`).join(' ')
      const areaTotal = `${pathTotal} L${xAt(data.length - 1).toFixed(1)},${(pad.t + innerH).toFixed(1)} L${xAt(0).toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`

      const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.t + innerH * (1 - t)
        const val = maxY * t
        return `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>
          <text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="#64748b">${fmtCurto(val)}</text>`
      }).join('')

      const labels = data.map((d, i) => {
        const x = xAt(i)
        const yT = yAt(d.estoqueTotal)
        const yA = yAt(d.estoqueAtiva)
        return `
          <circle cx="${x.toFixed(1)}" cy="${yT.toFixed(1)}" r="3.5" fill="#fff" stroke="#f58220" stroke-width="2"/>
          <text x="${x.toFixed(1)}" y="${(yT - 8).toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#c2410c">${fmtCurto(d.estoqueTotal)}</text>
          <circle cx="${x.toFixed(1)}" cy="${yA.toFixed(1)}" r="3.5" fill="#fff" stroke="#38bdf8" stroke-width="2"/>
          <text x="${x.toFixed(1)}" y="${(yA + 14).toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#0284c7">${fmtCurto(d.estoqueAtiva)}</text>
          <text x="${x.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="9" font-weight="700" fill="#334155">${d.label}</text>
        `
      }).join('')

      return `
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg">
          ${grid}
          <path d="${areaTotal}" fill="rgba(245,130,32,0.12)"/>
          <path d="${pathTotal}" fill="none" stroke="#f58220" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="${pathAtiva}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linejoin="round"/>
          ${labels}
          <g font-size="9" font-weight="700">
            <rect x="${pad.l}" y="4" width="10" height="3" fill="#f58220" rx="1"/>
            <text x="${pad.l + 14}" y="8" fill="#0f172a">Estoque Total</text>
            <rect x="${pad.l + 110}" y="4" width="10" height="3" fill="#38bdf8" rx="1"/>
            <text x="${pad.l + 124}" y="8" fill="#0f172a">Estoque Ativa</text>
          </g>
        </svg>`
    }

    const buildTop10Svg = () => {
      const data = Array.isArray(top10Pareto) ? [...top10Pareto].reverse() : []
      if (!data.length) return '<p class="chart-empty">Sem dados de ranking.</p>'

      const W = 520
      const rowH = 16
      const pad = { l: 118, r: 90, t: 8, b: 8 }
      const H = pad.t + pad.b + data.length * rowH
      const innerW = W - pad.l - pad.r
      const maxX = Math.max(...data.map((d) => d.estoqueTotal || 0), 1)
      const totalRef = kpis.estoqueTotal > 0 ? kpis.estoqueTotal : maxX

      const bars = data.map((d, i) => {
        const y = pad.t + i * rowH
        const w = Math.max(2, (d.estoqueTotal / maxX) * innerW)
        const pct = totalRef > 0 ? ((d.estoqueTotal / totalRef) * 100).toFixed(1).replace('.', ',') : '0,0'
        return `
          <text x="${pad.l - 6}" y="${y + 11}" text-anchor="end" font-size="8.5" fill="#334155">${d.unidade}</text>
          <rect x="${pad.l}" y="${y + 3}" width="${w.toFixed(1)}" height="10" rx="2" fill="#f58220"/>
          <text x="${(pad.l + w + 4).toFixed(1)}" y="${y + 11}" font-size="8" fill="#0f172a">${fmtCurto(d.estoqueTotal)} <tspan fill="#c2410c" font-weight="700">[${pct}%]</tspan></text>
        `
      }).join('')

      return `
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg">
          ${bars}
        </svg>`
    }

    const anoChart = (() => {
      const m = String(periodoTitulo).match(/(\d{4})/)
      return m ? m[1] : ''
    })()

    const chartsBlockFinal = `
      <div class="charts">
        <div class="chart-box">
          <div class="chart-title">Evolução Mensal do Estoque (${anoChart || '—'})</div>
          ${buildEvolucaoSvg()}
        </div>
        <div class="chart-box">
          <div class="chart-title">Top 10 Unidades por Estoque Total (${periodoTitulo})</div>
          ${buildTop10Svg()}
        </div>
      </div>`

    const pagesHtml = pages
      .map((p, pageIdx) => {
        const bodyRows = p.rows.map((r, i) => rowHtml(r, i)).join('')
        return `
      <section class="sheet${pageIdx < pages.length - 1 ? ' sheet-break' : ''}">
        ${brandHead}
        ${p.showKpis ? kpisBlock : ''}
        <table class="main">
          <thead>${colsHead}</thead>
          <tbody>
            ${bodyRows}
            ${p.showTotal ? totalRow : ''}
          </tbody>
        </table>
        ${p.showCharts ? chartsBlockFinal : ''}
        ${p.showTotal ? '<div class="footer-note">Âmbar Energia — Painel de Estoque por Unidade</div>' : ''}
      </section>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Painel de Estoque por Unidade — ${periodoTitulo}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 11mm 9mm 13mm 9mm;
      @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
        font-family: Inter, Arial, sans-serif;
        font-size: 9px;
        color: #64748b;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet-break { page-break-after: always; break-after: page; }
    .brand-inner {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 9px;
      padding-bottom: 7px;
      border-bottom: 2px solid #e2e8f0;
    }
    .brand-inner img { height: 38px; width: auto; display: block; }
    .brand-inner .t {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .brand-inner .s {
      margin: 2px 0 0;
      font-size: 10px;
      font-weight: 500;
      color: #64748b;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    .kpi {
      padding: 8px 10px 9px;
      color: #fff;
      border-radius: 6px;
      min-height: 58px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .kpi-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 4px;
    }
    .kpi-label { font-size: 9px; font-weight: 700; opacity: 0.95; text-transform: uppercase; letter-spacing: 0.03em; }
    .kpi-var {
      font-size: 8px;
      font-weight: 700;
      font-family: ui-monospace, monospace;
      white-space: nowrap;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.12);
      color: #ffffff;
    }
    .kpi-value { font-size: 14px; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
    .kpi-c0 { background: #0f2744; }
    .kpi-c1 { background: #1d4ed8; }
    .kpi-c2 { background: #0e7490; }
    .kpi-c3 { background: #c2410c; }
    .kpi-c4 { background: #b91c1c; }
    .kpi-c5 { background: #6d28d9; }
    .kpi-c6 { background: #0f766e; }
    .kpi-c7 { background: #15803d; }
    table.main {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      border: 1px solid #94a3b8;
    }
    thead th {
      background: #0f2744;
      color: #ffffff;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.02em;
      padding: 6px 5px;
      text-align: right;
      border-right: 1px solid #1e3a5f;
    }
    thead th:first-child { text-align: left; }
    thead th:last-child { border-right: none; }
    td {
      padding: 4px 5px;
      text-align: right;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      font-variant-numeric: tabular-nums;
      color: #0f172a;
    }
    td:last-child { border-right: none; }
    .td-left { text-align: left; font-weight: 600; }
    .td-strong { font-weight: 800; }
    tr.total-row td {
      background: #0f2744;
      color: #ffffff;
      font-weight: 800;
      padding: 6px 5px;
      border-top: 2px solid #0f2744;
      border-right: 1px solid #1e3a5f;
      text-align: right;
    }
    tr.total-row td:first-child { text-align: left; letter-spacing: 0.04em; }
    tr.total-row td:last-child { border-right: none; }
    .footer-note {
      margin-top: 8px;
      font-size: 9px;
      color: #64748b;
    }
    .charts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 12px;
    }
    .chart-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 10px 6px;
      background: #f8fafc;
    }
    .chart-title {
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    .chart-empty {
      font-size: 10px;
      color: #64748b;
      text-align: center;
      padding: 24px 0;
    }
    @media print {
      body { background: #fff; }
      .sheet-break { page-break-after: always; break-after: page; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 250);
    };
  </script>
</body>
</html>`

    const openPdf = () => {
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const win = window.open(url, '_blank')
        if (win) {
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
          return true
        }
        URL.revokeObjectURL(url)
      } catch (_) { /* continua */ }

      try {
        const iframe = document.createElement('iframe')
        iframe.setAttribute('title', 'Exportar PDF Estoque')
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
        document.body.appendChild(iframe)
        const doc = iframe.contentWindow?.document
        if (!doc) {
          document.body.removeChild(iframe)
          return false
        }
        doc.open()
        doc.write(html)
        doc.close()
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } finally {
            setTimeout(() => {
              if (iframe.parentNode) document.body.removeChild(iframe)
            }, 1000)
          }
        }, 400)
        return true
      } catch (_) {
        return false
      }
    }

    if (!openPdf()) {
      alert('Não foi possível abrir o PDF. Permita pop-ups para este site e tente novamente.')
    }
  }, [linhasExibidas, totaisTabela, kpis, periodoLabelAtual, evolucaoMensal, top10Pareto])

  // --------------------------------------------------------------------------
  // CONFIGURAÇÃO DA TABELA
  // --------------------------------------------------------------------------
  const colunas = [
    { key: 'unidade', label: 'Unidade', align: 'left', sticky: true },
    { key: 'estoqueAtiva', label: 'Estoque Ativa (R$)', align: 'right' },
    { key: 'estoqueGerencial', label: 'Estoque Gerencial (R$)', align: 'right' },
    { key: 'estoqueTotal', label: 'Estoque Total (R$)', align: 'right', isTotalCol: true },
    { key: 'obsoleto', label: 'Obsoleto (R$)', align: 'right' },
    { key: 'critico', label: 'Crítico (R$)', align: 'right' },
    { key: 'insumoCritico', label: 'Insumo-Crítico (R$)', align: 'right' },
    { key: 'obraCritico', label: 'Obra-Crítico (R$)', align: 'right' },
    { key: 'obra', label: 'Obra (R$)', align: 'right' },
    { key: 'spareParts', label: 'Spare Parts (R$)', align: 'right' },
  ]

  const renderTabela = () => (
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 z-20 bg-[#121212] text-[10px] uppercase tracking-[0.14em] text-[#8c9ba5]">
        <tr>
          {colunas.map((col) => (
            <th
              key={col.key}
              onClick={() => handleSort(col.key)}
              className={`cursor-pointer select-none whitespace-nowrap border-b border-[#2A2A2A] px-3.5 py-3 font-bold transition hover:text-[#f58220] ${
                col.align === 'right' ? 'text-right' : 'text-left'
              } ${
                col.sticky
                  ? 'sticky left-0 z-30 bg-[#121212] shadow-[2px_0_6px_rgba(0,0,0,0.6)]'
                  : ''
              } ${
                col.isTotalCol
                  ? 'bg-[#26160c] text-[#f58220]'
                  : 'text-[#c5d0db]'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                {col.label}
                {sortCol === col.key && (
                  <span className="text-[#f58220]">
                    {sortDir === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </span>
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-[#222222]">
        {linhasExibidas.length === 0 ? (
          <tr>
            <td
              colSpan={colunas.length}
              className="py-10 text-center text-sm text-[#8c9ba5]"
            >
              Nenhum dado encontrado para os filtros selecionados.
            </td>
          </tr>
        ) : (
          linhasExibidas.map((row) => (
            <tr
              key={row.unidade}
              className="transition-colors hover:bg-[#1e1e1e]"
            >
              <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0c0c0c] px-3.5 py-2.5 font-semibold text-white shadow-[2px_0_6px_rgba(0,0,0,0.6)]">
                {row.unidade}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtBRLInt(row.estoqueAtiva)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtBRLInt(row.estoqueGerencial)}
              </td>
              <td className="whitespace-nowrap bg-[#f58220]/10 px-3.5 py-2.5 text-right font-mono font-bold text-[#f58220]">
                {fmtBRLInt(row.estoqueTotal)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtBRLInt(row.obsoleto)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtBRLInt(row.critico)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtBRLInt(row.insumoCritico)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtBRLInt(row.obraCritico)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtBRLInt(row.obra)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtBRLInt(row.spareParts)}
              </td>
            </tr>
          ))
        )}
      </tbody>

      {/* LINHA DE TOTAL GERAL FIXA NO RODAPÉ EM TOM LARANJA */}
      {linhasExibidas.length > 0 && (
        <tfoot className="sticky bottom-0 z-20 bg-[#26160c] font-bold text-white shadow-[0_-2px_10px_rgba(0,0,0,0.75)]">
          <tr>
            <td className="sticky left-0 z-30 whitespace-nowrap border-t-2 border-[#f58220] bg-[#26160c] px-3.5 py-3 text-left tracking-wider text-[#f58220]">
              TOTAL GERAL
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtBRLInt(totaisTabela.estoqueAtiva)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtBRLInt(totaisTabela.estoqueGerencial)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] bg-[#361e0f] px-3.5 py-3 text-right font-mono text-[#ff9638]">
              {fmtBRLInt(totaisTabela.estoqueTotal)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtBRLInt(totaisTabela.obsoleto)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtBRLInt(totaisTabela.critico)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtBRLInt(totaisTabela.insumoCritico)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtBRLInt(totaisTabela.obraCritico)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtBRLInt(totaisTabela.obra)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtBRLInt(totaisTabela.spareParts)}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )

  const calcShare = (parte) =>
    kpis.estoqueTotal > 0
      ? `${((parte / kpis.estoqueTotal) * 100).toFixed(1)}% do estoque total`
      : '0,0% do estoque total'

  // Dados e ticks dinâmicos para os gráficos Plotly
  const { maxEvolucao, ticksY, ticksYText } = useMemo(() => {
    const maxVal = Math.max(...evolucaoMensal.map((d) => d.estoqueTotal), 10)
    const teto = Math.ceil(maxVal / 200000000) * 200000000 || 800000000
    const step = teto / 4
    const vals = [0, step, step * 2, step * 3, teto]
    const texts = vals.map((v) =>
      v === 0 ? 'R$ 0,00' : `R$ ${(v / 1000000).toFixed(1).replace('.', ',')}M`
    )
    return { maxEvolucao: teto, ticksY: vals, ticksYText: texts }
  }, [evolucaoMensal])

  const maxPareto = useMemo(
    () => Math.max(...top10Pareto.map((d) => d.estoqueTotal), 1),
    [top10Pareto]
  )

  const mesAtivoAbrev = useMemo(() => {
    const info = MESES_ORDEM.find((m) => m.num === Number(mesSel))
    return info ? `${info.abr}/${String(anoSel).slice(-2)}` : ''
  }, [mesSel, anoSel])

  return (
    <div className="space-y-6 animate-fade-in bg-[#080808] min-h-screen p-2 sm:p-4 text-white relative">
      {/* Sobrescreve o cursor de mira/cruz do Plotly para mãozinha (pointer) nos dois gráficos */}
      <style>{`
        .resumo-plotly-pointer .nsewdrag,
        .resumo-plotly-pointer .drag,
        .resumo-plotly-pointer .cursor-crosshair,
        .resumo-plotly-pointer svg {
          cursor: pointer !important;
        }
      `}</style>

      {/* --- CABEÇALHO GLOBAL --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2 mt-2 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2a1610] border border-[#f58220]/30 flex items-center justify-center text-[#f58220] shadow-inner shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-black text-white tracking-wider uppercase drop-shadow-sm">
              RESUMO EXECUTIVO DE ESTOQUE — {periodoLabelAtual.toUpperCase()}
            </h1>
            <span className="text-[10px] text-accent tracking-widest uppercase font-bold">
              Consolidação Ativa vs. Gerencial e Abertura Operacional por Unidade
            </span>
          </div>
        </div>

        <button
          onClick={handleResetFiltros}
          className="group relative flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#f58220]/20 to-transparent hover:from-[#f58220]/30 border border-[#f58220]/30 hover:border-[#f58220] transition-all duration-300 overflow-hidden shadow-[0_0_10px_rgba(245,130,32,0.1)] hover:shadow-[0_0_20px_rgba(245,130,32,0.3)] whitespace-nowrap self-start lg:self-auto"
        >
          <div className="absolute inset-0 bg-[#f58220]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          <svg
            className="w-3.5 h-3.5 text-[#f58220] relative z-10 group-hover:-rotate-180 transition-transform duration-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white relative z-10">
            Restaurar Padrão
          </span>
        </button>
      </div>

      {/* --- PAINEL DE FILTROS --- */}
      <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] relative transition-all duration-300 hover:border-accent/50">
        <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="shrink-0">
            <div className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase mb-0.5">
              Painel Gerencial Âmbar Energia
            </div>
            <div className="text-xs text-[#8c9ba5] font-medium">
              Filtros de Competência e Dimensões Corporativas (clique em qualquer card para destacar)
            </div>
          </div>

          <div className="flex flex-row flex-wrap items-end justify-start xl:justify-end gap-3 z-30">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">
                Ano
              </label>
              <select
                value={anoSel}
                onChange={(e) => setAnoSel(e.target.value)}
                className="bg-[#0c0c0c] border border-[#2A2A2A] hover:border-accent/50 focus:border-accent rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none transition-colors"
              >
                {anosDisponiveis.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">
                Mês Referência
              </label>
              <select
                value={mesSel}
                onChange={(e) => setMesSel(e.target.value)}
                className="bg-[#0c0c0c] border border-[#2A2A2A] hover:border-accent/50 focus:border-accent rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none transition-colors"
              >
                {mesesDisponiveis.map((m) => (
                  <option key={m.num} value={m.num}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[140px]">
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">
                Segmento
              </label>
              <CyberMultiSelect
                options={segmentosOpcoes}
                selected={segmentosSel}
                onChange={setSegmentosSel}
                placeholder={
                  segmentosSel.length === 0 || segmentosSel.length === segmentosOpcoes.length
                    ? 'Todos'
                    : segmentosSel.length === 1
                    ? segmentosSel[0]
                    : `${segmentosSel.length} Sel.`
                }
              />
            </div>

            <div className="min-w-[140px]">
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">
                Região
              </label>
              <CyberMultiSelect
                options={regioesOpcoes}
                selected={regioesSel}
                onChange={setRegioesSel}
                placeholder={
                  regioesSel.length === 0 || regioesSel.length === regioesOpcoes.length
                    ? 'Todas'
                    : regioesSel.length === 1
                    ? regioesSel[0]
                    : `${regioesSel.length} Sel.`
                }
              />
            </div>

            <div className="min-w-[175px]">
              <label className="text-[10px] font-bold tracking-widest text-[#8c9ba5] uppercase mb-1 block">
                Usina / Unidade
              </label>
              <CyberMultiSelect
                options={unidadesOpcoes}
                selected={unidadesSel}
                onChange={setUnidadesSel}
                placeholder={
                  unidadesSel.length === 0 || unidadesSel.length === unidadesOpcoes.length
                    ? `Todas (${unidadesOpcoes.length})`
                    : unidadesSel.length === 1
                    ? unidadesSel[0]
                    : `${unidadesSel.length} Selecionadas`
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- FILEIRA 1: ESTOQUE TOTAL CONSOLIDADO | ESTOQUE ATIVA | ESTOQUE GERENCIAL --- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          id="total"
          titulo="Estoque Total Consolidado"
          valor={kpis.estoqueTotal}
          diffVal={kpis.varTotalDiff}
          pctVal={kpis.varTotalPct}
          subtitulo={`Consolidado Ativa + Gerencial (${linhasTabela.length} unidades)`}
          cor="#f58220"
          isLocked={lockedCard === 'total'}
          hasAnyLock={Boolean(lockedCard)}
          onToggleLock={handleToggleLockCard}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <KpiCard
          id="ativa"
          titulo="Estoque Ativa"
          valor={kpis.estoqueAtiva}
          diffVal={kpis.varAtivaDiff}
          pctVal={kpis.varAtivaPct}
          subtitulo={calcShare(kpis.estoqueAtiva)}
          cor="#38bdf8"
          isLocked={lockedCard === 'ativa'}
          hasAnyLock={Boolean(lockedCard)}
          onToggleLock={handleToggleLockCard}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <KpiCard
          id="gerencial"
          titulo="Estoque Gerencial"
          valor={kpis.estoqueGerencial}
          diffVal={kpis.varGerencialDiff}
          pctVal={kpis.varGerencialPct}
          subtitulo={calcShare(kpis.estoqueGerencial)}
          cor="#6366f1"
          isLocked={lockedCard === 'gerencial'}
          hasAnyLock={Boolean(lockedCard)}
          onToggleLock={handleToggleLockCard}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      {/* --- FILEIRA 2: 5 CARDS DAS CATEGORIAS COM LUZES PRÓPRIAS --- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          id="critico"
          titulo="Estoque Crítico"
          valor={kpis.criticoCheio}
          diffVal={kpis.varCriticoDiff}
          pctVal={kpis.varCriticoPct}
          subtitulo={calcShare(kpis.criticoCheio)}
          cor="#e74c3c"
          isLocked={lockedCard === 'critico'}
          hasAnyLock={Boolean(lockedCard)}
          onToggleLock={handleToggleLockCard}
          compacto
        />
        <KpiCard
          id="obsoleto"
          titulo="Estoque Obsoleto"
          valor={kpis.obsoletoCheio}
          diffVal={kpis.varObsoletoDiff}
          pctVal={kpis.varObsoletoPct}
          subtitulo={calcShare(kpis.obsoletoCheio)}
          cor="#9b59b6"
          isLocked={lockedCard === 'obsoleto'}
          hasAnyLock={Boolean(lockedCard)}
          onToggleLock={handleToggleLockCard}
          compacto
        />
        <KpiCard
          id="obra"
          titulo="Estoque Obra"
          valor={kpis.obraCheio}
          diffVal={kpis.varObraDiff}
          pctVal={kpis.varObraPct}
          subtitulo={calcShare(kpis.obraCheio)}
          cor="#1abc9c"
          isLocked={lockedCard === 'obra'}
          hasAnyLock={Boolean(lockedCard)}
          onToggleLock={handleToggleLockCard}
          compacto
        />
        <KpiCard
          id="insumo"
          titulo="Estoque Insumo"
          valor={kpis.insumoCheio}
          diffVal={kpis.varInsumoDiff}
          pctVal={kpis.varInsumoPct}
          subtitulo={calcShare(kpis.insumoCheio)}
          cor="#f1c40f"
          isLocked={lockedCard === 'insumo'}
          hasAnyLock={Boolean(lockedCard)}
          onToggleLock={handleToggleLockCard}
          compacto
        />
        <KpiCard
          id="spareParts"
          titulo="Estoque Spare Parts"
          valor={kpis.sparePartsCheio}
          diffVal={kpis.varSparePartsDiff}
          pctVal={kpis.varSparePartsPct}
          subtitulo={calcShare(kpis.sparePartsCheio)}
          cor="#3498db"
          isLocked={lockedCard === 'spareParts'}
          hasAnyLock={Boolean(lockedCard)}
          onToggleLock={handleToggleLockCard}
          compacto
        />
      </div>

      {/* --- TABELA DETALHAMENTO MENSAL POR UNIDADE --- */}
      <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden relative transition-all duration-300 hover:border-accent/50">
        <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />

        <div className="flex flex-col gap-3 border-b border-[#2A2A2A] p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#262014] flex items-center justify-center text-accent shadow-inner shrink-0 border border-[#f58220]/30">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                Detalhamento Mensal por Unidade — {periodoLabelAtual.toUpperCase()} ({linhasExibidas.length} unidades)
              </h3>
              <p className="text-[11px] text-[#8c9ba5] mt-0.5">
                Clique nos cabeçalhos para ordenar. Obra-Crítico e Insumo-Crítico já deduzidos do Crítico e Obra.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <svg
                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c9ba5]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={buscaTabela}
                onChange={(e) => setBuscaTabela(e.target.value)}
                placeholder="Filtrar unidade..."
                className="rounded-lg border border-[#2A2A2A] bg-[#080808] pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8c9ba5] focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <button
              onClick={exportarCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={exportarPdfResumoEstoque}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Exportar PDF</span>
            </button>

            <button
              onClick={() => setTabelaTelaCheia(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1a1a] hover:bg-[#3a2020] text-[#f58220] border border-[#f58220]/40 text-xs font-bold transition-all shadow-sm group"
            >
              <svg
                className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>Expandir Tabela</span>
            </button>
          </div>
        </div>

        <div className="max-h-[540px] overflow-auto custom-scrollbar overscroll-contain bg-[#0c0c0c]">
          {renderTabela()}
        </div>
      </div>

      {/* --- MODAL TELA CHEIA (FULLSCREENPORTAL) --- */}
      {tabelaTelaCheia && (
        <FullScreenPortal onClose={() => setTabelaTelaCheia(false)}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col backdrop-blur-sm animate-fade-in">
            <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shrink-0 shadow-xl">
              <div className="flex items-center gap-3">
                <svg
                  className="w-6 h-6 text-accent drop-shadow-[0_0_10px_rgba(245,130,32,0.8)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                  Detalhamento Mensal por Unidade — {periodoLabelAtual.toUpperCase()} (Tela Cheia)
                </h2>
                <span className="text-xs bg-accent/15 text-accent px-2.5 py-1 rounded-md font-mono border border-accent/30 font-bold shadow-inner">
                  {linhasExibidas.length} unidades
                </span>
              </div>

              <div className="flex gap-3 items-center">
                <button
                  onClick={exportarCSV}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Baixar Base Excel</span>
                </button>

                <button
                  onClick={exportarPdfResumoEstoque}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Exportar PDF</span>
                </button>

                <button
                  onClick={() => setTabelaTelaCheia(false)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Fechar Janela</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 px-6 py-3 bg-[#161616] border-b border-[#2A2A2A] shrink-0">
              <div className="w-full sm:w-72">
                <CyberMultiSelect
                  options={unidadesOpcoes}
                  selected={unidadesSel}
                  onChange={setUnidadesSel}
                  placeholder="Filtrar por Unidades"
                />
              </div>
              <div className="flex-1 relative">
                <svg
                  className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c9ba5]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar unidade pelo nome..."
                  value={buscaTabela}
                  onChange={(e) => setBuscaTabela(e.target.value)}
                  className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-accent text-xs transition-colors"
                />
              </div>
            </div>

            <div className="flex-grow overflow-hidden p-4 sm:p-6 bg-[#080808]">
              <div className="border border-[#2A2A2A] rounded-xl bg-[#0c0c0c] overflow-auto custom-scrollbar shadow-2xl h-full">
                {renderTabela()}
              </div>
            </div>
          </div>
        </FullScreenPortal>
      )}

      {/* --- GRÁFICOS INFERIORES NO PADRÃO PLOTLY DO VISÃO GERAL --- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 resumo-plotly-pointer">
        {/* GRÁFICO 1: EVOLUÇÃO MENSAL (DUAS LINHAS: TOTAL + ATIVA, SEM CAIXINHAS FIXAS, TOOLTIP UNIFICADO) */}
        <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] relative overflow-hidden transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]">
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#262014] flex items-center justify-center text-accent shadow-inner shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">
              Evolução Mensal do Estoque ({anoSel})
            </span>
          </div>

          {evolucaoMensal.length > 0 ? (
            <Plot
              data={[
                {
                  name: 'Estoque Total',
                  x: evolucaoMensal.map((d) => d.label),
                  y: evolucaoMensal.map((d) => d.estoqueTotal),
                  type: 'scatter',
                  mode: 'lines+markers',
                  line: { color: '#f58220', width: 2.8, shape: 'spline', smoothing: 1.2 },
                  marker: {
                    size: evolucaoMensal.map((d) => (d.label === mesAtivoAbrev ? 9 : 5)),
                    color: '#080808',
                    line: { color: '#f58220', width: 2.2 },
                  },
                  fill: 'tozeroy',
                  fillgradient: {
                    type: 'vertical',
                    colorscale: [
                      ['0', 'rgba(245,130,32,0.32)'],
                      ['1', 'rgba(245,130,32,0.02)'],
                    ],
                  },
                  fillcolor: 'rgba(245,130,32,0.14)',
                  customdata: evolucaoMensal.map((d) => fmtBRLInt(d.estoqueTotal)),
                  hovertemplate:
                    '<span style="color:#f58220; font-weight:700;">Estoque Total : %{customdata}</span><extra></extra>',
                  cliponaxis: false,
                },
                {
                  name: 'Estoque Ativa',
                  x: evolucaoMensal.map((d) => d.label),
                  y: evolucaoMensal.map((d) => d.estoqueAtiva),
                  type: 'scatter',
                  mode: 'lines+markers',
                  line: { color: '#38bdf8', width: 2.5, shape: 'spline', smoothing: 1.2 },
                  marker: {
                    size: evolucaoMensal.map((d) => (d.label === mesAtivoAbrev ? 9 : 5)),
                    color: '#080808',
                    line: { color: '#38bdf8', width: 2.2 },
                  },
                  customdata: evolucaoMensal.map((d) => fmtBRLInt(d.estoqueAtiva)),
                  hovertemplate:
                    '<span style="color:#38bdf8; font-weight:700;">Estoque Ativa : %{customdata}</span><extra></extra>',
                  cliponaxis: false,
                },
              ]}
              layout={{
                ...PLOT_LAYOUT,
                height: 295,
                margin: { l: 68, r: 18, t: 18, b: 58 },
                showlegend: true,
                legend: {
                  orientation: 'h',
                  x: 0.5,
                  xanchor: 'center',
                  y: -0.22,
                  font: { size: 11, color: '#cbd5e1', family: 'Inter' },
                  bgcolor: 'rgba(0,0,0,0)',
                },
                hovermode: 'x unified',
                hoverlabel: {
                  bgcolor: 'rgba(18, 22, 28, 0.96)',
                  bordercolor: '#334155',
                  font: { color: '#ffffff', size: 12, family: 'Inter' },
                },
                xaxis: {
                  type: 'category',
                  showgrid: true,
                  gridcolor: 'rgba(255,255,255,0.06)',
                  griddash: 'dot',
                  zeroline: false,
                  linecolor: '#2A2A2A',
                  tickmode: 'array',
                  tickvals: evolucaoMensal.map((d) => d.label),
                  ticktext: evolucaoMensal.map((d) =>
                    d.label === mesAtivoAbrev
                      ? `<span style="color: #f58220; font-weight: 900;">• ${d.label} •</span>`
                      : d.label
                  ),
                  tickpad: 8,
                  automargin: true,
                  spikemode: 'across',
                  spikesnap: 'cursor',
                  spikecolor: '#94a3b8',
                  spikethickness: 1,
                  spikedash: 'solid',
                },
                yaxis: {
                  showgrid: true,
                  gridcolor: 'rgba(255,255,255,0.06)',
                  griddash: 'dot',
                  zeroline: false,
                  linecolor: '#2A2A2A',
                  tickmode: 'array',
                  tickvals: ticksY,
                  ticktext: ticksYText,
                  tickfont: { size: 10, color: '#8c9ba5', family: 'Inter' },
                  range: [0, maxEvolucao * 1.05],
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', minHeight: 270 }}
              useResizeHandler
            />
          ) : (
            <p className="text-[#8c9ba5] text-sm text-center py-12">Sem dados para o ano selecionado.</p>
          )}
        </div>

        {/* GRÁFICO 2: TOP 10 UNIDADES POR ESTOQUE TOTAL (SEM CAIXINHA AO PASSAR O MOUSE) */}
        <div className="bg-[#161616] border border-[#2A2A2A] border-t-[#383838] rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.85)] relative overflow-hidden transition-all duration-300 hover:border-accent/50 hover:shadow-[0_15px_35px_rgba(245,130,32,0.18)]">
          <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] opacity-30 bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#262014] flex items-center justify-center text-accent shadow-inner shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8c9ba5] uppercase">
              Top 10 Unidades por Estoque Total ({periodoLabelAtual})
            </span>
          </div>

          {top10Pareto.length > 0 ? (
            <Plot
              data={[
                {
                  type: 'bar',
                  orientation: 'h',
                  y: top10Pareto.map((d) => d.unidade),
                  x: top10Pareto.map((d) => d.estoqueTotal),
                  cliponaxis: false,
                  textposition: 'outside',
                  text: top10Pareto.map((d) => {
                    const pct =
                      kpis.estoqueTotal > 0
                        ? ((d.estoqueTotal / kpis.estoqueTotal) * 100).toFixed(1)
                        : '0.0'
                    return `<span style="color:#ffffff;">${fmtValorCurto(d.estoqueTotal)}</span> <span style="color:#f58220; font-weight:800;">[ ${pct}% ]</span>`
                  }),
                  textfont: { size: 10, family: 'Inter', weight: 600 },
                  marker: {
                    color: '#f58220',
                    line: { color: '#080808', width: 1 },
                  },
                  hoverinfo: 'none',
                },
              ]}
              layout={{
                ...PLOT_LAYOUT,
                hovermode: false,
                bargap: 0.38,
                height: 295,
                margin: { l: 115, r: 95, t: 10, b: 10 },
                xaxis: {
                  showgrid: false,
                  showticklabels: false,
                  zeroline: false,
                  range: [0, maxPareto * 1.35],
                },
                yaxis: {
                  showgrid: true,
                  gridcolor: '#2A2A2A',
                  tickmode: 'array',
                  tickvals: top10Pareto.map((d) => d.unidade),
                  ticktext: top10Pareto.map(
                    (d) => `<span style="color:#d1d8df;">${d.unidade}&nbsp;&nbsp;</span>`
                  ),
                  ticklen: 0,
                  tickpad: 8,
                  automargin: true,
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', minHeight: 270 }}
              useResizeHandler
            />
          ) : (
            <p className="text-[#8c9ba5] text-sm text-center py-12">Sem dados para o período selecionado.</p>
          )}
        </div>
      </div>
    </div>
  )
}