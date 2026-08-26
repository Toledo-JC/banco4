import React, { useState, useEffect, useMemo, useId } from 'react';
import { Employee, TimeRecord, DispensaSptfRecord, Branch, SystemConfig, ConstructionSite } from '../types';
import { ComaraLogo } from './ComaraLogo';
import { getSignaturesForCanteiro } from '../services/canteiroService';
import { getEmployeeTotalBalance } from '../services/timebankEngine';
import { 
  X, 
  Printer, 
  FileText, 
  Clock, 
  Calendar, 
  Building2, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Scissors, 
  Sparkles, 
  Search, 
  History, 
  PlusCircle, 
  Trash2, 
  ArrowRight,
  ShieldCheck,
  Award
} from 'lucide-react';

interface SptfDispensaModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  records?: TimeRecord[];
  timeRecords?: TimeRecord[];
  dispensas?: DispensaSptfRecord[];
  constructionSites?: ConstructionSite[];
  onSaveDispensa: (dispensa: DispensaSptfRecord, record: TimeRecord) => Promise<void> | void;
  onDeleteDispensa?: (dispensaId: string, lancamentoId?: string) => Promise<void> | void;
  preselectedMatricula?: string;
  preselectedDate?: string;
  systemConfig?: SystemConfig;
  theme?: 'dark' | 'light';
  currentUserEmail?: string;
  currentUserName?: string;
}

function formatDateBR(isoDate?: string): string {
  if (!isoDate) return '____/____/________';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function calculateTimeDiffHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;
  const diffMinutes = minutes2 - minutes1;
  if (diffMinutes <= 0) return 0;
  return Number((diffMinutes / 60).toFixed(2));
}

function formatHoursToHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m > 0 ? String(m).padStart(2, '0') + 'min' : '00'}`;
}

export const SptfDispensaModal: React.FC<SptfDispensaModalProps> = ({
  isOpen,
  onClose,
  employees,
  records,
  timeRecords,
  dispensas = [],
  constructionSites = [],
  onSaveDispensa,
  onDeleteDispensa,
  preselectedMatricula,
  preselectedDate,
  systemConfig,
  theme = 'dark',
  currentUserEmail = '',
  currentUserName = 'Gestor SPTF'
}) => {
  const isDark = theme === 'dark';
  const modalId = useId();
  const todayStr = new Date().toISOString().split('T')[0];
  const allRecords = useMemo(() => timeRecords || records || [], [timeRecords, records]);

  const [activeTab, setActiveTab] = useState<'form' | 'history' | 'print'>('form');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatricula, setSelectedMatricula] = useState<string>('');
  const [secaoCanteiro, setSecaoCanteiro] = useState<string>('DECO-KO');
  const [dataDispensa, setDataDispensa] = useState<string>(todayStr);
  const [horarioInicio, setHorarioInicio] = useState<string>('13:00');
  const [horarioFim, setHorarioFim] = useState<string>('16:00');
  const [motivo, setMotivo] = useState<string>('COMPENSAÇÃO BANCO DE HORAS');
  const [observacoes, setObservacoes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Guia em visualização/impressão
  const [activePrintDispensa, setActivePrintDispensa] = useState<DispensaSptfRecord | null>(null);

  // Inicialização de valores ao abrir
  useEffect(() => {
    if (isOpen) {
      setDataDispensa(preselectedDate || todayStr);
      if (preselectedMatricula) {
        setSelectedMatricula(preselectedMatricula);
      } else if (employees.length > 0 && !selectedMatricula) {
        setSelectedMatricula(employees[0].matricula);
      }
      setFeedbackMsg(null);
    }
  }, [isOpen, preselectedMatricula, preselectedDate]);

  // Colaborador selecionado
  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.matricula === selectedMatricula);
  }, [employees, selectedMatricula]);

  // Atualizar Seção ao mudar colaborador
  useEffect(() => {
    if (selectedEmployee) {
      const sede = selectedEmployee.sede_atual || selectedEmployee.sede || 'KO';
      const canteiro = `DECO-${sede}`;
      setSecaoCanteiro(canteiro);
    }
  }, [selectedEmployee]);

  // Cálculo de horas calculadas
  const calculatedHours = useMemo(() => {
    return calculateTimeDiffHours(horarioInicio, horarioFim);
  }, [horarioInicio, horarioFim]);

  // Saldo do colaborador
  const employeeCurrentBalance = useMemo(() => {
    if (!selectedEmployee) return 0;
    return getEmployeeTotalBalance(selectedEmployee.matricula, employees, allRecords).saldoTotalHoras;
  }, [selectedEmployee, employees, allRecords]);

  const forecastedBalance = useMemo(() => {
    return employeeCurrentBalance - calculatedHours;
  }, [employeeCurrentBalance, calculatedHours]);

  // Filtragem de colaboradores para busca
  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(e => 
      e.nome.toLowerCase().includes(term) || 
      e.matricula.toLowerCase().includes(term) ||
      (e.funcao && e.funcao.toLowerCase().includes(term))
    );
  }, [employees, searchTerm]);

  // Filtragem de histórico de dispensas
  const filteredDispensas = useMemo(() => {
    if (!searchTerm.trim()) return dispensas;
    const term = searchTerm.toLowerCase();
    return dispensas.filter(d => 
      d.nome.toLowerCase().includes(term) ||
      d.matricula.toLowerCase().includes(term) ||
      (d.numeroGuia && d.numeroGuia.toLowerCase().includes(term)) ||
      (d.secaoCanteiro && d.secaoCanteiro.toLowerCase().includes(term))
    );
  }, [dispensas, searchTerm]);

  if (!isOpen) return null;

  const handleGenerateAndPrint = async () => {
    if (!selectedEmployee) {
      setFeedbackMsg({ type: 'error', text: 'Selecione um colaborador válido.' });
      return;
    }
    if (calculatedHours <= 0) {
      setFeedbackMsg({ type: 'error', text: 'O horário de término deve ser posterior ao horário de início.' });
      return;
    }
    if (!dataDispensa) {
      setFeedbackMsg({ type: 'error', text: 'Informe a data da dispensa.' });
      return;
    }

    setIsSaving(true);
    setFeedbackMsg(null);

    try {
      const now = new Date();
      const ano = now.getFullYear();
      const seq = String(dispensas.length + 1).padStart(3, '0');
      const numeroGuia = `SPTF-${ano}/${seq}`;
      const dispensaId = `dispensa_${Date.now()}_${selectedEmployee.matricula}`;
      const lancamentoId = `lanc_dispensa_${Date.now()}_${selectedEmployee.matricula}`;

      const dispensaRecord: DispensaSptfRecord = {
        id: dispensaId,
        numeroGuia,
        matricula: selectedEmployee.matricula,
        nome: selectedEmployee.nome,
        saram: selectedEmployee.matricula,
        secaoCanteiro: secaoCanteiro || `DECO-${selectedEmployee.sede || 'KO'}`,
        data: dataDispensa,
        horarioInicio,
        horarioFim,
        totalHoras: calculatedHours,
        motivo: motivo || 'COMPENSAÇÃO BANCO DE HORAS',
        observacoes: observacoes.trim(),
        emitidoPorNome: currentUserName,
        emitidoPorEmail: currentUserEmail,
        emitidoEm: now.toISOString(),
        lancamentoId,
        status: 'EMITIDA',
      };

      const timeRecord: TimeRecord = {
        id: lancamentoId,
        matricula: selectedEmployee.matricula,
        employeeName: selectedEmployee.nome,
        employeeSede: selectedEmployee.sede || 'KO',
        employeeFuncao: selectedEmployee.funcao || 'Técnico de Manutenção',
        employeeAvatarUrl: selectedEmployee.avatarUrl || selectedEmployee.url_foto_perfil,
        dataRegistro: dataDispensa,
        data_ocorrencia: dataDispensa,
        tipoOcorrencia: 'COMPENSACAO_DISPENSA',
        horasBrutas: calculatedHours,
        multiplicador: 1.0,
        saldoCalculado: -calculatedHours,
        saldo_remanescente: 0,
        status_compensacao: 'TOTALMENTE_COMPENSADO',
        liquidacoes: [],
        eFeriado: false,
        diaSemana: new Date(dataDispensa + 'T12:00:00').getDay(),
        diaSemanaNome: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][new Date(dataDispensa + 'T12:00:00').getDay()] || '',
        observacao: `Dispensa SPTF Nº ${numeroGuia} (${horarioInicio} às ${horarioFim}) - Motivo: ${motivo}${observacoes ? ' - ' + observacoes : ''}`,
        criadoEm: now.toISOString(),
        criadoPorEmail: currentUserEmail,
        atualizadoEm: now.toISOString(),
      };

      await onSaveDispensa(dispensaRecord, timeRecord);

      setActivePrintDispensa(dispensaRecord);
      setActiveTab('print');
      setFeedbackMsg({ type: 'success', text: `Guia ${numeroGuia} emitida e debitada com sucesso no Banco de Horas!` });
    } catch (err: any) {
      console.error('Erro ao emitir dispensa:', err);
      setFeedbackMsg({ type: 'error', text: err?.message || 'Falha ao salvar a Dispensa de SPTF.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      id={`modal-${modalId}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-fadeIn print:p-0 print:bg-white print:static print:overflow-visible"
      role="dialog"
      aria-modal="true"
    >
      {/* Estilos dedicados para impressão A4 em 2 vias perfeitas */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #sptf-print-container, #sptf-print-container * {
            visibility: visible;
          }
          #sptf-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
          .sptf-via-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />

      <div className={`relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border ${
        isDark 
          ? 'bg-slate-900 border-slate-800 text-slate-100' 
          : 'bg-white border-slate-200 text-slate-900'
      } print:max-h-none print:border-none print:shadow-none print:w-full print:rounded-none`}>
        
        {/* Header do Modal (Oculto na impressão) */}
        <div className="no-print flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-900/40 via-slate-900 to-slate-900 dark:from-blue-950/60 dark:to-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Emissão de Dispensa de SPTF
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  2 Vias A4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Lançamento automático no Banco de Horas com guia oficial COMARA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Abas de Navegação */}
            <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700">
              <button
                id="btn-tab-form"
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'form'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Nova Guia
              </button>

              <button
                id="btn-tab-history"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'history'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Histórico ({dispensas.length})
              </button>

              {activePrintDispensa && (
                <button
                  id="btn-tab-print"
                  onClick={() => setActiveTab('print')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTab === 'print'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir 2 Vias
                </button>
              )}
            </div>

            <button
              id="btn-close-sptf-modal"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert (Oculto na impressão) */}
        {feedbackMsg && (
          <div className={`no-print mx-4 mt-3 p-3 rounded-lg flex items-center gap-2 text-xs font-medium ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}>
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Conteúdo Principal com Rolagem Suave */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0 print:overflow-visible">

          {/* ============================================================ */}
          {/* TAB 1: FORMULÁRIO DE NOVA GUIA DE DISPENSA                    */}
          {/* ============================================================ */}
          {activeTab === 'form' && (
            <div className="no-print space-y-6">
              {/* Seleção do Colaborador */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    1. Colaborador / Matrícula (SARAM) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="select-dispensa-colaborador"
                      value={selectedMatricula}
                      onChange={(e) => setSelectedMatricula(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                        isDark 
                          ? 'bg-slate-800/90 border-slate-700 text-slate-100 hover:border-slate-600' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 hover:border-slate-400'
                      }`}
                    >
                      <option value="" disabled>-- Selecione o Colaborador --</option>
                      {employees.map(emp => (
                        <option key={emp.matricula} value={emp.matricula}>
                          {emp.nome} ({emp.matricula}) - {emp.funcao || 'Servidor'} [{emp.sede || 'KO'}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Seção / Canteiro de Lotação */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    2. Seção / Canteiro <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      id="input-dispensa-secao"
                      type="text"
                      value={secaoCanteiro}
                      onChange={(e) => setSecaoCanteiro(e.target.value.toUpperCase())}
                      placeholder="Ex: DECO-KO"
                      className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-sm font-medium uppercase transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                        isDark 
                          ? 'bg-slate-800/90 border-slate-700 text-slate-100' 
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Card de Informações e Saldo em Tempo Real */}
              {selectedEmployee && (
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-sm">
                      {selectedEmployee.nome.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">{selectedEmployee.nome}</h4>
                      <p className="text-xs text-slate-400">
                        Matrícula / SARAM: <span className="font-mono text-slate-300">{selectedEmployee.matricula}</span> • Função: {selectedEmployee.funcao || 'Servidor'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Saldo Atual</span>
                      <span className={`text-sm font-bold font-mono ${
                        employeeCurrentBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {employeeCurrentBalance > 0 ? `+${employeeCurrentBalance.toFixed(1)}h` : `${employeeCurrentBalance.toFixed(1)}h`}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-500" />

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Após Dispensa</span>
                      <span className={`text-sm font-bold font-mono ${
                        forecastedBalance >= 0 ? 'text-blue-400' : 'text-amber-400'
                      }`}>
                        {forecastedBalance > 0 ? `+${forecastedBalance.toFixed(1)}h` : `${forecastedBalance.toFixed(1)}h`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Data e Período de Horário */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    3. Data da Dispensa <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      id="input-dispensa-data"
                      type="date"
                      value={dataDispensa}
                      onChange={(e) => setDataDispensa(e.target.value)}
                      className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                        isDark 
                          ? 'bg-slate-800/90 border-slate-700 text-slate-100' 
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    4. Horário de Início <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <input
                      id="input-dispensa-hora-inicio"
                      type="time"
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                        isDark 
                          ? 'bg-slate-800/90 border-slate-700 text-slate-100' 
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    5. Horário de Fim <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <input
                      id="input-dispensa-hora-fim"
                      type="time"
                      value={horarioFim}
                      onChange={(e) => setHorarioFim(e.target.value)}
                      className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                        isDark 
                          ? 'bg-slate-800/90 border-slate-700 text-slate-100' 
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Destaque do Cálculo Automático */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                      Cálculo Automático de Horas a Abater
                    </h5>
                    <p className="text-xs text-slate-400">
                      Período de {horarioInicio} às {horarioFim} ({formatDateBR(dataDispensa)})
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-blue-300">
                    {calculatedHours.toFixed(1)}h
                  </span>
                  <span className="text-xs text-slate-400 block font-medium">
                    ({formatHoursToHoursMinutes(calculatedHours)} a deduzir)
                  </span>
                </div>
              </div>

              {/* Motivo e Observações */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    6. Motivo da Dispensa <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="input-dispensa-motivo"
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value.toUpperCase())}
                    placeholder="Ex: COMPENSAÇÃO BANCO DE HORAS"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium uppercase transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                      isDark 
                        ? 'bg-slate-800/90 border-slate-700 text-slate-100' 
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'COMPENSAÇÃO BANCO DE HORAS',
                      'COMPENSAÇÃO DE JORNADA',
                      'LIBERAÇÃO OPERACIONAL / CHEFIA',
                      'COMPENSAÇÃO DE SOBREAVISO',
                      'ASSUNTOS PARTICULARES'
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMotivo(preset)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    7. Observações Adicionais (Opcional)
                  </label>
                  <textarea
                    id="textarea-dispensa-observacoes"
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações complementares, número de ordem de serviço ou despacho da chefia..."
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                      isDark 
                        ? 'bg-slate-800/90 border-slate-700 text-slate-100' 
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  id="btn-cancel-dispensa-form"
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  id="btn-submit-dispensa-print"
                  type="button"
                  disabled={isSaving || calculatedHours <= 0 || !selectedEmployee}
                  onClick={handleGenerateAndPrint}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/30 transition-all"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Gravando e Gerando...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      Emitir & Gerar Guia (2 Vias A4)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: HISTÓRICO DE DISPENSAS EMITIDAS                       */}
          {/* ============================================================ */}
          {activeTab === 'history' && (
            <div className="no-print space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, guia ou matrícula..."
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <button
                  onClick={() => setActiveTab('form')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Nova Dispensa
                </button>
              </div>

              {filteredDispensas.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-400">Nenhuma dispensa encontrada</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Emita novas guias de dispensa na aba "Nova Guia" para registrar abatimentos.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                  {filteredDispensas.map((d) => (
                    <div 
                      key={d.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 font-mono text-xs font-bold shrink-0">
                          {d.numeroGuia || 'SPTF'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-200">{d.nome}</span>
                            <span className="text-xs font-mono text-slate-400">({d.matricula})</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                              {d.secaoCanteiro}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Data: <span className="font-medium text-slate-300">{formatDateBR(d.data)}</span> • Horário: <span className="font-medium text-slate-300">{d.horarioInicio} às {d.horarioFim}</span> • Débito: <span className="font-bold text-rose-400">-{d.totalHoras.toFixed(1)}h</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => {
                            setActivePrintDispensa(d);
                            setActiveTab('print');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition-colors"
                          title="Reimprimir Guia em 2 Vias"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Reimprimir
                        </button>

                        {onDeleteDispensa && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Deseja cancelar a Dispensa ${d.numeroGuia || ''} de ${d.nome}? O lançamento correspondente no Banco de Horas também será cancelado.`)) {
                                onDeleteDispensa(d.id, d.lancamentoId);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Cancelar Dispensa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: VISUALIZAÇÃO E IMPRESSÃO OFICIAL (2 VIAS A4)           */}
          {/* ============================================================ */}
          {(activeTab === 'print' || activePrintDispensa) && (
            <div className="space-y-4">
              {/* Barra de Ações de Impressão (Oculta na folha impressa) */}
              <div className="no-print p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Printer className="w-4 h-4 text-emerald-400" />
                    Layout de Impressão Oficial (2 Vias na Folha A4)
                  </h4>
                  <p className="text-xs text-slate-400">
                    O documento está formatado para caber exatamente em uma única folha A4 com destaque serrilhado.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-back-to-edit"
                    onClick={() => setActiveTab('form')}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                  >
                    Voltar ao Formulário
                  </button>

                  <button
                    id="btn-print-official-guide"
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Guia (2 Vias)
                  </button>
                </div>
              </div>

              {/* CONTAINER DA FOLHA DE IMPRESSÃO A4 (2 VIAS IDÊNTICAS) */}
              <div 
                id="sptf-print-container" 
                className="bg-white text-black p-4 sm:p-6 rounded-xl border border-slate-300 shadow-inner font-sans text-xs space-y-4 print:p-0 print:border-none print:shadow-none"
              >
                {activePrintDispensa ? (
                  <>
                    {/* ==================== 1ª VIA - SPTF ==================== */}
                    <ViaCard 
                      dispensa={activePrintDispensa} 
                      viaTitle="1ª VIA - SPTF (SEÇÃO DE PESSOAL)" 
                      viaBadge="1ª VIA - SPTF"
                      constructionSites={constructionSites}
                    />

                    {/* Linha Serrilhada de Corte (Destaque) */}
                    <div className="relative py-2 flex items-center justify-center">
                      <div className="w-full border-b-2 border-dashed border-slate-400"></div>
                      <div className="absolute bg-white px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-1">
                        <Scissors className="w-3.5 h-3.5" />
                        Destaque Aqui (Corte da 1ª e 2ª Via)
                      </div>
                    </div>

                    {/* ==================== 2ª VIA - CHEFIA / SERVIDOR ==================== */}
                    <ViaCard 
                      dispensa={activePrintDispensa} 
                      viaTitle="2ª VIA - CHEFIA IMEDIATA / SERVIDOR" 
                      viaBadge="2ª VIA - CHEFIA / SERVIDOR"
                      constructionSites={constructionSites}
                    />
                  </>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    Nenhuma guia selecionada para impressão.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE AUXILIAR DE VIA INDIVIDUAL (COMARA SPTF TEMPLATE)
// ============================================================================
interface ViaCardProps {
  dispensa: DispensaSptfRecord;
  viaTitle: string;
  viaBadge: string;
  constructionSites?: ConstructionSite[];
}

const ViaCard: React.FC<ViaCardProps> = ({ dispensa, viaTitle, viaBadge, constructionSites = [] }) => {
  const signatures = useMemo(() => {
    return getSignaturesForCanteiro(dispensa.secaoCanteiro, constructionSites);
  }, [dispensa.secaoCanteiro, constructionSites]);

  return (
    <div className="sptf-via-card border-2 border-black p-3.5 bg-white text-black text-xs">
      
      {/* Cabeçalho Institucional Oficial */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2.5">
        <div className="flex items-center gap-3">
          <ComaraLogo size="sm" showText={false} theme="light" className="h-10 w-auto" />
          <div className="text-left">
            <h1 className="text-[11px] font-extrabold uppercase leading-tight tracking-wider text-black">
              COMANDO DA AERONÁUTICA
            </h1>
            <h2 className="text-[10px] font-bold uppercase leading-tight text-black">
              COMISSÃO DE AEROPORTOS DA REGIÃO AMAZÔNICA - COMARA
            </h2>
            <h3 className="text-[9px] font-semibold uppercase leading-tight text-slate-800">
              SEÇÃO DE PESSOAL E TRABALHADOR DE FORÇA (SPTF)
            </h3>
          </div>
        </div>

        <div className="text-right">
          <div className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-black text-white rounded mb-1">
            {viaBadge}
          </div>
          <div className="text-[10px] font-bold font-mono text-black">
            Nº: {dispensa.numeroGuia || 'SPTF-2026/___'}
          </div>
        </div>
      </div>

      {/* Título do Documento */}
      <div className="text-center py-1 bg-slate-100 border border-black mb-2.5">
        <h4 className="text-xs font-black uppercase tracking-widest text-black">
          DISPENSA DE SPTF
        </h4>
        <span className="text-[9px] font-medium text-slate-700 uppercase">
          Guia de Autorização e Débito no Banco de Horas
        </span>
      </div>

      {/* Grade de Dados do Servidor e da Dispensa */}
      <div className="border border-black divide-y divide-black mb-2.5 text-[10px]">
        <div className="grid grid-cols-12 divide-x divide-black bg-white">
          <div className="col-span-8 p-1.5">
            <span className="font-bold uppercase text-[9px] block text-slate-700">NOME DO COLABORADOR:</span>
            <span className="font-extrabold text-[11px] text-black">{dispensa.nome}</span>
          </div>
          <div className="col-span-4 p-1.5">
            <span className="font-bold uppercase text-[9px] block text-slate-700">SARAM / MATRÍCULA:</span>
            <span className="font-bold text-[11px] font-mono text-black">{dispensa.matricula}</span>
          </div>
        </div>

        <div className="grid grid-cols-12 divide-x divide-black bg-white">
          <div className="col-span-4 p-1.5">
            <span className="font-bold uppercase text-[9px] block text-slate-700">SEÇÃO / CANTEIRO:</span>
            <span className="font-bold text-[10px] text-black">{dispensa.secaoCanteiro}</span>
          </div>
          <div className="col-span-4 p-1.5">
            <span className="font-bold uppercase text-[9px] block text-slate-700">DATA DA DISPENSA:</span>
            <span className="font-bold text-[10px] text-black">{formatDateBR(dispensa.data)}</span>
          </div>
          <div className="col-span-4 p-1.5">
            <span className="font-bold uppercase text-[9px] block text-slate-700">TOTAL ABATIDO:</span>
            <span className="font-black text-[10px] text-black font-mono">
              {dispensa.totalHoras.toFixed(1)}h ({formatHoursToHoursMinutes(dispensa.totalHoras)})
            </span>
          </div>
        </div>

        <div className="p-1.5 bg-white">
          <span className="font-bold uppercase text-[9px] block text-slate-700">PERÍODO DE DISPENSA:</span>
          <span className="font-bold text-[10px] text-black">
            {formatDateBR(dispensa.data)} ({dispensa.horarioInicio}) A {formatDateBR(dispensa.data)} ({dispensa.horarioFim})
          </span>
        </div>

        <div className="p-1.5 bg-white">
          <span className="font-bold uppercase text-[9px] block text-slate-700">MOTIVO:</span>
          <span className="font-extrabold text-[10px] text-black uppercase">{dispensa.motivo}</span>
        </div>

        {dispensa.observacoes && (
          <div className="p-1.5 bg-slate-50">
            <span className="font-bold uppercase text-[9px] block text-slate-700">OBSERVAÇÕES:</span>
            <span className="text-[9px] text-black">{dispensa.observacoes}</span>
          </div>
        )}
      </div>

      {/* Blocos de Assinatura Dinâmicos Mapeados da Liderança do Canteiro */}
      <div className="grid grid-cols-3 gap-2 text-center text-[9px] pt-1">
        
        {/* Bloco 1: Encarregado / Chefe do Canteiro */}
        <div className="border border-black p-1.5 flex flex-col justify-between min-h-[64px] bg-slate-50/50">
          <div>
            <span className="font-bold uppercase text-[8.5px] block text-black">
              {signatures.assinatura1.titulo}
            </span>
            <span className="text-[8px] text-slate-600 block truncate">
              {signatures.assinatura1.nome}
            </span>
          </div>
          <div className="mt-2.5 border-t border-black pt-0.5">
            <span className="text-[7.5px] font-semibold text-slate-700 block truncate">
              Assinatura / Visto do Canteiro
            </span>
          </div>
        </div>

        {/* Bloco 2: Chefe / Encarregado da DA */}
        <div className="border border-black p-1.5 flex flex-col justify-between min-h-[64px] bg-slate-50/50">
          <div>
            <span className="font-bold uppercase text-[8.5px] block text-black">
              {signatures.assinatura2.titulo}
            </span>
            <span className="text-[8px] text-slate-600 block truncate">
              {signatures.assinatura2.nome}
            </span>
          </div>
          <div className="mt-2.5 border-t border-black pt-0.5">
            <span className="text-[7.5px] font-semibold text-slate-700 block truncate">
              Visto Divisão Administrativa
            </span>
          </div>
        </div>

        {/* Bloco 3: Engenheiro Fiscal / RH Admin */}
        <div className="border border-black p-1.5 flex flex-col justify-between min-h-[64px] bg-slate-50/50">
          <div>
            <span className="font-bold uppercase text-[8.5px] block text-black">
              {signatures.assinatura3.titulo}
            </span>
            <span className="text-[8px] text-slate-600 block truncate">
              {signatures.assinatura3.nome}
            </span>
          </div>
          <div className="mt-2.5 border-t border-black pt-0.5">
            <span className="text-[7.5px] font-semibold text-slate-700 block truncate">
              Fiscalização / Homologação SPTF
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
