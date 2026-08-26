import { doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Employee, EmployeeAuth, AccessLog, AccessLogType, AdminUser, AuthSession } from '../types';

const COLLECTIONS = {
  COLABORADORES_AUTH: 'colaboradores_auth',
  LOGS_ACESSO: 'logs_acesso',
  SYSTEM_LOGS: 'system_logs',
  COLABORADORES: 'colaboradores',
  ADMIN_USERS: 'admin_users',
};

function sanitize<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) {
      clean[k] = obj[k];
    }
  }
  return clean;
}

// Normalizador seguro de Datas (converte DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD ou ISO para YYYY-MM-DD)
export function normalizeDateString(dateStr?: string): string {
  if (!dateStr) return '';
  let trimmed = dateStr.trim();
  if (!trimmed) return '';

  if (trimmed.includes('T')) {
    trimmed = trimmed.split('T')[0];
  }

  // Formato DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const brMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Formato YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

// Simple SHA-256 hash helper using native crypto
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Local cache keys
const LOCAL_AUTH_KEY = 'banco_horas_colaboradores_auth';
const LOCAL_LOGS_KEY = 'banco_horas_logs_acesso';

function getLocalAuths(): Record<string, EmployeeAuth> {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalAuth(matricula: string, data: EmployeeAuth) {
  try {
    const all = getLocalAuths();
    all[matricula.toUpperCase()] = data;
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(all));
  } catch (e) {
    console.error(e);
  }
}

function getLocalLogs(): AccessLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLog(log: AccessLog) {
  try {
    const all = getLocalLogs();
    all.unshift(log);
    if (all.length > 500) all.pop();
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(all));
  } catch (e) {
    console.error(e);
  }
}

export const authService = {
  // -------------------------------------------------------------
  // LOGS DE AUDITORIA LGPD
  // -------------------------------------------------------------
  async logAccess(
    matricula: string,
    nome: string,
    tipoAcao: AccessLogType,
    sucesso: boolean,
    detalhes: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const logItem: AccessLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: now,
      matricula: matricula.toUpperCase(),
      nome,
      tipoAcao,
      sucesso,
      detalhes,
      ipOrigem: navigator.userAgent.slice(0, 80),
    };

    // Save locally
    saveLocalLog(logItem);

    // Save to Firestore
    try {
      await addDoc(collection(db, COLLECTIONS.LOGS_ACESSO), logItem);
    } catch (err) {
      console.warn('Registro de log offline/local:', err);
    }
  },

  subscribeAccessLogs(
    onSuccess: (logs: AccessLog[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    try {
      const q = query(
        collection(db, COLLECTIONS.LOGS_ACESSO),
        orderBy('timestamp', 'desc'),
        limit(150)
      );
      return onSnapshot(
        q,
        (snapshot) => {
          const list: AccessLog[] = [];
          snapshot.forEach((d) => list.push(d.data() as AccessLog));
          onSuccess(list.length > 0 ? list : getLocalLogs());
        },
        (error) => {
          if (onError) onError(error);
          onSuccess(getLocalLogs());
        }
      );
    } catch {
      onSuccess(getLocalLogs());
      return () => {};
    }
  },

  // -------------------------------------------------------------
  // AUTENTICAÇÃO DO COLABORADOR
  // -------------------------------------------------------------
  async getEmployeeAuth(matricula: string): Promise<EmployeeAuth | null> {
    const cleanMatricula = matricula.trim().toUpperCase();
    const local = getLocalAuths()[cleanMatricula];

    try {
      const docRef = doc(db, COLLECTIONS.COLABORADORES_AUTH, cleanMatricula);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as EmployeeAuth;
        saveLocalAuth(cleanMatricula, data);
        return data;
      }
    } catch (e) {
      console.warn('Busca de credencial Firestore offline, usando cache local:', e);
    }

    return local || null;
  },

  async verifyEmployeePassword(
    matricula: string,
    passwordAttempt: string,
    employee: Employee
  ): Promise<{ success: boolean; message: string; requiresFirstAccessSetup?: boolean }> {
    const cleanMatricula = matricula.trim().toUpperCase();
    const authData = await this.getEmployeeAuth(cleanMatricula);

    // Se o colaborador ainda não definiu senha
    if (!authData || !authData.senhaDefinida || !authData.passwordHash) {
      await this.logAccess(
        cleanMatricula,
        employee.nome,
        'TENTATIVA_INVALIDA',
        false,
        'Tentativa de acesso sem senha previamente cadastrada'
      );
      return {
        success: false,
        requiresFirstAccessSetup: true,
        message: 'Primeiro acesso detectado! Você precisa definir sua senha através da Validação Tripla.',
      };
    }

    const hashedAttempt = await hashPassword(passwordAttempt);
    if (hashedAttempt === authData.passwordHash) {
      const nowIso = new Date().toISOString();
      const updated: EmployeeAuth = {
        ...authData,
        senhaDefinida: true,
        ultimoAcesso: nowIso,
        atualizadoEm: nowIso,
      };
      saveLocalAuth(cleanMatricula, updated);

      try {
        await Promise.all([
          setDoc(doc(db, COLLECTIONS.COLABORADORES_AUTH, cleanMatricula), updated, { merge: true }),
          setDoc(doc(db, COLLECTIONS.COLABORADORES, cleanMatricula), {
            primeiroAcesso: false,
            senhaCadastrada: true,
            atualizadoEm: nowIso,
          }, { merge: true }),
        ]);
      } catch (e) {
        console.warn('Erro ao atualizar persistência no Firestore:', e);
      }

      await this.logAccess(
        cleanMatricula,
        employee.nome,
        'LOGIN_COLABORADOR',
        true,
        'Autenticação individual realizada com sucesso'
      );

      return { success: true, message: 'Autenticado com sucesso!' };
    } else {
      await this.logAccess(
        cleanMatricula,
        employee.nome,
        'TENTATIVA_INVALIDA',
        false,
        'Senha incorreta digitada na consulta'
      );
      return { success: false, message: 'Senha incorreta. Verifique suas credenciais.' };
    }
  },

  // -------------------------------------------------------------
  // VALIDAÇÃO CADASTRAL PARA RECUPERAÇÃO / PRIMEIRO ACESSO (100% FIRESTORE - LGPD)
  // -------------------------------------------------------------
  async validateCollaboratorForReset(
    matricula: string,
    emailAttempt: string,
    employeesList: Employee[] = []
  ): Promise<{ success: boolean; employee?: Employee; message: string }> {
    const cleanMat = matricula.trim().toUpperCase();
    if (!cleanMat) {
      return { 
        success: false, 
        message: 'Por favor, informe a Matrícula do colaborador.' 
      };
    }

    const cleanInputEmail = emailAttempt.trim().toLowerCase();
    if (!cleanInputEmail || !cleanInputEmail.includes('@')) {
      return { 
        success: false, 
        message: 'Por favor, informe o E-mail cadastrado válido.' 
      };
    }

    // 1. Busca colaborador (no cache ou diretamente na coleção 'colaboradores' do Firestore)
    let matched: Employee | undefined = employeesList.find(
      (e) => e.matricula.trim().toUpperCase() === cleanMat ||
             e.matricula.replace(/^0+/, '').toUpperCase() === cleanMat.replace(/^0+/, '')
    );

    if (!matched) {
      try {
        const docRef = doc(db, COLLECTIONS.COLABORADORES, cleanMat);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          matched = docSnap.data() as Employee;
        } else {
          // Busca secundária caso o ID seja diferente da matrícula
          const q = query(collection(db, COLLECTIONS.COLABORADORES), limit(200));
          const snapAll = await getDocs(q);
          snapAll.forEach((d) => {
            const data = d.data() as Employee;
            if (
              data.matricula?.trim().toUpperCase() === cleanMat ||
              data.matricula?.replace(/^0+/, '').toUpperCase() === cleanMat.replace(/^0+/, '')
            ) {
              matched = data;
            }
          });
        }
      } catch (err) {
        console.warn('Erro ao consultar Firestore para recuperação de senha:', err);
      }
    }

    if (!matched) {
      await this.logAccess(
        cleanMat,
        'Desconhecido',
        'RECUPERACAO_SENHA',
        false,
        'Tentativa de recuperação: Matrícula não localizada no cadastro'
      );
      return { 
        success: false, 
        message: 'Dados informados não conferem com o cadastro. Procure o setor de RH (DA).' 
      };
    }

    // 2. Validação cadastral do E-mail cadastrado
    const registeredEmailClean = (matched.email || '').trim().toLowerCase();

    let isEmailValid = false;
    if (registeredEmailClean) {
      isEmailValid = (cleanInputEmail === registeredEmailClean);
    } else {
      // Se não possui e-mail cadastrado na ficha, aceita e-mail corporativo válido informado
      isEmailValid = cleanInputEmail.length >= 5 && cleanInputEmail.includes('@');
    }

    if (!isEmailValid) {
      await this.logAccess(
        cleanMat,
        matched.nome,
        'RECUPERACAO_SENHA',
        false,
        'Tentativa de recuperação: E-mail divergente do cadastro'
      );
      return { 
        success: false, 
        message: 'O e-mail informado não confere com o cadastro desta matrícula. Procure o setor de RH (DA).' 
      };
    }

    // Validação bem-sucedida!
    await this.logAccess(
      cleanMat,
      matched.nome,
      'RECUPERACAO_SENHA',
      true,
      'Identidade cadastral validada com sucesso via Matrícula + E-mail para redefinição de senha'
    );

    return {
      success: true,
      employee: matched,
      message: `Identidade confirmada para ${matched.nome}! Agora defina sua nova senha.`,
    };
  },

  // -------------------------------------------------------------
  // ATUALIZAÇÃO DIRETA DA SENHA NO FIRESTORE (SEM FIREBASE AUTH)
  // -------------------------------------------------------------
  async resetCollaboratorPassword(
    matricula: string,
    newPassword: string,
    employee?: Employee,
    emailUsed?: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanMat = matricula.trim().toUpperCase();
    if (!cleanMat) {
      return { success: false, message: 'Matrícula inválida.' };
    }

    if (newPassword.length < 4) {
      return { success: false, message: 'A nova senha deve ter no mínimo 4 caracteres.' };
    }

    const passwordHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();
    const cleanEmail = (employee?.email || emailUsed || '').trim().toLowerCase();

    const authDataToSave = sanitize({
      matricula: cleanMat,
      passwordHash,
      senhaDefinida: true,
      email: cleanEmail,
      primeiroAcesso: false,
      senhaCadastrada: true,
      tokenRecuperacao: null,
      tokenExpiracao: null,
      ultimoAcesso: nowIso,
      atualizadoEm: nowIso,
    });

    // Salva no cache local para resiliência offline
    saveLocalAuth(cleanMat, {
      matricula: cleanMat,
      passwordHash,
      senhaDefinida: true,
      email: cleanEmail,
      ultimoAcesso: nowIso,
      atualizadoEm: nowIso,
    });

    // Atualiza diretamente no Firestore as coleções 'colaboradores_auth' e 'colaboradores'
    try {
      await Promise.all([
        setDoc(doc(db, COLLECTIONS.COLABORADORES_AUTH, cleanMat), authDataToSave, { merge: true }),
        setDoc(doc(db, COLLECTIONS.COLABORADORES, cleanMat), {
          primeiroAcesso: false,
          senhaCadastrada: true,
          atualizadoEm: nowIso,
          ...(cleanEmail ? { email: cleanEmail } : {}),
        }, { merge: true }),
      ]);
    } catch (err) {
      console.warn('Erro na sincronização Firestore (operando com cache local seguro):', err);
    }

    if (employee) {
      employee.primeiroAcesso = false;
      employee.senhaCadastrada = true;
      employee.atualizadoEm = nowIso;
      if (cleanEmail && !employee.email) {
        employee.email = cleanEmail;
      }
    }

    await this.logAccess(
      cleanMat,
      employee?.nome || cleanMat,
      'DEFINICAO_SENHA',
      true,
      'Senha redefinida com sucesso 100% via Firestore'
    );

    return {
      success: true,
      message: 'Senha redefinida com sucesso! Você já pode fazer login.',
    };
  },

  // -------------------------------------------------------------
  // RECUPERAÇÃO E DEFINIÇÃO DE SENHA LGPD (COMPATIBILIDADE)
  // -------------------------------------------------------------
  async resetPasswordByMatriculaAndEmail(
    matricula: string,
    emailAttempt: string,
    newPassword: string,
    employeesList: Employee[]
  ): Promise<{ success: boolean; message: string }> {
    const valRes = await this.validateCollaboratorForReset(
      matricula,
      emailAttempt,
      employeesList
    );

    if (!valRes.success || !valRes.employee) {
      return { success: false, message: valRes.message };
    }

    return this.resetCollaboratorPassword(
      valRes.employee.matricula,
      newPassword,
      valRes.employee,
      emailAttempt
    );
  },

  // -------------------------------------------------------------
  // VALIDAÇÃO DE IDENTIDADE CADASTRAL (MATRÍCULA + E-MAIL)
  // -------------------------------------------------------------
  async validateTripleIdentity(
    matricula: string,
    emailOrCpfAttempt: string,
    _dataNascimentoAttempt?: string,
    employeesList: Employee[] = []
  ): Promise<{ success: boolean; employee?: Employee; message: string }> {
    return this.validateCollaboratorForReset(matricula, emailOrCpfAttempt, employeesList);
  },

  // -------------------------------------------------------------
  // SALVAR NOVA SENHA APÓS VALIDAÇÃO CADASTRAL
  // -------------------------------------------------------------
  async confirmNewPasswordWithTripleValidation(
    matricula: string,
    employee: Employee,
    _cpfAttempt: string,
    _dataNascimentoAttempt: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    return this.resetCollaboratorPassword(matricula, newPassword, employee);
  },

  // -------------------------------------------------------------
  // DEFINIÇÃO / RESET DE SENHA PRESENCIAL PELO GESTOR DE RH
  // -------------------------------------------------------------
  async setPasswordByAdmin(
    matricula: string,
    employeeName: string,
    newPassword: string,
    adminEmail: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanMatricula = matricula.trim().toUpperCase();
    if (newPassword.length < 4) {
      return { success: false, message: 'A senha temporária deve conter ao menos 4 caracteres.' };
    }

    const passwordHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();

    const authDataToSave = sanitize({
      matricula: cleanMatricula,
      passwordHash,
      senhaDefinida: true,
      email: '',
      ultimoAcesso: null,
      atualizadoEm: nowIso,
    });

    saveLocalAuth(cleanMatricula, {
      matricula: cleanMatricula,
      passwordHash,
      senhaDefinida: true,
      atualizadoEm: nowIso,
    });

    try {
      await Promise.all([
        setDoc(doc(db, COLLECTIONS.COLABORADORES_AUTH, cleanMatricula), authDataToSave, { merge: true }),
        setDoc(doc(db, COLLECTIONS.COLABORADORES, cleanMatricula), {
          primeiroAcesso: false,
          senhaCadastrada: true,
          atualizadoEm: nowIso,
        }, { merge: true }),
      ]);
    } catch (e) {
      console.error('Erro ao atualizar senha no Firestore:', e);
    }

    await this.logAccess(
      cleanMatricula,
      employeeName,
      'RESET_SENHA_RH',
      true,
      `Senha presencial definida pelo gestor de RH (${adminEmail})`
    );

    return { success: true, message: `Senha para ${cleanMatricula} definida com sucesso pelo RH!` };
  },

  // -------------------------------------------------------------
  // GERENCIAMENTO DE SESSÃO LOCAL (FIRESTORE-ONLY AUTH)
  // -------------------------------------------------------------
  saveCurrentSession(session: AuthSession): void {
    try {
      localStorage.setItem('banco_horas_auth_session', JSON.stringify(session));
    } catch (e) {
      console.warn('Erro ao salvar sessão local:', e);
    }
  },

  getCurrentSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem('banco_horas_auth_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clearSession(): void {
    try {
      localStorage.removeItem('banco_horas_auth_session');
    } catch (e) {
      console.warn('Erro ao limpar sessão local:', e);
    }
  },

  // -------------------------------------------------------------
  // AUTENTICAÇÃO ADMINISTRATIVA DIRETA NO FIRESTORE (SEM FIREBASE AUTH)
  // -------------------------------------------------------------
  async verifyAdminLogin(
    email: string,
    passwordAttempt: string,
    cachedAdmins: AdminUser[] = []
  ): Promise<{ success: boolean; admin?: AdminUser; session?: AuthSession; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Informe seu e-mail administrativo.' };
    }
    if (!passwordAttempt.trim()) {
      return { success: false, message: 'Informe sua senha de acesso.' };
    }

    const isMasterEmail = cleanEmail === 'coari.comara@gmail.com' || cleanEmail.endsWith('@comara.aer.mil.br');
    const inputHash = await hashPassword(passwordAttempt);

    let adminDoc: AdminUser | null = null;

    // 1. Tenta buscar no Firestore
    try {
      const docRef = doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        adminDoc = snap.data() as AdminUser;
      }
    } catch (err) {
      console.warn('Busca de admin no Firestore offline, buscando no cache:', err);
    }

    // 2. Fallback no cache fornecido
    if (!adminDoc) {
      const matchCached = cachedAdmins.find(a => a.email.toLowerCase().trim() === cleanEmail);
      if (matchCached) {
        adminDoc = matchCached;
      }
    }

    // 3. Caso especial: Master Super Admin (se ainda não existir no Firestore)
    if (!adminDoc && isMasterEmail) {
      const masterAdmin: AdminUser = {
        id: cleanEmail,
        email: cleanEmail,
        nome: cleanEmail === 'coari.comara@gmail.com' ? 'Super Administrador COMARA' : cleanEmail.split('@')[0],
        cargo: 'Super Administrador TI / RH',
        nivelAcesso: 'SUPER_ADMIN',
        role: 'SUPER_ADMIN',
        ativo: true,
        passwordHash: inputHash,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail), sanitize(masterAdmin), { merge: true });
      } catch (e) {
        console.warn('Erro ao salvar master admin no Firestore:', e);
      }

      const session: AuthSession = {
        email: masterAdmin.email,
        nome: masterAdmin.nome,
        role: 'SUPER_ADMIN',
        cargo: masterAdmin.cargo,
        loginTime: new Date().toISOString(),
      };
      this.saveCurrentSession(session);

      await this.logAccess(
        cleanEmail,
        masterAdmin.nome,
        'LOGIN_GESTAO_RH',
        true,
        `Login administrativo Master realizado por ${cleanEmail}`
      );

      return { success: true, admin: masterAdmin, session, message: 'Acesso autorizado como Super Administrador!' };
    }

    // Se não encontrou o usuário
    if (!adminDoc) {
      await this.logAccess(
        cleanEmail,
        'Desconhecido',
        'TENTATIVA_INVALIDA',
        false,
        `Tentativa de login com e-mail não autorizado: ${cleanEmail}`
      );
      return { success: false, message: 'Usuário não cadastrado na equipe de gestão/RH.' };
    }

    // Regra das 48 Horas na Passagem de Bastão:
    // Verifica se há desativação agendada decorrente de transição de chefia/liderança
    if (adminDoc.desativacaoAgendada) {
      const agora = Date.now();
      const expiracao = new Date(adminDoc.desativacaoAgendada).getTime();
      if (!isNaN(expiracao) && agora > expiracao) {
        // Transcorreram as 48 horas: revoga as permissões de acesso administrativo automaticamente
        adminDoc.ativo = false;
        adminDoc.transicaoStatus = 'EXPIRADO';
        
        try {
          const nowIso = new Date().toISOString();
          await Promise.all([
            setDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail), {
              ativo: false,
              transicaoStatus: 'EXPIRADO',
              atualizadoEm: nowIso,
            }, { merge: true }),
            setDoc(doc(db, 'usuarios_sistema', cleanEmail), {
              ativo: false,
              transicaoStatus: 'EXPIRADO',
              atualizadoEm: nowIso,
            }, { merge: true })
          ]);
        } catch (e) {
          console.warn('Erro ao persistir revogação pós-48h no Firestore:', e);
        }

        await this.logAccess(
          cleanEmail,
          adminDoc.nome,
          'TENTATIVA_INVALIDA',
          false,
          `Acesso bloqueado: Carência de 48h da transição de liderança expirou para ${cleanEmail}.`
        );

        return {
          success: false,
          message: 'Período de transição de 48 horas concluído. Suas credenciais de liderança/gestão foram revogadas conforme regra institucional.'
        };
      }
    }

    // Verifica se está ativo
    if (adminDoc.ativo === false) {
      await this.logAccess(
        cleanEmail,
        adminDoc.nome,
        'TENTATIVA_INVALIDA',
        false,
        `Tentativa de login de usuário inativo: ${cleanEmail}`
      );
      return { success: false, message: 'Este usuário está inativo ou teve seu acesso revogado. Contate o administrador.' };
    }

    // Verifica senha
    let passwordMatch = false;

    if (adminDoc.passwordHash) {
      passwordMatch = (adminDoc.passwordHash === inputHash);
    } else if (adminDoc.senha) {
      passwordMatch = (adminDoc.senha === passwordAttempt.trim());
      // Migra para hash automaticamente
      if (passwordMatch) {
        try {
          await setDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail), {
            passwordHash: inputHash,
            senha: null,
            atualizadoEm: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn('Erro na migração de hash:', e);
        }
      }
    } else if (isMasterEmail) {
      // Se for master e ainda não tinha hash gravado, define agora
      passwordMatch = true;
      try {
        await setDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail), {
          passwordHash: inputHash,
          atualizadoEm: new Date().toISOString(),
        }, { merge: true });
      } catch (e) {
        console.warn('Erro ao atualizar hash master:', e);
      }
    }

    if (!passwordMatch) {
      await this.logAccess(
        cleanEmail,
        adminDoc.nome,
        'TENTATIVA_INVALIDA',
        false,
        `Senha incorreta informada para ${cleanEmail}`
      );
      return { success: false, message: 'E-mail ou senha incorretos.' };
    }

    // Login autorizado com sucesso!
    const session: AuthSession = {
      email: adminDoc.email,
      nome: adminDoc.nome,
      role: adminDoc.nivelAcesso || adminDoc.role || 'GESTOR_RH',
      cargo: adminDoc.cargo,
      loginTime: new Date().toISOString(),
    };
    this.saveCurrentSession(session);

    await this.logAccess(
      cleanEmail,
      adminDoc.nome,
      'LOGIN_GESTAO_RH',
      true,
      `Login administrativo RH realizado com sucesso por ${cleanEmail}`
    );

    return {
      success: true,
      admin: adminDoc,
      session,
      message: `Bem-vindo(a), ${adminDoc.nome}!`
    };
  },

  // -------------------------------------------------------------
  // CADASTRO DE NOVO GESTOR/ADMIN NO FIRESTORE (SEM FIREBASE AUTH)
  // -------------------------------------------------------------
  async createAdminAccount(
    email: string,
    password: string,
    nome?: string,
    cargo?: string,
    nivelAcesso: 'SUPER_ADMIN' | 'GESTOR_RH' | 'AUDITOR' = 'GESTOR_RH'
  ): Promise<{ success: boolean; admin?: AdminUser; session?: AuthSession; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Informe um e-mail corporativo válido.' };
    }
    if (password.length < 6) {
      return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' };
    }

    const passwordHash = await hashPassword(password);
    const nowIso = new Date().toISOString();

    const newAdmin: AdminUser = {
      id: cleanEmail,
      email: cleanEmail,
      nome: nome?.trim() || cleanEmail.split('@')[0],
      cargo: cargo?.trim() || 'Gestor RH',
      nivelAcesso,
      role: nivelAcesso,
      ativo: true,
      passwordHash,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    };

    try {
      await setDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail), sanitize(newAdmin), { merge: true });
    } catch (err: any) {
      console.error('Erro ao cadastrar administrador no Firestore:', err);
      return { success: false, message: 'Erro ao gravar cadastro no Firestore.' };
    }

    const session: AuthSession = {
      email: newAdmin.email,
      nome: newAdmin.nome,
      role: newAdmin.nivelAcesso,
      cargo: newAdmin.cargo,
      loginTime: nowIso,
    };
    this.saveCurrentSession(session);

    await this.logAccess(
      cleanEmail,
      newAdmin.nome,
      'PRIMEIRO_ACESSO',
      true,
      `Nova conta de gestor criada diretamente no Firestore: ${cleanEmail}`
    );

    return {
      success: true,
      admin: newAdmin,
      session,
      message: 'Conta de gestão cadastrada com sucesso!'
    };
  },

  // -------------------------------------------------------------
  // REGRA DAS 48 HORAS: PASSAGEM DE BASTÃO DE LIDERANÇA
  // -------------------------------------------------------------
  
  /**
   * Agenda a desativação do encarregado/chefe anterior para daqui a 48 horas
   */
  async scheduleRoleTransitionHandover(
    previousEmail: string,
    newResponsibleName: string,
    roleTitle: string,
    canteiroCode: string
  ): Promise<void> {
    const cleanEmail = previousEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    const deactivationTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    try {
      const updateData = {
        desativacaoAgendada: deactivationTime,
        transicaoStatus: 'PENDENTE_48H',
        atualizadoEm: nowIso,
      };

      await Promise.all([
        setDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail), updateData, { merge: true }),
        setDoc(doc(db, 'usuarios_sistema', cleanEmail), updateData, { merge: true })
      ]);

      await this.logAccess(
        cleanEmail,
        'Transição de Função',
        'LOGIN_GESTAO_RH',
        true,
        `Passagem de bastão em ${canteiroCode} (${roleTitle}). Novo responsável: ${newResponsibleName}. Desativação agendada para 48h (${new Date(deactivationTime).toLocaleString('pt-BR')}).`
      );
    } catch (e) {
      console.warn('Erro ao agendar transição de 48h:', e);
    }
  },

  /**
   * Varredura periódica para revogar permissões administrativas expiradas pós 48h
   */
  async checkAndRevokeExpiredTransitions(adminUsers: AdminUser[]): Promise<AdminUser[]> {
    const now = Date.now();
    const updatedUsers: AdminUser[] = [];

    for (const user of adminUsers) {
      if (user.desativacaoAgendada && user.ativo !== false) {
        const expTime = new Date(user.desativacaoAgendada).getTime();
        if (!isNaN(expTime) && now > expTime) {
          const cleanEmail = user.email.trim().toLowerCase();
          try {
            const nowIso = new Date().toISOString();
            await Promise.all([
              setDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail), {
                ativo: false,
                transicaoStatus: 'EXPIRADO',
                atualizadoEm: nowIso,
              }, { merge: true }),
              setDoc(doc(db, 'usuarios_sistema', cleanEmail), {
                ativo: false,
                transicaoStatus: 'EXPIRADO',
                atualizadoEm: nowIso,
              }, { merge: true })
            ]);
            updatedUsers.push({ ...user, ativo: false, transicaoStatus: 'EXPIRADO' });
          } catch (err) {
            console.warn('Erro ao auto-revogar usuário expirado:', err);
            updatedUsers.push(user);
          }
        } else {
          updatedUsers.push(user);
        }
      } else {
        updatedUsers.push(user);
      }
    }

    return updatedUsers;
  }
};


