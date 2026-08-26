import React, { useState, useRef, useEffect } from 'react';
import { SystemConfig, AdminRole } from '../types';
import { ComaraLogo } from './ComaraLogo';
import { rbacService, ROLE_INFO } from '../services/rbacService';
import { 
  BarChart3, 
  Plus, 
  Users, 
  BookOpen, 
  RotateCcw, 
  Zap, 
  ShieldCheck, 
  UserCheck, 
  Sun, 
  Moon, 
  Lock, 
  ChevronDown, 
  Settings, 
  Shield, 
  User, 
  ExternalLink, 
  Sparkles, 
  Check, 
  Trash2, 
  UploadCloud, 
  FileSpreadsheet, 
  LogOut, 
  Cloud,
  HardHat,
  Building2,
  Image as ImageIcon,
  Clock,
  CalendarCheck2,
  Receipt,
  FileText
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'colaboradores' | 'canteiros' | 'insalubridade' | 'contracheques' | 'relatorios' | 'extrato' | 'portal_colaborador' | 'permissoes_admin' | 'arquitetura';
export type UserMode = 'ADMIN' | 'COLABORADOR';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewEntry: () => void;
  onOpenQuickBatchModal: () => void;
  onOpenSptfDispensa?: () => void;
  onResetData: () => void;
  onClearData: () => void;
  onOpenImportRecordsModal: () => void;
  onOpenLogoModal?: () => void;
  systemConfig?: SystemConfig;
  totalEmployees: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  userMode: UserMode;
  onToggleUserMode: (mode: UserMode) => void;
  onSelectRole?: (role: AdminRole) => void;
  currentUserEmail: string;
  userRole?: AdminRole | string;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewEntry,
  onOpenQuickBatchModal,
  onOpenSptfDispensa,
  onResetData,
  onClearData,
  onOpenImportRecordsModal,
  onOpenLogoModal,
  systemConfig,
  totalEmployees,
  theme,
  onToggleTheme,
  userMode,
  onToggleUserMode,
  onSelectRole,
  currentUserEmail,
  userRole = 'SUPER_ADMIN',
  onSignOut,
}) => {
  const isDark = theme === 'dark';
  const isAdmin = userMode === 'ADMIN';
  const currentRole = (userRole || 'SUPER_ADMIN') as AdminRole;
  const roleMeta = ROLE_INFO[currentRole] || ROLE_INFO.AUX_DA;
  const isAuxDA = currentRole === 'AUX_DA' || (currentRole as string) === 'AUXILIAR_DA';

  const canManageAdmins = rbacService.canManageAdmins(currentRole);
  const canManageSystem = rbacService.canManageSystemConfig(currentRole);
  const canImportFolha = rbacService.canImportFolha(currentRole);
  const canManageCanteiros = rbacService.canManageCanteiros(currentRole);
  const canLaunchHours = rbacService.canLaunchHours(currentRole);
  const canLaunchInsalubrity = rbacService.canLaunchInsalubrity(currentRole);
  const canIssueDispensa = rbacService.canIssueDispensa(currentRole);

  // Dropdown states
  const [isLaunchDropdownOpen, setIsLaunchDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const launchMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (launchMenuRef.current && !launchMenuRef.current.contains(event.target as Node)) {
        setIsLaunchDropdownOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={`${
      isDark ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5]' : 'bg-white border-slate-200 text-slate-800'
    } border-b sticky top-0 z-40 shadow-xs transition-colors`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* ========================================================= */}
          {/* 1. ESQUERDA: LOGOTIPO & MARCA COM CANTEIRO */}
          {/* ========================================================= */}
          <div 
            className="flex items-center space-x-3 cursor-pointer shrink-0 group select-none" 
            onClick={() => onSelectTab('dashboard')}
            title="Ir para o Dashboard Principal"
          >
            <ComaraLogo logoUrl={systemConfig?.logoUrl} size="sm" />
            <div>
              <div className="flex items-center space-x-2">
                <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  COMARA <span className="text-[#3B82F6]">SPTF</span>
                </span>
                <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${
                  isDark 
                    ? 'bg-[#1F2229] text-blue-400 border-[#2A2E38]' 
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  RH Cloud
                </span>
              </div>
              <p className={`text-[10px] font-mono font-medium ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                Sedes: <span className="text-[#3B82F6] font-bold">KO</span> • BE • MN
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. CENTRO: ABAS PRINCIPAIS EM GRUPO LIMPO */}
          {/* ========================================================= */}
          <nav className="hidden lg:flex items-center space-x-1 bg-transparent p-1 rounded-xl">
            {/* Aba 1: Dashboard */}
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'dashboard' || activeTab === 'extrato'
                  ? isDark 
                    ? 'bg-[#1F2229] text-white border border-[#2A2E38] shadow-xs' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#8E9299] hover:text-[#E0E2E5] hover:bg-[#15171C]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Dashboard</span>
            </button>

            {/* Aba 2: Colaboradores */}
            <button
              onClick={() => onSelectTab('colaboradores')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'colaboradores'
                  ? isDark 
                    ? 'bg-[#1F2229] text-white border border-[#2A2E38] shadow-xs' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#8E9299] hover:text-[#E0E2E5] hover:bg-[#15171C]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Colaboradores</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-normal ${
                isDark ? 'bg-[#0D0F14] text-[#8E9299]' : 'bg-slate-200 text-slate-700'
              }`}>
                {totalEmployees}
              </span>
            </button>

            {/* Aba 3: Insalubridade (Matriz Simples & Completa) */}
            <button
              onClick={() => onSelectTab('insalubridade')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'insalubridade'
                  ? isDark 
                    ? 'bg-[#1F2229] text-amber-400 border border-[#2A2E38] shadow-xs' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#8E9299] hover:text-[#E0E2E5] hover:bg-[#15171C]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HardHat className="w-3.5 h-3.5 text-amber-400" />
              <span>Insalubridade</span>
            </button>

            {/* Aba 4: Contracheques Digitais (Importação e Gestão) */}
            <button
              onClick={() => onSelectTab('contracheques')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'contracheques'
                  ? isDark 
                    ? 'bg-[#1F2229] text-emerald-400 border border-[#2A2E38] shadow-xs' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#8E9299] hover:text-[#E0E2E5] hover:bg-[#15171C]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contracheques</span>
            </button>

            {/* Aba 5: Manual */}
            <button
              onClick={() => onSelectTab('arquitetura')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'arquitetura'
                  ? isDark 
                    ? 'bg-[#1F2229] text-cyan-400 border border-[#2A2E38] shadow-xs' 
                    : 'bg-blue-50 text-cyan-700 border border-cyan-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#8E9299] hover:text-[#E0E2E5] hover:bg-[#15171C]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Manual</span>
            </button>
          </nav>

          {/* ========================================================= */}
          {/* 3. DIREITA: AÇÕES RÁPIDAS & PERFIL AGRUPADO */}
          {/* ========================================================= */}
          <div className="flex items-center space-x-2 shrink-0">
            
            {/* BOTÃO PRIMÁRIO: LANÇAMENTO COM MENU DE OPÇÕES (HORAS OU INSALUBRIDADE) */}
            <div className="relative" ref={launchMenuRef}>
              <button
                onClick={() => {
                  setIsLaunchDropdownOpen(!isLaunchDropdownOpen);
                  setIsSettingsOpen(false);
                  setIsProfileOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer"
                title="Lançamento (Horas ou Insalubridade)"
                aria-expanded={isLaunchDropdownOpen}
              >
                <Plus className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${isLaunchDropdownOpen ? 'rotate-45' : ''}`} />
                <span>Lançamento</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isLaunchDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menu Suspenso de Opções de Lançamento */}
              {isLaunchDropdownOpen && (
                <div className={`absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl border py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  isDark ? 'bg-[#15171C] border-[#1F2229] text-[#E0E2E5]' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className={`px-3.5 py-1.5 border-b text-[10px] uppercase font-bold tracking-wider ${
                    isDark ? 'border-[#1F2229] text-[#8E9299]' : 'border-slate-100 text-slate-500'
                  }`}>
                    Selecione o Lançamento
                  </div>

                  {/* 1. Opção: Lançamento de Horas (Lote / Rápido) */}
                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setIsLaunchDropdownOpen(false);
                        onOpenQuickBatchModal();
                      }}
                      className={`w-full px-3 py-2.5 text-xs text-left flex items-start gap-2.5 rounded-xl transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-blue-50/70 text-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 mt-0.5">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold flex items-center justify-between">
                          <span>Lançamento de Horas</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                          }`}>
                            Lote / Rápido
                          </span>
                        </div>
                        <p className={`text-[11px] mt-0.5 leading-tight ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                          Horas extras, trabalhos e faltas para múltiplos colaboradores
                        </p>
                      </div>
                    </button>

                    {/* 2. Opção: Lançamento Individual de Horas */}
                    <button
                      onClick={() => {
                        setIsLaunchDropdownOpen(false);
                        onOpenNewEntry();
                      }}
                      className={`w-full px-3 py-2 text-xs text-left flex items-start gap-2.5 rounded-xl transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-blue-50/70 text-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20 mt-0.5">
                        <CalendarCheck2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold flex items-center justify-between">
                          <span>Lançamento Individual (Horas)</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                          }`}>
                            Diário
                          </span>
                        </div>
                        <p className={`text-[11px] mt-0.5 leading-tight ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                          Lançamento único com anexo de atestado/comprovante
                        </p>
                      </div>
                    </button>
                    {/* 3. Opção: Nova Dispensa de SPTF */}
                    {onOpenSptfDispensa && (
                      <button
                        id="btn-nav-nova-dispensa-sptf"
                        onClick={() => {
                          setIsLaunchDropdownOpen(false);
                          onOpenSptfDispensa();
                        }}
                        className={`w-full px-3 py-2 text-xs text-left flex items-start gap-2.5 rounded-xl transition-colors cursor-pointer ${
                          isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-blue-50/70 text-slate-800'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold flex items-center justify-between">
                            <span>Nova Dispensa de SPTF</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              2 Vias A4
                            </span>
                          </div>
                          <p className={`text-[11px] mt-0.5 leading-tight ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                            Emissão de guia com débito automático no banco
                          </p>
                        </div>
                      </button>
                    )}
                  </div>

                  <div className={`my-1 border-t ${isDark ? 'border-[#1F2229]' : 'border-slate-100'}`} />

                  {/* 4. Opção: Lançamento de Insalubridade */}
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setIsLaunchDropdownOpen(false);
                        onSelectTab('insalubridade');
                      }}
                      className={`w-full px-3 py-2.5 text-xs text-left flex items-start gap-2.5 rounded-xl transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-amber-50/70 text-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 mt-0.5">
                        <HardHat className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold flex items-center justify-between">
                          <span>Lançamento de Insalubridade</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                          }`}>
                            NR-15 / Campo
                          </span>
                        </div>
                        <p className={`text-[11px] mt-0.5 leading-tight ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                          Planilha mensal de efetivo, atividades e auditoria técnica
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ALTERNADOR DE TEMA (SOL / LUA) */}
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-xl transition-colors border cursor-pointer ${
                isDark 
                  ? 'bg-[#15171C] hover:bg-[#1F2229] text-amber-400 hover:text-amber-300 border-[#1F2229]' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200'
              }`}
              title={isDark ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* DROPDOWN DE CONFIGURAÇÕES / AÇÕES (ÍCONE DE ENGRENAGEM ⚙️) */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => {
                  setIsSettingsOpen(!isSettingsOpen);
                  setIsProfileOpen(false);
                }}
                className={`p-2 rounded-xl transition-colors border cursor-pointer ${
                  isSettingsOpen
                    ? isDark 
                      ? 'bg-[#1F2229] text-white border-blue-500/50' 
                      : 'bg-slate-200 text-slate-900 border-blue-300'
                    : isDark 
                      ? 'bg-[#15171C] hover:bg-[#1F2229] text-[#8E9299] hover:text-white border-[#1F2229]' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                }`}
                title="Configurações e Menu do Sistema"
                aria-label="Configurações"
              >
                <Settings className={`w-4 h-4 transition-transform duration-200 ${isSettingsOpen ? 'rotate-45 text-[#3B82F6]' : ''}`} />
              </button>

              {/* Menu Suspenso de Configurações */}
              {isSettingsOpen && (
                <div className={`absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl border py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  isDark ? 'bg-[#15171C] border-[#1F2229] text-[#E0E2E5]' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className={`px-3.5 py-2 border-b text-[10px] uppercase font-bold tracking-wider ${
                    isDark ? 'border-[#1F2229] text-[#8E9299]' : 'border-slate-100 text-slate-500'
                  }`}>
                    Gestão & Sistema
                  </div>

                  {/* 1. Canteiros de Obras */}
                  {canManageCanteiros && (
                    <button
                      onClick={() => {
                        onSelectTab('canteiros');
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                        activeTab === 'canteiros'
                          ? isDark ? 'bg-amber-950/30 text-amber-300' : 'bg-amber-50 text-amber-800'
                          : isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Canteiros de Obras</div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                          Cadastro de sedes, chefias e equipes
                        </span>
                      </div>
                    </button>
                  )}

                  {/* 2. Relatórios */}
                  <button
                    onClick={() => {
                      onSelectTab('relatorios');
                      setIsSettingsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'relatorios'
                        ? isDark ? 'bg-indigo-950/30 text-indigo-300' : 'bg-indigo-50 text-indigo-800'
                        : isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Relatórios</div>
                      <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                        Extratos, auditoria e exportação
                      </span>
                    </div>
                  </button>

                  {/* 3. Configurações do Sistema (Logo & Modo Insalubridade) */}
                  {canManageSystem && onOpenLogoModal && (
                    <button
                      onClick={() => {
                        onOpenLogoModal();
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                        <Settings className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Configurações do Sistema</div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                          Logo COMARA e modo de insalubridade
                        </span>
                      </div>
                    </button>
                  )}

                  {/* 4. Gestão de Acessos & Permissões - Apenas Administradores com permissão */}
                  {canManageAdmins && (
                    <button
                      onClick={() => {
                        onSelectTab('permissoes_admin');
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                        activeTab === 'permissoes_admin'
                          ? isDark ? 'bg-purple-950/30 text-purple-300' : 'bg-purple-50 text-purple-800'
                          : isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold flex items-center justify-between">
                          <span>Gestão de Acessos (RBAC)</span>
                          {!isAdmin && <Lock className="w-3 h-3 text-amber-400" />}
                        </div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                          Controle de permissões e administradores
                        </span>
                      </div>
                    </button>
                  )}

                  {(canImportFolha || canManageSystem) && <div className={`my-1 border-t ${isDark ? 'border-[#1F2229]' : 'border-slate-100'}`} />}

                  {/* 5. Importar Lançamentos (CSV) */}
                  {canImportFolha && (
                    <button
                      onClick={() => {
                        onOpenImportRecordsModal();
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                        <UploadCloud className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Importar Lançamentos (CSV)</div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                          Carga de histórico do banco de horas
                        </span>
                      </div>
                    </button>
                  )}

                  {/* 6. Gerenciar/Importar Colaboradores */}
                  {canImportFolha && (
                    <button
                      onClick={() => {
                        onSelectTab('colaboradores');
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-[#1F2229] text-[#E0E2E5]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Importar Pessoas (CSV)</div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                          Cadastro em massa de funcionários
                        </span>
                      </div>
                    </button>
                  )}

                  {canManageSystem && (
                    <>
                      <div className={`my-1 border-t ${isDark ? 'border-[#1F2229]' : 'border-slate-100'}`} />

                      {/* 7. Zerar Base de Dados para Importação Real */}
                      <button
                        onClick={() => {
                          onClearData();
                          setIsSettingsOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                          isDark ? 'hover:bg-[#1F2229] text-rose-300' : 'hover:bg-rose-50 text-rose-700'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                          <Trash2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-rose-500 dark:text-rose-400">Limpar Base Central</div>
                          <span className={`text-[10px] block opacity-80`}>
                            Zerar dados para importar seus arquivos reais
                          </span>
                        </div>
                      </button>

                      {/* 8. Restaurar Base de Demonstração */}
                      <button
                        onClick={() => {
                          onResetData();
                          setIsSettingsOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                          isDark ? 'hover:bg-[#1F2229] text-[#8E9299]' : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-lg bg-slate-500/10 text-slate-400 flex items-center justify-center shrink-0 border border-slate-500/20">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">Carregar Exemplos Mocks</div>
                          <span className={`text-[10px] block opacity-70`}>
                            Recarregar dados de teste
                          </span>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* PERFIL (AVATAR SIMPLES E DROPDOWN) */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsSettingsOpen(false);
                }}
                className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isProfileOpen
                    ? isDark 
                      ? 'bg-[#1F2229] border-blue-500/50' 
                      : 'bg-slate-100 border-blue-300'
                    : isDark 
                      ? 'bg-[#15171C] hover:bg-[#1F2229] border-[#1F2229]' 
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                }`}
                title="Perfil e Sessão"
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  isAdmin 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-amber-600 text-white shadow-xs'
                }`}>
                  {userRole === 'SUPER_ADMIN' ? 'SA' : isAdmin ? 'RH' : 'CL'}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#8E9299] transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menu Suspenso de Perfil & Preferências */}
              {isProfileOpen && (
                <div className={`absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl border py-2 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  isDark ? 'bg-[#15171C] border-[#1F2229] text-[#E0E2E5]' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  {/* Header do Usuário */}
                  <div className={`px-4 py-3 border-b ${isDark ? 'border-[#1F2229]' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white ${
                        currentRole === 'SUPER_ADMIN' 
                          ? 'bg-purple-600' 
                          : currentRole === 'RH_ADMIN' || currentRole === 'GESTOR_RH'
                            ? 'bg-indigo-600' 
                            : currentRole === 'GERENTE_CANTEIRO'
                              ? 'bg-blue-600'
                              : currentRole.includes('CHEFE')
                                ? 'bg-amber-600'
                                : currentRole.includes('ENCARREGADO')
                                  ? 'bg-emerald-600'
                                  : 'bg-cyan-600'
                      }`}>
                        {currentRole === 'SUPER_ADMIN' ? 'TI' : currentRole === 'RH_ADMIN' || currentRole === 'GESTOR_RH' ? 'RH' : currentRole === 'AUX_DA' ? 'DA' : 'OP'}
                      </div>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {roleMeta.label}
                          </span>
                        </div>
                        <p className={`text-[10px] font-mono truncate mt-0.5 ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                          {currentUserEmail}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cloud Connection Badge */}
                  <div className={`px-4 py-2 text-[10px] font-mono flex items-center gap-1.5 border-b ${
                    isDark ? 'bg-emerald-950/20 text-emerald-400 border-[#1F2229]' : 'bg-emerald-50 text-emerald-700 border-slate-100'
                  }`}>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Firestore Cloud Sincronizado</span>
                  </div>

                  {/* Seção 1: Alternador de Modo de Acesso (RBAC) */}
                  <div className="p-3">
                    <span className={`text-[10px] uppercase font-bold tracking-wider block mb-2 px-1 ${
                      isDark ? 'text-[#8E9299]' : 'text-slate-500'
                    }`}>
                      Perfil de Acesso
                    </span>

                    {/* Botões Rápidos de Simulação de Cargo */}
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      <button
                        onClick={() => {
                          onToggleUserMode('ADMIN');
                          if (onSelectRole) onSelectRole('AUX_DA');
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                          isAuxDA && isAdmin
                            ? isDark 
                              ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 shadow-xs font-bold' 
                              : 'bg-cyan-50 text-cyan-700 border border-cyan-300 shadow-xs font-bold'
                            : isDark ? 'bg-[#0D0F14] text-[#8E9299] hover:text-white border border-[#1F2229]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                        title="Perfil Enxuto e Simplificado para Auxiliar de DA"
                      >
                        <HardHat className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Aux de DA</span>
                      </button>

                      <button
                        onClick={() => {
                          onToggleUserMode('ADMIN');
                          if (onSelectRole) onSelectRole('GESTOR_RH');
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                          !isAuxDA && isAdmin
                            ? isDark 
                              ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60 shadow-xs font-bold' 
                              : 'bg-white text-purple-700 border border-purple-200 shadow-xs font-bold'
                            : isDark ? 'bg-[#0D0F14] text-[#8E9299] hover:text-white border border-[#1F2229]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                        title="Perfil Completo Gestor RH"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                        <span>Gestor RH</span>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        onToggleUserMode('COLABORADOR');
                      }}
                      className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                        !isAdmin 
                          ? isDark 
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60 shadow-xs font-bold' 
                            : 'bg-white text-amber-800 border border-amber-200 shadow-xs font-bold'
                          : isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Visão Portal Colaborador</span>
                    </button>
                  </div>

                  <div className={`border-t ${isDark ? 'border-[#1F2229]' : 'border-slate-100'}`} />

                  {/* Seção 2: Alternador de Tema Claro/Escuro */}
                  <div className="p-3">
                    <span className={`text-[10px] uppercase font-bold tracking-wider block mb-2 px-1 ${
                      isDark ? 'text-[#8E9299]' : 'text-slate-500'
                    }`}>
                      Tema Visual
                    </span>

                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/10 dark:bg-black/30 border border-slate-200/50 dark:border-slate-800/60">
                      <button
                        onClick={() => {
                          if (isDark) onToggleTheme();
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                          !isDark 
                            ? 'bg-white text-blue-700 border border-blue-200 shadow-xs font-bold' 
                            : 'text-[#8E9299] hover:text-white'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Claro</span>
                      </button>

                      <button
                        onClick={() => {
                          if (!isDark) onToggleTheme();
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                          isDark 
                            ? 'bg-[#1F2229] text-white border border-[#2A2E38] shadow-xs font-bold' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5 text-blue-400" />
                        <span>Escuro</span>
                      </button>
                    </div>
                  </div>

                  {/* Seção 3: Logout / Desconectar */}
                  {onSignOut && (
                    <div className={`p-2 border-t ${isDark ? 'border-[#1F2229]' : 'border-slate-100'}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          onSignOut();
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                          isDark 
                            ? 'bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-800/40' 
                            : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                        }`}
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Encerrar Sessão (Sair)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Navegação Mobile Compacta */}
      <div className={`md:hidden flex items-center justify-around border-t ${
        isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
      } px-2 py-1.5 text-xs overflow-x-auto`}>
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
            activeTab === 'dashboard' || activeTab === 'extrato'
              ? isDark ? 'text-blue-400 font-bold bg-[#1F2229]' : 'text-blue-700 font-bold bg-blue-50'
              : isDark ? 'text-[#8E9299]' : 'text-slate-600'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onSelectTab('colaboradores')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium flex items-center gap-1 ${
            activeTab === 'colaboradores'
              ? isDark ? 'text-blue-400 font-bold bg-[#1F2229]' : 'text-blue-700 font-bold bg-blue-50'
              : isDark ? 'text-[#8E9299]' : 'text-slate-600'
          }`}
        >
          <span>Pessoas</span>
        </button>
        <button
          onClick={() => onSelectTab('insalubridade')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
            activeTab === 'insalubridade'
              ? isDark ? 'text-amber-400 font-bold bg-[#1F2229]' : 'text-amber-700 font-bold bg-amber-50'
              : isDark ? 'text-[#8E9299]' : 'text-slate-600'
          }`}
        >
          Insalubridade
        </button>
        <button
          onClick={() => onSelectTab('arquitetura')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
            activeTab === 'arquitetura'
              ? isDark ? 'text-cyan-400 font-bold bg-[#1F2229]' : 'text-cyan-700 font-bold bg-cyan-50'
              : isDark ? 'text-[#8E9299]' : 'text-slate-600'
          }`}
        >
          Manual
        </button>
      </div>
    </header>
  );
};
