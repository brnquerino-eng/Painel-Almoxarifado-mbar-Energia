// src/components/PergunteAoEstoque.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2, RefreshCw, HelpCircle, ArrowRight } from 'lucide-react';

const SUGGESTIONS = [
  "Quais são os 5 itens com maior valor em estoque?",
  "Quais unidades possuem materiais em estado crítico?",
  "Resumo do fechamento de estoque do mês atual",
  "Lista de insumos sem movimentação há mais de 90 dias"
];

export default function PergunteAoEstoque({ onSendQuery }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Olá! Sou a assistente inteligente do Almoxarifado Âmbar Energia. Como posso ajudar com a consulta dos dados de estoque e inventário hoje?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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
      if (onSendQuery) {
        const responseText = await onSendQuery(query);
        const botMsg = {
          id: Date.now() + 1,
          sender: 'bot',
          text: responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        setTimeout(() => {
          const botMsg = {
            id: Date.now() + 1,
            sender: 'bot',
            text: `Recebi sua consulta: "${query}". No Passo 2, conectaremos esta interface diretamente à função de busca e IA no Supabase.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages((prev) => [...prev, botMsg]);
          setIsLoading(false);
        }, 1000);
        return;
      }
    } catch (error) {
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Desculpe, ocorreu um erro ao consultar os dados do estoque. Tente novamente em instantes.',
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

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full max-w-6xl mx-auto p-4 md:p-6 text-gray-100">
      {/* Header do Chat */}
      <div className="flex items-center justify-between p-4 mb-4 rounded-xl bg-[#12161F] border border-[#CC5500]/30 shadow-lg shadow-black/40">
        <div className="flex items-center gap-3">
          <div className="relative p-2.5 rounded-lg bg-[#CC5500]/20 border border-[#CC5500]/50 text-[#CC5500]">
            <Sparkles className="w-6 h-6 animate-pulse" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#12161F]" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-wide text-white uppercase font-sans">
              Pergunte ao Estoque
            </h2>
            <p className="text-xs text-gray-400">
              Assistente de Inteligência Generativa & Analytics • Âmbar Energia
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors rounded-lg bg-[#1A1F2C] border border-gray-800 hover:border-[#CC5500]/50 hover:text-white"
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
              disabled={isLoading}
              className="flex items-center justify-between p-3 text-left transition-all rounded-lg bg-[#12161F] border border-gray-800/80 hover:border-[#CC5500]/60 hover:bg-[#1A1F2C] group text-xs text-gray-300 disabled:opacity-50"
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
              <span>Analisando base de estoque e gerando resposta...</span>
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
            disabled={isLoading}
            placeholder="Pergunte sobre curva ABC, estoque parado, fechamento mensal ou insumos..."
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
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