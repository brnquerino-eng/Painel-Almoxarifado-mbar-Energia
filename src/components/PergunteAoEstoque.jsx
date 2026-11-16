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
  'No mês atual, quais são os itens sem valor no estoque?',
  'Quais são os 5 itens com maior valor em estoque?',
  'Resumo do estoque por unidade sem gerenciais',
  'Itens críticos APL no período atual'
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

const MAX_ITENS_API = 30;
const MAX_HISTORICO_MSG = 8;

const SCHEMA_BANCO = `
TABELA 1: painel_estoque
Colunas:
- id (int4)
- mes_referencia (int4) -- 1 a 12
- ano_referencia (int4) -- ex: 2026
- unidade_almoxarifado (text)
- codigo_produto (text)
- nome_produto (text)
- un (text) -- unidade de medida (PC, UN, M, L, KG...)
- ge (text) -- grupo de estoque: CON, APL, REP
- item_critico (text) -- 'Sim' ou 'Não'
- localizacao (text) -- endereço físico / prateleira
- qtde_saldo_atual (numeric)
- preco_medio (numeric)
- valor_saldo_atual (numeric)
- codigo_local_estoque (int4)
- nome_local_estoque (text) -- Insumo, Obsoleto, Obra, etc.
- qtde_saida_cons_interno (numeric)
- valor_saida_cons_interno (numeric)
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
DICIONÁRIO DE NEGÓCIO (obrigatório usar ao interpretar a pergunta):

PERÍODO
- mes_referencia (int 1-12): mês, competência, fechamento, "em janeiro", "mês 01", "jan/26"
- ano_referencia (int 4 dígitos): ano, exercício, "em 2026", "este ano"
- Se a pergunta NÃO informar mês/ano → usar o período mais recente informado no contexto

UNIDADE / EMPRESA
- unidade_almoxarifado: unidade, usina, planta, almoxarifado, filial, site → TRIM() + ILIKE '%termo%'
- "Sigla": sigla da empresa/usina (ex: CBA, URU, CUI) → ILIKE '%termo%'
- "nCdEmpresa": código numérico da empresa (ex: 2030) → comparação numérica
- "Segmento":
  • Renovável / Solar → ILIKE '%UFV%'
  • Termelétrica / Térmica → ILIKE '%UTE%'
  • Hidrelétrica / PCH → ILIKE '%PCH%'
- "Região": Norte, Nordeste, Centro-Oeste, Sudeste, Sul → ILIKE '%termo%'
- Gerencial: nome com 'GERENCIAL' é unidade distinta da operacional

PRODUTO / MATERIAL
- codigo_produto: código, SKU, part number, código SAP → texto com aspas
- nome_produto: descrição, material, peça, equipamento → ILIKE '%termo%' (pode quebrar palavras)
- un: unidade de medida (PC, UN, M, L, KG) → ILIKE se vier por extenso

CLASSIFICAÇÃO
- ge (Grupo de Estoque):
  • CON / consumo (grupo) → ge ILIKE '%CON%'
  • APL / aplicação direta → ge ILIKE '%APL%'
  • REP / reposição → ge ILIKE '%REP%'
- item_critico: crítico, estratégico, sobressalente crítico
  • críticos → item_critico ILIKE 'Sim'
  • não críticos → item_critico ILIKE 'Não'

LOCAL
- localizacao: endereço físico, prateleira, corredor, rua, estante, gaveta (NÃO é categoria contábil)
- codigo_local_estoque: código numérico do depósito/categoria
- nome_local_estoque: Insumo, Obsoleto, Obra, Operacional, Crítico (como categoria de local)
  • busca direta ILIKE para Insumo/Obsoleto/Obra

SALDOS E MOVIMENTOS (sempre agregar com SUM quando for total)
- qtde_saldo_atual: quantidade em estoque, saldo físico, "quantas peças", ruptura, sem saldo
  • zerado/sem saldo → COALESCE(qtde_saldo_atual,0) = 0
  • com saldo → qtde_saldo_atual > 0
- preco_medio: preço unitário, custo unitário
- valor_saldo_atual: valor em estoque, montante financeiro, R$ parado → SUM(valor_saldo_atual)
- qtde_saida_cons_interno / valor_saida_cons_interno: consumo interno, quanto gastou/usou
- qtde_entrada_compras / valor_entrada_compras: compras, entradas, volume/valor adquirido

ITENS SEM VALOR FINANCEIRO
- valor zerado / sem valor em R$ → COALESCE(valor_saldo_atual, 0) = 0
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
      text: 'Olá! Sou a assistente do **Almoxarifado Âmbar Energia**, conectada à **Base** completa (`painel_estoque` e `painel_inventario`).\n\nEntendo termos como **APL**, **REP**, **crítico**, **consumo**, **gerenciais** e usinas.\nPerguntas sem data usam o **período mais recente**. O histórico fica ativo até limpar o chat.',
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
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const formatarNumero = (v) => new Intl.NumberFormat('pt-BR').format(v || 0);

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

  const extrairPeriodo = (prompt) => {
    const p = prompt.toLowerCase();
    const recente = getPeriodoMaisRecente();
    const meses = {
      janeiro: 1, jan: 1, '01': 1, '1': 1,
      fevereiro: 2, fev: 2, '02': 2, '2': 2,
      março: 3, marco: 3, mar: 3, '03': 3, '3': 3,
      abril: 4, abr: 4, '04': 4, '4': 4,
      maio: 5, mai: 5, '05': 5, '5': 5,
      junho: 6, jun: 6, '06': 6, '6': 6,
      julho: 7, jul: 7, '07': 7, '7': 7,
      agosto: 8, ago: 8, '08': 8, '8': 8,
      setembro: 9, set: 9, '09': 9, '9': 9,
      outubro: 10, out: 10, '10': 10,
      novembro: 11, nov: 11, '11': 11,
      dezembro: 12, dez: 12, '12': 12
    };

    if (
      p.includes('hoje') ||
      p.includes('atual') ||
      p.includes('agora') ||
      p.includes('recente') ||
      p.includes('último') ||
      p.includes('ultimo')
    ) {
      return { ...recente, origem: 'periodo_atual' };
    }

    let mes = null;
    let ano = null;

    const matchSlash = p.match(/(?:mês|mes)?\s*(\d{1,2})\/(\d{4})/);
    if (matchSlash) {
      return {
        mes: parseInt(matchSlash[1], 10),
        ano: parseInt(matchSlash[2], 10),
        origem: 'explicito'
      };
    }

    const matchAno = p.match(/\b(202[0-9])\b/);
    if (matchAno) ano = parseInt(matchAno[1], 10);

    const matchMes = p.match(
      /mês\s*(\d{1,2})|mes\s*(\d{1,2})|\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/
    );
    if (matchMes) {
      const termo = matchMes[1] || matchMes[2] || matchMes[3];
      if (termo && meses[termo]) mes = meses[termo];
    }

    if (mes === null && ano === null) {
      return { ...recente, origem: 'periodo_atual_padrao' };
    }

    return { mes, ano, origem: 'parcial' };
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
      p.includes('fora gerencial')
    ) {
      return 'sem_gerenciais';
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
    periodoDetectado,
    historicoConversa,
    intencaoGerencial
  ) => {
    const periodoRecente = getPeriodoMaisRecente();
    const refMes = periodoDetectado.mes || periodoRecente.mes;
    const refAno = periodoDetectado.ano || periodoRecente.ano;
    const usouPeriodoAtual =
      periodoDetectado.origem === 'periodo_atual' ||
      periodoDetectado.origem === 'periodo_atual_padrao';

    let regraGerencial = '';
    if (intencaoGerencial === 'sem_gerenciais') {
      regraGerencial =
        "REGRA GERENCIAL: SEM gerenciais. AND TRIM(unidade_almoxarifado) NOT ILIKE '%gerencial%'.";
    } else if (intencaoGerencial === 'somente_gerenciais') {
      regraGerencial =
        "REGRA GERENCIAL: SOMENTE gerenciais. AND TRIM(unidade_almoxarifado) ILIKE '%gerencial%'.";
    } else {
      regraGerencial =
        'REGRA GERENCIAL: Usina citada sozinha (ex: Candiota) prioriza operacional (sem GERENCIAL). Se existirem as duas, mostre separadas.';
    }

    const promptGeradorSQL = `Você é Especialista Sênior em PostgreSQL da Âmbar Energia.
Gere UMA consulta SQL SELECT válida para a Base.

${SCHEMA_BANCO}

${DICIONARIO_NEGOCIO}

HISTÓRICO DA CONVERSA:
${historicoConversa}

PERÍODO:
- Mais recente na Base: ${periodoRecente.mes}/${periodoRecente.ano}
- Período desta pergunta: mes_referencia = ${refMes} AND ano_referencia = ${refAno}
- ${usouPeriodoAtual ? 'Pergunta SEM data → USE o período mais recente.' : 'Use o período da pergunta.'}

${regraGerencial}

REGRAS OBRIGATÓRIAS DO SQL:
1. APENAS SQL puro (SELECT ou WITH). Sem markdown, sem ponto-e-vírgula final.
2. NUNCA INSERT/UPDATE/DELETE/DROP/ALTER.
3. Colunas com maiúsculas: "Sigla", "Segmento", "Região", "nCdEmpresa".
4. NORMALIZAÇÃO de texto: sempre TRIM() + ILIKE em unidade, produto, segmento, região, ge, item_critico quando fizer sentido.
5. APL/REP/CON → filtrar na coluna ge (ILIKE '%APL%' etc.).
6. Crítico → item_critico ILIKE 'Sim'.
7. Consumo → SUM(valor_saida_cons_interno) / SUM(qtde_saida_cons_interno).
8. Valor em estoque → SUM(valor_saldo_atual).
9. Sem valor financeiro → COALESCE(valor_saldo_atual,0)=0. Sem saldo físico → COALESCE(qtde_saldo_atual,0)=0.
10. Candiota ≠ Candiota Gerencial.
11. Pergunta sem mês/ano → mes_referencia = ${refMes} AND ano_referencia = ${refAno}.
12. Listagens: LIMIT ${MAX_ITENS_API}. Use COUNT(*) OVER() AS total_encontrado quando listar itens.
13. Aliases em português.`;

    const geracao = await chamarIAEmCascata(
      promptGeradorSQL,
      `Pergunta do usuário: "${perguntaUsuario}"`,
      900
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
        `SQL anterior falhou.\nSQL:\n${sqlGerado}\nErro:\n${erroBanco.message}\n\nCorrija e retorne APENAS o SELECT. Respeite o dicionário (ge, item_critico, TRIM+ILIKE).`,
        900
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

    const promptFormatador = `Você é a Assistente Executiva do Almoxarifado Âmbar Energia.

HISTÓRICO:
${historicoConversa}

PERGUNTA: "${perguntaUsuario}"
SQL: ${sqlGerado}
PERÍODO: ${String(refMes).padStart(2, '0')}/${refAno}
LINHAS: ${linhas.length}
INTENÇÃO GERENCIAL: ${intencaoGerencial}

DADOS DA BASE:
${JSON.stringify(linhas, null, 2)}

INSTRUÇÕES:
1. Markdown executivo, claro.
2. 2+ registros → tabela markdown.
3. Valores em R$, quantidades com milhar.
4. Códigos entre crases.
5. Se citou usina, deixe claro operacional vs gerencial.
6. Se citou APL/REP/CON/crítico, reflita isso no título/resumo.
7. JSON vazio → informe que não há registros no critério.
8. Sem data na pergunta → deixe explícito o período ${String(refMes).padStart(2, '0')}/${refAno}.
9. Use somente os dados retornados.`;

    const formatacao = await chamarIAEmCascata(
      promptFormatador,
      'Formate a resposta executiva.',
      1800
    );
    if (!formatacao) return null;

    return {
      texto: formatacao.text,
      sql: sqlGerado,
      provedor: `Base SQL • ${formatacao.provedor}`
    };
  };

  const processarConsultaLocal = (pergunta, mes, ano, intencaoGerencial) => {
    if (!data?.length) return null;
    const p = pergunta.toLowerCase();

    let dadosFiltrados = data.filter((item) => {
      const itemMes = Number(item.mes_referencia);
      const itemAno = Number(item.ano_referencia);
      const bateMes = mes ? itemMes === mes : true;
      const bateAno = ano ? itemAno === ano : true;
      return bateMes && bateAno;
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

    // Filtros de vocabulário no motor local
    if (p.includes('apl')) {
      dadosFiltrados = dadosFiltrados.filter((i) =>
        String(i.ge || '').toUpperCase().includes('APL')
      );
    }
    if (p.includes('rep') && !p.includes('represent')) {
      dadosFiltrados = dadosFiltrados.filter((i) =>
        String(i.ge || '').toUpperCase().includes('REP')
      );
    }
    if (/\bcon\b/.test(p) || p.includes('grupo con')) {
      dadosFiltrados = dadosFiltrados.filter((i) =>
        String(i.ge || '').toUpperCase().includes('CON')
      );
    }
    if (p.includes('crítico') || p.includes('critico')) {
      dadosFiltrados = dadosFiltrados.filter((i) =>
        String(i.item_critico || '').toLowerCase().includes('sim')
      );
    }

    if (!dadosFiltrados.length) return null;

    const nomeMesStr = mes ? String(mes).padStart(2, '0') : 'Todos';
    const anoStr = ano ? String(ano) : 'Todos';

    let valorTotalEstoque = 0;
    let valorTotalEntradas = 0;
    let valorTotalSaidas = 0;
    const porUnidade = {};

    dadosFiltrados.forEach((item) => {
      const valSaldo = Number(item.valor_saldo_atual) || 0;
      const valEntrada = Number(item.valor_entrada_compras) || 0;
      const valSaida = Number(item.valor_saida_cons_interno) || 0;
      valorTotalEstoque += valSaldo;
      valorTotalEntradas += valEntrada;
      valorTotalSaidas += valSaida;

      const und = (item.unidade_almoxarifado || 'N/A').trim();
      if (!porUnidade[und]) porUnidade[und] = { saldo: 0, qtdItens: 0, consumo: 0 };
      porUnidade[und].saldo += valSaldo;
      porUnidade[und].qtdItens += 1;
      porUnidade[und].consumo += valSaida;
    });

    if (p.includes('maior') || p.includes('top')) {
      const top = [...dadosFiltrados]
        .sort((a, b) => (Number(b.valor_saldo_atual) || 0) - (Number(a.valor_saldo_atual) || 0))
        .slice(0, 10);
      let resposta = `### 🏆 Top 10 — ${nomeMesStr}/${anoStr}\n\n`;
      resposta += `| # | Código | Material | Unidade | Valor |\n| :---: | :--- | :--- | :--- | :---: |\n`;
      top.forEach((i, idx) => {
        resposta += `| ${idx + 1} | \`${i.codigo_produto || 'S/C'}\` | ${i.nome_produto} | ${i.unidade_almoxarifado} | ${formatarMoeda(i.valor_saldo_atual)} |\n`;
      });
      return resposta;
    }

    let resposta = `### 📊 Resumo do Estoque — ${nomeMesStr}/${anoStr}\n\n`;
    if (intencaoGerencial === 'sem_gerenciais') resposta += `_Filtro: sem unidades gerenciais_\n\n`;
    if (intencaoGerencial === 'somente_gerenciais') resposta += `_Filtro: somente unidades gerenciais_\n\n`;
    if (p.includes('apl')) resposta += `_Filtro: GE APL_\n\n`;
    if (p.includes('rep') && !p.includes('represent')) resposta += `_Filtro: GE REP_\n\n`;
    if (p.includes('crítico') || p.includes('critico')) resposta += `_Filtro: itens críticos_\n\n`;

    resposta += `• **Valor Total:** ${formatarMoeda(valorTotalEstoque)}\n`;
    resposta += `• **Entradas:** ${formatarMoeda(valorTotalEntradas)}\n`;
    resposta += `• **Saídas (consumo):** ${formatarMoeda(valorTotalSaidas)}\n`;
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
      const periodo = extrairPeriodo(query);
      const { mes, ano } = periodo;
      const nomeMesStr = mes ? String(mes).padStart(2, '0') : 'Histórico';
      const anoStr = ano ? String(ano) : 'Completo';
      const historico = montarHistoricoConversa();
      const intencaoGerencial = extrairIntencaoGerencial(query);

      const resultadoSQL = await consultarViaBaseSQL(
        query,
        periodo,
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
            badge: `${nomeMesStr}/${anoStr} • ${resultadoSQL.provedor}`
          }
        ]);
        return;
      }

      const local = processarConsultaLocal(query, mes, ano, intencaoGerencial);
      if (local) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: local,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            badge: `${nomeMesStr}/${anoStr} • Motor Local`
          }
        ]);
      } else {
        throw new Error(
          `Sem dados para ${nomeMesStr}/${anoStr}. Verifique se a função de consulta da Base está ativa.`
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
              Base • APL/REP/Críticos • Busca inteligente • Âmbar Energia
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
                ? 'Ex: itens críticos APL | Candiota sem gerenciais | consumo atual'
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
          Base com dicionário de negócio • Memória até limpar o chat • Âmbar Energia
        </p>
      </div>
    </div>
  );
}