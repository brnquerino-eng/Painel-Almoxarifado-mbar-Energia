import React, { useMemo, useState, useEffect } from 'react'
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
  MAPA_ABR_MESES,
} from '../hooks/useVisaoGeralData'
import { fmtBRL, fmtInt, fmtValorCurto } from '../utils/format'

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

  // Trata caso especial Norte Fluminense Gerencial -> NORTE FLUMINENSE
  if (u.includes('NORTE FLU') && u.includes('GERENCIAL')) {
    return 'NORTE FLUMINENSE'
  }

  // Remove sufixos gerenciais para consolidar na mesma linha da unidade ativa
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

function fmtPctVar(val) {
  if (val == null || !isFinite(val)) return '0,0%'
  const sinal = val > 0 ? '+' : ''
  return `${sinal}${val.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
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

  // Ordenação da Tabela
  const [sortCol, setSortCol] = useState('estoqueTotal')
  const [sortDir, setSortDir] = useState('desc')

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
      const entradaVal = parseNumber(r.valor_entrada_compras)
      const saidaVal = Math.abs(parseNumber(r.valor_saida_cons_interno))
      const saldoQtd = parseNumber(r.qtde_saldo_atual)

      // Classificações cruzadas idênticas ao painel Python
      const isObs = Boolean(r._isObsoleto)
      const isObraRaw = Boolean(r._isObra)
      const isCritRaw = Boolean(r._isCritico)
      const isInsRaw = Boolean(r._isInsumo)

      // Obra-Crítico: interseção entre Obra e Crítico (fora de Obsoleto)
      const isObraCritico = !isObs && isObraRaw && isCritRaw
      // Insumo-Crítico: Insumo (fora de Obsoleto e Obra-Crítico)
      const isInsumoCritico = !isObs && !isObraCritico && isInsRaw
      // Obra líquida (descontando Obra-Crítico)
      const isObraLiquido = !isObs && isObraRaw && !isCritRaw
      // Crítico líquido (descontando Obra-Crítico e Insumo-Crítico)
      const isCriticoLiquido = !isObs && isCritRaw && !isObraRaw && !isInsRaw

      return {
        ano,
        mes,
        rawUnid,
        unidadeBase,
        gerencial,
        segmento,
        regiao,
        codigoProduto: String(r.codigo_produto ?? '').trim(),
        saldoVal,
        entradaVal,
        saidaVal,
        saldoQtd,
        isObs,
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
        entradaMes: 0,
        saidaMes: 0,
        varEstoquePct: 0,
        varAtivaPct: 0,
        varGerencialPct: 0,
        skusTotal: 0,
      },
      linhasTabela: [],
      totaisTabela: {
        estoqueAtiva: 0,
        estoqueGerencial: 0,
        estoqueTotal: 0,
        entradaMes: 0,
        saidaMes: 0,
        varEstoquePct: 0,
        critico: 0,
        obsoleto: 0,
        obra: 0,
        obraCritico: 0,
        insumoCritico: 0,
        spareParts: 0,
        skus: 0,
      },
      evolucaoMensal: [],
      top10Pareto: [],
      periodoLabelAtual: '—',
    }

    const anoNum = Number(anoSel)
    const mesNum = Number(mesSel)
    if (!anoNum || !mesNum || registrosProcessados.length === 0) return empty

    // Mês imediatamente anterior (trata virada Jan -> Dez ano anterior)
    const prevMes = mesNum === 1 ? 12 : mesNum - 1
    const prevAno = mesNum === 1 ? anoNum - 1 : anoNum

    // Filtro dimensional (Segmento, Região, Unidade)
    const passDimensoes = (r) => {
      if (segmentoSel !== 'TODOS' && r.segmento !== segmentoSel) return false
      if (regiaoSel !== 'TODAS' && r.regiao !== regiaoSel) return false
      if (unidadeSel !== 'TODAS' && r.unidadeBase !== unidadeSel) return false
      return true
    }

    const mapUnidadesAtual = new Map()
    const mapUnidadesPrev = new Map()
    const mapEvolucao = new Map()
    const skusGlobalAtual = new Set()

    let totAtivaPrev = 0
    let totGerencialPrev = 0
    let totEstoquePrev = 0

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
            entrada: 0,
            saida: 0,
          }
          mapEvolucao.set(r.mes, ev)
        }
        ev.estoqueTotal += r.saldoVal
        if (r.gerencial) ev.estoqueGerencial += r.saldoVal
        else ev.estoqueAtiva += r.saldoVal
        ev.entrada += r.entradaVal
        ev.saida += r.saidaVal
      }

      // 2) Mês Anterior (para Var. Estoque %)
      if (r.ano === prevAno && r.mes === prevMes) {
        totEstoquePrev += r.saldoVal
        if (r.gerencial) totGerencialPrev += r.saldoVal
        else totAtivaPrev += r.saldoVal

        const prevU = mapUnidadesPrev.get(r.unidadeBase) || 0
        mapUnidadesPrev.set(r.unidadeBase, prevU + r.saldoVal)
      }

      // 3) Mês Atual (Snapshot + Fluxos)
      if (r.ano === anoNum && r.mes === mesNum) {
        let row = mapUnidadesAtual.get(r.unidadeBase)
        if (!row) {
          row = {
            unidade: r.unidadeBase,
            segmento: r.segmento,
            regiao: r.regiao,
            estoqueAtiva: 0,
            estoqueGerencial: 0,
            estoqueTotal: 0,
            entradaMes: 0,
            saidaMes: 0,
            critico: 0,
            obsoleto: 0,
            obra: 0,
            obraCritico: 0,
            insumoCritico: 0,
            skusSet: new Set(),
          }
          mapUnidadesAtual.set(r.unidadeBase, row)
        }

        row.estoqueTotal += r.saldoVal
        row.entradaMes += r.entradaVal
        row.saidaMes += r.saidaVal

        if (r.gerencial) {
          row.estoqueGerencial += r.saldoVal
        } else {
          row.estoqueAtiva += r.saldoVal

          // Categorias aplicadas sobre o estoque operacional/ativo (igual ao Python)
          if (r.isObs) row.obsoleto += r.saldoVal
          else if (r.isObraCritico) row.obraCritico += r.saldoVal
          else if (r.isInsumoCritico) row.insumoCritico += r.saldoVal
          else if (r.isObraLiquido) row.obra += r.saldoVal
          else if (r.isCriticoLiquido) row.critico += r.saldoVal
        }

        if (r.saldoQtd > 0 && r.codigoProduto) {
          row.skusSet.add(r.codigoProduto)
          skusGlobalAtual.add(`${r.unidadeBase}||${r.codigoProduto}`)
        }
      }
    }

    // Consolida linhas da tabela
    const linhas = []
    const totais = {
      estoqueAtiva: 0,
      estoqueGerencial: 0,
      estoqueTotal: 0,
      entradaMes: 0,
      saidaMes: 0,
      varEstoquePct: 0,
      critico: 0,
      obsoleto: 0,
      obra: 0,
      obraCritico: 0,
      insumoCritico: 0,
      spareParts: 0,
      skus: 0,
    }

    for (const row of mapUnidadesAtual.values()) {
      const prevVal = mapUnidadesPrev.get(row.unidade) || 0
      const varPct =
        prevVal > 0
          ? ((row.estoqueTotal - prevVal) / prevVal) * 100
          : row.estoqueTotal > 0
          ? 100
          : 0

      // Spare Parts = Estoque Ativa - (Crítico + Obsoleto + Obra + Obra-Crítico + Insumo-Crítico)
      const somaEspecial =
        row.critico +
        row.obsoleto +
        row.obra +
        row.obraCritico +
        row.insumoCritico
      const spareParts = Math.max(0, row.estoqueAtiva - somaEspecial)
      const skusCount = row.skusSet.size

      const itemFinal = {
        unidade: row.unidade,
        segmento: row.segmento,
        regiao: row.regiao,
        estoqueAtiva: row.estoqueAtiva,
        estoqueGerencial: row.estoqueGerencial,
        estoqueTotal: row.estoqueTotal,
        entradaMes: row.entradaMes,
        saidaMes: row.saidaMes,
        varEstoquePct: varPct,
        critico: row.critico,
        obsoleto: row.obsoleto,
        obra: row.obra,
        obraCritico: row.obraCritico,
        insumoCritico: row.insumoCritico,
        spareParts,
        skus: skusCount,
      }

      linhas.push(itemFinal)

      totais.estoqueAtiva += itemFinal.estoqueAtiva
      totais.estoqueGerencial += itemFinal.estoqueGerencial
      totais.estoqueTotal += itemFinal.estoqueTotal
      totais.entradaMes += itemFinal.entradaMes
      totais.saidaMes += itemFinal.saidaMes
      totais.critico += itemFinal.critico
      totais.obsoleto += itemFinal.obsoleto
      totais.obra += itemFinal.obra
      totais.obraCritico += itemFinal.obraCritico
      totais.insumoCritico += itemFinal.insumoCritico
      totais.spareParts += itemFinal.spareParts
      totais.skus += itemFinal.skus
    }

    totais.varEstoquePct =
      totEstoquePrev > 0
        ? ((totais.estoqueTotal - totEstoquePrev) / totEstoquePrev) * 100
        : 0

    const varAtivaPct =
      totAtivaPrev > 0
        ? ((totais.estoqueAtiva - totAtivaPrev) / totAtivaPrev) * 100
        : 0

    const varGerencialPct =
      totGerencialPrev > 0
        ? ((totais.estoqueGerencial - totGerencialPrev) / totGerencialPrev) * 100
        : 0

    // Evolução mensal ordenada
    const evolucaoArr = [...mapEvolucao.values()].sort((a, b) => a.mes - b.mes)

    // Top 10 Pareto (Estoque Total vs Crítico)
    const top10 = [...linhas]
      .sort((a, b) => b.estoqueTotal - a.estoqueTotal)
      .slice(0, 10)
      .map((u) => ({
        unidade: u.unidade,
        estoqueTotal: u.estoqueTotal,
        criticoTotal: u.critico + u.obraCritico + u.insumoCritico,
        spareParts: u.spareParts,
      }))

    const infoMesAtual = MESES_ORDEM.find((m) => m.num === mesNum)
    const labelPeriodo = `${infoMesAtual ? infoMesAtual.nome : mesNum}/${anoNum}`

    return {
      kpis: {
        estoqueAtiva: totais.estoqueAtiva,
        estoqueGerencial: totais.estoqueGerencial,
        estoqueTotal: totais.estoqueTotal,
        entradaMes: totais.entradaMes,
        saidaMes: totais.saidaMes,
        varEstoquePct: totais.varEstoquePct,
        varAtivaPct,
        varGerencialPct,
        skusTotal: skusGlobalAtual.size,
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
  // 5. EXPORTAÇÃO CSV (COMPATÍVEL COM EXCEL PT-BR)
  // --------------------------------------------------------------------------
  const exportarCSV = () => {
    const headers = [
      'Unidade',
      'Estoque Ativa (R$)',
      'Estoque Gerencial (R$)',
      'Estoque Total (R$)',
      'Entrada Mês (R$)',
      'Saída Mês (R$)',
      'Var. Estoque (%)',
      'Crítico (R$)',
      'Obsoleto (R$)',
      'Obra (R$)',
      'Obra-Crítico (R$)',
      'Insumo-Crítico (R$)',
      'Spare Parts (R$)',
      'SKUs Ativos',
    ]

    const fmtNumCsv = (n) => Number(n || 0).toFixed(2).replace('.', ',')

    const rowsCsv = linhasExibidas.map((r) => [
      `"${r.unidade}"`,
      fmtNumCsv(r.estoqueAtiva),
      fmtNumCsv(r.estoqueGerencial),
      fmtNumCsv(r.estoqueTotal),
      fmtNumCsv(r.entradaMes),
      fmtNumCsv(r.saidaMes),
      fmtNumCsv(r.varEstoquePct),
      fmtNumCsv(r.critico),
      fmtNumCsv(r.obsoleto),
      fmtNumCsv(r.obra),
      fmtNumCsv(r.obraCritico),
      fmtNumCsv(r.insumoCritico),
      fmtNumCsv(r.spareParts),
      r.skus,
    ])

    rowsCsv.push([
      '"TOTAL GERAL"',
      fmtNumCsv(totaisTabela.estoqueAtiva),
      fmtNumCsv(totaisTabela.estoqueGerencial),
      fmtNumCsv(totaisTabela.estoqueTotal),
      fmtNumCsv(totaisTabela.entradaMes),
      fmtNumCsv(totaisTabela.saidaMes),
      fmtNumCsv(totaisTabela.varEstoquePct),
      fmtNumCsv(totaisTabela.critico),
      fmtNumCsv(totaisTabela.obsoleto),
      fmtNumCsv(totaisTabela.obra),
      fmtNumCsv(totaisTabela.obraCritico),
      fmtNumCsv(totaisTabela.insumoCritico),
      fmtNumCsv(totaisTabela.spareParts),
      totaisTabela.skus,
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
  // RENDERIZAÇÃO
  // --------------------------------------------------------------------------
  const colunas = [
    { key: 'unidade', label: 'Unidade', align: 'left', sticky: true },
    { key: 'estoqueAtiva', label: '(R$) Estoque Ativa', align: 'right' },
    { key: 'estoqueGerencial', label: '(R$) Estoque Gerencial', align: 'right' },
    { key: 'estoqueTotal', label: '(R$) Estoque Total', align: 'right', highlight: true },
    { key: 'entradaMes', label: '(R$) Entrada (Mês)', align: 'right' },
    { key: 'saidaMes', label: '(R$) Saída (Mês)', align: 'right' },
    { key: 'varEstoquePct', label: 'Var. Estoque (%)', align: 'right' },
    { key: 'critico', label: '(R$) Crítico', align: 'right' },
    { key: 'obsoleto', label: '(R$) Obsoleto', align: 'right' },
    { key: 'obra', label: '(R$) Obra', align: 'right' },
    { key: 'obraCritico', label: '(R$) Obra-Crítico', align: 'right' },
    { key: 'insumoCritico', label: '(R$) Insumo-Crítico', align: 'right' },
    { key: 'spareParts', label: '(R$) Spare Parts', align: 'right' },
    { key: 'skus', label: 'SKUs', align: 'right' },
  ]

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

      {/* 4 CARDS DE KPI EXECUTIVOS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: ESTOQUE ATIVA */}
        <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Estoque Ativa
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                kpis.varAtivaPct > 0
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {fmtPctVar(kpis.varAtivaPct)} vs mês ant.
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {fmtBRL(kpis.estoqueAtiva)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {kpis.estoqueTotal > 0
              ? `${((kpis.estoqueAtiva / kpis.estoqueTotal) * 100).toFixed(1)}% do estoque total`
              : '0,0% do estoque total'}
          </div>
        </div>

        {/* KPI 2: ESTOQUE GERENCIAL */}
        <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Estoque Gerencial
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                kpis.varGerencialPct > 0
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {fmtPctVar(kpis.varGerencialPct)} vs mês ant.
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {fmtBRL(kpis.estoqueGerencial)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {kpis.estoqueTotal > 0
              ? `${((kpis.estoqueGerencial / kpis.estoqueTotal) * 100).toFixed(1)}% do estoque total`
              : '0,0% do estoque total'}
          </div>
        </div>

        {/* KPI 3: ESTOQUE TOTAL */}
        <div className="rounded-xl border border-[#CC5500]/40 bg-[#0D0F12] p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#ff7b29]">
              Estoque Total Consolidado
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                kpis.varEstoquePct > 0
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {fmtPctVar(kpis.varEstoquePct)}
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {fmtBRL(kpis.estoqueTotal)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {fmtInt(kpis.skusTotal)} SKUs ativos com saldo positivo
          </div>
        </div>

        {/* KPI 4: MOVIMENTAÇÃO NO MÊS (ENTRADA / SAÍDA) */}
        <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-4 shadow-md">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Fluxo no Mês (Compras vs. Consumo)
          </span>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase text-emerald-400">Entrada</div>
              <div className="text-base font-bold text-emerald-300">
                {fmtValorCurto(kpis.entradaMes)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase text-orange-400">Saída</div>
              <div className="text-base font-bold text-orange-300">
                {fmtValorCurto(kpis.saidaMes)}
              </div>
            </div>
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Saldo líquido:{' '}
            <span
              className={
                kpis.entradaMes - kpis.saidaMes >= 0
                  ? 'font-semibold text-amber-400'
                  : 'font-semibold text-emerald-400'
              }
            >
              {fmtBRL(kpis.entradaMes - kpis.saidaMes)}
            </span>
          </div>
        </div>
      </div>

      {/* TABELA DETALHAMENTO MENSAL POR UNIDADE */}
      <div className="rounded-xl border border-slate-800 bg-[#0D0F12] shadow-lg">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Detalhamento Mensal por Unidade ({linhasExibidas.length} unidades)
            </h3>
            <p className="text-xs text-slate-400">
              Clique nos cabeçalhos para ordenar. Obra-Crítico e Insumo-Crítico já deduzidos do Crítico e Obra.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={buscaTabela}
              onChange={(e) => setBuscaTabela(e.target.value)}
              placeholder="Filtrar unidade..."
              className="rounded-lg border border-slate-700 bg-[#14171C] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#CC5500] focus:outline-none"
            />
            <button
              onClick={exportarCSV}
              className="rounded-lg bg-[#CC5500] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#e05e00]"
            >
              Exportar Excel (CSV)
            </button>
          </div>
        </div>

        <div className="max-h-[540px] overflow-auto">
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
                    } ${col.highlight ? 'text-[#ff7b29]' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortCol === col.key && (
                        <span className="text-[#CC5500]">
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
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0D0F12] px-3 py-2 font-semibold text-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                      {row.unidade}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-200">
                      {fmtBRL(row.estoqueAtiva)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-300">
                      {fmtBRL(row.estoqueGerencial)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-bold text-white">
                      {fmtBRL(row.estoqueTotal)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-emerald-400">
                      {fmtBRL(row.entradaMes)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-orange-400">
                      {fmtBRL(row.saidaMes)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2 text-right font-mono font-semibold ${
                        row.varEstoquePct > 0.05
                          ? 'text-amber-400'
                          : row.varEstoquePct < -0.05
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {fmtPctVar(row.varEstoquePct)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-rose-400">
                      {fmtBRL(row.critico)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-purple-400">
                      {fmtBRL(row.obsoleto)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-teal-400">
                      {fmtBRL(row.obra)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-pink-400">
                      {fmtBRL(row.obraCritico)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-yellow-400">
                      {fmtBRL(row.insumoCritico)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sky-400">
                      {fmtBRL(row.spareParts)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-200">
                      {fmtInt(row.skus)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* LINHA DE TOTAL GERAL FIXA NO RODAPÉ */}
            {linhasExibidas.length > 0 && (
              <tfoot className="sticky bottom-0 z-20 bg-[#181C23] font-bold text-white shadow-[0_-2px_6px_rgba(0,0,0,0.5)]">
                <tr>
                  <td className="sticky left-0 z-30 whitespace-nowrap border-t-2 border-[#CC5500] bg-[#181C23] px-3 py-2.5 text-left text-[#ff7b29]">
                    TOTAL GERAL
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono">
                    {fmtBRL(totaisTabela.estoqueAtiva)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono">
                    {fmtBRL(totaisTabela.estoqueGerencial)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-[#ff7b29]">
                    {fmtBRL(totaisTabela.estoqueTotal)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-emerald-400">
                    {fmtBRL(totaisTabela.entradaMes)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-orange-400">
                    {fmtBRL(totaisTabela.saidaMes)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono">
                    {fmtPctVar(totaisTabela.varEstoquePct)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-rose-400">
                    {fmtBRL(totaisTabela.critico)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-purple-400">
                    {fmtBRL(totaisTabela.obsoleto)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-teal-400">
                    {fmtBRL(totaisTabela.obra)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-pink-400">
                    {fmtBRL(totaisTabela.obraCritico)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-yellow-400">
                    {fmtBRL(totaisTabela.insumoCritico)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono text-sky-400">
                    {fmtBRL(totaisTabela.spareParts)}
                  </td>
                  <td className="whitespace-nowrap border-t-2 border-[#CC5500] px-3 py-2.5 text-right font-mono">
                    {fmtInt(totaisTabela.skus)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

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
                  formatter={(value) => fmtBRL(value)}
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
                  formatter={(value) => fmtBRL(value)}
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