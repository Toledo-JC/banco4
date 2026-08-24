import React from 'react';
import { Lock, ShieldAlert, ArrowRight, UserCheck, KeyRound } from 'lucide-react';

interface AdminLockScreenProps {
  theme?: 'dark' | 'light';
  onSwitchToAdmin: () => void;
  tabTitle?: string;
}

export const AdminLockScreen: React.FC<AdminLockScreenProps> = ({
  theme = 'dark',
  onSwitchToAdmin,
  tabTitle = 'Acessos RH e Gestão',
}) => {
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center justify-center py-12 px-4 sm:px-6">
      <div className={`max-w-md w-full p-8 rounded-2xl border text-center transition-all ${
        isDark 
          ? 'bg-[#15171C] border-[#1F2229] shadow-2xl' 
          : 'bg-white border-slate-200 shadow-xl'
      }`}>
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-5 border ${
          isDark 
            ? 'bg-red-950/40 text-red-400 border-red-800/40' 
            : 'bg-red-50 text-red-600 border-red-200'
        }`}>
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold font-mono uppercase tracking-wider mb-2 border ${
          isDark 
            ? 'bg-red-950/30 text-red-300 border-red-900/40' 
            : 'bg-red-100 text-red-700 border-red-200'
        }`}>
          Controle de Acesso • RBAC
        </span>

        <h3 className={`text-xl font-bold font-sans tracking-tight mb-2 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          Acesso Restrito a Administradores do RH
        </h3>

        <p className={`text-xs font-sans leading-relaxed mb-6 ${
          isDark ? 'text-[#8E9299]' : 'text-slate-600'
        }`}>
          A visualização e manipulação do módulo <strong className={isDark ? 'text-white' : 'text-slate-900'}>"{tabTitle}"</strong> é restrita a gestores autorizados com e-mail corporativo cadastrado na tabela de permissões (<code className="font-mono text-blue-500">tb_usuarios_admin</code>).
        </p>

        <div className={`p-4 rounded-xl border mb-6 text-left text-xs font-mono space-y-1.5 ${
          isDark ? 'bg-[#0D0F14] border-[#1F2229] text-[#8E9299]' : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          <div className="flex items-center gap-1.5 font-bold text-amber-500 text-[11px]">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Perfil Atual: Colaborador / Modo Consulta</span>
          </div>
          <p className="text-[11px]">
            Colaboradores possuem acesso exclusivo ao <strong>Portal do Colaborador</strong> para autoatendimento e consulta de extratos individuais.
          </p>
        </div>

        <button
          onClick={onSwitchToAdmin}
          className="w-full py-3 px-4 bg-[#3B82F6] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
        >
          <UserCheck className="w-4 h-4" />
          <span>Simular / Alternar para Modo Administrador (RH)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
