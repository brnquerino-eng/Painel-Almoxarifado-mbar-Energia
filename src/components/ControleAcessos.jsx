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
    descricao: 'Seleção em cascata: escolha a Região e depois as Unidades dela',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    id: 'supervisor',
    label: 'Supervisor',
    descricao: 'Acesso restrito às Unidades de Almoxarifado selecionadas',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
];

// Interpreta o campo regiao_unidade_info da solicitação (JSON estruturado ou texto legado)
function parseEscopoSolicitacao(raw) {
  if (!raw) return { regioes: [], unidades: [], resumoTexto: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.regioes)) {
      const regs = parsed.regioes || [];
      const unis = parsed.unidades || [];
      return {
        regioes: regs,
        unidades: unis,
        resumoTexto: `Regiões: ${regs.join(', ') || 'Nenhuma'} · ${unis.length} usina(s) selecionada(s)`,
      };
    }
  } catch {
    // Texto simples legado
  }
  return { regioes: [], unidades: [], resumoTexto: raw };
}

export default function ControleAcessos({ estoqueData = [], inventarioData = [], currentUserId }) {
  const [perfis, setPerfis] = useState([]);
  const [loadingPerfis, setLoadingPerfis] = useState(true);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(true);
  const [estruturaServer, setEstruturaServer] = useState([]);
  const [loadingEstrutura, setLoadingEstrutura] = useState(true);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [filtroUnidade, setFiltroUnidade] = useState('');

  // Estados do Painel de Novo Usuário
  const [mostrarFormNovo, setMostrarFormNovo] = useState(false);
  const [solicitacaoEmAprovacaoId, setSolicitacaoEmAprovacaoId] = useState(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [novoCargo, setNovoCargo] = useState('supervisor');
  const [novasRegioes, setNovasRegioes] = useState([]);
  const [novasUnidades, setNovasUnidades] = useState([]);
  const [filtroUnidadeNovo, setFiltroUnidadeNovo] = useState('');
  const [criandoUsuario, setCriandoUsuario] = useState(false);

  // Estados para Redefinir Senha e Excluir Usuário
  const [senhaRedefinida, setSenhaRedefinida] = useState('');
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindoUsuario, setExcluindoUsuario] = useState(false);

  const carregarEstruturaOrganizacional = async () => {
    setLoadingEstrutura(true);
    const { data, error } = await supabase.rpc('admin_listar_estrutura_organizacional');
    if (!error && Array.isArray(data)) {
      setEstruturaServer(data);
    }
    setLoadingEstrutura(false);
  };

  const carregarSolicitacoes = async () => {
    setLoadingSolicitacoes(true);
    const { data, error } = await supabase
      .from('solicitacoes_acesso')
      .select('*')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false });

    if (!error && Array.isArray(data)) {
      setSolicitacoes(data);
    }
    setLoadingSolicitacoes(false);
  };

  const {
    regioesDisponiveis,
    unidadesDisponiveis,
    mapaUnidadeRegiao,
    unidadesAgrupadasPorRegiao,
  } = useMemo(() => {
    const regSet = new Set();
    const uniSet = new Set();
    const mapa = {};

    estruturaServer.forEach((item) => {
      const reg = (item?.regiao || '').toString().trim();
      const uni = (item?.unidade || '').toString().trim();
      if (reg && reg !== 'Sem Região') regSet.add(reg);
      if (uni) {
        uniSet.add(uni);
        mapa[uni] = reg || 'Sem Região';
      }
    });

    estoqueData.forEach((row) => {
      const reg = (row['Região'] || row['regiao'] || '').toString().trim();
      const uni = (row['unidade_almoxarifado'] || '').toString().trim();
      if (reg) regSet.add(reg);
      if (uni) {
        uniSet.add(uni);
        if (reg && (!mapa[uni] || mapa[uni] === 'Sem Região')) {
          mapa[uni] = reg;
        } else if (!mapa[uni]) {
          mapa[uni] = 'Sem Região';
        }
      }
    });

    inventarioData.forEach((row) => {
      const uni = (row['unidade_almoxarifado'] || '').toString().trim();
      if (uni) {
        uniSet.add(uni);
        if (!mapa[uni]) mapa[uni] = 'Sem Região';
      }
    });

    const regioesOrdenadas = Array.from(regSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const unidadesOrdenadas = Array.from(uniSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const grupos = {};
    unidadesOrdenadas.forEach((uni) => {
      const reg = mapa[uni] || 'Sem Região';
      if (!grupos[reg]) grupos[reg] = [];
      grupos[reg].push(uni);
    });

    const gruposOrdenados = Object.keys(grupos)
      .sort((a, b) => {
        if (a === 'Sem Região') return 1;
        if (b === 'Sem Região') return -1;
        return a.localeCompare(b, 'pt-BR');
      })
      .map((reg) => ({
        regiao: reg,
        unidades: grupos[reg],
      }));

    return {
      regioesDisponiveis: regioesOrdenadas,
      unidadesDisponiveis: unidadesOrdenadas,
      mapaUnidadeRegiao: mapa,
      unidadesAgrupadasPorRegiao: gruposOrdenados,
    };
  }, [estruturaServer, estoqueData, inventarioData]);

  const carregarPerfis = async (selecionarIdOpcional = null) => {
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
      if (selecionarIdOpcional) {
        setUsuarioSelecionadoId(selecionarIdOpcional);
      } else if ((!usuarioSelecionadoId || !lista.some((p) => p.user_id === usuarioSelecionadoId)) && lista.length > 0) {
        setUsuarioSelecionadoId(lista[0].user_id);
      }
    }
    setLoadingPerfis(false);
  };

  useEffect(() => {
    carregarEstruturaOrganizacional();
    carregarPerfis();
    carregarSolicitacoes();
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

  const gruposBaseEdicao = useMemo(() => {
    if (!usuarioAtual) return [];
    if (usuarioAtual.cargo === 'coordenador') {
      const regSelecionadas = new Set(usuarioAtual.regioes_permitidas || []);
      return unidadesAgrupadasPorRegiao.filter((g) => regSelecionadas.has(g.regiao));
    }
    return unidadesAgrupadasPorRegiao;
  }, [usuarioAtual, unidadesAgrupadasPorRegiao]);

  const unidadesDisponiveisNoEscopoEdicao = useMemo(
    () => gruposBaseEdicao.flatMap((g) => g.unidades),
    [gruposBaseEdicao]
  );

  const gruposUnidadesEdicao = useMemo(() => {
    const q = filtroUnidade.trim().toLowerCase();
    if (!q) return gruposBaseEdicao;
    return gruposBaseEdicao
      .map((grupo) => ({
        regiao: grupo.regiao,
        unidades: grupo.unidades.filter(
          (u) => u.toLowerCase().includes(q) || grupo.regiao.toLowerCase().includes(q)
        ),
      }))
      .filter((grupo) => grupo.unidades.length > 0);
  }, [gruposBaseEdicao, filtroUnidade]);

  const gruposBaseNovo = useMemo(() => {
    if (novoCargo === 'coordenador') {
      const regSelecionadas = new Set(novasRegioes);
      return unidadesAgrupadasPorRegiao.filter((g) => regSelecionadas.has(g.regiao));
    }
    return unidadesAgrupadasPorRegiao;
  }, [novoCargo, novasRegioes, unidadesAgrupadasPorRegiao]);

  const unidadesDisponiveisNoEscopoNovo = useMemo(
    () => gruposBaseNovo.flatMap((g) => g.unidades),
    [gruposBaseNovo]
  );

  const gruposUnidadesNovo = useMemo(() => {
    const q = filtroUnidadeNovo.trim().toLowerCase();
    if (!q) return gruposBaseNovo;
    return gruposBaseNovo
      .map((grupo) => ({
        regiao: grupo.regiao,
        unidades: grupo.unidades.filter(
          (u) => u.toLowerCase().includes(q) || grupo.regiao.toLowerCase().includes(q)
        ),
      }))
      .filter((grupo) => grupo.unidades.length > 0);
  }, [gruposBaseNovo, filtroUnidadeNovo]);

  const resetarFormularioNovoUsuario = () => {
    setSolicitacaoEmAprovacaoId(null);
    setNovoNome('');
    setNovoEmail('');
    setNovaSenha('');
    setMostrarNovaSenha(false);
    setNovoCargo('supervisor');
    setNovasRegioes([]);
    setNovasUnidades([]);
    setFiltroUnidadeNovo('');
  };

  const handleToggleFormNovo = () => {
    setMostrarFormNovo((prev) => {
      const proximoEstado = !prev;
      if (proximoEstado) {
        resetarFormularioNovoUsuario();
      }
      return proximoEstado;
    });
    setErro(null);
    setSucesso(null);
  };

  const handleIniciarAprovacao = (sol) => {
    const escopo = parseEscopoSolicitacao(sol.regiao_unidade_info);
    setErro(null);
    setSucesso(null);
    setSolicitacaoEmAprovacaoId(sol.id);
    setNovoNome(sol.nome || '');
    setNovoEmail(sol.email || '');
    setNovaSenha('');
    setMostrarNovaSenha(false);
    setNovoCargo(sol.cargo_solicitado || 'supervisor');
    setNovasRegioes(escopo.regioes);
    setNovasUnidades(escopo.unidades);
    setFiltroUnidadeNovo('');
    setMostrarFormNovo(true);
  };

  const handleRecusarSolicitacao = async (solId) => {
    setErro(null);
    const { error } = await supabase
      .from('solicitacoes_acesso')
      .update({ status: 'rejeitado' })
      .eq('id', solId);

    if (error) {
      setErro(`Erro ao recusar solicitação: ${error.message}`);
    } else {
      setSucesso('Solicitação recusada e arquivada.');
      await carregarSolicitacoes();
    }
  };

  const atualizarCampoLocal = (campo, valor) => {
    if (!usuarioAtual) return;
    setSucesso(null);
    setPerfis((prev) =>
      prev.map((p) => (p.user_id === usuarioAtual.user_id ? { ...p, [campo]: valor } : p))
    );
  };

  const toggleRegiaoCoordenadorEdicao = (regiao) => {
    if (!usuarioAtual) return;
    const regioesAtuais = Array.isArray(usuarioAtual.regioes_permitidas)
      ? usuarioAtual.regioes_permitidas
      : [];
    const unidadesAtuais = new Set(usuarioAtual.unidades_permitidas || []);
    const unidadesDaRegiao =
      unidadesAgrupadasPorRegiao.find((g) => g.regiao === regiao)?.unidades || [];

    const jaExiste = regioesAtuais.includes(regiao);
    let novasRegs;

    if (jaExiste) {
      novasRegs = regioesAtuais.filter((r) => r !== regiao);
      unidadesDaRegiao.forEach((u) => unidadesAtuais.delete(u));
    } else {
      novasRegs = [...regioesAtuais, regiao];
      unidadesDaRegiao.forEach((u) => unidadesAtuais.add(u));
    }

    setSucesso(null);
    setPerfis((prev) =>
      prev.map((p) =>
        p.user_id === usuarioAtual.user_id
          ? {
              ...p,
              regioes_permitidas: novasRegs,
              unidades_permitidas: Array.from(unidadesAtuais),
            }
          : p
      )
    );
  };

  const toggleRegiaoCoordenadorNovo = (regiao) => {
    const unidadesDaRegiao =
      unidadesAgrupadasPorRegiao.find((g) => g.regiao === regiao)?.unidades || [];
    const jaExiste = novasRegioes.includes(regiao);

    if (jaExiste) {
      setNovasRegioes((prev) => prev.filter((r) => r !== regiao));
      setNovasUnidades((prev) => prev.filter((u) => !unidadesDaRegiao.includes(u)));
    } else {
      setNovasRegioes((prev) => [...prev, regiao]);
      setNovasUnidades((prev) => Array.from(new Set([...prev, ...unidadesDaRegiao])));
    }
  };

  const toggleItemArray = (campo, item) => {
    if (!usuarioAtual) return;
    const listaAtual = Array.isArray(usuarioAtual[campo]) ? usuarioAtual[campo] : [];
    const existe = listaAtual.includes(item);
    const novaLista = existe ? listaAtual.filter((x) => x !== item) : [...listaAtual, item];
    atualizarCampoLocal(campo, novaLista);
  };

  const toggleGrupoUnidadesEdicao = (unidadesDoGrupo) => {
    if (!usuarioAtual) return;
    const atuais = new Set(usuarioAtual.unidades_permitidas || []);
    const todasMarcadas = unidadesDoGrupo.every((u) => atuais.has(u));
    if (todasMarcadas) {
      unidadesDoGrupo.forEach((u) => atuais.delete(u));
    } else {
      unidadesDoGrupo.forEach((u) => atuais.add(u));
    }
    atualizarCampoLocal('unidades_permitidas', Array.from(atuais));
  };

  const toggleGrupoUnidadesNovo = (unidadesDoGrupo) => {
    setNovasUnidades((prev) => {
      const atuais = new Set(prev);
      const todasMarcadas = unidadesDoGrupo.every((u) => atuais.has(u));
      if (todasMarcadas) {
        unidadesDoGrupo.forEach((u) => atuais.delete(u));
      } else {
        unidadesDoGrupo.forEach((u) => atuais.add(u));
      }
      return Array.from(atuais);
    });
  };

  const selecionarTodasRegioesEdicao = () => {
    if (!usuarioAtual) return;
    setSucesso(null);
    setPerfis((prev) =>
      prev.map((p) =>
        p.user_id === usuarioAtual.user_id
          ? {
              ...p,
              regioes_permitidas: [...regioesDisponiveis],
              unidades_permitidas: [...unidadesDisponiveis],
            }
          : p
      )
    );
  };

  const limparRegioesEdicao = () => {
    if (!usuarioAtual) return;
    setSucesso(null);
    setPerfis((prev) =>
      prev.map((p) =>
        p.user_id === usuarioAtual.user_id
          ? {
              ...p,
              regioes_permitidas: [],
              unidades_permitidas: [],
            }
          : p
      )
    );
  };

  const selecionarTodos = (campo, todosItens) => {
    atualizarCampoLocal(campo, [...todosItens]);
  };

  const limparSelecao = (campo) => {
    atualizarCampoLocal(campo, []);
  };

  const handleCriarNovoUsuario = async (e) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!novoEmail.trim()) {
      setErro('Informe o e-mail do novo usuário.');
      return;
    }
    if (novaSenha.length < 6) {
      setErro('A senha inicial deve ter no mínimo 6 caracteres.');
      return;
    }

    const unidadesValidadasNovo =
      novoCargo === 'coordenador'
        ? novasUnidades.filter((u) => novasRegioes.includes(mapaUnidadeRegiao[u]))
        : novoCargo === 'supervisor'
        ? novasUnidades
        : [];

    setCriandoUsuario(true);
    const { data: novoUserId, error } = await supabase.rpc('admin_criar_usuario', {
      p_email: novoEmail.trim(),
      p_senha: novaSenha,
      p_nome: novoNome.trim() || null,
      p_cargo: novoCargo,
      p_regioes: novoCargo === 'coordenador' ? novasRegioes : [],
      p_unidades: unidadesValidadasNovo,
    });

    if (error) {
      setErro(`Erro ao criar usuário: ${error.message}`);
    } else {
      // Garante que o novo usuário precisará trocar a senha provisória no primeiro login
      if (novoUserId) {
        await supabase
          .from('perfis_acesso')
          .update({ trocar_senha_obrigatoria: true })
          .eq('user_id', novoUserId);
      }

      if (solicitacaoEmAprovacaoId) {
        await supabase
          .from('solicitacoes_acesso')
          .update({ status: 'aprovado' })
          .eq('id', solicitacaoEmAprovacaoId);
        await carregarSolicitacoes();
      }

      setSucesso(
        `Usuário ${novoEmail.trim().toLowerCase()} criado! Ele deverá definir uma senha pessoal no primeiro acesso.`
      );
      setMostrarFormNovo(false);
      resetarFormularioNovoUsuario();
      await carregarPerfis(novoUserId);
    }
    setCriandoUsuario(false);
  };

  const handleSalvarPermissoes = async () => {
    if (!usuarioAtual) return;
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    const ehProprioAdmin = usuarioAtual.user_id === currentUserId;
    const regsFinal =
      usuarioAtual.cargo === 'coordenador' ? usuarioAtual.regioes_permitidas || [] : [];
    const unisFinal =
      usuarioAtual.cargo === 'coordenador'
        ? (usuarioAtual.unidades_permitidas || []).filter((u) =>
            regsFinal.includes(mapaUnidadeRegiao[u])
          )
        : usuarioAtual.cargo === 'supervisor'
        ? usuarioAtual.unidades_permitidas || []
        : [];

    const payload = {
      nome: usuarioAtual.nome || usuarioAtual.email.split('@')[0],
      cargo: ehProprioAdmin ? 'admin' : usuarioAtual.cargo,
      ativo: ehProprioAdmin ? true : usuarioAtual.ativo,
      regioes_permitidas: regsFinal,
      unidades_permitidas: unisFinal,
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
      await carregarPerfis(usuarioAtual.user_id);
    }
    setSalvando(false);
  };

  const handleRedefinirSenha = async () => {
    if (!usuarioAtual) return;
    if (senhaRedefinida.length < 6) {
      setErro('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setAlterandoSenha(true);
    setErro(null);
    setSucesso(null);

    const { error } = await supabase.rpc('admin_alterar_senha_usuario', {
      p_user_id: usuarioAtual.user_id,
      p_nova_senha: senhaRedefinida,
    });

    if (error) {
      setErro(`Erro ao alterar senha: ${error.message}`);
    } else {
      if (usuarioAtual.user_id !== currentUserId) {
        await supabase
          .from('perfis_acesso')
          .update({ trocar_senha_obrigatoria: true })
          .eq('user_id', usuarioAtual.user_id);
      }
      setSucesso(
        `Senha provisória de ${usuarioAtual.email} definida! Ele deverá cadastrar uma nova senha pessoal ao entrar.`
      );
      setSenhaRedefinida('');
      await carregarPerfis(usuarioAtual.user_id);
    }
    setAlterandoSenha(false);
  };

  const handleExcluirUsuario = async () => {
    if (!usuarioAtual || usuarioAtual.user_id === currentUserId) return;

    setExcluindoUsuario(true);
    setErro(null);
    setSucesso(null);

    const emailExcluido = usuarioAtual.email;
    const { error } = await supabase.rpc('admin_excluir_usuario', {
      p_user_id: usuarioAtual.user_id,
    });

    if (error) {
      setErro(`Erro ao excluir usuário: ${error.message}`);
    } else {
      setSucesso(`Usuário ${emailExcluido} excluído permanentemente.`);
      setConfirmarExclusao(false);
      await carregarPerfis();
    }
    setExcluindoUsuario(false);
  };

  const getCargoInfo = (cargoId) =>
    CARGOS.find((c) => c.id === cargoId) || CARGOS[3];

  const formatarResumoAbrangencia = (perfil) => {
    if (perfil.cargo === 'admin' || perfil.cargo === 'gerente') {
      return 'Abrangência: Todas as unidades';
    }
    if (perfil.cargo === 'coordenador') {
      const qtdReg = (perfil.regioes_permitidas || []).length;
      const qtdUni = (perfil.unidades_permitidas || []).length;
      return `Regiões: ${qtdReg} · Unidades ativas: ${qtdUni}`;
    }
    return `Unidades: ${(perfil.unidades_permitidas || []).length} selecionada(s)`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111111] border border-[#2A2A2A] rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#f58220]/15 text-[#f58220] border border-[#f58220]/30">
              Administração
            </span>
            <h2 className="text-xl font-black text-white tracking-tight">
              Controle de Acessos & Abrangência
            </h2>
            {!loadingEstrutura && unidadesDisponiveis.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#191919] text-gray-300 border border-[#2d2d2d]">
                {regioesDisponiveis.length} Regiões · {unidadesDisponiveis.length} Unidades
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Aprove novos pedidos de acesso, defina a hierarquia (<strong className="text-gray-300">Gerente</strong>,{' '}
            <strong className="text-gray-300">Coordenador</strong> ou{' '}
            <strong className="text-gray-300">Supervisor</strong>) e controle quais regiões ou usinas cada pessoa enxerga.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleToggleFormNovo}
            className="px-4 py-2.5 rounded-xl bg-[#f58220] hover:bg-[#e07112] text-black text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(245,130,32,0.25)] transition-all cursor-pointer flex items-center gap-2"
          >
            <span className="text-base leading-none">{mostrarFormNovo ? '✕' : '+'}</span>
            <span>{mostrarFormNovo ? 'Fechar Cadastro' : 'Novo Usuário'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              carregarEstruturaOrganizacional();
              carregarPerfis();
              carregarSolicitacoes();
            }}
            disabled={loadingPerfis || loadingEstrutura || loadingSolicitacoes}
            className="px-4 py-2.5 rounded-xl bg-[#181818] hover:bg-[#222222] border border-[#2E2E2E] text-xs font-bold text-gray-200 transition-all cursor-pointer"
          >
            {loadingPerfis || loadingEstrutura ? 'Sincronizando...' : 'Atualizar Lista'}
          </button>
        </div>
      </div>

      {/* Alertas */}
      {erro && (
        <div className="bg-red-950/50 border border-red-500/50 text-red-200 text-xs rounded-xl px-4 py-3 flex items-center justify-between">
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => setErro(null)}
            className="text-red-400 hover:text-white font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      {sucesso && (
        <div className="bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 text-xs rounded-xl px-4 py-3 flex items-center justify-between">
          <span>{sucesso}</span>
          <button
            type="button"
            onClick={() => setSucesso(null)}
            className="text-emerald-400 hover:text-white font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Fila de Solicitações de Primeiro Acesso Pendentes */}
      {solicitacoes.length > 0 && (
        <div className="bg-[#130e08] border border-[#f58220]/50 rounded-2xl p-5 space-y-3 shadow-[0_0_25px_rgba(245,130,32,0.1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f58220] animate-pulse" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Solicitações de Primeiro Acesso Pendentes ({solicitacoes.length})
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {solicitacoes.map((sol) => {
              const escopo = parseEscopoSolicitacao(sol.regiao_unidade_info);
              return (
                <div
                  key={sol.id}
                  className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{sol.nome}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#f58220]/20 text-[#f58220] border border-[#f58220]/40">
                        {sol.cargo_solicitado}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-300 font-mono">{sol.email}</div>
                    {escopo.resumoTexto && (
                      <div className="text-[11px] text-gray-400">
                        Escopo solicitado: <strong className="text-gray-200">{escopo.resumoTexto}</strong>
                      </div>
                    )}
                    {escopo.unidades.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {escopo.unidades.map((u) => (
                          <span
                            key={u}
                            className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                          >
                            {u}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1e1e]">
                    <button
                      type="button"
                      onClick={() => handleRecusarSolicitacao(sol.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-red-950/60 text-[11px] font-bold text-gray-400 hover:text-red-300 cursor-pointer"
                    >
                      Recusar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIniciarAprovacao(sol)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#f58220] hover:bg-[#e07112] text-[11px] font-black text-black uppercase cursor-pointer"
                    >
                      Aprovar & Liberar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Formulário Expansível de Cadastro de Novo Usuário */}
      {mostrarFormNovo && (
        <form
          onSubmit={handleCriarNovoUsuario}
          autoComplete="off"
          className="bg-[#111111] border border-[#f58220]/40 rounded-2xl p-6 space-y-5 shadow-[0_0_30px_rgba(245,130,32,0.08)]"
        >
          <input type="text" name="prevent_autofill_user" autoComplete="username" className="hidden" tabIndex={-1} />
          <input type="password" name="prevent_autofill_pass" autoComplete="current-password" className="hidden" tabIndex={-1} />

          <div className="flex items-center justify-between border-b border-[#242424] pb-4">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {solicitacaoEmAprovacaoId
                  ? 'Aprovar Solicitação & Liberar Acesso'
                  : 'Cadastrar Novo Usuário'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Defina uma senha temporária inicial — o colaborador será obrigado a criar uma senha pessoal no primeiro acesso.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Nome do Colaborador
              </label>
              <input
                type="text"
                name="novo-colaborador-nome"
                autoComplete="off"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: João Silva"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#282828] text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#f58220]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                E-mail Corporativo *
              </label>
              <input
                type="email"
                name="novo-colaborador-email"
                autoComplete="off"
                required
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                placeholder="nome.sobrenome@ambarenergia.com.br"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#282828] text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#f58220]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Senha Provisória (mín. 6 caracteres) *
              </label>
              <div className="relative">
                <input
                  type={mostrarNovaSenha ? 'text' : 'password'}
                  name="novo-colaborador-senha"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Crie uma senha inicial"
                  className="w-full px-3.5 py-2.5 pr-16 rounded-xl bg-[#0a0a0a] border border-[#282828] text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#f58220]"
                />
                <button
                  type="button"
                  onClick={() => setMostrarNovaSenha((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 hover:text-white cursor-pointer"
                >
                  {mostrarNovaSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          </div>

          {/* Cargo do Novo Usuário */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Cargo / Abrangência
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {CARGOS.map((cargo) => {
                const active = novoCargo === cargo.id;
                return (
                  <button
                    key={cargo.id}
                    type="button"
                    onClick={() => setNovoCargo(cargo.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-[#1a0f05] border-[#f58220]'
                        : 'bg-[#151515] border-[#262626] hover:border-[#3d3d3d]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-white">{cargo.label}</span>
                      {active && <span className="w-2 h-2 rounded-full bg-[#f58220]" />}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                      {cargo.descricao}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CAMADA 1 (Coordenador): Seleção de Regiões */}
          {novoCargo === 'coordenador' && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                  Camada 1 · Selecione a(s) Região(ões) ({novasRegioes.length} de {regioesDisponiveis.length})
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNovasRegioes([...regioesDisponiveis]);
                      setNovasUnidades([...unidadesDisponiveis]);
                    }}
                    className="text-[11px] text-[#f58220] hover:underline cursor-pointer"
                  >
                    Marcar todas
                  </button>
                  <span className="text-gray-600">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNovasRegioes([]);
                      setNovasUnidades([]);
                    }}
                    className="text-[11px] text-gray-400 hover:underline cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {regioesDisponiveis.map((regiao) => {
                  const checked = novasRegioes.includes(regiao);
                  return (
                    <label
                      key={regiao}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        checked
                          ? 'bg-blue-500/15 border-blue-500/50 text-white font-semibold'
                          : 'bg-[#141414] border-[#252525] text-gray-400 hover:border-[#383838]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRegiaoCoordenadorNovo(regiao)}
                        className="accent-[#f58220] w-4 h-4 rounded"
                      />
                      <span className="truncate">{regiao}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* CAMADA 2 (Coordenador após marcar Região) OU Seleção Direta (Supervisor) */}
          {(novoCargo === 'supervisor' || novoCargo === 'coordenador') && (
            <div className="space-y-3 pt-2">
              {novoCargo === 'coordenador' && novasRegioes.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#0e0e0e] border border-dashed border-[#2c2c2c] text-xs text-gray-400 text-center">
                  Selecione acima pelo menos uma <strong className="text-blue-300">Região</strong> para liberar a escolha das unidades dela.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {novoCargo === 'coordenador'
                        ? `Camada 2 · Unidades das Regiões Selecionadas (${novasUnidades.length} de ${unidadesDisponiveisNoEscopoNovo.length})`
                        : `Unidades Permitidas (${novasUnidades.length} de ${unidadesDisponiveisNoEscopoNovo.length})`}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNovasUnidades([...unidadesDisponiveisNoEscopoNovo])}
                        className="text-[11px] text-[#f58220] hover:underline cursor-pointer"
                      >
                        Marcar todas
                      </button>
                      <span className="text-gray-600">·</span>
                      <button
                        type="button"
                        onClick={() => setNovasUnidades([])}
                        className="text-[11px] text-gray-400 hover:underline cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <input
                    type="search"
                    name="filtro-unidade-novo-usuario"
                    autoComplete="off"
                    value={filtroUnidadeNovo}
                    onChange={(e) => setFiltroUnidadeNovo(e.target.value)}
                    placeholder="Buscar usina..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0a0a0a] border border-[#262626] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#f58220]"
                  />

                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                    {gruposUnidadesNovo.map((grupo) => {
                      const todasDoGrupoMarcadas =
                        grupo.unidades.length > 0 &&
                        grupo.unidades.every((u) => novasUnidades.includes(u));
                      return (
                        <div
                          key={grupo.regiao}
                          className="bg-[#0e0e0e] border border-[#222222] rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between border-b border-[#1d1d1d] pb-1.5">
                            <span className="text-[11px] font-extrabold text-[#f58220] uppercase tracking-wider">
                              {grupo.regiao} ({grupo.unidades.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleGrupoUnidadesNovo(grupo.unidades)}
                              className="text-[10px] font-bold text-gray-400 hover:text-white cursor-pointer"
                            >
                              {todasDoGrupoMarcadas ? 'Desmarcar região' : 'Selecionar região'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {grupo.unidades.map((unidade) => {
                              const checked = novasUnidades.includes(unidade);
                              return (
                                <label
                                  key={unidade}
                                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                    checked
                                      ? 'bg-emerald-500/15 border-emerald-500/50 text-white font-semibold'
                                      : 'bg-[#141414] border-[#252525] text-gray-400 hover:border-[#383838]'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      setNovasUnidades((prev) =>
                                        prev.includes(unidade)
                                          ? prev.filter((u) => u !== unidade)
                                          : [...prev, unidade]
                                      )
                                    }
                                    className="accent-[#f58220] w-4 h-4 rounded shrink-0"
                                  />
                                  <span className="truncate" title={unidade}>
                                    {unidade}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242424]">
            <button
              type="button"
              onClick={() => {
                setMostrarFormNovo(false);
                resetarFormularioNovoUsuario();
              }}
              className="px-4 py-2.5 rounded-xl bg-[#181818] hover:bg-[#222] text-xs font-bold text-gray-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={criandoUsuario}
              className="px-6 py-2.5 rounded-xl bg-[#f58220] hover:bg-[#e07112] disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider cursor-pointer"
            >
              {criandoUsuario ? 'Liberando...' : 'Confirmar & Liberar Acesso'}
            </button>
          </div>
        </form>
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
            type="search"
            name="busca-usuario-acessos"
            autoComplete="off"
            value={buscaUsuario}
            onChange={(e) => setBuscaUsuario(e.target.value)}
            placeholder="Buscar por e-mail, nome ou cargo..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#262626] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#f58220]"
          />

          <div className="flex flex-col gap-2 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
            {loadingPerfis ? (
              <div className="text-center py-10 text-xs text-gray-500">
                Carregando usuários...
              </div>
            ) : perfisFiltrados.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-500">
                Nenhum usuário encontrado. Clique em "+ Novo Usuário" acima para cadastrar.
              </div>
            ) : (
              perfisFiltrados.map((perfil) => {
                const isSelected = perfil.user_id === usuarioSelecionadoId;
                const cargoInfo = getCargoInfo(perfil.cargo);
                return (
                  <button
                    key={perfil.user_id}
                    type="button"
                    onClick={() => {
                      setUsuarioSelecionadoId(perfil.user_id);
                      setSucesso(null);
                      setErro(null);
                      setSenhaRedefinida('');
                      setConfirmarExclusao(false);
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
                        {perfil.trocar_senha_obrigatoria && (
                          <span
                            title="Aguardando troca da senha provisória no primeiro login"
                            className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          >
                            Senha Provisória
                          </span>
                        )}
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
                      {formatarResumoAbrangencia(perfil)}
                    </div>
                  </button>
                );
              })
            )}
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
                      name="editar-nome-exibicao"
                      autoComplete="off"
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
                    <strong>{usuarioAtual.cargo === 'admin' ? 'Admin' : 'Gerente'}</strong> visualizam automaticamente todas as {regioesDisponiveis.length} regiões e todas as {unidadesDisponiveis.length || 38} unidades sem restrições.
                  </div>
                )}

                {/* CAMADA 1 (Coordenador - Edição): Seleção de Regiões */}
                {usuarioAtual.cargo === 'coordenador' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                        Camada 1 · Selecione a(s) Região(ões) ({(usuarioAtual.regioes_permitidas || []).length} de{' '}
                        {regioesDisponiveis.length})
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selecionarTodasRegioesEdicao}
                          className="text-[11px] text-[#f58220] hover:underline cursor-pointer"
                        >
                          Marcar todas
                        </button>
                        <span className="text-gray-600">·</span>
                        <button
                          type="button"
                          onClick={limparRegioesEdicao}
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
                              onChange={() => toggleRegiaoCoordenadorEdicao(regiao)}
                              className="accent-[#f58220] w-4 h-4 rounded"
                            />
                            <span className="truncate">{regiao}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CAMADA 2 (Coordenador após marcar Região) OU Seleção Direta (Supervisor) */}
                {(usuarioAtual.cargo === 'supervisor' || usuarioAtual.cargo === 'coordenador') && (
                  <div className="space-y-3">
                    {usuarioAtual.cargo === 'coordenador' &&
                    (usuarioAtual.regioes_permitidas || []).length === 0 ? (
                      <div className="p-4 rounded-xl bg-[#0e0e0e] border border-dashed border-[#2c2c2c] text-xs text-gray-400 text-center">
                        Selecione acima pelo menos uma <strong className="text-blue-300">Região</strong> para liberar a escolha das unidades dela.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {usuarioAtual.cargo === 'coordenador'
                              ? `Camada 2 · Unidades das Regiões Selecionadas (${(usuarioAtual.unidades_permitidas || []).length} de ${unidadesDisponiveisNoEscopoEdicao.length})`
                              : `Unidades Permitidas (${(usuarioAtual.unidades_permitidas || []).length} de ${unidadesDisponiveisNoEscopoEdicao.length})`}
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                selecionarTodos(
                                  'unidades_permitidas',
                                  unidadesDisponiveisNoEscopoEdicao
                                )
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
                          type="search"
                          name="filtro-unidade-edicao-usuario"
                          autoComplete="off"
                          value={filtroUnidade}
                          onChange={(e) => setFiltroUnidade(e.target.value)}
                          placeholder="Buscar usina..."
                          className="w-full px-3.5 py-2 rounded-xl bg-[#0a0a0a] border border-[#262626] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#f58220]"
                        />

                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                          {gruposUnidadesEdicao.map((grupo) => {
                            const selecionadasSet = new Set(usuarioAtual.unidades_permitidas || []);
                            const todasDoGrupoMarcadas =
                              grupo.unidades.length > 0 &&
                              grupo.unidades.every((u) => selecionadasSet.has(u));
                            return (
                              <div
                                key={grupo.regiao}
                                className="bg-[#0e0e0e] border border-[#222222] rounded-xl p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between border-b border-[#1d1d1d] pb-1.5">
                                  <span className="text-[11px] font-extrabold text-[#f58220] uppercase tracking-wider">
                                    {grupo.regiao} ({grupo.unidades.length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleGrupoUnidadesEdicao(grupo.unidades)}
                                    className="text-[10px] font-bold text-gray-400 hover:text-white cursor-pointer"
                                  >
                                    {todasDoGrupoMarcadas ? 'Desmarcar região' : 'Selecionar região'}
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {grupo.unidades.map((unidade) => {
                                    const checked = selecionadasSet.has(unidade);
                                    return (
                                      <label
                                        key={unidade}
                                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                          checked
                                            ? 'bg-emerald-500/15 border-emerald-500/50 text-white font-semibold'
                                            : 'bg-[#141414] border-[#252525] text-gray-400 hover:border-[#383838]'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() =>
                                            toggleItemArray('unidades_permitidas', unidade)
                                          }
                                          className="accent-[#f58220] w-4 h-4 rounded shrink-0"
                                        />
                                        <span className="truncate" title={unidade}>
                                          {unidade}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Segurança: Definir Nova Senha Provisória */}
                <div className="pt-4 border-t border-[#242424] space-y-2.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Definir Senha Provisória (Usuário trocará ao entrar)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="password"
                      name="redefinir-senha-usuario"
                      autoComplete="new-password"
                      value={senhaRedefinida}
                      onChange={(e) => setSenhaRedefinida(e.target.value)}
                      placeholder="Nova senha provisória (mín. 6 caracteres)"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-[#0a0a0a] border border-[#262626] text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#f58220]"
                    />
                    <button
                      type="button"
                      disabled={alterandoSenha || senhaRedefinida.length < 6}
                      onClick={handleRedefinirSenha}
                      className="px-4 py-2 rounded-xl bg-[#1a1a1a] hover:bg-[#242424] disabled:opacity-40 border border-[#303030] text-xs font-bold text-gray-200 transition-all cursor-pointer shrink-0"
                    >
                      {alterandoSenha ? 'Alterando...' : 'Atualizar Senha'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Rodapé com Excluir Usuário + Salvar Permissões */}
              <div className="pt-4 border-t border-[#242424] flex flex-wrap items-center justify-between gap-3">
                {usuarioAtual.user_id !== currentUserId ? (
                  <div>
                    {!confirmarExclusao ? (
                      <button
                        type="button"
                        onClick={() => setConfirmarExclusao(true)}
                        className="px-4 py-2.5 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-500/30 text-xs font-bold text-red-400 transition-all cursor-pointer"
                      >
                        Excluir Usuário
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={excluindoUsuario}
                          onClick={handleExcluirUsuario}
                          className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-black text-white cursor-pointer"
                        >
                          {excluindoUsuario ? 'Excluindo...' : 'Confirmar Exclusão'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmarExclusao(false)}
                          className="px-3 py-2 rounded-xl bg-[#1c1c1c] text-xs text-gray-300 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div />
                )}

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