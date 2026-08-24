import React, { useState, useMemo } from 'react';
import { Employee, TimeRecord, Attachment } from '../types';
import { getEmployeeTotalBalance, formatHoursDecimal, formatHoursToDays } from '../utils/calculations';
import { 
  Users, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Building2, 
  ShieldCheck, 
  Eye, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Paperclip,
  ArrowRight,
  Sparkles,
  Filter
} from 'lucide-react';

interface FieldManagerViewProps {
  employees: Employee[];
  records: TimeRecord[];
  theme?: 'dark' | 'light';
  onViewAttachment?: (attachment: Attachment, empName?: string, recordDate?: string) => void;
  onViewStatement?: (matricula: string) => void;
}

export const FieldManagerView: React.FC<FieldManagerViewProps> = ({
  employees,
  records,
  theme = 'dark',
  onViewAttachment,
  onViewStatement,
}) => {
  const isDark = theme === 'dark';

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'TODOS' | 'POSITIVOS' | 'NEGATIVOS' | 'ZERADOS'>('TODOS');
  const [sedeFilter, setSedeFilter] = useState<string>('TODAS');
  
  // Accordion State: Track expanded employee matricula
  const [expandedMatricula, setExpandedMatricula] = useState<string | null>(null);

  const toggleAccordion = (matricula: string) => {
    setExpandedMatricula((prev) => (prev === matricula ? null : matricula));
  };

  // Calculated Employees with Balance
  const employeesWithData = useMemo(() => {
    return employees.map((emp) => {
      const bal = getEmployeeTotalBalance(emp.matricula, employees, records);
      const empRecords = records
        .filter((r) => r.matricula.trim().toUpperCase() === emp.matricula.trim().toUpperCase() ||
                       r.matricula.replace(/^0+/, '').toUpperCase() === emp.matricula.replace(/^0+/, ''))
        .sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro));

      const isPositivo = bal.saldoTotalHoras > 0.05;
      const isNegativo = bal.saldoTotalHoras < -0.05;
      const isZerado = !isPositivo && !isNegativo;

      return {
        ...emp,
        bal,
        empRecords,
        isPositivo,
        isNegativo,
        isZerado,
      };
    });
  }, [employees, records]);

  // Filtered List
  const filteredEmployees = useMemo(() => {
    return employeesWithData.filter((emp) => {
      // Sede filter
      if (sedeFilter !== 'TODAS' && emp.sede !== sedeFilter && emp.sede_atual !== sedeFilter) {
        return false;
      }

      // Balance filter
      if (balanceFilter === 'POSITIVOS' && !emp.isPositivo) return false;
      if (balanceFilter === 'NEGATIVOS' && !emp.isNegativo) return false;
      if (balanceFilter === 'ZERADOS' && !emp.isZerado) return false;

      // Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matMatch = emp.matricula.toLowerCase().includes(q);
        const nameMatch = emp.nome.toLowerCase().includes(q);
        const funcMatch = (emp.funcao || emp.cargo || '').toLowerCase().includes(q);
        if (!matMatch && !nameMatch && !funcMatch) return false;
      }

      return true;
    });
  }, [employeesWithData, searchTerm, balanceFilter, sedeFilter]);

  // Overall Quick Stats
  const stats = useMemo(() => {
    const total = employeesWithData.length;
    const positivos = employeesWithData.filter((e) => e.isPositivo).length;
    const negativos = employeesWithData.filter((e) => e.isNegativo).length;
    const zerados = employeesWithData.filter((e) => e.isZerado).length;
    const saldoTotalGeral = employeesWithData.reduce((acc, curr) => acc + curr.bal.saldoTotalHoras, 0);

    return { total, positivos, negativos, zerados, saldoTotalGeral };
  }, [employeesWithData]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* ========================================================= */}
      {/* 1. CABEÇALHO DO PERFIL GERENTE DE CAMPO                   */}
      {/* ========================================================= */}
      <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Painel do Gerente de Campo
              </h1>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                Somente Leitura
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              Visualização rápida de saldos da equipe em tempo real para tomada de decisões operacionais no canteiro.
            </p>
          </div>

          <div className={`px-3.5 py-2 rounded-xl border flex items-center gap-3 self-start sm:self-auto ${
            isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="text-right">
              <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                Saldo Geral Equipe
              </span>
              <span className={`text-base font-extrabold font-mono ${
                stats.saldoTotalGeral >= 0 ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {stats.saldoTotalGeral > 0 ? `+${stats.saldoTotalGeral.toFixed(1)}` : stats.saldoTotalGeral.toFixed(1)}h
              </span>
            </div>
          </div>
        </div>

        {/* Mini Cards de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-inherit">
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`text-[10px] font-bold uppercase block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Total Equipe</span>
            <span className="text-lg font-extrabold font-mono">{stats.total} colaboradores</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            <span className="text-[10px] font-bold uppercase block opacity-80">Saldo Positivo (Crédito)</span>
            <span className="text-lg font-extrabold font-mono">{stats.positivos}</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-red-950/20 border-red-800/40 text-red-400' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <span className="text-[10px] font-bold uppercase block opacity-80">Saldo Negativo (Débito)</span>
            <span className="text-lg font-extrabold font-mono">{stats.negativos}</span>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0D0F14] border-[#1F2229] text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
            <span className="text-[10px] font-bold uppercase block opacity-80">Saldo Zerado</span>
            <span className="text-lg font-extrabold font-mono">{stats.zerados}</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. BUSCA INSTANTÂNEA & FILTROS POR SITUAÇÃO               */}
      {/* ========================================================= */}
      <div className={`p-4 rounded-2xl border space-y-3 ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        {/* Campo de Busca */}
        <div className="relative w-full">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisa rápida por nome, matrícula ou função..."
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm font-sans transition-all outline-none border ${
              isDark 
                ? 'bg-[#0D0F14] border-[#1F2229] text-white focus:border-blue-500' 
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
            }`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtros de Situação & Sede */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Botões de Filtro Rápido */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setBalanceFilter('TODOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                balanceFilter === 'TODOS'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : isDark
                  ? 'bg-[#0D0F14] text-[#8E9299] border-[#1F2229] hover:text-white'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              Todos ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setBalanceFilter('POSITIVOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                balanceFilter === 'POSITIVOS'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : isDark
                  ? 'bg-[#0D0F14] text-emerald-400 border-[#1F2229] hover:bg-emerald-950/40'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              🟢 Apenas Positivos ({stats.positivos})
            </button>

            <button
              type="button"
              onClick={() => setBalanceFilter('NEGATIVOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                balanceFilter === 'NEGATIVOS'
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : isDark
                  ? 'bg-[#0D0F14] text-red-400 border-[#1F2229] hover:bg-red-950/40'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
            >
              🔴 Apenas Negativos ({stats.negativos})
            </button>
          </div>

          {/* Filtro por Sede */}
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Sede:</span>
            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="TODAS">Todas</option>
              <option value="KO">KO (Coari)</option>
              <option value="BE">BE (Belém)</option>
              <option value="MN">MN (Manaus)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. LISTA DE CARDS COMPACTOS COM FOCO ABSOLUTO & SANFONA  */}
      {/* ========================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 text-xs">
          <span className={`font-bold ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            Exibindo {filteredEmployees.length} colaboradores
          </span>
          <span className="text-[11px] text-blue-500 font-medium">
            Toque no card para ver o histórico detalhado
          </span>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className={`p-8 rounded-2xl border text-center ${
            isDark ? 'bg-[#15171C] border-[#1F2229] text-gray-400' : 'bg-white border-slate-200 text-slate-500'
          }`}>
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-bold text-sm">Nenhum colaborador encontrado com os filtros atuais.</p>
            <p className="text-xs mt-1 opacity-80">Tente ajustar o termo de pesquisa ou a situação de saldo.</p>
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const isExpanded = expandedMatricula === emp.matricula;
            const saldoHoras = emp.bal.saldoTotalHoras;
            const saldoDias = (saldoHoras / 8).toFixed(1);

            return (
              <div
                key={emp.id || emp.matricula}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  emp.isPositivo
                    ? isDark 
                      ? 'bg-[#15171C] border-emerald-800/40 hover:border-emerald-500/60' 
                      : 'bg-white border-emerald-300 hover:border-emerald-500 shadow-xs'
                    : emp.isNegativo
                    ? isDark 
                      ? 'bg-[#15171C] border-red-800/40 hover:border-red-500/60' 
                      : 'bg-white border-red-300 hover:border-red-500 shadow-xs'
                    : isDark 
                      ? 'bg-[#15171C] border-[#1F2229] hover:border-blue-500/40' 
                      : 'bg-white border-slate-200 hover:border-blue-400 shadow-xs'
                }`}
              >
                {/* ------------------------------------------------- */}
                {/* HEADER DO CARD: FOCO ABSOLUTO (NOME + SALDO TOTAL) */}
                {/* ------------------------------------------------- */}
                <div
                  onClick={() => toggleAccordion(emp.matricula)}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  {/* Lado Esquerdo: Identificação Rápida */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar */}
                    {emp.avatarUrl || emp.url_foto_perfil ? (
                      <img
                        src={emp.avatarUrl || emp.url_foto_perfil}
                        alt={emp.nome}
                        className="w-10 h-10 rounded-xl object-cover border shrink-0 border-inherit"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                        emp.isPositivo
                          ? isDark ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : emp.isNegativo
                          ? isDark ? 'bg-red-950/60 text-red-400 border-red-800/50' : 'bg-red-100 text-red-800 border-red-200'
                          : isDark ? 'bg-blue-950/60 text-blue-400 border-blue-800/50' : 'bg-blue-100 text-blue-800 border-blue-200'
                      }`}>
                        {emp.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                      </div>
                    )}

                    {/* Nome & Cargo */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm sm:text-base truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {emp.nome}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase border ${
                          isDark ? 'bg-[#0D0F14] text-gray-400 border-[#1F2229]' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {emp.matricula}
                        </span>
                      </div>
                      <div className={`text-xs truncate flex items-center gap-2 mt-0.5 ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                        <span>{emp.funcao || emp.cargo || 'Operador'}</span>
                        <span>•</span>
                        <span>Sede {emp.sede_atual || emp.sede}</span>
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: BADGE COLORIDO GIGANTE COM SALDO */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className={`px-3.5 py-2 rounded-xl text-center font-mono font-extrabold border transition-all ${
                      emp.isPositivo
                        ? isDark 
                          ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/50 shadow-xs' 
                          : 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                        : emp.isNegativo
                        ? isDark 
                          ? 'bg-red-950/70 text-red-400 border-red-500/50 shadow-xs' 
                          : 'bg-red-600 text-white border-red-700 shadow-md shadow-red-500/20'
                        : isDark 
                          ? 'bg-blue-950/50 text-blue-300 border-blue-800/40' 
                          : 'bg-slate-100 text-slate-800 border-slate-300'
                    }`}>
                      <div className="text-base sm:text-lg tracking-tight leading-none">
                        {saldoHoras > 0 ? `+${saldoHoras.toFixed(1)}` : saldoHoras.toFixed(1)}h
                      </div>
                      <div className="text-[9px] font-sans font-medium uppercase mt-0.5 opacity-90">
                        {emp.isPositivo ? 'Crédito' : emp.isNegativo ? 'Débito' : 'Zerado'}
                      </div>
                    </div>

                    {/* Botão Indicador Sanfona */}
                    <div className={`p-1.5 rounded-lg transition-transform ${
                      isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                    }`}>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* ------------------------------------------------- */}
                {/* ACCORDION / SANFONA: HISTÓRICO & DETALHES         */}
                {/* ------------------------------------------------- */}
                {isExpanded && (
                  <div className={`p-4 border-t space-y-3 animate-in fade-in duration-150 ${
                    isDark ? 'border-[#1F2229] bg-[#0E1015]' : 'border-slate-100 bg-slate-50/80'
                  }`}>
                    {/* Mini Resumo */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                        <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Créditos Extras</span>
                        <span className="font-bold text-emerald-500">+{emp.bal.totalCreditos.toFixed(1)}h</span>
                      </div>
                      <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                        <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Débitos / Faltas</span>
                        <span className="font-bold text-red-500">-{emp.bal.totalDebitos.toFixed(1)}h</span>
                      </div>
                      <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                        <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Saldo em Dias</span>
                        <span className="font-bold">{saldoDias} dias (8h)</span>
                      </div>
                      <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                        <span className={`text-[10px] block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Total Lançamentos</span>
                        <span className="font-bold">{emp.empRecords.length} registros</span>
                      </div>
                    </div>

                    {/* Lista dos Lançamentos Recentes */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={isDark ? 'text-[#8E9299]' : 'text-slate-600'}>Últimos Lançamentos Diários:</span>
                        {onViewStatement && (
                          <button
                            type="button"
                            onClick={() => onViewStatement(emp.matricula)}
                            className="text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Extrato Completo</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {emp.empRecords.length === 0 ? (
                        <p className={`text-xs py-2 text-center italic ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                          Nenhum lançamento registrado para este colaborador.
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1 text-xs">
                          {emp.empRecords.slice(0, 5).map((rec) => (
                            <div
                              key={rec.id}
                              className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                                isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-[11px]">{rec.dataRegistro}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  rec.tipoOcorrencia === 'TRABALHO'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : rec.tipoOcorrencia === 'FALTA_INJUSTIFICADA'
                                    ? 'bg-red-500/10 text-red-400'
                                    : rec.tipoOcorrencia === 'ATESTADO_MEDICO'
                                    ? 'bg-purple-500/10 text-purple-400'
                                    : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {rec.tipoOcorrencia}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {rec.comprovante && onViewAttachment && (
                                  <button
                                    type="button"
                                    onClick={() => onViewAttachment(rec.comprovante!, emp.nome, rec.dataRegistro)}
                                    className="text-blue-400 hover:text-blue-300 p-0.5 cursor-pointer"
                                    title="Ver Atestado/Comprovante"
                                  >
                                    <Paperclip className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <span className={`font-mono font-bold ${
                                  rec.saldoCalculado > 0 ? 'text-emerald-500' : rec.saldoCalculado < 0 ? 'text-red-500' : 'text-gray-400'
                                }`}>
                                  {rec.saldoCalculado > 0 ? `+${rec.saldoCalculado.toFixed(1)}` : rec.saldoCalculado.toFixed(1)}h
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
