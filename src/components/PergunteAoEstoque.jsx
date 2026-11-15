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
  'Resumo executivo do estoque por segmento e região',
  'Qual o resumo das diferenças de inventário no período mais recente?'
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
const MAX_HISTORICO_MSG = 8; // últimas mensagens enviadas como memória

const SCHEMA_BANCO_SUPABASE = `
TABELA 1: painel_estoque (Posição mensal, saldos, movimentações e criticidade do almoxarifado)
Colunas:
- id (int4)
- mes_referencia (int4)
- ano_referencia (int4)
- unidade_almoxarifado (text)
- codigo_produto (text)
- nome_produto (text)
- un (text)
- ge (text)
- item_critico (text)
- localizacao (text)
- qtde_saldo_atual (numeric)
- preco_medio (numeric)
- valor_saldo_atual (numeric)
- codigo_local_estoque (int4)
- nome_local_estoque (text)
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

TABELA 2: painel_inventario (Contagens físicas, acuracidade e divergências de inventário)
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

      if (match.index > 0) {
        parts.push(remaining.slice(0, match.index));
      }

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
                      const hasCurrency = cell.includes('R$');
                      const hasNumberPattern = /^-?[\d.,]+%?$/.test(cell);
                      const isNumeric = hasCurrency || hasNumberPattern;
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
      const titleText = trimmed.replace(/^#{2,3}\s+/, '');
      elements.push(
        <h4
          key={`h-${i}`}
          className="mt-3 mb-1.5 text-sm font-bold text-[#FF8533] tracking-wide flex items-center gap-1.5 border-b border-gray-800/80 pb-1"
        >
          {formatInline(titleText)}
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
      const content = trimmed.replace(/^[•\-*]\s+/, '');
      elements.push(
        <div key={`ul-${i}`} className="flex items-start gap-2 my-1 pl-1">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#CC5500] shrink-0" />
          <span className="text-gray-200 leading-relaxed">{formatInline(content)}</span>
        </div>
      );
      i++;
      continue;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={`ol-${i}`} className="flex items-start gap-2 my-1.5 pl-1">
          <span className="px-1.5 py-0.5 text-[11px] font-bold rounded bg-[#CC5500]/20 text-[#FF8533] border border-[#CC5500]/30 shrink-0 mt-0.5 tabular-nums">
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
          className="my-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed"
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
      text: 'Olá! Sou a assistente inteligente do **Almoxarifado Âmbar Energia** conectada diretamente à base completa no **Supabase** (`painel_estoque` e `painel_inventario`).\n\nPosso consultar **100% dos registros**. Perguntas sem data usam automaticamente o **período mais recente** da base. O histórico desta conversa fica ativo até você limpar o chat.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      badge: 'Supabase Full-DB Conectado'
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

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const verificarConexaoRPC = async () => {
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
        console.warn('Verificação inicial RPC Supabase:', err);
      }
    };

    verificarConexaoRPC();
  }, []);

  const formatarMoeda = (valor) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

  const formatarNumero = (valor) => new Intl.NumberFormat('pt-BR').format(valor || 0);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Monta o histórico da conversa para a IA (memória do chat)
  const montarHistoricoConversa = () => {
    const msgsUteis = messages
      .filter((m) => m.sender === 'user' || m.sender === 'bot')
      .filter((m) => m.id !== 1) // ignora saudação inicial
      .slice(-MAX_HISTORICO_MSG);

    if (msgsUteis.length === 0) return 'Nenhuma conversa anterior neste chat.';

    return msgsUteis
      .map((m) => `${m.sender === 'user' ? 'USUÁRIO' : 'ASSISTENTE'}: ${m.text}`)
      .join('\n\n');
  };

  const extrairSQLPuro = (respostaBruta) => {
    if (!respostaBruta) return null;
    let limpo = respostaBruta
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```sql/gi, '')
      .replace(/```/g, '')
      .trim();

    const matchInicio = limpo.match(/\b(SELECT|WITH)\b[\s\S]*/i);
    if (matchInicio) limpo = matchInicio[0].trim();

    return limpo.replace(/;+\s*$/, '').trim();
  };

  const getPeriodoMaisRecente = () => {
    if (dbPeriodoRecente.mes && dbPeriodoRecente.ano) return dbPeriodoRecente;

    if (!data || data.length === 0) return { mes: null, ano: null };

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

  // Extrai período. Se a pergunta for genérica (sem data), usa o período atual da base.
  const extrairPeriodo = (prompt) => {
    const p = prompt.toLowerCase();
    const periodoRecente = getPeriodoMaisRecente();

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

    // Hoje / atual / recente → período mais recente
    if (
      p.includes('hoje') ||
      p.includes('atual') ||
      p.includes('agora') ||
      p.includes('recente') ||
      p.includes('último') ||
      p.includes('ultimo')
    ) {
      return { ...periodoRecente, origem: 'periodo_atual' };
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

    // Pergunta genérica sem qualquer data → sempre período atual da base
    if (mes === null && ano === null) {
      return { ...periodoRecente, origem: 'periodo_atual_padrao' };
    }

    return { mes, ano, origem: 'parcial' };
  };

  const consultarGroqAPI = async (promptSistema, perguntaUsuario, maxTokens = 1500) => {
    if (!groqApiKey || groqApiKey.includes('SUA_CHAVE')) return null;

    const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

    for (const model of GROQ_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(groqEndpoint, {
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
          console.warn(`Groq modelo ${model} → HTTP ${response.status}:`, errorText);
          if (response.status === 401 || response.status === 403) return null;
        }
      } catch (e) {
        const msg = e.name === 'AbortError' ? 'Timeout (25s)' : e.message;
        console.warn(`Erro na tentativa com Groq (${model}):`, msg);
      }
    }
    return null;
  };

  const consultarGeminiAPI = async (promptCompleto, maxTokens = 1500) => {
    if (!geminiApiKey || geminiApiKey.includes('SUA_CHAVE')) return null;

    for (const model of GEMINI_MODELS) {
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(geminiEndpoint, {
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
          console.warn(`Gemini modelo ${model} → HTTP ${response.status}:`, errorText);
          if (response.status === 401 || response.status === 403) return null;
        }
      } catch (e) {
        const msg = e.name === 'AbortError' ? 'Timeout (25s)' : e.message;
        console.warn(`Erro na tentativa com Gemini (${model}):`, msg);
      }
    }
    return null;
  };

  const chamarIAEmCascata = async (promptSistema, promptUsuario, maxTokens = 1500) => {
    const resGroq = await consultarGroqAPI(promptSistema, promptUsuario, maxTokens);
    if (resGroq?.text) return { text: resGroq.text, provedor: 'Groq', model: resGroq.model };

    const resGemini = await consultarGeminiAPI(`${promptSistema}\n\n${promptUsuario}`, maxTokens);
    if (resGemini?.text) return { text: resGemini.text, provedor: 'Gemini', model: resGemini.model };

    return null;
  };

  const consultarViaSupabaseSQL = async (perguntaUsuario, periodoDetectado, historicoConversa) => {
    const periodoRecente = getPeriodoMaisRecente();
    const refMes = periodoDetectado.mes || periodoRecente.mes;
    const refAno = periodoDetectado.ano || periodoRecente.ano;
    const usouPeriodoAtual =
      periodoDetectado.origem === 'periodo_atual' ||
      periodoDetectado.origem === 'periodo_atual_padrao';

    const promptGeradorSQL = `Você é um Especialista Sênior em PostgreSQL da Âmbar Energia.
Sua única tarefa é transformar a pergunta do usuário em UMA consulta SQL SELECT válida para o Supabase.

${SCHEMA_BANCO_SUPABASE}

HISTÓRICO RECENTE DESTA CONVERSA (use para entender follow-ups como "e o mês anterior?", "por unidade?", etc.):
${historicoConversa}

CONTEXTO DE PERÍODO:
- Período mais recente disponível no banco: Mês ${periodoRecente.mes || '?'} / Ano ${periodoRecente.ano || '?'}.
- Período desta pergunta: mes_referencia = ${refMes} AND ano_referencia = ${refAno}.
- ${usouPeriodoAtual ? 'A pergunta NÃO informou data explícita. USE OBRIGATORIAMENTE o período mais recente acima.' : 'Use o período indicado na pergunta.'}

REGRAS OBRIGATÓRIAS DO SQL:
1. Retorne APENAS o código SQL puro, começando com SELECT ou WITH. Sem explicações, sem markdown, sem ponto-e-vírgula no final.
2. NUNCA use INSERT, UPDATE, DELETE, DROP, ALTER.
3. Colunas com maiúsculas/acentos na painel_estoque DEVEM ter aspas duplas: "Sigla", "Segmento", "Região", "nCdEmpresa".
4. Em painel_inventario, "nCdEmpresa" com aspas; sigla_empresa, segmento_empresa, regiao_empresa sem aspas.
5. Se a pergunta for genérica (sem mês/ano), filtre SEMPRE por mes_referencia = ${refMes} AND ano_referencia = ${refAno}.
6. Para comparação mês atual vs anterior, calcule o mês anterior a partir de ${refMes}/${refAno}.
7. Filtros de texto: ILIKE '%termo%'.
8. Itens sem valor: COALESCE(valor_saldo_atual, 0) = 0. Inclua COUNT(*) OVER() AS total_encontrado quando listar.
9. Listagens individuais: LIMIT ${MAX_ITENS_API}. Agrupamentos: limite só se passar de 50 linhas.
10. Aliases em português claros.`;

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
      console.warn('Erro na 1ª tentativa SQL Supabase:', erroBanco.message);
      const correcao = await chamarIAEmCascata(
        promptGeradorSQL,
        `A consulta SQL anterior falhou no PostgreSQL.\nSQL com erro:\n${sqlGerado}\n\nErro:\n${erroBanco.message}\n\nCorrija e retorne APENAS o SELECT válido.`,
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
      console.error('Falha definitiva SQL Supabase:', erroBanco.message);
      return null;
    }

    const linhasRetornadas = Array.isArray(dadosBanco) ? dadosBanco : [];

    const promptFormatador = `Você é a Assistente Virtual Executiva de Inteligência do Almoxarifado da Âmbar Energia.

HISTÓRICO RECENTE DA CONVERSA:
${historicoConversa}

PERGUNTA ATUAL: "${perguntaUsuario}"
SQL EXECUTADO: ${sqlGerado}
PERÍODO CONSULTADO: ${String(refMes).padStart(2, '0')}/${refAno}
TOTAL DE LINHAS RETORNADAS: ${linhasRetornadas.length}

RESULTADO DO BANCO (JSON):
${JSON.stringify(linhasRetornadas, null, 2)}

INSTRUÇÕES:
1. Responda em Markdown, tom executivo, claro e preciso.
2. Com 2+ registros, use TABELA MARKDOWN.
3. Valores em R$ e quantidades com separador de milhar.
4. Códigos de produto entre crases.
5. Se total_encontrado > linhas retornadas, informe o total geral.
6. Se JSON vazio, diga que não há registros no período.
7. Use APENAS os dados retornados. Se a pergunta for genérica, deixe claro que os números são do período ${String(refMes).padStart(2, '0')}/${refAno}.
8. Considere o histórico para follow-ups.`;

    const formatacao = await chamarIAEmCascata(
      promptFormatador,
      'Formate a resposta executiva com base nos dados do banco e no histórico.',
      1800
    );

    if (!formatacao) return null;

    return {
      texto: formatacao.text,
      sql: sqlGerado,
      provedor: `Supabase SQL • ${formatacao.provedor}`
    };
  };

  const processarConsultaLocal = (pergunta, mes, ano) => {
    if (!data || data.length === 0) return null;

    const p = pergunta.toLowerCase();
    const dadosFiltrados = data.filter((item) => {
      const itemMes = Number(item.mes_referencia);
      const itemAno = Number(item.ano_referencia);
      const bateMes = mes ? itemMes === mes : true;
      const bateAno = ano ? itemAno === ano : true;
      return bateMes && bateAno;
    });

    if (dadosFiltrados.length === 0) return null;

    const nomeMesStr = mes ? String(mes).padStart(2, '0') : 'Todos';
    const anoStr = ano ? String(ano) : 'Todos';

    let valorTotalEstoque = 0;
    let valorTotalEntradas = 0;
    let valorTotalSaidas = 0;
    const porUnidade = {};
    const porSegmento = {};
    const porRegiao = {};
    const itensCriticos = [];
    const itensSemValor = [];

    dadosFiltrados.forEach((item) => {
      const valSaldo = Number(item.valor_saldo_atual) || 0;
      const qtdSaldo = Number(item.qtde_saldo_atual) || 0;
      const valEntrada = Number(item.valor_entrada_compras) || 0;
      const valSaida = Number(item.valor_saida_cons_interno) || 0;

      valorTotalEstoque += valSaldo;
      valorTotalEntradas += valEntrada;
      valorTotalSaidas += valSaida;

      const und = item.unidade_almoxarifado || 'N/A';
      if (!porUnidade[und]) porUnidade[und] = { saldo: 0, qtdItens: 0, consumo: 0 };
      porUnidade[und].saldo += valSaldo;
      porUnidade[und].qtdItens += 1;
      porUnidade[und].consumo += valSaida;

      const seg = item.Segmento || item.segmento || 'Não Classificado';
      if (!porSegmento[seg]) porSegmento[seg] = { saldo: 0, qtdItens: 0, consumo: 0 };
      porSegmento[seg].saldo += valSaldo;
      porSegmento[seg].qtdItens += 1;
      porSegmento[seg].consumo += valSaida;

      const reg = item['Região'] || item.regiao || 'Não Classificada';
      if (!porRegiao[reg]) porRegiao[reg] = { saldo: 0, qtdItens: 0, consumo: 0 };
      porRegiao[reg].saldo += valSaldo;
      porRegiao[reg].qtdItens += 1;
      porRegiao[reg].consumo += valSaida;

      const objItem = {
        codigo: item.codigo_produto || 'S/C',
        nome: item.nome_produto || 'Sem descrição',
        unidade: und,
        valor: valSaldo,
        qtd: qtdSaldo
      };

      if (item.item_critico && String(item.item_critico).toUpperCase() === 'SIM') {
        itensCriticos.push(objItem);
      }
      if (valSaldo === 0) itensSemValor.push(objItem);
    });

    if (p.includes('sem valor') || p.includes('zerado') || p.includes('valor zero')) {
      const ordenados = [...itensSemValor].sort((a, b) => b.qtd - a.qtd);
      const amostra = ordenados.slice(0, MAX_ITENS_API);
      let resposta = `### 🔍 Itens Sem Valor em Estoque — ${nomeMesStr}/${anoStr}\n\n`;
      if (ordenados.length === 0) {
        return `${resposta}✅ Nenhum item com valor zerado encontrado neste período.`;
      }
      resposta += `• **Total de SKUs sem valor:** ${formatarNumero(ordenados.length)}\n\n`;
      resposta += `| Código | Material | Unidade | Qtd. Física | Valor Saldo |\n| :--- | :--- | :--- | :---: | :---: |\n`;
      amostra.forEach((i) => {
        resposta += `| \`${i.codigo}\` | ${i.nome} | ${i.unidade} | ${formatarNumero(i.qtd)} | ${formatarMoeda(i.valor)} |\n`;
      });
      return resposta;
    }

    if (p.includes('segmento') || p.includes('região') || p.includes('regiao')) {
      let resposta = `### 🗺️ Resumo por Segmento e Região — ${nomeMesStr}/${anoStr}\n\n`;
      resposta += `| Segmento | SKUs | Consumo | Saldo Atual |\n| :--- | :---: | :---: | :---: |\n`;
      Object.entries(porSegmento)
        .sort((a, b) => b[1].saldo - a[1].saldo)
        .forEach(([seg, info]) => {
          resposta += `| **${seg}** | ${formatarNumero(info.qtdItens)} | ${formatarMoeda(info.consumo)} | ${formatarMoeda(info.saldo)} |\n`;
        });
      resposta += `\n| Região | SKUs | Consumo | Saldo Atual |\n| :--- | :---: | :---: | :---: |\n`;
      Object.entries(porRegiao)
        .sort((a, b) => b[1].saldo - a[1].saldo)
        .forEach(([reg, info]) => {
          resposta += `| **${reg}** | ${formatarNumero(info.qtdItens)} | ${formatarMoeda(info.consumo)} | ${formatarMoeda(info.saldo)} |\n`;
        });
      return resposta;
    }

    if (p.includes('crítico') || p.includes('critico')) {
      let resposta = `### ⚠️ Materiais em Estado Crítico — ${nomeMesStr}/${anoStr}\n\n`;
      resposta += `• **Total de itens críticos:** ${formatarNumero(itensCriticos.length)}\n\n`;
      if (itensCriticos.length > 0) {
        resposta += `| Código | Material | Unidade | Qtd. | Valor Saldo |\n| :--- | :--- | :--- | :---: | :---: |\n`;
        itensCriticos.slice(0, MAX_ITENS_API).forEach((i) => {
          resposta += `| \`${i.codigo}\` | ${i.nome} | ${i.unidade} | ${formatarNumero(i.qtd)} | ${formatarMoeda(i.valor)} |\n`;
        });
      }
      return resposta;
    }

    if (p.includes('maior') || p.includes('top') || p.includes('itens')) {
      const top = [...dadosFiltrados]
        .sort((a, b) => (Number(b.valor_saldo_atual) || 0) - (Number(a.valor_saldo_atual) || 0))
        .slice(0, 10);
      let resposta = `### 🏆 Top 10 Itens com Maior Valor — ${nomeMesStr}/${anoStr}\n\n`;
      resposta += `| # | Código | Material | Unidade | Qtd. | Valor Saldo |\n| :---: | :--- | :--- | :--- | :---: | :---: |\n`;
      top.forEach((i, idx) => {
        resposta += `| ${idx + 1} | \`${i.codigo_produto || 'S/C'}\` | ${i.nome_produto} | ${i.unidade_almoxarifado} | ${formatarNumero(i.qtde_saldo_atual)} | ${formatarMoeda(i.valor_saldo_atual)} |\n`;
      });
      return resposta;
    }

    let resposta = `### 📊 Resumo do Estoque — ${nomeMesStr}/${anoStr}\n\n`;
    resposta += `• **Valor Total em Saldo:** ${formatarMoeda(valorTotalEstoque)}\n`;
    resposta += `• **Entradas (Compras):** ${formatarMoeda(valorTotalEntradas)}\n`;
    resposta += `• **Saídas (Consumo Interno):** ${formatarMoeda(valorTotalSaidas)}\n`;
    resposta += `• **Total de Registros:** ${formatarNumero(dadosFiltrados.length)} SKUs\n\n`;
    resposta += `| Unidade | SKUs | Consumo | Saldo Atual |\n| :--- | :---: | :---: | :---: |\n`;
    Object.entries(porUnidade)
      .sort((a, b) => b[1].saldo - a[1].saldo)
      .slice(0, 12)
      .forEach(([und, info]) => {
        resposta += `| **${und}** | ${formatarNumero(info.qtdItens)} | ${formatarMoeda(info.consumo)} | ${formatarMoeda(info.saldo)} |\n`;
      });

    return resposta;
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const periodo = extrairPeriodo(query);
      const { mes, ano } = periodo;
      const nomeMesStr = mes ? String(mes).padStart(2, '0') : 'Histórico';
      const anoStr = ano ? String(ano) : 'Completo';
      const historicoConversa = montarHistoricoConversa();

      const resultadoSQL = await consultarViaSupabaseSQL(query, periodo, historicoConversa);

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

      const respostaLocal = processarConsultaLocal(query, mes, ano);

      if (respostaLocal) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: respostaLocal,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            badge: `${nomeMesStr}/${anoStr} • Motor Local`
          }
        ]);
      } else {
        throw new Error(
          `Não foi possível consultar o banco e não há dados em memória para ${nomeMesStr}/${anoStr}. Verifique a função 'executar_consulta_ia' no Supabase.`
        );
      }
    } catch (error) {
      console.error('Erro no Pergunte ao Estoque:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: `⚠️ **Não foi possível concluir a consulta:**\n\n${error.message}`,
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
        text: 'Histórico limpo. A memória desta conversa foi reiniciada. Qual consulta deseja fazer agora?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        badge: 'Pronto'
      }
    ]);
  };

  const isReady = dbConnected || (!loading && data.length > 0);
  const periodoAtual = getPeriodoMaisRecente();

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full max-w-6xl mx-auto p-4 md:p-6 text-gray-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 mb-4 rounded-xl bg-gradient-to-r from-[#12161F] via-[#151A25] to-[#12161F] border border-[#CC5500]/30 shadow-lg shadow-black/40 gap-3">
        <div className="flex items-center gap-3">
          <div className="relative p-2.5 rounded-xl bg-[#CC5500]/15 border border-[#CC5500]/40 text-[#FF7A1A] shadow-inner">
            <Sparkles className="w-6 h-6" />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#12161F] ${
                isReady ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-wide text-white uppercase font-sans">
                Pergunte ao Estoque
              </h2>
              {dbConnected ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Database className="w-3 h-3" /> Supabase Full-DB Ativo
                </span>
              ) : loading ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Conectando...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> {data.length.toLocaleString('pt-BR')} itens em memória
                </span>
              )}
              {periodoAtual.mes && periodoAtual.ano && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1E2433] border border-gray-700 text-gray-300">
                  <Calendar className="w-3 h-3 text-[#FF8533]" />
                  Período Atual: {String(periodoAtual.mes).padStart(2, '0')}/{periodoAtual.ano}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Text-to-SQL • Memória de conversa • Âmbar Energia
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-400 transition-all rounded-lg bg-[#1A1F2C] border border-gray-800 hover:border-[#CC5500]/50 hover:text-white shrink-0"
          title="Limpar histórico e memória da conversa"
        >
          <Trash2 className="w-4 h-4 text-gray-400" />
          <span>Limpar Chat</span>
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          <HelpCircle className="w-3.5 h-3.5 text-[#CC5500]" />
          <span>Consultas Sugeridas</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SUGGESTIONS.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSend(suggestion)}
              disabled={isLoading || !isReady}
              className="flex items-center justify-between p-3 text-left transition-all rounded-xl bg-[#12161F] border border-gray-800/90 hover:border-[#CC5500]/60 hover:bg-[#171C28] group text-xs text-gray-300 disabled:opacity-40 shadow-sm"
            >
              <span className="line-clamp-2 leading-snug">{suggestion}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#FF8533] shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 rounded-xl bg-[#0D0F12] border border-gray-800/80 shadow-inner custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 border shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-[#1E2433] border-gray-700 text-gray-200'
                  : 'bg-[#CC5500]/15 border-[#CC5500]/40 text-[#FF8533]'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[88%] md:max-w-[82%] rounded-2xl p-4 text-sm shadow-md ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-br from-[#D86B14] to-[#B84A00] text-white font-medium rounded-tr-none'
                  : 'bg-[#131722] text-gray-200 border border-gray-800/90 rounded-tl-none'
              }`}
            >
              {msg.sender === 'bot' && (
                <div className="flex items-center justify-between gap-4 pb-2 mb-2 border-b border-gray-800/70">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FF8533]">
                    {msg.badge || 'Análise de Estoque'}
                  </span>
                  <div className="flex items-center gap-3">
                    {msg.sql && (
                      <button
                        onClick={() => setVisibleSqlId(visibleSqlId === msg.id ? null : msg.id)}
                        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#FF8533] transition-colors"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>{visibleSqlId === msg.id ? 'Ocultar SQL' : 'Ver SQL'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
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
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
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
          <div className="flex items-start gap-3 flex-row">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0 bg-[#CC5500]/15 border border-[#CC5500]/40 text-[#FF8533]">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-[#131722] border border-gray-800 rounded-2xl rounded-tl-none p-4 text-sm text-gray-300 flex items-center gap-3 shadow-md">
              <RefreshCw className="w-4 h-4 animate-spin text-[#FF8533]" />
              <span>Consultando base e consolidando resposta...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className="mt-4">
        <div className="relative flex items-center rounded-xl bg-[#12161F] border border-gray-800 focus-within:border-[#CC5500] transition-all p-2 shadow-lg">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !isReady}
            placeholder={
              isReady
                ? 'Ex: quantos itens temos em estoque? (usa período atual se não informar data)'
                : 'Conectando à base de dados...'
            }
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading || !isReady}
            className="flex items-center justify-center p-2.5 rounded-lg bg-[#D86B14] text-white hover:bg-[#b85609] transition-colors disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-center text-gray-500">
          Memória ativa neste chat • Perguntas sem data usam o período atual • Limpar Chat reinicia a memória
        </p>
      </div>
    </div>
  );
}