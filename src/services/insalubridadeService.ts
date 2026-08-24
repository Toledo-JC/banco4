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
import { InsalubrityRecord } from '../types';
import { sanitizeFirestoreData } from './firestoreService';

export const INSALUBRIDADE_COLLECTION = 'insalubridade_records';

export const insalubridadeService = {
  /**
   * Monitora em tempo real a coleção de insalubridade
   */
  subscribeInsalubrityRecords(
    onSuccess: (records: InsalubrityRecord[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    try {
      const q = query(collection(db, INSALUBRIDADE_COLLECTION), orderBy('dataEvento', 'desc'));
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
                quantidadeHorasDias: typeof data.quantidadeHorasDias === 'number' ? data.quantidadeHorasDias : 1,
                unidade: data.unidade || 'DIAS',
                responsavelLancamento: data.responsavelLancamento || 'RH / Encarregado',
                observacoes: data.observacoes || '',
                criadoEm: data.criadoEm || new Date().toISOString(),
                criadoPorEmail: data.criadoPorEmail,
              });
            });
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de insalubridade:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logFirestoreError(error, OperationType.LIST, INSALUBRIDADE_COLLECTION);
          if (onError) onError(error);
        }
      );
    } catch (error: any) {
      logFirestoreError(error, OperationType.LIST, INSALUBRIDADE_COLLECTION);
      if (onError) onError(error);
      return () => {};
    }
  },

  /**
   * Lista todos os registros de insalubridade
   */
  async listInsalubrityRecords(): Promise<InsalubrityRecord[]> {
    try {
      const q = query(collection(db, INSALUBRIDADE_COLLECTION), orderBy('dataEvento', 'desc'));
      const snapshot = await getDocs(q);
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
          quantidadeHorasDias: typeof data.quantidadeHorasDias === 'number' ? data.quantidadeHorasDias : 1,
          unidade: data.unidade || 'DIAS',
          responsavelLancamento: data.responsavelLancamento || 'RH / Encarregado',
          observacoes: data.observacoes || '',
          criadoEm: data.criadoEm || new Date().toISOString(),
          criadoPorEmail: data.criadoPorEmail,
        });
      });
      return list;
    } catch (error) {
      logFirestoreError(error, OperationType.GET, INSALUBRIDADE_COLLECTION);
      return [];
    }
  },

  /**
   * Grava um registro de insalubridade diretamente no Cloud Firestore
   */
  async saveInsalubrityRecord(record: InsalubrityRecord): Promise<void> {
    const docId = record.id || `insalubre-${record.matricula.trim()}-${record.dataEvento}-${Date.now()}`;
    const path = `${INSALUBRIDADE_COLLECTION}/${docId}`;
    try {
      const dataToSave = sanitizeFirestoreData({
        id: docId,
        matricula: record.matricula.trim().toUpperCase(),
        nomeColaborador: record.nomeColaborador.trim(),
        sede: record.sede || 'KO',
        funcao: record.funcao || 'Operacional',
        dataEvento: record.dataEvento,
        atividadeDesempenhada: record.atividadeDesempenhada.trim().toUpperCase(),
        grauExposicao: record.grauExposicao || '20%',
        quantidadeHorasDias: Number(record.quantidadeHorasDias) || 1,
        unidade: record.unidade || 'DIAS',
        responsavelLancamento: record.responsavelLancamento || 'Encarregado / RH',
        observacoes: record.observacoes?.trim() || '',
        criadoEm: record.criadoEm || new Date().toISOString(),
        criadoPorEmail: record.criadoPorEmail || '',
      });
      await setDoc(doc(db, INSALUBRIDADE_COLLECTION, docId), dataToSave, { merge: true });
    } catch (error) {
      logFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  /**
   * Grava um lote de registros de insalubridade diretamente no Cloud Firestore (Matriz Simples / Lançamento Rápido)
   */
  async saveInsalubrityBatch(records: InsalubrityRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    const CHUNK_SIZE = 400;
    let savedCount = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((rec) => {
        const docId = rec.id || `insalubre-${rec.matricula.trim().toUpperCase()}-${rec.dataEvento}-${Math.floor(Math.random() * 100000)}`;
        const ref = doc(db, INSALUBRIDADE_COLLECTION, docId);
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
          responsavelLancamento: rec.responsavelLancamento || 'Encarregado / RH',
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

  /**
   * Exclui um registro de insalubridade
   */
  async deleteInsalubrityRecord(docId: string): Promise<void> {
    const path = `${INSALUBRIDADE_COLLECTION}/${docId}`;
    try {
      await deleteDoc(doc(db, INSALUBRIDADE_COLLECTION, docId));
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  }
};
