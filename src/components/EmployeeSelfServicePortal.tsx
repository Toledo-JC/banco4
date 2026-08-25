import React, { useState, useMemo } from 'react';
import { Employee, TimeRecord, Branch, Attachment, PaystubRecord } from '../types';
import { ContrachequeMirrorView } from './ContrachequeMirrorView';
import { 
  UserCheck, 
  Clock, 
  Calendar, 
  Building2, 
  FileText, 
  Download, 
  Paperclip, 
  AlertCircle, 
  CheckCircle2, 
  LogOut, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Search,
  Layers,
  Link as LinkIcon,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Receipt
} from 'lucide-react';
import { calculateFifoLiquidations, getRecordPrescriptionInfo } from '../utils/calculations';

interface EmployeeSelfServicePortalProps {
  employees: Employee[];
  records: TimeRecord[];
  paystubs?: PaystubRecord[];
  onViewAttachment?: (attachment: Attachment, empName?: string, recordDate?: string) => void;
  theme?: 'dark' | 'light';
}

type SelfServiceFilterType = 'TODOS' | 'PENDENTES' | 'COMPENSACOES';
type PortalSubTab = 'BANCO_HORAS' | 'CONTRACHEQUE';

export const EmployeeSelfServicePortal: React.FC<EmployeeSelfServicePortalProps> = ({
  employees,
  records,
  paystubs = [],
  onViewAttachment,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [matriculaInput, setMatriculaInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticatedEmployee, setAuthenticatedEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<PortalSubTab>('BANCO_HORAS');
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('');
  const [fifoFilter, setFifoFilter] = useState<SelfServiceFilterType>('TODOS');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Consulta por Matrícula
  const handleConsultar = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const clean = matriculaInput.trim().toUpperCase();
    if (!clean) {
      setAuthError('Por favor, digite sua matrícula funcional (ex: MAT-1010).');
      return;
    }

    const found = employees.find(
      (emp) => emp.matricula.toUpperCase() === clean || 
               emp.matricula.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === clean.replace(/[^A-Za-z0-9]/g, '')
    );

    if (!found) {
      setAuthError(`Matrícula "${clean}" não foi localizada no cadastro.`);
      return;
    }

    setAuthenticatedEmployee(found);
  };

  const handleLogout = () => {
    setAuthenticatedEmployee(null);
    setMatriculaInput('');
    setAuthError(null);
    setExpandedRecordId(null);
  };

  // Filtrar estritamente os lançamentos da matrícula
  const employeeAllRecords = useMemo(() => {
    if (!authenticatedEmployee) return [];
    return records.filter((r) => r.matricula.toUpperCase() === authenticatedEmployee.matricula.toUpperCase());
  }, [authenticatedEmployee, records]);

  // Motor FIFO de Liquidação
  const fifoResult = useMemo(() => {
    return calculateFifoLiquidations(employeeAllRecords, authenticatedEmployee?.saldoInicialHoras || 0);
  }, [employeeAllRecords, authenticatedEmployee]);

  // Lista ordenada por data decrescente
  const allProcessedRecords = useMemo(() => {
    return [...fifoResult.processedRecords].sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro));
  }, [fifoResult]);

  // Filtro de exibição
  const displayedRecords = useMemo(() => {
    if (fifoFilter === 'PENDENTES') {
      return allProcessedRecords.filter(r => 
        (r.status_compensacao === 'ABERTO' || r.status_compensacao === 'PARCIALMENTE_COMPENSADO') &&
        (r.saldo_remanescente && r.saldo_remanescente > 0.001)
      );
    }
    if (fifoFilter === 'COMPENSACOES') {
      return allProcessedRecords.filter(r => 
        (r.liquidacoes && r.liquidacoes.length > 0) || 
        r.tipoOcorrencia === 'COMPENSACAO' || 
        r.status_compensacao === 'TOTALMENTE_COMPENSADO'
      );
    }
    return allProcessedRecords;
  }, [allProcessedRecords, fifoFilter]);

  // Cálculos do Saldo
  const saldoInicial = authenticatedEmployee?.saldoInicialHoras || 0;
  const saldoMovimentacoes = employeeAllRecords.reduce((acc, r) => acc + r.saldoCalculado, 0);
  const saldoTotalHoras = Number((saldoInicial + saldoMovimentacoes).toFixed(2));
  const saldoTotalDias = (saldoTotalHoras / 8).toFixed(2);

  const isCredor = saldoTotalHoras > 0.05;
  const isDevedor = saldoTotalHoras < -0.05;

  const pendingCount = useMemo(() => {
    return allProcessedRecords.filter(r => 
      (r.status_compensacao === 'ABERTO' || r.status_compensacao === 'PARCIALMENTE_COMPENSADO') &&
      (r.saldo_remanescente && r.saldo_remanescente > 0.001)
    ).length;
  }, [allProcessedRecords]);

  const compensatedCount = useMemo(() => {
    return allProcessedRecords.filter(r => 
      r.status_compensacao === 'TOTALMENTE_COMPENSADO' && r.saldoCalculado !== 0
    ).length;
  }, [allProcessedRecords]);

  // Contracheques exclusivos da matrícula do servidor (LGPD)
  const myPaystubs = useMemo(() => {
    if (!authenticatedEmployee) return [];
    const cleanMatricula = authenticatedEmployee.matricula.trim().toUpperCase();
    return paystubs
      .filter((p) => p.matricula.trim().toUpperCase() === cleanMatricula)
      .sort((a, b) => (b.mesAno || '').localeCompare(a.mesAno || ''));
  }, [authenticatedEmployee, paystubs]);

  const currentPaystub = useMemo(() => {
    if (myPaystubs.length === 0) return null;
    if (selectedCompetencia) {
      const found = myPaystubs.find(p => p.id === selectedCompetencia);
      if (found) return found;
    }
    return myPaystubs[0];
  }, [myPaystubs, selectedCompetencia]);

  const toggleExpand = (id: string) => {
    setExpandedRecordId(prev => prev === id ? null : id);
  };

  // -------------------------------------------------------------
  // TELA DE CONSULTA INICIAL (AUTOATENDIMENTO)
  // -------------------------------------------------------------
  if (!authenticatedEmployee) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-8 font-mono">
        <div className="w-full max-w-md">
          {/* Header Card */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-3 shadow-lg shadow-blue-500/10">
              <UserCheck className="w-8 h-8" />
            </div>
            <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Consulta do Colaborador
            </h1>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#8E9299]' : 'text-gray-500'}`}>
              Autoatendimento • Extrato e Rastreabilidade de Compensação SPTF (FIFO)
            </p>
          </div>

          {/* Form Box */}
          <div className={`border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden ${
            isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200'
          }`}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400"></div>

            {authError && (
              <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleConsultar} className="space-y-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8E9299]' : 'text-gray-700'}`}>
                  DIGITE SUA MATRÍCULA FUNCIONAL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: MAT-1010"
                    value={matriculaInput}
                    onChange={(e) => setMatriculaInput(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-mono outline-none border transition-colors ${
                      isDark
                        ? 'bg-[#0D0F14] border-[#1F2229] focus:border-blue-500 text-white placeholder:text-gray-600'
                        : 'bg-gray-50 border-gray-300 focus:border-blue-500 text-gray-900 placeholder:text-gray-400'
                    }`}
                  />
                  <Search className={`absolute right-3.5 top-3.5 w-4 h-4 ${isDark ? 'text-[#8E9299]' : 'text-gray-400'}`} />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 active:scale-98"
              >
                <Clock className="w-4 h-4" />
                <span>Consultar Meu Extrato</span>
              </button>
            </form>

            {/* Sugestões de teste rápido */}
            <div className={`mt-6 pt-4 border-t text-center ${isDark ? 'border-[#1F2229]' : 'border-gray-100'}`}>
              <p className={`text-[11px] mb-2 ${isDark ? 'text-[#8E9299]' : 'text-gray-500'}`}>
                Matrículas para teste rápido no ambiente:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {employees.slice(0, 4).map((emp) => (
                  <button
                    key={emp.matricula}
                    type="button"
                    onClick={() => {
                      setMatriculaInput(emp.matricula);
                    }}
                    className={`px-2 py-1 border rounded-md text-[10px] font-mono transition-colors ${
                      isDark
                        ? 'bg-[#0D0F14] hover:bg-[#1F2229] border-[#1F2229] text-blue-400'
                        : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-blue-600'
                    }`}
                  >
                    {emp.matricula} ({emp.nome.split(' ')[0]})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-[11px] text-[#8E9299] flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Acesso individual isolado • Bloqueio de dados de terceiros</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // TELA DO EXTRATO DO COLABORADOR (AUTOATENDIMENTO)
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 pb-12 font-mono text-xs">
      {/* Top Bar */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Consulta Individual Ativa: <strong>{authenticatedEmployee.matricula}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className={`px-3.5 py-2 border rounded-xl font-semibold flex items-center gap-2 transition-colors ${
              isDark ? 'bg-[#0D0F14] hover:bg-[#1F2229] border-[#1F2229] text-[#E0E2E5]' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Imprimir / PDF</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 bg-red-950/30 hover:bg-red-950/60 text-red-300 border border-red-900/50 rounded-xl font-semibold flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span>Sair da Consulta</span>
          </button>
        </div>
      </div>

      {/* Header do Perfil */}
      <div className={`border rounded-2xl p-6 relative overflow-hidden shadow-xl ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Foto */}
            <div className="relative shrink-0">
              {authenticatedEmployee.url_foto_perfil || authenticatedEmployee.avatarUrl ? (
                <img
                  src={authenticatedEmployee.url_foto_perfil || authenticatedEmployee.avatarUrl}
                  alt={authenticatedEmployee.nome}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-blue-500/50 shadow-md shadow-blue-500/10"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-500/10 border-2 border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-2xl">
                  {authenticatedEmployee.nome[0]}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-blue-600 rounded text-[9px] font-bold text-white uppercase">
                {authenticatedEmployee.sede_atual || authenticatedEmployee.sede}
              </div>
            </div>

            {/* Informações Pessoais */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className={`text-base sm:text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {authenticatedEmployee.nome}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  {authenticatedEmployee.status}
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-gray-600'}`}>
                {authenticatedEmployee.funcao || authenticatedEmployee.cargo} • Matrícula: <strong className="text-blue-400">{authenticatedEmployee.matricula}</strong>
              </p>
              <div className={`flex flex-wrap items-center gap-3 pt-1 text-[11px] ${isDark ? 'text-[#8E9299]' : 'text-gray-500'}`}>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  Sede Origem: {authenticatedEmployee.sede}
                  {authenticatedEmployee.sede_atual && authenticatedEmployee.sede_atual !== authenticatedEmployee.sede && (
                    <span className="text-amber-400 font-bold ml-1">
                      (Alocado em: {authenticatedEmployee.sede_atual})
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Admissão: {authenticatedEmployee.dataAdmissao}
                </span>
              </div>
            </div>
          </div>

          {/* Saldo Destaque (Header Right) */}
          <div className={`border rounded-xl p-4 sm:p-5 flex flex-col items-center sm:items-end justify-center min-w-[220px] ${
            isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-gray-50 border-gray-200'
          }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-[#8E9299]' : 'text-gray-500'}`}>
              STATUS DO BANCO DE HORAS
            </span>
            <div className="flex items-center gap-2 mt-1">
              {isCredor ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  🟢 CREDOR (+{saldoTotalHoras.toFixed(2)}h)
                </span>
              ) : isDevedor ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 font-bold">
                  🔴 DEVEDOR ({saldoTotalHoras.toFixed(2)}h)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/30 font-bold">
                  ⚪ ZERADO (0.00h)
                </span>
              )}
            </div>
            <p className={`text-[11px] mt-1.5 ${isDark ? 'text-[#8E9299]' : 'text-gray-500'}`}>
              Equivalência: <strong className={isDark ? 'text-white' : 'text-gray-900'}>{saldoTotalDias} dias</strong> (jornada 8h)
            </p>
          </div>
        </div>
      </div>

      {/* Subtab Switcher (Banco de Horas vs Contracheque Digital) */}
      <div className="flex items-center gap-2 border-b border-slate-700/60 pb-3 print:hidden">
        <button
          onClick={() => setActiveTab('BANCO_HORAS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'BANCO_HORAS'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : isDark ? 'bg-slate-900 hover:bg-slate-800 text-gray-300' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Banco de Horas & FIFO</span>
        </button>

        <button
          onClick={() => setActiveTab('CONTRACHEQUE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'CONTRACHEQUE'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20'
              : isDark ? 'bg-slate-900 hover:bg-slate-800 text-gray-300' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span>Meu Contracheque Digital (Oficial)</span>
          {myPaystubs.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
              {myPaystubs.length}
            </span>
          )}
        </button>
      </div>

      {/* SEÇÃO: CONTRACHEQUE DIGITAL */}
      {activeTab === 'CONTRACHEQUE' && (
        <div className="space-y-6">
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
            isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-500" />
              <div>
                <h4 className="font-bold text-sm">Demonstrativo de Pagamento Oficial</h4>
                <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Documentos liberados para a matrícula {authenticatedEmployee.matricula}
                </p>
              </div>
            </div>

            {myPaystubs.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Competência:</span>
                <select
                  value={currentPaystub?.id || ''}
                  onChange={(e) => {
                    const found = myPaystubs.find(p => p.id === e.target.value);
                    if (found) setSelectedCompetencia(found.id);
                  }}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold font-mono border ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {myPaystubs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.periodo || p.mesAno} — Líquido: R$ {(p.valorLiquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs text-amber-400 font-semibold">
                Nenhum contracheque localizado no momento.
              </span>
            )}
          </div>

          {currentPaystub ? (
            <ContrachequeMirrorView
              paystub={currentPaystub}
              theme={theme}
            />
          ) : (
            <div className={`p-12 rounded-2xl border text-center ${
              isDark ? 'bg-[#15171C] border-[#1F2229] text-gray-400' : 'bg-white border-slate-200 text-slate-500'
            }`}>
              <Receipt className="w-12 h-12 text-slate-500 mx-auto mb-3 stroke-1" />
              <h5 className="font-bold text-base text-gray-200 mb-1">Nenhum Contracheque Disponível</h5>
              <p className="text-xs max-w-md mx-auto">
                O arquivo de folha de pagamento ainda não foi importado pelo setor de RH da COMARA para sua matrícula ({authenticatedEmployee.matricula}).
              </p>
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO: BANCO DE HORAS & FIFO */}
      {activeTab === 'BANCO_HORAS' && (
        <div className="space-y-6">

      {/* KPI Cards com Rastreabilidade FIFO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between text-[#8E9299] mb-1">
            <span>SALDO ACUMULADO GERAL</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className={`text-2xl font-bold ${saldoTotalHoras >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {saldoTotalHoras >= 0 ? `+${saldoTotalHoras.toFixed(2)}h` : `${saldoTotalHoras.toFixed(2)}h`}
          </div>
          <p className="text-[10px] text-[#8E9299] mt-1">Saldo inicial: {saldoInicial}h</p>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between text-[#8E9299] mb-1">
            <span>HORAS LIQUIDADAS / COMPENSADAS</span>
            <CheckCircle className="w-4 h-4 text-blue-400" />
          </div>
          <div className={`text-2xl font-bold text-blue-400`}>
            {fifoResult.totalHorasLiquidadas.toFixed(1)}h
          </div>
          <p className="text-[10px] text-blue-400/80 mt-1">{compensatedCount} lançamentos quitados</p>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between text-[#8E9299] mb-1">
            <span>SALDO PENDENTE DE BAIXA</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-2xl font-bold text-amber-400`}>
            +{fifoResult.totalHorasPendentes.toFixed(1)}h
          </div>
          <p className="text-[10px] text-amber-400/80 mt-1">{pendingCount} dias a compensar</p>
        </div>
      </div>

      {/* Extrato Detalhado com Filtros e Rastreabilidade */}
      <div className={`border rounded-2xl p-6 shadow-xl space-y-4 ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1F2229]/60">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Extrato Detalhado com Rastreabilidade FIFO ({displayedRecords.length} lançamentos)
            </h3>
          </div>

          {/* Filtro de Visão */}
          <div className="flex items-center bg-[#0A0B0D] p-1 rounded-xl border border-[#1F2229] text-[11px]">
            <button
              onClick={() => setFifoFilter('TODOS')}
              className={`px-2.5 py-1 rounded-lg transition-all font-semibold ${
                fifoFilter === 'TODOS'
                  ? 'bg-blue-600 text-white'
                  : isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({allProcessedRecords.length})
            </button>
            <button
              onClick={() => setFifoFilter('PENDENTES')}
              className={`px-2.5 py-1 rounded-lg transition-all font-semibold flex items-center gap-1 ${
                fifoFilter === 'PENDENTES'
                  ? 'bg-amber-600 text-white'
                  : isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Apenas Saldos Pendentes</span>
              <span className="px-1 py-0.2 rounded bg-black/40 text-amber-200 text-[9px]">{pendingCount}</span>
            </button>
            <button
              onClick={() => setFifoFilter('COMPENSACOES')}
              className={`px-2.5 py-1 rounded-lg transition-all font-semibold flex items-center gap-1 ${
                fifoFilter === 'COMPENSACOES'
                  ? 'bg-emerald-600 text-white'
                  : isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Histórico Compensações</span>
              <span className="px-1 py-0.2 rounded bg-black/40 text-emerald-200 text-[9px]">{compensatedCount}</span>
            </button>
          </div>
        </div>

        {displayedRecords.length === 0 ? (
          <div className="text-center py-10 text-[#8E9299]">
            Nenhum lançamento corresponde ao filtro de visualização selecionado ({fifoFilter}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b text-[11px] ${isDark ? 'border-[#1F2229] text-[#8E9299]' : 'border-gray-200 text-gray-500'}`}>
                  <th className="pb-2.5">DATA OCORRÊNCIA</th>
                  <th className="pb-2.5">OCORRÊNCIA</th>
                  <th className="pb-2.5 text-right">SALDO GERADO</th>
                  <th className="pb-2.5 text-center">STATUS</th>
                  <th className="pb-2.5 text-right">SALDO REMANESCENTE</th>
                  <th className="pb-2.5">VÍNCULO FIFO</th>
                  <th className="pb-2.5 text-center">ANEXO</th>
                  <th className="pb-2.5 text-center">DETALHES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2229]/40">
                {displayedRecords.map((rec) => {
                  const isExpanded = expandedRecordId === rec.id;
                  const prescription = getRecordPrescriptionInfo(rec.dataRegistro, 180);

                  return (
                    <React.Fragment key={rec.id}>
                      <tr className={isDark ? 'hover:bg-[#0D0F14]/50' : 'hover:bg-gray-50'}>
                        <td className={`py-2.5 font-bold whitespace-nowrap ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          <div>{rec.data_ocorrencia || rec.dataRegistro}</div>
                          <div className="text-[10px] text-[#8E9299] font-normal">{rec.diaSemanaNome}</div>
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                            rec.tipoOcorrencia === 'ACABOU_BANHOU'
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {rec.tipoOcorrencia === 'ACABOU_BANHOU' ? '✨ ACABOU BANHOU' : rec.tipoOcorrencia}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-bold whitespace-nowrap">
                          {rec.saldoCalculado > 0 ? (
                            <span className="text-emerald-400">+{rec.saldoCalculado.toFixed(2)}h</span>
                          ) : rec.saldoCalculado < 0 ? (
                            <span className="text-red-400">{rec.saldoCalculado.toFixed(2)}h</span>
                          ) : (
                            <span className="text-[#8E9299]">0.00h</span>
                          )}
                        </td>
                        <td className="py-2.5 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                            rec.status_compensacao === 'TOTALMENTE_COMPENSADO'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : rec.status_compensacao === 'PARCIALMENTE_COMPENSADO'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {rec.status_compensacao === 'TOTALMENTE_COMPENSADO' ? 'COMPENSADO' :
                             rec.status_compensacao === 'PARCIALMENTE_COMPENSADO' ? 'PARCIAL' : 'ABERTO'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-bold whitespace-nowrap">
                          {rec.saldoCalculado === 0 ? (
                            <span className="text-[#8E9299]">—</span>
                          ) : (rec.saldo_remanescente && rec.saldo_remanescente > 0.001) ? (
                            <span className={rec.saldoCalculado > 0 ? 'text-amber-400' : 'text-red-400'}>
                              {rec.saldoCalculado > 0 ? `+${rec.saldo_remanescente.toFixed(1)}h` : `-${rec.saldo_remanescente.toFixed(1)}h`}
                            </span>
                          ) : (
                            <span className="text-emerald-400">0.0h (Quitado)</span>
                          )}
                        </td>
                        <td className="py-2.5 max-w-xs text-[11px]">
                          {rec.liquidacoes && rec.liquidacoes.length > 0 ? (
                            <div className="text-blue-400 flex items-center gap-1">
                              <LinkIcon className="w-3 h-3 shrink-0" />
                              <span>{rec.saldoCalculado > 0 ? `Baixado em ${rec.liquidacoes[0].data_baixa}` : `Origem em ${rec.liquidacoes[0].data_origem}`}</span>
                            </div>
                          ) : (
                            <span className="text-[#8E9299]">Aguardando baixa</span>
                          )}
                        </td>
                        <td className="py-2.5 text-center whitespace-nowrap">
                          {rec.comprovante ? (
                            <button
                              onClick={() => onViewAttachment?.(rec.comprovante!, authenticatedEmployee.nome, rec.dataRegistro)}
                              className="p-1 bg-[#0D0F14] hover:bg-[#1F2229] border border-[#1F2229] rounded text-blue-400 inline-flex items-center gap-1 text-[10px]"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>Anexo</span>
                            </button>
                          ) : (
                            <span className="text-[#5C616A]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => toggleExpand(rec.id)}
                            className="p-1 rounded text-[#8E9299] hover:text-white"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className={isDark ? 'bg-[#0D0F14]' : 'bg-gray-50'}>
                          <td colSpan={8} className="p-3 text-[11px]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div className="p-2 bg-[#15171C] border border-[#1F2229] rounded-lg">
                                <div className="font-bold text-blue-400 mb-1">Rastreabilidade de Baixa:</div>
                                {rec.liquidacoes && rec.liquidacoes.length > 0 ? (
                                  rec.liquidacoes.map((l, idx) => (
                                    <div key={idx} className="text-[#E0E2E5]">
                                      • {rec.saldoCalculado > 0 ? `Abatido ${l.horas_liquidadas}h em ${l.data_baixa}` : `Compensou ${l.horas_liquidadas}h geradas em ${l.data_origem}`}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-[#8E9299]">Nenhuma baixa realizada.</div>
                                )}
                              </div>
                              <div className="p-2 bg-[#15171C] border border-[#1F2229] rounded-lg">
                                <div className="font-bold text-amber-400 mb-1">Prescrição SPTF (180 dias):</div>
                                <div>Limite para Compensação: <span className="font-bold">{prescription.dataLimiteCompensacao}</span> ({prescription.diasRestantes} dias restantes)</div>
                                <div className="text-[#8E9299]">Observação: {rec.observacao || '—'}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
};
