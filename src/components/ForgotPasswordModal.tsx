import React, { useState } from 'react';
import { Employee } from '../types';
import { authService } from '../services/authService';
import { 
  KeyRound, 
  Mail, 
  Calendar, 
  UserCheck, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ShieldCheck,
  Building2
} from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  isDark?: boolean;
  initialMatricula?: string;
  onSuccess?: (matricula: string, newPass: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  employees,
  isDark = true,
  initialMatricula = '',
  onSuccess,
}) => {
  const [step, setStep] = useState<'VALIDATE' | 'NEW_PASSWORD' | 'SUCCESS'>('VALIDATE');
  
  // Step 1 Form Fields
  const [matricula, setMatricula] = useState(initialMatricula);
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');

  // Step 2 Form Fields
  const [verifiedEmployee, setVerifiedEmployee] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // ETAPA 1: VALIDAÇÃO CADASTRAL SIMULTÂNEA (MATRÍCULA + EMAIL + NASCIMENTO)
  // -------------------------------------------------------------
  const handleValidateIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const cleanMat = matricula.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanDate = dataNascimento.trim();

    if (!cleanMat) {
      setErrorMessage('Por favor, informe sua matrícula funcional.');
      setIsLoading(false);
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Por favor, informe o e-mail cadastrado no RH.');
      setIsLoading(false);
      return;
    }

    if (!cleanDate) {
      setErrorMessage('Por favor, informe sua data de nascimento.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await authService.validateCollaboratorForReset(
        cleanMat,
        cleanEmail,
        cleanDate,
        employees
      );

      if (res.success && res.employee) {
        setVerifiedEmployee(res.employee);
        setStep('NEW_PASSWORD');
        setErrorMessage(null);
      } else {
        setErrorMessage(res.message || 'Dados informados não conferem com o cadastro. Procure o setor de RH (DA).');
      }
    } catch (err: any) {
      console.error('Erro na validação cadastral:', err);
      setErrorMessage('Dados informados não conferem com o cadastro. Procure o setor de RH (DA).');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ETAPA 2: GRAVAÇÃO DA NOVA SENHA 100% NO FIRESTORE
  // -------------------------------------------------------------
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 4) {
      setErrorMessage('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('A confirmação de senha não coincide com a nova senha digitada.');
      return;
    }

    setIsLoading(true);
    const targetMatricula = verifiedEmployee?.matricula || matricula.trim().toUpperCase();

    try {
      const res = await authService.resetCollaboratorPassword(
        targetMatricula,
        newPassword,
        verifiedEmployee || undefined,
        email
      );

      if (res.success) {
        setSuccessMessage('Senha redefinida com sucesso! Você já pode fazer login.');
        setStep('SUCCESS');
        
        if (typeof onSuccess === 'function') {
          onSuccess(targetMatricula, newPassword);
        }
      } else {
        setErrorMessage(res.message || 'Falha ao salvar nova senha no Firestore.');
      }
    } catch (err: any) {
      console.error('Erro ao salvar nova senha:', err);
      setErrorMessage(err?.message || 'Falha na comunicação com o banco de dados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetModal = () => {
    setStep('VALIDATE');
    setMatricula('');
    setEmail('');
    setDataNascimento('');
    setVerifiedEmployee(null);
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div 
        id="forgot-password-modal"
        className={`w-full max-w-md p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 relative animate-in zoom-in-95 ${
          isDark ? 'bg-[#15171C] border-[#2A2E38] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleResetModal}
          className={`absolute top-5 right-5 p-1.5 rounded-xl border transition-colors cursor-pointer ${
            isDark 
              ? 'bg-[#1F2229] border-[#2E333F] text-gray-400 hover:text-white' 
              : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
          }`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mx-auto shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {step === 'VALIDATE' && 'Recuperação de Senha'}
            {step === 'NEW_PASSWORD' && 'Definir Nova Senha'}
            {step === 'SUCCESS' && 'Acesso Liberado'}
          </h2>
          <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            {step === 'VALIDATE' && 'Validação cadastral para primeiro acesso ou redefinição'}
            {step === 'NEW_PASSWORD' && 'Crie sua nova senha de acesso ao Portal do Colaborador'}
            {step === 'SUCCESS' && 'Credencial atualizada e pronta para uso'}
          </p>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{successMessage}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PASSO 1: VALIDAÇÃO DOS 3 CAMPOS (MATRÍCULA, EMAIL, NASCIMENTO) */}
        {/* ------------------------------------------------------------- */}
        {step === 'VALIDATE' && (
          <form onSubmit={handleValidateIdentity} className="space-y-4">
            {/* Matrícula */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider">
                Matrícula Funcional
              </label>
              <div className="relative">
                <UserCheck className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                <input
                  type="text"
                  required
                  placeholder="Ex: 13917 ou KO-101"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono border outline-none transition-colors ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#2A2E38] text-white focus:border-blue-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                  }`}
                />
              </div>
            </div>

            {/* E-mail Cadastrado */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider">
                E-mail Cadastrado
              </label>
              <div className="relative">
                <Mail className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                <input
                  type="email"
                  required
                  placeholder="Ex: joao.silva@comara.aer.mil.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm border outline-none transition-colors ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#2A2E38] text-white focus:border-blue-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                  }`}
                />
              </div>
            </div>

            {/* Data de Nascimento */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider">
                Data de Nascimento
              </label>
              <div className="relative">
                <Calendar className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                <input
                  type="date"
                  required
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm border outline-none transition-colors ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#2A2E38] text-white focus:border-blue-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Validando Cadastro...</span>
                </>
              ) : (
                <>
                  <span>Validar Dados e Avançar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PASSO 2: DEFINIR NOVA SENHA */}
        {/* ------------------------------------------------------------- */}
        {step === 'NEW_PASSWORD' && (
          <form onSubmit={handleSaveNewPassword} className="space-y-4">
            {/* Card de confirmação do colaborador */}
            {verifiedEmployee && (
              <div className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                isDark ? 'bg-[#0D0F14] border-[#2A2E38]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-500 flex items-center justify-center font-bold text-sm shrink-0">
                  {verifiedEmployee.nome.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{verifiedEmployee.nome}</div>
                  <div className={`text-[11px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Matrícula: {verifiedEmployee.matricula} • Sede: {verifiedEmployee.sede}
                  </div>
                </div>
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              </div>
            )}

            {/* Nova Senha */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider">
                Nova Senha (Mínimo 4 caracteres)
              </label>
              <div className="relative">
                <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs sm:text-sm border outline-none ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#2A2E38] text-white focus:border-blue-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-slate-400'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar Nova Senha */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm border outline-none ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#2A2E38] text-white focus:border-blue-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                  }`}
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep('VALIDATE')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  isDark ? 'bg-[#1F2229] border-[#2E333F] text-gray-300 hover:bg-[#2A2E38]' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Voltar
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Gravando no Firestore...' : 'Salvar Nova Senha'}
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PASSO 3: SUCESSO */}
        {/* ------------------------------------------------------------- */}
        {step === 'SUCCESS' && (
          <div className="text-center space-y-5 py-3">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-bold">Senha Redefinida!</h3>
              <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                Senha redefinida com sucesso! Você já pode fazer login.
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetModal}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-md"
            >
              Fazer Login Agora
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className={`pt-2 text-center text-[11px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
          <span>Em caso de dúvidas cadastrais, consulte a Divisão de Administração (DA / RH).</span>
        </div>
      </div>
    </div>
  );
};
