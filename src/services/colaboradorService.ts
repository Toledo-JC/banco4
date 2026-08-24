import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  onSnapshot, 
  query, 
  orderBy,
  Unsubscribe 
} from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from './firebase';
import { Employee } from '../types';
import { prepareEmployeeForFirestore, sanitizeFirestoreData, COLLECTIONS, BatchProgressInfo } from './firestoreService';
import { hashPassword } from './authService';

export const colaboradorService = {
  /**
   * Monitoramento em tempo real dos colaboradores no Firestore
   */
  subscribeColaboradores(
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
                cpf: data.cpf,
                pis: data.pis,
                rg: data.rg,
                dataNascimento: data.dataNascimento,
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

  /**
   * Lista todos os colaboradores
   */
  async listColaboradores(): Promise<Employee[]> {
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
          grauInsalubridadeFixa: data.grauInsalubridadeFixa || 'ISENTO',
          saldoInicialHoras: typeof data.saldoInicialHoras === 'number' ? data.saldoInicialHoras : 0,
          primeiroAcesso: typeof data.primeiroAcesso === 'boolean' ? data.primeiroAcesso : undefined,
          senhaCadastrada: typeof data.senhaCadastrada === 'boolean' ? data.senhaCadastrada : undefined,
          cpf: data.cpf,
          pis: data.pis,
          rg: data.rg,
          dataNascimento: data.dataNascimento,
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

  /**
   * Salva ou atualiza um colaborador no Firestore
   */
  async saveColaborador(employee: Employee): Promise<void> {
    const docId = (employee.matricula || employee.id || '').trim().toUpperCase();
    const path = `${COLLECTIONS.COLABORADORES}/${docId}`;
    try {
      const cleanData = prepareEmployeeForFirestore(employee);
      await setDoc(doc(db, COLLECTIONS.COLABORADORES, docId), cleanData, { merge: true });

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

  /**
   * Importa lote de colaboradores
   */
  async importColaboradoresBatch(
    employees: Employee[],
    onProgress?: (info: BatchProgressInfo) => void
  ): Promise<{ count: number; total: number; errors: string[] }> {
    const CHUNK_SIZE = 400;
    const total = employees.length;
    let count = 0;
    const errors: string[] = [];
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = employees.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;

        chunk.forEach((emp) => {
          const docId = (emp.matricula || emp.id || '').trim().toUpperCase();
          if (docId) {
            const ref = doc(db, COLLECTIONS.COLABORADORES, docId);
            const cleanData = prepareEmployeeForFirestore(emp);
            batch.set(ref, cleanData, { merge: true });
          }
        });

        await batch.commit();
        count += chunk.length;

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
      errors.push(error?.message || 'Erro no processamento em lote de colaboradores');
      return { count, total, errors };
    }
  },

  /**
   * Exclui um colaborador
   */
  async deleteColaborador(docId: string): Promise<void> {
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
  }
};
