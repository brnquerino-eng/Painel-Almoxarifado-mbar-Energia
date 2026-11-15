// src/components/PergunteAoEstoque.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2, RefreshCw, HelpCircle, ArrowRight, CheckCircle2, Database } from 'lucide-react';

const SUGGESTIONS = [
  "Qual o valor total do estoque no mês 10 de 2026?",
  "Quais são os 5 itens com maior valor em estoque?",
  "Quais unidades possuem materiais em estado crítico?",
  "Resumo executivo do estoque por segmento e região"
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

const MAX_ITENS_API = 30; // Teto seguro para não estourar tokens

export default function PergunteAoEstoque({ data = [], loading = false }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Olá! Sou a assistente inteligente do Almoxarifado Âmbar Energia. Analiso em tempo real os dados carregados na memória do seu painel. Como posso ajudar com a consulta do estoque hoje?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  };

  // Descobre o período mais recente da base
  const getPeriodoMaisRecente = () => {
    if (!data || data.length === 0) return { mes: null, ano: null };

    let maiorAno = 0;
    let maiorMes = 0;

    data.forEach(item => {
      const ano = Number(item.ano_referencia) || 0;
      const mes = Number(item.mes_referencia) || 0;
      if (ano > maiorAno || (ano === maiorAno && mes > maiorMes)) {
        maiorAno = ano;
        maiorMes = mes;
      }
    });

    return { mes: maiorMes || null, ano: maiorAno || null };
  };

  // Extrai período da pergunta
  const extrairPeriodo = (prompt) => {
    const p = prompt.toLowerCase();

    const meses = {
      'janeiro': 1, 'jan': 1, '01': 1, '1': 1,
      'fevereiro': 2, 'fev': 2, '02': 2, '2': 2,
      'março': 3, 'marco': 3, 'mar': 3, '03': 3, '3': 3,
      'abril': 4, 'abr': 4, '04': 4, '4': 4,
      'maio': 5, 'mai': 5, '05': 5, '5': 5,
      'junho': 6, 'jun': 6, '06': 6, '6': 6,
      'julho': 7, 'jul': 7, '07': 7, '7': 7,
      'agosto': 8, 'ago': 8, '08': 8, '8': 8,
      'setembro': 9, 'set': 9, '09': 9, '9': 9,
      'outubro': 10, 'out': 10, '10': 10,
      'novembro': 11, 'nov': 11, '11': 11,
      'dezembro': 12, 'dez': 12, '12': 12
    };

    if (
      p.includes('hoje') ||
      p.includes('atual') ||
      p.includes('agora') ||
      p.includes('recente') ||
      p.includes('último') ||
      p.includes('ultimo')
    ) {
      return getPeriodoMaisRecente();
    }

    let mes = null;
    let ano = null;

    const matchSlash = p.match(/(?:mês|mes)?\s*(\d{1,2})\/(\d{4})/);
    if (matchSlash) {
      mes = parseInt(matchSlash[1], 10);
      ano = parseInt(matchSlash[2], 10);
      return { mes, ano };
    }

    const matchAno = p.match(/\b(202[0-9])\b/);
    if (matchAno) ano = parseInt(matchAno[1], 10);

    const matchMes = p.match(/mês\s*(\d{1,2})|mes\s*(\d{1,2})|\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/);
    if (matchMes) {
      const termo = matchMes[1] || matchMes[2] || matchMes[3];
      if (termo && meses[termo]) mes = meses[termo];
    }

    if (mes === null && ano === null) {
      return getPeriodoMaisRecente();
    }

    return { mes, ano };
  };

  // Detecta quantos itens o usuário pediu (top N)
  const extrairQuantidadePedida = (prompt) => {
    const p = prompt.toLowerCase();

    // Exemplos: "top 10", "10 maiores", "me liste os 15", "20 itens"
    const match = p.match(/(?:top|os|as|liste|listar|mostre|mostrar|quais são os|me dê os|me de os)?\s*(\d{1,3})\s*(?:maiores|itens|produtos|materiais|valores)?/);
    
    if (match) {
      const qtd = parseInt(match[1], 10);
      if (qtd > 0) return qtd;
    }

    // Se falar "maiores" sem número, assume 10
    if (p.includes('maior') || p.includes('maiores') || p.includes('top')) {
      return 10;
    }

    return 10; // padrão
  };

  // Filtra a base pelo período
  const filtrarPorPeriodo = (mes, ano) => {
    if (!data || data.length === 0) return [];

    return data.filter(item => {
      const itemMes = Number(item.mes_referencia);
      const itemAno = Number(item.ano_referencia);
      const bateMes = mes ? itemMes === mes : true;
      const bateAno = ano ? itemAno === ano : true;
      return bateMes && bateAno;
    });
  };

  // Monta o resumo com quantidade dinâmica
  const montarResumo = (dadosFiltrados, qtdItens = 10) => {
    if (!dadosFiltrados || dadosFiltrados.length === 0) return null;

    const qtdFinal = Math.min(qtdItens, MAX_ITENS_API);

    let valorTotalEstoque = 0;
    let valorTotalEntradas = 0;
    let valorTotalSaidas = 0;

    const porUnidade = {};
    const itensCriticos = [];

    dadosFiltrados.forEach(item => {
      const valSaldo = Number(item.valor_saldo_atual) || 0;
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

      if (item.item_critico && String(item.item_critico).toUpperCase() === 'SIM') {
        itensCriticos.push({
          codigo: item.codigo_produto,
          nome: item.nome_produto,
          unidade: item.unidade_almoxarifado,
          valor: valSaldo,
          qtd: item.qtde_saldo_atual
        });
      }
    });

    const topItens = [...dadosFiltrados]
      .sort((a, b) => (Number(b.valor_saldo_atual) || 0) - (Number(a.valor_saldo_atual) || 0))
      .slice(0, qtdFinal)
      .map(i => ({
        codigo: i.codigo_produto,
        nome: i.nome_produto,
        unidade: i.unidade_almoxarifado,
        valor: Number(i.valor_saldo_atual) || 0,
        qtd: i.qtde_saldo_atual,
        precoMedio: i.preco_medio
      }));

    const topConsumo = Object.entries(porUnidade)
      .map(([unidade, info]) => ({ unidade, ...info }))
      .sort((a, b) => b.consumo - a.consumo)
      .slice(0, 15);

    return {
      estatisticasGerais: {
        totalRegistros: dadosFiltrados.length,
        valorTotalEstoque,
        valorTotalEntradas,
        valorTotalSaidas,
        qtdItensCriticos: itensCriticos.length
      },
      resumoPorUnidade: porUnidade,
      topItensMaiorValor: topItens,
      topUnidadesPorConsumo: topConsumo,
      amostraItensCriticos: itensCriticos.slice(0, 10),
      quantidadeSolicitada: qtdItens,
      quantidadeEnviada: qtdFinal,
      atingiuLimite: qtdItens > MAX_ITENS_API
    };
  };

  // Contexto enxuto para a API
  const montarContextoParaAPI = (resumo) => {
    if (!resumo) return null;

    return {
      estatisticasGerais: resumo.estatisticasGerais,
      topItensMaiorValor: resumo.topItensMaiorValor,
      topUnidadesPorConsumo: resumo.topUnidadesPorConsumo.slice(0, 10),
      resumoPorUnidade: Object.fromEntries(
        Object.entries(resumo.resumoPorUnidade)
          .sort((a, b) => b[1].saldo - a[1].saldo)
          .slice(0, 12)
      ),
      amostraItensCriticos: resumo.amostraItensCriticos.slice(0, 5),
      avisoLimite: resumo.atingiuLimite
        ? `O usuário pediu ${resumo.quantidadeSolicitada} itens, mas o limite máximo enviado é ${MAX_ITENS_API}.`
        : null
    };
  };

  // Motor local
  const processarConsultaLocal = (pergunta, resumo, mes, ano) => {
    if (!resumo) return null;
    const p = pergunta.toLowerCase();
    const nomeMesStr = mes ? String(mes).padStart(2, '0') : 'Todos';
    const anoStr = ano ? String(ano) : 'Todos';

    if (
      (p.includes('valor') && (p.includes('total') || p.includes('acumulado') || p.includes('estoque'))) ||
      p.includes('quanto vale') ||
      p.includes('saldo')
    ) {
      const { valorTotalEstoque, totalRegistros, valorTotalEntradas, valorTotalSaidas } = resumo.estatisticasGerais;

      let resposta = `📊 **Resumo do Estoque — ${nomeMesStr}/${anoStr}**\n\n`;
      resposta += `• **Valor Total em Saldo:** ${formatarMoeda(valorTotalEstoque)}\n`;
      resposta += `• **Total de Registros:** ${totalRegistros.toLocaleString('pt-BR')} SKUs\n`;
      resposta += `• **Entradas (Compras):** ${formatarMoeda(valorTotalEntradas)}\n`;
      resposta += `• **Saídas (Consumo Interno):** ${formatarMoeda(valorTotalSaidas)}\n\n`;
      resposta += `**Divisão por Unidade:**\n`;

      Object.entries(resumo.resumoPorUnidade)
        .sort((a, b) => b[1].saldo - a[1].saldo)
        .slice(0, 10)
        .forEach(([unidade, info]) => {
          resposta += `• **${unidade}:** ${formatarMoeda(info.saldo)} (${info.qtdItens.toLocaleString('pt-BR')} itens)\n`;
        });

      return resposta;
    }

    if (p.includes('maior valor') || p.includes('top') || p.includes('maiores') || p.includes('itens')) {
      const top = resumo.topItensMaiorValor;
      let resposta = `🏆 **Top ${top.length} Itens com Maior Valor — ${nomeMesStr}/${anoStr}**\n\n`;

      if (resumo.atingiuLimite) {
        resposta += `⚠️ Você pediu ${resumo.quantidadeSolicitada} itens. Por limitação técnica, estou retornando no máximo **${MAX_ITENS_API}**.\n\n`;
      }

      top.forEach((item, idx) => {
        resposta += `${idx + 1}. **${item.nome || 'Produto sem descrição'}** (Cód: ${item.codigo || 'N/A'})\n`;
        resposta += `   • **Valor em Saldo:** ${formatarMoeda(item.valor)}\n`;
        resposta += `   • **Unidade:** ${item.unidade || 'N/A'} | **Qtd:** ${item.qtd || 0}\n\n`;
      });

      return resposta;
    }

    if (p.includes('crítico') || p.includes('critico')) {
      const { qtdItensCriticos } = resumo.estatisticasGerais;
      let resposta = `⚠️ **Materiais em Estado Crítico — ${nomeMesStr}/${anoStr}**\n\n`;
      resposta += `Total de itens críticos: **${qtdItensCriticos}**.\n\n`;

      if (resumo.amostraItensCriticos.length > 0) {
        resposta += `**Principais Itens Críticos:**\n`;
        resumo.amostraItensCriticos.forEach((item) => {
          resposta += `• **${item.nome}** (Unidade: ${item.unidade}) - Saldo: ${formatarMoeda(item.valor)}\n`;
        });
      }
      return resposta;
    }

    if (p.includes('unidade') || p.includes('consum')) {
      let resposta = `🏢 **Unidades — ${nomeMesStr}/${anoStr}**\n\n`;

      Object.entries(resumo.resumoPorUnidade)
        .sort((a, b) => b[1].saldo - a[1].saldo)
        .forEach(([unidade, info]) => {
          resposta += `• **${unidade}:** Saldo ${formatarMoeda(info.saldo)} | Consumo ${formatarMoeda(info.consumo)} | ${info.qtdItens.toLocaleString('pt-BR')} SKUs\n`;
        });

      return resposta;
    }

    return null;
  };

  // API Groq
  const consultarGroqAPI = async (promptSistema, perguntaUsuario) => {
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    for (const model of GROQ_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: promptSistema },
              { role: 'user', content: perguntaUsuario }
            ],
            temperature: 0.2,
            max_tokens: 1500
          })
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const dataRes = await response.json();
          const content = dataRes.choices?.[0]?.message?.content;
          if (content) return content;
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

  // API Gemini
  const consultarGeminiAPI = async (promptCompleto) => {
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
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1500
            }
          })
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          const txt = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) return txt;
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

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading || loading || data.length === 0) return;

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
      // 1. Detecta período
      const { mes, ano } = extrairPeriodo(query);
      const nomeMesStr = mes ? String(mes).padStart(2, '0') : 'Todos';
      const anoStr = ano ? String(ano) : 'Todos';

      // 2. Detecta quantos itens o usuário quer
      const qtdPedida = extrairQuantidadePedida(query);

      // 3. Filtra a base
      const dadosFiltrados = filtrarPorPeriodo(mes, ano);

      // 4. Monta resumo com quantidade dinâmica (máx 30)
      const resumo = montarResumo(dadosFiltrados, qtdPedida);
      const contextoAPI = montarContextoParaAPI(resumo);

      let avisoLimite = '';
      if (resumo?.atingiuLimite) {
        avisoLimite = `\n\n⚠️ AVISO AO USUÁRIO: Você solicitou ${qtdPedida} itens. Por limitação técnica de processamento, o sistema retorna no máximo ${MAX_ITENS_API} itens por consulta.`;
      }

      const promptSistema = `Você é a Assistente Virtual Executiva de Inteligência do Almoxarifado da Âmbar Energia.
Responda com clareza, tom executivo e dados consolidados.
Use APENAS os dados do período informado abaixo. Não invente informações.

PERÍODO ANALISADO: ${nomeMesStr}/${anoStr}
TOTAL DE REGISTROS NESTE PERÍODO: ${dadosFiltrados.length}
QUANTIDADE DE ITENS SOLICITADA PELO USUÁRIO: ${qtdPedida}
QUANTIDADE DE ITENS ENVIADA NESTE CONTEXTO: ${resumo?.quantidadeEnviada || 0}
${resumo?.atingiuLimite ? `IMPORTANTE: O usuário pediu mais de ${MAX_ITENS_API} itens. Informe educadamente que o limite máximo por consulta é ${MAX_ITENS_API}.` : ''}

RESUMO DO ESTOQUE NESTE PERÍODO:
${JSON.stringify(contextoAPI, null, 2)}`;

      let responseText = null;

      // 5. Groq
      if (groqApiKey && !groqApiKey.includes('SUA_CHAVE')) {
        responseText = await consultarGroqAPI(promptSistema, query);
      }

      // 6. Gemini
      if (!responseText && geminiApiKey && !geminiApiKey.includes('SUA_CHAVE')) {
        responseText = await consultarGeminiAPI(`${promptSistema}\n\nPergunta do usuário: "${query}"`);
      }

      // 7. Motor Local
      if (!responseText) {
        responseText = processarConsultaLocal(query, resumo, mes, ano);
      }

      if (responseText) {
        // Garante que o aviso de limite apareça mesmo se a IA não mencionar
        if (resumo?.atingiuLimite && !responseText.includes('limitação') && !responseText.includes('máximo')) {
          responseText += avisoLimite;
        }

        const botMsg = {
          id: Date.now() + 1,
          sender: 'bot',
          text: responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(
          `Não encontrei dados para o período ${nomeMesStr}/${anoStr}. Tente outro mês/ano ou verifique se a base está carregada.`
        );
      }
    } catch (error) {
      console.error('Erro no Pergunte ao Estoque:', error);
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: `Desculpe, ocorreu um erro ao processar sua pergunta: ${error.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
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
        text: 'Histórico de mensagens limpo. Como posso ajudar agora?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const isDataReady = !loading && data.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full max-w-6xl mx-auto p-4 md:p-6 text-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 mb-4 rounded-xl bg-[#12161F] border border-[#CC5500]/30 shadow-lg shadow-black/40 gap-3">
        <div className="flex items-center gap-3">
          <div className="relative p-2.5 rounded-lg bg-[#CC5500]/20 border border-[#CC5500]/50 text-[#CC5500]">
            <Sparkles className="w-6 h-6 animate-pulse" />
            <span className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#12161F] ${isDataReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-wide text-white uppercase font-sans">
                Pergunte ao Estoque
              </h2>
              {loading ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando dados...
                </span>
              ) : isDataReady ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> {data.length.toLocaleString('pt-BR')} itens prontos
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 border border-red-500/30 text-red-400">
                  <Database className="w-3 h-3" /> Base não carregada
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Assistente de Inteligência Generativa & Analytics • Âmbar Energia
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors rounded-lg bg-[#1A1F2C] border border-gray-800 hover:border-[#CC5500]/50 hover:text-white shrink-0"
          title="Limpar Histórico"
        >
          <Trash2 className="w-4 h-4 text-gray-400" />
          <span className="hidden sm:inline">Limpar Chat</span>
        </button>
      </div>

      {/* Sugestões */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <HelpCircle className="w-3.5 h-3.5 text-[#CC5500]" />
          <span>Consultas Frequentes</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SUGGESTIONS.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSend(suggestion)}
              disabled={isLoading || !isDataReady}
              className="flex items-center justify-between p-3 text-left transition-all rounded-lg bg-[#12161F] border border-gray-800/80 hover:border-[#CC5500]/60 hover:bg-[#1A1F2C] group text-xs text-gray-300 disabled:opacity-40 disabled:hover:bg-[#12161F] disabled:hover:border-gray-800/80"
            >
              <span className="line-clamp-2">{suggestion}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#CC5500] shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 rounded-xl bg-[#0D0F12] border border-gray-800/80 shadow-inner custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 border ${
                msg.sender === 'user'
                  ? 'bg-zinc-800 border-zinc-700 text-gray-200'
                  : 'bg-[#CC5500]/20 border-[#CC5500]/50 text-[#CC5500]'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[80%] rounded-xl p-4 text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-[#CC5500] text-white font-medium shadow-md shadow-[#CC5500]/10 rounded-tr-none'
                  : 'bg-[#12161F] text-gray-200 border border-gray-800 shadow-md rounded-tl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              <span
                className={`block mt-2 text-[10px] ${
                  msg.sender === 'user' ? 'text-orange-200 text-right' : 'text-gray-500'
                }`}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 flex-row">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-[#CC5500]/20 border border-[#CC5500]/50 text-[#CC5500]">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-[#12161F] border border-gray-800 rounded-xl rounded-tl-none p-4 text-sm text-gray-400 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#CC5500]" />
              <span>Analisando dados do estoque...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="mt-4">
        <div className="relative flex items-center rounded-xl bg-[#12161F] border border-gray-800 focus-within:border-[#CC5500] transition-colors p-2 shadow-lg">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !isDataReady}
            placeholder={
              loading
                ? "Carregando e sincronizando banco de dados..."
                : isDataReady
                ? "Ex: top 10 do mês 5/2026, unidades de hoje, maiores itens em janeiro..."
                : "Clique em 'Atualizar Dados' no menu lateral..."
            }
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading || !isDataReady}
            className="flex items-center justify-center p-2.5 rounded-lg bg-[#CC5500] text-white hover:bg-[#b34700] transition-colors disabled:opacity-40 disabled:hover:bg-[#CC5500] shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-center text-gray-500">
          Respostas por período • Limite de até {MAX_ITENS_API} itens por consulta • Âmbar Energia
        </p>
      </div>
    </div>
  );
}