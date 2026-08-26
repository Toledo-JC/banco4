import React, { useState, useMemo } from 'react';
import { Employee, TimeRecord, Attachment, CompensationStatus, InsalubrityRecord } from '../types';
import { ComaraLogo } from './ComaraLogo';
import { 
  getEmployeeTotalBalance, 
  formatHoursDecimal, 
  formatHoursToDays, 
  generateMonthlySummaries,
  calculateFifoLiquidations,
  getRecordPrescriptionInfo
} from '../utils/calculations';
import { 
  User, 
  Calendar, 
  Clock, 
  Building, 
  FileText, 
  Printer, 
  ArrowLeft, 
  PlusCircle, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  Link as LinkIcon,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Biohazard,
  Shield,
  Pencil,
  Trash2
} from 'lucide-react';
import { exportTimeRecordsToLookerCSV, triggerFileDownload } from '../utils/csvHandler';

interface EmployeeStatementProps {
  employees: Employee[];
  records: TimeRecord[];
  insalubrityRecords?: InsalubrityRecord[];
  selectedMatricula: string;
  onSelectMatricula: (matricula: string) => void;
  onBack: () => void;
  onOpenNewEntry: (matricula: string) => void;
  onOpenEditEntry?: (record: TimeRecord) => void;
  onDeleteRecord?: (id: string) => void | Promise<void>;
  onViewAttachment: (attachment: Attachment, empName?: string, recordDate?: string) => void;
  theme?: 'dark' | 'light';
}

type FifoFilterType = 'TODOS' | 'PENDENTES' | 'COMPENSACOES';

export const EmployeeStatement: React.FC<EmployeeStatementProps> = ({
  employees,
  records,
  insalubrityRecords = [],
  selectedMatricula,
  onSelectMatricula,
  onBack,
  onOpenNewEntry,
  onOpenEditEntry,
  onDeleteRecord,
  onViewAttachment,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const currentEmployee = employees.find(e => e.matricula === selectedMatricula) || employees[0];
  const [fifoFilter, setFifoFilter] = useState<FifoFilterType>('TODOS');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Insalubridade records for this employee
  const employeeInsalubrities = useMemo(() => {
    if (!currentEmployee) return [];
    const mat = currentEmployee.matricula.trim().toUpperCase();
    return insalubrityRecords.filter(
      (ins) => ins.matricula.trim().toUpperCase() === mat ||
               ins.matricula.replace(/^0+/, '').toUpperCase() === mat.replace(/^0+/, '')
    );
  }, [insalubrityRecords, currentEmployee]);

  // Registros do colaborador
  const rawEmployeeRecords = useMemo(() => {
    if (!currentEmployee) return [];
    return records.filter(r => r.matricula === currentEmployee.matricula);
  }, [records, currentEmployee]);

  // Processar liquidações FIFO (First-In, First-Out)
  const fifoResult = useMemo(() => {
    return calculateFifoLiquidations(rawEmployeeRecords, currentEmployee?.saldoInicialHoras || 0);
  }, [rawEmployeeRecords, currentEmployee]);

  // Ordenar registros para exibição (mais recentes primeiro)
  const allProcessedRecords = useMemo(() => {
    return [...fifoResult.processedRecords].sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro));
  }, [fifoResult]);

  // Filtrar registros de acordo com o filtro selecionado
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

  const balance = useMemo(() => {
    if (!currentEmployee) return null;
    return getEmployeeTotalBalance(currentEmployee.matricula, employees, records);
  }, [currentEmployee, employees, records]);

  // Contadores de Rastreabilidade FIFO
  const pendingRecordsCount = useMemo(() => {
    return allProcessedRecords.filter(r => 
      (r.status_compensacao === 'ABERTO' || r.status_compensacao === 'PARCIALMENTE_COMPENSADO') &&
      (r.saldo_remanescente && r.saldo_remanescente > 0.001)
    ).length;
  }, [allProcessedRecords]);

  const compensatedRecordsCount = useMemo(() => {
    return allProcessedRecords.filter(r => 
      r.status_compensacao === 'TOTALMENTE_COMPENSADO' && r.saldoCalculado !== 0
    ).length;
  }, [allProcessedRecords]);

  // Alertas de Prescrição SPTF (180 dias)
  const expiringRecords = useMemo(() => {
    return allProcessedRecords
      .filter(r => r.saldoCalculado > 0 && r.status_compensacao !== 'TOTALMENTE_COMPENSADO')
      .map(r => ({
        record: r,
        prescription: getRecordPrescriptionInfo(r.dataRegistro, 180)
      }))
      .filter(item => item.prescription.statusPrescricao === 'CRITICO' || item.prescription.statusPrescricao === 'VENCIDO');
  }, [allProcessedRecords]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!currentEmployee) return;
    const csv = exportTimeRecordsToLookerCSV(allProcessedRecords, [currentEmployee]);
    triggerFileDownload(csv, `extrato_banco_horas_${currentEmployee.matricula}_${currentEmployee.nome.replace(/\s+/g, '_')}.csv`);
  };

  const toggleExpandRecord = (id: string) => {
    setExpandedRecordId(prev => prev === id ? null : id);
  };

  if (!currentEmployee || !balance) {
    return (
      <div className={`p-8 text-center rounded-2xl border ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <p className={isDark ? 'text-[#8E9299]' : 'text-slate-600'}>Nenhum colaborador selecionado.</p>
        <button onClick={onBack} className="mt-3 text-[#3B82F6] font-bold text-sm">
          Voltar para o painel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Bar with Selector and Actions */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border shadow-xs print:hidden transition-all ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-[#1F2229] text-[#8E9299] hover:text-[#E0E2E5]' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
            title="Voltar ao Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-mono font-bold ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Colaborador:</span>
            <select
              value={currentEmployee.matricula}
              onChange={(e) => onSelectMatricula(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border focus:outline-hidden ${
                isDark 
                  ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-[#3B82F6]' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
              }`}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.matricula}>
                  {emp.matricula} — {emp.nome} ({emp.sede})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors font-mono border ${
              isDark 
                ? 'text-[#E0E2E5] bg-[#1F2229] hover:bg-[#2A2E38] border-[#1F2229]' 
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors font-mono border ${
              isDark 
                ? 'text-[#E0E2E5] bg-[#1F2229] hover:bg-[#2A2E38] border-[#1F2229]' 
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-amber-500" />
            <span>Imprimir Extrato</span>
          </button>

          <button
            onClick={() => onOpenNewEntry(currentEmployee.matricula)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-lg transition-all shadow-md shadow-blue-500/20 active:scale-98"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Lançar Ocorrência</span>
          </button>
        </div>
      </div>

      {/* Cabeçalho Institucional Oficial COMARA (Visível na Tela e na Impressão/PDF) */}
      <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between gap-4 transition-all print:border-b-2 print:border-slate-300 print:shadow-none print:rounded-none print:p-2 ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <ComaraLogo size="lg" />
          <div>
            <div className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-widest text-blue-500 print:text-blue-900">
              COMANDO DA AERONÁUTICA • COMISSÃO DE AEROPORTOS DA REGIÃO AMAZÔNICA
            </div>
            <h2 className={`text-sm sm:text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'} print:text-black`}>
              EXTRATO INDIVIDUAL DE BANCO DE HORAS & COMPENSAÇÕES (SPTF)
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'} print:text-slate-600`}>
              Sede/Canteiro: <span className="font-bold text-blue-400 print:text-black">{currentEmployee.sede}</span> • Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="hidden sm:block text-right text-[10px] font-mono text-slate-400 print:text-slate-700">
          <div className="font-bold text-slate-200 print:text-black">COMARA • RH / SPTF</div>
          <div>Documento Oficial</div>
        </div>
      </div>

      {/* Employee Profile Header Card */}
      <div className={`p-6 rounded-2xl border shadow-md relative overflow-hidden transition-all ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            {currentEmployee.avatarUrl || currentEmployee.url_foto_perfil ? (
              <img
                src={currentEmployee.avatarUrl || currentEmployee.url_foto_perfil}
                alt={currentEmployee.nome}
                className={`w-16 h-16 rounded-2xl object-cover border-2 shadow-lg ${
                  isDark ? 'border-[#2A2E38]' : 'border-slate-200'
                }`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center font-bold text-xl shadow-lg font-mono ${
                isDark ? 'bg-[#1F2229] border-[#2A2E38] text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
              }`}>
                {currentEmployee.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
            )}
            
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentEmployee.nome}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  currentEmployee.status === 'Ativo' 
                    ? isDark ? 'bg-emerald-950/40 text-green-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isDark ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {currentEmployee.status}
                </span>
              </div>
              
              <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono ${
                isDark ? 'text-[#8E9299]' : 'text-slate-600'
              }`}>
                <span className="flex items-center gap-1 font-bold">
                  <span className="text-blue-500">#{currentEmployee.matricula}</span>
                </span>
                <span>•</span>
                <span>{currentEmployee.funcao || currentEmployee.cargo}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-blue-500" />
                  Sede Origem: <strong className={isDark ? 'text-[#E0E2E5]' : 'text-slate-800'}>{currentEmployee.sede}</strong>
                </span>
                {currentEmployee.sede_atual && currentEmployee.sede_atual !== currentEmployee.sede && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    ➔ Alocado em {currentEmployee.sede_atual}
                  </span>
                )}
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Admissão: {currentEmployee.dataAdmissao}
                </span>
                <span>•</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  currentEmployee.grauInsalubridadeFixa === '40%'
                    ? isDark ? 'bg-red-950/40 text-red-300 border-red-800/40' : 'bg-red-50 text-red-700 border-red-200'
                    : currentEmployee.grauInsalubridadeFixa === '20%'
                    ? isDark ? 'bg-amber-950/40 text-amber-300 border-amber-800/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                    : currentEmployee.grauInsalubridadeFixa === '10%'
                    ? isDark ? 'bg-blue-950/40 text-blue-300 border-blue-800/40' : 'bg-blue-50 text-blue-700 border-blue-200'
                    : isDark ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <Biohazard className="w-3 h-3 text-amber-400" />
                  <span>Insalubridade: {currentEmployee.grauInsalubridadeFixa ? `${currentEmployee.grauInsalubridadeFixa} (NR-15)` : 'Não Aplicável / 0%'}</span>
                  {employeeInsalubrities.length > 0 && (
                    <span className="ml-1 px-1 rounded bg-black/40 text-[9px]">
                      {employeeInsalubrities.length} laudo(s)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Balance KPI Widget */}
          <div className={`flex items-center gap-6 p-4 rounded-xl border ${
            isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <span className={`text-[10px] font-mono uppercase tracking-wider block ${
                isDark ? 'text-[#8E9299]' : 'text-slate-500'
              }`}>
                Saldo Consolidado SPTF
              </span>
              <div className={`text-2xl font-black font-mono mt-0.5 ${
                balance.saldoTotalHoras > 0 
                  ? isDark ? 'text-green-400' : 'text-emerald-600'
                  : balance.saldoTotalHoras < 0 
                  ? isDark ? 'text-red-400' : 'text-red-600'
                  : isDark ? 'text-[#8E9299]' : 'text-slate-500'
              }`}>
                {formatHoursDecimal(balance.saldoTotalHoras)}
              </div>
              <span className={`text-[11px] font-mono block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                {formatHoursToDays(balance.saldoTotalHoras)}
              </span>
            </div>

            <div className={`border-l pl-5 space-y-1 text-xs font-mono ${
              isDark ? 'border-[#1F2229]' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className={isDark ? 'text-[#8E9299]' : 'text-slate-500'}>Positivas (Créditos):</span>
                <strong className={isDark ? 'text-green-400' : 'text-emerald-600'}>
                  +{balance.totalCreditos.toFixed(1)}h
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <span className={isDark ? 'text-[#8E9299]' : 'text-slate-500'}>Negativas (Débitos):</span>
                <strong className={isDark ? 'text-red-400' : 'text-red-600'}>
                  -{balance.totalDebitos.toFixed(1)}h
                </strong>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className={isDark ? 'text-[#8E9299]' : 'text-slate-500'}>Status Geral:</span>
                <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] border ${
                  balance.status === 'CREDOR'
                    ? isDark ? 'bg-emerald-950/40 text-green-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : balance.status === 'DEVEDOR'
                    ? isDark ? 'bg-red-950/40 text-red-400 border-red-800/40' : 'bg-red-50 text-red-700 border-red-200'
                    : isDark ? 'bg-[#1F2229] text-[#8E9299]' : 'bg-slate-200 text-slate-700'
                }`}>
                  {balance.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rastreabilidade FIFO & Liquidação Metrics Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Horas Liquidadas / Abatidas */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#8E9299]">
              <Layers className="w-4 h-4 text-blue-500" />
              <span>HORAS LIQUIDADAS (FIFO)</span>
            </div>
            <div className="text-xl font-bold font-mono text-blue-500 mt-1">
              {fifoResult.totalHorasLiquidadas.toFixed(1)}h
            </div>
            <p className="text-[11px] font-mono text-[#8E9299] mt-0.5">
              {compensatedRecordsCount} lançamentos quitados via folgas
            </p>
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
            <CheckCircle className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        {/* Card 2: Saldo Remanescente em Aberto */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#8E9299]">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>SALDO REMANESCENTE ABERTO</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-500 mt-1">
              +{fifoResult.totalHorasPendentes.toFixed(1)}h
            </div>
            <p className="text-[11px] font-mono text-[#8E9299] mt-0.5">
              {pendingRecordsCount} dias pendentes de compensação
            </p>
          </div>
          <div className={`p-3 rounded-xl ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        {/* Card 3: Conformidade e Prescrição SPTF (180 dias) */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          expiringRecords.length > 0 
            ? isDark ? 'bg-red-950/20 border-red-900/50' : 'bg-red-50/70 border-red-200'
            : isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#8E9299]">
              <ShieldCheck className={`w-4 h-4 ${expiringRecords.length > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
              <span>PRESCRIÇÃO SPTF (180 DIAS)</span>
            </div>
            <div className={`text-xl font-bold font-mono mt-1 ${expiringRecords.length > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
              {expiringRecords.length > 0 ? `${expiringRecords.length} Alertas` : 'Conforme Art. 59 SPTF'}
            </div>
            <p className="text-[11px] font-mono text-[#8E9299] mt-0.5">
              {expiringRecords.length > 0 
                ? 'Lançamentos próximos de prescrever 6 meses' 
                : 'Nenhum lançamento vencido de banco'}
            </p>
          </div>
          <div className={`p-3 rounded-xl ${expiringRecords.length > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
            {expiringRecords.length > 0 ? (
              <AlertTriangle className="w-6 h-6 text-red-500" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            )}
          </div>
        </div>
      </div>

      {/* Alerta Visual de Prescrição se houver registros críticos */}
      {expiringRecords.length > 0 && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs font-mono ${
          isDark ? 'bg-red-950/40 border-red-800/60 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block font-bold">Atenção RH: Risco de Prescrição Semestral (Art. 59 § 5º do SPTF)</strong>
            <p>
              Existem {expiringRecords.length} lançamentos em aberto com mais de 150 dias de geração que precisam ser compensados ou pagos como hora extra antes do limite de 180 dias.
            </p>
          </div>
        </div>
      )}

      {/* Extrato Detalhado de Ocorrências com Filtro de Rastreabilidade FIFO */}
      <div className={`rounded-2xl border shadow-md overflow-hidden ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Rastreabilidade de Horas & Compensação FIFO
            </h3>
            <span className={`text-xs font-mono ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              ({displayedRecords.length} lançamentos exibidos)
            </span>
          </div>

          {/* Abas de Visualização / Filtro FIFO */}
          <div className="flex items-center bg-[#0A0B0D] p-1 rounded-xl border border-[#1F2229] text-xs font-mono">
            <button
              onClick={() => setFifoFilter('TODOS')}
              className={`px-3 py-1.5 rounded-lg transition-all font-semibold ${
                fifoFilter === 'TODOS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos os Lançamentos ({allProcessedRecords.length})
            </button>
            <button
              onClick={() => setFifoFilter('PENDENTES')}
              className={`px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 ${
                fifoFilter === 'PENDENTES'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Apenas Saldos Pendentes</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 text-amber-200">
                {pendingRecordsCount}
              </span>
            </button>
            <button
              onClick={() => setFifoFilter('COMPENSACOES')}
              className={`px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 ${
                fifoFilter === 'COMPENSACOES'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Histórico de Compensações</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 text-emerald-200">
                {compensatedRecordsCount}
              </span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className={isDark ? 'bg-[#0D0F14]' : 'bg-slate-50'}>
              <tr className={`text-[10px] uppercase font-bold border-b tracking-wider ${
                isDark ? 'text-[#8E9299] border-[#1F2229]' : 'text-slate-600 border-slate-200'
              }`}>
                <th className="py-3 px-4">Data Ocorrência</th>
                <th className="py-3 px-4">Tipo & Regime</th>
                <th className="py-3 px-4 text-right">Saldo Gerado</th>
                <th className="py-3 px-4 text-center">Status Compensação</th>
                <th className="py-3 px-4 text-right">Saldo Remanescente</th>
                <th className="py-3 px-4">Rastreio Baixa / Origem (FIFO)</th>
                <th className="py-3 px-4 text-center">Comprovante</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${
              isDark ? 'divide-[#1F2229] text-[#E0E2E5]' : 'divide-slate-200 text-slate-800'
            }`}>
              {displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`py-10 text-center ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                    Nenhum lançamento corresponde ao filtro de visualização selecionado ({fifoFilter}).
                  </td>
                </tr>
              ) : (
                displayedRecords.map((rec) => {
                  const isCredito = rec.saldoCalculado > 0;
                  const isDebito = rec.saldoCalculado < 0;
                  const isExpanded = expandedRecordId === rec.id;
                  const prescription = getRecordPrescriptionInfo(rec.dataRegistro, 180);

                  return (
                    <React.Fragment key={rec.id}>
                      <tr className={`transition-colors ${
                        isExpanded 
                          ? isDark ? 'bg-[#1C1F26]' : 'bg-slate-100' 
                          : isDark ? 'hover:bg-[#1C1F26]/70' : 'hover:bg-slate-50/80'
                      }`}>
                        {/* Data Ocorrência */}
                        <td className={`py-3.5 px-4 font-bold whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          <div>{rec.data_ocorrencia || rec.dataRegistro}</div>
                          <div className={`text-[10px] font-normal ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                            {rec.diaSemanaNome}
                            {rec.eFeriado && <span className="text-amber-500 font-bold ml-1">({rec.nomeFeriado || 'Feriado'})</span>}
                          </div>
                        </td>

                        {/* Tipo de Ocorrência */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                              rec.tipoOcorrencia === 'ACABOU_BANHOU'
                                ? isDark ? 'bg-cyan-950/40 text-cyan-300 border-cyan-800/40' : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                : rec.tipoOcorrencia === 'TRABALHO'
                                ? isDark ? 'bg-blue-950/40 text-blue-300 border-blue-800/40' : 'bg-blue-50 text-blue-700 border-blue-200'
                                : rec.tipoOcorrencia === 'FALTA_INJUSTIFICADA'
                                ? isDark ? 'bg-red-950/40 text-red-300 border-red-800/40' : 'bg-red-50 text-red-700 border-red-200'
                                : rec.tipoOcorrencia === 'ATESTADO_MEDICO'
                                ? isDark ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : rec.tipoOcorrencia === 'COMPENSACAO'
                                ? isDark ? 'bg-purple-950/40 text-purple-300 border-purple-800/40' : 'bg-purple-50 text-purple-700 border-purple-200'
                                : isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {rec.tipoOcorrencia === 'ACABOU_BANHOU' ? '✨ ACABOU BANHOU' : rec.tipoOcorrencia}
                            </span>
                            {rec.multiplicador > 1 && (
                              <span className="text-[10px] font-bold text-amber-400">
                                {rec.multiplicador}x
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Saldo Gerado */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className={`font-bold text-xs ${
                            isCredito 
                              ? isDark ? 'text-green-400' : 'text-emerald-600'
                              : isDebito 
                              ? isDark ? 'text-red-400' : 'text-red-600'
                              : isDark ? 'text-[#8E9299]' : 'text-slate-500'
                          }`}>
                            {rec.saldoCalculado > 0 ? `+${rec.saldoCalculado.toFixed(1)}h` : rec.saldoCalculado < 0 ? `${rec.saldoCalculado.toFixed(1)}h` : '0.0h'}
                          </span>
                        </td>

                        {/* Status de Compensação */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                            rec.status_compensacao === 'TOTALMENTE_COMPENSADO'
                              ? isDark ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : rec.status_compensacao === 'PARCIALMENTE_COMPENSADO'
                              ? isDark ? 'bg-blue-950/40 text-blue-300 border-blue-800/40' : 'bg-blue-50 text-blue-700 border-blue-200'
                              : isDark ? 'bg-amber-950/40 text-amber-300 border-amber-800/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {rec.status_compensacao === 'TOTALMENTE_COMPENSADO' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            {rec.status_compensacao === 'PARCIALMENTE_COMPENSADO' && <Clock className="w-3 h-3 text-blue-400" />}
                            {rec.status_compensacao === 'ABERTO' && <Clock className="w-3 h-3 text-amber-400" />}
                            <span>
                              {rec.status_compensacao === 'TOTALMENTE_COMPENSADO' ? 'COMPENSADO' :
                               rec.status_compensacao === 'PARCIALMENTE_COMPENSADO' ? 'PARCIAL' : 'ABERTO'}
                            </span>
                          </span>
                        </td>

                        {/* Saldo Remanescente */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold">
                          {rec.saldoCalculado === 0 ? (
                            <span className={isDark ? 'text-[#8E9299]' : 'text-slate-400'}>—</span>
                          ) : (rec.saldo_remanescente && rec.saldo_remanescente > 0.001) ? (
                            <span className={rec.saldoCalculado > 0 ? 'text-amber-400' : 'text-red-400'}>
                              {rec.saldoCalculado > 0 ? `+${rec.saldo_remanescente.toFixed(1)}h` : `-${rec.saldo_remanescente.toFixed(1)}h`}
                            </span>
                          ) : (
                            <span className="text-emerald-500">0.0h (Quitado)</span>
                          )}
                        </td>

                        {/* Rastreio Baixa / Origem (FIFO) */}
                        <td className="py-3.5 px-4 max-w-xs">
                          {rec.liquidacoes && rec.liquidacoes.length > 0 ? (
                            <div className="space-y-1">
                              {rec.liquidacoes.slice(0, 1).map((liq, lIdx) => (
                                <div key={lIdx} className="text-[11px] flex items-center gap-1">
                                  <LinkIcon className="w-3 h-3 text-blue-400 shrink-0" />
                                  <span className={isDark ? 'text-[#E0E2E5]' : 'text-slate-700'}>
                                    {rec.saldoCalculado > 0 ? `Baixado em ${liq.data_baixa}` : `Originado em ${liq.data_origem}`}
                                  </span>
                                  <span className="text-blue-400 font-bold">({liq.horas_liquidadas}h)</span>
                                </div>
                              ))}
                              {rec.liquidacoes.length > 1 && (
                                <div className="text-[10px] text-blue-400 font-semibold cursor-pointer" onClick={() => toggleExpandRecord(rec.id)}>
                                  + {rec.liquidacoes.length - 1} outros abatimentos
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className={`text-[11px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                              {rec.saldoCalculado === 0 ? 'Abonado SPTF' : 'Aguardando compensação'}
                            </span>
                          )}
                        </td>

                        {/* Comprovante */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {rec.comprovante ? (
                            <button
                              onClick={() => onViewAttachment(rec.comprovante!, currentEmployee.nome, rec.dataRegistro)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-colors border ${
                                isDark 
                                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/50' 
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                              title="Visualizar anexo arquivado no Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Ver Anexo</span>
                            </button>
                          ) : (
                            <span className={isDark ? 'text-[#5C616A]' : 'text-slate-400'}>—</span>
                          )}
                        </td>

                        {/* Ações & Detalhes */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {onOpenEditEntry && (
                              <button
                                onClick={() => onOpenEditEntry(rec)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isDark ? 'text-amber-400 hover:bg-amber-500/10' : 'text-amber-600 hover:bg-amber-50'
                                }`}
                                title="Editar / Corrigir este lançamento"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onDeleteRecord && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Deseja realmente excluir o lançamento de ${rec.dataRegistro}?`)) {
                                    onDeleteRecord(rec.id);
                                  }
                                }}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
                                }`}
                                title="Excluir lançamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => toggleExpandRecord(rec.id)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isDark ? 'hover:bg-[#2A2E38] text-[#8E9299]' : 'hover:bg-slate-200 text-slate-500'
                              }`}
                              title="Ver detalhes de rastreabilidade"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Linha Expansível com Rastreabilidade Completa */}
                      {isExpanded && (
                        <tr className={isDark ? 'bg-[#0D0F14]/90 border-b border-[#1F2229]' : 'bg-slate-50 border-b border-slate-200'}>
                          <td colSpan={8} className="p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                              {/* Coluna 1: Dados do Lançamento */}
                              <div className={`p-3 rounded-xl border flex flex-col justify-between ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                                <div>
                                  <div className="font-bold text-blue-400 mb-1 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Dados do Lançamento</span>
                                  </div>
                                  <div className="space-y-0.5 text-[11px]">
                                    <div>ID Registro: <span className="font-bold">{rec.id}</span></div>
                                    <div>Horas Brutas: <span className="font-bold">{rec.horasBrutas}h</span></div>
                                    <div>Multiplicador SPTF: <span className="font-bold">{rec.multiplicador}x</span></div>
                                    <div>Criado Em: <span className="font-bold">{rec.criadoEm || rec.dataRegistro}</span></div>
                                    {rec.observacao && <div>Observação: <span className="italic">{rec.observacao}</span></div>}
                                  </div>
                                </div>

                                {onOpenEditEntry && (
                                  <div className="pt-2 mt-2 border-t border-[#1F2229] flex items-center gap-2">
                                    <button
                                      onClick={() => onOpenEditEntry(rec)}
                                      className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                      <Pencil className="w-3 h-3" />
                                      <span>Editar Lançamento</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Coluna 2: Histórico de Liquidações FIFO */}
                              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                                <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                                  <LinkIcon className="w-3.5 h-3.5" />
                                  <span>Vínculos de Baixa FIFO</span>
                                </div>
                                {rec.liquidacoes && rec.liquidacoes.length > 0 ? (
                                  <div className="space-y-1.5 text-[11px] max-h-32 overflow-y-auto">
                                    {rec.liquidacoes.map((l, i) => (
                                      <div key={i} className="p-1.5 rounded bg-[#0D0F14] border border-[#1F2229]">
                                        <div className="flex justify-between font-bold">
                                          <span>{rec.saldoCalculado > 0 ? `Baixa em ${l.data_baixa}` : `Origem em ${l.data_origem}`}</span>
                                          <span className="text-emerald-400">{l.horas_liquidadas}h</span>
                                        </div>
                                        <div className="text-[10px] text-[#8E9299]">Tipo: {l.tipo_baixa} • {l.observacao}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-[#8E9299]">Nenhuma liquidação registrada ainda.</p>
                                )}
                              </div>

                              {/* Coluna 3: Prescrição e Validade SPTF */}
                              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'}`}>
                                <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Validade SPTF (180 dias)</span>
                                </div>
                                <div className="space-y-0.5 text-[11px]">
                                  <div>Data Limite: <span className="font-bold">{prescription.dataLimiteCompensacao}</span></div>
                                  <div>Dias Decorridos: <span className="font-bold">{prescription.diasDecorridos} dias</span></div>
                                  <div>Dias Restantes: <span className={`font-bold ${prescription.diasRestantes < 30 ? 'text-red-400' : 'text-emerald-400'}`}>{prescription.diasRestantes} dias</span></div>
                                  <div className="pt-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      prescription.statusPrescricao === 'VENCIDO' ? 'bg-red-500/20 text-red-300' :
                                      prescription.statusPrescricao === 'CRITICO' ? 'bg-amber-500/20 text-amber-300' :
                                      'bg-emerald-500/20 text-emerald-300'
                                    }`}>
                                      Status: {prescription.statusPrescricao}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
