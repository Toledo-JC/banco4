import React, { useState, useEffect, useMemo, useId } from 'react';
import { Employee, OccurrenceType, TimeRecord, Attachment, Branch } from '../types';
import { calculateSPTFBalance, formatHoursDecimal } from '../utils/calculations';
import { 
  X, 
  Calendar, 
  Clock, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Info,
  Building2,
  UserCheck,
  CalendarDays,
  Sparkles,
  Pencil,
  Trash2,
  Palmtree,
  ArrowRight
} from 'lucide-react';

interface DailyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSaveRecord: (record: TimeRecord) => void;
  onSaveBatch?: (records: TimeRecord[]) => void | Promise<void>;
  onDeleteRecord?: (id: string) => void | Promise<void>;
  initialRecord?: TimeRecord | null;
  preselectedMatricula?: string;
  preselectedDate?: string;
  theme?: 'dark' | 'light';
}

function addDaysToIso(dateIso: string, days: number): string {
  if (!dateIso) return new Date().toISOString().split('T')[0];
  const d = new Date(dateIso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getDatesRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const start = new Date(startIso + 'T12:00:00');
  const end = new Date(endIso + 'T12:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [startIso];
  const curr = new Date(start);
  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const DailyEntryModal: React.FC<DailyEntryModalProps> = ({
  isOpen,
  onClose,
  employees,
  onSaveRecord,
  onSaveBatch,
  onDeleteRecord,
  initialRecord,
  preselectedMatricula,
  preselectedDate,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const modalId = useId();
  const todayStr = new Date().toISOString().split('T')[0];

  const isEditing = Boolean(initialRecord && initialRecord.id);

  const [matricula, setMatricula] = useState<string>('');
  const [dataRegistro, setDataRegistro] = useState<string>(todayStr);
  const [dataInicioFerias, setDataInicioFerias] = useState<string>(todayStr);
  const [dataFimFerias, setDataFimFerias] = useState<string>(addDaysToIso(todayStr, 29));
  const [tipoOcorrencia, setTipoOcorrencia] = useState<OccurrenceType>('TRABALHO');
  const [horasBrutas, setHorasBrutas] = useState<number>(2.0);
  const [eFeriadoManual, setEFeriadoManual] = useState<boolean>(false);
  const [observacao, setObservacao] = useState<string>('');
  const [comprovante, setComprovante] = useState<Attachment | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialize or reset form values when opening/changing props
  useEffect(() => {
    if (!isOpen) return;

    if (initialRecord) {
      setMatricula(initialRecord.matricula || '');
      
      // Normalizar data
      let recDate = initialRecord.dataRegistro || initialRecord.data_ocorrencia || todayStr;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(recDate)) {
        const [d, m, y] = recDate.split('/');
        recDate = `${y}-${m}-${d}`;
      } else if (recDate.includes('T')) {
        recDate = recDate.split('T')[0];
      }
      setDataRegistro(recDate);
      setDataInicioFerias(recDate);
      setDataFimFerias(addDaysToIso(recDate, 29));
      
      setTipoOcorrencia(initialRecord.tipoOcorrencia || 'TRABALHO');
      setHorasBrutas(Number(initialRecord.horasBrutas) || 2.0);
      setEFeriadoManual(Boolean(initialRecord.eFeriado));
      setObservacao(initialRecord.observacao || '');
      setComprovante(initialRecord.comprovante || null);
    } else {
      setMatricula(preselectedMatricula || (employees[0]?.matricula || ''));
      let initialDate = preselectedDate || todayStr;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(initialDate)) {
        const [d, m, y] = initialDate.split('/');
        initialDate = `${y}-${m}-${d}`;
      } else if (initialDate.includes('T')) {
        initialDate = initialDate.split('T')[0];
      }
      setDataRegistro(initialDate);
      setDataInicioFerias(initialDate);
      setDataFimFerias(addDaysToIso(initialDate, 29));
      setTipoOcorrencia('TRABALHO');
      setHorasBrutas(2.0);
      setEFeriadoManual(false);
      setObservacao('');
      setComprovante(null);
    }
    setErrorMessage('');
    setIsDeleting(false);
    setIsSaving(false);
  }, [isOpen, initialRecord, preselectedMatricula, preselectedDate, employees, todayStr]);

  const selectedEmployee = employees.find(e => e.matricula === matricula);

  useEffect(() => {
    if (tipoOcorrencia === 'FALTA_INJUSTIFICADA' || tipoOcorrencia === 'ATESTADO_MEDICO' || tipoOcorrencia === 'FERIAS' || tipoOcorrencia === 'LICENCA') {
      setHorasBrutas(8.0);
    }
  }, [tipoOcorrencia]);

  // Cálculo de dias de férias
  const vacationDaysCount = useMemo(() => {
    if (tipoOcorrencia !== 'FERIAS') return 1;
    if (!dataInicioFerias || !dataFimFerias) return 0;
    const start = new Date(dataInicioFerias + 'T12:00:00');
    const end = new Date(dataFimFerias + 'T12:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    const diff = end.getTime() - start.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [tipoOcorrencia, dataInicioFerias, dataFimFerias]);

  const handleSetVacationDuration = (days: number) => {
    if (!dataInicioFerias) return;
    const newEnd = addDaysToIso(dataInicioFerias, days - 1);
    setDataFimFerias(newEnd);
  };

  if (!isOpen) return null;

  const sedeEfetiva: Branch = selectedEmployee?.sede_atual || selectedEmployee?.sede || initialRecord?.employeeSede || 'KO';

  const calc = calculateSPTFBalance(
    tipoOcorrencia,
    tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : horasBrutas,
    tipoOcorrencia === 'FERIAS' ? dataInicioFerias : dataRegistro,
    eFeriadoManual,
    sedeEfetiva
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      setTimeout(() => {
        const fakeDriveId = '1' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const newAttachment: Attachment = {
          id: `att-${Date.now()}`,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          dataUrl: event.target?.result as string,
          driveFileId: fakeDriveId,
          driveViewUrl: `https://drive.google.com/file/d/${fakeDriveId}/view`,
          uploadTimestamp: new Date().toISOString(),
        };
        setComprovante(newAttachment);
        setIsUploading(false);
      }, 400);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    if (!initialRecord?.id || !onDeleteRecord) return;
    
    if (window.confirm(`Tem certeza que deseja excluir o lançamento de ${initialRecord.horasBrutas}h de ${initialRecord.employeeName || selectedEmployee?.nome || 'colaborador'} em ${dataRegistro}?`)) {
      try {
        setIsDeleting(true);
        await onDeleteRecord(initialRecord.id);
        onClose();
      } catch (err: any) {
        console.error('Erro ao excluir lançamento:', err);
        setErrorMessage(err?.message || 'Falha ao excluir registro.');
        setIsDeleting(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedEmployee && !matricula) {
      setErrorMessage('Selecione um colaborador válido.');
      return;
    }

    if (tipoOcorrencia === 'TRABALHO' && horasBrutas <= 0) {
      setErrorMessage('A quantidade de horas deve ser superior a 0.');
      return;
    }

    if (tipoOcorrencia === 'ATESTADO_MEDICO' && !comprovante) {
      setErrorMessage('Obrigatório anexar o Atestado Médico comprobatório para homologação CLT.');
      return;
    }

    const effectiveEmpName = selectedEmployee?.nome || initialRecord?.employeeName || 'Colaborador';
    const effectiveEmpFuncao = selectedEmployee?.funcao || initialRecord?.employeeFuncao || 'Operacional';
    const effectiveEmpAvatar = selectedEmployee?.url_foto_perfil || selectedEmployee?.avatarUrl || initialRecord?.employeeAvatarUrl;

    // FLUXO ESPECIAL: FÉRIAS (Inserção em todo o período selecionado)
    if (tipoOcorrencia === 'FERIAS') {
      if (!dataInicioFerias || !dataFimFerias) {
        setErrorMessage('Informe a Data de Início e a Data de Término do período de férias.');
        return;
      }

      if (vacationDaysCount <= 0) {
        setErrorMessage('A Data de Término das férias deve ser igual ou posterior à Data de Início.');
        return;
      }

      try {
        setIsSaving(true);
        const vacationDates = getDatesRange(dataInicioFerias, dataFimFerias);
        const vacationRecords: TimeRecord[] = [];
        const nowIso = new Date().toISOString();
        const obsFormatted = observacao.trim() || `FÉRIAS (Período: ${formatDateBR(dataInicioFerias)} a ${formatDateBR(dataFimFerias)})`;

        for (let i = 0; i < vacationDates.length; i++) {
          const dateStr = vacationDates[i];
          const dayCalc = calculateSPTFBalance('FERIAS', 8.0, dateStr, false, sedeEfetiva);
          const recId = isEditing && i === 0 && initialRecord?.id
            ? initialRecord.id 
            : `rec-ferias-${matricula}-${dateStr}-${Date.now()}-${i}`;

          const vRec: TimeRecord = {
            id: recId,
            matricula: selectedEmployee?.matricula || matricula,
            employeeName: effectiveEmpName,
            employeeSede: sedeEfetiva,
            employeeFuncao: effectiveEmpFuncao,
            employeeAvatarUrl: effectiveEmpAvatar,
            dataRegistro: dateStr,
            data_ocorrencia: dateStr,
            tipoOcorrencia: 'FERIAS',
            horasBrutas: 8.0,
            multiplicador: dayCalc.multiplicador,
            saldoCalculado: 0,
            horasDescontoFolha: 0,
            destinoLancamento: 'BANCO_HORAS',
            saldo_remanescente: 0,
            status_compensacao: 'TOTALMENTE_COMPENSADO',
            eFeriado: dayCalc.eFeriado,
            nomeFeriado: dayCalc.nomeFeriado,
            diaSemana: dayCalc.diaSemana,
            diaSemanaNome: dayCalc.diaSemanaNome,
            observacao: obsFormatted,
            comprovante: comprovante || undefined,
            criadoEm: initialRecord?.criadoEm || nowIso,
            atualizadoEm: nowIso,
          };
          vacationRecords.push(vRec);
        }

        if (typeof onSaveBatch === 'function') {
          await onSaveBatch(vacationRecords);
        } else if (typeof onSaveRecord === 'function') {
          for (const rec of vacationRecords) {
            onSaveRecord(rec);
          }
        }

        if (typeof onClose === 'function') {
          onClose();
        }
      } catch (err: any) {
        console.error('Erro ao salvar período de férias:', err);
        setErrorMessage(err?.message || 'Falha ao salvar lançamentos de férias.');
        setIsSaving(false);
      }
      return;
    }

    // FLUXO REGULAR (Dia Único)
    const effectiveId = initialRecord?.id || `rec-${Date.now()}`;

    const recordToSave: TimeRecord = {
      ...initialRecord,
      id: effectiveId,
      matricula: selectedEmployee?.matricula || matricula,
      employeeName: effectiveEmpName,
      employeeSede: sedeEfetiva,
      employeeFuncao: effectiveEmpFuncao,
      employeeAvatarUrl: effectiveEmpAvatar,
      dataRegistro,
      tipoOcorrencia,
      horasBrutas: tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : (tipoOcorrencia === 'ACABOU_BANHOU' ? 0 : Number(horasBrutas)),
      multiplicador: calc.multiplicador,
      saldoCalculado: calc.saldoCalculado,
      horasDescontoFolha: calc.horasDescontoFolha,
      destinoLancamento: calc.destinoLancamento,
      data_ocorrencia: dataRegistro,
      saldo_remanescente: calc.saldoCalculado !== 0 ? Math.abs(calc.saldoCalculado) : 0,
      status_compensacao: calc.saldoCalculado === 0 ? 'TOTALMENTE_COMPENSADO' : 'ABERTO',
      eFeriado: calc.eFeriado,
      nomeFeriado: calc.nomeFeriado,
      diaSemana: calc.diaSemana,
      diaSemanaNome: calc.diaSemanaNome,
      observacao: observacao.trim() || undefined,
      comprovante: comprovante || undefined,
      criadoEm: initialRecord?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    if (typeof onSaveRecord === 'function') {
      try {
        onSaveRecord(recordToSave);
      } catch (err) {
        console.warn('Erro ao disparar onSaveRecord:', err);
      }
    }
    if (typeof onClose === 'function') {
      try {
        onClose();
      } catch (err) {
        console.warn('Erro ao disparar onClose:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono">
      <div 
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border animate-in fade-in zoom-in-95 ${
          isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}
        id={`daily-entry-modal-${modalId}`}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm ${
              tipoOcorrencia === 'FERIAS'
                ? 'bg-emerald-600'
                : isEditing 
                ? 'bg-amber-600' 
                : 'bg-[#3B82F6]'
            }`}>
              {tipoOcorrencia === 'FERIAS' ? (
                <Palmtree className="w-4 h-4" />
              ) : isEditing ? (
                <Pencil className="w-4 h-4" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className={`font-bold text-sm font-sans flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <span>
                  {tipoOcorrencia === 'FERIAS'
                    ? 'Lançamento de Férias • Período Completo'
                    : isEditing 
                    ? 'Editar Lançamento • Banco de Horas' 
                    : 'Novo Lançamento • Diário CLT'}
                </span>
                {tipoOcorrencia === 'FERIAS' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                    {vacationDaysCount} {vacationDaysCount === 1 ? 'dia' : 'dias'}
                  </span>
                ) : isEditing && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                    Edição
                  </span>
                )}
              </h3>
              <p className={`text-[10px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                {tipoOcorrencia === 'FERIAS'
                  ? 'Geração automática de FÉRIAS em todos os dias do período selecionado'
                  : isEditing 
                  ? `ID: ${initialRecord?.id} • Regras e Cálculos SPTF` 
                  : 'Motor de Cálculo Automatizado CLT'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-[#8E9299] hover:text-white hover:bg-[#1F2229]' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Colaborador */}
          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
              Colaborador *
            </label>
            <select
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg font-bold border focus:outline-hidden ${
                isDark 
                  ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              }`}
              required
            >
              {employees.map((emp) => (
                <option key={emp.id || emp.matricula} value={emp.matricula}>
                  {emp.matricula} — {emp.nome} ({emp.funcao} • Sede: {emp.sede_atual || emp.sede})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Ocorrência */}
          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
              Tipo de Ocorrência (Regra Operacional) *
            </label>
            <select
              value={tipoOcorrencia}
              onChange={(e) => {
                const newType = e.target.value as OccurrenceType;
                setTipoOcorrencia(newType);
                if (newType === 'ACABOU_BANHOU') {
                  setHorasBrutas(0);
                  if (!observacao) {
                    setObservacao('Acabou Banhou - Missão cumprida, liberação sem débito em banco de horas.');
                  }
                } else if (newType === 'FERIAS') {
                  if (!observacao) {
                    setObservacao('FÉRIAS');
                  }
                }
              }}
              className={`w-full px-3 py-2 rounded-lg font-bold border focus:outline-hidden ${
                tipoOcorrencia === 'FERIAS'
                  ? isDark
                    ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300 focus:border-emerald-400'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900 focus:border-emerald-500'
                  : isDark 
                  ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
              }`}
            >
              <option value="FERIAS">🏖️ FÉRIAS: Período Completo (Inserir em todo o período)</option>
              <option value="TRABALHO">TRABALHO: Horas Extras / Sobreaviso (Crédito no Banco)</option>
              <option value="ACABOU_BANHOU">✨ ACABOU BANHOU: Missão Cumprida (Sem Débito / Não Desconta)</option>
              <option value="FALTA_INJUSTIFICADA">1. FALTA SEM JUSTIFICATIVA: Desconto em Folha / Contracheque (0h no Banco)</option>
              <option value="COMPENSACAO">2. DISPENSA / SAÍDA ANTECIPADA: Débito no Banco de Horas</option>
              <option value="ATESTADO_MEDICO">3. FALTA JUSTIFICADA: Atestado Médico (Neutro: 0h Banco / 0h Folha)</option>
              <option value="FALTA_JUSTIFICADA">3. FALTA JUSTIFICADA: Ordem Judicial / Gala / Luto (Neutro)</option>
              <option value="LICENCA">LICENÇA LEGAL / REMUNERADA (Neutro)</option>
            </select>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO DINÂMICA: DOIS CALENDÁRIOS PARA FÉRIAS OU CALENDÁRIO ÚNICO PARA OUTROS */}
          {/* ========================================================================= */}
          {tipoOcorrencia === 'FERIAS' ? (
            <div className={`p-4 rounded-xl border space-y-3.5 ${
              isDark ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50/70 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-400">
                  <Palmtree className="w-4 h-4" />
                  <span>Período de Férias (Dois Calendários)</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  vacationDaysCount > 0 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {vacationDaysCount > 0 ? `${vacationDaysCount} Dias de Férias` : 'Período Inválido'}
                </span>
              </div>

              {/* 2 Calendários: Data Inicial e Data Final */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 text-[11px] ${isDark ? 'text-emerald-300/80' : 'text-emerald-900'}`}>
                    1. Data de Início das Férias *
                  </label>
                  <input
                    type="date"
                    value={dataInicioFerias}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setDataInicioFerias(newStart);
                      // Se a data final ficou anterior, ajusta para manter 30 dias ou mesmo dia
                      if (dataFimFerias && newStart > dataFimFerias) {
                        setDataFimFerias(addDaysToIso(newStart, 29));
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg border font-mono text-xs focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0D0F14] border-emerald-700/50 text-white focus:border-emerald-400' 
                        : 'bg-white border-emerald-300 text-slate-900 focus:border-emerald-500'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 text-[11px] ${isDark ? 'text-emerald-300/80' : 'text-emerald-900'}`}>
                    2. Data de Término das Férias *
                  </label>
                  <input
                    type="date"
                    value={dataFimFerias}
                    min={dataInicioFerias}
                    onChange={(e) => setDataFimFerias(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border font-mono text-xs focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0D0F14] border-emerald-700/50 text-white focus:border-emerald-400' 
                        : 'bg-white border-emerald-300 text-slate-900 focus:border-emerald-500'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Atalhos Rápidos de Duração */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className={`text-[10px] font-semibold mr-1 ${isDark ? 'text-emerald-400/70' : 'text-emerald-800'}`}>
                  Duração Rápida:
                </span>
                {[10, 15, 20, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleSetVacationDuration(days)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer ${
                      vacationDaysCount === days
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : isDark
                        ? 'bg-[#0D0F14] border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/40'
                        : 'bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    {days} dias
                  </button>
                ))}
              </div>

              {/* Resumo do Preenchimento Automático */}
              <div className={`p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-2 ${
                isDark ? 'bg-[#0D0F14] border-emerald-900/50 text-emerald-200' : 'bg-white/80 border-emerald-200 text-emerald-900'
              }`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {vacationDaysCount} dias de FÉRIAS serão inseridos:
                  </span>{' '}
                  de <span className="underline font-bold">{formatDateBR(dataInicioFerias)}</span> até <span className="underline font-bold">{formatDateBR(dataFimFerias)}</span>.
                  <p className="opacity-80 text-[10px] mt-0.5">
                    Todos os dias do intervalo receberão o status <strong>FÉRIAS</strong> no extrato e calendário (Regime CLT Neutro: 0h banco / 0h desconto em folha).
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                  Data da Ocorrência *
                </label>
                <input
                  type="date"
                  value={dataRegistro}
                  onChange={(e) => setDataRegistro(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                  Horas Brutas *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  disabled={tipoOcorrencia === 'FALTA_INJUSTIFICADA' || tipoOcorrencia === 'ACABOU_BANHOU'}
                  value={tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8 : (tipoOcorrencia === 'ACABOU_BANHOU' ? 0 : horasBrutas)}
                  onChange={(e) => setHorasBrutas(parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 rounded-lg font-bold border focus:outline-hidden ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500 disabled:opacity-50' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 disabled:opacity-50'
                  }`}
                  required
                />
              </div>
            </div>
          )}

          {/* Real-time SPTF Calculator Card (quando não for férias) */}
          {tipoOcorrencia !== 'FERIAS' && (
            <div className={`p-4 rounded-xl border space-y-2 ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                    Destino & Regime
                  </span>
                  <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {calc.diaSemanaNome}{calc.eFeriado ? ` (${calc.nomeFeriado || 'Feriado'})` : ''} • <span className="text-blue-500 font-bold">{calc.multiplicador}x</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                    {calc.destinoLancamento === 'FOLHA_PAGAMENTO' ? 'Desconto Folha' : 'Saldo Banco'}
                  </span>
                  <div className={`text-base font-black ${
                    calc.destinoLancamento === 'FOLHA_PAGAMENTO'
                      ? 'text-amber-500'
                      : calc.saldoCalculado > 0
                      ? isDark ? 'text-green-400' : 'text-emerald-600'
                      : calc.saldoCalculado < 0
                      ? isDark ? 'text-red-400' : 'text-red-600'
                      : isDark ? 'text-[#8E9299]' : 'text-slate-500'
                  }`}>
                    {calc.destinoLancamento === 'FOLHA_PAGAMENTO'
                      ? `-${calc.horasDescontoFolha.toFixed(1)}h (Folha)`
                      : calc.saldoCalculado > 0 
                      ? `+${calc.saldoCalculado.toFixed(1)}h` 
                      : calc.saldoCalculado < 0 
                      ? `${calc.saldoCalculado.toFixed(1)}h` 
                      : '0.0h'}
                  </div>
                </div>
              </div>
              
              <p className={`text-[11px] pt-1 border-t ${isDark ? 'border-[#1F2229] text-[#8E9299]' : 'border-slate-200 text-slate-500'}`}>
                💡 {calc.descricaoRegra}
              </p>
            </div>
          )}

          {/* Anexo de Comprovante */}
          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
              Comprovante / Portaria / Atestado (Google Drive) {tipoOcorrencia === 'ATESTADO_MEDICO' && <span className="text-red-500">*</span>}
            </label>
            <div className="flex items-center gap-2">
              <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                isDark 
                  ? 'bg-[#0D0F14] border-[#1F2229] text-[#8E9299] hover:text-[#E0E2E5] hover:bg-[#15171C]' 
                  : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}>
                <UploadCloud className="w-4 h-4 text-blue-500" />
                <span>{comprovante ? comprovante.fileName : 'Selecionar Documento / Imagem'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
              {comprovante && (
                <button
                  type="button"
                  onClick={() => setComprovante(null)}
                  className="text-red-500 text-xs hover:underline cursor-pointer"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
              Observação / Justificativa
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder={tipoOcorrencia === 'FERIAS' ? 'Ex: Portaria nº 123/COMARA - Férias Regulamentares' : 'Ex: Parada emergencial no gerador de Coari'}
              className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden font-sans ${
                isDark 
                  ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              }`}
            />
          </div>

          <div className={`pt-4 border-t flex items-center justify-between gap-2 font-sans ${
            isDark ? 'border-[#1F2229]' : 'border-slate-200'
          }`}>
            {isEditing && onDeleteRecord ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-2 rounded-lg font-bold text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Excluir este lançamento permanentemente"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Excluir Lançamento'}</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 font-semibold text-xs rounded-lg transition-colors cursor-pointer ${
                  isDark ? 'text-[#8E9299] hover:text-white hover:bg-[#1F2229]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`px-5 py-2 font-bold text-xs text-white rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  tipoOcorrencia === 'FERIAS'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                    : isEditing 
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20' 
                    : 'bg-[#3B82F6] hover:bg-blue-600 shadow-blue-500/20'
                }`}
              >
                {isSaving ? (
                  <span>Salvando {tipoOcorrencia === 'FERIAS' ? `(${vacationDaysCount} dias)...` : '...'}</span>
                ) : tipoOcorrencia === 'FERIAS' ? (
                  <>
                    <Palmtree className="w-3.5 h-3.5" />
                    <span>Lançar Férias ({vacationDaysCount} {vacationDaysCount === 1 ? 'dia' : 'dias'})</span>
                  </>
                ) : isEditing ? (
                  <>
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Salvar Alterações</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar Lançamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

