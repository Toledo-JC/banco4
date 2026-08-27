import React from 'react';
import { AdminRole } from '../types';
import { rbacService, RBACUser, ROLE_INFO } from '../services/rbacService';
import { ShieldAlert, ArrowLeft, Lock, Building2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AdminRole[];
  requiredPermission?: (role: AdminRole, user?: RBACUser | null) => boolean;
  currentUserRole?: AdminRole | string;
  currentUser?: RBACUser | null;
  targetCanteiroId?: string;
  onRedirectToDashboard?: () => void;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermission,
  currentUserRole = 'SUPER_ADMIN',
  currentUser,
  targetCanteiroId,
  onRedirectToDashboard,
  fallbackTitle = 'Acesso Restrito',
  fallbackMessage,
}) => {
  const role = (currentUserRole || 'SUPER_ADMIN') as AdminRole;
  const isGlobal = rbacService.hasGlobalAccess(role);

  // 1. Verificação por lista explícita de papéis permitidos
  if (allowedRoles && allowedRoles.length > 0) {
    const isRoleAllowed = allowedRoles.includes(role);
    if (!isRoleAllowed) {
      return (
        <AccessDeniedCard
          title={fallbackTitle}
          message={
            fallbackMessage ||
            `O seu perfil (${ROLE_INFO[role]?.label || role}) não possui permissão para acessar esta seção.`
          }
          currentRole={role}
          onRedirectToDashboard={onRedirectToDashboard}
        />
      );
    }
  }

  // 2. Verificação por função de permissão RBAC
  if (requiredPermission) {
    const hasPermission = requiredPermission(role, currentUser);
    if (!hasPermission) {
      return (
        <AccessDeniedCard
          title={fallbackTitle}
          message={
            fallbackMessage ||
            `Ação ou módulo não autorizado para o perfil ${ROLE_INFO[role]?.label || role}.`
          }
          currentRole={role}
          onRedirectToDashboard={onRedirectToDashboard}
        />
      );
    }
  }

  // 3. Verificação de Tenancy / Isolamento de Canteiro
  if (targetCanteiroId && !isGlobal) {
    const userCanteiro = rbacService.getUserCanteiroId(currentUser);
    const normalizedTarget = targetCanteiroId.toUpperCase();
    if (userCanteiro !== normalizedTarget && normalizedTarget !== 'TODAS' && normalizedTarget !== 'TODOS') {
      return (
        <AccessDeniedCard
          title="Isolamento de Canteiro (Tenancy)"
          message={`Seu perfil tem acesso restrito exclusivamente ao canteiro ${userCanteiro}. Tentativa de acesso aos dados de ${targetCanteiroId} foi bloqueada conforme a política de segurança.`}
          currentRole={role}
          targetCanteiro={targetCanteiroId}
          onRedirectToDashboard={onRedirectToDashboard}
        />
      );
    }
  }

  return <>{children}</>;
};

interface AccessDeniedCardProps {
  title: string;
  message: string;
  currentRole: AdminRole;
  targetCanteiro?: string;
  onRedirectToDashboard?: () => void;
}

const AccessDeniedCard: React.FC<AccessDeniedCardProps> = ({
  title,
  message,
  currentRole,
  targetCanteiro,
  onRedirectToDashboard,
}) => {
  return (
    <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 rounded-2xl border border-red-500/30 bg-red-950/20 dark:bg-red-950/30 text-center space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-black tracking-tight text-white flex items-center justify-center gap-2">
          <Lock className="w-4 h-4 text-red-400" />
          <span>{title}</span>
        </h2>
        <p className="text-xs text-slate-300 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
          {message}
        </p>
      </div>

      <div className="pt-2 flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono">
        <span className="px-2.5 py-1 rounded-lg bg-[#0D0F14] border border-[#1F2229] text-slate-300">
          Perfil: <strong className="text-amber-400">{ROLE_INFO[currentRole]?.label || currentRole}</strong>
        </span>
        {targetCanteiro && (
          <span className="px-2.5 py-1 rounded-lg bg-[#0D0F14] border border-[#1F2229] text-slate-300 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-cyan-400" />
            Alvo: <strong className="text-cyan-400">{targetCanteiro}</strong>
          </span>
        )}
      </div>

      {onRedirectToDashboard && (
        <div className="pt-3">
          <button
            type="button"
            onClick={onRedirectToDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Dashboard Permitido</span>
          </button>
        </div>
      )}
    </div>
  );
};
