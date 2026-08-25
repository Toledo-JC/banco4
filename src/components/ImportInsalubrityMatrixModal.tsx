import React, { useState, useRef, useEffect } from 'react';
import { Employee, Branch, InsalubrityRecord, ConstructionSite } from '../types';
import { 
  parseInsalubrityMatrixCSV, 
  InsalubrityMatrixImportResult, 
  SAMPLE_INSALUBRITY_MATRIX_CSV,
  generateInsalubrityMatrixTemplateCSV,
  triggerFileDownload 
} from '../utils/csvHandler';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles, 
  Users, 
  Calendar, 
  HardHat, 
  Building2, 
  ClipboardCheck, 
  FileText, 
  ArrowRight,
  Search,
  Check,
  Zap,
  Info
} from 'lucide-react';

interface ImportInsalubrityMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  constructionSites?: ConstructionSite[];
  onImportInsalubrityBatch: (
    records: InsalubrityRecord[], 
    newEmployees?: Employee[], 
    targetMonth?: number, 
    targetYear?: number
  ) => Promise<void>;
  theme?: 'dark' | 'light';
  currentUserEmail?: string;
}

export const ImportInsalubrityMatrixModal: React.FC<ImportInsalubrityMatrixModalProps> = ({
  isOpen,
  onClose,
  employees,
  constructionSites = [],
  onImportInsalubrityBatch,
  theme = 'dark',
  currentUserEmail = 'coari.comara@gmail.com',
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputTab, setInputTab] = useState<'FILE' | 'PASTE' | 'SAMPLE'>('FILE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedContent, setPastedContent] = useState<string>('');
  const [targetSede, setTargetSede] = useState<Branch>('KO');
  const [autoRegisterNewEmployees, setAutoRegisterNewEmployees] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<InsalubrityMatrixImportResult | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');

  // Limpa estados ao fechar ou reabrir
  useEffect(() => {
    if (isOpen) {
      // Se não tem resultado, não faz nada
    } else {
      setSelectedFile(null);
      setPastedContent('');
      setImportResult(null);
      setIsProcessing(false);
      setIsImporting(false);
      setPreviewSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProcessRawText = async (text: string) => {
    if (!text.trim()) {
      setImportResult(null);
      return;
    }
    setIsProcessing(true);
    try {
      const result = await parseInsalubrityMatrixCSV(
        text,
        employees,
        targetSede,
        currentUserEmail
      );
      setImportResult(result);
    } catch (err: any) {
      setImportResult({
        success: false,
        records: [],
        workers: [],
        newEmployees: [],
        uniqueActivities: [],
        detectedPeriod: { year: 2026, month: 7, monthName: 'Agosto', totalDays: 0 },
        totalRecords: 0,
        errors: [err?.message || 'Erro ao processar conteúdo da planilha.'],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = (evt.target?.result as string) || '';
      await handleProcessRawText(text);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleLoadSample = async () => {
    setInputTab('SAMPLE');
    setPastedContent(SAMPLE_INSALUBRITY_MATRIX_CSV);
    await handleProcessRawText(SAMPLE_INSALUBRITY_MATRIX_CSV);
  };

  const handleDownloadTemplate = () => {
    const csv = generateInsalubrityMatrixTemplateCSV();
    triggerFileDownload(csv, 'modelo_folha_campo_insalubridades_comara.csv');
  };

  const handleConfirmImport = async () => {
    if (!importResult || importResult.records.length === 0) return;

    setIsImporting(true);
    try {
      const empsToSave = autoRegisterNewEmployees ? importResult.newEmployees : [];
      await onImportInsalubrityBatch(
        importResult.records,
        empsToSave,
        importResult.detectedPeriod.month,
        importResult.detectedPeriod.year
      );
      onClose();
    } catch (error) {
      console.error('Erro ao importar lote:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // Filtragem de prévia de colaboradores
  const filteredPreviewWorkers = importResult?.workers.filter(w => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return (
      w.nome.toLowerCase().includes(q) ||
      w.matricula.toLowerCase().includes(q) ||
      w.cargo.toLowerCase().includes(q) ||
      w.sampleActivities.some(a => a.toLowerCase().includes(q))
    );
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className={`relative w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] ${
        isDark ? 'bg-[#12141A] border-[#222631] text-[#E0E2E5]' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* ------------------------------------------------------------- */}
        {/* 1. CABEÇALHO DO MODAL                                         */}
        {/* ------------------------------------------------------------- */}
        <div className={`p-5 sm:p-6 border-b flex items-start sm:items-center justify-between gap-4 ${
          isDark ? 'bg-[#151821] border-[#1F232E]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-red-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-500">
                  COMARA • MÓDULO DE INSALUBRIDADE SIMPLES
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-100 text-amber-800'
                }`}>
                  Importação Matriz de Campo (.CSV)
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">
                Importar Folha Quinzenal / Mensal de Serviços
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
              isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-gray-400 hover:text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-500'
            }`}
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 2. CORPO DO MODAL (ROLÁVEL)                                    */}
        {/* ------------------------------------------------------------- */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          
          {/* Seletor de Abas de Entrada */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={`p-1 rounded-xl border inline-flex items-center gap-1 ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setInputTab('FILE')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  inputTab === 'FILE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Arquivo .CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setInputTab('PASTE')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  inputTab === 'PASTE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Colar Texto / Planilha</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSample}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  inputTab === 'SAMPLE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-700 hover:text-amber-800'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Planilha Enviada (Agosto/2026)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-[#E0E2E5]' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="Baixar Modelo de Planilha de Campo"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Baixar Modelo CSV</span>
            </button>
          </div>

          {/* Configurações de Destino e Cadastro */}
          <div className={`p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4 ${
            isDark ? 'bg-[#0E1015] border-[#1C202B]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <label className="block text-xs font-bold mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Sede / Canteiro de Destino</span>
              </label>
              <select
                value={targetSede}
                onChange={(e) => {
                  const newSede = e.target.value as Branch;
                  setTargetSede(newSede);
                  if (pastedContent) {
                    handleProcessRawText(pastedContent);
                  }
                }}
                className={`w-full px-3 py-2 rounded-lg border text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                  isDark ? 'bg-[#151821] border-[#2A2E38] text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="KO">KO • Canteiro de Obras Coari</option>
                <option value="BE">BE • Destacamento Belém</option>
                <option value="MN">MN • Destacamento Manaus</option>
                <option value="SP">SP • Destacamento São Paulo</option>
                <option value="RJ">RJ • Destacamento Rio de Janeiro</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={autoRegisterNewEmployees}
                  onChange={(e) => setAutoRegisterNewEmployees(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300"
                />
                <div>
                  <span className="font-bold">Cadastrar novos colaboradores automaticamente</span>
                  <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Inclui na lista de colaboradores caso ainda não existam no sistema
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Área de Entrada: Upload vs Colar */}
          {inputTab === 'FILE' && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDark 
                  ? 'border-[#2A2E38] hover:border-amber-500/50 bg-[#0E1015] hover:bg-[#151821]' 
                  : 'border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold">
                {selectedFile ? selectedFile.name : 'Clique para selecionar ou arraste o arquivo .CSV aqui'}
              </p>
              <p className={`text-xs mt-1 max-w-md ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Suporta o formato oficial de Folha de Campo com datas nas colunas e colaboradores nas linhas (separado por vírgula ou ponto e vírgula).
              </p>
            </div>
          )}

          {(inputTab === 'PASTE' || inputTab === 'SAMPLE') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Conteúdo da Planilha (CSV / Texto)</span>
                </label>
                <span className={`text-[11px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  {pastedContent.split('\n').length} linhas
                </span>
              </div>
              <textarea
                rows={6}
                value={pastedContent}
                onChange={(e) => {
                  const val = e.target.value;
                  setPastedContent(val);
                  handleProcessRawText(val);
                }}
                placeholder="Cole o conteúdo da planilha aqui (ex: Item, Descrição,,1/8/2026, 2/8/2026...)"
                className={`w-full p-3 rounded-xl border text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500 leading-relaxed custom-scrollbar ${
                  isDark ? 'bg-[#0E1015] border-[#222631] text-gray-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* 3. RESULTADOS & PRÉ-VISUALIZAÇÃO INTELIGENTE                   */}
          {/* ------------------------------------------------------------- */}
          {isProcessing && (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
              <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Analisando matriz de campo e mapeando apontamentos...</p>
            </div>
          )}

          {importResult && !isProcessing && (
            <div className="space-y-4 pt-2">
              
              {/* Badges de Resumo Analítico */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-[#151821] border-[#1F232E]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Colaboradores
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-lg font-bold">{importResult.workers.length}</span>
                  </div>
                  <span className="text-[10px] text-blue-400 font-medium">
                    {importResult.newEmployees.length} novos detectados
                  </span>
                </div>

                <div className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-[#151821] border-[#1F232E]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Apontamentos
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <HardHat className="w-4 h-4 text-amber-400" />
                    <span className="text-lg font-bold">{importResult.totalRecords}</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-medium">
                    Dias com atividades
                  </span>
                </div>

                <div className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-[#151821] border-[#1F232E]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Mês / Período
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="text-base font-bold truncate">
                      {importResult.detectedPeriod.monthName}/{importResult.detectedPeriod.year}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    {importResult.detectedPeriod.totalDays} dias analisados
                  </span>
                </div>

                <div className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-[#151821] border-[#1F232E]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Atividades Únicas
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-lg font-bold">{importResult.uniqueActivities.length}</span>
                  </div>
                  <span className="text-[10px] text-purple-400 font-medium">
                    Tipos de serviço
                  </span>
                </div>
              </div>

              {/* Tags de Atividades Detectadas */}
              {importResult.uniqueActivities.length > 0 && (
                <div className={`p-3 rounded-xl border ${
                  isDark ? 'bg-[#0E1015] border-[#1C202B]' : 'bg-amber-50/40 border-amber-200/60'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                      Atividades Detectadas na Folha:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {importResult.uniqueActivities.map(act => (
                      <span
                        key={act.name}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-medium flex items-center gap-1.5 ${
                          isDark ? 'bg-[#1A1D26] text-gray-200 border border-[#2B3040]' : 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <strong>{act.name}</strong>
                        <span className={`text-[10px] px-1 rounded ${isDark ? 'bg-black/40 text-amber-400' : 'bg-slate-100 text-slate-600'}`}>
                          {act.count}x
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabela de Pré-visualização com Busca */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Colaboradores e Lançamentos Mapeados</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {filteredPreviewWorkers.length} de {importResult.workers.length}
                    </span>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome, cargo ou atividade..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs focus:outline-hidden focus:ring-1 focus:ring-amber-500 ${
                        isDark ? 'bg-[#0E1015] border-[#222631] text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className={`rounded-xl border overflow-hidden max-h-56 overflow-y-auto custom-scrollbar ${
                  isDark ? 'border-[#1F232E] bg-[#0E1015]' : 'border-slate-200 bg-white'
                }`}>
                  <table className="w-full text-left text-xs">
                    <thead className={`sticky top-0 text-[11px] uppercase font-mono font-bold tracking-wider border-b ${
                      isDark ? 'bg-[#151821] border-[#1F232E] text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <tr>
                        <th className="py-2 px-3 w-12 text-center">Nº</th>
                        <th className="py-2 px-3">Colaborador</th>
                        <th className="py-2 px-3">Cargo / Função</th>
                        <th className="py-2 px-3 text-center">Dias c/ Atividade</th>
                        <th className="py-2 px-3">Amostra de Atividades</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F232E]/60 dark:divide-[#1F232E]/60">
                      {filteredPreviewWorkers.map((w, idx) => (
                        <tr 
                          key={w.matricula + idx}
                          className={`hover:bg-amber-500/5 transition-colors ${
                            w.activityDaysCount === 0 ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center font-mono text-[11px] text-gray-500">
                            {w.itemNum}
                          </td>
                          <td className="py-2 px-3 font-semibold">
                            <div>{w.nome}</div>
                            <div className="text-[10px] font-mono text-gray-500">{w.matricula}</div>
                          </td>
                          <td className="py-2 px-3 text-gray-400">
                            {w.cargo}
                          </td>
                          <td className="py-2 px-3 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                              w.activityDaysCount > 0 
                                ? isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-800'
                                : isDark ? 'bg-gray-800 text-gray-500' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {w.activityDaysCount} dias
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {w.sampleActivities.slice(0, 3).map((act, aIdx) => (
                                <span 
                                  key={aIdx} 
                                  className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20 dark:bg-white/10 text-gray-300"
                                >
                                  {act}
                                </span>
                              ))}
                              {w.sampleActivities.length > 3 && (
                                <span className="text-[10px] text-gray-500">
                                  +{w.sampleActivities.length - 3}
                                </span>
                              )}
                              {w.sampleActivities.length === 0 && (
                                <span className="text-[10px] text-gray-500 italic">Sem lançamentos</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {w.isNewEmployee ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                Novo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                Cadastrado
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Erros / Avisos */}
              {importResult.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Avisos do processamento:</span>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ------------------------------------------------------------- */}
        {/* 4. RODAPÉ DE AÇÕES                                            */}
        {/* ------------------------------------------------------------- */}
        <div className={`p-4 sm:p-5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isDark ? 'bg-[#151821] border-[#1F232E]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {importResult 
                ? `${importResult.totalRecords} apontamentos prontos para sincronização no banco central.`
                : 'Selecione ou cole o arquivo para iniciar o mapeamento.'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-gray-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!importResult || importResult.totalRecords === 0 || isImporting}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-600/20 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isImporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Gravando no Banco de Dados...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Confirmar e Importar {importResult ? `(${importResult.totalRecords})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
