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

// Lista canônica de empresas para a tabela Resumo Anual.
// Se preenchida, SEMPRE exibe essas empresas (zeradas quando não houver inventário no ano).
// Se vazia [], usa automaticamente todas as empresas presentes na base de dados.
const EMPRESAS_FIXAS = [
  'Anamã',
  'Anori',
  'Aparecida',
  'Araucária',
  'Araucária Gerencial',
  'Caapiranga',
  'Candiota',
  'Candiota Gerencial',
  'Codajás',
  'Cruzeiro do Sul',
  'Cuiabá',
  'Cuiabá Gerencial',
  'Cuiabá II',
  'Distrito',
  'Feijó',
  'Floresta',
  'Gasocidente',
  'Gasocidente Gerencial',
  'Goiânia II',
  'Japiim',
  'Jaraqui',
  'Lages',
  'Manacapuru',
  'Mauá',
  'Monte C. Sucuba',
  'Monte Cristo',
  'Norte Flu. Gerencial',
  'Norte Fluminense',
  'Pirarucu',
  'Poraquê',
  'Santa Cruz',
  'Solar Saltinho',
  'Solar Taubaté',
  'Tambaqui',
  'Tarauacá',
  'Tucunaré',
  'Uruguaiana',
  'Uruguaiana Gerencial',
]

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

// Formatação monetária inteira sem casas decimais (padrão ResumoEstoque)
function fmtBRLInt(val) {
  const num = Math.round(Number(val) || 0)
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
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
  const [listaDivergenciasAberta, setListaDivergenciasAberta] = useState(false)

  const [selEmpresaRow, setSelEmpresaRow] = useState(null)
  const [selResumoRow, setSelResumoRow] = useState(null)
  const [selEvolucaoRow, setSelEvolucaoRow] = useState(null)
  const [selAcuraciaCard, setSelAcuraciaCard] = useState(null)
  const [selDivergenciaKey, setSelDivergenciaKey] = useState(null)

  // Estados da Tabela Resumo Anual por Empresa (padrão ResumoEstoque)
  const [buscaEmpresaResumo, setBuscaEmpresaResumo] = useState('')
  const [tabelaEmpresaTelaCheia, setTabelaEmpresaTelaCheia] = useState(false)
  const [sortEmpresaCol, setSortEmpresaCol] = useState('total')
  const [sortEmpresaDir, setSortEmpresaDir] = useState('desc')

  // Suporte global para a tecla ESC (fecha modal, gaveta de detalhamentos e limpa seleções)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false)
        setModalUnidadesSel([])
        setModalSearch('')
        setTabelaEmpresaTelaCheia(false)
        setExpanded(false)
        setListaDivergenciasAberta(false)
        setSelEmpresaRow(null)
        setSelResumoRow(null)
        setSelEvolucaoRow(null)
        setSelAcuraciaCard(null)
        setSelDivergenciaKey(null)
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

  // 1. Gera as listas de filtro globais a partir da base pura
  const listasMaster = useMemo(() => {
    const dadosValidos = data.filter((r) => r.id_inventario && String(r.id_inventario).trim() !== '' && String(r.id_inventario).toLowerCase() !== 'none')
    const empresas = [...new Set(dadosValidos.map((r) => r.empresa_nome).filter(Boolean))].sort()
    const tiposBruto = [...new Set(dadosValidos.map((r) => r.tipo_inventario).filter(Boolean))].sort()
    const tiposVisual = tiposBruto.map((t) => MAPA_TIPOS[t] || t)
    const anos = [...new Set(dadosValidos.map((r) => r.ano_referencia).filter(Boolean))].sort((a, b) => Number(b) - Number(a))
    return { empresas, tiposVisual, anos }
  }, [data])

  useEffect(() => {
    if (listasMaster.anos.length && anoSel.length === 0) setAnoSel([listasMaster.anos[0]])
  }, [listasMaster.anos, anoSel.length])

  // 2. dfMaster aplica os filtros globais (Empresa e Ano)
  const dfMaster = useMemo(() => {
    let df = data.filter((r) => r.id_inventario && String(r.id_inventario).trim() !== '' && String(r.id_inventario).toLowerCase() !== 'none')
    if (empresaSel.length) df = df.filter((r) => empresaSel.includes(r.empresa_nome))
    if (anoSel.length) df = df.filter((r) => anoSel.includes(String(r.ano_referencia)))
    return df
  }, [data, empresaSel, anoSel])

  const chartEvolucao = useMemo(() => {
    let dfBaseAnos = data.filter(r => r.id_inventario && String(r.id_inventario).trim() !== '' && String(r.id_inventario).toLowerCase() !== 'none')
    if (empresaSel.length) dfBaseAnos = dfBaseAnos.filter(r => empresaSel.includes(r.empresa_nome))

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
    }).sort((a, b) => {
      const getVal = (item) => {
        const sis = item.saldo_anterior_consolidado ?? item.saldo_anterior ?? item.saldo_sistema ?? item.qtd_sistema ?? item.sistema ?? 0;
        const fis = item.inventario_consolidado ?? item.quantidade_contada ?? item.qtd_fisica ?? item.fisico ?? 0;
        const divQtd = item.diferenca_consolidada ?? item.diferenca_qtd ?? item.qtd_diferenca ?? item.diff_qtd ?? (fis - sis);
        const prMedio = item.custo_unitario ?? item.preco_medio ?? item.valor_unitario ?? 0;
        return item.diferenca_val ?? item.val_diferenca ?? item.diff_val ?? (divQtd * prMedio);
      };
      return getVal(b) - getVal(a);
    });
    
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

  // Label do Ano selecionado para o cabeçalho da Tabela Resumo Anual
  const periodoAnoLabel = useMemo(() => {
    if (!anoSel || anoSel.length === 0) return 'TODOS OS ANOS'
    return [...anoSel].sort((a, b) => Number(a) - Number(b)).join(', ')
  }, [anoSel])

  // Label do mês ativo no gráfico mestre (seções mensais)
  const periodoMesLabel = useMemo(() => {
    if (!mesClicado) return 'Todo o histórico'
    return String(mesClicado).toUpperCase()
  }, [mesClicado])

  // Consolidação da Tabela Resumo por Empresa vinculada SOMENTE ao Ano (dfMaster, sem filtro mensal)
  // Empresas FIXAS: sempre listadas; sem inventário no ano => zera métricas.
  // Qtde SKUs (rótulo) = soma de todas as linhas contadas nos inventários do ano
  // Valor = soma de saldo_anterior_val (valor congelado) de cada linha
  const { linhasEmpresaResumo, totaisEmpresaResumo } = useMemo(() => {
    const emptyTotais = { rotativos: 0, geral: 0, total: 0, qtdeSkus: 0, valor: 0, acuraciaMedia: null }

    // Base canônica de empresas (lista manual OU todas as empresas da base)
    let empresasCanonicas = EMPRESAS_FIXAS.length
      ? [...EMPRESAS_FIXAS]
      : [...(listasMaster.empresas || [])]

    // Se o filtro global de Empresa estiver ativo, respeita a seleção
    if (empresaSel.length) {
      const setSel = new Set(empresaSel)
      empresasCanonicas = empresasCanonicas.filter((e) => setSel.has(e))
      // Garante que empresas selecionadas (mesmo sem histórico) apareçam
      empresaSel.forEach((e) => {
        if (!empresasCanonicas.includes(e)) empresasCanonicas.push(e)
      })
    }

    empresasCanonicas = [...new Set(empresasCanonicas.filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), 'pt-BR')
    )

    const makeEmpty = (emp) => ({
      empresa: emp,
      idsRotativos: new Set(),
      idsGeral: new Set(),
      idsTotal: new Set(),
      qtdeLinhas: 0, // soma de todas as linhas contadas nos inventários do ano
      valor: 0,      // soma de saldo_anterior_val (valor congelado) de cada linha
      divergAbs: 0,
    })

    const grupos = {}
    for (const emp of empresasCanonicas) {
      grupos[emp] = makeEmpty(emp)
    }

    dfMaster.forEach((r) => {
      const emp = r.empresa_nome || r.unidade || 'SEM EMPRESA'
      // Empresa presente no ano filtrado mas fora da lista fixa: inclui mesmo assim
      if (!grupos[emp]) {
        grupos[emp] = makeEmpty(emp)
      }
      const uid = limparId(r.id_inventario)
      grupos[emp].idsTotal.add(uid)
      if (isRotativo(r.tipo_inventario)) grupos[emp].idsRotativos.add(uid)
      else grupos[emp].idsGeral.add(uid)

      // Cada linha do inventário conta como 1 item contado
      grupos[emp].qtdeLinhas += 1

      // Valor congelado = saldo_anterior_val (soma de todos os inventários/meses do ano)
      const valCong = Number(r.saldo_anterior_val) || 0
      const divVal = r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0
      grupos[emp].valor += valCong
      grupos[emp].divergAbs += Math.abs(Number(divVal) || 0)
    })

    // Ordem: canônicas primeiro (alfabética), depois eventuais extras
    const ordem = [
      ...empresasCanonicas,
      ...Object.keys(grupos).filter((e) => !empresasCanonicas.includes(e)).sort((a, b) =>
        String(a).localeCompare(String(b), 'pt-BR')
      ),
    ]

    const linhas = ordem.map((emp) => {
      const g = grupos[emp]
      const totalInv = g.idsTotal.size
      // Sem inventário no ano => sem acurácia (não entra na média)
      let acuraciaMedia = null
      if (totalInv > 0) {
        acuraciaMedia = g.valor > 0
          ? Math.max(0, (1 - g.divergAbs / g.valor) * 100)
          : (g.divergAbs === 0 ? 100 : 0)
      }

      return {
        empresa: g.empresa,
        rotativos: g.idsRotativos.size,
        geral: g.idsGeral.size,
        total: totalInv,
        qtdeSkus: g.qtdeLinhas, // soma de linhas contadas em todos os inventários do ano
        valor: g.valor,         // soma de saldo_anterior_val
        acuraciaMedia,
      }
    })

    const comAcuracia = linhas.filter((r) => r.acuraciaMedia != null)
    const totais = {
      rotativos: linhas.reduce((acc, r) => acc + r.rotativos, 0),
      geral: linhas.reduce((acc, r) => acc + r.geral, 0),
      total: linhas.reduce((acc, r) => acc + r.total, 0),
      qtdeSkus: linhas.reduce((acc, r) => acc + r.qtdeSkus, 0), // soma das linhas de todas as empresas
      valor: linhas.reduce((acc, r) => acc + r.valor, 0),
      // Média só das empresas que inventariaram no ano
      acuraciaMedia: comAcuracia.length > 0
        ? comAcuracia.reduce((acc, r) => acc + r.acuraciaMedia, 0) / comAcuracia.length
        : null,
    }

    if (!linhas.length) return { linhasEmpresaResumo: [], totaisEmpresaResumo: emptyTotais }
    return { linhasEmpresaResumo: linhas, totaisEmpresaResumo: totais }
  }, [dfMaster, listasMaster.empresas, empresaSel])

  // Acurácias ANUAIS — consolidado de todas as linhas do ano (mesmo critério do painel mensal)
  const acuraciaAnual = useMemo(() => {
    const empty = { acuraciaItens: null, acuraciaValor: null, acuraciaLiquida: null, hasData: false }
    if (!dfMaster.length) return empty

    const getQtdDiv = (r) => r.diferenca_consolidada ?? r.diferenca_qtd ?? r.qtd_diferenca ?? r.diff_qtd ?? 0
    const getValDiv = (r) => r.diferenca_val ?? r.val_diferenca ?? r.diff_val ?? 0

    const totalLinhas = dfMaster.length
    const itensDivergentes = dfMaster.filter((r) => Math.abs(getQtdDiv(r)) > 0 || Math.abs(getValDiv(r)) !== 0).length
    const acuraciaItens = totalLinhas > 0 ? ((totalLinhas - itensDivergentes) / totalLinhas) * 100 : 100

    const valCongelado = dfMaster.reduce((s, r) => s + (Number(r.saldo_anterior_val) || 0), 0)
    const divergAbs = dfMaster.reduce((s, r) => s + Math.abs(Number(getValDiv(r)) || 0), 0)
    const acuraciaValor = valCongelado > 0
      ? Math.max(0, (1 - divergAbs / valCongelado) * 100)
      : (divergAbs === 0 ? 100 : 0)

    const valSobras = dfMaster.filter((r) => getValDiv(r) > 0).reduce((s, r) => s + getValDiv(r), 0)
    const valPerdas = dfMaster.filter((r) => getValDiv(r) < 0).reduce((s, r) => s + getValDiv(r), 0)
    const diffLiquida = valSobras + valPerdas
    const acuraciaLiquida = valCongelado > 0
      ? Math.max(0, (1 - Math.abs(diffLiquida) / valCongelado) * 100)
      : (diffLiquida === 0 ? 100 : 0)

    return { acuraciaItens, acuraciaValor, acuraciaLiquida, hasData: true }
  }, [dfMaster])

  const linhasEmpresaExibidas = useMemo(() => {
    const q = buscaEmpresaResumo.trim().toUpperCase()
    const filtradas = q
      ? linhasEmpresaResumo.filter((l) => l.empresa.toUpperCase().includes(q))
      : linhasEmpresaResumo

    return [...filtradas].sort((a, b) => {
      const va = a[sortEmpresaCol]
      const vb = b[sortEmpresaCol]
      // Nulls (sem inventário) sempre no fim
      const aNull = va == null
      const bNull = vb == null
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1
      if (typeof va === 'string') {
        return sortEmpresaDir === 'asc' ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR')
      }
      return sortEmpresaDir === 'asc' ? va - vb : vb - va
    })
  }, [linhasEmpresaResumo, buscaEmpresaResumo, sortEmpresaCol, sortEmpresaDir])

  const handleSortEmpresa = useCallback((col) => {
    if (sortEmpresaCol === col) {
      setSortEmpresaDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortEmpresaCol(col)
      setSortEmpresaDir(col === 'empresa' ? 'asc' : 'desc')
    }
  }, [sortEmpresaCol])

  const exportarExcelResumoEmpresa = useCallback(() => {
    if (!linhasEmpresaExibidas.length) return
    const wsData = linhasEmpresaExibidas.map((r) => ({
      'Empresa': r.empresa,
      'Inventários Rotativos': r.rotativos,
      'Inventários Geral': r.geral,
      'Total Inventários': r.total,
      'Qtde SKUs': r.qtdeSkus,
      'Valor (R$)': Math.round(r.valor),
      'Acurácia média (%)': r.acuraciaMedia != null ? Number(r.acuraciaMedia.toFixed(2)) : null,
    }))
    wsData.push({
      'Empresa': 'TOTAL GERAL',
      'Inventários Rotativos': totaisEmpresaResumo.rotativos,
      'Inventários Geral': totaisEmpresaResumo.geral,
      'Total Inventários': totaisEmpresaResumo.total,
      'Qtde SKUs': totaisEmpresaResumo.qtdeSkus,
      'Valor (R$)': Math.round(totaisEmpresaResumo.valor),
      'Acurácia média (%)': totaisEmpresaResumo.acuraciaMedia != null ? Number(totaisEmpresaResumo.acuraciaMedia.toFixed(2)) : null,
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo Anual Inventario')
    const sufixoAno = anoSel.length ? anoSel.join('-') : 'Todos_Anos'
    XLSX.writeFile(wb, `Resumo_Anual_Inventarios_Empresa_${sufixoAno}.xlsx`)
  }, [linhasEmpresaExibidas, totaisEmpresaResumo, anoSel])

  const exportarPdfResumoEmpresa = useCallback(() => {
    if (!linhasEmpresaExibidas.length) return

    const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR')
    const fmtMoney = (n) => Math.round(Number(n) || 0).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
    })
    const fmtAcu = (n) => (n == null ? '—' : `${Number(n).toFixed(2).replace('.', ',')}%`)
    const dataGeracao = new Date().toLocaleString('pt-BR')
    const logoSrc = 'data:image/png;base64,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'

    const rowHtml = (r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f3f6fb'
      const acu = r.acuraciaMedia
      const acuColor = acu == null ? '#64748b' : acu >= 95 ? '#15803d' : acu >= 90 ? '#c2410c' : '#b91c1c'
      return `
      <tr style="background:${bg};">
        <td class="td-left">${r.empresa}</td>
        <td>${fmtNum(r.rotativos)}</td>
        <td>${fmtNum(r.geral)}</td>
        <td class="td-strong">${fmtNum(r.total)}</td>
        <td>${fmtNum(r.qtdeSkus)}</td>
        <td>${fmtMoney(r.valor)}</td>
        <td style="color:${acuColor};font-weight:700;">${fmtAcu(acu)}</td>
      </tr>`
    }

    const colsHead = `
      <tr class="cols">
        <th>Empresa</th>
        <th>Inv. rotativos</th>
        <th>Inv. geral</th>
        <th>Total inv.</th>
        <th>Qtde SKUs</th>
        <th>Valor (R$)</th>
        <th>Acurácia média</th>
      </tr>`

    const brandHead = `
      <div class="brand-inner">
        <img src="${logoSrc}" alt="Âmbar Energia" />
        <div>
          <div class="t">Resumo Anual de Inventário por Empresa — ${periodoAnoLabel}</div>
          <div class="s">Âmbar Energia · ${linhasEmpresaExibidas.length} empresas · Gerado em ${dataGeracao}</div>
        </div>
      </div>`

    const kpisBlock = `
      <div class="kpis">
        <div class="kpi kpi-c0"><div class="kpi-label">Total inventários</div><div class="kpi-value">${fmtNum(totaisEmpresaResumo.total)}</div></div>
        <div class="kpi kpi-c1"><div class="kpi-label">Inventários geral</div><div class="kpi-value">${fmtNum(totaisEmpresaResumo.geral)}</div></div>
        <div class="kpi kpi-c2"><div class="kpi-label">Inventários rotativos</div><div class="kpi-value">${fmtNum(totaisEmpresaResumo.rotativos)}</div></div>
        <div class="kpi kpi-c3"><div class="kpi-label">Qtde SKUs (linhas)</div><div class="kpi-value">${fmtNum(totaisEmpresaResumo.qtdeSkus)}</div></div>
        <div class="kpi kpi-c4"><div class="kpi-label">Valor total</div><div class="kpi-value">${fmtMoney(totaisEmpresaResumo.valor)}</div></div>
      </div>
      <div class="acus">
        <div class="acu acu-c0"><div class="acu-label">Acurácia financeira (bruta)</div><div class="acu-value">${fmtAcu(acuraciaAnual.acuraciaValor)}</div></div>
        <div class="acu acu-c1"><div class="acu-label">Acurácia financeira (líquida)</div><div class="acu-value">${fmtAcu(acuraciaAnual.acuraciaLiquida)}</div></div>
        <div class="acu acu-c2"><div class="acu-label">Acurácia física (itens)</div><div class="acu-value">${fmtAcu(acuraciaAnual.acuraciaItens)}</div></div>
      </div>`

    const totalRow = `
      <tr class="total-row">
        <td>TOTAL</td>
        <td>${fmtNum(totaisEmpresaResumo.rotativos)}</td>
        <td>${fmtNum(totaisEmpresaResumo.geral)}</td>
        <td>${fmtNum(totaisEmpresaResumo.total)}</td>
        <td>${fmtNum(totaisEmpresaResumo.qtdeSkus)}</td>
        <td>${fmtMoney(totaisEmpresaResumo.valor)}</td>
        <td>${fmtAcu(totaisEmpresaResumo.acuraciaMedia)}</td>
      </tr>`

    // Paginação explícita: garante cabeçalho de colunas em TODAS as páginas
    // Pág. 1 tem KPIs (cabe menos linhas); demais páginas só tabela
    const PAGE1_SIZE = 16
    const PAGE_SIZE = 22
    const pages = []
    let offset = 0
    if (linhasEmpresaExibidas.length <= PAGE1_SIZE) {
      pages.push({ rows: linhasEmpresaExibidas, showKpis: true, showTotal: true })
    } else {
      pages.push({
        rows: linhasEmpresaExibidas.slice(0, PAGE1_SIZE),
        showKpis: true,
        showTotal: false,
      })
      offset = PAGE1_SIZE
      while (offset < linhasEmpresaExibidas.length) {
        const slice = linhasEmpresaExibidas.slice(offset, offset + PAGE_SIZE)
        offset += PAGE_SIZE
        pages.push({
          rows: slice,
          showKpis: false,
          showTotal: offset >= linhasEmpresaExibidas.length,
        })
      }
    }

    const pagesHtml = pages.map((p, pageIdx) => {
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
        ${p.showTotal ? '<div class="footer-note">Âmbar Energia — Gestão e Fechamento Executivo de Inventários</div>' : ''}
      </section>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Resumo Anual de Inventário por Empresa — ${periodoAnoLabel}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 10mm 14mm 10mm;
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
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    .brand-inner img { height: 40px; width: auto; display: block; }
    .brand-inner .t {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .brand-inner .s {
      margin: 2px 0 0;
      font-size: 11px;
      font-weight: 500;
      color: #64748b;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 8px;
      border: 1px solid #cbd5e1;
    }
    .kpi {
      padding: 9px 11px 11px;
      color: #fff;
      min-height: 64px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .kpi-label { font-size: 10px; font-weight: 700; opacity: 0.95; margin-bottom: 5px; }
    .kpi-value { font-size: 17px; font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
    .kpi-c0 { background: #0f2744; }
    .kpi-c1 { background: #2563eb; }
    .kpi-c2 { background: #06b6d4; }
    .kpi-c3 { background: #f59e0b; }
    .kpi-c4 { background: #16a34a; }
    .acus {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 10px;
      border: 1px solid #cbd5e1;
    }
    .acu { padding: 9px 11px; color: #fff; }
    .acu-label { font-size: 10px; font-weight: 700; opacity: 0.95; margin-bottom: 4px; }
    .acu-value { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .acu-c0 { background: #1d4ed8; }
    .acu-c1 { background: #7c3aed; }
    .acu-c2 { background: #0f766e; }
    table.main {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      border: 1px solid #94a3b8;
    }
    thead th {
      background: #0f2744;
      color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: 7px 8px;
      text-align: right;
      border-right: 1px solid #1e3a5f;
    }
    thead th:first-child { text-align: left; }
    thead th:last-child { border-right: none; }
    td {
      padding: 5px 8px;
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
      padding: 7px 8px;
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
        iframe.setAttribute('title', 'Exportar PDF Resumo Anual')
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
  }, [linhasEmpresaExibidas, totaisEmpresaResumo, periodoAnoLabel, acuraciaAnual])

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

  const fecharModalDivergencias = useCallback(() => {
    setIsModalOpen(false)
    setModalUnidadesSel([])
    setModalSearch('')
  }, [])

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

  // Gerenciamento global de navegação por teclado com identificação correta do container (Main vs Modal)
  useEffect(() => {
    const handleNavigationKeyDown = (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      
      const items = isModalOpen ? linhasDivergentesFiltradasModal.slice(0, 1000) : stats.linhasDivergentes.slice(0, 50);
      if (!items.length) return;

      e.preventDefault();

      let nextIndex = 0;

      if (!selDivergenciaKey) {
        nextIndex = 0;
      } else {
        const currentIndex = items.findIndex((row, idx) => {
          return `${row.empresa_nome || row.unidade}-${row.codigo_produto || row.codigo}-${row.id_inventario}-${idx}` === selDivergenciaKey;
        });

        if (currentIndex !== -1) {
          if (e.key === 'ArrowDown') {
            nextIndex = Math.min(currentIndex + 1, items.length - 1);
          } else {
            nextIndex = Math.max(currentIndex - 1, 0);
          }
        } else {
          nextIndex = 0;
        }
      }

      const nextRow = items[nextIndex];
      if (nextRow) {
        const nextKey = `${nextRow.empresa_nome || nextRow.unidade}-${nextRow.codigo_produto || nextRow.codigo}-${nextRow.id_inventario}-${nextIndex}`;
        setSelDivergenciaKey(nextKey);

        setTimeout(() => {
          const domId = isModalOpen ? `row-modal-${nextKey}` : `row-main-${nextKey}`;
          const el = document.getElementById(domId);
          if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }, 20);
      }
    };

    window.addEventListener('keydown', handleNavigationKeyDown);
    return () => window.removeEventListener('keydown', handleNavigationKeyDown);
  }, [selDivergenciaKey, isModalOpen, linhasDivergentesFiltradasModal, stats.linhasDivergentes]);

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
        className={`grid grid-cols-12 items-center py-2.5 border-b border-[#222222] transition-colors rounded-lg px-2 cursor-pointer ${isActive ? 'bg-[#1c1612] border border-accent/20 border-l-[4px] border-l-accent shadow-[inset_0_0_15px_rgba(245,130,32,0.15)]' : 'hover:bg-[#1a1a1a] border border-transparent border-b-[#222222] border-l-[4px] border-l-transparent'}`}
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

  // Componente de Linha de Divergência padronizado com suporte a ID isolado (Main vs Modal)
  const DivergenceRowItem = ({ row, index, isModal = false }) => {
    const uniqueKey = `${row.empresa_nome || row.unidade}-${row.codigo_produto || row.codigo}-${row.id_inventario}-${index}`
    const isActive = selDivergenciaKey === uniqueKey
    const domId = isModal ? `row-modal-${uniqueKey}` : `row-main-${uniqueKey}`

    const unidade = row.empresa_nome || row.unidade || '—'
    const idInv = limparId(row.id_inventario)
    const cod = row.codigo_produto || row.codigo || '—'
    const nome = row.nome_produto ?? row.descricao_produto ?? row.nome ?? row.descricao ?? row.produto ?? '—'
    
    const sis = row.saldo_anterior_consolidado ?? row.saldo_anterior ?? row.saldo_sistema ?? row.qtd_sistema ?? row.sistema ?? 0
    const fis = row.inventario_consolidado ?? row.quantidade_contada ?? row.qtd_fisica ?? row.fisico ?? 0
    const divQtd = row.diferenca_consolidada ?? row.diferenca_qtd ?? row.qtd_diferenca ?? row.diff_qtd ?? (fis - sis)
    const prMedio = row.custo_unitario ?? row.preco_medio ?? row.valor_unitario ?? 0
    const divVal = row.diferenca_val ?? row.val_diferenca ?? row.diff_val ?? (divQtd * prMedio)

    const corQtd = divQtd > 0 ? 'text-[#3498db]' : divQtd < 0 ? 'text-[#e74c3c]' : 'text-white'
    const corVal = divVal > 0 ? 'text-[#3498db]' : divVal < 0 ? 'text-[#e74c3c]' : 'text-white'

    const toggle = () => setSelDivergenciaKey(isActive ? null : uniqueKey)

    return (
      <div 
        id={domId}
        role="row"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className={`grid grid-cols-12 items-center py-2.5 px-3 transition-all rounded-lg cursor-pointer text-xs outline-none focus:ring-1 focus:ring-accent/50 ${
          isActive 
            ? 'bg-[#1c1612] border border-accent/30 border-l-[4px] border-l-accent shadow-[inset_0_0_15px_rgba(245,130,32,0.15)]' 
            : 'hover:bg-[#1a1a1a] border border-transparent border-b-[#222222] border-l-[4px] border-l-transparent'
        }`}
      >
        <div className="col-span-2 text-white font-medium truncate pr-2" title={unidade}>{unidade}</div>
        <div className="col-span-1 text-white font-mono text-center">{idInv}</div>
        <div className="col-span-1 text-[#60a5fa] font-mono truncate px-1" title={cod}>{cod}</div>
        <div className="col-span-3 text-white truncate px-2" title={nome}>{nome}</div>
        <div className="col-span-1 text-white font-mono text-right">{fmtInt(sis)}</div>
        <div className="col-span-1 text-white font-mono text-right">{fmtInt(fis)}</div>
        <div className={`col-span-1 font-mono font-bold text-right ${corQtd}`}>
          {divQtd > 0 ? '+' : ''}{fmtInt(divQtd)}
        </div>
        <div className="col-span-1 text-white font-mono text-right">{fmtBRL(prMedio)}</div>
        <div className={`col-span-1 font-mono font-bold text-right ${corVal}`}>
          {divVal > 0 ? '+' : ''}{fmtBRL(divVal)}
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

  const getCor = (val) => val >= 95 ? '#2ecc71' : val >= 90 ? '#f58220' : '#e74c3c'
  const getStatusConf = (val) => val >= 95 ? 'EXCELENTE' : val >= 90 ? 'ATENÇÃO' : 'CRÍTICO'

  // Configuração da Tabela Resumo Anual por Empresa (estilo idêntico ao ResumoEstoque)
  const colunasEmpresaResumo = [
    { key: 'empresa', label: 'Empresa', align: 'left', sticky: true },
    { key: 'rotativos', label: 'Inventários Rotativos', align: 'right' },
    { key: 'geral', label: 'Inventários Geral', align: 'right' },
    { key: 'total', label: 'Total Inventários', align: 'right' },
    { key: 'qtdeSkus', label: 'Qtde SKUs', align: 'right' },
    { key: 'valor', label: 'Valor (R$)', align: 'right' },
    { key: 'acuraciaMedia', label: 'Acurácia média', align: 'right', isTotalCol: true },
  ]

  const renderTabelaEmpresaResumo = () => (
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 z-20 bg-[#121212] text-[10px] uppercase tracking-[0.14em] text-[#8c9ba5]">
        <tr>
          {colunasEmpresaResumo.map((col) => (
            <th
              key={col.key}
              onClick={() => handleSortEmpresa(col.key)}
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
                {sortEmpresaCol === col.key && (
                  <span className="text-[#f58220]">
                    {sortEmpresaDir === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </span>
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-[#222222]">
        {linhasEmpresaExibidas.length === 0 ? (
          <tr>
            <td
              colSpan={colunasEmpresaResumo.length}
              className="py-10 text-center text-sm text-[#8c9ba5]"
            >
              Nenhum dado encontrado para os filtros selecionados.
            </td>
          </tr>
        ) : (
          linhasEmpresaExibidas.map((row) => (
            <tr
              key={row.empresa}
              className="transition-colors hover:bg-[#1e1e1e]"
            >
              <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0c0c0c] px-3.5 py-2.5 font-semibold text-white shadow-[2px_0_6px_rgba(0,0,0,0.6)]">
                {row.empresa}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtInt(row.rotativos)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtInt(row.geral)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold text-[#f58220]">
                {fmtInt(row.total)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtInt(row.qtdeSkus)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono text-white">
                {fmtBRLInt(row.valor)}
              </td>
              <td
                className="whitespace-nowrap bg-[#f58220]/10 px-3.5 py-2.5 text-right font-mono font-bold"
                style={{ color: row.acuraciaMedia != null ? getCor(row.acuraciaMedia) : '#8c9ba5' }}
              >
                {row.acuraciaMedia != null
                  ? `${row.acuraciaMedia.toFixed(2).replace('.', ',')}%`
                  : '—'}
              </td>
            </tr>
          ))
        )}
      </tbody>

      {/* LINHA DE TOTAL GERAL FIXA NO RODAPÉ EM TOM LARANJA */}
      {linhasEmpresaExibidas.length > 0 && (
        <tfoot className="sticky bottom-0 z-20 bg-[#26160c] font-bold text-white shadow-[0_-2px_10px_rgba(0,0,0,0.75)]">
          <tr>
            <td className="sticky left-0 z-30 whitespace-nowrap border-t-2 border-[#f58220] bg-[#26160c] px-3.5 py-3 text-left tracking-wider text-[#f58220]">
              TOTAL GERAL
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtInt(totaisEmpresaResumo.rotativos)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtInt(totaisEmpresaResumo.geral)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-[#ff9638]">
              {fmtInt(totaisEmpresaResumo.total)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtInt(totaisEmpresaResumo.qtdeSkus)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] px-3.5 py-3 text-right font-mono text-orange-100">
              {fmtBRLInt(totaisEmpresaResumo.valor)}
            </td>
            <td className="whitespace-nowrap border-t-2 border-[#f58220] bg-[#361e0f] px-3.5 py-3 text-right font-mono text-orange-100">
              {totaisEmpresaResumo.acuraciaMedia != null
                ? `${totaisEmpresaResumo.acuraciaMedia.toFixed(2).replace('.', ',')}%`
                : '—'}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )

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
          <h2 className="text-white text-sm font-bold tracking-wider uppercase">GESTÃO E FECHAMENTO EXECUTIVO DE INVENTÁRIOS — {periodoMesLabel}</h2>
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 py-2.5 bg-[#111111] rounded-xl border border-[#2A2A2A] animate-fade-in">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#8c9ba5] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-xs text-[#8c9ba5] tracking-wide font-medium">Visualizando período: <strong className="text-white text-xs px-1.5 py-0.5 rounded bg-[#222] border border-[#333] ml-0.5">{mesClicado}</strong></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                     {!isCurrentMonth && ( <button onClick={handleGoToCurrent} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[#2A2A2A] hover:border-[#444] text-[#8c9ba5] hover:text-white font-bold text-[10px] transition-all"><span>Voltar ao Atual</span></button> )}
                     <button onClick={() => setMesClicado(null)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[#2A2A2A] hover:border-[#444] text-[#8c9ba5] hover:text-white font-bold text-[10px] transition-all">RESTAURAR PADRÃO</button>
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
                  <span className="text-xs font-bold text-white tracking-wide uppercase hover:text-accent transition-colors truncate">INVENTÁRIOS - DETALHAMENTOS — {periodoMesLabel}</span>
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
                  <h3 className="text-xs font-bold tracking-[0.18em] text-white uppercase">RESUMO DA CONCILIAÇÃO DE INVENTÁRIOS — {periodoMesLabel}</h3>
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
                  RAIO-X DOS INVENTÁRIOS — {periodoMesLabel}
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
                  <h3 className="text-xs sm:text-sm font-black tracking-[0.1em] text-white uppercase">ACURÁCIA FINANCEIRA (BRUTA) — {periodoMesLabel}</h3>
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
                  <h3 className="text-xs sm:text-sm font-black tracking-[0.1em] text-white uppercase">ACURÁCIA FINANCEIRA (LÍQUIDA) — {periodoMesLabel}</h3>
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
                  <h3 className="text-xs sm:text-sm font-black tracking-[0.1em] text-white uppercase">ACURÁCIA FÍSICA (ITENS) — {periodoMesLabel}</h3>
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
                  EVOLUÇÃO COMPARATIVA — {periodoMesLabel}
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

        {/* FULL WIDTH BOTTOM ROW — DETALHAMENTO DE DIVERGÊNCIAS (padrão gaveta do Visão Geral) */}
        <div className="bg-[#0c0c0c] border-t border-[#2A2A2A] p-5 sm:p-6">
          <div className="mt-0 border border-[#e74c3c]/30 rounded-xl bg-[#0c0c0c] overflow-hidden shadow-inner">
            {/* Cabeçalho clicável da gaveta */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={listaDivergenciasAberta}
              onClick={() => setListaDivergenciasAberta((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setListaDivergenciasAberta((v) => !v)
                }
              }}
              className="flex items-center justify-between p-3 sm:p-4 bg-[#1a1212] hover:bg-[#201616] cursor-pointer transition-colors border-b border-[#e74c3c]/20 focus:outline-none focus:bg-[#201616]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-[#2a1616] flex items-center justify-center text-[#e74c3c] shadow-inner shrink-0 border border-[#e74c3c]/30">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#e74c3c] uppercase tracking-wider block">
                    {listaDivergenciasAberta
                      ? `Fechar Lista de Divergências — ${periodoMesLabel}`
                      : `⚠️ Detalhamento de Divergências — ${periodoMesLabel}`}
                  </span>
                  <span className="text-[10px] text-muted font-medium mt-0.5 block">
                    Itens com diferença entre sistema e físico (Snapshot: {mesClicado || 'Todo o histórico'})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block text-[10px] bg-[#e74c3c]/15 text-[#e74c3c] px-2 py-0.5 rounded font-mono border border-[#e74c3c]/30 font-bold">
                  Total: {Number(stats.linhasDivergentes.length).toLocaleString('pt-BR')}
                </span>
                <span className="text-[#e74c3c]">
                  {listaDivergenciasAberta ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </span>
              </div>
            </div>

            {/* Conteúdo da gaveta */}
            {listaDivergenciasAberta && (
              <div className="p-4 space-y-4 animate-fade-in bg-[#121010]">
                {stats.linhasDivergentes.length > 0 ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-[11px] text-[#e74c3c]/80">
                        Listando os itens mais relevantes ordenados por impacto financeiro (preview dos primeiros 50).
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={exportarExcelDivergencias}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Exportar Excel</span>
                        </button>
                        <button
                          onClick={() => setIsModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1a1a] hover:bg-[#3a2020] text-[#f58220] border border-[#f58220]/40 text-xs font-bold transition-all shadow-sm group"
                        >
                          <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          <span>Expandir Tabela</span>
                        </button>
                      </div>
                    </div>

                    <div className="border border-[#222222] rounded-xl shadow-inner bg-[#111111] overflow-hidden">
                      <div className="grid grid-cols-12 px-3 py-2.5 border-b border-[#222222] text-[10px] font-bold text-[#8c9ba5] uppercase tracking-wider bg-[#101010]">
                        <div className="col-span-2">Unidade</div>
                        <div className="col-span-1 text-center">Nº Inv.</div>
                        <div className="col-span-1 px-1">Código SKU</div>
                        <div className="col-span-3 px-2">Nome do Produto</div>
                        <div className="col-span-1 text-right">Sistema</div>
                        <div className="col-span-1 text-right">Físico</div>
                        <div className="col-span-1 text-right">Divergência</div>
                        <div className="col-span-1 text-right">Preço Médio</div>
                        <div className="col-span-1 text-right">Valor Total</div>
                      </div>
                      <div
                        className="max-h-[380px] overflow-y-auto custom-scrollbar p-1 space-y-1 outline-none focus:ring-1 focus:ring-accent/30"
                        tabIndex={0}
                        role="list"
                      >
                        {stats.linhasDivergentes.slice(0, 50).map((row, idx) => (
                          <DivergenceRowItem key={idx} row={row} index={idx} isModal={false} />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-[#111111] border border-[#222222] rounded-xl p-6 text-center flex flex-col items-center justify-center">
                    <span className="w-8 h-8 rounded-full bg-[#2ecc71]/10 text-[#2ecc71] border border-[#2ecc71]/30 flex items-center justify-center text-sm font-bold mb-2">✓</span>
                    <span className="text-xs text-white font-bold">100% Exato - Sem Divergências</span>
                    <span className="text-[10px] text-muted mt-0.5">Não existem divergências cadastradas para o período selecionado.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- TABELA RESUMO ANUAL POR EMPRESA (VINCULADA SOMENTE AO ANO) --- */}
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
                Resumo Anual de Inventário por Empresa — {periodoAnoLabel} ({linhasEmpresaExibidas.length} empresas)
              </h3>
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
                value={buscaEmpresaResumo}
                onChange={(e) => setBuscaEmpresaResumo(e.target.value)}
                placeholder="Filtrar empresa..."
                className="rounded-lg border border-[#2A2A2A] bg-[#080808] pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8c9ba5] focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <button
              onClick={exportarExcelResumoEmpresa}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={exportarPdfResumoEmpresa}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Exportar PDF</span>
            </button>

            <button
              onClick={() => setTabelaEmpresaTelaCheia(true)}
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

        {/* KPIs ANUAIS — mesmo escopo da tabela (filtro de Ano) */}
        <div className="px-4 sm:px-5 pt-4 pb-2 bg-[#121212] border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase">Indicadores anuais</span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-accent/40 bg-accent/10 text-accent">
              {periodoAnoLabel}
            </span>
</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {/* 1 Total inventários */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#0c0c0c] p-3.5 sm:p-4 shadow-inner relative overflow-hidden hover:border-[#3a3a3a] transition-all">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3a3a3a] to-transparent opacity-60" />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] border border-[#2A2A2A] flex items-center justify-center text-[#8c9ba5] shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <span className="text-[10px] font-bold tracking-[0.14em] text-[#8c9ba5] uppercase leading-tight">Total inventários</span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">{fmtInt(totaisEmpresaResumo.total)}</div>
              <div className="text-[10px] text-[#666] mt-1">No ano · todas as empresas</div>
            </div>

            {/* 2 Geral */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#0c0c0c] p-3.5 sm:p-4 shadow-inner relative overflow-hidden hover:border-[#3a3a3a] transition-all">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3a3a3a] to-transparent opacity-60" />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] border border-[#2A2A2A] flex items-center justify-center text-[#8c9ba5] shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h6" /></svg>
                </div>
                <span className="text-[10px] font-bold tracking-[0.14em] text-[#8c9ba5] uppercase leading-tight">Inventários geral</span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">{fmtInt(totaisEmpresaResumo.geral)}</div>
              <div className="text-[10px] text-[#666] mt-1">Tipo geral · ano</div>
            </div>

            {/* 3 Rotativo */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#0c0c0c] p-3.5 sm:p-4 shadow-inner relative overflow-hidden hover:border-[#3a3a3a] transition-all">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3a3a3a] to-transparent opacity-60" />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] border border-[#2A2A2A] flex items-center justify-center text-[#8c9ba5] shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <span className="text-[10px] font-bold tracking-[0.14em] text-[#8c9ba5] uppercase leading-tight">Inventários rotativos</span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">{fmtInt(totaisEmpresaResumo.rotativos)}</div>
              <div className="text-[10px] text-[#666] mt-1">Tipo rotativo · ano</div>
            </div>

            {/* 4 Qtde SKUs / linhas */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#0c0c0c] p-3.5 sm:p-4 shadow-inner relative overflow-hidden hover:border-[#3a3a3a] transition-all">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3a3a3a] to-transparent opacity-60" />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] border border-[#2A2A2A] flex items-center justify-center text-[#8c9ba5] shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                </div>
                <span className="text-[10px] font-bold tracking-[0.14em] text-[#8c9ba5] uppercase leading-tight">Qtde SKUs</span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">{fmtInt(totaisEmpresaResumo.qtdeSkus)}</div>
              <div className="text-[10px] text-[#666] mt-1">Linhas contadas · ano</div>
            </div>

            {/* 5 Valor total */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#0c0c0c] p-3.5 sm:p-4 shadow-inner relative overflow-hidden col-span-2 md:col-span-3 xl:col-span-1 hover:border-[#3a3a3a] transition-all">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3a3a3a] to-transparent opacity-60" />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] border border-[#2A2A2A] flex items-center justify-center text-[#8c9ba5] shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-[10px] font-bold tracking-[0.14em] text-[#8c9ba5] uppercase leading-tight">Valor total</span>
              </div>
              <div className="font-mono text-lg sm:text-xl font-black text-white tracking-tight leading-snug">{fmtBRLInt(totaisEmpresaResumo.valor)}</div>
              <div className="text-[10px] text-[#666] mt-1">Saldo anterior val · ano</div>
            </div>
          </div>
{/* Medidores de acurácia ANUAL (mesmo critério do mensal, consolidado do ano) */}
          <div className="mt-4 pt-3 border-t border-[#2A2A2A]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase">Acurácia anual</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-accent/40 bg-accent/10 text-accent">
                {periodoAnoLabel}
              </span>
</div>
            {acuraciaAnual.hasData ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    key: 'bruta',
                    title: 'Acurácia financeira (bruta)',
                    desc: 'Impacto financeiro absoluto no saldo contábil (ano).',
                    value: acuraciaAnual.acuraciaValor,
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ),
                  },
                  {
                    key: 'liquida',
                    title: 'Acurácia financeira (líquida)',
                    desc: 'Impacto financeiro real compensado (ano).',
                    value: acuraciaAnual.acuraciaLiquida,
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ),
                  },
                  {
                    key: 'fisica',
                    title: 'Acurácia física (itens)',
                    desc: 'Precisão da contagem física linha a linha (ano).',
                    value: acuraciaAnual.acuraciaItens,
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    ),
                  },
                ].map((card) => {
                  const cor = getCor(card.value)
                  return (
                    <div
                      key={card.key}
                      className="rounded-xl border border-[#2A2A2A] bg-[#0c0c0c] p-4 flex flex-col sm:flex-row items-center gap-3 shadow-inner hover:border-accent/30 transition-all"
                    >
                      <div className="flex-1 w-full min-w-0 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                          <div
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg shadow-inner border shrink-0"
                            style={{ backgroundColor: `${cor}15`, color: cor, borderColor: `${cor}40` }}
                          >
                            {card.icon}
                          </div>
                          <h4 className="text-[11px] font-black tracking-[0.08em] text-white uppercase leading-tight">
                            {card.title}
                          </h4>
                        </div>
                        <p className="text-[10px] text-muted leading-relaxed mb-2">{card.desc}</p>
                        <div
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border shadow-sm"
                          style={{ backgroundColor: `${cor}15`, borderColor: `${cor}35`, color: cor }}
                        >
                          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: cor }} />
                          <span>CONFIABILIDADE: {getStatusConf(card.value)}</span>
                        </div>
                      </div>
                      <div className="w-[110px] h-[110px] shrink-0 flex items-center justify-center pointer-events-none">
                        <Plot
                          data={[{
                            type: 'pie',
                            values: [card.value, Math.max(0, 100 - card.value)],
                            hole: DONUT_HOLE,
                            sort: false,
                            direction: 'clockwise',
                            rotation: 90,
                            textinfo: 'none',
                            hoverinfo: 'none',
                            marker: { colors: [cor, '#2A2A2A'], line: { width: 0 } },
                          }]}
                          layout={{
                            ...DONUT_LAYOUT,
                            height: 110,
                            annotations: [{
                              text: `${card.value.toFixed(2)}%`,
                              font: { size: 14, color: cor, family: 'Inter', weight: 900 },
                              showarrow: false,
                              x: 0.5,
                              y: 0.5,
                            }],
                          }}
                          config={{ displayModeBar: false, responsive: true }}
                          style={{ width: '100%', maxWidth: '110px' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-[#2A2A2A] bg-[#0c0c0c] p-6 text-center text-[11px] text-muted">
                Sem inventários no ano selecionado para calcular acurácia.
              </div>
            )}
          </div>
        </div>

        <div className="max-h-[540px] overflow-auto custom-scrollbar overscroll-contain bg-[#0c0c0c]">
          {renderTabelaEmpresaResumo()}
        </div>
      </div>

      {/* --- MODAL TELA CHEIA DA TABELA RESUMO ANUAL POR EMPRESA --- */}
      {tabelaEmpresaTelaCheia && (
        <FullScreenPortal onClose={() => setTabelaEmpresaTelaCheia(false)}>
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
                  Resumo Anual de Inventário por Empresa — {periodoAnoLabel} (Tela Cheia)
                </h2>
                <span className="text-xs bg-accent/15 text-accent px-2.5 py-1 rounded-md font-mono border border-accent/30 font-bold shadow-inner">
                  {linhasEmpresaExibidas.length} empresas
                </span>
              </div>

              <div className="flex gap-3 items-center">
                <button
                  onClick={exportarExcelResumoEmpresa}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)] hover:shadow-[0_0_20px_rgba(46,204,113,0.3)] transform hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Baixar Base Excel</span>
                </button>

                <button
                  onClick={exportarPdfResumoEmpresa}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)] hover:shadow-[0_0_20px_rgba(231,76,60,0.3)] transform hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Exportar PDF</span>
                </button>

                <button
                  onClick={() => setTabelaEmpresaTelaCheia(false)}
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
                  placeholder="Buscar empresa pelo nome..."
                  value={buscaEmpresaResumo}
                  onChange={(e) => setBuscaEmpresaResumo(e.target.value)}
                  className="w-full bg-[#080808] border border-[#2a2a2a] text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-accent text-xs transition-colors"
                />
              </div>
            </div>

            <div className="flex-grow overflow-hidden p-4 sm:p-6 bg-[#080808]">
              <div className="border border-[#2A2A2A] rounded-xl bg-[#0c0c0c] overflow-auto custom-scrollbar shadow-2xl h-full">
                {renderTabelaEmpresaResumo()}
              </div>
            </div>
          </div>
        </FullScreenPortal>
      )}

      {/* MODAL EM TELA CHEIA */}
      {isModalOpen && (
        <FullScreenPortal onClose={fecharModalDivergencias}>
          <div className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm">
            <div className="flex justify-between items-center px-6 py-4 bg-[#121212] border-b border-[#2A2A2A] shadow-xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/40 shadow-inner shrink-0">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-white uppercase tracking-wider">Lista Completa de Itens Divergentes — {periodoMesLabel} (Tela Cheia)</h2>
                <span className="ml-3 text-xs bg-accent/15 text-accent px-2.5 py-1 rounded-md font-mono border border-accent/30 font-bold shadow-inner">
                  Total filtrado: {Number(linhasDivergentesFiltradasModal.length).toLocaleString('pt-BR')} registros
                </span>
              </div>
              <div className="flex gap-3 items-center">
                <button onClick={exportarExcelDivergencias} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2e22] hover:bg-[#203a2b] text-[#2ecc71] border border-[#2ecc71]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(46,204,113,0.15)]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span>Baixar Excel Completo</span>
                </button>
                <button onClick={fecharModalDivergencias} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a1616] hover:bg-[#3a1c1c] text-[#e74c3c] border border-[#e74c3c]/40 text-xs font-bold transition-all shadow-[0_0_15px_rgba(231,76,60,0.15)]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Fechar Janela</span>
                </button>
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
                <div className="grid grid-cols-12 px-3 py-2.5 border-b border-[#222222] text-[10px] font-bold text-[#8c9ba5] uppercase tracking-wider bg-[#101010] shrink-0">
                  <div className="col-span-2">Unidade</div>
                  <div className="col-span-1 text-center">Nº Inv.</div>
                  <div className="col-span-1 px-1">Código SKU</div>
                  <div className="col-span-3 px-2">Nome do Produto</div>
                  <div className="col-span-1 text-right">Sistema</div>
                  <div className="col-span-1 text-right">Físico</div>
                  <div className="col-span-1 text-right">Divergência</div>
                  <div className="col-span-1 text-right">Preço Médio</div>
                  <div className="col-span-1 text-right">Valor Total</div>
                </div>
                <div 
                  className="overflow-y-auto custom-scrollbar flex-grow max-h-[70vh] p-1 space-y-1 outline-none focus:ring-1 focus:ring-accent/30" 
                  tabIndex={0} 
                  role="list"
                >
                  {linhasDivergentesFiltradasModal.slice(0, 1000).map((row, idx) => (
                    <DivergenceRowItem key={idx} row={row} index={idx} isModal={true} />
                  ))}
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
        isSelected ? 'bg-[#1c1612] border-l-3 border-l-accent border border-accent shadow-[0_0_15px_rgba(245,130,32,0.2)]' : 'bg-[#111111] border-l-3 border-l-transparent border border-[#2A2A2A] hover:border-[#444]'
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