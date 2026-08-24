import React, { useState, useMemo } from 'react';
import { ConstructionSite, Employee, InsalubrityRecord, Branch, GrauInsalubridade } from '../types';
import { 
  Building2, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  MapPin, 
  HardHat, 
  ShieldAlert, 
  Download, 
  Printer, 
  Users, 
  CheckCircle2, 
  Clock, 
  X,
  Phone,
  UserCheck,
  Building,
  AlertCircle
} from 'lucide-react';

interface CanteirosManagementProps {
  constructionSites: ConstructionSite[];
  employees: Employee[];
  insalubrityRecords: InsalubrityRecord[];
  onSaveSite: (site: Partial<ConstructionSite>) => Promise<void>;
  onDeleteSite: (id: string) => Promise<void>;
  theme?: 'dark' | 'light';
}

export const CanteirosManagement: React.FC<CanteirosManagementProps> = ({
  constructionSites,
  employees,
  insalubrityRecords,
  onSaveSite,
  onDeleteSite,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('TODAS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');

  // Modal: Add/Edit Canteiro
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<ConstructionSite | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formBranch, setFormBranch] = useState<Branch>('KO');
  const [formChief, setFormChief] = useState('');
  const [formChiefContact, setFormChiefContact] = useState('');
  const [formManager, setFormManager] = useState('');
  const [formStatus, setFormStatus] = useState<string>('Ativo');
  const [formInsalubrityLevel, setFormInsalubrityLevel] = useState<GrauInsalubridade>('20%');
  const [formStartDate, setFormStartDate] = useState('');
  const [formExpectedEndDate, setFormExpectedEndDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtered sites
  const filteredSites = useMemo(() => {
    return constructionSites.filter((site) => {
      const siteBranch = site.branch || site.sede || 'KO';
      const siteStatus = site.status || 'Ativo';
      const siteName = site.name || site.nome || '';
      const siteCode = site.code || site.codigo || '';
      const siteChief = site.chief || site.chefeCanteiro || '';
      const siteManager = site.manager || site.gerente || '';
      const siteAddress = site.address || site.endereco || '';

      const matchBranch = selectedBranch === 'TODAS' || siteBranch === selectedBranch;
      
      let matchStatus = true;
      if (selectedStatus !== 'TODOS') {
        const normStatus = siteStatus.toUpperCase();
        const normFilter = selectedStatus.toUpperCase();
        if (normFilter === 'ATIVO' || normFilter === 'ACTIVE') {
          matchStatus = normStatus === 'ATIVO' || normStatus === 'ACTIVE';
        } else if (normFilter === 'DESMOBILIZACAO' || normFilter === 'EM DESMOBILIZAÇÃO') {
          matchStatus = normStatus.includes('DESMOBILIZ');
        } else if (normFilter === 'PLANEJADO' || normFilter === 'PLANNED') {
          matchStatus = normStatus === 'PLANEJADO' || normStatus === 'PLANNED';
        } else if (normFilter === 'INATIVO' || normFilter === 'INACTIVE' || normFilter === 'ENCERRADO') {
          matchStatus = normStatus === 'INATIVO' || normStatus === 'INACTIVE' || normStatus === 'ENCERRADO';
        }
      }

      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        siteName.toLowerCase().includes(q) ||
        siteCode.toLowerCase().includes(q) ||
        siteChief.toLowerCase().includes(q) ||
        siteManager.toLowerCase().includes(q) ||
        siteAddress.toLowerCase().includes(q);

      return matchBranch && matchStatus && matchQuery;
    });
  }, [constructionSites, selectedBranch, selectedStatus, searchQuery]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingSite(null);
    setFormName('');
    setFormCode(`KO-${Math.floor(10 + Math.random() * 90)}`);
    setFormAddress('');
    setFormBranch('KO');
    setFormChief('');
    setFormChiefContact('');
    setFormManager('');
    setFormStatus('Ativo');
    setFormInsalubrityLevel('20%');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormExpectedEndDate('');
    setFormNotes('');
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (site: ConstructionSite) => {
    setEditingSite(site);
    setFormName(site.name || site.nome || '');
    setFormCode(site.code || site.codigo || '');
    setFormAddress(site.address || site.endereco || '');
    setFormBranch((site.branch || site.sede || 'KO') as Branch);
    setFormChief(site.chief || site.chefeCanteiro || '');
    setFormChiefContact((site as any).chiefContact || (site as any).chefeContato || (site as any).contato || '');
    setFormManager(site.manager || site.gerente || '');
    
    // Normalize status for selector
    const st = String(site.status || 'Ativo').toUpperCase();
    if (st === 'ACTIVE' || st === 'ATIVO') setFormStatus('Ativo');
    else if (st.includes('DESMOBILIZ')) setFormStatus('Em Desmobilização');
    else if (st === 'PLANNED' || st === 'PLANEJADO') setFormStatus('Planejado');
    else setFormStatus('Inativo');

    setFormInsalubrityLevel(site.insalubrityLevel || site.grauInsalubridade || '20%');
    setFormStartDate(site.startDate || site.dataInicio || '');
    setFormExpectedEndDate(site.expectedEndDate || site.dataPrevisaoFim || '');
    setFormNotes(site.notes || site.observacoes || '');
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  // Save form handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe o nome do canteiro de obras.' });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    const sitePayload: any = {
      ...(editingSite ? { id: editingSite.id } : {}),
      name: formName.trim(),
      nome: formName.trim(),
      code: formCode.trim().toUpperCase(),
      codigo: formCode.trim().toUpperCase(),
      address: formAddress.trim(),
      endereco: formAddress.trim(),
      branch: formBranch,
      sede: formBranch,
      chief: formChief.trim(),
      chefeCanteiro: formChief.trim(),
      chiefContact: formChiefContact.trim(),
      chefeContato: formChiefContact.trim(),
      manager: formManager.trim(),
      gerente: formManager.trim(),
      status: formStatus,
      insalubrityLevel: formInsalubrityLevel,
      grauInsalubridade: formInsalubrityLevel,
      startDate: formStartDate,
      dataInicio: formStartDate,
      expectedEndDate: formExpectedEndDate,
      dataPrevisaoFim: formExpectedEndDate,
      notes: formNotes.trim(),
      observacoes: formNotes.trim(),
    };

    try {
      if (typeof onSaveSite === 'function') {
        await onSaveSite(sitePayload);
      }
      setFeedbackMsg({ type: 'success', text: 'Canteiro de obras salvo com sucesso no banco de dados!' });
      setTimeout(() => {
        setIsModalOpen(false);
      }, 700);
    } catch (err: any) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: 'Erro ao salvar canteiro no Firestore. Verifique sua conexão.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete site handler
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Deseja realmente excluir/desativar o canteiro "${name}"?`)) return;
    try {
      if (typeof onDeleteSite === 'function') {
        await onDeleteSite(id);
      }
    } catch (err) {
      console.error('Erro ao excluir canteiro:', err);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    const headers = ['Código', 'Nome do Canteiro', 'Sede', 'Encarregado', 'Contato', 'Gerente/Fiscal', 'Endereço', 'Status', 'Grau Insalubridade', 'Início', 'Previsão Término'];
    const rows = filteredSites.map((s: any) => [
      `"${s.code || s.codigo || ''}"`,
      `"${s.name || s.nome || ''}"`,
      `"${s.branch || s.sede || ''}"`,
      `"${s.chief || s.chefeCanteiro || ''}"`,
      `"${s.chiefContact || s.chefeContato || s.contato || ''}"`,
      `"${s.manager || s.gerente || ''}"`,
      `"${s.address || s.endereco || ''}"`,
      `"${s.status || 'Ativo'}"`,
      `"${s.insalubrityLevel || s.grauInsalubridade || 'ISENTO'}"`,
      `"${s.startDate || s.dataInicio || ''}"`,
      `"${s.expectedEndDate || s.dataPrevisaoFim || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comara_gestao_canteiros_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Status Badge Helper
  const renderStatusBadge = (rawStatus?: string) => {
    const st = (rawStatus || 'Ativo').toUpperCase();
    if (st === 'ACTIVE' || st === 'ATIVO') {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
          isDark 
            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60' 
            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Ativo
        </span>
      );
    }
    if (st.includes('DESMOBILIZ')) {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
          isDark 
            ? 'bg-amber-950/70 text-amber-300 border border-amber-700/60' 
            : 'bg-amber-100 text-amber-800 border border-amber-300'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Em Desmobilização
        </span>
      );
    }
    if (st === 'PLANNED' || st === 'PLANEJADO') {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
          isDark 
            ? 'bg-blue-950/70 text-blue-300 border border-blue-700/60' 
            : 'bg-blue-100 text-blue-800 border border-blue-300'
        }`}>
          <Clock className="w-3 h-3 text-blue-400" />
          Planejado
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
        isDark 
          ? 'bg-gray-800/80 text-gray-400 border border-gray-700' 
          : 'bg-gray-200 text-gray-700 border border-gray-300'
      }`}>
        Inativo / Encerrado
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* CABEÇALHO OPERACIONAL & BARRA DE AÇÕES                        */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-white border-gray-200 shadow-xs'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Gestão Operacional de Canteiros de Obras</span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-mono ${
                  isDark ? 'bg-[#1A1D24] text-gray-400 border border-[#262A35]' : 'bg-gray-100 text-gray-700 border border-gray-300'
                }`}>
                  {filteredSites.length} {filteredSites.length === 1 ? 'frente' : 'frentes'}
                </span>
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Cadastro, acompanhamento de encarregados e controle das frentes de serviço da COMARA.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              isDark ? 'bg-[#15171C] border-[#2A2E38] hover:bg-[#1F2229] text-gray-300' : 'bg-white border-gray-300 hover:bg-gray-100 text-gray-700'
            }`}
            title="Exportar dados em formato CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-md flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Canteiro</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FILTROS RÁPIDOS (BUSCA, SEDE, STATUS)                         */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-3 sm:p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-3 ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200 shadow-xs'
      }`}>
        <div className="relative w-full md:w-80">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, código, encarregado ou endereço..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none transition-colors ${
              isDark ? 'bg-[#0D0F14] border-[#262A35] text-white focus:border-amber-500' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-amber-500'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold outline-none ${
              isDark ? 'bg-[#0D0F14] border-[#262A35] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
            }`}
          >
            <option value="TODAS">Todas as Sedes</option>
            <option value="KO">Sede Coari (KO)</option>
            <option value="BE">Sede Belém (BE)</option>
            <option value="MN">Sede Manaus (MN)</option>
            <option value="SP">Sede São Paulo (SP)</option>
            <option value="RJ">Sede Rio de Janeiro (RJ)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold outline-none ${
              isDark ? 'bg-[#0D0F14] border-[#262A35] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
            }`}
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ATIVO">Ativos</option>
            <option value="DESMOBILIZACAO">Em Desmobilização</option>
            <option value="PLANEJADO">Planejados</option>
            <option value="INATIVO">Inativos / Concluídos</option>
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TABELA OPERACIONAL DE CANTEIROS                               */}
      {/* ------------------------------------------------------------- */}
      <div className={`rounded-2xl border overflow-x-auto shadow-inner ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200'
      }`}>
        <table className="w-full text-left border-collapse min-w-[950px]">
          <thead>
            <tr className={`text-xs uppercase font-mono font-bold border-b ${
              isDark ? 'bg-[#0D0F14] text-[#8E9299] border-[#1F2229]' : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              <th className="py-3.5 px-4 min-w-[260px]">NOME DO CANTEIRO / SEDE</th>
              <th className="py-3.5 px-4 min-w-[200px]">ENCARREGADO / CHEFE</th>
              <th className="py-3.5 px-4 min-w-[180px]">GERENTE DE OBRA / FISCAL</th>
              <th className="py-3.5 px-4 min-w-[220px]">ENDEREÇO / LOCALIZAÇÃO</th>
              <th className="py-3.5 px-4 min-w-[140px] text-center">STATUS</th>
              <th className="py-3.5 px-4 min-w-[150px] text-center">AÇÕES</th>
            </tr>
          </thead>
          <tbody className={`text-xs divide-y ${
            isDark ? 'divide-[#1F2229] text-[#E0E2E5]' : 'divide-gray-200 text-gray-800'
          }`}>
            {filteredSites.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500 font-mono">
                  <Building2 className="w-8 h-8 mx-auto text-gray-500 opacity-40 mb-2" />
                  Nenhum canteiro de obras encontrado para os filtros informados.
                </td>
              </tr>
            ) : (
              filteredSites.map((site: any) => {
                const siteName = site.name || site.nome || 'Canteiro sem nome';
                const siteCode = site.code || site.codigo || 'CT-01';
                const siteBranch = site.branch || site.sede || 'KO';
                const siteChief = site.chief || site.chefeCanteiro || '';
                const siteChiefContact = site.chiefContact || site.chefeContato || site.contato || '';
                const siteManager = site.manager || site.gerente || '';
                const siteAddress = site.address || site.endereco || '';
                const siteInsalubrity = site.insalubrityLevel || site.grauInsalubridade || '20%';

                return (
                  <tr
                    key={site.id}
                    className={`transition-colors ${isDark ? 'hover:bg-[#1C1F26]' : 'hover:bg-amber-50/30'}`}
                  >
                    {/* 1. Nome do Canteiro / Sede */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded font-mono font-black text-[10px] border ${
                            isDark ? 'bg-amber-950/70 text-amber-300 border-amber-800/60' : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {siteCode}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isDark ? 'bg-[#0D0F14] border-[#2A2E38] text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
                          }`}>
                            Sede {siteBranch}
                          </span>
                          {siteInsalubrity && siteInsalubrity !== 'ISENTO' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                              NR-15 ({siteInsalubrity})
                            </span>
                          )}
                        </div>
                        <div className={`font-bold text-sm leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {siteName}
                        </div>
                        {site.notes || site.observacoes ? (
                          <div className={`text-[11px] italic line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            "{site.notes || site.observacoes}"
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* 2. Encarregado / Chefe */}
                    <td className="py-3.5 px-4">
                      {siteChief ? (
                        <div className="space-y-0.5">
                          <div className="font-bold flex items-center gap-1.5">
                            <HardHat className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{siteChief}</span>
                          </div>
                          {siteChiefContact && (
                            <div className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              <Phone className="w-3 h-3 text-blue-400 shrink-0" />
                              <span>{siteChiefContact}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Não designado</span>
                      )}
                    </td>

                    {/* 3. Gerente / Fiscal */}
                    <td className="py-3.5 px-4">
                      {siteManager ? (
                        <div className="font-semibold flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{siteManager}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Não informado</span>
                      )}
                    </td>

                    {/* 4. Endereço / Localização */}
                    <td className="py-3.5 px-4">
                      {siteAddress ? (
                        <div className={`flex items-start gap-1.5 text-xs max-w-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{siteAddress}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Sem endereço cadastrado</span>
                      )}
                    </td>

                    {/* 5. Status */}
                    <td className="py-3.5 px-4 text-center">
                      {renderStatusBadge(site.status)}
                    </td>

                    {/* 6. Ações (Editar e Excluir) */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(site)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            isDark 
                              ? 'bg-[#1C202B] border-[#2A3040] hover:bg-[#252B3A] text-blue-400' 
                              : 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700'
                          }`}
                          title="Editar dados do Canteiro"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => handleDelete(site.id, siteName)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            isDark 
                              ? 'bg-[#2B1C1F] border-[#402A30] hover:bg-[#3A252B] text-red-400' 
                              : 'bg-red-50 border-red-200 hover:bg-red-100 text-red-700'
                          }`}
                          title="Excluir / Desativar Canteiro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CRIAR / EDITAR CANTEIRO                                */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-xl p-6 rounded-3xl border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-[#14171F] border-[#252B38] text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-[#252B38]' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingSite ? 'Editar Canteiro de Obras' : 'Cadastrar Novo Canteiro'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Preencha as informações operacionais da frente de serviço.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedbackMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedbackMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Código do Canteiro *</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Ex: KO-01, BE-02"
                    required
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border outline-none ${
                      isDark ? 'bg-[#0B0D11] border-[#252A36] text-white focus:border-amber-500' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-amber-500'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Sede Vinculada *</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value as Branch)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border font-medium outline-none ${
                      isDark ? 'bg-[#0B0D11] border-[#252A36] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="KO">Coari (KO)</option>
                    <option value="BE">Belém (BE)</option>
                    <option value="MN">Manaus (MN)</option>
                    <option value="SP">São Paulo (SP)</option>
                    <option value="RJ">Rio de Janeiro (RJ)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase">Nome do Canteiro / Frente de Serviço *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Obra Aeródromo Coari - Pista e Pátio"
                  required
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'bg-[#0B0D11] border-[#252A36] text-white focus:border-amber-500' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-amber-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Encarregado / Chefe de Canteiro</label>
                  <input
                    type="text"
                    value={formChief}
                    onChange={(e) => setFormChief(e.target.value)}
                    placeholder="Ex: 1º Sgt Silva"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B0D11] border-[#252A36] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Contato do Encarregado (Telefone / Rádio)</label>
                  <input
                    type="text"
                    value={formChiefContact}
                    onChange={(e) => setFormChiefContact(e.target.value)}
                    placeholder="Ex: (97) 98123-4567 / Rádio Ch-04"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B0D11] border-[#252A36] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Gerente de Obra / Fiscal</label>
                  <input
                    type="text"
                    value={formManager}
                    onChange={(e) => setFormManager(e.target.value)}
                    placeholder="Ex: Cap Eng Oliveira"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B0D11] border-[#252A36] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Status Operacional</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border font-medium outline-none ${
                      isDark ? 'bg-[#0B0D11] border-[#252A36] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="Ativo">Ativo (Em Operação)</option>
                    <option value="Em Desmobilização">Em Desmobilização</option>
                    <option value="Planejado">Planejado (Em Mobilização)</option>
                    <option value="Inativo">Inativo / Concluído</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase">Endereço / Localização</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Ex: Estrada do Aeroporto, s/n - Coari/AM"
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'bg-[#0B0D11] border-[#252A36] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Grau Insalubridade</label>
                  <select
                    value={formInsalubrityLevel}
                    onChange={(e) => setFormInsalubrityLevel(e.target.value as GrauInsalubridade)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border font-bold outline-none ${
                      isDark ? 'bg-[#0B0D11] border-[#252A36] text-amber-400' : 'bg-gray-50 border-gray-300 text-amber-600'
                    }`}
                  >
                    <option value="ISENTO">Isento (0%)</option>
                    <option value="10%">Mínimo (10%)</option>
                    <option value="20%">Médio (20%)</option>
                    <option value="40%">Máximo (40%)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Data Início</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B0D11] border-[#252A36] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Previsão Fim</label>
                  <input
                    type="date"
                    value={formExpectedEndDate}
                    onChange={(e) => setFormExpectedEndDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B0D11] border-[#252A36] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase">Observações Operacionais</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Informações adicionais sobre escopo, britagem, terraplenagem..."
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'bg-[#0B0D11] border-[#252A36] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? 'border-[#252B38]' : 'border-gray-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 cursor-pointer shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Salvando no Firestore...' : 'Salvar Canteiro'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
