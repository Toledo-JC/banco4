import React, { useState, useRef } from 'react';
import { Employee, TimeRecord } from '../types';
import { parseTimeRecordsCSV, generateTimeRecordsTemplateCSV, triggerFileDownload, CSVImportResult } from '../utils/csvHandler';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Clock, 
  ArrowRight,
  Info,
  Layers
} from 'lucide-react';

interface ImportTimeRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onImportRecords?: (importedRecords: TimeRecord[]) => void;
  onImportSuccess?: (importedRecords: TimeRecord[]) => void;
  theme?: 'dark' | 'light';
}

export const ImportTimeRecordsModal: React.FC<ImportTimeRecordsModalProps> = ({
  isOpen,
  onClose,
  employees,
  onImportRecords,
  onImportSuccess,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult<TimeRecord> | null>(null);
  const [previewRecords, setPreviewRecords] = useState<TimeRecord[]>([]);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csv = generateTimeRecordsTemplateCSV();
    triggerFileDownload(csv, 'modelo_importacao_lancamentos_banco_horas.csv');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessing(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const result = await parseTimeRecordsCSV(text, employees);
          setImportResult(result);
          setPreviewRecords(result.data.slice(0, 5));
        } catch (err: any) {
          setImportResult({
            success: false,
            data: [],
            errors: [err?.message || 'Erro inesperado ao processar CSV.'],
            totalRows: 0,
            importedCount: 0,
            duplicateCount: 0,
            skippedCount: 0,
          });
        }
      }
      setIsProcessing(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmImport = () => {
    if (importResult && importResult.data.length > 0) {
      if (onImportRecords) {
        onImportRecords(importResult.data);
      } else if (onImportSuccess) {
        onImportSuccess(importResult.data);
      }
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportResult(null);
    setPreviewRecords([]);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className={`relative w-full max-w-2xl rounded-2xl shadow-2xl border transition-all overflow-hidden ${
        isDark ? 'bg-[#15171C] border-[#1F2229] text-[#E0E2E5]' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-[#1F2229]' : 'border-slate-100'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#3B82F6] flex items-center justify-center border border-blue-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Importar Lançamentos do Banco de Horas
              </h3>
              <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                Importe planilhas CSV com cálculo automático de regras SPTF
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-[#8E9299] hover:text-white hover:bg-[#1F2229]' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Informação e Download do Modelo */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-start space-x-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Estrutura de Colunas Suportada:
                </span>
                <p className={`text-[11px] font-mono mt-0.5 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                  Matricula • Data (AAAA-MM-DD) • Horas • Tipo (TRABALHO/F/AT/FOLGA) • Observacao
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border shrink-0 transition-colors ${
                isDark 
                  ? 'bg-[#1F2229] hover:bg-[#2A2E38] text-blue-400 border-blue-900/40' 
                  : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200 shadow-xs'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Modelo CSV</span>
            </button>
          </div>

          {/* Área de Seleção de Arquivo */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,text/csv"
            className="hidden"
          />

          {!selectedFile ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDark 
                  ? 'border-[#2A2E38] hover:border-blue-500 bg-[#0D0F14]/50 hover:bg-[#0D0F14]' 
                  : 'border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/20'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#3B82F6] flex items-center justify-center mx-auto mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <span className={`text-sm font-bold block ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Clique para selecionar seu arquivo CSV de lançamentos
              </span>
              <p className={`text-xs mt-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                Suporta delimitador vírgula (,) ou ponto e vírgula (;)
              </p>
            </div>
          ) : (
            <div className={`p-4 rounded-xl border space-y-3 ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                  <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {selectedFile.name}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    isDark ? 'bg-[#1F2229] text-[#8E9299]' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-blue-500 hover:underline font-semibold"
                >
                  Trocar Arquivo
                </button>
              </div>

              {isProcessing && (
                <div className="py-4 text-center text-xs text-blue-400 font-mono animate-pulse">
                  Processando linhas e calculando regras SPTF...
                </div>
              )}

              {importResult && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`p-2.5 rounded-lg border ${
                      isDark ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Válidos para Importação:</span>
                      </div>
                      <span className="text-base font-bold font-mono block mt-1">
                        {importResult.importedCount} lançamentos
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-lg border ${
                      importResult.errors.length > 0
                        ? isDark ? 'bg-rose-950/20 border-rose-900/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                        : isDark ? 'bg-[#15171C] border-[#1F2229] text-[#8E9299]' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Inconsistências:</span>
                      </div>
                      <span className="text-base font-bold font-mono block mt-1">
                        {importResult.errors.length} alertas
                      </span>
                    </div>
                  </div>

                  {/* Preview dos primeiros registros */}
                  {previewRecords.length > 0 && (
                    <div className="space-y-1.5">
                      <span className={`text-[10px] uppercase font-bold tracking-wider block ${
                        isDark ? 'text-[#8E9299]' : 'text-slate-500'
                      }`}>
                        Prévia dos Registros (Primeiros 5):
                      </span>
                      <div className={`rounded-xl border overflow-hidden text-xs ${
                        isDark ? 'border-[#1F2229] bg-[#15171C]' : 'border-slate-200 bg-white'
                      }`}>
                        <div className="max-h-40 overflow-y-auto">
                          <table className="w-full text-left">
                            <thead className={`text-[10px] uppercase font-mono ${
                              isDark ? 'bg-[#1F2229] text-[#8E9299]' : 'bg-slate-100 text-slate-600'
                            }`}>
                              <tr>
                                <th className="p-2">Matrícula</th>
                                <th className="p-2">Data</th>
                                <th className="p-2">Tipo</th>
                                <th className="p-2 text-right">Horas</th>
                                <th className="p-2 text-right">Saldo SPTF</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 font-mono">
                              {previewRecords.map((r, i) => (
                                <tr key={i} className={isDark ? 'hover:bg-[#1F2229]' : 'hover:bg-slate-50'}>
                                  <td className="p-2 font-bold text-blue-400">{r.matricula}</td>
                                  <td className="p-2">{r.dataRegistro}</td>
                                  <td className="p-2 text-[11px]">{r.tipoOcorrencia}</td>
                                  <td className="p-2 text-right">{r.horasBrutas.toFixed(2)}h</td>
                                  <td className={`p-2 text-right font-bold ${
                                    r.saldoCalculado > 0 ? 'text-emerald-500' : r.saldoCalculado < 0 ? 'text-rose-500' : 'text-slate-400'
                                  }`}>
                                    {r.saldoCalculado > 0 ? `+${r.saldoCalculado.toFixed(2)}h` : `${r.saldoCalculado.toFixed(2)}h`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {importResult.errors.length > 0 && (
                    <div className={`p-3 rounded-xl border text-xs max-h-24 overflow-y-auto space-y-1 ${
                      isDark ? 'bg-rose-950/20 border-rose-900/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}>
                      <span className="font-bold block">Erros encontrados no arquivo:</span>
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="font-mono text-[11px]">• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`flex items-center justify-end gap-2.5 px-6 py-4 border-t ${
          isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-100 bg-slate-50'
        }`}>
          <button
            onClick={handleClose}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
              isDark 
                ? 'border-[#2A2E38] text-[#8E9299] hover:text-white hover:bg-[#1F2229]' 
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Cancelar
          </button>
          
          <button
            onClick={handleConfirmImport}
            disabled={!importResult || importResult.data.length === 0}
            className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
              importResult && importResult.data.length > 0
                ? 'bg-[#3B82F6] hover:bg-blue-600 shadow-blue-500/20 active:scale-98 cursor-pointer'
                : 'bg-slate-700 opacity-50 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar Importação ({importResult?.importedCount || 0})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
