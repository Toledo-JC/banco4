import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  Unsubscribe 
} from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from './firebase';
import { ConstructionSite, CanteiroSignatures, TratamentoTitulo } from '../types';
import { sanitizeFirestoreData } from './firestoreService';

export const CANTEIROS_COLLECTION = 'canteiros_obras';

/**
 * Base de Sedes & Canteiros Oficiais COMARA
 * Cada Sede é um Canteiro e cada Canteiro é uma Sede/Local de Trabalho.
 */
export const BASE_SEDES_CANTEIROS: ConstructionSite[] = [
  {
    id: 'sede-ko',
    code: 'KO',
    codigo: 'KO',
    name: 'Canteiro de Obras Coari',
    nome: 'Canteiro de Obras Coari',
    branch: 'KO',
    sede: 'KO',
    address: 'Aeroporto de Coari - Coari / AM',
    endereco: 'Aeroporto de Coari - Coari / AM',
    chief: 'Capitão Encarregado de Obras',
    chefeCanteiro: 'Capitão Encarregado de Obras',
    tratamentoChefeCanteiro: 'Encarregado',
    chiefContact: '(92) 99123-4567',
    chefeContato: '(92) 99123-4567',
    chefeDa: 'Chefe da Divisão Administrativa',
    tratamentoChefeDa: 'Chefe',
    auxDa: 'Auxiliar da Divisão Administrativa',
    manager: 'Fiscal de Obras COMARA',
    gerente: 'Fiscal de Obras COMARA',
    status: 'Ativo',
    insalubrityLevel: '20%',
    grauInsalubridade: '20%',
    workerCount: 0,
    startDate: '2026-01-01',
    dataInicio: '2026-01-01',
    notes: 'Base Operacional Principal - Canteiro e Pista de Coari',
    observacoes: 'Base Operacional Principal - Canteiro e Pista de Coari',
  },
  {
    id: 'sede-be',
    code: 'BE',
    codigo: 'BE',
    name: 'Sede Belém / Destacamento de Apoio',
    nome: 'Sede Belém / Destacamento de Apoio',
    branch: 'BE',
    sede: 'BE',
    address: 'Av. Pedro Álvares Cabral, 7115 - Belém / PA',
    endereco: 'Av. Pedro Álvares Cabral, 7115 - Belém / PA',
    chief: 'Chefe da Divisão de Obras',
    chefeCanteiro: 'Chefe da Divisão de Obras',
    tratamentoChefeCanteiro: 'Chefe',
    chiefContact: '(91) 3214-5000',
    chefeContato: '(91) 3214-5000',
    chefeDa: 'Chefe da Divisão Administrativa',
    tratamentoChefeDa: 'Chefe',
    auxDa: 'Auxiliar de Administração Belém',
    manager: 'Comandante da COMARA',
    gerente: 'Comandante da COMARA',
    status: 'Ativo',
    insalubrityLevel: '20%',
    grauInsalubridade: '20%',
    workerCount: 0,
    startDate: '2026-01-01',
    dataInicio: '2026-01-01',
    notes: 'Quartel General e Centro de Suprimentos COMARA',
    observacoes: 'Quartel General e Centro de Suprimentos COMARA',
  },
  {
    id: 'sede-mn',
    code: 'MN',
    codigo: 'MN',
    name: 'Destacamento de Manaus',
    nome: 'Destacamento de Manaus',
    branch: 'MN',
    sede: 'MN',
    address: 'Base Aérea de Manaus - Manaus / AM',
    endereco: 'Base Aérea de Manaus - Manaus / AM',
    chief: 'Chefe do Destacamento Manaus',
    chefeCanteiro: 'Chefe do Destacamento Manaus',
    tratamentoChefeCanteiro: 'Chefe',
    chiefContact: '(92) 3629-1000',
    chefeContato: '(92) 3629-1000',
    chefeDa: 'Chefe da DA Manaus',
    tratamentoChefeDa: 'Chefe',
    auxDa: 'Auxiliar DA Manaus',
    manager: 'Gestor Operacional',
    gerente: 'Gestor Operacional',
    status: 'Ativo',
    insalubrityLevel: '20%',
    grauInsalubridade: '20%',
    workerCount: 0,
    startDate: '2026-01-01',
    dataInicio: '2026-01-01',
    notes: 'Pólo Logístico de Apoio Fluvial e Aéreo',
    observacoes: 'Pólo Logístico de Apoio Fluvial e Aéreo',
  },
  {
    id: 'sede-sp',
    code: 'SP',
    codigo: 'SP',
    name: 'Núcleo / Escritório São Paulo',
    nome: 'Núcleo / Escritório São Paulo',
    branch: 'SP',
    sede: 'SP',
    address: 'São Paulo / SP',
    endereco: 'São Paulo / SP',
    chief: 'Representante Regional SP',
    chefeCanteiro: 'Representante Regional SP',
    tratamentoChefeCanteiro: 'Encarregado',
    chiefContact: '(11) 3300-0000',
    chefeContato: '(11) 3300-0000',
    chefeDa: 'Divisão Administrativa Regional',
    tratamentoChefeDa: 'Chefe',
    manager: 'Gestor Administrativo',
    gerente: 'Gestor Administrativo',
    status: 'Ativo',
    insalubrityLevel: 'ISENTO',
    grauInsalubridade: 'ISENTO',
    workerCount: 0,
    startDate: '2026-01-01',
    dataInicio: '2026-01-01',
    notes: 'Escritório de Representação Técnica SP',
    observacoes: 'Escritório de Representação Técnica SP',
  },
  {
    id: 'sede-rj',
    code: 'RJ',
    codigo: 'RJ',
    name: 'Núcleo / Escritório Rio de Janeiro',
    nome: 'Núcleo / Escritório Rio de Janeiro',
    branch: 'RJ',
    sede: 'RJ',
    address: 'Rio de Janeiro / RJ',
    endereco: 'Rio de Janeiro / RJ',
    chief: 'Representante Regional RJ',
    chefeCanteiro: 'Representante Regional RJ',
    tratamentoChefeCanteiro: 'Encarregado',
    chiefContact: '(21) 2200-0000',
    chefeContato: '(21) 2200-0000',
    chefeDa: 'Divisão Administrativa RJ',
    tratamentoChefeDa: 'Chefe',
    manager: 'Gestor Administrativo',
    gerente: 'Gestor Administrativo',
    status: 'Ativo',
    insalubrityLevel: 'ISENTO',
    grauInsalubridade: 'ISENTO',
    workerCount: 0,
    startDate: '2026-01-01',
    dataInicio: '2026-01-01',
    notes: 'Escritório de Representação e Engenharia RJ',
    observacoes: 'Escritório de Representação e Engenharia RJ',
  },
];

/**
 * Helper para resolver dinamicamente os 3 signatários oficiais do canteiro/sede:
 * - Assinatura 1: Encarregado/Chefe do Canteiro
 * - Assinatura 2: Chefe/Encarregado da DA
 * - Assinatura 3: Engenheiro Fiscal / RH Admin
 */
export function getSignaturesForCanteiro(
  siteOrBranch?: string | ConstructionSite,
  allSites: ConstructionSite[] = BASE_SEDES_CANTEIROS
): CanteiroSignatures {
  let site: ConstructionSite | undefined;

  if (typeof siteOrBranch === 'object' && siteOrBranch !== null) {
    site = siteOrBranch;
  } else if (typeof siteOrBranch === 'string' && siteOrBranch.trim()) {
    const term = siteOrBranch.trim().toUpperCase();
    site = allSites.find(s => 
      (s.code && s.code.toUpperCase() === term) ||
      (s.codigo && s.codigo.toUpperCase() === term) ||
      (s.branch && s.branch.toUpperCase() === term) ||
      (s.sede && s.sede.toUpperCase() === term) ||
      (s.name && s.name.toUpperCase().includes(term)) ||
      (s.nome && s.nome.toUpperCase().includes(term)) ||
      term.includes(s.code || '') ||
      term.includes(s.codigo || '')
    );
  }

  if (!site) {
    // Fallback padrão COMARA Coari / Geral
    site = allSites.find(s => (s.code || s.codigo) === 'KO') || BASE_SEDES_CANTEIROS[0];
  }

  const tratamentoCanteiro: TratamentoTitulo = site.tratamentoChefeCanteiro || 'Encarregado';
  const tratamentoDa: TratamentoTitulo = site.tratamentoChefeDa || 'Chefe';
  const nomeCanteiro = site.chefeCanteiro || site.chief || 'Capitão Encarregado de Obras';
  const nomeDa = site.chefeDa || 'Chefe da Divisão Administrativa';
  const nomeGerente = site.gerente || site.manager || 'Engenheiro Fiscal de Obras COMARA';
  const canteiroDesc = site.nome || site.name || `Canteiro ${site.codigo || site.code || 'COMARA'}`;

  return {
    assinatura1: {
      titulo: `${tratamentoCanteiro} do Canteiro`,
      nome: nomeCanteiro,
      subtitulo: `${canteiroDesc} - COMARA`,
    },
    assinatura2: {
      titulo: `${tratamentoDa} da Divisão Administrativa (DA)`,
      nome: nomeDa,
      subtitulo: 'Divisão de Administração - COMARA',
    },
    assinatura3: {
      titulo: 'Engenheiro Fiscal / RH Admin',
      nome: nomeGerente,
      subtitulo: 'Comissão de Aeroportos da Região Amazônica',
    },
  };
}

/**
 * Helper para mesclar canteiros do Firestore com as Sedes/Canteiros base
 */
function mergeWithBaseSedes(firestoreSites: ConstructionSite[]): ConstructionSite[] {
  const map = new Map<string, ConstructionSite>();

  // 1. Carrega sedes base
  BASE_SEDES_CANTEIROS.forEach((base) => {
    const key = (base.code || base.codigo || '').toUpperCase();
    map.set(key, base);
  });

  // 2. Sobrescreve/adiciona com dados do Firestore
  firestoreSites.forEach((site) => {
    const code = (site.code || site.codigo || site.branch || site.sede || '').toUpperCase();
    const existing = map.get(code);
    if (existing) {
      map.set(code, {
        ...existing,
        ...site,
        code: code,
        codigo: code,
        branch: (code as any),
        sede: (code as any),
      });
    } else {
      map.set(code || site.id, {
        ...site,
        code: code || 'CT-01',
        codigo: code || 'CT-01',
        branch: (code || site.branch || 'KO') as any,
        sede: (code || site.sede || 'KO') as any,
      });
    }
  });

  const merged = Array.from(map.values());
  merged.sort((a, b) => (a.name || a.nome || '').localeCompare(b.name || b.nome || ''));
  return merged;
}

export const canteiroService = {
  /**
   * Obtém a lista atual unificada de Canteiros/Sedes diretamente do Cloud Firestore
   */
  async listCanteiros(): Promise<ConstructionSite[]> {
    try {
      const q = query(collection(db, CANTEIROS_COLLECTION));
      const snapshot = await getDocs(q);
      const list: ConstructionSite[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rawName = data.name || data.nome || 'Canteiro de Obras';
        const rawCode = data.code || data.codigo || 'CT-01';
        const rawBranch = data.branch || data.sede || rawCode;
        const rawChief = data.chief || data.chefeCanteiro || '';
        const rawChiefContact = data.chiefContact || data.chefeContato || data.contato || '';
        const rawManager = data.manager || data.gerente || '';
        const rawAddress = data.address || data.endereco || '';
        const rawStatus = data.status || 'Ativo';
        const rawInsalubrity = data.insalubrityLevel || data.grauInsalubridade || '20%';

        list.push({
          id: docSnap.id,
          name: rawName,
          nome: rawName,
          code: rawCode,
          codigo: rawCode,
          branch: rawBranch,
          sede: rawBranch,
          chief: rawChief,
          chefeCanteiro: rawChief,
          chiefContact: rawChiefContact,
          chefeContato: rawChiefContact,
          manager: rawManager,
          gerente: rawManager,
          address: rawAddress,
          endereco: rawAddress,
          status: rawStatus,
          insalubrityLevel: rawInsalubrity,
          grauInsalubridade: rawInsalubrity,
          startDate: data.startDate || data.dataInicio || '',
          dataInicio: data.startDate || data.dataInicio || '',
          expectedEndDate: data.expectedEndDate || data.dataPrevisaoFim || '',
          dataPrevisaoFim: data.expectedEndDate || data.dataPrevisaoFim || '',
          notes: data.notes || data.observacoes || '',
          observacoes: data.notes || data.observacoes || '',
          workerCount: typeof data.workerCount === 'number' ? data.workerCount : 0,
          createdAt: data.createdAt || data.criadoEm,
          updatedAt: data.updatedAt || data.atualizadoEm,
        } as any);
      });

      return mergeWithBaseSedes(list);
    } catch (error) {
      logFirestoreError(error, OperationType.GET, CANTEIROS_COLLECTION);
      return mergeWithBaseSedes([]);
    }
  },

  /**
   * Monitoramento em tempo real unificado da coleção 'canteiros_obras' e Sedes
   */
  subscribeCanteiros(
    onSuccess: (sites: ConstructionSite[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    try {
      return onSnapshot(
        collection(db, CANTEIROS_COLLECTION),
        (snapshot) => {
          const list: ConstructionSite[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const rawName = data.name || data.nome || 'Canteiro de Obras';
            const rawCode = data.code || data.codigo || 'CT-01';
            const rawBranch = data.branch || data.sede || rawCode;
            const rawChief = data.chief || data.chefeCanteiro || '';
            const rawTratamentoChefe = data.tratamentoChefeCanteiro || 'Encarregado';
            const rawChiefContact = data.chiefContact || data.chefeContato || data.contato || '';
            const rawChefeDa = data.chefeDa || '';
            const rawTratamentoChefeDa = data.tratamentoChefeDa || 'Chefe';
            const rawAuxDa = data.auxDa || '';
            const rawManager = data.manager || data.gerente || '';
            const rawAddress = data.address || data.endereco || '';
            const rawStatus = data.status || 'Ativo';
            const rawInsalubrity = data.insalubrityLevel || data.grauInsalubridade || '20%';

            list.push({
              id: docSnap.id,
              name: rawName,
              nome: rawName,
              code: rawCode,
              codigo: rawCode,
              branch: rawBranch,
              sede: rawBranch,
              chief: rawChief,
              chefeCanteiro: rawChief,
              tratamentoChefeCanteiro: rawTratamentoChefe,
              chiefContact: rawChiefContact,
              chefeContato: rawChiefContact,
              chefeDa: rawChefeDa,
              tratamentoChefeDa: rawTratamentoChefeDa,
              auxDa: rawAuxDa,
              manager: rawManager,
              gerente: rawManager,
              address: rawAddress,
              endereco: rawAddress,
              status: rawStatus,
              insalubrityLevel: rawInsalubrity,
              grauInsalubridade: rawInsalubrity,
              startDate: data.startDate || data.dataInicio || '',
              dataInicio: data.startDate || data.dataInicio || '',
              expectedEndDate: data.expectedEndDate || data.dataPrevisaoFim || '',
              dataPrevisaoFim: data.expectedEndDate || data.dataPrevisaoFim || '',
              notes: data.notes || data.observacoes || '',
              observacoes: data.notes || data.observacoes || '',
              workerCount: typeof data.workerCount === 'number' ? data.workerCount : 0,
              responsaveis: data.responsaveis || [],
              historicoTransicao: data.historicoTransicao || [],
              createdAt: data.createdAt || data.criadoEm,
              updatedAt: data.updatedAt || data.atualizadoEm,
            } as any);
          });

          onSuccess(mergeWithBaseSedes(list));
        },
        (error) => {
          logFirestoreError(error, OperationType.LIST, CANTEIROS_COLLECTION);
          if (onError) onError(error);
          onSuccess(mergeWithBaseSedes([]));
        }
      );
    } catch (err: any) {
      logFirestoreError(err, OperationType.LIST, CANTEIROS_COLLECTION);
      if (onError) onError(err);
      onSuccess(mergeWithBaseSedes([]));
      return () => {};
    }
  },

  /**
   * Salva ou atualiza um canteiro/sede diretamente no Cloud Firestore (coleção 'canteiros_obras')
   */
  async saveCanteiro(site: Partial<ConstructionSite> & { chiefContact?: string; chefeContato?: string }): Promise<void> {
    const rawCode = (site.code || site.codigo || 'KO').toUpperCase();
    const docId = site.id || `canteiro-${rawCode.toLowerCase()}-${Date.now()}`;
    const path = `${CANTEIROS_COLLECTION}/${docId}`;
    const nowIso = new Date().toISOString();

    const rawName = site.name || site.nome || `Canteiro ${rawCode}`;
    const rawBranch = (site.branch || site.sede || rawCode).toUpperCase();
    const rawChief = site.chief || site.chefeCanteiro || '';
    const rawTratamentoChefe = site.tratamentoChefeCanteiro || 'Encarregado';
    const rawChiefContact = site.chiefContact || site.chefeContato || '';
    const rawChefeDa = site.chefeDa || '';
    const rawTratamentoChefeDa = site.tratamentoChefeDa || 'Chefe';
    const rawAuxDa = site.auxDa || '';
    const rawManager = site.manager || site.gerente || '';
    const rawAddress = site.address || site.endereco || '';
    const rawStatus = site.status || 'Ativo';
    const rawInsalubrity = site.insalubrityLevel || site.grauInsalubridade || '20%';
    const rawStartDate = site.startDate || site.dataInicio || '';
    const rawEndDate = site.expectedEndDate || site.dataPrevisaoFim || '';
    const rawNotes = site.notes || site.observacoes || '';

    const dataToSave = sanitizeFirestoreData({
      id: docId,
      name: rawName,
      nome: rawName,
      code: rawCode,
      codigo: rawCode,
      address: rawAddress,
      endereco: rawAddress,
      branch: rawBranch,
      sede: rawBranch,
      chief: rawChief,
      chefeCanteiro: rawChief,
      tratamentoChefeCanteiro: rawTratamentoChefe,
      chiefContact: rawChiefContact,
      chefeContato: rawChiefContact,
      chefeDa: rawChefeDa,
      tratamentoChefeDa: rawTratamentoChefeDa,
      auxDa: rawAuxDa,
      manager: rawManager,
      gerente: rawManager,
      responsaveis: site.responsaveis || [],
      historicoTransicao: site.historicoTransicao || [],
      status: rawStatus,
      insalubrityLevel: rawInsalubrity,
      grauInsalubridade: rawInsalubrity,
      workerCount: typeof site.workerCount === 'number' ? site.workerCount : 0,
      startDate: rawStartDate,
      dataInicio: rawStartDate,
      expectedEndDate: rawEndDate,
      dataPrevisaoFim: rawEndDate,
      notes: rawNotes,
      observacoes: rawNotes,
      createdAt: site.createdAt || nowIso,
      updatedAt: nowIso,
    });

    try {
      await setDoc(doc(db, CANTEIROS_COLLECTION, docId), dataToSave, { merge: true });
    } catch (error) {
      logFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  /**
   * Exclui um canteiro diretamente do Cloud Firestore
   */
  async deleteCanteiro(id: string): Promise<void> {
    const path = `${CANTEIROS_COLLECTION}/${id}`;
    try {
      await deleteDoc(doc(db, CANTEIROS_COLLECTION, id));
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  }
};
