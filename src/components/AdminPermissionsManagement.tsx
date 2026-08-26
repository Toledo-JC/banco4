import React, { useState, useEffect } from 'react';
import { AdminUser, AdminRole } from '../types';
import { storageService } from '../services/storageService';
import { firestoreService } from '../services/firestoreService';
import { hashPassword } from '../services/authService';
import { ROLE_INFO, rbacService } from '../services/rbacService';
import { auth } from '../services/firebase';
import { InfoTooltip } from './InfoTooltip';
import { 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  Key, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  User, 
  Briefcase,
  Layers,
  Sparkles,
  Shield,
  UserCheck,
  Building,
  ToggleLeft,
  ToggleRight,
  Cloud,
  Send,
  Edit3
} from 'lucide-react';

interface AdminPermissionsManagementProps {
  theme?: 'dark' | 'light';
  currentUserEmail: string;
  onAdminListChange?: (admins: AdminUser[]) => void;
}

export const AdminPermissionsManagement: React.FC<AdminPermissionsManagementProps> = ({
  theme = 'dark',
  currentUserEmail,
  onAdminListChange,
}) => {
  const isDark = theme === 'dark';
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  
  // Form State
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('Analista de RH');
  const [nivelAcesso, setNivelAcesso] = useState<AdminRole>('AUX_DA');
  const [sede, setSede] = useState('KO');
  const [senhaInicial, setSenhaInicial] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync real-time with Firestore
  useEffect(() => {
    const unsub = firestoreService.subscribeAdmins((list) => {
      // Ensure master admin is present
      const masterEmail = 'coari.comara@gmail.com';
      const hasMaster = list.some(a => a.email.toLowerCase() === masterEmail.toLowerCase());
      let fullList = [...list];
      if (!hasMaster) {
        fullList.unshift({
          id: 'adm-super-master',
          email: masterEmail,
          nome: 'Administrador Master COMARA',
          cargo: 'Super Administrador TI / RH',
          nivelAcesso: 'SUPER_ADMIN',
          ativo: true,
          criadoEm: '2026-01-01 00:00:00',
        });
      }
      setAdmins(fullList);
      if (onAdminListChange) onAdminListChange(fullList);
    }, () => {
      // Fallback to local
      setAdmins(storageService.getAdmins());
    });

    return () => unsub();
  }, []);

  const currentAdmin = admins.find(
    (a) => a.ativo && a.email.toLowerCase() === currentUserEmail.toLowerCase()
  );

  const isCurrentSuperAdmin = currentUserEmail.toLowerCase() === 'coari.comara@gmail.com' || currentAdmin?.nivelAcesso === 'SUPER_ADMIN';

  const handleOpenCreateModal = () => {
    setEditingAdmin(null);
    setEmail('');
    setNome('');
    setCargo('Analista de RH');
    setNivelAcesso('GESTOR_RH');
    setSede('KO');
    setSenhaInicial('');
    setConfirmarSenha('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleGenerateAdminRandomPassword = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setSenhaInicial(pin);
    setConfirmarSenha(pin);
  };

  const handleOpenEditModal = (adm: AdminUser) => {
    setEditingAdmin(adm);
    setEmail(adm.email);
    setNome(adm.nome);
    setCargo(adm.cargo || 'Gestor RH');
    setNivelAcesso(adm.nivelAcesso || adm.role || 'GESTOR_RH');
    setSede(adm.sede || adm.canteiroCodigo || 'KO');
    setSenhaInicial('');
    setConfirmarSenha('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Informe um endereço de e-mail corporativo ou Google Account válido.');
      return;
    }

    if (!editingAdmin) {
      if (senhaInicial.length < 6) {
        setErrorMsg('A senha inicial deve conter no mínimo 6 caracteres.');
        return;
      }

      if (senhaInicial !== confirmarSenha) {
        setErrorMsg('As senhas digitadas não coincidem.');
        return;
      }

      if (admins.some((a) => a.email.toLowerCase() === cleanEmail)) {
        setErrorMsg(`O e-mail "${cleanEmail}" já está cadastrado na lista de administradores.`);
        return;
      }
    } else {
      if (senhaInicial && senhaInicial.length < 6) {
        setErrorMsg('A nova senha deve conter no mínimo 6 caracteres.');
        return;
      }
      if (senhaInicial && senhaInicial !== confirmarSenha) {
        setErrorMsg('As novas senhas não coincidem.');
        return;
      }
    }

    const adminData: AdminUser = {
      id: cleanEmail,
      email: cleanEmail,
      nome: nome.trim() || cleanEmail.split('@')[0],
      cargo: cargo.trim() || 'Gestor RH',
      nivelAcesso,
      role: nivelAcesso,
      sede: rbacService.hasGlobalAccess(nivelAcesso) ? 'TODAS' : sede,
      canteiroCodigo: rbacService.hasGlobalAccess(nivelAcesso) ? 'TODAS' : sede,
      ativo: editingAdmin ? editingAdmin.ativo : true,
      criadoEm: editingAdmin?.criadoEm || new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    if (senhaInicial && senhaInicial.trim().length >= 6) {
      adminData.passwordHash = await hashPassword(senhaInicial.trim());
    } else if (editingAdmin?.passwordHash) {
      adminData.passwordHash = editingAdmin.passwordHash;
    }

    try {
      await firestoreService.saveAdminUser(adminData);
      
      // Log de Auditoria no Firestore
      await firestoreService.logSystemEvent({
        tipo: 'ALTERACAO_PERMISSAO_RBAC',
        descricao: editingAdmin 
          ? `Atualização de perfil/nível de acesso RBAC de ${adminData.nome} (${adminData.email}) para ${nivelAcesso}`
          : `Cadastro de novo administrador ${adminData.nome} (${adminData.email}) com nível ${nivelAcesso}`,
        usuario: currentUserEmail,
        detalhes: {
          email: adminData.email,
          nome: adminData.nome,
          nivelAcesso,
          cargo: adminData.cargo,
        }
      });

      setFeedbackMsg(editingAdmin 
        ? `Permissões de "${adminData.nome}" atualizadas com sucesso no Firestore!` 
        : `Administrador "${adminData.nome}" cadastrado com sucesso no Cloud Firestore!`
      );
      setIsModalOpen(false);
      setEditingAdmin(null);
      setEmail('');
      setNome('');
      setSenhaInicial('');
      setConfirmarSenha('');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar usuário no Firestore.');
    }
  };

  const handleSendResetEmail = async (targetEmail: string, adminNome: string) => {
    // Open edit modal directly so Super Admin can define a new password
    const target = admins.find(a => a.email.toLowerCase() === targetEmail.toLowerCase());
    if (target) {
      handleOpenEditModal(target);
      setFeedbackMsg(`Defina uma nova senha para ${adminNome} (${targetEmail}) diretamente pelo formulário.`);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const handleToggleStatus = async (id: string) => {
    const target = admins.find((a) => a.id === id || a.email === id);
    if (target?.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      alert('Você não pode desativar seu próprio acesso administrativo ativo.');
      return;
    }

    if (target) {
      try {
        const updated = {
          ...target,
          ativo: !target.ativo,
        };
        await firestoreService.saveAdminUser(updated);
        await firestoreService.logSystemEvent({
          tipo: 'ALTERACAO_PERMISSAO_RBAC',
          descricao: `Status de acesso de ${target.nome} alterado para ${updated.ativo ? 'ATIVO' : 'INATIVO'}`,
          usuario: currentUserEmail,
          detalhes: { email: target.email, ativo: updated.ativo }
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    const target = admins.find((a) => a.id === id || a.email === id);
    if (target?.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      alert('Você não pode excluir seu próprio usuário de administrador.');
      return;
    }

    if (window.confirm(`Tem certeza que deseja revogar o acesso administrativo de "${target?.nome || id}"?`)) {
      try {
        await firestoreService.deleteAdminUser(target?.email || id);
        await firestoreService.logSystemEvent({
          tipo: 'ALTERACAO_PERMISSAO_RBAC',
          descricao: `Revogação de acesso de administrador para ${target?.nome || id} (${target?.email || id})`,
          usuario: currentUserEmail,
          detalhes: { email: target?.email || id }
        });
        setFeedbackMsg('Administrador removido da base.');
        setTimeout(() => setFeedbackMsg(null), 3000);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com indicador Cloud */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`text-xl font-bold font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Gestão de Permissões de Acesso (RBAC)
            </h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 ${
              isDark ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <Cloud className="w-3 h-3" />
              <span>Firestore Sync</span>
            </span>
          </div>
          <p className={`text-xs mt-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            Controle estrito de perfis de acesso: Apenas e-mails autorizados têm permissão para acessar o painel de gestão.
          </p>
        </div>

        {isCurrentSuperAdmin && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar Administrador RH</span>
          </button>
        )}
      </div>

      {/* Alerta de Feedback */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Tabela de Administradores */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-bold border-b ${
              isDark ? 'bg-[#0E1015] border-[#1F2229] text-[#8E9299]' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <tr>
                <th className="py-3 px-5">Administrador</th>
                <th className="py-3 px-5">E-mail Corporativo</th>
                <th className="py-3 px-5">Cargo / Função</th>
                <th className="py-3 px-5 text-center">Canteiro / Sede</th>
                <th className="py-3 px-5 text-center">Nível de Acesso</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Cadastrado em</th>
                <th className="py-3 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${
              isDark ? 'divide-[#1F2229] text-[#E0E2E5]' : 'divide-slate-200 text-slate-800'
            }`}>
              {admins.map((adm) => {
                const isSelf = adm.email.toLowerCase() === currentUserEmail.toLowerCase();
                const roleKey = (adm.nivelAcesso || adm.role || 'AUX_DA') as AdminRole;
                const roleMeta = ROLE_INFO[roleKey] || ROLE_INFO.AUX_DA;
                const canteiroDisplay = rbacService.hasGlobalAccess(roleKey) ? 'TODAS (Global)' : (adm.sede || adm.canteiroCodigo || 'KO');

                return (
                  <tr key={adm.id} className={`transition-colors ${isDark ? 'hover:bg-[#1C1F26]' : 'hover:bg-slate-50/80'}`}>
                    {/* Nome */}
                    <td className="py-3.5 px-5 font-sans">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${
                          rbacService.hasGlobalAccess(roleKey)
                            ? isDark ? 'bg-purple-950/60 text-purple-300 border-purple-800/40' : 'bg-purple-100 text-purple-700 border-purple-300'
                            : isDark ? 'bg-blue-950/60 text-blue-300 border-blue-800/40' : 'bg-blue-100 text-blue-700 border-blue-300'
                        }`}>
                          {adm.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'} text-xs`}>
                            {adm.nome} {isSelf && <span className="text-[10px] text-blue-500 font-mono">(Você)</span>}
                          </div>
                          <span className={`text-[10px] font-mono ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>ID: {adm.id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className={`font-mono text-xs ${isDark ? 'text-[#E0E2E5]' : 'text-slate-900'}`}>
                        {adm.email}
                      </span>
                    </td>

                    {/* Cargo */}
                    <td className="py-3.5 px-5 font-sans whitespace-nowrap text-xs">
                      <span className={isDark ? 'text-[#8E9299]' : 'text-slate-600'}>{adm.cargo}</span>
                    </td>

                    {/* Canteiro / Sede */}
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${
                        canteiroDisplay.includes('Global')
                          ? isDark ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : isDark ? 'bg-blue-950/40 text-blue-300 border-blue-800/40' : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {canteiroDisplay}
                      </span>
                    </td>

                    {/* Nível de Acesso */}
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.badgeColor || 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                        {roleMeta.label || adm.nivelAcesso}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(adm.id)}
                        disabled={isSelf}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                          adm.ativo
                            ? isDark 
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50 hover:bg-emerald-900/50' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : isDark
                              ? 'bg-red-950/40 text-red-400 border-red-800/50 hover:bg-red-900/50'
                              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                        } ${isSelf ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={isSelf ? 'Não é permitido desativar seu próprio login' : 'Clique para alternar o status'}
                      >
                        {adm.ativo ? '● ATIVO' : '○ INATIVO'}
                      </button>
                    </td>

                    {/* Data de Criação */}
                    <td className={`py-3.5 px-5 text-right whitespace-nowrap text-[11px] ${
                      isDark ? 'text-[#8E9299]' : 'text-slate-500'
                    }`}>
                      {adm.criadoEm}
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {isCurrentSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(adm)}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              isDark ? 'text-amber-400 hover:bg-amber-950/40' : 'text-amber-600 hover:bg-amber-50'
                            }`}
                            title="Editar cadastro e nível de acesso"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {isCurrentSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleSendResetEmail(adm.email, adm.nome)}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              isDark ? 'text-blue-400 hover:bg-blue-950/40' : 'text-blue-600 hover:bg-blue-50'
                            }`}
                            title="Enviar link de redefinição de senha"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        )}
                        {!isSelf ? (
                          <button
                            onClick={() => handleDeleteAdmin(adm.id)}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              isDark ? 'text-red-400 hover:bg-red-950/40' : 'text-red-600 hover:bg-red-50'
                            }`}
                            title="Revogar acesso administrativo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Protegido</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className={`p-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs ${
          isDark ? 'border-[#1F2229] bg-[#0D0F14] text-[#8E9299]' : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-500" />
            <span>Segurança RBAC: Apenas usuários cadastrados e ativos no Cloud Firestore podem efetuar lançamentos e homologações.</span>
          </div>
          <span className="font-bold">SPTF Security Engine v4.0</span>
        </div>
      </div>

      {/* MODAL: NOVO ADMINISTRADOR OU EDITAR PERMISSÕES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border animate-in fade-in zoom-in-95 ${
            isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
          }`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {editingAdmin ? 'Editar Permissões de Acesso (RBAC)' : 'Cadastrar Administrador RH com Senha'}
                </h3>
              </div>
              <button
                onClick={() => { setIsModalOpen(false); setEditingAdmin(null); }}
                className={`text-sm cursor-pointer ${isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdmin} className="p-6 space-y-3.5">
              <div>
                <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                  E-mail Corporativo / Google Workspace *
                </label>
                <input
                  type="email"
                  value={email}
                  disabled={Boolean(editingAdmin)}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analista.rh@empresa.com.br"
                  required
                  className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-mono ${
                    editingAdmin ? 'opacity-60 cursor-not-allowed' : ''
                  } ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do gestor ou analista"
                  required
                  className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-sans ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                    Cargo / Função
                  </label>
                  <input
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Analista de RH"
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-sans ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className={`block font-semibold text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                      Nível de Acesso (Role) *
                    </label>
                    <InfoTooltip 
                      theme={theme}
                      content="SUPER_ADMIN / RH_ADMIN (Acesso Total Global); GERENTE_CANTEIRO / CHEFE_CANTEIRO / ENCARREGADO / CHEFE_DA / AUX_DA (Restrito ao Canteiro Ativo)."
                    />
                  </div>
                  <select
                    value={nivelAcesso}
                    onChange={(e) => setNivelAcesso(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-semibold ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN (TI - Acesso Total Global)</option>
                    <option value="RH_ADMIN">RH_ADMIN (RH Sede - Gestão Global & Folha)</option>
                    <option value="GESTOR_RH">GESTOR_RH (RH Sede - Banco de Horas)</option>
                    <option value="GERENTE_CANTEIRO">GERENTE_CANTEIRO (Gerente do Canteiro Ativo)</option>
                    <option value="CHEFE_CANTEIRO">CHEFE_CANTEIRO (Operacional - Lançamentos & Dispensas)</option>
                    <option value="ENCARREGADO_CANTEIRO">ENCARREGADO_CANTEIRO (Operacional de Campo)</option>
                    <option value="CHEFE_DA">CHEFE_DA (Gestão Administrativa do Canteiro)</option>
                    <option value="ENCARREGADO_DA">ENCARREGADO_DA (Gestão Administrativa de Campo)</option>
                    <option value="AUX_DA">AUX_DA (Auxiliar de Campo - Lançamentos & Dispensas)</option>
                    <option value="AUDITOR">AUDITOR (Auditoria e Relatórios - Somente Leitura)</option>
                  </select>
                </div>
              </div>

              {/* Seção Canteiro / Sede Vinculada */}
              <div>
                <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                  Canteiro de Obras / Sede Vinculada {rbacService.hasGlobalAccess(nivelAcesso) ? '(Acesso Global)' : '*'}
                </label>
                <select
                  value={rbacService.hasGlobalAccess(nivelAcesso) ? 'TODAS' : sede}
                  disabled={rbacService.hasGlobalAccess(nivelAcesso)}
                  onChange={(e) => setSede(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-semibold ${
                    rbacService.hasGlobalAccess(nivelAcesso) ? 'opacity-60 cursor-not-allowed' : ''
                  } ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  {rbacService.hasGlobalAccess(nivelAcesso) ? (
                    <option value="TODAS">TODAS AS SEDES E CANTEIROS (Acesso Irrestrito)</option>
                  ) : (
                    <>
                      <option value="KO">KO - Canteiro de Obras Coari (DECO-KO)</option>
                      <option value="BE">BE - Sede Belém / Destacamento de Apoio</option>
                      <option value="MN">MN - Destacamento de Manaus (BAMN)</option>
                      <option value="SP">SP - Destacamento São Paulo</option>
                      <option value="RJ">RJ - Destacamento Rio de Janeiro</option>
                    </>
                  )}
                </select>
              </div>

              {/* Senha Inicial e Confirmação */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                      {editingAdmin ? 'Credenciais de Acesso' : 'Definição de Senha Inicial'}
                    </span>
                    <InfoTooltip 
                      theme={theme}
                      content="O usuário poderá fazer login usando o e-mail cadastrado + esta senha, ou autenticar-se via Google Account vinculada."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAdminRandomPassword}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all active:scale-95 cursor-pointer ${
                      isDark 
                        ? 'bg-blue-950/40 text-blue-300 border-blue-800/60 hover:bg-blue-900/50' 
                        : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                    }`}
                    title="Gerar senha aleatória de 6 dígitos"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-blue-400" />
                    <span>Gerar 6 Dígitos</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                      {editingAdmin ? 'Nova Senha (opcional)' : 'Senha (mín. 6 dígitos) *'}
                    </label>
                    <input
                      type="password"
                      value={senhaInicial}
                      onChange={(e) => setSenhaInicial(e.target.value)}
                      placeholder="••••••••"
                      required={!editingAdmin}
                      className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-mono ${
                        isDark 
                          ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                      {editingAdmin ? 'Confirmar Nova Senha' : 'Confirmar Senha *'}
                    </label>
                    <input
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="••••••••"
                      required={!editingAdmin && Boolean(senhaInicial)}
                      className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-mono ${
                        isDark 
                          ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className={`pt-4 border-t flex justify-end gap-2 ${
                isDark ? 'border-[#1F2229]' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingAdmin(null); }}
                  className={`px-4 py-2 font-semibold text-xs cursor-pointer ${
                    isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-lg shadow-md shadow-blue-500/20 text-xs cursor-pointer"
                >
                  {editingAdmin ? 'Salvar Alterações' : 'Salvar no Firestore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
