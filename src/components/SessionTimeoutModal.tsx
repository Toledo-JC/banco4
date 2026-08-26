import React, { useEffect } from 'react';
import { Clock, ShieldAlert, LogOut, RefreshCw, AlertTriangle } from 'lucide-react';
import { ComaraLogo } from './ComaraLogo';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  warnSeconds?: number;
  profileLabel?: string;
  isDark?: boolean;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  remainingSeconds,
  warnSeconds = 60,
  profileLabel,
  isDark = true,
  onStayLoggedIn,
  onLogoutNow,
}) => {
  if (!isOpen) return null;

  // Percentual restante para a barra de progresso
  const progressPercent = Math.min(100, Math.max(0, (remainingSeconds / warnSeconds) * 100));
  const isUrgent = remainingSeconds <= 15;

  return (
    <div 
      id="session-timeout-backdrop"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
    >
      <div 
        id="session-timeout-card"
        className={`w-full max-w-md p-6 sm:p-7 rounded-3xl border shadow-2xl relative overflow-hidden transition-all transform animate-in zoom-in-95 duration-200 ${
          isDark 
            ? 'bg-[#15171C] border-[#2A2E39] text-[#E0E2E5]' 
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Faixa superior de urgência animada */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-700/30 overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${
              isUrgent ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Cabeçalho do Modal */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          
          {/* Brasão / Ícone de Alerta */}
          <div className="relative">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all ${
              isUrgent 
                ? 'bg-red-500/15 border-red-500/40 text-red-500 shadow-lg shadow-red-500/20 animate-bounce' 
                : 'bg-amber-500/15 border-amber-500/40 text-amber-500 shadow-lg shadow-amber-500/10'
            }`}>
              {isUrgent ? (
                <AlertTriangle className="w-8 h-8" />
              ) : (
                <Clock className="w-8 h-8 animate-pulse" />
              )}
            </div>

            {/* Badge flutuante de segurança */}
            <div className="absolute -bottom-1.5 -right-1.5 bg-blue-600 text-white rounded-full p-1 border-2 border-[#15171C] shadow-xs">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Título Oficial */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1.5">
              <span>COMARA • Segurança da Informação</span>
            </div>
            <h2 
              id="session-timeout-title" 
              className={`text-xl sm:text-2xl font-black tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Sua sessão vai expirar!
            </h2>
          </div>

          {/* Mensagem e Contador */}
          <div className="space-y-3 w-full">
            <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-[#9DA3AE]' : 'text-slate-600'}`}>
              Você ficou inativo por um tempo. Por motivos de segurança, sua sessão será encerrada em{' '}
              <span className={`font-mono font-black text-base px-1.5 py-0.5 rounded-md ${
                isUrgent 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {remainingSeconds} {remainingSeconds === 1 ? 'segundo' : 'segundos'}
              </span>.
            </p>

            {/* Visualizador de Contagem Regressiva */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5 text-left">
                <Clock className={`w-4 h-4 ${isUrgent ? 'text-red-400 animate-spin' : 'text-amber-400'}`} />
                <div>
                  <div className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Tempo Restante para Logoff
                  </div>
                  {profileLabel && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      {profileLabel}
                    </div>
                  )}
                </div>
              </div>
              <div className={`text-2xl font-black font-mono tracking-tight ${
                isUrgent ? 'text-red-500 animate-pulse' : 'text-amber-500'
              }`}>
                00:{remainingSeconds.toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          {/* Sair Agora */}
          <button
            id="btn-session-logout-now"
            type="button"
            onClick={onLogoutNow}
            className={`w-full sm:w-auto sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
              isDark 
                ? 'bg-[#1F2229] hover:bg-[#2A2E39] text-[#E0E2E5] hover:text-white border-[#2A2E39]' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            } active:scale-95`}
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>Sair Agora</span>
          </button>

          {/* Continuar Logado */}
          <button
            id="btn-session-stay-logged-in"
            type="button"
            onClick={onStayLoggedIn}
            autoFocus
            className="w-full sm:w-auto sm:flex-[1.5] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Continuar Logado</span>
          </button>
        </div>
      </div>
    </div>
  );
};
