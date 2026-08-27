import React, { useState, useEffect, useCallback } from 'react';
import { Employee, TimeRecord, Attachment, AdminUser, AdminRole, AuthSession, InsalubrityRecord, SystemConfig, GrauInsalubridade, ConstructionSite, PaystubRecord, DispensaSptfRecord } from './types';
import { storageService } from './services/storageService';
import { firestoreService, BatchProgressInfo } from './services/firestoreService';
import { auth, googleProvider, testFirestoreConnection, isPermissionError } from './services/firebase';
import { authService } from './services/authService';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  User as FirebaseUser 
} from 'firebase/auth';

import { Navbar, ActiveTab, UserMode } from './components/Navbar';
import { LookerDashboard } from './components/LookerDashboard';
import { EmployeeManagement } from './components/EmployeeManagement';
import { EmployeeStatement } from './components/EmployeeStatement';
import { EmployeeSelfServicePortal } from './components/EmployeeSelfServicePortal';
import { AdminPermissionsManagement } from './components/AdminPermissionsManagement';
import { GoogleArchitectureSpec } from './components/GoogleArchitectureSpec';
import { AdminLockScreen } from './components/AdminLockScreen';
import { CollaboratorLandingView } from './components/CollaboratorLandingView';
import { AdminLoginModal } from './components/AdminLoginModal';
import { DailyEntryModal } from './components/DailyEntryModal';
import { QuickBatchEntryModal } from './components/QuickBatchEntryModal';
import { SptfDispensaModal } from './components/SptfDispensaModal';
import { SiteSupervisorMobileView } from './components/SiteSupervisorMobileView';
import { CertificatePreviewModal } from './components/CertificatePreviewModal';
import { ImportTimeRecordsModal } from './components/ImportTimeRecordsModal';
import { InsalubrityManagement } from './components/InsalubrityManagement';
import { CanteirosManagement } from './components/CanteirosManagement';
import { ExecutiveReportsView } from './components/ExecutiveReportsView';
import { ContrachequesManagement } from './components/ContrachequesManagement';
import { AuditTrailView } from './components/AuditTrailView';
import { ComaraLogoModal } from './components/ComaraLogoModal';
import { DatabaseSafetyActionModal, SafetyActionType } from './components/DatabaseSafetyActionModal';
import { SessionTimeoutModal } from './components/SessionTimeoutModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { rbacService } from './services/rbacService';
import { registrarLogAuditoria } from './services/auditService';
import { useIdleTimer } from './hooks/useIdleTimer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CheckCircle2, AlertCircle, Cloud, RefreshCw, X, Database } from 'lucide-react';

export interface AppUser {
  uid?: string;
  email: string;
  nome: string;
  displayName?: string | null;
  role: AdminRole;
  cargo?: string;
  sede?: string;
  canteiroCodigo?: string;
  canteiroId?: string;
  loginTime?: string;
  photoURL?: string | null;
  tratamentoTitulo?: string;
}

export default function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = authService.getCurrentSession();
    if (!saved) return null;
    return {
      email: saved.email,
      nome: saved.nome,
      role: (saved.role as AdminRole) || 'SUPER_ADMIN',
      cargo: saved.cargo,
      loginTime: saved.loginTime,
    };
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<AdminRole>(() => {
    const session = authService.getCurrentSession();
    return session?.role || 'SUPER_ADMIN';
  });
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);

  // Firestore Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [insalubrityRecords, setInsalubrityRecords] = useState<InsalubrityRecord[]>([]);
  const [dispensasSptf, setDispensasSptf] = useState<DispensaSptfRecord[]>([]);
  const [constructionSites, setConstructionSites] = useState<ConstructionSite[]>([]);
  const [paystubs, setPaystubs] = useState<PaystubRecord[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => storageService.getSystemConfig());
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedMatricula, setSelectedMatricula] = useState<string>('');
  const [theme, setTheme] = useState<'dark' | 'light'>(storageService.getTheme());
  const [userMode, setUserMode] = useState<UserMode>('ADMIN');

  // Modals state
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [safetyActionType, setSafetyActionType] = useState<SafetyActionType>('CLEAR_DATABASE');

  // Firestore Status / Error Handling State
  const [firestoreErrorNotice, setFirestoreErrorNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Batch Progress State (para grandes lotes de 4.500+ registros)
  const [batchProgress, setBatchProgress] = useState<{
    isOpen: boolean;
    title: string;
    processed: number;
    total: number;
    percent: number;
    chunkIndex: number;
    totalChunks: number;
  } | null>(null);

  // Modals state
  const [isDailyEntryModalOpen, setIsDailyEntryModalOpen] = useState(false);
  const [dailyEntryInitialRecord, setDailyEntryInitialRecord] = useState<TimeRecord | null>(null);
  const [isQuickBatchModalOpen, setIsQuickBatchModalOpen] = useState(false);
  const [isImportRecordsModalOpen, setIsImportRecordsModalOpen] = useState(false);
  const [dailyEntryPreselectedMatricula, setDailyEntryPreselectedMatricula] = useState<string | undefined>();
  const [dailyEntryPreselectedDate, setDailyEntryPreselectedDate] = useState<string | undefined>();
  
  // Dispensa de SPTF Modal State
  const [isSptfDispensaModalOpen, setIsSptfDispensaModalOpen] = useState(false);
  const [sptfDispensaPreselectedMatricula, setSptfDispensaPreselectedMatricula] = useState<string | undefined>();
  
  // Certificate Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewEmployeeName, setPreviewEmployeeName] = useState<string | undefined>();
  const [previewRecordDate, setPreviewRecordDate] = useState<string | undefined>();

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // -------------------------------------------------------------
  // 1. Real-Time Cloud Firestore Sync com Fallback Robusto & Tenancy
  // -------------------------------------------------------------
  const initFirestoreSubscriptions = useCallback(() => {
    setIsSyncing(true);
    testFirestoreConnection();

    // Determine strict active canteiro for non-global users
    const isGlobal = rbacService.isGlobalRole(userRole);
    const activeCanteiro = (!isGlobal && currentUser)
      ? rbacService.getUserCanteiroId(currentUser)
      : undefined;

    // Subscribe to Employees in Firestore
    const unsubEmployees = firestoreService.subscribeEmployees(
      (emps) => {
        setEmployees(emps);
        setFirestoreErrorNotice(null);
        if (emps.length > 0) {
          storageService.saveEmployees(emps);
        }
        if (emps.length > 0 && !selectedMatricula) {
          setSelectedMatricula(emps[0].matricula);
        }
        setIsSyncing(false);
      },
      (err) => {
        console.warn('Fallback local para colaboradores:', err);
        if (isPermissionError(err)) {
          setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
        }
        const local = storageService.getEmployees();
        setEmployees(local);
        if (local.length > 0 && !selectedMatricula) {
          setSelectedMatricula(local[0].matricula);
        }
        setIsSyncing(false);
      },
      activeCanteiro
    );

    // Subscribe to Time Records in Firestore
    const unsubRecords = firestoreService.subscribeTimeRecords(
      (recs) => {
        setRecords(recs);
        setFirestoreErrorNotice(null);
        if (recs.length > 0) {
          storageService.saveTimeRecords(recs);
        }
      },
      (err) => {
        console.warn('Fallback local para lançamentos:', err);
        if (isPermissionError(err)) {
          setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
        }
        const local = storageService.getTimeRecords();
        setRecords(local);
      },
      activeCanteiro
    );

    // Subscribe to Authorized Admin Users in Firestore
    const unsubAdmins = firestoreService.subscribeAdmins(
      (adms) => {
        setAdminUsers(adms);
        setFirestoreErrorNotice(null);
        if (adms.length > 0) {
          storageService.saveAdmins(adms);
        }
      },
      (err) => {
        console.warn('Fallback local para administradores:', err);
        if (isPermissionError(err)) {
          setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
        }
        const local = storageService.getAdmins();
        setAdminUsers(local);
      }
    );

    // Subscribe to Insalubrity Records in Firestore
    const unsubInsalubrity = firestoreService.subscribeInsalubrityRecords(
      (items) => {
        setInsalubrityRecords(items);
        if (items.length > 0) {
          storageService.saveInsalubrityRecords(items);
        }
      },
      (err) => {
        console.warn('Fallback local para insalubridade:', err);
        const local = storageService.getInsalubrityRecords();
        setInsalubrityRecords(local);
      },
      activeCanteiro
    );

    // Subscribe to Construction Sites in Firestore
    const unsubSites = firestoreService.subscribeConstructionSites(
      (sites) => {
        setConstructionSites(sites);
      },
      (err) => {
        console.warn('Fallback para canteiros:', err);
      }
    );

    // Subscribe to System Config (Logo COMARA, etc.)
    const unsubSystemConfig = firestoreService.subscribeSystemConfig(
      (cfg) => {
        if (cfg) {
          setSystemConfig(cfg);
          storageService.saveSystemConfig(cfg);
        }
      },
      (err) => {
        console.warn('Fallback local para system config:', err);
        const local = storageService.getSystemConfig();
        setSystemConfig(local);
      }
    );

    // Subscribe to Paystubs (Contracheques Digitais) in Firestore
    const unsubPaystubs = firestoreService.subscribePaystubs(
      (items) => {
        setPaystubs(items);
      },
      (err) => {
        console.warn('Fallback para contracheques:', err);
      },
      activeCanteiro
    );

    // Subscribe to Dispensas de SPTF in Firestore
    const unsubDispensas = firestoreService.subscribeDispensasSptf(
      (items) => {
        setDispensasSptf(items);
        if (items.length > 0) {
          storageService.saveDispensasSptf(items);
        }
      },
      (err) => {
        console.warn('Fallback local para dispensas SPTF:', err);
        const local = storageService.getDispensasSptf();
        setDispensasSptf(local);
      },
      activeCanteiro
    );

    return () => {
      try {
        if (typeof unsubEmployees === 'function') unsubEmployees();
      } catch (e) {
        console.warn('Erro ao cancelar listener de colaboradores:', e);
      }
      try {
        if (typeof unsubRecords === 'function') unsubRecords();
      } catch (e) {
        console.warn('Erro ao cancelar listener de lançamentos:', e);
      }
      try {
        if (typeof unsubAdmins === 'function') unsubAdmins();
      } catch (e) {
        console.warn('Erro ao cancelar listener de administradores:', e);
      }
      try {
        if (typeof unsubInsalubrity === 'function') unsubInsalubrity();
      } catch (e) {
        console.warn('Erro ao cancelar listener de insalubridade:', e);
      }
      try {
        if (typeof unsubSites === 'function') unsubSites();
      } catch (e) {
        console.warn('Erro ao cancelar listener de canteiros:', e);
      }
      try {
        if (typeof unsubSystemConfig === 'function') unsubSystemConfig();
      } catch (e) {
        console.warn('Erro ao cancelar listener de system config:', e);
      }
      try {
        if (typeof unsubPaystubs === 'function') unsubPaystubs();
      } catch (e) {
        console.warn('Erro ao cancelar listener de contracheques:', e);
      }
      try {
        if (typeof unsubDispensas === 'function') unsubDispensas();
      } catch (e) {
        console.warn('Erro ao cancelar listener de dispensas SPTF:', e);
      }
    };
  }, [selectedMatricula, userRole, currentUser]);

  useEffect(() => {
    const cleanup = initFirestoreSubscriptions();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [initFirestoreSubscriptions]);

  // -------------------------------------------------------------
  // 2. Monitor and Enforce Strict RBAC on Authentication State
  // -------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthLoading(false);

      if (user) {
        const email = user.email?.toLowerCase().trim() || '';

        // Master super admin bypass
        const isMaster = email === 'coari.comara@gmail.com' || email === 'comarafab@gmail.com' || email.endsWith('@comara.aer.mil.br');
        
        // Find user in Firestore admin_users collection
        const matchAdmin = adminUsers.find(a => a.email.toLowerCase().trim() === email);

        if (isMaster) {
          const appUser: AppUser = {
            uid: user.uid,
            email,
            nome: user.displayName || 'Super Administrador COMARA',
            displayName: user.displayName,
            role: 'SUPER_ADMIN',
            cargo: 'Super Administrador',
            loginTime: new Date().toISOString(),
            photoURL: user.photoURL,
          };
          setCurrentUser(appUser);
          setUserRole('SUPER_ADMIN');
          setUserMode('ADMIN');
          authService.saveCurrentSession({
            email,
            nome: user.displayName || 'Super Administrador COMARA',
            role: 'SUPER_ADMIN',
            loginTime: new Date().toISOString(),
          });
        } else if (matchAdmin && matchAdmin.ativo) {
          const appUser: AppUser = {
            uid: user.uid,
            email,
            nome: matchAdmin.nome,
            displayName: user.displayName,
            role: matchAdmin.nivelAcesso,
            cargo: matchAdmin.cargo,
            loginTime: new Date().toISOString(),
            photoURL: user.photoURL,
          };
          setCurrentUser(appUser);
          setUserRole(matchAdmin.nivelAcesso);
          setUserMode(matchAdmin.nivelAcesso === 'AUDITOR' ? 'COLABORADOR' : 'ADMIN');
          authService.saveCurrentSession({
            email,
            nome: matchAdmin.nome,
            role: matchAdmin.nivelAcesso,
            cargo: matchAdmin.cargo,
            loginTime: new Date().toISOString(),
          });
        } else if (adminUsers.length > 0) {
          // Strict block: Not in authorized list or inactive
          console.warn('Bloqueio de acesso RBAC:', email);
          await firebaseSignOut(auth);
          authService.clearSession();
          setCurrentUser(null);
          showToast('Acesso Negado: Usuário não cadastrado pela equipe de RH.', 'error');
        } else {
          // If admin list still syncing, set provisionally
          const appUser: AppUser = {
            uid: user.uid,
            email,
            nome: user.displayName || 'Gestor RH',
            displayName: user.displayName,
            role: 'GESTOR_RH',
            loginTime: new Date().toISOString(),
            photoURL: user.photoURL,
          };
          setCurrentUser(appUser);
          setUserRole('GESTOR_RH');
          setUserMode('ADMIN');
        }
      } else {
        // Sem Firebase Auth Google - verificar se há sessão salva de login Firestore
        const savedSession = authService.getCurrentSession();
        if (savedSession) {
          const appUser: AppUser = {
            email: savedSession.email,
            nome: savedSession.nome,
            role: (savedSession.role as AdminRole) || 'SUPER_ADMIN',
            cargo: savedSession.cargo,
            loginTime: savedSession.loginTime,
          };
          setCurrentUser(appUser);
          setUserRole(savedSession.role as AdminRole);
          setUserMode(savedSession.role === 'AUDITOR' ? 'COLABORADOR' : 'ADMIN');
        } else {
          setCurrentUser(null);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [adminUsers, showToast]);

  // Auth Handler: Google Workspace Sign-In
  const handleGoogleSignIn = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const email = res.user?.email?.toLowerCase().trim() || '';
      
      const isMaster = email === 'coari.comara@gmail.com' || email === 'comarafab@gmail.com' || email.endsWith('@comara.aer.mil.br');
      const matchAdmin = adminUsers.find(a => a.email.toLowerCase().trim() === email && a.ativo);

      if (!isMaster && !matchAdmin && adminUsers.length > 0) {
        await firebaseSignOut(auth);
        authService.clearSession();
        throw new Error('Acesso Negado: Usuário não cadastrado pela equipe de RH.');
      }
      setFirestoreErrorNotice(null);
      showToast(`Bem-vindo, ${res.user?.displayName || 'Gestor'}!`, 'success');
      return { success: true, user: res.user };
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        const errorMsg = 'Domínio de prévia não autorizado no Firebase Auth para Popup Google. Utilize o login direto corporativo abaixo.';
        // Don't log as an uncaught runtime error, return informative failure
        return { 
          success: false, 
          isDomainError: true, 
          error: errorMsg 
        };
      } else if (err?.code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Janela de login fechada pelo usuário.' };
      } else {
        console.warn('Tentativa de login Google:', err?.message || err);
        showToast(err?.message || 'Falha ao autenticar com Google.', 'error');
        return { success: false, error: err?.message || 'Falha ao autenticar com Google.' };
      }
    }
  };

  // Auth Handler: Corporate Email & Password Sign-In (100% via Firestore)
  const handleEmailSignIn = async (email: string, pass: string) => {
    const result = await authService.verifyAdminLogin(email, pass, adminUsers);
    if (!result.success || !result.session) {
      showToast(result.message, 'error');
      throw new Error(result.message);
    }

    const appUser: AppUser = {
      email: result.session.email,
      nome: result.session.nome,
      role: (result.session.role as AdminRole) || 'SUPER_ADMIN',
      cargo: result.session.cargo,
      loginTime: result.session.loginTime,
    };
    setCurrentUser(appUser);
    setUserRole(result.session.role);
    setUserMode(result.session.role === 'AUDITOR' ? 'COLABORADOR' : 'ADMIN');
    setFirestoreErrorNotice(null);
    showToast(result.message, 'success');
  };

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    storageService.saveTheme(next);
  };

  const handleToggleUserMode = (mode: UserMode) => {
    setUserMode(mode);
    if (mode === 'COLABORADOR' && activeTab === 'permissoes_admin') {
      showToast('Modo Colaborador ativado: Acessos administrativos restritos.', 'info');
    } else if (mode === 'ADMIN') {
      showToast('Modo Administrador (RH) ativado: Acesso de gestão concedido.', 'info');
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Erro ao desconectar do Firebase:', err);
    } finally {
      // 1. Limpeza completa dos estados globais e da sessão local
      authService.clearSession();
      setCurrentUser(null);
      setUserRole('GESTOR_RH');
      setUserMode('ADMIN');
      setActiveTab('extrato');
      setIsAdminLoginModalOpen(false);
      setIsDailyEntryModalOpen(false);
      setIsQuickBatchModalOpen(false);
      setIsImportRecordsModalOpen(false);
      setPreviewAttachment(null);
      setBatchProgress(null);

      // 2. Notificação visual de logout
      showToast('Sessão encerrada com sucesso.', 'info');
    }
  };

  // Logoff Seguro por Inatividade do Usuário (Auto-Logoff com redirecionamento e notificação)
  const handleInactivityTimeout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Erro ao desconectar do Firebase na inatividade:', err);
    } finally {
      authService.clearSession();
      setCurrentUser(null);
      setUserRole('GESTOR_RH');
      setUserMode('ADMIN');
      setActiveTab('extrato');
      setIsAdminLoginModalOpen(false);
      setIsDailyEntryModalOpen(false);
      setIsQuickBatchModalOpen(false);
      setIsImportRecordsModalOpen(false);
      setPreviewAttachment(null);
      setBatchProgress(null);

      // Notificação discreta solicitada
      showToast('Sessão finalizada por inatividade. Faça login novamente.', 'info');
    }
  }, [showToast]);

  // Monitor de Inatividade do Usuário Adaptativo (useIdleTimer)
  // Perfil AUX_DA (Canteiro): 15 minutos sem interação
  // Perfil RH_ADMIN / Administrador: 30 minutos sem interação
  // Faltando 60 segundos: Dispara aviso prévio com contagem regressiva
  const {
    isWarning: isIdleWarning,
    remainingSeconds: idleRemainingSeconds,
    profileLabel: idleProfileLabel,
    resetTimer: resetIdleTimer,
    forceTimeout: forceIdleTimeout,
  } = useIdleTimer({
    enabled: !!currentUser,
    role: userRole,
    warnSeconds: 60,
    onTimeout: handleInactivityTimeout,
  });

  // Firestore Write: Salvar Lançamento Individual
  const handleSaveRecord = async (newRecord: TimeRecord) => {
    const isEdit = records.some(r => r.id === newRecord.id);
    try {
      await firestoreService.saveTimeRecord(newRecord, currentUser?.email || 'admin@rh.cloud');
      showToast(`Lançamento de ${newRecord.horasBrutas}h gravado no Cloud Firestore com sucesso!`, 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole,
        canteiroId: newRecord.employeeSede || currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: isEdit ? 'EDICAO_LANCAMENTO' : 'LANCAMENTO_HORAS',
        detalhes: `${isEdit ? 'Edição' : 'Lançamento manual'} para Matrícula ${newRecord.matricula} (${newRecord.employeeName || ''}): ${newRecord.tipoOcorrencia} de ${newRecord.horasBrutas}h (Saldo: ${newRecord.saldoCalculado >= 0 ? '+' : ''}${newRecord.saldoCalculado}h) em ${newRecord.dataRegistro}.`,
        recursoId: newRecord.id,
        detalhesJson: {
          matricula: newRecord.matricula,
          tipoOcorrencia: newRecord.tipoOcorrencia,
          horasBrutas: newRecord.horasBrutas,
          saldoCalculado: newRecord.saldoCalculado,
          dataRegistro: newRecord.dataRegistro,
        }
      });
    } catch (error: any) {
      console.error('Erro ao salvar no Firestore, usando fallback local:', error);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      const updatedRecords = storageService.addTimeRecord(newRecord);
      setRecords([...updatedRecords]);
      showToast(`Lançamento de ${newRecord.horasBrutas}h salvo no cache local.`, 'info');
    }
  };

  // Firestore Write: Importar Lote de Lançamentos Diários com Suporte a Arquivos Grandes (4.500+ itens)
  const handleImportRecordsBatch = async (importedRecords: TimeRecord[]) => {
    const total = importedRecords.length;
    const totalChunks = Math.ceil(total / 400);

    setBatchProgress({
      isOpen: true,
      title: 'Importando Lançamentos no Cloud Firestore',
      processed: 0,
      total,
      percent: 0,
      chunkIndex: 1,
      totalChunks,
    });

    try {
      const res = await firestoreService.importTimeRecordsBatch(
        importedRecords,
        (progress: BatchProgressInfo) => {
          setBatchProgress({
            isOpen: true,
            title: `Gravando no Cloud Firestore (Lote ${progress.chunkIndex}/${progress.totalChunks})...`,
            processed: progress.processed,
            total: progress.total,
            percent: progress.percent,
            chunkIndex: progress.chunkIndex,
            totalChunks: progress.totalChunks,
          });
        }
      );

      setBatchProgress(null);

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole,
        canteiroId: currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'LANCAMENTO_HORAS',
        detalhes: `Importação em lote de ${importedRecords.length.toLocaleString('pt-BR')} lançamentos de banco de horas sincronizados no Firestore.`,
        detalhesJson: { totalRegistros: importedRecords.length }
      });

      if (res.errors.length > 0) {
        showToast(`${res.count} de ${total} lançamentos sincronizados com alguns alertas.`, 'info');
      } else {
        showToast(`${res.count.toLocaleString('pt-BR')} lançamentos sincronizados no Cloud Firestore com sucesso!`, 'success');
      }
    } catch (error: any) {
      console.error('Erro no batch import Firestore, salvando localmente:', error);
      setBatchProgress(null);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      const updatedRecords = storageService.addTimeRecordsBatch(importedRecords);
      setRecords([...updatedRecords]);
      showToast(`${importedRecords.length.toLocaleString('pt-BR')} lançamentos salvos no cache local.`, 'info');
    }
  };

  // Firestore Write: Atualizar / Importar Colaboradores em Lotes
  const handleUpdateEmployees = async (newEmployees: Employee[]) => {
    const total = newEmployees.length;
    const totalChunks = Math.ceil(total / 400);

    setBatchProgress({
      isOpen: true,
      title: 'Sincronizando Base de Colaboradores',
      processed: 0,
      total,
      percent: 0,
      chunkIndex: 1,
      totalChunks,
    });

    try {
      const res = await firestoreService.importEmployeesBatch(
        newEmployees,
        (progress: BatchProgressInfo) => {
          setBatchProgress({
            isOpen: true,
            title: `Atualizando Colaboradores (${progress.processed}/${progress.total})...`,
            processed: progress.processed,
            total: progress.total,
            percent: progress.percent,
            chunkIndex: progress.chunkIndex,
            totalChunks: progress.totalChunks,
          });
        }
      );

      setBatchProgress(null);

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole,
        canteiroId: currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'ALTERACAO_FUNCAO',
        detalhes: `Importação/Atualização cadastral em lote de ${newEmployees.length.toLocaleString('pt-BR')} colaboradores no sistema.`,
        detalhesJson: { totalColaboradores: newEmployees.length }
      });

      if (newEmployees.length > 0 && !selectedMatricula) {
        setSelectedMatricula(newEmployees[0].matricula);
      }
      showToast(`Base oficial de ${res.count.toLocaleString('pt-BR')} colaboradores gravada no Cloud Firestore!`, 'success');
    } catch (error: any) {
      console.error('Erro ao gravar colaboradores no Firestore, salvando localmente:', error);
      setBatchProgress(null);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      storageService.saveEmployees(newEmployees);
      setEmployees([...newEmployees]);
      if (newEmployees.length > 0 && !selectedMatricula) {
        setSelectedMatricula(newEmployees[0].matricula);
      }
      showToast(`Lista de colaboradores atualizada localmente (${newEmployees.length} registros).`, 'info');
    }
  };

  // -------------------------------------------------------------
  // Safety Intercept Handlers para Destructive Actions
  // -------------------------------------------------------------
  const handleTriggerClearDataSafety = () => {
    if (userRole === 'AUDITOR') {
      showToast('Ação bloqueada: Auditores possuem apenas permissão de leitura.', 'error');
      return;
    }
    setSafetyActionType('CLEAR_DATABASE');
    setIsSafetyModalOpen(true);
  };

  const handleTriggerLoadMocksSafety = () => {
    if (userRole === 'AUDITOR') {
      showToast('Ação bloqueada: Auditores possuem apenas permissão de leitura.', 'error');
      return;
    }
    setSafetyActionType('LOAD_MOCKS');
    setIsSafetyModalOpen(true);
  };

  const handleExecuteClearDatabase = async () => {
    try {
      await firestoreService.clearAllData();
      storageService.clearAllData();
      setEmployees([]);
      setRecords([]);
      setInsalubrityRecords([]);
      setSelectedMatricula('');
      showToast('Base Central limpa com sucesso! Pronto para importar nova base.', 'success');
    } catch (error: any) {
      console.error('Erro ao limpar Firestore:', error);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      storageService.clearAllData();
      setEmployees([]);
      setRecords([]);
      setInsalubrityRecords([]);
      setSelectedMatricula('');
      showToast('Base limpa localmente.', 'info');
    }
  };

  const handleExecuteLoadMocks = async () => {
    try {
      storageService.resetToDefaults();
      const mockEmps = storageService.getEmployees();
      const mockRecs = storageService.getTimeRecords();
      const mockInsalubrity = storageService.getInsalubrityRecords();
      
      // Sincronizar com Firestore se ativo
      try {
        await firestoreService.importEmployeesBatch(mockEmps);
        await firestoreService.importTimeRecordsBatch(mockRecs);
        if (mockInsalubrity.length > 0) {
          await firestoreService.saveInsalubrityBatch(mockInsalubrity);
        }
      } catch (fErr) {
        console.warn('Fallback para Firestore ao gravar mocks:', fErr);
      }

      setEmployees(mockEmps);
      setRecords(mockRecs);
      setInsalubrityRecords(mockInsalubrity);
      if (mockEmps.length > 0) {
        setSelectedMatricula(mockEmps[0].matricula);
      }
      showToast('Exemplos de demonstração e canteiros carregados com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro ao carregar mocks:', err);
      const mockEmps = storageService.getEmployees();
      const mockRecs = storageService.getTimeRecords();
      setEmployees(mockEmps);
      setRecords(mockRecs);
      showToast('Exemplos carregados no cache local.', 'info');
    }
  };

  const handleRestoreSnapshot = async (snapshot: any) => {
    try {
      if (snapshot.data?.employees) {
        await firestoreService.importEmployeesBatch(snapshot.data.employees);
        storageService.saveEmployees(snapshot.data.employees);
        setEmployees(snapshot.data.employees);
      }
      if (snapshot.data?.records) {
        await firestoreService.importTimeRecordsBatch(snapshot.data.records);
        storageService.saveTimeRecords(snapshot.data.records);
        setRecords(snapshot.data.records);
      }
      if (snapshot.data?.insalubrityRecords) {
        await firestoreService.saveInsalubrityBatch(snapshot.data.insalubrityRecords);
        for (const r of snapshot.data.insalubrityRecords) {
          storageService.saveInsalubrityRecord(r);
        }
        setInsalubrityRecords(snapshot.data.insalubrityRecords);
      }
      showToast(`Ponto de restauração de ${snapshot.formattedDate} restaurado com sucesso!`, 'success');
    } catch (err: any) {
      console.error('Erro ao restaurar backup:', err);
      showToast('Falha ao restaurar ponto de restauração.', 'error');
    }
  };

  const handleOpenNewEntry = (matricula?: string | any, defaultDate?: string | any) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite inclusão manual de lançamentos.', 'error');
      return;
    }
    const safeMat = typeof matricula === 'string' ? matricula : (employees[0]?.matricula || '');
    const safeDate = typeof defaultDate === 'string' ? defaultDate : undefined;
    setDailyEntryInitialRecord(null);
    setDailyEntryPreselectedMatricula(safeMat);
    setDailyEntryPreselectedDate(safeDate);
    setIsDailyEntryModalOpen(true);
  };

  const handleOpenEditEntry = (record: TimeRecord) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite alteração de lançamentos.', 'error');
      return;
    }
    if (!record || typeof record !== 'object' || typeof record.id !== 'string') return;
    setDailyEntryInitialRecord(record);
    setDailyEntryPreselectedMatricula(typeof record.matricula === 'string' ? record.matricula : '');
    setDailyEntryPreselectedDate(typeof record.dataRegistro === 'string' ? record.dataRegistro : record.data_ocorrencia);
    setIsDailyEntryModalOpen(true);
  };

  const handleDeleteRecord = async (id: string) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite exclusão de lançamentos.', 'error');
      return;
    }
    if (typeof id !== 'string') return;
    const targetRec = records.find(r => r.id === id);
    try {
      await firestoreService.deleteTimeRecord(id);
      storageService.deleteTimeRecord(id);
      setRecords(prev => prev.filter(r => r.id !== id));
      showToast('Lançamento excluído com sucesso do Cloud Firestore!', 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole,
        canteiroId: targetRec?.employeeSede || currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'EXCLUSAO_REGISTRO',
        detalhes: `Exclusão de lançamento de ${targetRec?.horasBrutas || 0}h (${targetRec?.tipoOcorrencia || 'Registro'}) da Matrícula ${targetRec?.matricula || id}.`,
        recursoId: id,
      });
    } catch (err: any) {
      console.error('Erro ao excluir lançamento:', err);
      storageService.deleteTimeRecord(id);
      setRecords(prev => prev.filter(r => r.id !== id));
      showToast('Lançamento removido do cache local.', 'info');
    }
  };

  // Handlers para Guia de Dispensa de SPTF (Compensação em Banco de Horas)
  const handleOpenSptfDispensa = (matricula?: string | any) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite emissão de dispensas de SPTF.', 'error');
      return;
    }
    const safeMat = typeof matricula === 'string' ? matricula : undefined;
    setSptfDispensaPreselectedMatricula(safeMat);
    setIsSptfDispensaModalOpen(true);
  };

  const handleSaveDispensaSptf = async (dispensa: DispensaSptfRecord, lancamentoRecord: TimeRecord) => {
    try {
      await firestoreService.emitDispensaSptf(dispensa, lancamentoRecord);
      storageService.addDispensaSptf(dispensa);
      storageService.addTimeRecord(lancamentoRecord);
      showToast(`Guia de Dispensa de SPTF #${dispensa.numeroGuia} emitida e debitada no Banco de Horas com sucesso!`, 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole,
        canteiroId: dispensa.secaoCanteiro || currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'EMISSAO_DISPENSA',
        detalhes: `Dispensa emitida para o servidor Matrícula ${dispensa.matricula} (${dispensa.nome}) - ${dispensa.totalHoras.toFixed(1)}h abatidas (Guia #${dispensa.numeroGuia || 'S/N'}).`,
        recursoId: dispensa.id,
        detalhesJson: {
          dispensaId: dispensa.id,
          matricula: dispensa.matricula,
          nome: dispensa.nome,
          totalHoras: dispensa.totalHoras,
          data: dispensa.data,
          horarioInicio: dispensa.horarioInicio,
          horarioFim: dispensa.horarioFim,
          numeroGuia: dispensa.numeroGuia,
          secaoCanteiro: dispensa.secaoCanteiro,
        }
      });
    } catch (error: any) {
      console.error('Erro ao emitir Dispensa de SPTF no Firestore:', error);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      storageService.addDispensaSptf(dispensa);
      const updatedRecords = storageService.addTimeRecord(lancamentoRecord);
      setRecords([...updatedRecords]);
      setDispensasSptf(prev => [dispensa, ...prev]);
      showToast(`Guia de Dispensa #${dispensa.numeroGuia} emitida e salva localmente.`, 'info');
    }
  };

  const handleDeleteDispensaSptf = async (dispensaId: string, lancamentoId?: string) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite exclusão de dispensas.', 'error');
      return;
    }
    const targetDispensa = dispensasSptf.find(d => d.id === dispensaId);
    try {
      await firestoreService.deleteDispensaSptf(dispensaId, lancamentoId);
      storageService.deleteDispensaSptf(dispensaId);
      if (lancamentoId) {
        storageService.deleteTimeRecord(lancamentoId);
        setRecords(prev => prev.filter(r => r.id !== lancamentoId));
      }
      setDispensasSptf(prev => prev.filter(d => d.id !== dispensaId));
      showToast('Guia de Dispensa de SPTF cancelada com sucesso!', 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole,
        canteiroId: targetDispensa?.secaoCanteiro || currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'CANCELAMENTO_DISPENSA',
        detalhes: `Cancelamento de Guia de Dispensa de SPTF #${targetDispensa?.numeroGuia || dispensaId} (Servidor: ${targetDispensa?.nome || targetDispensa?.matricula || 'N/A'}).`,
        recursoId: dispensaId,
      });
    } catch (err: any) {
      console.error('Erro ao excluir dispensa SPTF:', err);
      storageService.deleteDispensaSptf(dispensaId);
      if (lancamentoId) {
        storageService.deleteTimeRecord(lancamentoId);
        setRecords(prev => prev.filter(r => r.id !== lancamentoId));
      }
      setDispensasSptf(prev => prev.filter(d => d.id !== dispensaId));
      showToast('Guia de Dispensa removida localmente.', 'info');
    }
  };

  const handleOpenQuickBatchModal = () => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Apenas Gestores e Super Admins podem realizar lançamentos em lote.', 'error');
      return;
    }
    setIsQuickBatchModalOpen(true);
  };

  const handleViewStatement = (matricula: string) => {
    setSelectedMatricula(matricula);
    setActiveTab('extrato');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewAttachment = (attachment: Attachment, empName?: string, recordDate?: string) => {
    setPreviewAttachment(attachment);
    setPreviewEmployeeName(empName);
    setPreviewRecordDate(recordDate);
  };

  // Handlers para Módulo de Insalubridade
  const handleSaveInsalubrityRecord = async (record: InsalubrityRecord) => {
    try {
      await firestoreService.saveInsalubrityRecord(record);
      storageService.saveInsalubrityRecord(record);
      showToast('Registro de insalubridade gravado com sucesso no Cloud Firestore!');
    } catch (err: any) {
      console.error('Erro ao salvar registro de insalubridade:', err);
      storageService.saveInsalubrityRecord(record);
      showToast('Registro de insalubridade gravado localmente.', 'info');
    }
  };

  const handleSaveInsalubrityBatch = async (recordsToSave: InsalubrityRecord[]) => {
    try {
      await firestoreService.saveInsalubrityBatch(recordsToSave);
      showToast(`${recordsToSave.length} lançamentos de insalubridade salvos com sucesso!`, 'success');
    } catch (err: any) {
      console.error('Erro ao salvar lote de insalubridade:', err);
      for (const r of recordsToSave) {
        storageService.saveInsalubrityRecord(r);
      }
      showToast(`${recordsToSave.length} lançamentos salvos no cache local.`, 'info');
    }
  };

  const handleDeleteInsalubrityRecord = async (id: string) => {
    try {
      await firestoreService.deleteInsalubrityRecord(id);
      storageService.deleteInsalubrityRecord(id);
      showToast('Registro de insalubridade removido.');
    } catch (err: any) {
      console.error('Erro ao deletar registro de insalubridade:', err);
      storageService.deleteInsalubrityRecord(id);
      showToast('Registro removido do cache local.', 'info');
    }
  };

  const handleUpdateEmployeeGrauFixa = async (empId: string, grau: GrauInsalubridade) => {
    const emp = employees.find(e => e.id === empId || e.matricula === empId);
    if (!emp) return;
    const updated = { ...emp, grauInsalubridadeFixa: grau };
    try {
      await firestoreService.saveEmployee(updated);
      const newEmps = employees.map(e => (e.id === empId || e.matricula === empId) ? updated : e);
      setEmployees(newEmps);
      storageService.saveEmployees(newEmps);
      showToast(`Insalubridade contratual de ${emp.nome} atualizada para ${grau}.`);
    } catch (err: any) {
      console.error('Erro ao atualizar insalubridade contratual:', err);
      const newEmps = employees.map(e => (e.id === empId || e.matricula === empId) ? updated : e);
      setEmployees(newEmps);
      storageService.saveEmployees(newEmps);
      showToast(`Insalubridade contratual atualizada no cache local (${grau}).`, 'info');
    }
  };

  const handleSaveSystemConfig = async (cfg: SystemConfig) => {
    try {
      await firestoreService.saveSystemConfig(cfg);
      setSystemConfig(cfg);
      storageService.saveSystemConfig(cfg);
      showToast('Identidade visual COMARA atualizada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar configurações globais:', err);
      setSystemConfig(cfg);
      storageService.saveSystemConfig(cfg);
      showToast('Configurações salvas no cache local.', 'info');
    }
  };

  const handleSaveConstructionSite = async (site: Partial<ConstructionSite>) => {
    const rawCode = site.code || site.codigo || 'KO';
    const rawName = site.name || site.nome || `Canteiro ${rawCode}`;
    const rawChief = site.chief || site.chefeCanteiro || '';
    const rawChefeDa = site.chefeDa || '';
    const rawAuxDa = site.auxDa || '';
    try {
      await firestoreService.saveConstructionSite(site);
      showToast('Canteiro de obras salvo com sucesso no Firestore!');

      // Audit Trail: Passagem de Bastão / Troca de Cargo / Atualização de Canteiro
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole,
        canteiroId: rawCode,
        tipoAcao: 'PASSAGEM_BASTAO',
        detalhes: `Atualização de chefia/dados do canteiro ${rawCode} (${rawName}): Chefe: "${rawChief || 'N/A'}", Chefe DA: "${rawChefeDa || 'N/A'}", Aux DA: "${rawAuxDa || 'N/A'}".`,
        recursoId: site.id || `canteiro-${rawCode}`,
        detalhesJson: {
          canteiroCodigo: rawCode,
          nome: rawName,
          chefeCanteiro: rawChief,
          chefeDa: rawChefeDa,
          auxDa: rawAuxDa,
          status: site.status,
          grauInsalubridade: site.insalubrityLevel || site.grauInsalubridade,
        }
      });
    } catch (err: any) {
      console.error('Erro ao salvar canteiro no Firestore:', err);
      // Fallback local
      const id = site.id || `canteiro-${Date.now()}`;
      const newSite: ConstructionSite = {
        id,
        name: site.name || 'Canteiro',
        code: site.code || 'CT-01',
        branch: site.branch || 'KO',
        status: site.status || 'ACTIVE',
        ...site,
      } as ConstructionSite;
      setConstructionSites((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = newSite;
          return copy;
        }
        return [...prev, newSite];
      });
      showToast('Canteiro salvo no cache local.', 'info');
    }
  };

  const handleDeleteConstructionSite = async (id: string) => {
    const targetSite = constructionSites.find(s => s.id === id);
    try {
      await firestoreService.deleteConstructionSite(id);
      showToast('Canteiro de obras removido com sucesso.');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole,
        canteiroId: targetSite?.code || targetSite?.branch || 'TODOS',
        tipoAcao: 'EXCLUSAO_REGISTRO',
        detalhes: `Exclusão do canteiro de obras "${targetSite?.name || id}" (Código: ${targetSite?.code || 'N/A'}).`,
        recursoId: id,
      });
    } catch (err: any) {
      console.error('Erro ao remover canteiro:', err);
      setConstructionSites((prev) => prev.filter((s) => s.id !== id));
      showToast('Canteiro removido localmente.', 'info');
    }
  };

  const handleSaveBatchPaystubs = async (newPaystubs: PaystubRecord[]) => {
    try {
      setBatchProgress({
        isOpen: true,
        processed: 0,
        total: newPaystubs.length,
        percent: 0,
        chunkIndex: 1,
        totalChunks: Math.ceil(newPaystubs.length / 400),
        title: 'Importando Contracheques Digitais COMARA'
      });

      await firestoreService.saveBatchPaystubs(newPaystubs, (prog) => {
        setBatchProgress({
          isOpen: true,
          processed: prog.processed,
          total: prog.total,
          percent: prog.percent,
          chunkIndex: prog.chunkIndex,
          totalChunks: prog.totalChunks,
          title: 'Importando Contracheques Digitais COMARA'
        });
      });

      setBatchProgress(null);
      showToast(`${newPaystubs.length} contracheques importados e gravados com sucesso!`, 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole,
        canteiroId: currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'IMPORTACAO_FOLHA',
        detalhes: `Importação de folha concluída: ${newPaystubs.length.toLocaleString('pt-BR')} contracheques gravados no Firestore.`,
        detalhesJson: {
          totalContracheques: newPaystubs.length,
          mesAno: newPaystubs[0]?.mesAno || newPaystubs[0]?.periodo || '',
        }
      });
    } catch (err: any) {
      setBatchProgress(null);
      console.error('Erro ao salvar contracheques no Firestore:', err);
      showToast('Erro ao gravar contracheques no Firestore.', 'error');
    }
  };

  const handleDeletePaystub = async (id: string) => {
    try {
      await firestoreService.deletePaystub(id);
      showToast('Contracheque excluído com sucesso.');
    } catch (err: any) {
      console.error('Erro ao deletar contracheque:', err);
      showToast('Erro ao remover contracheque.', 'error');
    }
  };

  const isDark = theme === 'dark';
  const isAdmin = userMode === 'ADMIN' && userRole !== 'AUDITOR';
  const currentUserEmail = currentUser?.email || 'coari.comara@gmail.com';

  // -------------------------------------------------------------
  // RENDER: LOADING STATE
  // -------------------------------------------------------------
  if (isAuthLoading) {
    return (
      <div 
        translate="no"
        className={`notranslate min-h-screen flex items-center justify-center font-mono text-xs ${
          isDark ? 'bg-[#0D0F14] text-white' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
          <span className="text-gray-400">Verificando credenciais Cloud Firestore...</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: PORTAL DO COLABORADOR (LANDING PAGE PADRÃO / LGPD)
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div translate="no" className="notranslate min-h-screen flex flex-col">
        {/* Banner de Aviso de Permissão (se houver) */}
        {firestoreErrorNotice && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-amber-300 text-xs flex items-center justify-between z-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{firestoreErrorNotice} (O sistema está operando com dados locais seguros).</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => initFirestoreSubscriptions()}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 rounded text-[11px] font-bold text-amber-200 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reconectar</span>
              </button>
              <button onClick={() => setFirestoreErrorNotice(null)} className="text-amber-400 hover:text-amber-200 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className={`fixed bottom-5 right-5 z-50 ${
            isDark ? 'bg-[#15171C] text-[#E0E2E5] border-[#1F2229]' : 'bg-white text-slate-900 border-slate-200'
          } px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200`}>
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        <ErrorBoundary fallbackTitle="Portal do Colaborador">
          <CollaboratorLandingView
            employees={employees}
            records={records}
            insalubrityRecords={insalubrityRecords}
            paystubs={paystubs}
            onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onViewAttachment={handleViewAttachment}
          />
        </ErrorBoundary>

        {/* Modal de Login Administrativo RH */}
        <AdminLoginModal
          isOpen={isAdminLoginModalOpen}
          onClose={() => setIsAdminLoginModalOpen(false)}
          onGoogleSignIn={handleGoogleSignIn}
          onEmailSignIn={handleEmailSignIn}
          isDark={isDark}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: VISÃO EXCLUSIVA MOBILE CHEFE / ENCARREGADO / AUX DA (RBAC)
  // -------------------------------------------------------------
  if (
    userRole === 'CHEFE_CANTEIRO' || 
    userRole === 'ENCARREGADO_CANTEIRO' || 
    userRole === 'AUX_DA' || 
    userRole === 'ENCARREGADO_DA'
  ) {
    return (
      <div translate="no" className="notranslate min-h-screen flex flex-col">
        {toastMessage && (
          <div className={`fixed bottom-5 right-5 z-50 ${
            isDark ? 'bg-[#15171C] text-[#E0E2E5] border-[#1F2229]' : 'bg-white text-slate-900 border-slate-200'
          } px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200`}>
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}
        <ErrorBoundary fallbackTitle="Portal de Campo - Canteiro / Divisão Administrativa">
          <SiteSupervisorMobileView
            employees={employees}
            records={records}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onLogout={handleSignOut}
            currentUser={currentUser}
            onOpenSptfDispensa={handleOpenSptfDispensa}
            onOpenNewEntry={(mat) => handleOpenNewEntry(mat)}
            onOpenQuickBatchModal={() => setIsQuickBatchModalOpen(true)}
          />
        </ErrorBoundary>

        {/* Modal: Emissão de Dispensa de SPTF no Canteiro (Guia A4 2 Vias) */}
        <SptfDispensaModal
          isOpen={isSptfDispensaModalOpen}
          onClose={() => {
            setIsSptfDispensaModalOpen(false);
            setSptfDispensaPreselectedMatricula(undefined);
          }}
          employees={employees}
          records={records}
          constructionSites={constructionSites}
          preselectedMatricula={sptfDispensaPreselectedMatricula}
          onSaveDispensa={handleSaveDispensaSptf}
          systemConfig={systemConfig}
          currentUserEmail={currentUserEmail}
          currentUserName={(currentUser as any)?.nome || (currentUser as any)?.displayName || 'Gestor SPTF'}
          theme={theme}
        />

        {/* Modal de Aviso de Expiração de Sessão por Inatividade */}
        <SessionTimeoutModal
          isOpen={isIdleWarning}
          remainingSeconds={idleRemainingSeconds}
          warnSeconds={60}
          profileLabel={idleProfileLabel}
          isDark={isDark}
          onStayLoggedIn={resetIdleTimer}
          onLogoutNow={forceIdleTimeout}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: PAINEL DE GESTÃO RH AUTENTICADO (CLOUD FIRESTORE)
  // -------------------------------------------------------------
  return (
    <div 
      translate="no"
      className={`notranslate min-h-screen ${isDark ? 'bg-[#0A0B0D] text-[#E0E2E5]' : 'bg-[#F8FAFC] text-slate-900'} flex flex-col font-sans antialiased selection:bg-[#3B82F6] selection:text-white transition-colors`}
    >
      
      {/* Banner de Aviso de Permissão de Banco de Dados */}
      {firestoreErrorNotice && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-300 text-xs flex items-center justify-between z-40">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium">{firestoreErrorNotice} (O sistema mantém o funcionamento contínuo via cache local sincronizado).</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => initFirestoreSubscriptions()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-[11px] font-bold text-amber-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tentar Reconectar</span>
            </button>
            <button onClick={() => setFirestoreErrorNotice(null)} className="text-amber-400 hover:text-amber-200 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 ${
          isDark ? 'bg-[#15171C] text-[#E0E2E5] border-[#1F2229]' : 'bg-white text-slate-900 border-slate-200'
        } px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200`}>
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Modal de Progresso de Gravação em Lote (4.500+ registros) */}
      {batchProgress && batchProgress.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${
            isDark ? 'bg-[#15171C] border-[#1F2229] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <Database className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-sm">{batchProgress.title}</h4>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Gravando em lotes atômicos de até 400 registros
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className={isDark ? 'text-gray-400' : 'text-slate-600'}>
                  Lote {batchProgress.chunkIndex} de {batchProgress.totalChunks}
                </span>
                <span className="font-bold text-blue-500">
                  {batchProgress.percent}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-700/30 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                  style={{ width: `${batchProgress.percent}%` }}
                />
              </div>
              <p className={`text-[11px] text-right font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                {batchProgress.processed.toLocaleString('pt-BR')} de {batchProgress.total.toLocaleString('pt-BR')} registros gravados
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewEntry={() => handleOpenNewEntry()}
        onOpenQuickBatchModal={handleOpenQuickBatchModal}
        onOpenSptfDispensa={() => handleOpenSptfDispensa()}
        onResetData={handleTriggerLoadMocksSafety}
        onClearData={handleTriggerClearDataSafety}
        onOpenImportRecordsModal={() => setIsImportRecordsModalOpen(true)}
        onOpenLogoModal={() => setIsLogoModalOpen(true)}
        systemConfig={systemConfig}
        totalEmployees={employees.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        userMode={userMode}
        onToggleUserMode={handleToggleUserMode}
        currentUserEmail={currentUserEmail}
        userRole={userRole}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary fallbackTitle="Erro ao carregar aba selecionada">
          {activeTab === 'dashboard' && (
            <LookerDashboard
              employees={employees}
              records={records}
              onOpenNewEntryModal={(mat) => handleOpenNewEntry(mat)}
              onOpenEditEntryModal={(rec) => handleOpenEditEntry(rec)}
              onDeleteRecord={(id) => handleDeleteRecord(id)}
              onViewEmployeeStatement={(mat) => handleViewStatement(mat)}
              onViewAttachment={handleViewAttachment}
              onOpenImportRecordsModal={() => setIsImportRecordsModalOpen(true)}
              onOpenQuickBatchModal={() => setIsQuickBatchModalOpen(true)}
              onOpenSptfDispensa={() => handleOpenSptfDispensa()}
              onNavigateToEmployees={() => setActiveTab('colaboradores')}
              onResetData={handleTriggerLoadMocksSafety}
              onClearData={handleTriggerClearDataSafety}
              userRole={userRole}
              theme={theme}
            />
          )}

          {activeTab === 'colaboradores' && (
            <EmployeeManagement
              employees={employees}
              records={records}
              onUpdateEmployees={handleUpdateEmployees}
              onViewStatement={(mat) => handleViewStatement(mat)}
              onQuickNewEntry={(mat) => handleOpenNewEntry(mat)}
              theme={theme}
            />
          )}

          {activeTab === 'canteiros' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN', 'RH_ADMIN', 'GESTOR_RH']}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Gestão de Canteiros Restrita"
              fallbackMessage="Apenas administradores de TI (SUPER_ADMIN) ou RH Sede possuem permissão para criar, editar ou desativar canteiros de obras."
            >
              <CanteirosManagement
                constructionSites={constructionSites}
                employees={employees}
                insalubrityRecords={insalubrityRecords}
                onSaveSite={handleSaveConstructionSite}
                onDeleteSite={handleDeleteConstructionSite}
                theme={theme}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'insalubridade' && (
            <ProtectedRoute
              requiredPermission={(role) => rbacService.canValidateInsalubrity(role) || role === 'AUDITOR'}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Módulo de Insalubridade"
              fallbackMessage="Seu perfil não possui autorização para homologação de laudos de insalubridade."
            >
              <InsalubrityManagement
                employees={employees}
                insalubrityRecords={insalubrityRecords}
                onSaveRecord={handleSaveInsalubrityRecord}
                onSaveBatchRecords={handleSaveInsalubrityBatch}
                onDeleteRecord={handleDeleteInsalubrityRecord}
                onUpdateEmployeeGrauFixa={handleUpdateEmployeeGrauFixa}
                onUpdateEmployees={handleUpdateEmployees}
                onNavigateToReports={() => setActiveTab('relatorios')}
                systemConfig={systemConfig}
                onUpdateSystemConfig={handleSaveSystemConfig}
                constructionSites={constructionSites}
                currentUserEmail={currentUserEmail}
                userRole={userRole}
                theme={theme}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'relatorios' && (
            <ExecutiveReportsView
              employees={employees}
              records={records}
              insalubrityRecords={insalubrityRecords}
              constructionSites={constructionSites}
              systemConfig={systemConfig}
              currentUserEmail={currentUserEmail}
              userRole={userRole}
              onSaveInsalubrityBatch={handleSaveInsalubrityBatch}
              onNavigateToInsalubrity={() => setActiveTab('insalubridade')}
              onOpenSptfDispensa={() => handleOpenSptfDispensa()}
              theme={theme}
            />
          )}

          {activeTab === 'extrato' && (
            <EmployeeStatement
              employees={employees}
              records={records}
              insalubrityRecords={insalubrityRecords}
              constructionSites={constructionSites}
              selectedMatricula={selectedMatricula}
              onSelectMatricula={setSelectedMatricula}
              onBack={() => setActiveTab('dashboard')}
              onOpenNewEntry={(mat) => handleOpenNewEntry(mat)}
              onOpenSptfDispensa={(mat) => handleOpenSptfDispensa(mat)}
              onOpenEditEntry={(rec) => handleOpenEditEntry(rec)}
              onDeleteRecord={(id) => handleDeleteRecord(id)}
              onViewAttachment={handleViewAttachment}
              theme={theme}
            />
          )}

          {activeTab === 'portal_colaborador' && (
            <EmployeeSelfServicePortal
              employees={employees}
              records={records}
              paystubs={paystubs}
              theme={theme}
            />
          )}

          {activeTab === 'contracheques' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN', 'RH_ADMIN', 'GESTOR_RH']}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Gestão de Folha & Contracheques Restrita"
              fallbackMessage="A importação da folha de pagamento e gestão de espelhos de contracheque são exclusivas da equipe central de RH (Sede) e TI."
            >
              <ContrachequesManagement
                employees={employees}
                paystubs={paystubs}
                onSaveBatchPaystubs={handleSaveBatchPaystubs}
                onSaveEmployees={handleUpdateEmployees}
                onDeletePaystub={handleDeletePaystub}
                currentUserEmail={currentUserEmail}
                userRole={userRole}
                theme={theme}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'permissoes_admin' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN']}
              requiredPermission={(role, u) => rbacService.canManageAdmins(role, u?.email)}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Gestão de Permissões e Acessos RH"
              fallbackMessage="O gerenciamento de usuários administrativos, regras de 48h e níveis de acesso é de uso exclusivo do Super Administrador (TI)."
            >
              <AdminPermissionsManagement
                theme={theme}
                currentUserEmail={currentUserEmail}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'auditoria' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN', 'RH_ADMIN', 'GESTOR_RH', 'AUDITOR']}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Trilha de Auditoria & Logs de Segurança"
              fallbackMessage="O acesso aos registros de auditoria e logs de segurança é restrito a Administradores (Super Admin e RH Admin) para conformidade com a LGPD."
            >
              <AuditTrailView
                constructionSites={constructionSites}
                currentUserEmail={currentUserEmail}
                userRole={userRole}
                theme={theme}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'arquitetura' && (
            <GoogleArchitectureSpec theme={theme} />
          )}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className={`${isDark ? 'bg-[#0D0F14] border-[#1F2229] text-[#8E9299]' : 'bg-white border-slate-200 text-slate-500'} border-t py-4 px-6 text-center text-xs mt-auto transition-colors`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-mono text-[11px] flex items-center gap-1.5 justify-center sm:justify-start">
            <Cloud className="w-3.5 h-3.5 text-blue-500" />
            <span>Base Oficial Conectada ao Cloud Firestore ({employees.length.toLocaleString('pt-BR')} colaboradores • {records.length.toLocaleString('pt-BR')} lançamentos)</span>
          </span>
          <span className="text-[11px] font-sans">
            COMARA • Sistema de Gestão de Banco de Horas SPTF & LGPD
          </span>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Modal: Lançamento Diário Individual */}
      <DailyEntryModal
        isOpen={isDailyEntryModalOpen}
        onClose={() => setIsDailyEntryModalOpen(false)}
        employees={employees}
        preselectedMatricula={dailyEntryPreselectedMatricula}
        preselectedDate={dailyEntryPreselectedDate}
        initialRecord={dailyEntryInitialRecord}
        onSaveRecord={handleSaveRecord}
        onSaveBatch={handleImportRecordsBatch}
        onDeleteRecord={handleDeleteRecord}
        theme={theme}
      />

      {/* 2. Modal: Lançamento Rápido em Lote */}
      <QuickBatchEntryModal
        isOpen={isQuickBatchModalOpen}
        onClose={() => setIsQuickBatchModalOpen(false)}
        employees={employees}
        onSaveBatch={handleImportRecordsBatch}
        userRole={userRole}
        theme={theme}
      />

      {/* 3. Modal: Emissão de Dispensa de SPTF (Compensação com Guia A4 2 Vias) */}
      <SptfDispensaModal
        isOpen={isSptfDispensaModalOpen}
        onClose={() => {
          setIsSptfDispensaModalOpen(false);
          setSptfDispensaPreselectedMatricula(undefined);
        }}
        employees={employees}
        records={records}
        constructionSites={constructionSites}
        preselectedMatricula={sptfDispensaPreselectedMatricula}
        onSaveDispensa={handleSaveDispensaSptf}
        systemConfig={systemConfig}
        currentUserEmail={currentUserEmail}
        currentUserName={(currentUser as any)?.nome || (currentUser as any)?.displayName || 'Gestor SPTF'}
        theme={theme}
      />

      {/* 4. Modal: Importar Lançamentos Diários CSV */}
      <ImportTimeRecordsModal
        isOpen={isImportRecordsModalOpen}
        onClose={() => setIsImportRecordsModalOpen(false)}
        employees={employees}
        onImportRecords={handleImportRecordsBatch}
        theme={theme}
      />

      {/* 5. Modal: Pré-visualização de Atestados / Certificados */}
      <CertificatePreviewModal
        isOpen={previewAttachment !== null}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
        employeeName={previewEmployeeName}
        recordDate={previewRecordDate}
        theme={theme}
      />

      {/* 6. Modal: Configuração de Logo e Identidade Visual COMARA */}
      <ComaraLogoModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        currentConfig={systemConfig}
        onSaveConfig={handleSaveSystemConfig}
        theme={theme}
      />

      {/* 7. Modal: Confirmação e Segurança de Banco de Dados com Ponto de Restauração */}
      <DatabaseSafetyActionModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        actionType={safetyActionType}
        employees={employees}
        records={records}
        insalubrityRecords={insalubrityRecords}
        constructionSites={constructionSites}
        systemConfig={systemConfig}
        onConfirmClear={handleExecuteClearDatabase}
        onConfirmLoadMocks={handleExecuteLoadMocks}
        onRestoreSnapshot={handleRestoreSnapshot}
        theme={theme}
      />

      {/* 8. Modal de Aviso de Expiração de Sessão por Inatividade (Auto-Logoff) */}
      <SessionTimeoutModal
        isOpen={isIdleWarning}
        remainingSeconds={idleRemainingSeconds}
        warnSeconds={60}
        profileLabel={idleProfileLabel}
        isDark={isDark}
        onStayLoggedIn={resetIdleTimer}
        onLogoutNow={forceIdleTimeout}
      />
    </div>
  );
}
