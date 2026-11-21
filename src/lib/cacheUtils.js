const DB_NAME = 'AmbarCacheDB'
const STORE_NAME = 'cache_store'

export const GLOBAL_CACHE_KEYS = {
  ESTOQUE: 'disco_estoque_v1',
  INVENTARIO: 'disco_inventario_v1',
  ULTIMA_CARGA: 'ambar_disco_ultima_atualizacao',
}

export function openAmbarDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getDiscoCache(key) {
  try {
    const db = await openAmbarDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function setDiscoCache(key, data) {
  try {
    const db = await openAmbarDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(data, key)
      req.onsuccess = () => resolve(true)
      req.onerror = () => resolve(false)
    })
  } catch (e) {
    console.warn('Erro ao gravar no disco IndexedDB:', e)
    return false
  }
}

/**
 * Mescla novos registros no disco sem perder dados de outras usinas já salvas na máquina.
 * Se for carga global (Admin/Gerente), substitui o disco inteiro pela carga mais recente.
 */
export async function mergeDiscoCache(key, novosRegistros, isCargaGlobal = false) {
  if (isCargaGlobal) {
    await setDiscoCache(key, novosRegistros)
    return novosRegistros
  }

  const existente = (await getDiscoCache(key)) || []
  const mapaPorId = new Map()

  existente.forEach((row) => {
    if (row && row.id != null) {
      mapaPorId.set(row.id, row)
    }
  })

  novosRegistros.forEach((row) => {
    if (row && row.id != null) {
      mapaPorId.set(row.id, row)
    }
  })

  const consolidado = Array.from(mapaPorId.values())
  await setDiscoCache(key, consolidado)
  return consolidado
}

/**
 * Cabeça de leitura: filtra os registros do disco de acordo com o perfil do usuário logado.
 */
export function lerDoDiscoPorPerfil(registros = [], isAdmin = false, perfilAcesso = null) {
  if (!Array.isArray(registros) || registros.length === 0) return []

  const cargo = isAdmin ? 'admin' : perfilAcesso?.cargo || 'supervisor'

  if (isAdmin || cargo === 'gerente') {
    return registros
  }

  if (cargo === 'coordenador') {
    const regioesSet = new Set(
      (perfilAcesso?.regioes_permitidas || []).map((r) => String(r).trim().toUpperCase())
    )
    const unidadesEspecificas = (perfilAcesso?.unidades_permitidas || [])
      .map((u) => String(u).trim().toUpperCase())
      .filter(Boolean)
    const temFiltroUnidade = unidadesEspecificas.length > 0
    const unidadesSet = new Set(unidadesEspecificas)

    if (regioesSet.size === 0) return []

    return registros.filter((row) => {
      const reg = String(row['Região'] || row['regiao'] || '').trim().toUpperCase()
      const uni = String(row['unidade_almoxarifado'] || '').trim().toUpperCase()
      if (reg && !regioesSet.has(reg)) return false
      if (temFiltroUnidade && !unidadesSet.has(uni)) return false
      return true
    })
  }

  // Supervisor: lê somente as unidades permitidas (ex.: CANDIOTA ou URUGUAIANA)
  const unidadesSet = new Set(
    (perfilAcesso?.unidades_permitidas || [])
      .map((u) => String(u).trim().toUpperCase())
      .filter(Boolean)
  )

  if (unidadesSet.size === 0) return []

  return registros.filter((row) => {
    const uni = String(row['unidade_almoxarifado'] || '').trim().toUpperCase()
    return unidadesSet.has(uni)
  })
}