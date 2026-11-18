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

            <button
              onClick={exportarCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Exportar Excel</span>
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