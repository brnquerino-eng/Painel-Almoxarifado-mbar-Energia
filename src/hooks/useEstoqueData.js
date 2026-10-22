import { useState, useEffect, useCallback } from 'react'
import { supabase, TABLE_ESTOQUE } from '../lib/supabase'

// --- Mágica do IndexedDB (Cache com chave única e validação estrutural) ---
const DB_NAME = 'AmbarCacheDB'
const STORE_NAME = 'cache_store'
const CACHE_KEY = 'estoqueData'

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
  'Região'
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

export function useEstoqueData() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)

  const load = useCallback(async (forceReload = false) => {
    setLoading(true)
    setError(null)
    setProgress(0)

    if (!forceReload) {
      const cachedData = await getCache(CACHE_KEY)
      const isValidCache = cachedData && 
                           cachedData.length > 0 && 
                           'ge' in cachedData[0] && 
                           'preco_medio' in cachedData[0] &&
                           'qtde_entrada_compras' in cachedData[0] &&
                           ('Segmento' in cachedData[0] || 'segmento' in cachedData[0]) &&
                           ('Região' in cachedData[0] || 'regiao' in cachedData[0])

      if (isValidCache) {
        setData(cachedData)
        setProgress(100)
        setLoading(false)
        return 
      }
    }

    try {
      // 1. Contagem removida completamente para evitar timeout inicial
      const batchSize = 500 // 2. Lote reduzido para aliviar a carga no servidor
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
            const { data: rows, error: fetchErr } = await supabase
              .from(TABLE_ESTOQUE)
              .select(COLS)
              .order('id')
              .gt('id', lastId)
              .limit(batchSize)

            if (fetchErr) throw fetchErr
            
            currentBatch = rows || []
            success = true
          } catch (e) {
            lastError = e
            attempt++
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 500 * attempt)) // Tempo de espera um pouquinho maior entre tentativas
            }
          }
        }

        if (!success && lastError) throw lastError

        if (currentBatch.length > 0) {
          all.push(...currentBatch.map(normalizeRow))
          lastId = currentBatch[currentBatch.length - 1].id
          
          // 3. Progresso simulado seguro que vai crescendo aos poucos até 95%
          setProgress((prev) => Math.min(prev + (10000 / (all.length + 100)), 95))

          if (currentBatch.length < batchSize) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }

      setProgress(100)
      setData(all)
      await setCache(CACHE_KEY, all)

    } catch (err) {
      console.error('Erro ao carregar estoque:', err)
      setError(err.message || 'Erro ao carregar dados do Supabase')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(false)
  }, [load])

  return { data, loading, error, progress, reload: async () => await load(true) }
}