import { useState, useEffect, useCallback } from 'react'
import { supabase, TABLE_INVENTARIO } from '../lib/supabase'
import {
  GLOBAL_CACHE_KEYS,
  getDiscoCache,
  mergeDiscoCache,
  lerDoDiscoPorPerfil,
} from '../lib/cacheUtils'

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
    unidade_almoxarifado: cleanStr(row.empresa_nome).toUpperCase(),
    Região: cleanStr(row.regiao_empresa),
    mes_referencia: cleanStr(row.mes_referencia),
    ano_referencia: cleanStr(row.ano_referencia),
    empresa_nome: cleanStr(row.empresa_nome),
    tipo_inventario: cleanStr(row.tipo_inventario),
    id_inventario: cleanStr(row.id_inventario),
    codigo_produto: cleanStr(row.codigo_produto ?? row.codigo_material ?? row.sku ?? ''),
    saldo_anterior_val: toNum(row.saldo_anterior_val),
    inventario_val: toNum(row.inventario_val),
    diferenca_val: toNum(row.diferenca_val),
    saldo_anterior_qtd: toNum(row.saldo_anterior_qtd),
    quantidade_fisica: toNum(row.quantidade_fisica ?? row.quantidade_contada),
    diferenca_qtd: toNum(row.diferenca_qtd),
    valor_unitario: toNum(row.valor_unitario),
  }
}

export function useInventarioData({ userId, isAdmin = false, perfilAcesso = null } = {}) {
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
        const discoBruto = await getDiscoCache(GLOBAL_CACHE_KEYS.INVENTARIO)
        if (discoBruto && discoBruto.length > 0) {
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
        if (cargo === 'coordenador' && regioesPermitidas.length === 0 && unidadesPermitidas.length === 0) {
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
        let countQuery = supabase
          .from(TABLE_INVENTARIO)
          .select('*', { count: 'exact', head: true })

        if (!isGlobalRole) {
          if (cargo === 'coordenador' && regioesPermitidas.length > 0) {
            countQuery = countQuery.in('regiao_empresa', regioesPermitidas)
          } else if (unidadesPermitidas.length > 0) {
            const orFilter = unidadesPermitidas
              .map((u) => `empresa_nome.ilike.${u}`)
              .join(',')
            countQuery = countQuery.or(orFilter)
          }
        }

        const { count, error: countErr } = await countQuery
        if (countErr) throw countErr

        const totalRows = count || 0
        if (totalRows === 0) {
          setData([])
          setProgress(100)
          setLoading(false)
          return
        }

        const batchSize = 1000
        const batches = Math.ceil(totalRows / batchSize)
        const all = []

        for (let i = 0; i < batches; i++) {
          const from = i * batchSize
          const to = Math.min(from + batchSize - 1, totalRows - 1)

          let attempt = 0
          let success = false
          let lastError = null

          while (attempt < 3 && !success) {
            try {
              let fetchQuery = supabase
                .from(TABLE_INVENTARIO)
                .select('*')
                .order('id', { ascending: true })
                .range(from, to)

              if (!isGlobalRole) {
                if (cargo === 'coordenador' && regioesPermitidas.length > 0) {
                  fetchQuery = fetchQuery.in('regiao_empresa', regioesPermitidas)
                } else if (unidadesPermitidas.length > 0) {
                  const orFilter = unidadesPermitidas
                    .map((u) => `empresa_nome.ilike.${u}`)
                    .join(',')
                  fetchQuery = fetchQuery.or(orFilter)
                }
              }

              const { data: rows, error: fetchErr } = await fetchQuery

              if (fetchErr) throw fetchErr
              if (rows?.length) all.push(...rows.map(normalizeRow))
              success = true
            } catch (e) {
              lastError = e
              attempt++
              if (attempt < 3) {
                await new Promise((r) => setTimeout(r, 400 * attempt))
              }
            }
          }

          if (!success && lastError) throw lastError
          setProgress(Math.round(((i + 1) / batches) * 100))
        }

        const discoAtualizado = await mergeDiscoCache(
          GLOBAL_CACHE_KEYS.INVENTARIO,
          all,
          isGlobalRole
        )
        const fatiaAutorizada = lerDoDiscoPorPerfil(discoAtualizado, isAdmin, perfilAcesso)

        setData(fatiaAutorizada)
      } catch (err) {
        console.error('Erro ao carregar inventário:', err)
        setError(err.message || 'Erro ao carregar inventário')
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