import React, { useState, useRef } from 'react';
import { PaystubRecord } from '../types';
import { 
  parseComaraPdfContracheques, 
  getDemoComaraPaystubs 
} from '../utils/pdfParser';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Sparkles, 
  Search, 
  ShieldCheck, 
  Trash2,
  Database,
  ArrowRight,
  HelpCircle,
  DollarSign
} from 'lucide-react';

interface ImportContrachequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBatch: (paystubs: PaystubRecord[]) => Promise<void>;
  theme?: 'dark' | 'light';
  currentUserEmail?: string;
}

export const ImportContrachequeModal: React.FC<ImportContrachequeModalProps> = ({
  isOpen,
  onClose,
  onImportBatch,
  theme = 'dark',
  currentUserEmail = 'coari.comara@gmail.com',
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [parsedPaystubs, setParsedPaystubs] = useState<PaystubRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPreviewPaystub, setSelectedPreviewPaystub] = useState<PaystubRecord | null>(null);
  const [fileName, setFileName] = useState<string>('');

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Por favor, selecione um arquivo válido em formato PDF.');
      return;
    }

    setFileName(file.name);
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setParsingProgress({ current: 0, total: 1 });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await parseComaraPdfContracheques(
        arrayBuffer, 
        currentUserEmail,
        (current, total) => {
          setParsingProgress({ current, total });
        }
      );

      if (result.paystubs.length === 0) {
        setErrorMessage('Nenhum contracheque da COMARA foi identificado no PDF fornecido. Verifique o layout ou use os dados de teste.');
      } else {
        setParsedPaystubs(result.paystubs);
        setSuccessMessage(`${result.paystubs.length} contracheques extraídos com sucesso de ${result.totalPages} páginas do PDF!`);
      }
    } catch (err: any) {
      console.error('Erro ao processar PDF:', err);
      setErrorMessage(err.message || 'Falha ao processar o arquivo PDF no navegador.');
    } finally {
      setIsLoading(false);
      setParsingProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadDemo = () => {
    const demo = getDemoComaraPaystubs();
    setFileName('Folha_Pagamento_COMARA_Julho_2026_Oficial.pdf');
    setParsedPaystubs(demo);
    setSuccessMessage(`${demo.length} contracheques de demonstração oficial (Julho/2026) carregados para conferência!`);
    setErrorMessage(null);
  };

  const handleConfirmImport = async () => {
    if (parsedPaystubs.length === 0) return;
    setIsLoading(true);
    try {
      await onImportBatch(parsedPaystubs);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao persistir contracheques no Cloud Firestore.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setParsedPaystubs([]);
    setFileName('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setSelectedPreviewPaystub(null);
  };

  const filteredPaystubs = parsedPaystubs.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.nome.toLowerCase().includes(term) ||
      p.matricula.toLowerCase().includes(term) ||
      p.cargo.toLowerCase().includes(term)
    );
  });

  const totalBruto = parsedPaystubs.reduce((acc, p) => acc + p.totalProventos, 0);
  const totalDescontos = parsedPaystubs.reduce((acc, p) => acc + p.totalDescontos, 0);
  const totalLiquido = parsedPaystubs.reduce((acc, p) => acc + p.valorLiquido, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
        isDark ? 'bg-[#15171C] border-[#1F2229] text-gray-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Cabeçalho do Modal */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Importador de Contracheques COMARA (PDF)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono">
                  Zero Storage Cost
                </span>
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Extração inteligente via Regex e pdfjs-dist direto no navegador • Gravação no Firestore
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-gray-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Mensagens de Feedback */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Área de Seleção de Arquivo e Botão Demo */}
          {parsedPaystubs.length === 0 && (
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDark 
                    ? 'border-slate-700 hover:border-blue-500/60 bg-slate-900/30 hover:bg-slate-900/60' 
                    : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept="application/pdf" 
                  className="hidden" 
                />

                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 shadow-sm">
                  {isLoading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-sm">
                    {isLoading ? 'Processando páginas do PDF...' : 'Clique para selecionar o PDF oficial da folha ou arraste aqui'}
                  </h4>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Suporta arquivos PDF concatenados com centenas de contracheques COMARA
                  </p>
                </div>

                {parsingProgress && (
                  <div className="w-full max-w-xs space-y-1.5 mt-2">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span>Lendo página {parsingProgress.current} de {parsingProgress.total}</span>
                      <span>{Math.round((parsingProgress.current / Math.max(1, parsingProgress.total)) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-200 rounded-full"
                        style={{ width: `${(parsingProgress.current / Math.max(1, parsingProgress.total)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Demonstração Rápida */}
              <div className="flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-blue-500/5 via-blue-500/10 to-transparent border-blue-500/20">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs">Testar com Dados Oficiais de Demonstração</h5>
                    <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      Carrega contracheques estruturados da COMARA (Clesio, Raimundo, João - Julho/2026).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  Carregar Demonstração
                </button>
              </div>
            </div>
          )}

          {/* Pré-visualização dos Contracheques Extraídos */}
          {parsedPaystubs.length > 0 && (
            <div className="space-y-4">
              {/* Cards de Resumo da Folha Extraída */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Servidores</span>
                  <p className="text-base font-bold font-mono text-blue-500">{parsedPaystubs.length}</p>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Bruto</span>
                  <p className="text-base font-bold font-mono text-emerald-500">R$ {totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Descontos</span>
                  <p className="text-base font-bold font-mono text-red-400">R$ {totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Líquido</span>
                  <p className="text-base font-bold font-mono text-blue-400">R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Barra de Busca e Ações */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, matrícula ou cargo..."
                    className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <button
                  onClick={handleClear}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                    isDark ? 'border-slate-700 text-gray-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Limpar / Trocar PDF</span>
                </button>
              </div>

              {/* Tabela dos Contracheques Extraídos */}
              <div className="overflow-x-auto rounded-xl border border-slate-700/40 max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`sticky top-0 ${isDark ? 'bg-slate-800 text-gray-300' : 'bg-slate-100 text-slate-700'} font-bold uppercase text-[10px] tracking-wider`}>
                    <tr>
                      <th className="py-2.5 px-3">Matrícula</th>
                      <th className="py-2.5 px-3">Servidor</th>
                      <th className="py-2.5 px-3">Cargo / Sede</th>
                      <th className="py-2.5 px-3 text-center">Competência</th>
                      <th className="py-2.5 px-3 text-right">Bruto (R$)</th>
                      <th className="py-2.5 px-3 text-right">Líquido (R$)</th>
                      <th className="py-2.5 px-3 text-center">Rubricas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredPaystubs.map((p) => (
                      <tr key={p.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                        <td className="py-2 px-3 font-mono font-bold text-blue-500">
                          {p.matricula}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          {p.nome}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {p.cargo} • <span className="font-mono text-xs">{p.sede}</span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[11px]">
                          {p.periodo || p.mesAno}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-500">
                          {p.totalProventos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-blue-400">
                          {p.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-mono">
                            {p.rubricas.length} itens
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Documentos salvos em <code>contracheques/{'{matricula}_{mesAno}'}</code></span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-gray-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={parsedPaystubs.length === 0 || isLoading}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer ${
                parsedPaystubs.length === 0 || isLoading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-600/20'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gravando no Firestore...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Importar {parsedPaystubs.length} Contracheques</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
