import { useState, useEffect, useCallback } from 'react'
import { supabase, TABLE_ESTOQUE } from '../lib/supabase'
import {
  GLOBAL_CACHE_KEYS,
  getDiscoCache,
  mergeDiscoCache,
  lerDoDiscoPorPerfil,
} from '../lib/cacheUtils'

const COLS = [
  'id',
  'valor_saldo_atual',
  'valor_entrada_compras',
  'valor_saida_cons_interno',
  'unidade_almoxarifado',
  'mes_referencia',
  'ano_referencia',
  'codigo_produto',
  'nome_produto',
  'qtde_saldo_atual',
  'item_critico',
  'nome_local_estoque',
  'codigo_local_estoque',
  'ge',
  'preco_medio',
  'qtde_entrada_compras',
  'Segmento',
  'Região',
].join(',')

function cleanStr(val) {
  if (val == null) return ''
  let s = String(val).trim()
  if (s.endsWith('.0')) s = s.slice(0, -2)
  return s
}

function toNum(val) {
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function normalizeRow(row) {
  return {
    ...row,
    unidade_almoxarifado: cleanStr(row.unidade_almoxarifado).toUpperCase(),
    mes_referencia: cleanStr(row.mes_referencia),
    ano_referencia: cleanStr(row.ano_referencia),
    codigo_produto: cleanStr(row.codigo_produto),
    nome_produto: cleanStr(row.nome_produto),
    item_critico: cleanStr(row.item_critico),
    nome_local_estoque: cleanStr(row.nome_local_estoque),
    codigo_local_estoque: cleanStr(row.codigo_local_estoque),
    ge: cleanStr(row.ge),
    Segmento: cleanStr(row.Segmento || row.segmento),
    Região: cleanStr(row.Região || row.regiao),
    preco_medio: toNum(row.preco_medio),
    qtde_entrada_compras: toNum(row.qtde_entrada_compras),
    valor_saldo_atual: toNum(row.valor_saldo_atual),
    valor_entrada_compras: toNum(row.valor_entrada_compras),
    valor_saida_cons_interno: toNum(row.valor_saida_cons_interno),
    qtde_saldo_atual: toNum(row.qtde_saldo_atual),
    tmp_ano_num: toNum(row.ano_referencia),
    tmp_mes_num: toNum(row.mes_referencia),
  }
}

export function useEstoqueData({ userId, isAdmin = false, perfilAcesso = null } = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)

  const load = useCallback(
    async (forceReload = false) => {
      if (!userId || (!isAdmin && !perfilAcesso)) {
        setData([])
        setLoading(false)
        return
      }

      const cargo = isAdmin ? 'admin' : perfilAcesso?.cargo || 'supervisor'
      const isGlobalRole = isAdmin || cargo === 'gerente'

      if (!forceReload) {
        setLoading(true)
        const discoBruto = await getDiscoCache(GLOBAL_CACHE_KEYS.ESTOQUE)
        const isValidCache =
          discoBruto &&
          discoBruto.length > 0 &&
          'ge' in discoBruto[0] &&
          'preco_medio' in discoBruto[0] &&
          'qtde_entrada_compras' in discoBruto[0] &&
          ('Segmento' in discoBruto[0] || 'segmento' in discoBruto[0]) &&
          ('Região' in discoBruto[0] || 'regiao' in discoBruto[0])

        if (isValidCache) {
          const fatiaAutorizada = lerDoDiscoPorPerfil(discoBruto, isAdmin, perfilAcesso)
          setData(fatiaAutorizada)
          setProgress(100)
        } else {
          setData([])
          setProgress(0)
        }
        setLoading(false)
        return
      }

      const regioesPermitidas = (perfilAcesso?.regioes_permitidas || [])
        .map((r) => cleanStr(r))
        .filter(Boolean)
      const unidadesPermitidas = (perfilAcesso?.unidades_permitidas || [])
        .map((u) => cleanStr(u))
        .filter(Boolean)

      if (!isGlobalRole) {
        if (cargo === 'coordenador' && regioesPermitidas.length === 0) {
          setData([])
          setProgress(100)
          setLoading(false)
          return
        }
        if (cargo === 'supervisor' && unidadesPermitidas.length === 0) {
          setData([])
          setProgress(100)
          setLoading(false)
          return
        }
      }

      setLoading(true)
      setError(null)
      setProgress(0)

      try {
        const batchSize = 500
        const all = []

        let lastId = 0
        let hasMore = true

        while (hasMore) {
          let attempt = 0
          let success = false
          let lastError = null
          let currentBatch = []

          while (attempt < 3 && !success) {
            try {
              let query = supabase
                .from(TABLE_ESTOQUE)
                .select(COLS)
                .order('id')
                .gt('id', lastId)
                .limit(batchSize)

              // Admin / Gerente / Coordenador / Supervisor:
              // Baixamos sem filtro de unidade no servidor para evitar timeout.
              // O filtro fino (unidades do perfil) é feito no cliente pelo lerDoDiscoPorPerfil.
              if (!isGlobalRole && cargo === 'coordenador' && regioesPermitidas.length > 0) {
                query = query.in('Região', regioesPermitidas)
              }
              // Supervisor: não filtra no servidor (evita timeout com ilike)

              const { data: rows, error: fetchErr } = await query

              if (fetchErr) throw fetchErr

              currentBatch = rows || []
              success = true
            } catch (e) {
              lastError = e
              attempt++
              if (attempt < 3) {
                await new Promise((r) => setTimeout(r, 500 * attempt))
              }
            }
          }

          if (!success && lastError) throw lastError

          if (currentBatch.length > 0) {
            all.push(...currentBatch.map(normalizeRow))
            lastId = currentBatch[currentBatch.length - 1].id

            setProgress((prev) => Math.min(prev + 10000 / (all.length + 100), 95))

            if (currentBatch.length < batchSize) {
              hasMore = false
            }
          } else {
            hasMore = false
          }
        }

        const discoAtualizado = await mergeDiscoCache(
          GLOBAL_CACHE_KEYS.ESTOQUE,
          all,
          isGlobalRole
        )
        const fatiaAutorizada = lerDoDiscoPorPerfil(discoAtualizado, isAdmin, perfilAcesso)

        setProgress(100)
        setData(fatiaAutorizada)
      } catch (err) {
        console.error('Erro ao carregar estoque:', err)
        setError(err.message || 'Erro ao carregar dados do Supabase')
        setData([])
      } finally {
        setLoading(false)
      }
    },
    [userId, isAdmin, perfilAcesso]
  )

  useEffect(() => {
    setData([])
    load(false)
  }, [load])

  return { data, loading, error, progress, reload: async () => await load(true) }
}