import { useState, useEffect, useCallback } from 'react'
import { supabase, TABLE_INVENTARIO } from '../lib/supabase'

// --- Mágica do IndexedDB (Cache sem limite de tamanho!) ---
const DB_NAME = 'AmbarCacheDB'
const STORE_NAME = 'cache_store'

function getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getCache(key) {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    return null;
  }
}

async function setCache(key, data) {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(data, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.warn('Erro IndexedDB', e)
  }
}
// -----------------------------------------------------------

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

export function useInventarioData() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)

  const load = useCallback(async (forceReload = false) => {
    setLoading(true)
    setError(null)
    setProgress(0)

    // 1. Só verifica o cache se não tiver forçado a busca
    if (!forceReload) {
      const cachedData = await getCache('inventarioData')
      if (cachedData) {
        setData(cachedData)
        setProgress(100)
      }
      setLoading(false)
      return // Morre aqui também! Sem Supabase!
    }

    try {
      const { count, error: countErr } = await supabase
        .from(TABLE_INVENTARIO)
        .select('*', { count: 'exact', head: true })

      if (countErr) throw countErr

      const totalRows = count || 0
      if (totalRows === 0) {
        setData([])
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
            const { data: rows, error: fetchErr } = await supabase
              .from(TABLE_INVENTARIO)
              .select('*')
              .range(from, to)

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

      setData(all)
      await setCache('inventarioData', all)

    } catch (err) {
      console.error('Erro ao carregar inventário:', err)
      setError(err.message || 'Erro ao carregar inventário')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Volta o useEffect para puxar automático do cache ao abrir a página
  useEffect(() => {
    load(false)
  }, [load])

  return { data, loading, error, progress, reload: async () => await load(true) }
}
