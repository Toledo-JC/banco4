import React, { useState } from 'react';
import { 
  signInWithPopup, 
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { authService } from '../services/authService';
import { AuthSession } from '../types';
import { ComaraLogo } from './ComaraLogo';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  UserCheck, 
  ArrowRight, 
  Database, 
  Cloud, 
  Sparkles, 
  Layers, 
  ChevronRight 
} from 'lucide-react';

interface LoginViewProps {
  onOpenSelfService: () => void;
  onLoginSuccess?: (session: AuthSession) => void;
  theme?: 'dark' | 'light';
}

export const LoginView: React.FC<LoginViewProps> = ({
  onOpenSelfService,
  onLoginSuccess,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [authMode, setAuthMode] = useState<'LOGIN' | 'CADASTRO' | 'RESET'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Login com Google Workspace
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Erro no Google Sign-In:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setErrorMessage('A janela de login do Google foi fechada antes da conclusão.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setErrorMessage('Operação cancelada.');
      } else {
        setErrorMessage(`Falha na autenticação Google: ${error.message || error.code}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Login com Email e Senha 100% via Firestore
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (authMode === 'LOGIN') {
        const res = await authService.verifyAdminLogin(cleanEmail, password);
        if (res.success && res.session) {
          setSuccessMessage(res.message);
          if (onLoginSuccess) {
            onLoginSuccess(res.session);
          } else {
            window.location.reload();
          }
        } else {
          setErrorMessage(res.message);
        }
      } else if (authMode === 'CADASTRO') {
        if (password.length < 6) {
          setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
          setIsLoading(false);
          return;
        }
        const res = await authService.createAdminAccount(cleanEmail, password, nome, 'Gestor RH');
        if (res.success && res.session) {
          setSuccessMessage('Conta corporativa de gestão criada no Cloud Firestore! Entrando...');
          setTimeout(() => {
            if (onLoginSuccess) {
              onLoginSuccess(res.session!);
            } else {
              window.location.reload();
            }
          }, 1000);
        } else {
          setErrorMessage(res.message);
        }
      } else if (authMode === 'RESET') {
        setSuccessMessage(`Solicitação registrada para ${cleanEmail}. Por questões de segurança CLT/LGPD, acerte sua senha através da Validação Tripla no Portal do Colaborador ou solicite o reset ao Gestor Master.`);
      }
    } catch (error: any) {
      console.error('Erro na autenticação por e-mail:', error);
      setErrorMessage(error.message || 'Falha ao autenticar credenciais no Firestore.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between font-mono transition-colors ${
      isDark ? 'bg-[#0D0F14] text-[#E0E2E5]' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Brand Bar */}
      <header className={`p-4 sm:px-8 border-b flex items-center justify-between ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-3">
          <ComaraLogo size="md" />
          <div>
            <div className="flex items-center space-x-2">
              <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                BANCO DE HORAS SPTF / COMARA
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                PRODUÇÃO CLOUD
              </span>
            </div>
            <p className={`text-[10px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              Sedes Operacionais: KO (Coari) • BE (Belém) • MN (Manaus)
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
            <Cloud className="w-3.5 h-3.5" />
            <span>Google Cloud Firestore Backend</span>
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-md space-y-6">
          
          {/* Card Container */}
          <div className={`p-6 sm:p-8 rounded-2xl border shadow-2xl relative overflow-hidden ${
            isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200 shadow-slate-200/50'
          }`}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"></div>

            {/* Header Text with Official COMARA Shield */}
            <div className="text-center space-y-2 mb-6">
              <div className="flex justify-center mb-2">
                <ComaraLogo size="xl" />
              </div>
              <h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {authMode === 'LOGIN' && 'Acesso ao Painel RH'}
                {authMode === 'CADASTRO' && 'Novo Cadastro de Administrador'}
                {authMode === 'RESET' && 'Recuperar Senha de Acesso'}
              </h1>
              <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                {authMode === 'LOGIN' && 'COMARA • Comissão de Aeroportos da Região Amazônica'}
                {authMode === 'CADASTRO' && 'Crie sua credencial para gestão das bases KO, BE e MN'}
                {authMode === 'RESET' && 'Informe seu e-mail para receber instruções de recuperação'}
              </p>
            </div>

            {/* Alerts */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Opção 1: Google Sign-In */}
            {authMode === 'LOGIN' && (
              <div className="space-y-4 mb-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className={`w-full py-3.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-md active:scale-98 cursor-pointer ${
                    isDark 
                      ? 'bg-[#1F2229] hover:bg-[#2A2E38] text-white border-[#2A2E38]' 
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-400 shadow-xs'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Entrar com Google Workspace</span>
                </button>

                <div className="relative flex items-center justify-center">
                  <div className={`border-t w-full ${isDark ? 'border-[#1F2229]' : 'border-slate-200'}`}></div>
                  <span className={`px-3 text-[10px] uppercase font-bold tracking-wider absolute ${
                    isDark ? 'bg-[#15171C] text-[#8E9299]' : 'bg-white text-slate-400'
                  }`}>
                    OU COM E-MAIL CORPORATIVO
                  </span>
                </div>
              </div>
            )}

            {/* Opção 2: E-mail e Senha */}
            <form onSubmit={handleEmailAuth} className="space-y-4 text-xs">
              {authMode === 'CADASTRO' && (
                <div>
                  <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                    NOME COMPLETO DO GESTOR
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Nome do Gestor de RH"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className={`w-full rounded-xl px-4 py-3 text-xs font-sans outline-hidden border transition-colors ${
                        isDark
                          ? 'bg-[#0D0F14] border-[#1F2229] focus:border-blue-500 text-white placeholder:text-gray-600'
                          : 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                    <UserCheck className={`absolute right-3.5 top-3.5 w-4 h-4 ${isDark ? 'text-[#8E9299]' : 'text-slate-400'}`} />
                  </div>
                </div>
              )}

              <div>
                <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                  E-MAIL CORPORATIVO
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="seu.email@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 text-xs font-mono outline-hidden border transition-colors ${
                      isDark
                        ? 'bg-[#0D0F14] border-[#1F2229] focus:border-blue-500 text-white placeholder:text-gray-600'
                        : 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                  <Mail className={`absolute right-3.5 top-3.5 w-4 h-4 ${isDark ? 'text-[#8E9299]' : 'text-slate-400'}`} />
                </div>
              </div>

              {authMode !== 'RESET' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`font-semibold ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                      SENHA DE ACESSO
                    </label>
                    {authMode === 'LOGIN' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('RESET');
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Esqueceu?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full rounded-xl px-4 py-3 text-xs font-mono outline-hidden border transition-colors ${
                        isDark
                          ? 'bg-[#0D0F14] border-[#1F2229] focus:border-blue-500 text-white placeholder:text-gray-600'
                          : 'bg-slate-50 border-slate-300 focus:border-blue-500 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                    <KeyRound className={`absolute right-3.5 top-3.5 w-4 h-4 ${isDark ? 'text-[#8E9299]' : 'text-slate-400'}`} />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Processando autenticação...</span>
                ) : authMode === 'LOGIN' ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Entrar no Sistema</span>
                  </>
                ) : authMode === 'CADASTRO' ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Cadastrar Conta de Gestão</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Enviar Link de Recuperação</span>
                  </>
                )}
              </button>
            </form>

            {/* Alternar Modos */}
            <div className={`mt-5 pt-4 border-t text-center text-xs ${isDark ? 'border-[#1F2229]' : 'border-slate-100'}`}>
              {authMode === 'LOGIN' ? (
                <p className={isDark ? 'text-[#8E9299]' : 'text-slate-500'}>
                  Primeiro acesso de gestão?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('CADASTRO');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-blue-400 font-bold hover:underline"
                  >
                    Criar conta corporativa
                  </button>
                </p>
              ) : (
                <p className={isDark ? 'text-[#8E9299]' : 'text-slate-500'}>
                  Já possui conta cadastrada?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('LOGIN');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-blue-400 font-bold hover:underline"
                  >
                    Voltar para o Login
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* Atalho para o Portal do Colaborador (Autoatendimento) */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isDark ? 'bg-[#15171C]/80 border-[#1F2229] hover:border-blue-500/40' : 'bg-white border-slate-200 hover:border-blue-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Portal do Colaborador
                  </h3>
                  <p className={`text-[10px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                    Consulta simplificada e individual por Matrícula
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenSelfService}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm active:scale-98 cursor-pointer"
              >
                <span>Acessar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Compliance Footer Note */}
          <div className="text-center text-[10px] text-[#8E9299] flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Autenticação Centralizada Google Firebase • RBAC Rigoroso CLT</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className={`p-4 border-t text-center text-[10px] ${
        isDark ? 'bg-[#15171C] border-[#1F2229] text-[#8E9299]' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        Sistema de Banco de Horas CLT v2.0 • Backend Cloud Firestore Centralizado • Sedes KO / BE / MN
      </footer>
    </div>
  );
};
