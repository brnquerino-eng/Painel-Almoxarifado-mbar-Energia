import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const CARGOS = [
  {
    id: 'admin',
    label: 'Admin',
    descricao: 'Acesso irrestrito a todas as unidades e à gestão de acessos',
    badgeClass: 'bg-[#f58220]/20 text-[#f58220] border-[#f58220]/40',
  },
  {
    id: 'gerente',
    label: 'Gerente',
    descricao: 'Visão corporativa completa (todas as regiões e unidades)',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  {
    id: 'coordenador',
    label: 'Coordenador',
    descricao: 'Acesso filtrado por Região operacional selecionada',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    id: 'supervisor',
    label: 'Supervisor',
    descricao: 'Acesso restrito às Unidades de Almoxarifado selecionadas',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
];

export default function ControleAcessos({ estoqueData = [], inventarioData = [], currentUserId }) {
  const [perfis, setPerfis] = useState([]);
  const [loadingPerfis, setLoadingPerfis] = useState(true);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [filtroUnidade, setFiltroUnidade] = useState('');

  // Extrai automaticamente todas as Regiões e Unidades únicas da base carregada
  const { regioesDisponiveis, unidadesDisponiveis, mapaUnidadeRegiao } = useMemo(() => {
    const regSet = new Set();
    const uniSet = new Set();
    const mapa = {};

    estoqueData.forEach((row) => {
      const reg = (row['Região'] || row['regiao'] || '').toString().trim();
      const uni = (row['unidade_almoxarifado'] || '').toString().trim();
      if (reg) regSet.add(reg);
      if (uni) {
        uniSet.add(uni);
        if (reg && !mapa[uni]) mapa[uni] = reg;
      }
    });

    inventarioData.forEach((row) => {
      const uni = (row['unidade_almoxarifado'] || '').toString().trim();
      if (uni) uniSet.add(uni);
    });

    return {
      regioesDisponiveis: Array.from(regSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      unidadesDisponiveis: Array.from(uniSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      mapaUnidadeRegiao: mapa,
    };
  }, [estoqueData, inventarioData]);

  // Carrega todos os perfis da tabela perfis_acesso
  const carregarPerfis = async () => {
    setLoadingPerfis(true);
    setErro(null);
    const { data, error } = await supabase
      .from('perfis_acesso')
      .select('*')
      .order('email', { ascending: true });

    if (error) {
      setErro(`Erro ao carregar perfis: ${error.message}`);
    } else {
      const lista = data || [];
      setPerfis(lista);
      if (!usuarioSelecionadoId && lista.length > 0) {
        setUsuarioSelecionadoId(lista[0].user_id);
      }
    }
    setLoadingPerfis(false);
  };

  useEffect(() => {
    carregarPerfis();
  }, []);

  const usuarioAtual = useMemo(
    () => perfis.find((p) => p.user_id === usuarioSelecionadoId) || null,
    [perfis, usuarioSelecionadoId]
  );

  const perfisFiltrados = useMemo(() => {
    const q = buscaUsuario.trim().toLowerCase();
    if (!q) return perfis;
    return perfis.filter(
      (p) =>
        (p.email || '').toLowerCase().includes(q) ||
        (p.nome || '').toLowerCase().includes(q) ||
        (p.cargo || '').toLowerCase().includes(q)
    );
  }, [perfis, buscaUsuario]);

  const unidadesFiltradas = useMemo(() => {
    const q = filtroUnidade.trim().toLowerCase();
    if (!q) return unidadesDisponiveis;
    return unidadesDisponiveis.filter(
      (u) =>
        u.toLowerCase().includes(q) ||
        (mapaUnidadeRegiao[u] || '').toLowerCase().includes(q)
    );
  }, [unidadesDisponiveis, filtroUnidade, mapaUnidadeRegiao]);

  // Atualiza estado local do perfil em edição
  const atualizarCampoLocal = (campo, valor) => {
    if (!usuarioAtual) return;
    setSucesso(null);
    setPerfis((prev) =>
      prev.map((p) => (p.user_id === usuarioAtual.user_id ? { ...p, [campo]: valor } : p))
    );
  };

  const toggleItemArray = (campo, item) => {
    if (!usuarioAtual) return;
    const listaAtual = Array.isArray(usuarioAtual[campo]) ? usuarioAtual[campo] : [];
    const existe = listaAtual.includes(item);
    const novaLista = existe ? listaAtual.filter((x) => x !== item) : [...listaAtual, item];
    atualizarCampoLocal(campo, novaLista);
  };

  const selecionarTodos = (campo, todosItens) => {
    atualizarCampoLocal(campo, [...todosItens]);
  };

  const limparSelecao = (campo) => {
    atualizarCampoLocal(campo, []);
  };

  const handleSalvarPermissoes = async () => {
    if (!usuarioAtual) return;
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    // Garante que o próprio admin principal não se bloqueie por acidente
    const ehProprioAdmin = usuarioAtual.user_id === currentUserId;
    const payload = {
      nome: usuarioAtual.nome || usuarioAtual.email.split('@')[0],
      cargo: ehProprioAdmin ? 'admin' : usuarioAtual.cargo,
      ativo: ehProprioAdmin ? true : usuarioAtual.ativo,
      regioes_permitidas:
        usuarioAtual.cargo === 'coordenador' ? usuarioAtual.regioes_permitidas || [] : [],
      unidades_permitidas:
        usuarioAtual.cargo === 'supervisor' ? usuarioAtual.unidades_permitidas || [] : [],
      atualizado_em: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('perfis_acesso')
      .update(payload)
      .eq('user_id', usuarioAtual.user_id);

    if (error) {
      setErro(`Falha ao salvar permissões: ${error.message}`);
    } else {
      setSucesso(`Permissões de ${usuarioAtual.email} atualizadas com sucesso!`);
      await carregarPerfis();
    }
    setSalvando(false);
  };

  const getCargoInfo = (cargoId) =>
    CARGOS.find((c) => c.id === cargoId) || CARGOS[3];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#f58220]/15 text-[#f58220] border border-[#f58220]/30">
              Administração
            </span>
            <h2 className="text-xl font-black text-white tracking-tight">
              Controle de Acessos & Abrangência
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Defina a hierarquia (<strong className="text-gray-300">Gerente</strong>,{' '}
            <strong className="text-gray-300">Coordenador</strong> ou{' '}
            <strong className="text-gray-300">Supervisor</strong>) e restrinja quais regiões ou usinas cada usuário enxerga.
          </p>
        </div>

        <button
          onClick={carregarPerfis}
          disabled={loadingPerfis}
          className="px-4 py-2 rounded-xl bg-[#181818] hover:bg-[#222222] border border-[#2E2E2E] text-xs font-bold text-gray-200 transition-all cursor-pointer shrink-0"
        >
          {loadingPerfis ? 'Sincronizando...' : 'Recarregar Usuários'}
        </button>
      </div>

      {/* Alertas */}
      {erro && (
        <div className="bg-red-950/50 border border-red-500/50 text-red-200 text-xs rounded-xl px-4 py-3">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 text-xs rounded-xl px-4 py-3 flex items-center justify-between">
          <span>{sucesso}</span>
          <button
            onClick={() => setSucesso(null)}
            className="text-emerald-400 hover:text-white font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Aviso caso base de estoque ainda não tenha sido carregada */}
      {unidadesDisponiveis.length === 0 && (
        <div className="bg-amber-950/40 border border-[#f58220]/40 text-amber-200 text-xs rounded-xl px-4 py-3">
          <strong>Dica:</strong> Clique em <strong>"Atualizar Dados"</strong> no menu lateral para carregar a lista completa das 38 unidades e regiões antes de configurar supervisores e coordenadores.
        </div>
      )}

      {/* Grid Principal: Lista de Usuários (Esquerda) + Editor de Permissões (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Usuários */}
        <div className="lg:col-span-5 bg-[#111111] border border-[#2A2A2A] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Usuários Cadastrados ({perfis.length})
            </h3>
          </div>

          <input
            type="text"
            value={buscaUsuario}
            onChange={(e) => setBuscaUsuario(e.target.value)}
            placeholder="Buscar por e-mail, nome ou cargo..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#262626] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#f58220]"
          />

          <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
            {loadingPerfis ? (
              <div className="text-center py-10 text-xs text-gray-500">
                Carregando usuários...
              </div>
            ) : perfisFiltrados.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-500">
                Nenhum usuário encontrado. Crie novos logins em Authentication → Users no Supabase.
              </div>
            ) : (
              perfisFiltrados.map((perfil) => {
                const isSelected = perfil.user_id === usuarioSelecionadoId;
                const cargoInfo = getCargoInfo(perfil.cargo);
                return (
                  <button
                    key={perfil.user_id}
                    onClick={() => {
                      setUsuarioSelecionadoId(perfil.user_id);
                      setSucesso(null);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1a0f05] border-[#f58220]/60 shadow-[0_0_15px_rgba(245,130,32,0.12)]'
                        : 'bg-[#151515] border-[#242424] hover:border-[#383838]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {perfil.nome || perfil.email.split('@')[0]}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!perfil.ativo && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                            Bloqueado
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${cargoInfo.badgeClass}`}
                        >
                          {cargoInfo.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate mt-1">
                      {perfil.email}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1.5 font-mono">
                      {perfil.cargo === 'admin' || perfil.cargo === 'gerente'
                        ? 'Abrangência: Todas as unidades'
                        : perfil.cargo === 'coordenador'
                        ? `Regiões: ${(perfil.regioes_permitidas || []).length} selecionada(s)`
                        : `Unidades: ${(perfil.unidades_permitidas || []).length} selecionada(s)`}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-[#222] text-[11px] text-gray-500 leading-relaxed">
            Para adicionar um novo colaborador, cadastre o e-mail/senha dele em{' '}
            <span className="text-gray-300 font-mono">Supabase → Authentication → Users</span>. Ele aparecerá automaticamente aqui.
          </div>
        </div>

        {/* Coluna Direita: Configuração do Usuário Selecionado */}
        <div className="lg:col-span-7 bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6 flex flex-col justify-between gap-6">
          {!usuarioAtual ? (
            <div className="flex items-center justify-center h-64 text-xs text-gray-500">
              Selecione um usuário à esquerda para configurar o acesso.
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {/* Identificação e Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#242424]">
                  <div className="flex-1 space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Nome de Exibição
                    </label>
                    <input
                      type="text"
                      value={usuarioAtual.nome || ''}
                      onChange={(e) => atualizarCampoLocal('nome', e.target.value)}
                      className="w-full max-w-sm px-3.5 py-2 rounded-xl bg-[#0a0a0a] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#f58220]"
                    />
                    <div className="text-xs text-gray-500 font-mono">{usuarioAtual.email}</div>
                  </div>

                  {usuarioAtual.user_id !== currentUserId && (
                    <div className="flex items-center gap-3 bg-[#161616] px-4 py-3 rounded-xl border border-[#262626]">
                      <div>
                        <div className="text-xs font-bold text-white">Status do Acesso</div>
                        <div className="text-[10px] text-gray-400">
                          {usuarioAtual.ativo ? 'Login liberado' : 'Acesso suspenso'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => atualizarCampoLocal('ativo', !usuarioAtual.ativo)}
                        className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                          usuarioAtual.ativo ? 'bg-emerald-500' : 'bg-gray-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            usuarioAtual.ativo ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>

                {/* Seletor de Cargo / Nível */}
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Nível Hierárquico
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CARGOS.map((cargo) => {
                      const isDisabled =
                        usuarioAtual.user_id === currentUserId && cargo.id !== 'admin';
                      const active = usuarioAtual.cargo === cargo.id;
                      return (
                        <button
                          key={cargo.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => atualizarCampoLocal('cargo', cargo.id)}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            isDisabled
                              ? 'opacity-40 cursor-not-allowed bg-[#0d0d0d] border-[#1f1f1f]'
                              : active
                              ? 'bg-[#1a0f05] border-[#f58220] cursor-pointer'
                              : 'bg-[#151515] border-[#262626] hover:border-[#3d3d3d] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-white">
                              {cargo.label}
                            </span>
                            {active && (
                              <span className="w-2 h-2 rounded-full bg-[#f58220]" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                            {cargo.descricao}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Escopo Dinâmico conforme o Cargo */}
                {(usuarioAtual.cargo === 'admin' || usuarioAtual.cargo === 'gerente') && (
                  <div className="p-4 rounded-xl bg-[#161616] border border-[#262626] text-xs text-gray-300">
                    <strong className="text-[#f58220]">Acesso Global Ativo:</strong> Usuários com perfil{' '}
                    <strong>{usuarioAtual.cargo === 'admin' ? 'Admin' : 'Gerente'}</strong> visualizam automaticamente todas as regiões e todas as {unidadesDisponiveis.length || 38} unidades sem restrições.
                  </div>
                )}

                {/* Seletor de Regiões (Coordenador) */}
                {usuarioAtual.cargo === 'coordenador' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Regiões Permitidas ({(usuarioAtual.regioes_permitidas || []).length} de{' '}
                        {regioesDisponiveis.length})
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            selecionarTodos('regioes_permitidas', regioesDisponiveis)
                          }
                          className="text-[11px] text-[#f58220] hover:underline cursor-pointer"
                        >
                          Marcar todas
                        </button>
                        <span className="text-gray-600">·</span>
                        <button
                          type="button"
                          onClick={() => limparSelecao('regioes_permitidas')}
                          className="text-[11px] text-gray-400 hover:underline cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {regioesDisponiveis.map((regiao) => {
                        const checked = (usuarioAtual.regioes_permitidas || []).includes(regiao);
                        return (
                          <label
                            key={regiao}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              checked
                                ? 'bg-blue-500/15 border-blue-500/50 text-white font-semibold'
                                : 'bg-[#141414] border-[#252525] text-gray-400 hover:border-[#383838]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItemArray('regioes_permitidas', regiao)}
                              className="accent-[#f58220] w-4 h-4 rounded"
                            />
                            <span className="truncate">{regiao}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Seletor de Unidades (Supervisor) */}
                {usuarioAtual.cargo === 'supervisor' && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Unidades Permitidas ({(usuarioAtual.unidades_permitidas || []).length} de{' '}
                        {unidadesDisponiveis.length})
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            selecionarTodos('unidades_permitidas', unidadesDisponiveis)
                          }
                          className="text-[11px] text-[#f58220] hover:underline cursor-pointer"
                        >
                          Marcar todas
                        </button>
                        <span className="text-gray-600">·</span>
                        <button
                          type="button"
                          onClick={() => limparSelecao('unidades_permitidas')}
                          className="text-[11px] text-gray-400 hover:underline cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={filtroUnidade}
                      onChange={(e) => setFiltroUnidade(e.target.value)}
                      placeholder="Filtrar usina ou região..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#0a0a0a] border border-[#262626] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#f58220]"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                      {unidadesFiltradas.map((unidade) => {
                        const checked = (usuarioAtual.unidades_permitidas || []).includes(unidade);
                        const regiaoDaUnidade = mapaUnidadeRegiao[unidade];
                        return (
                          <label
                            key={unidade}
                            className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                              checked
                                ? 'bg-emerald-500/15 border-emerald-500/50 text-white font-semibold'
                                : 'bg-[#141414] border-[#252525] text-gray-400 hover:border-[#383838]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleItemArray('unidades_permitidas', unidade)}
                                className="accent-[#f58220] w-4 h-4 rounded shrink-0"
                              />
                              <span className="truncate" title={unidade}>
                                {unidade}
                              </span>
                            </div>
                            {regiaoDaUnidade && (
                              <span className="text-[10px] font-mono text-gray-500 shrink-0">
                                {regiaoDaUnidade}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé com Botão Salvar */}
              <div className="pt-4 border-t border-[#242424] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSalvarPermissoes}
                  disabled={salvando}
                  className="px-6 py-2.5 rounded-xl bg-[#f58220] hover:bg-[#e07112] disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,130,32,0.3)] transition-all cursor-pointer"
                >
                  {salvando ? 'Salvando...' : 'Salvar Permissões'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}