import React, { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts'
import {
  aplicarLentesIndependentes,
  parseNumber,
  normUnidade,
} from '../hooks/useVisaoGeralData'
import { fmtValorCurto } from '../utils/format'

// ============================================================================
// CONSTANTES E HELPERS DE NORMALIZAÇÃO (FIÉIS AO SCRIPT PYTHON)
// ============================================================================

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
// SUBCOMPONENTE DE CARD KPI REUTILIZÁVEL
// ============================================================================

function KpiCard({ titulo, valor, diffVal, pctVal, subtitulo, destaque = false, compacto = false }) {
  const varInfo = formatarVariacaoKpi(diffVal, pctVal)

  return (
    <div
      className={`rounded-xl border bg-[#0D0F12] p-4 shadow-md transition ${
        destaque ? 'border-[#CC5500]/60' : 'border-slate-800'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            destaque ? 'text-[#ff7b29]' : 'text-slate-400'
          }`}
        >
          {titulo}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            varInfo.isUp
              ? 'bg-amber-500/15 text-amber-400'
              : varInfo.isDown
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {varInfo.texto}
        </span>
      </div>
      <div
        className={`mt-2.5 font-bold text-white ${
          compacto ? 'text-xl' : 'text-2xl'
        }`}
      >
        {fmtBRLInt(valor)}
      </div>
      <div className="mt-1 text-xs text-slate-400">{subtitulo}</div>
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ResumoEstoque({ data = [] }) {
  // Estados de Filtro
  const [anoSel, setAnoSel] = useState('')
  const [mesSel, setMesSel] = useState('')
  const [segmentoSel, setSegmentoSel] = useState('TODOS')
  const [regiaoSel, setRegiaoSel] = useState('TODAS')
  const [unidadeSel, setUnidadeSel] = useState('TODAS')
  const [buscaTabela, setBuscaTabela] = useState('')

  // Estado de Tela Cheia da Tabela
  const [tabelaTelaCheia, setTabelaTelaCheia] = useState(false)

  // Ordenação da Tabela
  const [sortCol, setSortCol] = useState('estoqueTotal')
  const [sortDir, setSortDir] = useState('desc')

  // Tecla ESC sai da tela cheia e trava scroll do body enquanto expandida
  useEffect(() => {
    if (!tabelaTelaCheia) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setTabelaTelaCheia(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
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
        // Flags cheias
        isObs,
        isObraRaw,
        isCritRaw,
        isInsRaw,
        isOpRaw,
        // Flags líquidas da tabela
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
        critico: 0,
        obsoleto: 0,
        obra: 0,
        obraCritico: 0,
        insumoCritico: 0,
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

    const passDimensoes = (r) => {
      if (segmentoSel !== 'TODOS' && r.segmento !== segmentoSel) return false
      if (regiaoSel !== 'TODAS' && r.regiao !== regiaoSel) return false
      if (unidadeSel !== 'TODAS' && r.unidadeBase !== unidadeSel) return false
      return true
    }

    const mapUnidadesAtual = new Map()
    const mapEvolucao = new Map()

    // Acumuladores do mês anterior (Ativa, Gerencial, Total + 5 lentes cheias na base inteira)
    let totAtivaPrev = 0
    let totGerencialPrev = 0
    let totEstoquePrev = 0
    let totCriticoCheioPrev = 0
    let totObsoletoCheioPrev = 0
    let totObraCheioPrev = 0
    let totInsumoCheioPrev = 0
    let totSparePartsCheioPrev = 0

    // Acumuladores do mês atual para os 5 cards (lentes cheias na base inteira: Ativa + Gerencial)
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
            critico: 0,
            obsoleto: 0,
            obra: 0,
            obraCritico: 0,
            insumoCritico: 0,
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
      critico: 0,
      obsoleto: 0,
      obra: 0,
      obraCritico: 0,
      insumoCritico: 0,
      spareParts: 0,
    }

    for (const row of mapUnidadesAtual.values()) {
      const somaEspecial =
        row.critico +
        row.obsoleto +
        row.obra +
        row.obraCritico +
        row.insumoCritico
      const spareParts = Math.max(0, row.estoqueAtiva - somaEspecial)

      const itemFinal = {
        unidade: row.unidade,
        segmento: row.segmento,
        regiao: row.regiao,
        estoqueAtiva: row.estoqueAtiva,
        estoqueGerencial: row.estoqueGerencial,
        estoqueTotal: row.estoqueTotal,
        critico: row.critico,
        obsoleto: row.obsoleto,
        obra: row.obra,
        obraCritico: row.obraCritico,
        insumoCritico: row.insumoCritico,
        spareParts,
      }

      linhas.push(itemFinal)

      totais.estoqueAtiva += itemFinal.estoqueAtiva
      totais.estoqueGerencial += itemFinal.estoqueGerencial
      totais.estoqueTotal += itemFinal.estoqueTotal
      totais.critico += itemFinal.critico
      totais.obsoleto += itemFinal.obsoleto
      totais.obra += itemFinal.obra
      totais.obraCritico += itemFinal.obraCritico
      totais.insumoCritico += itemFinal.insumoCritico
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
      .map((u) => ({
        unidade: u.unidade,
        estoqueTotal: Math.round(u.estoqueTotal),
        criticoTotal: Math.round(u.critico + u.obraCritico + u.insumoCritico),
      }))

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
  }, [registrosProcessados, anoSel, mesSel, segmentoSel, regiaoSel, unidadeSel])

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
  // 5. EXPORTAÇÃO CSV (VALORES INTEIROS SEM CENTAVOS)
  // --------------------------------------------------------------------------
  const exportarCSV = () => {
    const headers = [
      'Unidade',
      'Estoque Ativa (R$)',
      'Estoque Gerencial (R$)',
      'Estoque Total (R$)',
      'Crítico (R$)',
      'Obsoleto (R$)',
      'Obra (R$)',
      'Obra-Crítico (R$)',
      'Insumo-Crítico (R$)',
      'Spare Parts (R$)',
    ]

    const fmtIntCsv = (n) => String(Math.round(Number(n) || 0))

    const rowsCsv = linhasExibidas.map((r) => [
      `"${r.unidade}"`,
      fmtIntCsv(r.estoqueAtiva),
      fmtIntCsv(r.estoqueGerencial),
      fmtIntCsv(r.estoqueTotal),
      fmtIntCsv(r.critico),
      fmtIntCsv(r.obsoleto),
      fmtIntCsv(r.obra),
      fmtIntCsv(r.obraCritico),
      fmtIntCsv(r.insumoCritico),
      fmtIntCsv(r.spareParts),
    ])

    rowsCsv.push([
      '"TOTAL GERAL"',
      fmtIntCsv(totaisTabela.estoqueAtiva),
      fmtIntCsv(totaisTabela.estoqueGerencial),
      fmtIntCsv(totaisTabela.estoqueTotal),
      fmtIntCsv(totaisTabela.critico),
      fmtIntCsv(totaisTabela.obsoleto),
      fmtIntCsv(totaisTabela.obra),
      fmtIntCsv(totaisTabela.obraCritico),
      fmtIntCsv(totaisTabela.insumoCritico),
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
  // BLOCO DA TABELA (RENDERIZADO NORMALMENTE OU VIA PORTAL EM TELA CHEIA REAL)
  // --------------------------------------------------------------------------
  const colunas = [
    { key: 'unidade', label: 'Unidade', align: 'left', sticky: true },
    { key: 'estoqueAtiva', label: '(R$) Estoque Ativa', align: 'right' },
    { key: 'estoqueGerencial', label: '(R$) Estoque Gerencial', align: 'right' },
    { key: 'estoqueTotal', label: '(R$) Estoque Total', align: 'right', isTotalCol: true },
    { key: 'critico', label: '(R$) Crítico', align: 'right' },
    { key: 'obsoleto', label: '(R$) Obsoleto', align: 'right' },
    { key: 'obra', label: '(R$) Obra', align: 'right' },
    { key: 'obraCritico', label: '(R$) Obra-Crítico', align: 'right' },
    { key: 'insumoCritico', label: '(R$) Insumo-Crítico', align: 'right' },
    { key: 'spareParts', label: '(R$) Spare Parts', align: 'right' },
  ]

  const conteudoTabela = (
    <div
      className={
        tabelaTelaCheia
          ? 'fixed inset-0 z-[9999] flex h-screen w-screen flex-col bg-[#080808] p-3 sm:p-5'
          : 'rounded-xl border border-slate-800 bg-[#0D0F12] shadow-lg'
      }
    >
      {/* CABEÇALHO DA TABELA */}
      <div
        className={`flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between ${
          tabelaTelaCheia ? 'rounded-t-xl border-x border-t bg-[#0D0F12]' : ''
        }`}
      >
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Detalhamento Mensal por Unidade — {periodoLabelAtual.toUpperCase()} ({linhasExibidas.length} unidades)
          </h3>
          <p className="text-xs text-slate-400">
            Clique nos cabeçalhos para ordenar. Obra-Crítico e Insumo-Crítico já deduzidos do Crítico e Obra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={buscaTabela}
            onChange={(e) => setBuscaTabela(e.target.value)}
            placeholder="Filtrar unidade..."
            className="rounded-lg border border-slate-700 bg-[#14171C] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#CC5500] focus:outline-none"
          />

          <button
            onClick={() => setTabelaTelaCheia((prev) => !prev)}
            title={tabelaTelaCheia ? 'Sair da tela cheia (ESC)' : 'Expandir tabela em tela cheia'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#14171C] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[#CC5500] hover:text-white"
          >
            {tabelaTelaCheia ? (
              <>
                <svg className="h-3.5 w-3.5 text-[#ff7b29]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
                Recolher Tela
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 text-[#ff7b29]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                Expandir Tabela
              </>
            )}
          </button>

          <button
            onClick={exportarCSV}
            className="rounded-lg bg-[#CC5500] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#e05e00]"
          >
            Exportar Excel (CSV)
          </button>
        </div>
      </div>

      {/* CORPO COM SCROLL */}
      <div
        className={
          tabelaTelaCheia
            ? 'flex-1 overflow-auto rounded-b-xl border-x border-b border-slate-800 bg-[#0D0F12]'
            : 'max-h-[540px] overflow-auto'
        }
      >
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-20 bg-[#14171C] text-[11px] uppercase tracking-wider text-slate-300">
            <tr>
              {colunas.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap border-b border-slate-800 px-3 py-2.5 font-semibold transition hover:text-[#ff7b29] ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${
                    col.sticky
                      ? 'sticky left-0 z-30 bg-[#14171C] shadow-[2px_0_5px_rgba(0,0,0,0.4)]'
                      : ''
                  } ${
                    col.isTotalCol
                      ? 'bg-[#261409] text-[#ff7b29]'
                      : 'text-slate-200'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortCol === col.key && (
                      <span className="text-[#ff7b29]">
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/70">
            {linhasExibidas.length === 0 ? (
              <tr>
                <td
                  colSpan={colunas.length}
                  className="py-8 text-center text-sm text-slate-400"
                >
                  Nenhum dado encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              linhasExibidas.map((row) => (
                <tr
                  key={row.unidade}
                  className="transition-colors hover:bg-slate-800/40"
                >
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0D0F12] px-3 py-2 font-semibold text-white shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                    {row.unidade}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-white">
                    {fmtBRLInt(row.estoqueAtiva)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-white">
                    {fmtBRLInt(row.estoqueGerencial)}
                  </td>
                  <td className="whitespace-nowrap bg-[#CC5500]/10 px-3 py-2 text-right font-mono font-bold text-[#ff7b29]">
                    {fmtBRLInt(row.estoqueTotal)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-white">
                    {fmtBRLInt(row.critico)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-white">
                    {fmtBRLInt(row.obsoleto)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-white">
                    {fmtBRLInt(row.obra)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-white">
                    {fmtBRLInt(row.obraCritico)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-white">
                    {fmtBRLInt(row.insumoCritico)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-white">
                    {fmtBRLInt(row.spareParts)}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* LINHA DE TOTAL GERAL FIXA NO RODAPÉ EM TOM LARANJA */}
          {linhasExibidas.length > 0 && (
            <tfoot className="sticky bottom-0 z-20 bg-[#261409] font-bold text-white shadow-[0_-2px_8px_rgba(0,0,0,0.65)]">
              <tr>
                <td className="sticky left-0 z-30 whitespace-nowrap border-t-2 border-[#CC5500] bg-[#261409] px-3 py-2.5 text-left text-[#ff7b29]">
                  TOTAL GERAL
                </td>
                <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-orange-100">
                  {fmtBRLInt(totaisTabela.estoqueAtiva)}
                </td>
                <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-orange-100">
                  {fmtBRLInt(totaisTabela.estoqueGerencial)}
                </td>
                <td className="whitespace-nowrap border-t-2 border-[#CC5500] bg-[#361b0b] px-3 py-2.5 text-right font-mono text-[#ff8c42]">
                  {fmtBRLInt(totaisTabela.estoqueTotal)}
                </td>
                <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-orange-100">
                  {fmtBRLInt(totaisTabela.critico)}
                </td>
                <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-orange-100">
                  {fmtBRLInt(totaisTabela.obsoleto)}
                </td>
                <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-orange-100">
                  {fmtBRLInt(totaisTabela.obra)}
                </td>
                <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-orange-100">
                  {fmtBRLInt(totaisTabela.obraCritico)}
                </td>
                <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-orange-100">
                  {fmtBRLInt(totaisTabela.insumoCritico)}
                </td>
                <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-orange-100">
                  {fmtBRLInt(totaisTabela.spareParts)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )

  const calcShare = (parte) =>
    kpis.estoqueTotal > 0 ? `${((parte / kpis.estoqueTotal) * 100).toFixed(1)}% do estoque total` : '0,0% do estoque total'

  return (
    <div className="space-y-5 pb-8 text-slate-100">
      {/* CABEÇALHO E BARRA DE FILTROS */}
      <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-4 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#CC5500]" />
              <h2 className="text-lg font-bold tracking-wide text-white">
                RESUMO EXECUTIVO DE ESTOQUE — {periodoLabelAtual.toUpperCase()}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Consolidação Ativa vs. Gerencial e abertura por categoria operacional (Crítico, Obsoleto, Obra, Insumo e Spare Parts)
            </p>
          </div>

          {/* FILTROS */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex flex-col">
              <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Ano
              </label>
              <select
                value={anoSel}
                onChange={(e) => setAnoSel(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#14171C] px-3 py-1.5 text-xs font-medium text-white focus:border-[#CC5500] focus:outline-none"
              >
                {anosDisponiveis.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Mês Referência
              </label>
              <select
                value={mesSel}
                onChange={(e) => setMesSel(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#14171C] px-3 py-1.5 text-xs font-medium text-white focus:border-[#CC5500] focus:outline-none"
              >
                {mesesDisponiveis.map((m) => (
                  <option key={m.num} value={m.num}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Segmento
              </label>
              <select
                value={segmentoSel}
                onChange={(e) => setSegmentoSel(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#14171C] px-3 py-1.5 text-xs font-medium text-white focus:border-[#CC5500] focus:outline-none"
              >
                <option value="TODOS">Todos os Segmentos</option>
                {segmentosOpcoes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Região
              </label>
              <select
                value={regiaoSel}
                onChange={(e) => setRegiaoSel(e.target.value)}
                className="rounded-lg border border-slate-700 bg-[#14171C] px-3 py-1.5 text-xs font-medium text-white focus:border-[#CC5500] focus:outline-none"
              >
                <option value="TODAS">Todas as Regiões</option>
                {regioesOpcoes.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Unidade
              </label>
              <select
                value={unidadeSel}
                onChange={(e) => setUnidadeSel(e.target.value)}
                className="max-w-[200px] rounded-lg border border-slate-700 bg-[#14171C] px-3 py-1.5 text-xs font-medium text-white focus:border-[#CC5500] focus:outline-none"
              >
                <option value="TODAS">Todas ({unidadesOpcoes.length})</option>
                {unidadesOpcoes.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* FILEIRA 1: 3 CARDS PRINCIPAIS (ATIVA, GERENCIAL, TOTAL) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          titulo="Estoque Ativa"
          valor={kpis.estoqueAtiva}
          diffVal={kpis.varAtivaDiff}
          pctVal={kpis.varAtivaPct}
          subtitulo={calcShare(kpis.estoqueAtiva)}
        />
        <KpiCard
          titulo="Estoque Gerencial"
          valor={kpis.estoqueGerencial}
          diffVal={kpis.varGerencialDiff}
          pctVal={kpis.varGerencialPct}
          subtitulo={calcShare(kpis.estoqueGerencial)}
        />
        <KpiCard
          titulo="Estoque Total Consolidado"
          valor={kpis.estoqueTotal}
          diffVal={kpis.varTotalDiff}
          pctVal={kpis.varTotalPct}
          subtitulo={`Consolidado Ativa + Gerencial (${linhasTabela.length} unidades)`}
          destaque
        />
      </div>

      {/* FILEIRA 2: 5 CARDS DAS CATEGORIAS (LENTES CHEIAS NA BASE INTEIRA) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          titulo="Estoque Crítico"
          valor={kpis.criticoCheio}
          diffVal={kpis.varCriticoDiff}
          pctVal={kpis.varCriticoPct}
          subtitulo={calcShare(kpis.criticoCheio)}
          compacto
        />
        <KpiCard
          titulo="Estoque Obsoleto"
          valor={kpis.obsoletoCheio}
          diffVal={kpis.varObsoletoDiff}
          pctVal={kpis.varObsoletoPct}
          subtitulo={calcShare(kpis.obsoletoCheio)}
          compacto
        />
        <KpiCard
          titulo="Estoque Obra"
          valor={kpis.obraCheio}
          diffVal={kpis.varObraDiff}
          pctVal={kpis.varObraPct}
          subtitulo={calcShare(kpis.obraCheio)}
          compacto
        />
        <KpiCard
          titulo="Estoque Insumo"
          valor={kpis.insumoCheio}
          diffVal={kpis.varInsumoDiff}
          pctVal={kpis.varInsumoPct}
          subtitulo={calcShare(kpis.insumoCheio)}
          compacto
        />
        <KpiCard
          titulo="Spare Parts"
          valor={kpis.sparePartsCheio}
          diffVal={kpis.varSparePartsDiff}
          pctVal={kpis.varSparePartsPct}
          subtitulo={calcShare(kpis.sparePartsCheio)}
          compacto
        />
      </div>

      {/* TABELA DETALHAMENTO MENSAL POR UNIDADE (PORTAL QUANDO EM TELA CHEIA) */}
      {tabelaTelaCheia ? createPortal(conteudoTabela, document.body) : conteudoTabela}

      {/* GRÁFICOS INFERIORES COMPACTOS (EVOLUÇÃO MENSAL + PARETO TOP 10) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* GRÁFICO 1: EVOLUÇÃO MENSAL NO ANO */}
        <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-4 shadow-md">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-200">
            Evolução Mensal do Estoque ({anoSel})
          </h4>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={evolucaoMensal}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradEstoqueTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CC5500" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#CC5500" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v) => fmtValorCurto(v)}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#14171C',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => fmtBRLInt(value)}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area
                  type="monotone"
                  dataKey="estoqueTotal"
                  name="Estoque Total"
                  stroke="#CC5500"
                  strokeWidth={2.5}
                  fill="url(#gradEstoqueTotal)"
                />
                <Area
                  type="monotone"
                  dataKey="estoqueAtiva"
                  name="Estoque Ativa"
                  stroke="#38bdf8"
                  strokeWidth={1.8}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 2: TOP 10 UNIDADES (ESTOQUE TOTAL VS CRÍTICO) */}
        <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-4 shadow-md">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-200">
            Top 10 Unidades por Valor de Estoque ({periodoLabelAtual})
          </h4>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10Pareto}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => fmtValorCurto(v)}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="unidade"
                  width={125}
                  tick={{ fill: '#cbd5e1', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#14171C',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => fmtBRLInt(value)}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="estoqueTotal"
                  name="Estoque Total"
                  fill="#CC5500"
                  radius={[0, 4, 4, 0]}
                >
                  {top10Pareto.map((_, idx) => (
                    <Cell key={idx} fill={idx === 0 ? '#ff6600' : '#CC5500'} />
                  ))}
                </Bar>
                <Bar
                  dataKey="criticoTotal"
                  name="Parcela Crítica"
                  fill="#f43f5e"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}