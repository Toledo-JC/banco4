import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  onSnapshot, 
  query, 
  orderBy,
  Unsubscribe 
} from 'firebase/firestore';
import { db, logFirestoreError, handleFirestoreError, OperationType, isPermissionError } from './firebase';
import { Employee, TimeRecord, AdminUser, AdminRole, InsalubrityRecord, SystemConfig, ConstructionSite, PaystubRecord } from '../types';
import { hashPassword } from './authService';
import { canteiroService } from './canteiroService';

export const COLLECTIONS = {
  COLABORADORES: 'colaboradores',
  LANCAMENTOS: 'lancamentos',
  ADMIN_USERS: 'admin_users',
  RESUMO_MENSAL: 'resumo_mensal',
  COLABORADORES_AUTH: 'colaboradores_auth',
  SYSTEM_LOGS: 'system_logs',
  INSALUBRIDADE: 'insalubridade_records',
  SYSTEM_CONFIG: 'system_config',
  CANTEIROS: 'canteiros_obras',
  CONTRACHEQUES: 'contracheques',
};

export interface BatchProgressInfo {
  processed: number;
  total: number;
  percent: number;
  chunkIndex: number;
  totalChunks: number;
}

// Sanitizador universal para remover qualquer chave undefined antes de enviar ao Firestore
export function sanitizeFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

// Higienizador robusto com valores padrão garantidos para Colaboradores
export function prepareEmployeeForFirestore(emp: Partial<Employee>): Record<string, any> {
  const cleanMatricula = (emp.matricula || emp.id || '').trim().toUpperCase();
  const hasSenhaInicial = Boolean(emp.senhaInicial && emp.senhaInicial.trim().length >= 4);
  const rawPrimeiroAcesso = hasSenhaInicial ? false : emp.primeiroAcesso;
  const rawSenhaCadastrada = hasSenhaInicial ? true : emp.senhaCadastrada;

  return sanitizeFirestoreData({
    id: cleanMatricula || emp.id || `emp-${Date.now()}`,
    matricula: cleanMatricula,
    nome: (emp.nome || '').trim(),
    funcao: emp.funcao || emp.cargo || 'Técnico de Manutenção',
    cargo: emp.cargo || emp.funcao || 'Técnico de Manutenção',
    sede: emp.sede || 'KO',
    sede_origem: emp.sede_origem || emp.sede || 'KO',
    sede_atual: emp.sede_atual || emp.sede || 'KO',
    dataAdmissao: emp.dataAdmissao || '2026-01-01',
    status: emp.status || 'Ativo',
    grauInsalubridadeFixa: emp.grauInsalubridadeFixa || 'ISENTO',
    saldoInicialHoras: typeof emp.saldoInicialHoras === 'number' && !isNaN(emp.saldoInicialHoras) ? emp.saldoInicialHoras : 0,
    primeiroAcesso: typeof rawPrimeiroAcesso === 'boolean' ? rawPrimeiroAcesso : true,
    senhaCadastrada: typeof rawSenhaCadastrada === 'boolean' ? rawSenhaCadastrada : false,
    telefone: emp.telefone || '',
    email: emp.email || '',
    horarioTrabalho: emp.horarioTrabalho || '',
    url_foto_perfil: emp.url_foto_perfil || emp.avatarUrl || '',
    avatarUrl: emp.avatarUrl || emp.url_foto_perfil || '',
    id_drive_foto: emp.id_drive_foto || '',
    dataInicioAlocacao: emp.dataInicioAlocacao || '',
    dataFimAlocacao: emp.dataFimAlocacao || '',
    dataInicioStatus: emp.dataInicioStatus || '',
    dataFimStatus: emp.dataFimStatus || '',
    motivoStatus: emp.motivoStatus || '',
    data_inicio_status: emp.data_inicio_status || emp.dataInicioStatus || '',
    data_fim_status: emp.data_fim_status || emp.dataFimStatus || '',
    observacao_status: emp.observacao_status || emp.motivoStatus || '',
    atualizadoEm: new Date().toISOString(),
  });
}

// Higienizador robusto com valores padrão garantidos para Contracheques Digitais
export function preparePaystubForFirestore(p: Partial<PaystubRecord>): Record<string, any> {
  const cleanMatricula = (p.matricula || '').trim().toUpperCase();
  const cleanMesAno = (p.mesAno || `${String(p.mes || '01').padStart(2, '0')}-${p.ano || '2026'}`).trim();
  const docId = p.id || `${cleanMatricula}_${cleanMesAno}`;

  return sanitizeFirestoreData({
    id: docId,
    matricula: cleanMatricula,
    nome: (p.nome || '').trim(),
    cargo: (p.cargo || '').trim(),
    sede: (p.sede || 'KO-DL').trim(),
    periodo: p.periodo || `${cleanMesAno.replace('-', '/')}`,
    mesAno: cleanMesAno,
    ano: typeof p.ano === 'number' ? p.ano : parseInt(cleanMesAno.split('-')[1] || '2026', 10),
    mes: typeof p.mes === 'number' ? p.mes : parseInt(cleanMesAno.split('-')[0] || '1', 10),
    dataInicio: p.dataInicio || '',
    dataFim: p.dataFim || '',
    cpf: p.cpf || '',
    banco: p.banco || '',
    agencia: p.agencia || '',
    conta: p.conta || '',
    rubricas: Array.isArray(p.rubricas) ? p.rubricas.map(r => ({
      codigo: String(r.codigo || ''),
      descricao: String(r.descricao || ''),
      referencia: r.referencia || '',
      provento: Number(r.provento || 0),
      desconto: Number(r.desconto || 0),
      tipo: r.tipo || (Number(r.desconto || 0) > 0 ? 'DESCONTO' : 'PROVENTO')
    })) : [],
    totalProventos: Number(p.totalProventos || 0),
    totalDescontos: Number(p.totalDescontos || 0),
    valorLiquido: Number(p.valorLiquido || 0),
    salarioBase: p.salarioBase !== undefined ? Number(p.salarioBase) : undefined,
    baseInss: p.baseInss !== undefined ? Number(p.baseInss) : undefined,
    baseFgts: p.baseFgts !== undefined ? Number(p.baseFgts) : undefined,
    fgtsMes: p.fgtsMes !== undefined ? Number(p.fgtsMes) : undefined,
    baseIrrf: p.baseIrrf !== undefined ? Number(p.baseIrrf) : undefined,
    importadoEm: p.importadoEm || new Date().toISOString(),
    importadoPorEmail: p.importadoPorEmail || '',
    observacoes: p.observacoes || ''
  });
}

export const firestoreService = {
  // -------------------------------------------------------------
  // REAL-TIME LISTENERS (COM TRATAMENTO DEFENSIVO DE ERROS)
  // -------------------------------------------------------------

  subscribeEmployees(
    onSuccess: (employees: Employee[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const path = COLLECTIONS.COLABORADORES;
    try {
      const q = query(collection(db, path), orderBy('nome', 'asc'));
      return onSnapshot(
        q,
        (snapshot) => {
          try {
            const list: Employee[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              list.push({
                id: docSnap.id,
                matricula: data.matricula || docSnap.id,
                nome: data.nome || '',
                funcao: data.funcao || data.cargo || 'Técnico de Manutenção',
                cargo: data.cargo || data.funcao,
                sede: data.sede || 'KO',
                sede_origem: data.sede_origem || data.sede || 'KO',
                sede_atual: data.sede_atual || data.sede || 'KO',
                dataAdmissao: data.dataAdmissao || '2026-01-01',
                status: data.status || 'Ativo',
                grauInsalubridadeFixa: data.grauInsalubridadeFixa || 'ISENTO',
                saldoInicialHoras: typeof data.saldoInicialHoras === 'number' ? data.saldoInicialHoras : 0,
                primeiroAcesso: typeof data.primeiroAcesso === 'boolean' ? data.primeiroAcesso : undefined,
                senhaCadastrada: typeof data.senhaCadastrada === 'boolean' ? data.senhaCadastrada : undefined,
                telefone: data.telefone,
                email: data.email,
                horarioTrabalho: data.horarioTrabalho,
                url_foto_perfil: data.url_foto_perfil || data.avatarUrl,
                avatarUrl: data.avatarUrl || data.url_foto_perfil,
                id_drive_foto: data.id_drive_foto,
                data_inicio_status: data.data_inicio_status,
                data_fim_status: data.data_fim_status,
                observacao_status: data.observacao_status,
                criadoEm: data.criadoEm,
                atualizadoEm: data.atualizadoEm,
              });
            });
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de colaboradores:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logFirestoreError(error, OperationType.LIST, path);
          if (onError) onError(error);
        }
      );
    } catch (error: any) {
      logFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  subscribeTimeRecords(
    onSuccess: (records: TimeRecord[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const path = COLLECTIONS.LANCAMENTOS;
    try {
      return onSnapshot(
        collection(db, path),
        (snapshot) => {
          try {
            const list: TimeRecord[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const rawDate = data.dataRegistro || data.data_ocorrencia || data.data || data.date || (data.criadoEm ? data.criadoEm.split('T')[0] : '');
              const horasBrutas = typeof data.horasBrutas === 'number' ? data.horasBrutas : (Number(data.horasBrutas) || 0);
              const multiplicador = typeof data.multiplicador === 'number' ? data.multiplicador : (Number(data.multiplicador) || 1);
              
              let saldoCalculado = typeof data.saldoCalculado === 'number' ? data.saldoCalculado : (Number(data.saldoCalculado) || 0);
              // Fallback para campos legados se saldoCalculado for 0
              if (saldoCalculado === 0) {
                if (data.tipoOcorrencia === 'TRABALHO' && horasBrutas > 0) {
                  saldoCalculado = horasBrutas * multiplicador;
                } else if (data.tipoOcorrencia === 'COMPENSACAO' || data.tipoOcorrencia === 'DISPENSA_OPERACIONAL') {
                  saldoCalculado = -(horasBrutas > 0 ? horasBrutas : 8.0);
                } else if (Number(data.horasExtras50) > 0 || Number(data.horasExtras100) > 0) {
                  saldoCalculado = (Number(data.horasExtras50) || 0) + (Number(data.horasExtras100) || 0);
                } else if (Number(data.folgasCompensatorias) > 0 || Number(data.horasAtrasoFalta) > 0) {
                  saldoCalculado = -((Number(data.folgasCompensatorias) || 0) + (Number(data.horasAtrasoFalta) || 0));
                }
              }

              list.push({
                id: docSnap.id,
                matricula: (data.matricula || '').toString().trim().toUpperCase(),
                employeeName: data.employeeName || '',
                employeeSede: data.employeeSede || 'KO',
                employeeFuncao: data.employeeFuncao || 'Técnico de Manutenção',
                employeeAvatarUrl: data.employeeAvatarUrl,
                dataRegistro: rawDate,
                data_ocorrencia: data.data_ocorrencia || rawDate,
                tipoOcorrencia: data.tipoOcorrencia || 'TRABALHO',
                horasBrutas,
                multiplicador,
                saldoCalculado,
                saldo_remanescente: typeof data.saldo_remanescente === 'number' ? data.saldo_remanescente : (Number(data.saldo_remanescente) || (saldoCalculado !== 0 ? Math.abs(saldoCalculado) : 0)),
                status_compensacao: data.status_compensacao || 'ABERTO',
                liquidacoes: data.liquidacoes || [],
                eFeriado: Boolean(data.eFeriado),
                nomeFeriado: data.nomeFeriado,
                diaSemana: typeof data.diaSemana === 'number' ? data.diaSemana : 1,
                diaSemanaNome: data.diaSemanaNome || '',
                observacao: data.observacao,
                comprovante: data.comprovante,
                criadoEm: data.criadoEm || '',
                criadoPorEmail: data.criadoPorEmail,
                atualizadoEm: data.atualizadoEm,
                editadoPor: data.editadoPor,
                editadoEm: data.editadoEm,
              });
            });

            // Ordenar decrescente por data de registro
            list.sort((a, b) => (b.dataRegistro || '').localeCompare(a.dataRegistro || ''));
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de lançamentos:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logFirestoreError(error, OperationType.LIST, path);
          if (onError) onError(error);
        }
      );
    } catch (error: any) {
      logFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  subscribeAdmins(
    onSuccess: (admins: AdminUser[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const path = COLLECTIONS.ADMIN_USERS;
    try {
      return onSnapshot(
        collection(db, path),
        (snapshot) => {
          try {
            const list: AdminUser[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const role = (data.role as AdminRole) || (data.nivelAcesso as AdminRole) || 'GESTOR_RH';
              list.push({
                id: docSnap.id,
                email: data.email || docSnap.id,
                nome: data.nome || data.email?.split('@')[0] || 'Administrador',
                cargo: data.cargo || 'Gestor RH',
                nivelAcesso: role,
                role,
                sede: data.sede || 'TODAS',
                ativo: data.ativo !== false,
                criadoEm: data.criadoEm || new Date().toISOString(),
              });
            });
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de administradores:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logFirestoreError(error, OperationType.LIST, path);
          if (onError) onError(error);
        }
      );
    } catch (error: any) {
      logFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  // -------------------------------------------------------------
  // GET DOCS / POLLED QUERIES
  // -------------------------------------------------------------

  async getEmployees(): Promise<Employee[]> {
    const path = COLLECTIONS.COLABORADORES;
    try {
      const q = query(collection(db, path), orderBy('nome', 'asc'));
      const snapshot = await getDocs(q);
      const list: Employee[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          matricula: data.matricula || docSnap.id,
          nome: data.nome || '',
          funcao: data.funcao || data.cargo || 'Técnico de Manutenção',
          cargo: data.cargo || data.funcao,
          sede: data.sede || 'KO',
          sede_origem: data.sede_origem || data.sede || 'KO',
          sede_atual: data.sede_atual || data.sede || 'KO',
          dataAdmissao: data.dataAdmissao || '2026-01-01',
          status: data.status || 'Ativo',
          saldoInicialHoras: typeof data.saldoInicialHoras === 'number' ? data.saldoInicialHoras : 0,
          primeiroAcesso: typeof data.primeiroAcesso === 'boolean' ? data.primeiroAcesso : undefined,
          senhaCadastrada: typeof data.senhaCadastrada === 'boolean' ? data.senhaCadastrada : undefined,
          telefone: data.telefone,
          email: data.email,
          horarioTrabalho: data.horarioTrabalho,
          url_foto_perfil: data.url_foto_perfil || data.avatarUrl,
          avatarUrl: data.avatarUrl || data.url_foto_perfil,
          id_drive_foto: data.id_drive_foto,
          data_inicio_status: data.data_inicio_status,
          data_fim_status: data.data_fim_status,
          observacao_status: data.observacao_status,
          criadoEm: data.criadoEm,
          atualizadoEm: data.atualizadoEm,
        });
      });
      return list;
    } catch (error) {
      logFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async getTimeRecords(): Promise<TimeRecord[]> {
    const path = COLLECTIONS.LANCAMENTOS;
    try {
      const q = query(collection(db, path), orderBy('dataRegistro', 'desc'));
      const snapshot = await getDocs(q);
      const list: TimeRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          matricula: data.matricula || '',
          employeeName: data.employeeName || '',
          employeeSede: data.employeeSede || 'KO',
          employeeFuncao: data.employeeFuncao || 'Técnico de Manutenção',
          employeeAvatarUrl: data.employeeAvatarUrl,
          dataRegistro: data.dataRegistro || '',
          data_ocorrencia: data.data_ocorrencia || data.dataRegistro,
          tipoOcorrencia: data.tipoOcorrencia || 'TRABALHO',
          horasBrutas: typeof data.horasBrutas === 'number' ? data.horasBrutas : 0,
          multiplicador: typeof data.multiplicador === 'number' ? data.multiplicador : 1,
          saldoCalculado: typeof data.saldoCalculado === 'number' ? data.saldoCalculado : 0,
          saldo_remanescente: typeof data.saldo_remanescente === 'number' ? data.saldo_remanescente : 0,
          status_compensacao: data.status_compensacao || 'ABERTO',
          liquidacoes: data.liquidacoes || [],
          eFeriado: Boolean(data.eFeriado),
          nomeFeriado: data.nomeFeriado,
          diaSemana: typeof data.diaSemana === 'number' ? data.diaSemana : 1,
          diaSemanaNome: data.diaSemanaNome || '',
          observacao: data.observacao,
          comprovante: data.comprovante,
          criadoEm: data.criadoEm || '',
          criadoPorEmail: data.criadoPorEmail,
        });
      });
      return list;
    } catch (error) {
      logFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  // -------------------------------------------------------------
  // CRUD COLABORADORES
  // -------------------------------------------------------------

  async saveEmployee(employee: Employee): Promise<void> {
    const docId = (employee.matricula || employee.id || '').trim().toUpperCase();
    const path = `${COLLECTIONS.COLABORADORES}/${docId}`;
    try {
      const cleanData = prepareEmployeeForFirestore(employee);
      await setDoc(doc(db, COLLECTIONS.COLABORADORES, docId), cleanData, { merge: true });

      // Se informou senha inicial, cria/atualiza credencial em colaboradores_auth
      if (employee.senhaInicial && employee.senhaInicial.trim().length >= 4) {
        const passwordHash = await hashPassword(employee.senhaInicial.trim());
        const nowIso = new Date().toISOString();
        await setDoc(doc(db, COLLECTIONS.COLABORADORES_AUTH, docId), {
          matricula: docId,
          passwordHash,
          senhaDefinida: true,
          email: employee.email || '',
          tokenRecuperacao: null,
          tokenExpiracao: null,
          ultimoAcesso: null,
          atualizadoEm: nowIso,
        }, { merge: true });
      }
    } catch (error) {
      logFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async deleteEmployee(docId: string): Promise<void> {
    const path = `${COLLECTIONS.COLABORADORES}/${docId}`;
    try {
      await Promise.all([
        deleteDoc(doc(db, COLLECTIONS.COLABORADORES, docId)),
        deleteDoc(doc(db, COLLECTIONS.COLABORADORES_AUTH, docId)).catch(() => {}),
      ]);
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // CRUD LANÇAMENTOS
  // -------------------------------------------------------------

  async saveTimeRecord(record: TimeRecord, userEmail?: string): Promise<void> {
    const docId = record.id;
    const path = `${COLLECTIONS.LANCAMENTOS}/${docId}`;
    try {
      const cleanData = sanitizeFirestoreData({
        id: record.id,
        matricula: (record.matricula || '').trim().toUpperCase(),
        employeeName: record.employeeName || '',
        employeeSede: record.employeeSede || 'KO',
        employeeFuncao: record.employeeFuncao || 'Técnico de Manutenção',
        employeeAvatarUrl: record.employeeAvatarUrl || '',
        dataRegistro: record.dataRegistro || '',
        data_ocorrencia: record.data_ocorrencia || record.dataRegistro || '',
        tipoOcorrencia: record.tipoOcorrencia || 'TRABALHO',
        horasBrutas: Number(record.horasBrutas) || 0,
        multiplicador: Number(record.multiplicador) || 1,
        saldoCalculado: Number(record.saldoCalculado) || 0,
        saldo_remanescente: typeof record.saldo_remanescente === 'number' ? record.saldo_remanescente : (record.saldoCalculado !== 0 ? Math.abs(record.saldoCalculado) : 0),
        status_compensacao: record.status_compensacao || (record.saldoCalculado === 0 ? 'TOTALMENTE_COMPENSADO' : 'ABERTO'),
        liquidacoes: record.liquidacoes || [],
        eFeriado: Boolean(record.eFeriado),
        nomeFeriado: record.nomeFeriado || '',
        diaSemana: Number(record.diaSemana) || 1,
        diaSemanaNome: record.diaSemanaNome || '',
        observacao: record.observacao || '',
        comprovante: record.comprovante || '',
        criadoEm: record.criadoEm || new Date().toISOString(),
        criadoPorEmail: userEmail || record.criadoPorEmail || '',
        atualizadoEm: record.atualizadoEm || '',
        editadoPor: record.editadoPor || userEmail || '',
        editadoEm: record.editadoEm || '',
      });

      await setDoc(doc(db, COLLECTIONS.LANCAMENTOS, docId), cleanData, { merge: true });
    } catch (error) {
      logFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async deleteTimeRecord(docId: string): Promise<void> {
    const path = `${COLLECTIONS.LANCAMENTOS}/${docId}`;
    try {
      await deleteDoc(doc(db, COLLECTIONS.LANCAMENTOS, docId));
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // BATCH BULK IMPORTS COM PROCESSAMENTO EM LOTES (CHUNKS)
  // Suporte a arquivos grandes (4.500+ registros) em pacotes de 400
  // -------------------------------------------------------------

  async importEmployeesBatch(
    employees: Employee[],
    onProgress?: (progress: BatchProgressInfo) => void
  ): Promise<{ count: number; total: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;
    const CHUNK_SIZE = 250; // Limite de segurança considerando múltiplos docs por colaborador
    const total = employees.length;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = employees.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const batch = writeBatch(db);
        const nowIso = new Date().toISOString();

        for (const emp of chunk) {
          const docId = (emp.matricula || emp.id || '').trim().toUpperCase();
          const ref = doc(db, COLLECTIONS.COLABORADORES, docId);
          const cleanEmp = prepareEmployeeForFirestore(emp);
          batch.set(ref, cleanEmp, { merge: true });

          // Se a linha do CSV veio com senha inicial definida
          if (emp.senhaInicial && emp.senhaInicial.trim().length >= 4) {
            const passwordHash = await hashPassword(emp.senhaInicial.trim());
            const authRef = doc(db, COLLECTIONS.COLABORADORES_AUTH, docId);
            batch.set(authRef, {
              matricula: docId,
              passwordHash,
              senhaDefinida: true,
              email: emp.email || '',
              tokenRecuperacao: null,
              tokenExpiracao: null,
              ultimoAcesso: null,
              atualizadoEm: nowIso,
            }, { merge: true });
          }
        }

        try {
          await batch.commit();
          count += chunk.length;
        } catch (batchErr: any) {
          logFirestoreError(batchErr, OperationType.WRITE, COLLECTIONS.COLABORADORES);
          errors.push(`Erro no lote ${chunkIndex}/${totalChunks}: ${batchErr?.message || 'Falha na gravação'}`);
        }

        if (onProgress) {
          onProgress({
            processed: count,
            total,
            percent: Math.min(100, Math.round((count / total) * 100)),
            chunkIndex,
            totalChunks,
          });
        }
      }
      return { count, total, errors };
    } catch (error: any) {
      logFirestoreError(error, OperationType.WRITE, COLLECTIONS.COLABORADORES);
      errors.push(error?.message || 'Erro fatal no processamento em lotes');
      return { count, total, errors };
    }
  },

  async importTimeRecordsBatch(
    records: TimeRecord[],
    onProgress?: (progress: BatchProgressInfo) => void
  ): Promise<{ count: number; total: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;
    const CHUNK_SIZE = 400; // Limite de segurança Firestore (max 500)
    const total = records.length;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const batch = writeBatch(db);

        for (const rec of chunk) {
          const docId = rec.id || `rec-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
          const ref = doc(db, COLLECTIONS.LANCAMENTOS, docId);
          batch.set(ref, {
            id: docId,
            matricula: rec.matricula.trim().toUpperCase(),
            employeeName: rec.employeeName,
            employeeSede: rec.employeeSede,
            employeeFuncao: rec.employeeFuncao,
            employeeAvatarUrl: rec.employeeAvatarUrl || null,
            dataRegistro: rec.dataRegistro,
            data_ocorrencia: rec.data_ocorrencia || rec.dataRegistro,
            tipoOcorrencia: rec.tipoOcorrencia,
            horasBrutas: Number(rec.horasBrutas) || 0,
            multiplicador: Number(rec.multiplicador) || 1,
            saldoCalculado: Number(rec.saldoCalculado) || 0,
            saldo_remanescente: typeof rec.saldo_remanescente === 'number' ? rec.saldo_remanescente : (rec.saldoCalculado !== 0 ? Math.abs(rec.saldoCalculado) : 0),
            status_compensacao: rec.status_compensacao || (rec.saldoCalculado === 0 ? 'TOTALMENTE_COMPENSADO' : 'ABERTO'),
            liquidacoes: rec.liquidacoes || [],
            eFeriado: Boolean(rec.eFeriado),
            nomeFeriado: rec.nomeFeriado || null,
            diaSemana: Number(rec.diaSemana) || 1,
            diaSemanaNome: rec.diaSemanaNome || '',
            observacao: rec.observacao || null,
            comprovante: rec.comprovante || null,
            criadoEm: rec.criadoEm || new Date().toISOString(),
          }, { merge: true });
        }

        try {
          await batch.commit();
          count += chunk.length;
        } catch (batchErr: any) {
          logFirestoreError(batchErr, OperationType.WRITE, COLLECTIONS.LANCAMENTOS);
          errors.push(`Erro no lote ${chunkIndex}/${totalChunks}: ${batchErr?.message || 'Falha na gravação do lote'}`);
        }

        if (onProgress) {
          onProgress({
            processed: count,
            total,
            percent: Math.min(100, Math.round((count / total) * 100)),
            chunkIndex,
            totalChunks,
          });
        }
      }
      return { count, total, errors };
    } catch (error: any) {
      logFirestoreError(error, OperationType.WRITE, COLLECTIONS.LANCAMENTOS);
      errors.push(error?.message || 'Erro fatal no processamento em lote');
      return { count, total, errors };
    }
  },

  // -------------------------------------------------------------
  // MÓDULO DE INSALUBRIDADE (PONTUAL E POR ATIVIDADE)
  // -------------------------------------------------------------

  subscribeInsalubrityRecords(
    onSuccess: (records: InsalubrityRecord[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const path = COLLECTIONS.INSALUBRIDADE;
    try {
      const q = query(collection(db, path), orderBy('dataEvento', 'desc'));
      return onSnapshot(
        q,
        (snapshot) => {
          try {
            const list: InsalubrityRecord[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              list.push({
                id: docSnap.id,
                matricula: data.matricula || '',
                nomeColaborador: data.nomeColaborador || '',
                sede: data.sede || 'KO',
                funcao: data.funcao || 'Operacional',
                dataEvento: data.dataEvento || '',
                atividadeDesempenhada: data.atividadeDesempenhada || '',
                grauExposicao: data.grauExposicao || '20%',
                quantidadeHorasDias: typeof data.quantidadeHorasDias === 'number' ? data.quantidadeHorasDias : 8,
                unidade: data.unidade || 'HORAS',
                responsavelLancamento: data.responsavelLancamento || 'RH / Encarregado',
                observacoes: data.observacoes || '',
                criadoEm: data.criadoEm || new Date().toISOString(),
                criadoPorEmail: data.criadoPorEmail,
                atualizadoEm: data.atualizadoEm,
                editadoPor: data.editadoPor,
                editadoEm: data.editadoEm,
              });
            });
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de insalubridade:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logFirestoreError(error, OperationType.LIST, path);
          if (onError) onError(error);
        }
      );
    } catch (error: any) {
      logFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  async saveInsalubrityRecord(record: InsalubrityRecord): Promise<void> {
    const docId = record.id || `insalubre-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const path = `${COLLECTIONS.INSALUBRIDADE}/${docId}`;
    try {
      const dataToSave = sanitizeFirestoreData({
        id: docId,
        matricula: record.matricula.trim().toUpperCase(),
        nomeColaborador: record.nomeColaborador.trim(),
        sede: record.sede || 'KO',
        funcao: record.funcao || 'Operacional',
        dataEvento: record.dataEvento,
        atividadeDesempenhada: record.atividadeDesempenhada.trim(),
        grauExposicao: record.grauExposicao || '20%',
        quantidadeHorasDias: Number(record.quantidadeHorasDias) || 1,
        unidade: record.unidade || 'HORAS',
        responsavelLancamento: record.responsavelLancamento || 'Encarregado / RH',
        observacoes: record.observacoes?.trim() || '',
        criadoEm: record.criadoEm || new Date().toISOString(),
        criadoPorEmail: record.criadoPorEmail || '',
        atualizadoEm: record.atualizadoEm || '',
        editadoPor: record.editadoPor || '',
        editadoEm: record.editadoEm || '',
      });
      await setDoc(doc(db, COLLECTIONS.INSALUBRIDADE, docId), dataToSave, { merge: true });
    } catch (error) {
      logFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async saveInsalubrityBatch(records: InsalubrityRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    const CHUNK_SIZE = 400;
    let savedCount = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((rec) => {
        const docId = rec.id || `insalubre-${rec.matricula.trim().toUpperCase()}-${rec.dataEvento}-${Math.floor(Math.random() * 100000)}`;
        const ref = doc(db, COLLECTIONS.INSALUBRIDADE, docId);
        const cleanData = sanitizeFirestoreData({
          id: docId,
          matricula: rec.matricula.trim().toUpperCase(),
          nomeColaborador: rec.nomeColaborador.trim(),
          sede: rec.sede || 'KO',
          funcao: rec.funcao || 'Operacional',
          dataEvento: rec.dataEvento,
          atividadeDesempenhada: rec.atividadeDesempenhada.trim().toUpperCase(),
          grauExposicao: rec.grauExposicao || '20%',
          quantidadeHorasDias: Number(rec.quantidadeHorasDias) || 1,
          unidade: rec.unidade || 'DIAS',
          responsavelLancamento: rec.responsavelLancamento || 'RH / Encarregado',
          observacoes: rec.observacoes?.trim() || '',
          criadoEm: rec.criadoEm || new Date().toISOString(),
          criadoPorEmail: rec.criadoPorEmail || '',
        });
        batch.set(ref, cleanData, { merge: true });
      });

      await batch.commit();
      savedCount += chunk.length;
    }

    return savedCount;
  },

  async deleteInsalubrityRecord(docId: string): Promise<void> {
    const path = `${COLLECTIONS.INSALUBRIDADE}/${docId}`;
    try {
      await deleteDoc(doc(db, COLLECTIONS.INSALUBRIDADE, docId));
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // CONFIGURAÇÕES GLOBAIS DO SISTEMA (LOGO COMARA, PARÂMETROS)
  // -------------------------------------------------------------

  subscribeSystemConfig(
    onSuccess: (config: SystemConfig) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const path = `${COLLECTIONS.SYSTEM_CONFIG}/global`;
    try {
      return onSnapshot(
        doc(db, COLLECTIONS.SYSTEM_CONFIG, 'global'),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            onSuccess({
              logoUrl: data.logoUrl || '',
              companyName: data.companyName || 'COMARA',
              subtitle: data.subtitle || 'Comissão de Aeroportos da Região Amazônica',
              insalubrityMode: data.insalubrityMode || 'SIMPLES',
              atualizadoEm: data.atualizadoEm,
              atualizadoPor: data.atualizadoPor,
            });
          } else {
            onSuccess({
              logoUrl: '',
              companyName: 'COMARA',
              subtitle: 'Comissão de Aeroportos da Região Amazônica',
              insalubrityMode: 'SIMPLES',
            });
          }
        },
        (error) => {
          logFirestoreError(error, OperationType.GET, path);
          if (onError) onError(error);
        }
      );
    } catch (error: any) {
      logFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  async saveSystemConfig(config: SystemConfig): Promise<void> {
    const path = `${COLLECTIONS.SYSTEM_CONFIG}/global`;
    try {
      const dataToSave = sanitizeFirestoreData({
        logoUrl: config.logoUrl || '',
        companyName: config.companyName || 'COMARA',
        subtitle: config.subtitle || 'Comissão de Aeroportos da Região Amazônica',
        insalubrityMode: config.insalubrityMode || 'SIMPLES',
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: config.atualizadoPor || 'SUPER_ADMIN',
      });
      await setDoc(doc(db, COLLECTIONS.SYSTEM_CONFIG, 'global'), dataToSave, { merge: true });
    } catch (error) {
      logFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // RBAC & ADMIN USERS
  // -------------------------------------------------------------

  async saveAdminUser(adminUser: AdminUser): Promise<void> {
    const docId = adminUser.email.trim().toLowerCase();
    const path = `${COLLECTIONS.ADMIN_USERS}/${docId}`;
    try {
      const dataToSave: Record<string, any> = {
        id: docId,
        email: docId,
        nome: adminUser.nome || docId.split('@')[0],
        cargo: adminUser.cargo || 'Gestor RH',
        role: adminUser.role || adminUser.nivelAcesso || 'GESTOR_RH',
        nivelAcesso: adminUser.nivelAcesso || adminUser.role || 'GESTOR_RH',
        sede: adminUser.sede || 'TODAS',
        ativo: adminUser.ativo !== false,
        atualizadoEm: new Date().toISOString(),
      };
      if (adminUser.passwordHash) {
        dataToSave.passwordHash = adminUser.passwordHash;
      }
      await setDoc(doc(db, COLLECTIONS.ADMIN_USERS, docId), dataToSave, { merge: true });
    } catch (error) {
      logFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async deleteAdminUser(docId: string): Promise<void> {
    const path = `${COLLECTIONS.ADMIN_USERS}/${docId}`;
    try {
      await deleteDoc(doc(db, COLLECTIONS.ADMIN_USERS, docId));
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // SYSTEM AUDIT LOGS
  // -------------------------------------------------------------

  async logSystemEvent(event: {
    tipo: string;
    descricao: string;
    usuario?: string;
    matricula?: string;
    detalhes?: Record<string, any>;
  }): Promise<void> {
    try {
      const logId = `log-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const logData = sanitizeFirestoreData({
        id: logId,
        tipo: event.tipo || 'LOG_SISTEMA',
        descricao: event.descricao || '',
        usuario: event.usuario || 'SISTEMA',
        matricula: event.matricula || '',
        detalhes: event.detalhes || {},
        timestamp: new Date().toISOString(),
      });
      await setDoc(doc(db, COLLECTIONS.SYSTEM_LOGS, logId), logData);
    } catch (err) {
      console.warn('Erro não bloqueante ao registrar log de auditoria no Firestore:', err);
    }
  },

  // -------------------------------------------------------------
  // GESTÃO DE CANTEIROS DE OBRAS & SEDES UNIFICADAS
  // -------------------------------------------------------------

  subscribeConstructionSites(
    onSuccess: (sites: ConstructionSite[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return canteiroService.subscribeCanteiros(onSuccess, onError);
  },

  async saveConstructionSite(site: Partial<ConstructionSite> & { chiefContact?: string; chefeContato?: string }): Promise<void> {
    return canteiroService.saveCanteiro(site);
  },

  async deleteConstructionSite(id: string): Promise<void> {
    return canteiroService.deleteCanteiro(id);
  },

  // -------------------------------------------------------------
  // CONTRACHEQUES DIGITAIS COMARA (PDF PARSER & VISUALIZADOR)
  // -------------------------------------------------------------

  subscribePaystubs(
    onSuccess: (paystubs: PaystubRecord[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const path = COLLECTIONS.CONTRACHEQUES;
    try {
      return onSnapshot(
        collection(db, path),
        (snapshot) => {
          const items: PaystubRecord[] = snapshot.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              matricula: data.matricula || '',
              nome: data.nome || '',
              cargo: data.cargo || '',
              sede: data.sede || 'KO-DL',
              periodo: data.periodo || '',
              mesAno: data.mesAno || '',
              ano: Number(data.ano || 2026),
              mes: Number(data.mes || 1),
              dataInicio: data.dataInicio || '',
              dataFim: data.dataFim || '',
              cpf: data.cpf || '',
              banco: data.banco || '',
              agencia: data.agencia || '',
              conta: data.conta || '',
              rubricas: Array.isArray(data.rubricas) ? data.rubricas : [],
              totalProventos: Number(data.totalProventos || 0),
              totalDescontos: Number(data.totalDescontos || 0),
              valorLiquido: Number(data.valorLiquido || 0),
              salarioBase: data.salarioBase !== undefined ? Number(data.salarioBase) : undefined,
              baseInss: data.baseInss !== undefined ? Number(data.baseInss) : undefined,
              baseFgts: data.baseFgts !== undefined ? Number(data.baseFgts) : undefined,
              fgtsMes: data.fgtsMes !== undefined ? Number(data.fgtsMes) : undefined,
              baseIrrf: data.baseIrrf !== undefined ? Number(data.baseIrrf) : undefined,
              importadoEm: data.importadoEm || '',
              importadoPorEmail: data.importadoPorEmail || '',
              observacoes: data.observacoes || ''
            };
          });
          onSuccess(items);
        },
        (error) => {
          logFirestoreError(error, OperationType.LIST, path);
          if (onError) onError(error);
        }
      );
    } catch (error) {
      logFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error as Error);
      return () => {};
    }
  },

  async savePaystub(paystub: PaystubRecord): Promise<void> {
    const cleanMatricula = paystub.matricula.trim().toUpperCase();
    const cleanMesAno = paystub.mesAno.trim();
    const docId = paystub.id || `${cleanMatricula}_${cleanMesAno}`;
    const path = `${COLLECTIONS.CONTRACHEQUES}/${docId}`;

    try {
      const sanitized = preparePaystubForFirestore(paystub);
      await setDoc(doc(db, COLLECTIONS.CONTRACHEQUES, docId), sanitized, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async savePaystubsBatch(
    paystubs: PaystubRecord[],
    onProgress?: (info: BatchProgressInfo) => void
  ): Promise<void> {
    const CHUNK_SIZE = 300;
    const total = paystubs.length;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = paystubs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((p) => {
          const cleanMatricula = p.matricula.trim().toUpperCase();
          const cleanMesAno = p.mesAno.trim();
          const docId = p.id || `${cleanMatricula}_${cleanMesAno}`;
          const ref = doc(db, COLLECTIONS.CONTRACHEQUES, docId);
          const sanitized = preparePaystubForFirestore(p);
          batch.set(ref, sanitized, { merge: true });
        });

        await batch.commit();

        if (onProgress) {
          const processed = Math.min(i + CHUNK_SIZE, total);
          onProgress({
            processed,
            total,
            percent: Math.round((processed / total) * 100),
            chunkIndex: Math.floor(i / CHUNK_SIZE) + 1,
            totalChunks,
          });
        }
      }
    } catch (error) {
      logFirestoreError(error, OperationType.WRITE, COLLECTIONS.CONTRACHEQUES);
      throw error;
    }
  },

  async saveBatchPaystubs(
    paystubs: PaystubRecord[],
    onProgress?: (info: BatchProgressInfo) => void
  ): Promise<void> {
    return this.savePaystubsBatch(paystubs, onProgress);
  },

  async deletePaystub(id: string): Promise<void> {
    const path = `${COLLECTIONS.CONTRACHEQUES}/${id}`;
    try {
      await deleteDoc(doc(db, COLLECTIONS.CONTRACHEQUES, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async clearAllData(): Promise<void> {
    const CHUNK_SIZE = 400;
    try {
      // 1. Deletar todos os colaboradores em lotes
      const colabsSnap = await getDocs(collection(db, COLLECTIONS.COLABORADORES));
      const colabDocs = colabsSnap.docs;
      for (let i = 0; i < colabDocs.length; i += CHUNK_SIZE) {
        const chunk = colabDocs.slice(i, i + CHUNK_SIZE);
        const colabBatch = writeBatch(db);
        chunk.forEach((d) => colabBatch.delete(d.ref));
        await colabBatch.commit();
      }

      // 2. Deletar todos os lançamentos em lotes
      const lancsSnap = await getDocs(collection(db, COLLECTIONS.LANCAMENTOS));
      const lancDocs = lancsSnap.docs;
      for (let i = 0; i < lancDocs.length; i += CHUNK_SIZE) {
        const chunk = lancDocs.slice(i, i + CHUNK_SIZE);
        const lancBatch = writeBatch(db);
        chunk.forEach((d) => lancBatch.delete(d.ref));
        await lancBatch.commit();
      }

      // 3. Deletar contracheques em lotes
      const paystubsSnap = await getDocs(collection(db, COLLECTIONS.CONTRACHEQUES));
      const paystubDocs = paystubsSnap.docs;
      for (let i = 0; i < paystubDocs.length; i += CHUNK_SIZE) {
        const chunk = paystubDocs.slice(i, i + CHUNK_SIZE);
        const pBatch = writeBatch(db);
        chunk.forEach((d) => pBatch.delete(d.ref));
        await pBatch.commit();
      }
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, 'all');
      throw error;
    }
  }
};
