import { AdminRole, Employee, TimeRecord, InsalubrityRecord, DispensaSptfRecord, Branch } from '../types';

export interface RBACUser {
  email: string;
  nome: string;
  role: AdminRole;
  cargo?: string;
  sede?: string;
  canteiroCodigo?: string;
  canteiroId?: string;
}

/**
 * MATRIZ DEFINITIVA DE PERFIS E PERMISSÕES COMARA SPTF
 * 
 * 1. SUPER_ADMIN (TI): Acesso TOTAL a todos os canteiros, relatórios globais, auditoria, configurações e gestão de usuários.
 * 2. RH_ADMIN / GESTOR_RH (RH Sede): Acesso TOTAL a todos os canteiros, relatórios globais, auditoria e importação da folha.
 * 3. GERENTE_CANTEIRO (Gerente / Gerente de Campo): Leitura e aprovação RESTREITO ao seu canteiro ativo.
 * 4. CHEFE_CANTEIRO / ENCARREGADO_CANTEIRO: Operacional do canteiro ativo: Lançamento de horas, validação de insalubridade e dispensas SPTF.
 * 5. CHEFE_DA / ENCARREGADO_DA: Gestão administrativa do canteiro ativo: Lançamentos, insalubridade e emissão de dispensas SPTF.
 * 6. AUX_DA (Auxiliar da DA): Acesso simplificado de campo RESTREITO ao seu canteiro: Lançamentos rápidos e Emissão de Dispensa SPTF.
 * 7. AUDITOR: Auditoria e relatórios - somente leitura.
 */

export const ROLE_INFO: Record<AdminRole, {
  label: string;
  shortLabel: string;
  scope: 'GLOBAL' | 'CANTEIRO_RESTRICTED';
  badgeColor: string;
  description: string;
}> = {
  SUPER_ADMIN: {
    label: 'Super Admin (TI)',
    shortLabel: 'SA (TI)',
    scope: 'GLOBAL',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    description: 'Acesso total a todos os canteiros, relatórios globais, auditoria e gestão de usuários.',
  },
  RH_ADMIN: {
    label: 'RH Admin (RH Sede)',
    shortLabel: 'RH Admin',
    scope: 'GLOBAL',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    description: 'Gestão global de banco de horas, relatórios executivos e importação da folha de pagamento.',
  },
  GESTOR_RH: {
    label: 'Gestor de RH (Sede)',
    shortLabel: 'Gestor RH',
    scope: 'GLOBAL',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    description: 'Gestão global de banco de horas, relatórios executivos e homologações.',
  },
  GERENTE_CANTEIRO: {
    label: 'Gerente de Canteiro',
    shortLabel: 'Gerente',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Leitura, aprovação e acompanhamento operacional restrito ao seu canteiro ativo.',
  },
  GERENTE_CAMPO: {
    label: 'Gerente de Campo',
    shortLabel: 'Gerente',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Leitura e fiscalização restrita ao canteiro de obras.',
  },
  GERENTE: {
    label: 'Engenheiro Fiscal / Gerente',
    shortLabel: 'Gerente',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Fiscalização e acompanhamento de horas e insalubridade do canteiro.',
  },
  ROLE_GERENTE: {
    label: 'Gerente de Canteiro',
    shortLabel: 'Gerente',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Acompanhamento e aprovação no canteiro ativo.',
  },
  CHEFE_CANTEIRO: {
    label: 'Chefe de Canteiro',
    shortLabel: 'Chefe Cant.',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    description: 'Operacional do canteiro: Lançamento de horas, validação de insalubridade e dispensas SPTF.',
  },
  ENCARREGADO_CANTEIRO: {
    label: 'Encarregado de Canteiro',
    shortLabel: 'Encarregado',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    description: 'Operacional do canteiro: Lançamento de horas, validação de insalubridade e dispensas SPTF.',
  },
  CHEFE_DA: {
    label: 'Chefe da Divisão Administrativa',
    shortLabel: 'Chefe DA',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    description: 'Gestão administrativa do canteiro: Lançamentos, insalubridade e emissão de dispensas SPTF.',
  },
  ENCARREGADO_DA: {
    label: 'Encarregado da DA',
    shortLabel: 'Enc. DA',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    description: 'Gestão administrativa do canteiro: Lançamentos, insalubridade e emissão de dispensas SPTF.',
  },
  AUX_DA: {
    label: 'Auxiliar da Divisão Administrativa',
    shortLabel: 'Aux. DA',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    description: 'Acesso simplificado de campo: Lançamentos rápidos e Botão Gerar Dispensa de SPTF.',
  },
  AUDITOR: {
    label: 'Auditor Externo / Leitura',
    shortLabel: 'Auditor',
    scope: 'GLOBAL',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    description: 'Visualização de relatórios e extratos em modo somente leitura.',
  },
};

export const rbacService = {
  /**
   * Identifica se o usuário possui acesso global a todos os canteiros e sedes
   */
  hasGlobalAccess(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = role.toString().toUpperCase();
    return r === 'SUPER_ADMIN' || r === 'RH_ADMIN' || r === 'GESTOR_RH';
  },

  /**
   * Identifica se o perfil é restrito ao seu canteiro ativo
   */
  isCanteiroRestricted(role?: AdminRole | string): boolean {
    return !this.hasGlobalAccess(role);
  },

  /**
   * Obtém a sede/canteiro do usuário (ex: 'KO', 'BE', 'MN')
   */
  getUserCanteiroId(user?: RBACUser | null): string {
    if (!user) return 'KO';
    return (user.canteiroId || user.canteiroCodigo || user.sede || 'KO').toUpperCase();
  },

  /**
   * Checa se o usuário pode emitir Guia de Dispensa de SPTF (alias canIssueDispensa)
   */
  canEmitDispensa(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = role.toString().toUpperCase();
    return (
      r === 'SUPER_ADMIN' ||
      r === 'RH_ADMIN' ||
      r === 'GESTOR_RH' ||
      r === 'CHEFE_CANTEIRO' ||
      r === 'ENCARREGADO_CANTEIRO' ||
      r === 'CHEFE_DA' ||
      r === 'ENCARREGADO_DA' ||
      r === 'AUX_DA' ||
      r === 'AUXILIAR_DA' ||
      r === 'GERENTE_CANTEIRO' ||
      r === 'GERENTE' ||
      r === 'GERENTE_CAMPO' ||
      r === 'ROLE_GERENTE'
    );
  },

  canIssueDispensa(role?: AdminRole | string): boolean {
    return this.canEmitDispensa(role);
  },

  /**
   * Checa se o usuário pode lançar horas (individual ou em lote)
   */
  canLaunchHours(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = role.toString().toUpperCase();
    return (
      r === 'SUPER_ADMIN' ||
      r === 'RH_ADMIN' ||
      r === 'GESTOR_RH' ||
      r === 'CHEFE_CANTEIRO' ||
      r === 'ENCARREGADO_CANTEIRO' ||
      r === 'CHEFE_DA' ||
      r === 'ENCARREGADO_DA' ||
      r === 'AUX_DA' ||
      r === 'AUXILIAR_DA'
    );
  },

  /**
   * Checa se o usuário pode validar/lançar insalubridade
   */
  canValidateInsalubrity(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = role.toString().toUpperCase();
    return (
      r === 'SUPER_ADMIN' ||
      r === 'RH_ADMIN' ||
      r === 'GESTOR_RH' ||
      r === 'GERENTE_CANTEIRO' ||
      r === 'GERENTE' ||
      r === 'GERENTE_CAMPO' ||
      r === 'ROLE_GERENTE' ||
      r === 'CHEFE_CANTEIRO' ||
      r === 'ENCARREGADO_CANTEIRO' ||
      r === 'CHEFE_DA' ||
      r === 'ENCARREGADO_DA'
    );
  },

  canLaunchInsalubrity(role?: AdminRole | string): boolean {
    return this.canValidateInsalubrity(role);
  },

  /**
   * Checa se o usuário pode gerenciar contracheques e importação da folha
   */
  canManagePaystubs(role?: AdminRole | string): boolean {
    return this.hasGlobalAccess(role);
  },

  canImportFolha(role?: AdminRole | string): boolean {
    return this.hasGlobalAccess(role);
  },

  canManageCanteiros(role?: AdminRole | string): boolean {
    return this.hasGlobalAccess(role);
  },

  canManageSystemConfig(role?: AdminRole | string): boolean {
    return this.hasGlobalAccess(role);
  },

  canManageAdmins(role?: AdminRole | string, email?: string): boolean {
    return this.canManageAdminPermissions(role, email);
  },

  /**
   * Checa se o usuário pode gerenciar permissões administrativas
   */
  canManageAdminPermissions(role?: AdminRole | string, email?: string): boolean {
    if (!role) return false;
    if (email && (email.toLowerCase() === 'coari.comara@gmail.com' || email.toLowerCase() === 'comarafab@gmail.com')) {
      return true;
    }
    return role.toString().toUpperCase() === 'SUPER_ADMIN';
  },

  /**
   * Checa se o usuário pode acessar dados de um determinado colaborador baseado no canteiro
   */
  canAccessEmployee(user: RBACUser | null, employee: Employee): boolean {
    if (!user) return false;
    if (this.hasGlobalAccess(user.role)) return true;
    
    const userCanteiro = this.getUserCanteiroId(user);
    const empSede = (employee.sede_atual || employee.sede || '').toUpperCase();
    const empOrigem = (employee.sede_origem || '').toUpperCase();
    
    return empSede === userCanteiro || empOrigem === userCanteiro;
  },

  /**
   * Filtro rigoroso de Colaboradores por Tenancy (Canteiro Ativo)
   */
  filterEmployeesByTenancy(employees: Employee[], user: RBACUser | null): Employee[] {
    if (!user) return [];
    if (this.hasGlobalAccess(user.role)) return employees;

    const userCanteiro = this.getUserCanteiroId(user);
    return employees.filter((emp) => {
      const empSede = (emp.sede_atual || emp.sede || '').toUpperCase();
      const empOrigem = (emp.sede_origem || '').toUpperCase();
      return empSede === userCanteiro || empOrigem === userCanteiro;
    });
  },

  /**
   * Filtro rigoroso de Lançamentos de Horas por Tenancy (Canteiro Ativo)
   */
  filterRecordsByTenancy(records: TimeRecord[], employees: Employee[], user: RBACUser | null): TimeRecord[] {
    if (!user) return [];
    if (this.hasGlobalAccess(user.role)) return records;

    const userCanteiro = this.getUserCanteiroId(user);
    
    // Mapeia matrículas que pertencem ao canteiro do usuário
    const allowedMatriculas = new Set<string>();
    employees.forEach((emp) => {
      const empSede = (emp.sede_atual || emp.sede || '').toUpperCase();
      const empOrigem = (emp.sede_origem || '').toUpperCase();
      if (empSede === userCanteiro || empOrigem === userCanteiro) {
        allowedMatriculas.add(emp.matricula.trim().toUpperCase());
      }
    });

    return records.filter((rec) => {
      const mat = (rec.matricula || '').trim().toUpperCase();
      if (allowedMatriculas.has(mat)) return true;
      if (rec.employeeSede && rec.employeeSede.toUpperCase() === userCanteiro) return true;
      return false;
    });
  },

  /**
   * Filtro rigoroso de Lançamentos de Insalubridade por Tenancy (Canteiro Ativo)
   */
  filterInsalubrityByTenancy(records: InsalubrityRecord[], user: RBACUser | null): InsalubrityRecord[] {
    if (!user) return [];
    if (this.hasGlobalAccess(user.role)) return records;

    const userCanteiro = this.getUserCanteiroId(user);
    return records.filter((rec) => {
      return (rec.sede || 'KO').toUpperCase() === userCanteiro;
    });
  },

  /**
   * Filtro rigoroso de Dispensas SPTF por Tenancy (Canteiro Ativo)
   */
  filterDispensasByTenancy(dispensas: DispensaSptfRecord[], employees: Employee[], user: RBACUser | null): DispensaSptfRecord[] {
    if (!user) return [];
    if (this.hasGlobalAccess(user.role)) return dispensas;

    const userCanteiro = this.getUserCanteiroId(user);
    
    const allowedMatriculas = new Set<string>();
    employees.forEach((emp) => {
      const empSede = (emp.sede_atual || emp.sede || '').toUpperCase();
      if (empSede === userCanteiro) {
        allowedMatriculas.add(emp.matricula.trim().toUpperCase());
      }
    });

    return dispensas.filter((d) => {
      const mat = (d.matricula || '').trim().toUpperCase();
      if (allowedMatriculas.has(mat)) return true;
      const secao = (d.secaoCanteiro || '').toUpperCase();
      return secao.includes(userCanteiro);
    });
  },
};
