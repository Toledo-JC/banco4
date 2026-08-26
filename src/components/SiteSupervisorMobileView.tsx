import React, { useState, useMemo } from 'react';
import { Employee, TimeRecord, Branch } from '../types';
import { getEmployeeTotalBalance, formatHoursDecimal, formatHoursToDays } from '../utils/calculations';
import { ComaraLogo } from './ComaraLogo';
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  ShieldCheck, 
  HardHat, 
  LogOut, 
  Moon, 
  Sun, 
  X, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertTriangle,
  ArrowUpDown,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

interface SiteSupervisorMobileViewProps {
  employees: Employee[];
  records: TimeRecord[];
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onLogout?: () => void;
  currentUser?: any;
}

type SortOption = 'DEVEDORES' | 'CREDORES' | 'ALFABETICA';

export const SiteSupervisorMobileView: React.FC<SiteSupervisorMobileViewProps> = ({
  employees,
  records,
  theme = 'dark',
  onToggleTheme,
  onLogout,
  currentUser,
}) => {
  const isDark = theme === 'dark';

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('DEVEDORES');
  const [selectedSede, setSelectedSede] = useState<string>('TODAS');
  const [expandedMatricula, setExpandedMatricula] = useState<string | null>(null);

  const toggleAccordion = (matricula: string) => {
    setExpandedMatricula(prev => prev === matricula ? null : matricula);
  };

  // Compute Balances
  const calculatedList = useMemo(() => {
    return employees.map((emp) => {
      const bal = getEmployeeTotalBalance(emp.matricula, employees, records);
      const saldoDias = Number((bal.saldoTotalHoras / 8).toFixed(1));
      const isPositivo = bal.saldoTotalHoras > 0.05;
      const isNegativo = bal.saldoTotalHoras < -0.05;
      const isZerado = !isPositivo && !isNegativo;

      const empRecords = records
        .filter((r) => r.matricula.trim().toUpperCase() === emp.matricula.trim().toUpperCase() ||
                       r.matricula.replace(/^0+/, '').toUpperCase() === emp.matricula.replace(/^0+/, ''))
        .sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro));

      return {
        ...emp,
        bal,
        saldoDias,
        empRecords,
        isPositivo,
        isNegativo,
        isZerado,
      };
    });
  }, [employees, records]);

  // Filter and Sort
  const displayedEmployees = useMemo(() => {
    let result = [...calculatedList];

    // Sede / Obra filter
    if (selectedSede !== 'TODAS') {
      result = result.filter(
        (e) => e.sede === selectedSede || e.sede_atual === selectedSede
      );
    }

    // Search filter (Nome ou Matrícula)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.matricula.toLowerCase().includes(q) ||
          e.nome.toLowerCase().includes(q) ||
          (e.funcao || e.cargo || '').toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'DEVEDORES') {
        // Maiores Devedores: mais negativo primeiro (-100h antes de -10h, depois 0h, depois +10h)
        return a.bal.saldoTotalHoras - b.bal.saldoTotalHoras;
      }
      if (sortBy === 'CREDORES') {
        // Maiores Credores: mais positivo primeiro (+100h antes de +10h)
        return b.bal.saldoTotalHoras - a.bal.saldoTotalHoras;
      }
      if (sortBy === 'ALFABETICA') {
        return a.nome.localeCompare(b.nome, 'pt-BR');
      }
      return 0;
    });

    return result;
  }, [calculatedList, searchTerm, sortBy, selectedSede]);

  // Overall Totals
  const stats = useMemo(() => {
    const total = calculatedList.length;
    const credores = calculatedList.filter((e) => e.isPositivo).length;
    const devedores = calculatedList.filter((e) => e.isNegativo).length;
    const zerados = calculatedList.filter((e) => e.isZerado).length;
    const saldoGeral = calculatedList.reduce((acc, curr) => acc + curr.bal.saldoTotalHoras, 0);
    const saldoGeralDias = Number((saldoGeral / 8).toFixed(1));

    return { total, credores, devedores, zerados, saldoGeral, saldoGeralDias };
  }, [calculatedList]);

  return (
    <div className={`min-h-screen pb-12 font-sans transition-colors duration-200 ${
      isDark ? 'bg-[#0B0D11] text-[#E0E2E5]' : 'bg-slate-100 text-slate-900'
    }`}>
      
      {/* ========================================================================= */}
      {/* 1. APP BAR SUPERIOR MOBILE-FIRST (CHEFE DE CANTEIRO)                      */}
      {/* ========================================================================= */}
      <header className={`sticky top-0 z-30 px-4 py-3 border-b backdrop-blur-md transition-all ${
        isDark 
          ? 'bg-[#15171C]/90 border-[#1F2229]' 
          : 'bg-white/95 border-slate-200 shadow-xs'
      }`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-2.5 min-w-0">
            <ComaraLogo size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className={`text-sm font-black tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser?.nome || 'Chefe de Canteiro'}
                </h1>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  Canteiro
                </span>
              </div>
              <p className={`text-[10px] truncate ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                COMARA • Horas & Conversão em Dias (8h/dia)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                title="Alternar tema"
                className={`p-2 rounded-xl border transition-colors ${
                  isDark 
                    ? 'bg-[#0D0F14] border-[#1F2229] text-[#8E9299] hover:text-white' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
              </button>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                title="Sair do sistema"
                className="p-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CONTEÚDO PRINCIPAL (LAYOUT OTIMIZADO PARA SMARTPHONE)                  */}
      {/* ========================================================================= */}
      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        
        {/* CARDS DE RESUMO OPERACIONAL COM HORAS E DIAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className={`p-3 rounded-xl border text-center ${
            isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <span className={`text-[10px] font-bold uppercase block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              Equipe
            </span>
            <span className={`text-lg font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {stats.total}
            </span>
            <span className={`text-[10px] block opacity-75 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              colaboradores
            </span>
          </div>

          <div className={`p-3 rounded-xl border text-center ${
            isDark ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xs'
          }`}>
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">Credores</span>
            </div>
            <span className="text-lg font-black font-mono">
              {stats.credores}
            </span>
            <span className="text-[10px] block opacity-75">
              com saldo positivo
            </span>
          </div>

          <div className={`p-3 rounded-xl border text-center ${
            isDark ? 'bg-red-950/20 border-red-900/40 text-red-400' : 'bg-red-50 border-red-200 text-red-700 shadow-xs'
          }`}>
            <div className="flex items-center justify-center gap-1">
              <TrendingDown className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">Devedores</span>
            </div>
            <span className="text-lg font-black font-mono">
              {stats.devedores}
            </span>
            <span className="text-[10px] block opacity-75">
              com saldo a pagar
            </span>
          </div>

          <div className={`p-3 rounded-xl border text-center ${
            stats.saldoGeral >= 0
              ? isDark ? 'bg-[#15171C] border-[#1F2229] text-emerald-400' : 'bg-white border-slate-200 text-emerald-600 shadow-xs'
              : isDark ? 'bg-[#15171C] border-[#1F2229] text-red-400' : 'bg-white border-slate-200 text-red-600 shadow-xs'
          }`}>
            <span className={`text-[10px] font-bold uppercase block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              Saldo Total
            </span>
            <span className="text-sm sm:text-base font-black font-mono block">
              {stats.saldoGeral > 0 ? `+${stats.saldoGeral.toFixed(1)}h` : `${stats.saldoGeral.toFixed(1)}h`}
            </span>
            <span className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded inline-block mt-0.5 ${
              stats.saldoGeral >= 0 
                ? isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800' 
                : isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-100 text-red-800'
            }`}>
              {stats.saldoGeralDias > 0 ? `+${stats.saldoGeralDias.toFixed(1)}` : stats.saldoGeralDias.toFixed(1)} dias
            </span>
          </div>
        </div>

        {/* CAMPO DE BUSCA RÁPIDA */}
        <div className="relative">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
            isDark ? 'text-[#8E9299]' : 'text-slate-400'
          }`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nome, Matrícula ou Cargo..."
            className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs font-semibold border focus:outline-hidden transition-all ${
              isDark 
                ? 'bg-[#15171C] border-[#1F2229] text-white placeholder-[#8E9299] focus:border-amber-400' 
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-500 shadow-xs'
            }`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* CONTROLES DE ORDENAÇÃO E FILTRO DE SEDE */}
        <div className="space-y-2">
          {/* Tabs de Ordenação Rápida */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSortBy('DEVEDORES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border flex items-center gap-1.5 transition-all cursor-pointer ${
                sortBy === 'DEVEDORES'
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-xs'
                  : isDark
                  ? 'bg-[#15171C] border-[#1F2229] text-[#8E9299] hover:text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Maiores Devedores</span>
            </button>

            <button
              onClick={() => setSortBy('CREDORES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border flex items-center gap-1.5 transition-all cursor-pointer ${
                sortBy === 'CREDORES'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-xs'
                  : isDark
                  ? 'bg-[#15171C] border-[#1F2229] text-[#8E9299] hover:text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Maiores Credores</span>
            </button>

            <button
              onClick={() => setSortBy('ALFABETICA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border flex items-center gap-1.5 transition-all cursor-pointer ${
                sortBy === 'ALFABETICA'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-xs'
                  : isDark
                  ? 'bg-[#15171C] border-[#1F2229] text-[#8E9299] hover:text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Ordem Alfabética</span>
            </button>
          </div>

          {/* Filtro por Sede / Obra */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className={`text-[10px] font-bold uppercase shrink-0 px-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              Sede:
            </span>
            {['TODAS', 'KO', 'BE', 'MN', 'SP', 'RJ'].map((sede) => (
              <button
                key={sede}
                onClick={() => setSelectedSede(sede)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border shrink-0 transition-all cursor-pointer ${
                  selectedSede === sede
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                    : isDark
                    ? 'bg-[#0D0F14] border-[#1F2229] text-[#8E9299] hover:text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {sede === 'TODAS' ? 'Todas as Obras' : sede}
              </button>
            ))}
          </div>
        </div>

        {/* CONTADOR DE RESULTADOS E INSTRUÇÃO */}
        <div className="flex items-center justify-between text-[11px] px-1">
          <span className={isDark ? 'text-[#8E9299]' : 'text-slate-500'}>
            Exibindo <strong>{displayedEmployees.length}</strong> de {calculatedList.length} colaboradores • <strong>Jornada: 8h = 1 dia</strong>
          </span>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-amber-500 hover:underline font-semibold cursor-pointer"
            >
              Limpar busca
            </button>
          )}
        </div>

        {/* LISTA DE CARDS ULTRALEVES DE COLABORADORES COM HORAS E DIAS */}
        <div className="space-y-2.5">
          {displayedEmployees.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center space-y-2 ${
              isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
            }`}>
              <Users className="w-8 h-8 mx-auto text-slate-500" />
              <p className={`text-xs font-semibold ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                Nenhum colaborador encontrado com os filtros selecionados.
              </p>
            </div>
          ) : (
            displayedEmployees.map((emp) => {
              const saldo = emp.bal.saldoTotalHoras;
              const saldoDias = emp.saldoDias;
              const isPos = emp.isPositivo;
              const isNeg = emp.isNegativo;
              const isExpanded = expandedMatricula === emp.matricula;

              return (
                <div
                  key={emp.id || emp.matricula}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isDark 
                      ? 'bg-[#15171C] border-[#1F2229] hover:border-[#2A2E38]' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {/* CABEÇALHO DO CARD CLICÁVEL */}
                  <div 
                    onClick={() => toggleAccordion(emp.matricula)}
                    className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    {/* DADOS DO COLABORADOR */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-xs font-mono font-bold px-1.5 py-0.2 rounded ${
                          isDark ? 'bg-[#0D0F14] text-slate-400' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {emp.matricula}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                          emp.sede_atual && emp.sede_atual !== emp.sede
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : isDark
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {emp.sede_atual ? `${emp.sede_atual} (Alocado)` : emp.sede || 'KO'}
                        </span>
                      </div>

                      <h3 className={`text-sm font-bold truncate leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {emp.nome}
                      </h3>

                      <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                        {emp.funcao || emp.cargo || 'Operacional'}
                      </p>

                      {/* BADGE RESUMO HORAS + DIAS NA LINHA DE IDENTIFICAÇÃO */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                          isPos
                            ? isDark ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : isNeg
                            ? isDark ? 'bg-red-950/30 border-red-800/40 text-red-400' : 'bg-red-50 border-red-200 text-red-800'
                            : isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                          🕒 {saldo > 0 ? `+${saldo.toFixed(1)}h` : `${saldo.toFixed(1)}h`}
                        </span>
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                          isPos
                            ? isDark ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300' : 'bg-emerald-100 border-emerald-300 text-emerald-900'
                            : isNeg
                            ? isDark ? 'bg-red-950/40 border-red-700/50 text-red-300' : 'bg-red-100 border-red-300 text-red-900'
                            : isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-200 border-slate-300 text-slate-700'
                        }`}>
                          📅 {saldoDias > 0 ? `+${saldoDias.toFixed(1)}` : saldoDias.toFixed(1)} dias
                        </span>
                      </div>
                    </div>

                    {/* SALDO DE HORAS E DIAS EM DESTAQUE NA LATERAL */}
                    <div className="text-right shrink-0 flex flex-col items-end">
                      <div className={`px-3 py-1.5 rounded-xl border text-center font-mono transition-all ${
                        isPos
                          ? isDark 
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60 shadow-xs' 
                            : 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                          : isNeg
                          ? isDark 
                            ? 'bg-red-950/60 text-red-400 border-red-700/60 shadow-xs' 
                            : 'bg-red-600 text-white border-red-700 shadow-sm'
                          : isDark 
                            ? 'bg-[#0D0F14] text-slate-400 border-[#1F2229]' 
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {/* Horas em Fonte Grande */}
                        <div className="text-base sm:text-lg font-black tracking-tight leading-tight">
                          {saldo > 0 ? `+${saldo.toFixed(1)}h` : `${saldo.toFixed(1)}h`}
                        </div>
                        
                        {/* Conversão em Dias em Destaque */}
                        <div className={`text-[11px] font-extrabold font-sans mt-0.5 pt-0.5 border-t ${
                          isPos
                            ? isDark ? 'border-emerald-800 text-emerald-300' : 'border-emerald-400/80 text-emerald-50'
                            : isNeg
                            ? isDark ? 'border-red-800 text-red-300' : 'border-red-400/80 text-red-50'
                            : isDark ? 'border-slate-800 text-slate-300' : 'border-slate-300 text-slate-600'
                        }`}>
                          {saldoDias > 0 ? `+${saldoDias.toFixed(1)}` : saldoDias.toFixed(1)} dias
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${
                          isPos 
                            ? 'text-emerald-500' 
                            : isNeg 
                            ? 'text-red-500' 
                            : isDark ? 'text-[#8E9299]' : 'text-slate-400'
                        }`}>
                          {isPos ? '● Credor' : isNeg ? '● Devedor' : '● Zerado'}
                        </span>
                        <div className={`p-0.5 transition-transform ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* SANFONA: DETALHAMENTO DO SALDO EM HORAS E DIAS */}
                  {isExpanded && (
                    <div className={`p-3.5 border-t space-y-2.5 animate-in fade-in duration-150 ${
                      isDark ? 'border-[#1F2229] bg-[#0E1015]' : 'border-slate-100 bg-slate-50/90'
                    }`}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                          <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Créditos Extras</span>
                          <span className="font-bold font-mono text-emerald-500">+{emp.bal.totalCreditos.toFixed(1)}h</span>
                          <span className="text-[10px] block opacity-75 font-mono">({(emp.bal.totalCreditos / 8).toFixed(1)} dias)</span>
                        </div>
                        <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                          <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Débitos / Faltas</span>
                          <span className="font-bold font-mono text-red-500">-{emp.bal.totalDebitos.toFixed(1)}h</span>
                          <span className="text-[10px] block opacity-75 font-mono">({(emp.bal.totalDebitos / 8).toFixed(1)} dias)</span>
                        </div>
                        <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                          <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Saldo Inicial</span>
                          <span className="font-bold font-mono">{emp.bal.saldoInicial > 0 ? `+${emp.bal.saldoInicial.toFixed(1)}h` : `${emp.bal.saldoInicial.toFixed(1)}h`}</span>
                          <span className="text-[10px] block opacity-75 font-mono">({(emp.bal.saldoInicial / 8).toFixed(1)} dias)</span>
                        </div>
                        <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                          <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Regra SPTF</span>
                          <span className="font-bold">8 horas / dia</span>
                          <span className="text-[10px] block opacity-75">{emp.empRecords.length} lançamentos</span>
                        </div>
                      </div>

                      {/* Histórico rápido de registros */}
                      {emp.empRecords.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className={`text-[11px] font-bold block ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                            Últimos Registros Diários:
                          </span>
                          <div className="space-y-1 max-h-36 overflow-y-auto text-xs">
                            {emp.empRecords.slice(0, 4).map((rec) => (
                              <div
                                key={rec.id}
                                className={`p-1.5 rounded-lg border flex items-center justify-between gap-2 ${
                                  isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px]">{rec.dataRegistro}</span>
                                  <span className="text-[10px] px-1 py-0.2 rounded font-bold bg-blue-500/10 text-blue-400">
                                    {rec.tipoOcorrencia}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 font-mono font-bold text-[11px]">
                                  <span className={rec.saldoCalculado > 0 ? 'text-emerald-500' : rec.saldoCalculado < 0 ? 'text-red-500' : 'text-gray-400'}>
                                    {rec.saldoCalculado > 0 ? `+${rec.saldoCalculado.toFixed(1)}h` : `${rec.saldoCalculado.toFixed(1)}h`}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-normal">
                                    ({(rec.saldoCalculado / 8).toFixed(1)}d)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      </main>

    </div>
  );
};

