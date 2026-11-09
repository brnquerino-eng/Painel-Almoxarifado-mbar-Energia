// src/components/PergunteAoEstoque.jsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Sparkles, Trash2, RefreshCw, HelpCircle, ArrowRight, AlertTriangle, CheckCircle2, Database } from 'lucide-react';

const SUGGESTIONS = [
  "Quais são os 5 itens com maior valor em estoque?",
  "Quais unidades possuem materiais em estado crítico?",
  "Qual o valor total acumulado no estoque e divisão por unidade?",
  "Resumo executivo do estoque por segmento e região"
];

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

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Pré-agrega os dados do estoque para otimizar consumo de tokens e fornecer contexto rico à IA
  const contextoResumido = useMemo(() => {
    if (!data || data.length === 0) return null;

    const totalItens = data.length;
    let valorTotalEstoque = 0;
    let valorTotalEntradas = 0;
    let valorTotalSaidas = 0;
    
    const porUnidade = {};
    const porCategoria = {};
    const porSegmento = {};
    const itensCriticos = [];

    data.forEach(item => {
      const valSaldo = Number(item.valor_saldo_atual) || 0;
      const valEntrada = Number(item.valor_entrada_compras) || 0;
      const valSaida = Number(item.valor_saida_cons_interno) || 0;

      valorTotalEstoque += valSaldo;
      valorTotalEntradas += valEntrada;
      valorTotalSaidas += valSaida;

      // Agrupamento por Unidade
      const und = item.unidade_almoxarifado || 'N/A';
      if (!porUnidade[und]) porUnidade[und] = { saldo: 0, qtdItens: 0 };
      porUnidade[und].saldo += valSaldo;
      porUnidade[und].qtdItens += 1;

      // Agrupamento por Categoria (GE)
      const cat = item.ge || 'OUTROS';
      if (!porCategoria[cat]) porCategoria[cat] = 0;
      porCategoria[cat] += valSaldo;

      // Agrupamento por Segmento
      const seg = item.Segmento || 'N/A';
      if (!porSegmento[seg]) porSegmento[seg] = 0;
      porSegmento[seg] += valSaldo;

      // Lista de Itens Críticos
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

    // Top 10 Itens por Valor de Saldo
    const top10Maiores = [...data]
      .sort((a, b) => (Number(b.valor_saldo_atual) || 0) - (Number(a.valor_saldo_atual) || 0))
      .slice(0, 10)
      .map(i => ({
        codigo: i.codigo_produto,
        nome: i.nome_produto,
        unidade: i.unidade_almoxarifado,
        valor: i.valor_saldo_atual,
        qtd: i.qtde_saldo_atual,
        precoMedio: i.preco_medio,
        mes: i.mes_referencia,
        ano: i.ano_referencia
      }));

    return {
      estatisticasGerais: {
        totalRegistros: totalItens,
        valorTotalEstoque,
        valorTotalEntradas,
        valorTotalSaidas,
        qtdItensCriticos: itensCriticos.length
      },
      resumoPorUnidade: porUnidade,
      resumoPorCategoria: porCategoria,
      resumoPorSegmento: porSegmento,
      top10ItensMaiorValor: top10Maiores,
      amostraItensCriticos: itensCriticos.slice(0, 10)
    };
  }, [data]);

  const consultarGeminiAPI = async (perguntaUsuario) => {
    if (!apiKey || apiKey.includes('SUA_CHAVE')) {
      return "⚠️ **Chave de API não configurada.** Por favor, adicione sua chave em `VITE_GEMINI_API_KEY` no arquivo `.env` para ativar a IA.";
    }

    if (!contextoResumido) {
      return "⚠️ **Base de dados zerada ou sincronizando.** Aguarde o término da sincronização ou clique em 'Atualizar Dados' no menu lateral.";
    }

    const promptSistema = `
Você é a Assistente Virtual Executiva de Inteligência do Almoxarifado da Âmbar Energia.
Sua missão é responder perguntas sobre o estoque de forma clara, objetiva, profissional e orientada a dados.

Abaixo está o resumo consolidado e estruturado do banco de dados de estoque atualmente carregado:
${JSON.stringify(contextoResumido, null, 2)}

Diretrizes de Resposta:
1. Responda em Português do Brasil com tom executivo e dados precisos.
2. Formate valores monetários em Reais (R$) usando separadores brasileiros de milhar e milhão (ex: R$ 1.500.000,00 ou R$ 1,5M).
3. Utilize marcadores em bullet points para listar itens ou unidades quando relevante.
4. Caso a pergunta fuja do escopo do estoque da Âmbar Energia, responda educadamente redirecionando o usuário para análises de inventário e estoque.

Pergunta do Usuário: "${perguntaUsuario}"
`;

// Atualizado para a versão ativa gemini-3.8-flash
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptSistema }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'Erro ao conectar à API do Gemini.');
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível obter a resposta da IA.';
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
      const responseText = await consultarGeminiAPI(query);
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
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
      {/* Header do Chat com Indicador de Status do Banco */}
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
              {/* Badge de Prontidão da Memória */}
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
          <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-[#CC5500]" />
          <span className="hidden sm:inline">Limpar Chat</span>
        </button>
      </div>

      {/* Sugestões Rápidas (Chips) */}
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

      {/* Janela de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 rounded-xl bg-[#0D0F12] border border-gray-800/80 shadow-inner custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Avatar */}
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 border ${
                msg.sender === 'user'
                  ? 'bg-zinc-800 border-zinc-700 text-gray-200'
                  : 'bg-[#CC5500]/20 border-[#CC5500]/50 text-[#CC5500]'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Conteúdo do Balão */}
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

        {/* Indicador de Carregamento */}
        {isLoading && (
          <div className="flex items-start gap-3 flex-row">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-[#CC5500]/20 border border-[#CC5500]/50 text-[#CC5500]">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-[#12161F] border border-gray-800 rounded-xl rounded-tl-none p-4 text-sm text-gray-400 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#CC5500]" />
              <span>Analisando dados do estoque com Gemini IA...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Campo de Entrada de Mensagem */}
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
                ? "Pergunte sobre curva ABC, estoque parado, fechamento mensal ou insumos..."
                : "Clique em 'Atualizar Dados' no menu lateral para carregar o estoque..."
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
          As respostas são geradas com base na última atualização do banco de dados do Almoxarifado.
        </p>
      </div>
    </div>
  );
}