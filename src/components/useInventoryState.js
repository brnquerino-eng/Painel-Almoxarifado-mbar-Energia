import { useReducer } from 'react'

const initialState = {
  escoposSel: [],
  unidadesSel: [],
  anosSel: [],
  tiposEstoqueSel: [],
  periodoAtivo: null,
  activeCard: null,
  selectedBarraRanking: null,
  selectedBarraExposicao: null,
  selectedBarraCritico: null,
  selectedBarraObsoleto: null,
  selectedBarraObra: null,
  selectedBarraCompraConsumo: null,
  selectedBarraVariacao: null,
  selectedBarraSkus: null,
  abaVariacao: 'aumento',
  abaSkus: 'unicos',
  abaSkusUnidade: 'unicos',
  filtroMesParado: null,
  listaAberta: false,
  tabelaUnidadesSel: [],
  tabelaMesesSel: [],
  tabelaExpandida: false,
  listaMaioresValoresAberta: false,
  tabelaMaioresValoresExpandida: false,
  listaComprasSemConsumoAberta: false,
  tabelaComprasSemConsumoExpandida: false,
  listaDuplicadosAberta: false,
  tabelaDuplicadosExpandida: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.payload }
    case 'TOGGLE_FIELD':
      return { 
        ...state, 
        [action.field]: state[action.field] === action.payload ? null : action.payload 
      }
    case 'TOGGLE_BOOLEAN':
      return { ...state, [action.field]: !state[action.field] }
    case 'TOGGLE_ACTIVE_CARD':
      return { ...state, activeCard: state.activeCard === action.payload ? null : action.payload }
    case 'SET_ESCOPOS':
      return { ...state, escoposSel: action.payload }
    case 'SET_UNIDADES':
      return { ...state, unidadesSel: action.payload }
    case 'SET_ANOS':
      return { ...state, anosSel: action.payload }
    case 'SET_TIPOS_ESTOQUE':
      return { ...state, tiposEstoqueSel: action.payload }
    case 'SET_PERIODO_ATIVO':
      return { ...state, periodoAtivo: action.payload }
    case 'RESET_SELECOES_FILTRO':
      return {
        ...state,
        selectedBarraRanking: null,
        selectedBarraCritico: null,
        selectedBarraObsoleto: null,
        selectedBarraObra: null,
        selectedBarraCompraConsumo: null,
        selectedBarraVariacao: null,
        selectedBarraSkus: null,
      }
    case 'RESET_FILTROS_GERAIS':
      return {
        ...state,
        escoposSel: [],
        unidadesSel: [],
        anosSel: action.payload ? [action.payload] : [],
        tiposEstoqueSel: [],
        selectedBarraRanking: null,
        selectedBarraCritico: null,
        selectedBarraObsoleto: null,
        selectedBarraObra: null,
        selectedBarraCompraConsumo: null,
        selectedBarraVariacao: null,
        selectedBarraSkus: null,
      }
    default:
      return state
  }
}

export function useInventoryState() {
  const [state, dispatch] = useReducer(reducer, initialState)
  return { state, dispatch }
}