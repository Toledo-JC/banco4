import React, { useState, useEffect, useId } from 'react';
import { Employee, OccurrenceType, TimeRecord, Attachment, Branch } from '../types';
import { calculateSPTFBalance, formatHoursDecimal } from '../services/timebankEngine';
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
  HelpCircle
} from 'lucide-react';

export interface LaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSaveRecord: (record: TimeRecord) => void;
  preselectedMatricula?: string;
  theme?: 'dark' | 'light';
}

export const LaunchModal: React.FC<LaunchModalProps> = ({
  isOpen,
  onClose,
  employees,
  onSaveRecord,
  preselectedMatricula,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const modalId = useId();
  const todayStr = new Date().toISOString().split('T')[0];

  const [matricula, setMatricula] = useState<string>(preselectedMatricula || (employees[0]?.matricula || ''));
  const [dataRegistro, setDataRegistro] = useState<string>(todayStr);
  const [tipoOcorrencia, setTipoOcorrencia] = useState<OccurrenceType>('TRABALHO');
  const [horasBrutas, setHorasBrutas] = useState<number>(2.0);
  const [eFeriadoManual, setEFeriadoManual] = useState<boolean>(false);
  const [observacao, setObservacao] = useState<string>('');
  const [comprovante, setComprovante] = useState<Attachment | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const selectedEmployee = employees.find(e => e.matricula === matricula);

  useEffect(() => {
    if (preselectedMatricula) {
      setMatricula(preselectedMatricula);
    } else if (!matricula && employees.length > 0) {
      setMatricula(employees[0].matricula);
    }
  }, [preselectedMatricula, employees]);

  useEffect(() => {
    if (tipoOcorrencia === 'FALTA_INJUSTIFICADA') {
      setHorasBrutas(8.0);
    }
  }, [tipoOcorrencia]);

  if (!isOpen) return null;

  const sedeEfetiva: Branch = selectedEmployee?.sede_atual || selectedEmployee?.sede || 'KO';

  // Executa o cálculo com base no motor SPTF parametrizado
  const calc = calculateSPTFBalance(
    tipoOcorrencia,
    horasBrutas,
    dataRegistro,
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
      }, 600);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedEmployee) {
      setErrorMessage('Selecione um colaborador válido.');
      return;
    }

    if (tipoOcorrencia === 'TRABALHO' && horasBrutas <= 0) {
      setErrorMessage('A quantidade de horas deve ser superior a 0.');
      return;
    }

    if ((tipoOcorrencia === 'ATESTADO_MEDICO' || tipoOcorrencia === 'LICENCA') && !comprovante) {
      setErrorMessage('Obrigatório anexar o comprovante/atestado para registro de falta justificada.');
      return;
    }

    const newRecord: TimeRecord = {
      id: `rec-${Date.now()}`,
      matricula: selectedEmployee.matricula,
      employeeName: selectedEmployee.nome,
      employeeSede: sedeEfetiva,
      employeeFuncao: selectedEmployee.funcao,
      employeeAvatarUrl: selectedEmployee.url_foto_perfil || selectedEmployee.avatarUrl,
      dataRegistro,
      tipoOcorrencia,
      horasBrutas: tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : Number(horasBrutas),
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
      criadoEm: new Date().toISOString(),
    };

    onSaveRecord(newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono">
      <div 
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border animate-in fade-in zoom-in-95 ${
          isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}
        id={`launch-modal-${modalId}`}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white shadow-sm">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Novo Lançamento Diário • SPTF / CLT
              </h3>
              <p className={`text-[10px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                Parametrização de Regras: Desconto em Folha vs Banco de Horas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
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
                <option key={emp.id} value={emp.matricula}>
                  {emp.matricula} — {emp.nome} ({emp.funcao || emp.cargo} • Sede: {emp.sede})
                </option>
              ))}
            </select>
          </div>

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
                Horas da Ocorrência *
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                disabled={tipoOcorrencia === 'FALTA_INJUSTIFICADA'}
                value={tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8 : horasBrutas}
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

          {/* Tipo de Ocorrência com parametrização explícita */}
          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
              Tipo de Ocorrência (Regra Operacional) *
            </label>
            <select
              value={tipoOcorrencia}
              onChange={(e) => setTipoOcorrencia(e.target.value as OccurrenceType)}
              className={`w-full px-3 py-2 rounded-lg font-bold border focus:outline-hidden ${
                isDark 
                  ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
              }`}
            >
              <option value="TRABALHO">
                TRABALHO: Horas Extras / Sobreaviso (Crédito no Banco)
              </option>
              <option value="FALTA_INJUSTIFICADA">
                1. FALTA SEM JUSTIFICATIVA: Desconto em Folha / Contracheque (0h no Banco)
              </option>
              <option value="COMPENSACAO">
                2. DISPENSA / SAÍDA ANTECIPADA: Débito no Banco de Horas
              </option>
              <option value="ATESTADO_MEDICO">
                3. FALTA JUSTIFICADA: Atestado Médico (Neutro: 0h Banco / 0h Folha)
              </option>
              <option value="FALTA_JUSTIFICADA">
                3. FALTA JUSTIFICADA: Ordem Judicial / Gala / Luto (Neutro)
              </option>
              <option value="FERIAS">
                FÉRIAS: Período Regular Homologado (Neutro)
              </option>
              <option value="LICENCA">
                LICENÇA LEGAL / REMUNERADA: Anexo Obrigatório (Neutro)
              </option>
            </select>
          </div>

          {/* Card de Visualização do Impacto em Tempo Real */}
          <div className={`p-4 rounded-xl border space-y-2.5 ${
            isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                  Destino do Lançamento
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                  calc.destinoLancamento === 'FOLHA_PAGAMENTO'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : calc.destinoLancamento === 'BANCO_HORAS'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                }`}>
                  {calc.destinoLancamento === 'FOLHA_PAGAMENTO'
                    ? '📑 Desconto em Folha (Contracheque)'
                    : calc.destinoLancamento === 'BANCO_HORAS'
                    ? '⏱️ Banco de Horas'
                    : '⚖️ Registro Neutro (Auditoria)'}
                </span>
              </div>

              <div className="text-right">
                <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                  Impacto no Banco
                </span>
                <div className={`text-base font-black font-mono ${
                  calc.saldoCalculado > 0
                    ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                    : calc.saldoCalculado < 0
                    ? isDark ? 'text-red-400' : 'text-red-600'
                    : isDark ? 'text-[#8E9299]' : 'text-slate-500'
                }`}>
                  {calc.saldoCalculado > 0 ? `+${calc.saldoCalculado.toFixed(1)}h` : calc.saldoCalculado < 0 ? `${calc.saldoCalculado.toFixed(1)}h` : '0.0h'}
                </div>
              </div>
            </div>

            <p className={`text-[11px] pt-1.5 border-t ${
              isDark ? 'border-[#1F2229] text-blue-300/80' : 'border-slate-200 text-blue-700'
            }`}>
              💡 <strong>Regra:</strong> {calc.descricaoRegra}
            </p>
          </div>

          {/* Anexo de Comprovante */}
          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
              Comprovante / Atestado (Google Drive) {(tipoOcorrencia === 'ATESTADO_MEDICO' || tipoOcorrencia === 'LICENCA') && <span className="text-red-500">*</span>}
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
                  className="text-red-500 text-xs hover:underline"
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
              placeholder="Ex: Saída antecipada autorizada pela gerência ou motivo da falta"
              className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden font-sans ${
                isDark 
                  ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              }`}
            />
          </div>

          <div className={`pt-4 border-t flex justify-end gap-2 font-sans ${
            isDark ? 'border-[#1F2229]' : 'border-slate-200'
          }`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 font-semibold ${isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-lg shadow-md shadow-blue-500/20 cursor-pointer"
            >
              Confirmar Lançamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
