import React, { useState } from 'react';
import { 
  Building2, 
  Key, 
  Lock, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  X, 
  ArrowRight, 
  Sparkles 
} from 'lucide-react';
import { authService } from '../services/authService';
import { ComaraLogo } from './ComaraLogo';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn: () => Promise<void>;
  onEmailSignIn: (email: string, pass: string) => Promise<void>;
  isDark: boolean;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onGoogleSignIn,
  onEmailSignIn,
  isDark,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!emailInput.trim()) {
      setErrorMessage('Informe seu e-mail corporativo.');
      return;
    }
    if (!passwordInput.trim()) {
      setErrorMessage('Digite sua senha.');
      return;
    }

    setIsLoading(true);
    try {
      await onEmailSignIn(emailInput.trim(), passwordInput);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Falha ao autenticar com e-mail e senha corporativa.');
      await authService.logAccess(
        'ADMIN_AUTH',
        emailInput.trim(),
        'TENTATIVA_INVALIDA',
        false,
        `Falha no login administrativo RH: ${err?.message || 'Credenciais inválidas'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await onGoogleSignIn();
      await authService.logAccess(
        'ADMIN_AUTH',
        'Google Workspace User',
        'LOGIN_GESTAO_RH',
        true,
        'Login administrativo RH via Google Workspace autenticado'
      );
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao conectar via Google Workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div className={`w-full max-w-md p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 relative animate-in zoom-in-95 ${
        isDark ? 'bg-[#15171C] border-[#2A2E38] text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-5 right-5 p-1.5 rounded-xl border transition-colors cursor-pointer ${
            isDark ? 'bg-[#1F2229] border-[#2E333F] text-gray-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
          }`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header with Official COMARA Shield */}
        <div className="text-center space-y-2 pt-2">
          <div className="flex justify-center mb-1">
            <ComaraLogo size="lg" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Acesso à Gestão & RH • COMARA
          </h2>
          <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            Área restrita a Gestores de RH, Auditores e Super Administradores
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Opção 1: Google Workspace */}
        <div>
          <button
            type="button"
            onClick={handleGoogleSubmit}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xs ${
              isDark 
                ? 'bg-[#1F2229] hover:bg-[#2A2E38] border-[#2F3440] text-white' 
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            } disabled:opacity-50`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Entrar com Google Workspace</span>
          </button>
        </div>

        {/* Divisor */}
        <div className="relative flex items-center justify-center">
          <div className={`border-t w-full ${isDark ? 'border-[#2A2E38]' : 'border-slate-200'}`} />
          <span className={`absolute px-3 text-[11px] font-bold uppercase tracking-wider ${
            isDark ? 'bg-[#15171C] text-[#8E9299]' : 'bg-white text-slate-400'
          }`}>
            ou e-mail corporativo
          </span>
        </div>

        {/* Opção 2: E-mail e Senha Corporativa */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider">
              E-mail Administrativo
            </label>
            <div className="relative">
              <Mail className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="gestor.rh@comara.aer.mil.br"
                required
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm border outline-none ${
                  isDark ? 'bg-[#0D0F14] border-[#2A2E38] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                }`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider">
              Senha de Gestão
            </label>
            <div className="relative">
              <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm border outline-none ${
                  isDark ? 'bg-[#0D0F14] border-[#2A2E38] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Autenticando...' : 'Entrar no Painel RH'}
          </button>
        </form>

        {/* Footer info */}
        <div className={`pt-2 text-center text-[11px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
          <span>Super Administrador padrão: <strong>coari.comara@gmail.com</strong></span>
        </div>

      </div>
    </div>
  );
};
