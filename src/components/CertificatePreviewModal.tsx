import React from 'react';
import { Attachment } from '../types';
import { X, ExternalLink, FileText, CheckCircle2, Calendar, HardDrive, Download } from 'lucide-react';

interface CertificatePreviewModalProps {
  attachment: Attachment | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  employeeName?: string;
  recordDate?: string;
  theme?: 'dark' | 'light';
}

export const CertificatePreviewModal: React.FC<CertificatePreviewModalProps> = ({
  attachment,
  isOpen,
  onClose,
  title = 'Comprovante / Atestado Médico Anexado',
  employeeName,
  recordDate,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  if (!isOpen || !attachment) return null;

  const isImage = attachment.fileType.startsWith('image/') || attachment.fileName.match(/\.(jpg|jpeg|png|webp)$/i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div 
        className={`relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border animate-in fade-in zoom-in-95 font-mono ${
          isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}
        id="certificate-preview-modal"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl border ${
              isDark 
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                Armazenado no Google Drive • ID: <span className="font-mono text-blue-500">{attachment.driveFileId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-[#8E9299] hover:text-white hover:bg-[#1F2229]' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Metadata banner */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border text-xs ${
            isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'
          }`}>
            {employeeName && (
              <div>
                <span className={`block text-[10px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Colaborador</span>
                <span className={`font-semibold font-sans mt-0.5 block ${isDark ? 'text-[#E0E2E5]' : 'text-slate-900'}`}>{employeeName}</span>
              </div>
            )}
            {recordDate && (
              <div>
                <span className={`block text-[10px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Data da Ocorrência</span>
                <span className={`font-semibold flex items-center gap-1 mt-0.5 ${isDark ? 'text-[#E0E2E5]' : 'text-slate-900'}`}>
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {recordDate}
                </span>
              </div>
            )}
            <div>
              <span className={`block text-[10px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>Arquivo</span>
              <span className={`font-semibold truncate block mt-0.5 ${isDark ? 'text-[#E0E2E5]' : 'text-slate-900'}`} title={attachment.fileName}>
                {attachment.fileName}
              </span>
            </div>
          </div>

          {/* Document Preview Box */}
          <div className={`border rounded-xl p-4 flex flex-col items-center justify-center min-h-[240px] max-h-[360px] overflow-auto ${
            isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
          }`}>
            {attachment.dataUrl && isImage ? (
              <img
                src={attachment.dataUrl}
                alt="Comprovante / Atestado"
                className={`max-h-[320px] max-w-full rounded-lg object-contain shadow-md border ${
                  isDark ? 'border-[#1F2229]' : 'border-slate-200'
                }`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-full max-w-md p-6 rounded-xl shadow-lg border space-y-3 ${
                isDark ? 'bg-[#15171C] border-[#1F2229] text-[#E0E2E5]' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className={`flex items-center justify-between border-b pb-2 ${
                  isDark ? 'border-[#1F2229]' : 'border-slate-200'
                }`}>
                  <div className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 font-sans ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Atestado Médico / Comprovante SPTF
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 font-bold rounded border ${
                    isDark ? 'bg-emerald-950/40 text-green-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    Homologado
                  </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                  Documento em formato PDF ou Binário arquivado com sucesso no Google Drive.
                </p>
                <div className={`p-3 rounded-lg border text-[11px] font-mono ${
                  isDark ? 'bg-[#0D0F14] border-[#1F2229] text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  ID: {attachment.driveFileId}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${
          isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className={`flex items-center gap-1 text-[11px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            <HardDrive className="w-3.5 h-3.5 text-blue-500" />
            <span>Google Drive API v3</span>
          </div>

          <div className="flex items-center gap-2">
            {attachment.driveViewUrl && (
              <a
                href={attachment.driveViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  isDark 
                    ? 'bg-[#1F2229] hover:bg-[#2A2E38] text-[#E0E2E5] border-[#1F2229]' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                <span>Abrir no Drive</span>
              </a>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
