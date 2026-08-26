import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  Unsubscribe 
} from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from './firebase';
import { AuditLog, AuditActionType } from '../types';

export const AUDIT_COLLECTION = 'logs_auditoria';

export interface RegisterAuditParams {
  usuarioId: string;
  nomeUsuario: string;
  acao: AuditActionType | string;
  detalhes: string;
  canteiroId?: string;
  recursoId?: string;
  detalhesJson?: Record<string, any>;
  dadosAnteriores?: Record<string, any>;
  dadosNovos?: Record<string, any>;
}

export const auditService = {
  /**
   * Registra de forma não-bloqueante um evento de auditoria na coleção `logs_auditoria` do Firestore.
   */
  async logAction(params: RegisterAuditParams): Promise<void> {
    try {
      const now = new Date();
      const auditId = `audit_${now.getTime()}_${Math.floor(1000 + Math.random() * 9000)}`;
      
      const payload: Record<string, any> = {
        id: auditId,
        usuarioId: (params.usuarioId || 'sistema@comara.aer.mil.br').trim(),
        nomeUsuario: (params.nomeUsuario || 'Operador do Sistema').trim(),
        acao: params.acao,
        detalhes: params.detalhes || '',
        canteiroId: (params.canteiroId || 'TODOS').trim().toUpperCase(),
        timestamp: now.toISOString(),
      };

      if (params.recursoId) payload.recursoId = params.recursoId;
      if (params.detalhesJson) payload.detalhesJson = params.detalhesJson;
      if (params.dadosAnteriores) payload.dadosAnteriores = params.dadosAnteriores;
      if (params.dadosNovos) payload.dadosNovos = params.dadosNovos;

      // Sanitizar chaves undefined
      const sanitized: Record<string, any> = {};
      for (const key of Object.keys(payload)) {
        if (payload[key] !== undefined) {
          sanitized[key] = payload[key];
        }
      }

      await setDoc(doc(db, AUDIT_COLLECTION, auditId), sanitized);
    } catch (err) {
      console.warn('Registro de auditoria falhou silenciosamente:', err);
    }
  },

  /**
   * Assina em tempo real a trilha de auditoria dos últimos 500 registros.
   */
  subscribeAuditLogs(
    onSuccess: (logs: AuditLog[]) => void,
    onError?: (error: Error) => void,
    maxLimit: number = 300
  ): Unsubscribe {
    try {
      const q = query(
        collection(db, AUDIT_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(maxLimit)
      );

      return onSnapshot(
        q,
        (snapshot) => {
          try {
            const list: AuditLog[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              list.push({
                id: docSnap.id,
                usuarioId: data.usuarioId || '',
                nomeUsuario: data.nomeUsuario || '',
                acao: data.acao || 'ACAO_SISTEMA',
                detalhes: data.detalhes || '',
                detalhesJson: data.detalhesJson,
                canteiroId: data.canteiroId || 'TODOS',
                timestamp: data.timestamp || new Date().toISOString(),
                ipOrigem: data.ipOrigem,
                recursoId: data.recursoId,
                dadosAnteriores: data.dadosAnteriores,
                dadosNovos: data.dadosNovos,
              });
            });
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de logs de auditoria:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logFirestoreError(error, OperationType.LIST, AUDIT_COLLECTION);
          if (onError) onError(error);
        }
      );
    } catch (error: any) {
      logFirestoreError(error, OperationType.LIST, AUDIT_COLLECTION);
      if (onError) onError(error);
      return () => {};
    }
  }
};
