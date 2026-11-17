// src/components/PergunteAoEstoque.jsx

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Trash2,
  RefreshCw,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  Copy,
  Check,
  Calendar,
  Code2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const SUGGESTIONS = [
  'Qual o valor do estoque nos meses 08, 09 e 10 de 2026?',
  'Valor do estoque do mês 10 somente das ativas',
  'Me traga o valor do estoque de material crítico',
  'Quais itens mais consumiram no período atual?'
];

const GROQ_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b'
];

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash'
];

const MAX_ITENS_API = 50;
const MAX_HISTORICO_MSG = 8;

const SCHEMA_BANCO = `
TABELA 1: painel_estoque
Colunas:
- id (int4)
- mes_referencia (int4) -- 1 a 12
- ano_referencia (int4)
- unidade_almoxarifado (text)
- codigo_produto (text)
- nome_produto (text)
- un (text)
- ge (text) -- CON, APL, REP
- item_critico (text) -- valores como 'Sim', 'Não', '0-Sim', etc.
- localizacao (text)
- qtde_saldo_atual (numeric)
- preco_medio (numeric)
- valor_saldo_atual (numeric)
- codigo_local_estoque (int4)
- nome_local_estoque (text)
- qtde_saida_cons_interno (numeric) -- pode vir negativo (saída)
- valor_saida_cons_interno (numeric) -- pode vir negativo (saída)
- qtde_entrada_compras (numeric)
- valor_entrada_compras (numeric)
- qtde_saida_outras (numeric)
- valor_saida_outras (numeric)
- qtde_entrada_outras (numeric)
- valor_entrada_outras (numeric)
- qtde_saida_inventarios (numeric)
- valor_saida_inventarios (numeric)
- qtde_entrada_inventarios (numeric)
- valor_entrada_inventarios (numeric)
- qtde_saida_devolucoes (numeric)
- valor_saida_devolucoes (numeric)
- qtde_entrada_devolucoes (numeric)
- valor_entrada_devolucoes (numeric)
- qtde_saida_vendas (numeric)
- valor_saida_vendas (numeric)
- qtde_saldo_anterior (numeric)
- valor_saldo_anterior (numeric)
- estoque_minimo (numeric)
- estoque_maximo (numeric)
- duracao_minima_dias (numeric)
- duracao_maxima_dias (numeric)
- aplicacao (text)
- familia (text)
- categoria (text)
- created_at (timestamptz)
- "Sigla" (text)
- "Segmento" (text)
- "Região" (text)
- "nCdEmpresa" (int8)

TABELA 2: painel_inventario
Colunas:
- id (int8)
- data_inicio (text)
- data_fim (text)
- empresa_nome (text)
- codigo_produto (text)
- nome_produto (text)
- localizacao (text)
- valor_unitario (numeric)
- saldo_anterior_consolidado (numeric)
- inventario_consolidado (numeric)
- diferenca_consolidada (numeric)
- saldo_anterior_val (numeric)
- inventario_val (numeric)
- diferenca_val (numeric)
- tipo_inventario (text)
- nome_inventario (text)
- local_estoque (text)
- aplicacao (text)
- familia (text)
- categoria (text)
- id_inventario (text)
- id_local_estoque (text)
- mes_referencia (int4)
- ano_referencia (int4)
- created_at (timestamptz)
- "nCdEmpresa" (int8)
- sigla_empresa (text)
- segmento_empresa (text)
- regiao_empresa (text)
`;

const DICIONARIO_NEGOCIO = `
DICIONÁRIO DE NEGÓCIO (obrigatório):

PERÍODO
- mes_referencia (1-12), ano_referencia (ex: 2026)
- Se NÃO informar data → usar período mais recente do contexto
- Se informar VÁRIOS meses (ex: "meses 08, 09 e 10", "10, 09 e 08 de 2026"):
  → filtrar mes_referencia IN (...) AND ano_referencia = ano
  → agrupar por mes_referencia e devolver comparação em tabela

ATIVAS / OPERACIONAIS
- "ativas", "somente ativas", "unidades ativas", "só operacionais" =
  unidades SEM a palavra GERENCIAL no nome
  → TRIM(unidade_almoxarifado) NOT ILIKE '%gerencial%'
- "somente gerenciais" → TRIM(unidade_almoxarifado) ILIKE '%gerencial%'

CRÍTICO
- item_critico pode ser 'Sim', 'Não', '0-Sim', '0-Não', etc.
- material crítico / item crítico → item_critico ILIKE '%sim%'
- NÃO use igualdade exata 'Sim'

CONSUMO (saída interna)
- Colunas: qtde_saida_cons_interno, valor_saida_cons_interno
- Na Base os valores de saída/consumo frequentemente vêm NEGATIVOS
- Sempre agregar e ordenar com ABS():
  SUM(ABS(COALESCE(valor_saida_cons_interno,0)))
  SUM(ABS(COALESCE(qtde_saida_cons_interno,0)))
- Exibir consumo como valor positivo (quanto foi consumido)
- "itens que mais consumiram":
  WHERE ABS(COALESCE(valor_saida_cons_interno,0)) > 0
     OR ABS(COALESCE(qtde_saida_cons_interno,0)) > 0
  ORDER BY ABS(COALESCE(valor_saida_cons_interno,0)) DESC
  LIMIT N
- NÃO retornar linhas com consumo zero no ranking de maiores consumidores

GE / CLASSIFICAÇÃO
- APL → ge ILIKE '%APL%'
- REP → ge ILIKE '%REP%'
- CON (grupo) → ge ILIKE '%CON%'

OUTROS
- unidade_almoxarifado, nome_produto, "Segmento", "Região": TRIM + ILIKE
- valor em estoque → SUM(valor_saldo_atual)
- saldo físico zerado → COALESCE(qtde_saldo_atual,0)=0
- sem valor financeiro → COALESCE(valor_saldo_atual,0)=0
- Segmento: Solar/Renovável → '%UFV%'; Térmica → '%UTE%'; PCH/Hidro → '%PCH%'
`;

function MarkdownRenderer({ text }) {
  if (!text) return null;

  const formatInline = (line) => {
    const parts = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const codeMatch = remaining.match(/`([^`]+)`/);
      let match = null;
      let type = null;

      if (boldMatch && codeMatch) {
        if (boldMatch.index <= codeMatch.index) {
          match = boldMatch;
          type = 'bold';
        } else {
          match = codeMatch;
          type = 'code';
        }
      } else if (boldMatch) {
        match = boldMatch;
        type = 'bold';
      } else if (codeMatch) {
        match = codeMatch;
        type = 'code';
      }

      if (!match) {
        parts.push(remaining);
        break;
      }

      if (match.index > 0) parts.push(remaining.slice(0, match.index));

      if (type === 'bold') {
        parts.push(
          <strong key={key++} className="font-semibold text-white">
            {match[1]}
          </strong>
        );
      } else {
        parts.push(
          <code
            key={key++}
            className="px-1.5 py-0.5 mx-0.5 text-xs font-mono rounded bg-[#1E2433] text-[#FF8533] border border-[#CC5500]/30"
          >
            {match[1]}
          </code>
        );
      }

      remaining = remaining.slice(match.index + match[0].length);
    }

    return parts;
  };

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().match(/^\|?[\s:-]+\|/)
    ) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const parseRow = (rowStr) =>
          rowStr
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim());

        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);

        elements.push(
          <div
            key={`table-${i}`}
            className="my-3 overflow-x-auto rounded-lg border border-gray-800 bg-[#0D0F12]/90 shadow-inner"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#181D29] border-b border-gray-800 text-[#FF8533] uppercase tracking-wider text-[11px]">
                  {headers.map((h, idx) => (
                    <th key={idx} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                      {formatInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/70">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#1A1F2C]/70 transition-colors">
                    {row.map((cell, cIdx) => {
                      const isNumeric = cell.includes('R$') || /^-?[\d.,]+%?$/.test(cell);
                      return (
                        <td
                          key={cIdx}
                          className={`py-2 px-3 text-gray-300 ${
                            isNumeric ? 'font-mono tabular-nums text-gray-200' : ''
                          }`}
                        >
                          {formatInline(cell)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
      elements.push(
        <h4
          key={`h-${i}`}
          className="mt-3 mb-1.5 text-sm font-bold text-[#FF8533] tracking-wide border-b border-gray-800/80 pb-1"
        >
          {formatInline(trimmed.replace(/^#{2,3}\s+/, ''))}
        </h4>
      );
      i++;
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-gray-800" />);
      i++;
      continue;
    }

    if (/^[•\-*]\s+/.test(trimmed)) {
      elements.push(
        <div key={`ul-${i}`} className="flex items-start gap-2 my-1 pl-1">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#CC5500] shrink-0" />
          <span className="text-gray-200 leading-relaxed">
            {formatInline(trimmed.replace(/^[•\-*]\s+/, ''))}
          </span>
        </div>
      );
      i++;
      continue;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={`ol-${i}`} className="flex items-start gap-2 my-1.5 pl-1">
          <span className="px-1.5 py-0.5 text-[11px] font-bold rounded bg-[#CC5500]/20 text-[#FF8533] border border-[#CC5500]/30 shrink-0 mt-0.5">
            {numMatch[1]}
          </span>
          <span className="text-gray-200 leading-relaxed">{formatInline(numMatch[2])}</span>
        </div>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('⚠️') || trimmed.startsWith('💡')) {
      elements.push(
        <div
          key={`alert-${i}`}
          className="my-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs"
        >
          {formatInline(trimmed)}
        </div>
      );
      i++;
      continue;
    }

    if (trimmed === '') {
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="my-1 text-gray-200 leading-relaxed">
        {formatInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

export default function PergunteAoEstoque({ data = [], loading = false }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Olá! Sou a assistente do **Almoxarifado Âmbar Energia**, conectada à **Base**.\n\nEntendo **vários períodos**, **ativas** (sem gerencial), **críticos**, **APL/REP** e **consumo**.\nPerguntas sem data usam o período mais recente. Histórico ativo até limpar o chat.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      badge: 'Base Conectada'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [visibleSqlId, setVisibleSqlId] = useState(null);
  const [dbPeriodoRecente, setDbPeriodoRecente] = useState({ mes: null, ano: null });
  const [dbConnected, setDbConnected] = useState(false);

  const chatEndRef = useRef(null);
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const verificarConexao = async () => {
      try {
        const { data: pingRes, error: pingErr } = await supabase.rpc('executar_consulta_ia', {
          query_sql: 'SELECT 1 AS ok'
        });

        if (!pingErr && pingRes) {
          setDbConnected(true);
          const { data: perRes, error: perErr } = await supabase.rpc('executar_consulta_ia', {
            query_sql:
              'SELECT ano_referencia AS ano, mes_referencia AS mes FROM painel_estoque WHERE ano_referencia IS NOT NULL AND mes_referencia IS NOT NULL ORDER BY ano_referencia DESC, mes_referencia DESC LIMIT 1'
          });
          if (!perErr && Array.isArray(perRes) && perRes.length > 0) {
            setDbPeriodoRecente({
              mes: Number(perRes[0].mes),
              ano: Number(perRes[0].ano)
            });
          }
        }
      } catch (err) {
        console.warn('Verificação da Base:', err);
      }
    };
    verificarConexao();
  }, []);

  const formatarMoeda = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(v || 0));
  const formatarNumero = (v) => new Intl.NumberFormat('pt-BR').format(Math.abs(v || 0));

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const montarHistoricoConversa = () => {
    const msgs = messages
      .filter((m) => (m.sender === 'user' || m.sender === 'bot') && m.id !== 1)
      .slice(-MAX_HISTORICO_MSG);
    if (msgs.length === 0) return 'Nenhuma conversa anterior neste chat.';
    return msgs.map((m) => `${m.sender === 'user' ? 'USUÁRIO' : 'ASSISTENTE'}: ${m.text}`).join('\n\n');
  };

  const extrairSQLPuro = (texto) => {
    if (!texto) return null;
    let limpo = texto
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```sql/gi, '')
      .replace(/```/g, '')
      .trim();
    const match = limpo.match(/\b(SELECT|WITH)\b[\s\S]*/i);
    if (match) limpo = match[0].trim();
    return limpo.replace(/;+\s*$/, '').trim();
  };

  const getPeriodoMaisRecente = () => {
    if (dbPeriodoRecente.mes && dbPeriodoRecente.ano) return dbPeriodoRecente;
    if (!data?.length) return { mes: null, ano: null };
    let maiorAno = 0;
    let maiorMes = 0;
    data.forEach((item) => {
      const ano = Number(item.ano_referencia) || 0;
      const mes = Number(item.mes_referencia) || 0;
      if (ano > maiorAno || (ano === maiorAno && mes > maiorMes)) {
        maiorAno = ano;
        maiorMes = mes;
      }
    });
    return { mes: maiorMes || null, ano: maiorAno || null };
  };

  // Extrai um ou vários meses + ano
  const extrairPeriodos = (prompt) => {
    const p = prompt.toLowerCase();
    const recente = getPeriodoMaisRecente();
    const mapaMeses = {
      janeiro: 1, jan: 1,
      fevereiro: 2, fev: 2,
      março: 3, marco: 3, mar: 3,
      abril: 4, abr: 4,
      maio: 5, mai: 5,
      junho: 6, jun: 6,
      julho: 7, jul: 7,
      agosto: 8, ago: 8,
      setembro: 9, set: 9,
      outubro: 10, out: 10,
      novembro: 11, nov: 11,
      dezembro: 12, dez: 12
    };

    if (
      p.includes('hoje') ||
      p.includes('atual') ||
      p.includes('agora') ||
      p.includes('recente') ||
      p.includes('último') ||
      p.includes('ultimo')
    ) {
      return {
        meses: recente.mes ? [recente.mes] : [],
        ano: recente.ano,
        origem: 'periodo_atual'
      };
    }

    let ano = null;
    const matchAno = p.match(/\b(202[0-9])\b/);
    if (matchAno) ano = parseInt(matchAno[1], 10);

    // Lista numérica: "10, 09 e 08" / "meses 8, 9 e 10"
    const mesesNum = [];
    const reNum = /(?:mês|mes)?\s*(\d{1,2})(?=\s*[,/e]|\s+e\s+|\s*$|\s+de\s+|\s+do\s+)/gi;
    let m;
    const textoParaNum = p.replace(/\b(20\d{2})\b/g, ' ');
    while ((m = reNum.exec(textoParaNum)) !== null) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 12 && !mesesNum.includes(n)) mesesNum.push(n);
    }

    // Formato 10/2026 isolado
    const matchSlash = p.match(/(\d{1,2})\s*\/\s*(202[0-9])/);
    if (matchSlash) {
      const mesSlash = parseInt(matchSlash[1], 10);
      const anoSlash = parseInt(matchSlash[2], 10);
      if (!mesesNum.includes(mesSlash)) mesesNum.push(mesSlash);
      if (!ano) ano = anoSlash;
    }

    // Nomes de mês
    Object.entries(mapaMeses).forEach(([nome, num]) => {
      if (p.includes(nome) && !mesesNum.includes(num)) mesesNum.push(num);
    });

    if (mesesNum.length === 0 && ano === null) {
      return {
        meses: recente.mes ? [recente.mes] : [],
        ano: recente.ano,
        origem: 'periodo_atual_padrao'
      };
    }

    if (mesesNum.length === 0 && ano !== null) {
      return { meses: [], ano, origem: 'ano_inteiro' };
    }

    return {
      meses: mesesNum.sort((a, b) => a - b),
      ano: ano || recente.ano,
      origem: mesesNum.length > 1 ? 'multiplos' : 'explicito'
    };
  };

  const extrairIntencaoGerencial = (prompt) => {
    const p = prompt.toLowerCase();
    if (
      p.includes('somente gerencial') ||
      p.includes('só gerencial') ||
      p.includes('so gerencial') ||
      p.includes('apenas gerencial') ||
      p.includes('só as gerenciais') ||
      p.includes('somente as gerenciais')
    ) {
      return 'somente_gerenciais';
    }
    if (
      p.includes('sem gerencial') ||
      p.includes('desconsidere gerencial') ||
      p.includes('exceto gerencial') ||
      p.includes('não gerencial') ||
      p.includes('nao gerencial') ||
      p.includes('sem as gerenciais') ||
      p.includes('fora gerencial') ||
      p.includes('somente das ativas') ||
      p.includes('somente ativas') ||
      p.includes('só ativas') ||
      p.includes('so ativas') ||
      p.includes('unidades ativas') ||
      p.includes('empresas ativas') ||
      p.includes('só operacionais') ||
      p.includes('somente operacionais')
    ) {
      return 'sem_gerenciais'; // ativas = sem gerencial
    }
    return 'todos';
  };

  const consultarGroqAPI = async (promptSistema, perguntaUsuario, maxTokens = 1500) => {
    if (!groqApiKey || groqApiKey.includes('SUA_CHAVE')) return null;
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    for (const model of GROQ_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqApiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: promptSistema },
              { role: 'user', content: perguntaUsuario }
            ],
            temperature: 0.1,
            max_tokens: maxTokens
          })
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const dataRes = await response.json();
          const content = dataRes.choices?.[0]?.message?.content;
          if (content) return { text: content, model };
        } else {
          const errorText = await response.text();
          console.warn(`Groq ${model} → HTTP ${response.status}:`, errorText);
          if (response.status === 401 || response.status === 403) return null;
        }
      } catch (e) {
        console.warn(`Erro Groq (${model}):`, e.name === 'AbortError' ? 'Timeout' : e.message);
      }
    }
    return null;
  };

  const consultarGeminiAPI = async (promptCompleto, maxTokens = 1500) => {
    if (!geminiApiKey || geminiApiKey.includes('SUA_CHAVE')) return null;

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptCompleto }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens }
          })
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          const txt = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) return { text: txt, model };
        } else {
          const errorText = await response.text();
          console.warn(`Gemini ${model} → HTTP ${response.status}:`, errorText);
          if (response.status === 401 || response.status === 403) return null;
        }
      } catch (e) {
        console.warn(`Erro Gemini (${model}):`, e.name === 'AbortError' ? 'Timeout' : e.message);
      }
    }
    return null;
  };

  const chamarIAEmCascata = async (promptSistema, promptUsuario, maxTokens = 1500) => {
    const g = await consultarGroqAPI(promptSistema, promptUsuario, maxTokens);
    if (g?.text) return { text: g.text, provedor: 'Groq', model: g.model };
    const ge = await consultarGeminiAPI(`${promptSistema}\n\n${promptUsuario}`, maxTokens);
    if (ge?.text) return { text: ge.text, provedor: 'Gemini', model: ge.model };
    return null;
  };

  const consultarViaBaseSQL = async (
    perguntaUsuario,
    periodos,
    historicoConversa,
    intencaoGerencial
  ) => {
    const periodoRecente = getPeriodoMaisRecente();
    const refAno = periodos.ano || periodoRecente.ano;
    const refMeses = periodos.meses?.length ? periodos.meses : periodoRecente.mes ? [periodoRecente.mes] : [];
    const multiplos = refMeses.length > 1;

    const filtroPeriodoSQL = multiplos
      ? `mes_referencia IN (${refMeses.join(',')}) AND ano_referencia = ${refAno}`
      : refMeses.length === 1
      ? `mes_referencia = ${refMeses[0]} AND ano_referencia = ${refAno}`
      : refAno
      ? `ano_referencia = ${refAno}`
      : `ano_referencia = ${periodoRecente.ano} AND mes_referencia = ${periodoRecente.mes}`;

    let regraGerencial = '';
    if (intencaoGerencial === 'sem_gerenciais') {
      regraGerencial =
        "ATIVAS/SEM GERENCIAIS: AND TRIM(unidade_almoxarifado) NOT ILIKE '%gerencial%'.";
    } else if (intencaoGerencial === 'somente_gerenciais') {
      regraGerencial =
        "SOMENTE GERENCIAIS: AND TRIM(unidade_almoxarifado) ILIKE '%gerencial%'.";
    } else {
      regraGerencial =
        'Se citar usina sozinha (ex: Candiota), priorize operacional (sem GERENCIAL). Se existirem as duas, mostre separadas.';
    }

    const promptGeradorSQL = `Você é Especialista Sênior em PostgreSQL da Âmbar Energia.
Gere UMA consulta SQL SELECT válida.

${SCHEMA_BANCO}

${DICIONARIO_NEGOCIO}

HISTÓRICO:
${historicoConversa}

PERÍODO DETECTADO:
- Ano: ${refAno}
- Meses: ${refMeses.length ? refMeses.join(', ') : 'não especificado'}
- Filtro sugerido: ${filtroPeriodoSQL}
- ${multiplos ? 'MÚLTIPLOS MESES: agrupe por mes_referencia e retorne comparação (GROUP BY mes_referencia).' : 'Um período (ou ano).'}
- ${periodos.origem?.includes('atual') || periodos.origem === 'periodo_atual_padrao' ? 'Pergunta sem data explícita → use período mais recente.' : ''}

${regraGerencial}

REGRAS OBRIGATÓRIAS:
1. APENAS SQL puro (SELECT/WITH). Sem markdown, sem ; no final.
2. NUNCA INSERT/UPDATE/DELETE/DROP/ALTER.
3. Colunas maiúsculas: "Sigla", "Segmento", "Região", "nCdEmpresa".
4. TRIM + ILIKE em textos.
5. Crítico: item_critico ILIKE '%sim%'
6. Consumo: usar ABS(COALESCE(valor_saida_cons_interno,0)) e ABS(COALESCE(qtde_saida_cons_interno,0))
7. Ranking de maiores consumidores: filtrar consumo > 0 e ORDER BY ABS(valor) DESC
8. Ativas: NOT ILIKE '%gerencial%'
9. Listagens: LIMIT ${MAX_ITENS_API}
10. Aliases em português.`;

    const geracao = await chamarIAEmCascata(
      promptGeradorSQL,
      `Pergunta do usuário: "${perguntaUsuario}"`,
      1000
    );
    if (!geracao) return null;

    let sqlGerado = extrairSQLPuro(geracao.text);
    if (!sqlGerado) return null;
    console.log('SQL gerado:', sqlGerado);

    let { data: dadosBanco, error: erroBanco } = await supabase.rpc('executar_consulta_ia', {
      query_sql: sqlGerado
    });

    if (erroBanco) {
      console.warn('Erro 1ª tentativa SQL:', erroBanco.message);
      const correcao = await chamarIAEmCascata(
        promptGeradorSQL,
        `SQL falhou.\nSQL:\n${sqlGerado}\nErro:\n${erroBanco.message}\n\nCorrija. Use ABS no consumo, item_critico ILIKE '%sim%', ativas sem gerencial.`,
        1000
      );
      if (correcao) {
        const sqlCorrigido = extrairSQLPuro(correcao.text);
        if (sqlCorrigido) {
          sqlGerado = sqlCorrigido;
          console.log('SQL corrigido:', sqlGerado);
          const retry = await supabase.rpc('executar_consulta_ia', { query_sql: sqlGerado });
          dadosBanco = retry.data;
          erroBanco = retry.error;
        }
      }
    }

    if (erroBanco) {
      console.error('Falha SQL definitiva:', erroBanco.message);
      return null;
    }

    const linhas = Array.isArray(dadosBanco) ? dadosBanco : [];
    const labelPeriodo = multiplos
      ? `meses ${refMeses.map((m) => String(m).padStart(2, '0')).join(', ')}/${refAno}`
      : `${String(refMeses[0] || '').padStart(2, '0')}/${refAno}`;

    const promptFormatador = `Você é a Assistente Executiva do Almoxarifado Âmbar Energia.

HISTÓRICO:
${historicoConversa}

PERGUNTA: "${perguntaUsuario}"
SQL: ${sqlGerado}
PERÍODO: ${labelPeriodo}
LINHAS: ${linhas.length}
FILTRO ATIVAS/GERENCIAL: ${intencaoGerencial}

DADOS:
${JSON.stringify(linhas, null, 2)}

INSTRUÇÕES:
1. Markdown executivo.
2. 2+ linhas → tabela.
3. Valores monetários em R$ (consumo mostre como positivo = quanto foi consumido).
4. Se múltiplos meses, tabela comparativa por mês.
5. Crítico / ativas / APL etc. deixe explícito no título.
6. JSON vazio → sem registros no critério.
7. Use só os dados retornados.`;

    const formatacao = await chamarIAEmCascata(
      promptFormatador,
      'Formate a resposta executiva.',
      2000
    );
    if (!formatacao) return null;

    return {
      texto: formatacao.text,
      sql: sqlGerado,
      provedor: `Base SQL • ${formatacao.provedor}`,
      labelPeriodo
    };
  };

  const processarConsultaLocal = (pergunta, periodos, intencaoGerencial) => {
    if (!data?.length) return null;
    const p = pergunta.toLowerCase();
    const refAno = periodos.ano;
    const refMeses = periodos.meses || [];

    let dadosFiltrados = data.filter((item) => {
      const itemMes = Number(item.mes_referencia);
      const itemAno = Number(item.ano_referencia);
      const bateAno = refAno ? itemAno === refAno : true;
      const bateMes = refMeses.length ? refMeses.includes(itemMes) : true;
      return bateAno && bateMes;
    });

    if (intencaoGerencial === 'sem_gerenciais') {
      dadosFiltrados = dadosFiltrados.filter(
        (i) => !(i.unidade_almoxarifado || '').toUpperCase().includes('GERENCIAL')
      );
    } else if (intencaoGerencial === 'somente_gerenciais') {
      dadosFiltrados = dadosFiltrados.filter((i) =>
        (i.unidade_almoxarifado || '').toUpperCase().includes('GERENCIAL')
      );
    }

    if (p.includes('apl')) {
      dadosFiltrados = dadosFiltrados.filter((i) =>
        String(i.ge || '').toUpperCase().includes('APL')
      );
    }
    if (/\brep\b/.test(p) || p.includes('reposição') || p.includes('reposicao')) {
      dadosFiltrados = dadosFiltrados.filter((i) =>
        String(i.ge || '').toUpperCase().includes('REP')
      );
    }
    if (p.includes('crítico') || p.includes('critico')) {
      dadosFiltrados = dadosFiltrados.filter((i) =>
        String(i.item_critico || '').toLowerCase().includes('sim')
      );
    }

    if (!dadosFiltrados.length) return null;

    const labelPeriodo =
      refMeses.length > 1
        ? `${refMeses.map((m) => String(m).padStart(2, '0')).join(', ')}/${refAno}`
        : `${String(refMeses[0] || '').padStart(2, '0')}/${refAno}`;

    // Comparativo multi-mês
    if (refMeses.length > 1 && (p.includes('valor') || p.includes('estoque') || p.includes('compar'))) {
      const porMes = {};
      dadosFiltrados.forEach((item) => {
        const m = Number(item.mes_referencia);
        if (!porMes[m]) porMes[m] = { saldo: 0, entradas: 0, consumo: 0, qtd: 0 };
        porMes[m].saldo += Number(item.valor_saldo_atual) || 0;
        porMes[m].entradas += Number(item.valor_entrada_compras) || 0;
        porMes[m].consumo += Math.abs(Number(item.valor_saida_cons_interno) || 0);
        porMes[m].qtd += 1;
      });

      let resposta = `### 📊 Comparativo de Estoque — ${labelPeriodo}\n\n`;
      resposta += `| Mês | Registros | Valor Estoque | Entradas | Consumo |\n| :---: | :---: | :---: | :---: | :---: |\n`;
      Object.keys(porMes)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach((m) => {
          const x = porMes[m];
          resposta += `| ${String(m).padStart(2, '0')}/${refAno} | ${formatarNumero(x.qtd)} | ${formatarMoeda(x.saldo)} | ${formatarMoeda(x.entradas)} | ${formatarMoeda(x.consumo)} |\n`;
        });
      return resposta;
    }

    // Top consumidores
    if (p.includes('consum') && (p.includes('mais') || p.includes('maior') || p.includes('itens'))) {
      const mapa = {};
      dadosFiltrados.forEach((item) => {
        const cod = item.codigo_produto || 'S/C';
        if (!mapa[cod]) {
          mapa[cod] = {
            codigo: cod,
            nome: item.nome_produto || 'Sem descrição',
            unidade: item.unidade_almoxarifado,
            qtd: 0,
            valor: 0
          };
        }
        mapa[cod].qtd += Math.abs(Number(item.qtde_saida_cons_interno) || 0);
        mapa[cod].valor += Math.abs(Number(item.valor_saida_cons_interno) || 0);
      });

      const top = Object.values(mapa)
        .filter((i) => i.valor > 0 || i.qtd > 0)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, MAX_ITENS_API);

      let resposta = `### 📉 Itens que mais consumiram — ${labelPeriodo}\n\n`;
      if (!top.length) {
        return `${resposta}Nenhum consumo registrado neste período.`;
      }
      resposta += `| # | Código | Material | Unidade | Qtd. Consumo | Valor Consumo |\n| :---: | :--- | :--- | :--- | :---: | :---: |\n`;
      top.forEach((i, idx) => {
        resposta += `| ${idx + 1} | \`${i.codigo}\` | ${i.nome} | ${i.unidade} | ${formatarNumero(i.qtd)} | ${formatarMoeda(i.valor)} |\n`;
      });
      return resposta;
    }

    let valorTotal = 0;
    let valorEntradas = 0;
    let valorConsumo = 0;
    const porUnidade = {};

    dadosFiltrados.forEach((item) => {
      const saldo = Number(item.valor_saldo_atual) || 0;
      const entrada = Number(item.valor_entrada_compras) || 0;
      const consumo = Math.abs(Number(item.valor_saida_cons_interno) || 0);
      valorTotal += saldo;
      valorEntradas += entrada;
      valorConsumo += consumo;

      const und = (item.unidade_almoxarifado || 'N/A').trim();
      if (!porUnidade[und]) porUnidade[und] = { saldo: 0, qtdItens: 0, consumo: 0 };
      porUnidade[und].saldo += saldo;
      porUnidade[und].qtdItens += 1;
      porUnidade[und].consumo += consumo;
    });

    if (p.includes('maior') || p.includes('top')) {
      const top = [...dadosFiltrados]
        .sort((a, b) => (Number(b.valor_saldo_atual) || 0) - (Number(a.valor_saldo_atual) || 0))
        .slice(0, Math.min(10, MAX_ITENS_API));
      let resposta = `### 🏆 Top itens por valor — ${labelPeriodo}\n\n`;
      resposta += `| # | Código | Material | Unidade | Valor |\n| :---: | :--- | :--- | :--- | :---: |\n`;
      top.forEach((i, idx) => {
        resposta += `| ${idx + 1} | \`${i.codigo_produto || 'S/C'}\` | ${i.nome_produto} | ${i.unidade_almoxarifado} | ${formatarMoeda(i.valor_saldo_atual)} |\n`;
      });
      return resposta;
    }

    let resposta = `### 📊 Resumo do Estoque — ${labelPeriodo}\n\n`;
    if (intencaoGerencial === 'sem_gerenciais') resposta += `_Filtro: ativas (sem gerenciais)_\n\n`;
    if (p.includes('crítico') || p.includes('critico')) resposta += `_Filtro: material crítico_\n\n`;
    resposta += `• **Valor Total:** ${formatarMoeda(valorTotal)}\n`;
    resposta += `• **Entradas:** ${formatarMoeda(valorEntradas)}\n`;
    resposta += `• **Consumo:** ${formatarMoeda(valorConsumo)}\n`;
    resposta += `• **Registros:** ${formatarNumero(dadosFiltrados.length)}\n\n`;
    resposta += `| Unidade | SKUs | Consumo | Saldo |\n| :--- | :---: | :---: | :---: |\n`;
    Object.entries(porUnidade)
      .sort((a, b) => b[1].saldo - a[1].saldo)
      .slice(0, 15)
      .forEach(([und, info]) => {
        resposta += `| **${und}** | ${formatarNumero(info.qtdItens)} | ${formatarMoeda(info.consumo)} | ${formatarMoeda(info.saldo)} |\n`;
      });
    return resposta;
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const periodos = extrairPeriodos(query);
      const historico = montarHistoricoConversa();
      const intencaoGerencial = extrairIntencaoGerencial(query);

      const labelPeriodo =
        periodos.meses?.length > 1
          ? `${periodos.meses.map((m) => String(m).padStart(2, '0')).join(', ')}/${periodos.ano}`
          : `${String(periodos.meses?.[0] || '').padStart(2, '0')}/${periodos.ano}`;

      const resultadoSQL = await consultarViaBaseSQL(
        query,
        periodos,
        historico,
        intencaoGerencial
      );

      if (resultadoSQL?.texto) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: resultadoSQL.texto,
            sql: resultadoSQL.sql,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            badge: `${resultadoSQL.labelPeriodo || labelPeriodo} • ${resultadoSQL.provedor}`
          }
        ]);
        return;
      }

      const local = processarConsultaLocal(query, periodos, intencaoGerencial);
      if (local) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: local,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            badge: `${labelPeriodo} • Motor Local`
          }
        ]);
      } else {
        throw new Error(
          `Sem dados para ${labelPeriodo}. Verifique a função de consulta da Base.`
        );
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: `⚠️ **Não foi possível concluir:**\n\n${error.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          badge: 'Aviso'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: 'Histórico e memória limpos. Pode perguntar novamente na Base.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        badge: 'Pronto'
      }
    ]);
  };

  const isReady = dbConnected || (!loading && data.length > 0);
  const periodoAtual = getPeriodoMaisRecente();

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full max-w-6xl mx-auto p-4 md:p-6 text-gray-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 mb-4 rounded-xl bg-gradient-to-r from-[#12161F] via-[#151A25] to-[#12161F] border border-[#CC5500]/30 shadow-lg gap-3">
        <div className="flex items-center gap-3">
          <div className="relative p-2.5 rounded-xl bg-[#CC5500]/15 border border-[#CC5500]/40 text-[#FF7A1A]">
            <Sparkles className="w-6 h-6" />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#12161F] ${
                isReady ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-wide text-white uppercase">Pergunte ao Estoque</h2>
              {dbConnected ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Database className="w-3 h-3" /> Base Ativa
                </span>
              ) : loading ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Conectando...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> {data.length.toLocaleString('pt-BR')} em memória
                </span>
              )}
              {periodoAtual.mes && periodoAtual.ano && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-[#1E2433] border border-gray-700 text-gray-300">
                  <Calendar className="w-3 h-3 text-[#FF8533]" />
                  {String(periodoAtual.mes).padStart(2, '0')}/{periodoAtual.ano}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Multi-período • Ativas • Críticos • Consumo • Âmbar Energia
            </p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 rounded-lg bg-[#1A1F2C] border border-gray-800 hover:border-[#CC5500]/50 hover:text-white"
        >
          <Trash2 className="w-4 h-4" />
          Limpar Chat
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase text-gray-400">
          <HelpCircle className="w-3.5 h-3.5 text-[#CC5500]" />
          Consultas Sugeridas
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              disabled={isLoading || !isReady}
              className="flex items-center justify-between p-3 text-left rounded-xl bg-[#12161F] border border-gray-800/90 hover:border-[#CC5500]/60 text-xs text-gray-300 disabled:opacity-40"
            >
              <span className="line-clamp-2">{s}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-500 shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 rounded-xl bg-[#0D0F12] border border-gray-800/80 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 border ${
                msg.sender === 'user'
                  ? 'bg-[#1E2433] border-gray-700'
                  : 'bg-[#CC5500]/15 border-[#CC5500]/40 text-[#FF8533]'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`max-w-[88%] rounded-2xl p-4 text-sm ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-br from-[#D86B14] to-[#B84A00] text-white rounded-tr-none'
                  : 'bg-[#131722] border border-gray-800/90 rounded-tl-none'
              }`}
            >
              {msg.sender === 'bot' && (
                <div className="flex items-center justify-between gap-4 pb-2 mb-2 border-b border-gray-800/70">
                  <span className="text-[10px] font-semibold uppercase text-[#FF8533]">
                    {msg.badge || 'Análise'}
                  </span>
                  <div className="flex items-center gap-3">
                    {msg.sql && (
                      <button
                        onClick={() => setVisibleSqlId(visibleSqlId === msg.id ? null : msg.id)}
                        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#FF8533]"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        {visibleSqlId === msg.id ? 'Ocultar SQL' : 'Ver SQL'}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              {msg.sender === 'bot' && msg.sql && visibleSqlId === msg.id && (
                <div className="mb-3 p-2.5 rounded-lg bg-[#090B0E] border border-gray-800 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                  {msg.sql}
                </div>
              )}
              {msg.sender === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <MarkdownRenderer text={msg.text} />
              )}
              <span
                className={`block mt-2.5 text-[10px] ${
                  msg.sender === 'user' ? 'text-orange-100/80 text-right' : 'text-gray-500 text-right'
                }`}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#CC5500]/15 border border-[#CC5500]/40 text-[#FF8533]">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-[#131722] border border-gray-800 rounded-2xl rounded-tl-none p-4 text-sm text-gray-300 flex items-center gap-3">
              <RefreshCw className="w-4 h-4 animate-spin text-[#FF8533]" />
              Consultando a Base...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="mt-4">
        <div className="relative flex items-center rounded-xl bg-[#12161F] border border-gray-800 focus-within:border-[#CC5500] p-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !isReady}
            placeholder={
              isReady
                ? 'Ex: estoque meses 08,09,10/2026 | ativas | críticos | quem mais consumiu'
                : 'Conectando à Base...'
            }
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading || !isReady}
            className="p-2.5 rounded-lg bg-[#D86B14] text-white hover:bg-[#b85609] disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-center text-gray-500">
          Até {MAX_ITENS_API} itens • Multi-período • Consumo em valor absoluto • Âmbar Energia
        </p>
      </div>
    </div>
  );
}