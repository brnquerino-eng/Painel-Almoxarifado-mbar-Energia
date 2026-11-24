// Lista oficial das unidades exatamente como estão na base
export const UNIDADES_OFICIAIS = [
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
  
  // Normaliza para comparação (remove acento e deixa maiúsculo)
  function normalizeKey(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
  }
  
  // Converte os nomes do perfil (que podem vir em maiúsculo) para os nomes exatos da base
  export function resolverUnidadesExatas(unidadesDoPerfil = []) {
    const mapa = {}
    UNIDADES_OFICIAIS.forEach((oficial) => {
      mapa[normalizeKey(oficial)] = oficial
    })
  
    const resultado = []
    unidadesDoPerfil.forEach((u) => {
      const key = normalizeKey(u)
      if (mapa[key]) {
        resultado.push(mapa[key])
      }
    })
  
    return Array.from(new Set(resultado))
  }