import React, { useState, useEffect, useMemo, useId } from 'react';
import { Employee, TimeRecord, DispensaSptfRecord, ConstructionSite, SystemConfig } from '../types';
import { getEmployeeTotalBalance } from '../services/timebankEngine';
import { 
  X, 
  Printer, 
  FileText, 
  Clock, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Search, 
  History, 
  PlusCircle, 
  Trash2, 
  ArrowRight,
  Coffee
} from 'lucide-react';

export interface SptfDispensaModalProps {
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

/**
 * Formata data ISO (AAAA-MM-DD) para padrão brasileiro DD/MM/AAAA
 */
export function formatDateBR(isoDate?: string): string {
  if (!isoDate) return '____/____/________';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * REGRA DE CÁLCULO DAS HORAS COM TRAVA DO ALMOÇO (12:00 às 13:00)
 * - O período entre 12:00 e 13:00 é HORA DE ALMOÇO obrigatória (não remunerado e não computável).
 * - Se o horário cruzar a janela de 12:00 às 13:00, subtrai exatamente o tempo de almoço (até 60 min) do saldo total.
 * - Exemplo: Das 07:00 às 16:00 (9 horas relógio) = 8.0h a abater no Banco de Horas.
 */
export function calculateDispensaHours(start: string, end: string): {
  rawHours: number;
  lunchDeductionHours: number;
  netHours: number;
} {
  if (!start || !end) {
    return { rawHours: 0, lunchDeductionHours: 0, netHours: 0 };
  }

  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) {
    return { rawHours: 0, lunchDeductionHours: 0, netHours: 0 };
  }

  const startMinutes = h1 * 60 + m1;
  const endMinutes = h2 * 60 + m2;
  const diffMinutes = endMinutes - startMinutes;
  if (diffMinutes <= 0) {
    return { rawHours: 0, lunchDeductionHours: 0, netHours: 0 };
  }

  const rawHours = Number((diffMinutes / 60).toFixed(2));

  // Janela obrigatória de almoço: 12:00 (720 min) às 13:00 (780 min)
  const lunchStart = 12 * 60; // 720
  const lunchEnd = 13 * 60;   // 780

  const overlapStart = Math.max(startMinutes, lunchStart);
  const overlapEnd = Math.min(endMinutes, lunchEnd);
  const lunchOverlapMinutes = Math.max(0, overlapEnd - overlapStart);
  const lunchDeductionHours = Number((lunchOverlapMinutes / 60).toFixed(2));

  const netMinutes = Math.max(0, diffMinutes - lunchOverlapMinutes);
  const netHours = Number((netMinutes / 60).toFixed(2));

  return {
    rawHours,
    lunchDeductionHours,
    netHours
  };
}

export function formatHoursToHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m > 0 ? String(m).padStart(2, '0') + 'min' : '00'}`;
}

// ============================================================================
// COMPONENTE DE UMA VIA INDIVIDUAL DA DISPENSA DE SPTF (LAYOUT DA PLANILHA)
// ============================================================================
export interface DispensaViaProps {
  dispensa: DispensaSptfRecord;
  viaIndex?: 1 | 2;
}

export const DispensaVia: React.FC<DispensaViaProps> = ({ dispensa }) => {
  const dataFmt = formatDateBR(dispensa.data);
  const periodoStr = `${dataFmt} (${dispensa.horarioInicio}) A ${dataFmt} (${dispensa.horarioFim})`;
  const saramStr = dispensa.saram || dispensa.matricula || '';
  const secaoStr = dispensa.secaoCanteiro || 'DECO-KO';
  const motivoStr = dispensa.motivo || 'COMPENSAÇÃO BANCO DE HORAS';

  return (
    <div className="dispensa-via w-full border-2 border-black bg-white text-black font-sans leading-tight">
      {/* ------------------------------------------------------------- */}
      {/* CABEÇALHO: Célula Esquerda (Logo) | Célula Direita (Título)    */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-12 border-b-2 border-black">
        {/* Célula Esquerda: Logo da COMARA (fundo transparente) */}
        <div className="col-span-3 sm:col-span-3 flex items-center justify-center p-2.5 border-r-2 border-black bg-white">
          <img 
            src="/comara-logo.png" 
            alt="Logo COMARA" 
            className="h-14 sm:h-16 w-auto max-h-16 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Célula Direita: Título centralizado em negrito e caixa alta */}
        <div className="col-span-9 sm:col-span-9 flex items-center justify-center p-3 bg-white text-center">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-black">
            DISPENSA DE SPTF
          </h1>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* LINHA 1: NOME: [Nome do Colaborador]                           */}
      {/* ------------------------------------------------------------- */}
      <div className="border-b-2 border-black p-2.5 px-3 flex items-center gap-2 bg-white">
        <span className="font-black text-xs sm:text-sm uppercase tracking-wide shrink-0 text-black">
          NOME:
        </span>
        <span className="font-bold text-xs sm:text-sm uppercase text-black truncate">
          {dispensa.nome}
        </span>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* LINHA 2: SARAM: [Matrícula] | SEÇÃO: [Seção/Canteiro]          */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-12 border-b-2 border-black divide-x-2 divide-black bg-white">
        <div className="col-span-6 p-2.5 px-3 flex items-center gap-2">
          <span className="font-black text-xs sm:text-sm uppercase tracking-wide shrink-0 text-black">
            SARAM:
          </span>
          <span className="font-bold text-xs sm:text-sm font-mono text-black">
            {saramStr}
          </span>
        </div>
        <div className="col-span-6 p-2.5 px-3 flex items-center gap-2">
          <span className="font-black text-xs sm:text-sm uppercase tracking-wide shrink-0 text-black">
            SEÇÃO:
          </span>
          <span className="font-bold text-xs sm:text-sm uppercase text-black">
            {secaoStr}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* LINHA 3: PERÍODO: [...] | MOTIVO: [...]                        */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-12 border-b-2 border-black divide-x-2 divide-black bg-white">
        <div className="col-span-7 sm:col-span-6 p-2.5 px-3 flex items-center gap-2">
          <span className="font-black text-xs sm:text-sm uppercase tracking-wide shrink-0 text-black">
            PERÍODO:
          </span>
          <span className="font-bold text-[11px] sm:text-xs text-black">
            {periodoStr}
          </span>
        </div>
        <div className="col-span-5 sm:col-span-6 p-2.5 px-3 flex items-center gap-2">
          <span className="font-black text-xs sm:text-sm uppercase tracking-wide shrink-0 text-black">
            MOTIVO:
          </span>
          <span className="font-bold text-xs sm:text-sm uppercase text-black truncate">
            {motivoStr}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RODAPÉ: RECEBIMENTO E ASSINATURAS (4 BLOCOS)                   */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-4 divide-x-2 divide-black min-h-[96px] bg-white">
        {/* Bloco 1: RECEBIDO POR: */}
        <div className="p-2 sm:p-2.5 flex flex-col justify-between text-[11px]">
          <span className="font-black uppercase text-[11px] sm:text-xs block text-black leading-tight">
            RECEBIDO POR:
          </span>
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1 font-bold text-[10px] sm:text-[11px] text-black">
              <span>DATA:</span>
              <span className="font-mono tracking-wider font-normal">___/___/______</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-[10px] sm:text-[11px] text-black">
              <span>HORA:</span>
              <span className="font-mono tracking-wider font-normal">___:___</span>
            </div>
          </div>
        </div>

        {/* Bloco 2: Assinatura SPTF */}
        <div className="p-2 sm:p-2.5 flex flex-col justify-between text-center">
          <div className="h-10 sm:h-12 flex items-end justify-center">
            <div className="w-4/5 border-b border-black"></div>
          </div>
          <div className="pt-1">
            <span className="font-black uppercase text-[11px] sm:text-xs block text-black">
              SPTF
            </span>
          </div>
        </div>

        {/* Bloco 3: Assinatura CHEFE IMEDIATO */}
        <div className="p-2 sm:p-2.5 flex flex-col justify-between text-center">
          <div className="h-10 sm:h-12 flex items-end justify-center">
            <div className="w-4/5 border-b border-black"></div>
          </div>
          <div className="pt-1">
            <span className="font-black uppercase text-[11px] sm:text-xs block text-black">
              CHEFE IMEDIATO
            </span>
          </div>
        </div>

        {/* Bloco 4: Assinatura SERVIDOR */}
        <div className="p-2 sm:p-2.5 flex flex-col justify-between text-center">
          <div className="h-10 sm:h-12 flex items-end justify-center">
            <div className="w-4/5 border-b border-black"></div>
          </div>
          <div className="pt-1">
            <span className="font-black uppercase text-[11px] sm:text-xs block text-black">
              SERVIDOR
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TEMPLATE DE IMPRESSÃO A4 (2 VIAS SEPARADAS POR OBS: -----)
// ============================================================================
export interface DispensaPrintTemplateProps {
  dispensa: DispensaSptfRecord;
}

export const DispensaPrintTemplate: React.FC<DispensaPrintTemplateProps> = ({ dispensa }) => {
  return (
    <div id="sptf-print-container" className="w-full bg-white text-black p-2 sm:p-4 print:p-0">
      {/* 1ª VIA */}
      <DispensaVia dispensa={dispensa} viaIndex={1} />

      {/* LINHA PONTILHADA DE CORTE CONFORME MODELO */}
      <div className="text-center font-mono text-xs sm:text-sm font-bold text-black select-none my-4 sm:my-5 tracking-widest leading-none">
        Obs: ----------------------------------------------------
      </div>

      {/* 2ª VIA (DUPLICAÇÃO IDÊNTICA NA MESMA PÁGINA A4) */}
      <DispensaVia dispensa={dispensa} viaIndex={2} />
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL DO MODAL DE DISPENSA SPTF
// ============================================================================
export const SptfDispensaModal: React.FC<SptfDispensaModalProps> = ({
  isOpen,
  onClose,
  employees,
  records,
  timeRecords,
  dispensas = [],
  onSaveDispensa,
  onDeleteDispensa,
  preselectedMatricula,
  preselectedDate,
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
  const [horarioInicio, setHorarioInicio] = useState<string>('07:00');
  const [horarioFim, setHorarioFim] = useState<string>('16:00');
  const [motivo, setMotivo] = useState<string>('COMPENSAÇÃO BANCO DE HORAS');
  const [observacoes, setObservacoes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Guia ativa para impressão
  const [activePrintDispensa, setActivePrintDispensa] = useState<DispensaSptfRecord | null>(null);

  // Inicialização ao abrir
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
  }, [isOpen, preselectedMatricula, preselectedDate, employees]);

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

  // Cálculo das Horas com regra obrigatória da Trava do Almoço (12:00 às 13:00)
  const hoursCalculation = useMemo(() => {
    return calculateDispensaHours(horarioInicio, horarioFim);
  }, [horarioInicio, horarioFim]);

  const calculatedHours = hoursCalculation.netHours;

  // Saldo do colaborador
  const employeeCurrentBalance = useMemo(() => {
    if (!selectedEmployee) return 0;
    return getEmployeeTotalBalance(selectedEmployee.matricula, employees, allRecords).saldoTotalHoras;
  }, [selectedEmployee, employees, allRecords]);

  const forecastedBalance = useMemo(() => {
    return employeeCurrentBalance - calculatedHours;
  }, [employeeCurrentBalance, calculatedHours]);

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
      setFeedbackMsg({ type: 'error', text: 'O horário selecionado deve resultar em horas válidas a abater (maior que zero após dedução do almoço).' });
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
        observacao: `Dispensa SPTF Nº ${numeroGuia} (${horarioInicio} às ${horarioFim}) - Motivo: ${motivo}${hoursCalculation.lunchDeductionHours > 0 ? ' [Trava de Almoço 12h-13h: -' + hoursCalculation.lunchDeductionHours + 'h]' : ''}${observacoes ? ' - ' + observacoes : ''}`,
        criadoEm: now.toISOString(),
        criadoPorEmail: currentUserEmail,
        atualizadoEm: now.toISOString(),
      };

      await onSaveDispensa(dispensaRecord, timeRecord);

      setActivePrintDispensa(dispensaRecord);
      setActiveTab('print');
      setFeedbackMsg({ type: 'success', text: `Guia ${numeroGuia} emitida e debitada com sucesso (-${calculatedHours.toFixed(1)}h no Banco de Horas)!` });
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

  // Objeto temporário para visualização em tempo real caso não haja guia gravada ainda
  const previewDispensa: DispensaSptfRecord = useMemo(() => {
    if (activePrintDispensa) return activePrintDispensa;
    return {
      id: 'preview',
      numeroGuia: 'SPTF-2026/___',
      matricula: selectedEmployee?.matricula || '______',
      nome: selectedEmployee?.nome || 'COLABORADOR NÃO SELECIONADO',
      saram: selectedEmployee?.matricula || '______',
      secaoCanteiro: secaoCanteiro || 'DECO-KO',
      data: dataDispensa,
      horarioInicio,
      horarioFim,
      totalHoras: calculatedHours,
      motivo: motivo || 'COMPENSAÇÃO BANCO DE HORAS',
      observacoes: observacoes.trim(),
      emitidoPorNome: currentUserName,
      emitidoPorEmail: currentUserEmail,
      emitidoEm: new Date().toISOString(),
      status: 'EMITIDA',
    };
  }, [activePrintDispensa, selectedEmployee, secaoCanteiro, dataDispensa, horarioInicio, horarioFim, calculatedHours, motivo, observacoes, currentUserName, currentUserEmail]);

  return (
    <div 
      id={`modal-${modalId}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible"
      role="dialog"
      aria-modal="true"
    >
      {/* ============================================================== */}
      {/* ESTILOS DE IMPRESSÃO (@MEDIA PRINT) ULTRA-PRECISOS PARA A4     */}
      {/* ============================================================== */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
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
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .dispensa-via {
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
                  Dispensa de SPTF
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  2 Vias A4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Modelo oficial de folha de dispensa com trava de almoço (12h-13h) e débito automático
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
              {/* Seleção do Colaborador e Seção */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    1. Colaborador / Matrícula (SARAM) <span className="text-rose-400">*</span>
                  </label>
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
                        SARAM: <span className="font-mono text-slate-300 font-bold">{selectedEmployee.matricula}</span> • Seção: <span className="font-semibold text-slate-300">{secaoCanteiro}</span>
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

              {/* Destaque do Cálculo Automático com a Trava do Almoço (12h-13h) */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-blue-900/30 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <h5 className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      Cálculo de Horas com Trava de Almoço (12:00 às 13:00)
                    </h5>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    <span>Período bruto: <strong>{hoursCalculation.rawHours.toFixed(1)}h</strong> ({horarioInicio} às {horarioFim})</span>
                    {hoursCalculation.lunchDeductionHours > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        <Coffee className="w-3 h-3" />
                        Almoço 12h-13h deduzido: -{hoursCalculation.lunchDeductionHours.toFixed(1)}h
                      </span>
                    )}
                  </p>
                </div>

                <div className="text-right self-end sm:self-center">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-blue-300">
                    {calculatedHours.toFixed(1)}h
                  </span>
                  <span className="text-[11px] text-slate-400 block font-medium">
                    ({formatHoursToHoursMinutes(calculatedHours)} a deduzir no Banco)
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
                      Emitir & Imprimir (2 Vias A4)
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
                    Emita novas guias de dispensa na aba "Nova Guia" para registrar abatimentos no Banco de Horas.
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
                            Data: <span className="font-medium text-slate-300">{formatDateBR(d.data)}</span> • Período: <span className="font-medium text-slate-300">{d.horarioInicio} às {d.horarioFim}</span> • Débito: <span className="font-bold text-rose-400">-{d.totalHoras.toFixed(1)}h</span>
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
                          title="Visualizar e Imprimir Guia Oficial em 2 Vias"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Imprimir 2 Vias
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
          {activeTab === 'print' && (
            <div className="space-y-4">
              {/* Barra de Ações de Impressão (Oculta na folha impressa) */}
              <div className="no-print p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Printer className="w-4 h-4 text-emerald-400" />
                    Layout de Impressão Oficial Fiel à Planilha (2 Vias na Folha A4)
                  </h4>
                  <p className="text-xs text-slate-400">
                    O documento é impresso em formato de tabela idêntico à planilha oficial com duas vias verticais e linha pontilhada.
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
                    Imprimir Agora (2 Vias A4)
                  </button>
                </div>
              </div>

              {/* CONTAINER DA FOLHA DE IMPRESSÃO A4 (2 VIAS IDÊNTICAS) */}
              <div className="p-2 sm:p-6 bg-slate-100 rounded-xl border border-slate-300 shadow-inner overflow-x-auto print:p-0 print:bg-white print:border-none print:shadow-none">
                <DispensaPrintTemplate dispensa={previewDispensa} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
