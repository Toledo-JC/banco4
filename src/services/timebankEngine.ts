import { OccurrenceType, Branch, TimeRecord, Employee, MonthlyEmployeeSummary } from '../types';
import { BRAZILIAN_HOLIDAYS_2025_2026 } from '../constants/defaultData';

export type DestinationTarget = 'FOLHA_PAGAMENTO' | 'BANCO_HORAS' | 'NEUTRO_AUDITORIA';

export interface CalculationResult {
  multiplicador: number;
  saldoCalculado: number; // Impacto no Banco de Horas (+ crédito, - débito, 0 neutro)
  horasDescontoFolha: number; // Horas enviadas para Desconto em Folha / Contracheque
  destinoLancamento: DestinationTarget;
  diaSemana: number; // 0=Dom, 1=Seg, ..., 6=Sab
  diaSemanaNome: string;
  eFeriado: boolean;
  nomeFeriado?: string;
  descricaoRegra: string;
  requerComprovante: boolean;
  requerObservacao: boolean;
}

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

/**
 * Verifica se uma data é feriado considerando feriados nacionais e municipais/estaduais por sede.
 */
export function checkIsHoliday(dataString: string, sede?: Branch | string): { eFeriado: boolean; nome?: string } {
  if (!dataString) return { eFeriado: false };
  
  const found = BRAZILIAN_HOLIDAYS_2025_2026.find(h => {
    if (h.data !== dataString) return false;
    if (!h.sedeAtingida || h.sedeAtingida === 'TODAS') return true;
    if (sede && h.sedeAtingida === sede) return true;
    return false;
  });

  if (found) {
    return { eFeriado: true, nome: found.nome };
  }
  return { eFeriado: false };
}

/**
 * Obtém o dia da semana a partir da data YYYY-MM-DD (tratando fuso horário local).
 */
export function parseDateInfo(dataString: string) {
  if (!dataString) {
    const today = new Date();
    return {
      diaSemana: today.getDay(),
      diaSemanaNome: DIAS_SEMANA[today.getDay()],
    };
  }
  
  const [year, month, day] = dataString.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const diaSemana = dateObj.getDay();
  return {
    diaSemana,
    diaSemanaNome: DIAS_SEMANA[diaSemana],
  };
}

/**
 * MOTOR DE CÁLCULO SPTF / CLT - REGRAS OPERACIONAIS:
 * 
 * 1. FALTA (SEM JUSTIFICATIVA):
 *    - Impacto: Envia para "Desconto em Folha / Contracheque".
 *    - Banco de Horas: NÃO afeta o saldo do Banco de Horas (0h no banco).
 * 
 * 2. DISPENSA / SAÍDA ANTECIPADA / HORAS NEGATIVAS OPERACIONAIS:
 *    - Impacto: Envia para o "Banco de Horas".
 *    - Banco de Horas: Debita do saldo acumulado do colaborador (ex: -8h ou horas informadas no banco).
 * 
 * 3. FALTA JUSTIFICADA (Atestado Médico, Ordem Judicial, Licença Gala/Luto, Férias, etc.):
 *    - Impacto: Registro neutro para auditoria.
 *    - Banco de Horas e Folha: NÃO gera desconto em folha e NÃO debita do Banco de Horas (0h no banco, 0h no desconto).
 * 
 * 4. TRABALHO (Horas Trabalhadas Normais/Extras):
 *    - Segunda a Sexta: 1.0x (1:1)
 *    - Sábado: 1.5x (1:1,5)
 *    - Domingo / Feriado: 2.0x (1:2 - Horas em Dobro)
 */
export function calculateSPTFBalance(
  tipo: OccurrenceType,
  horasBrutas: number,
  dataString: string,
  forcarFeriado?: boolean,
  sede?: Branch
): CalculationResult {
  const { diaSemana, diaSemanaNome } = parseDateInfo(dataString);
  const holidayCheck = checkIsHoliday(dataString, sede);
  const eFeriado = forcarFeriado !== undefined ? forcarFeriado : holidayCheck.eFeriado;
  const nomeFeriado = holidayCheck.nome;

  let multiplicador = 1.0;
  let saldoCalculado = 0.0;
  let horasDescontoFolha = 0.0;
  let destinoLancamento: DestinationTarget = 'BANCO_HORAS';
  let descricaoRegra = '';
  let requerComprovante = false;
  let requerObservacao = false;

  switch (tipo) {
    case 'TRABALHO': {
      destinoLancamento = 'BANCO_HORAS';
      if (diaSemana === 0 || eFeriado) {
        // Domingo ou Feriado -> x2.0 (Horas em dobro 1:2)
        multiplicador = 2.0;
        saldoCalculado = horasBrutas * 2.0;
        descricaoRegra = eFeriado 
          ? `Feriado (${nomeFeriado || 'Oficial'}): Multiplicador x 2.0 (Horas em Dobro 1:2 no Banco)`
          : `Domingo: Multiplicador x 2.0 (Horas em Dobro 1:2 no Banco)`;
      } else if (diaSemana === 6) {
        // Sábado -> x1.5 (Adicional de Sábado 1:1,5)
        multiplicador = 1.5;
        saldoCalculado = horasBrutas * 1.5;
        descricaoRegra = `Sábado: Multiplicador x 1.5 (Adicional 1:1,5 no Banco)`;
      } else {
        // Segunda a Sexta -> x1.0 (Horas Normais 1:1)
        multiplicador = 1.0;
        saldoCalculado = horasBrutas * 1.0;
        descricaoRegra = `Segunda a Sexta: Multiplicador x 1.0 (Horas Normais 1:1 no Banco)`;
      }
      break;
    }

    // REGRA: ACABOU BANHOU (Conclusão antecipada da missão - NÃO desconta do banco de horas)
    case 'ACABOU_BANHOU': {
      multiplicador = 1.0;
      saldoCalculado = 0.0; // NÃO gera débito e NÃO desconta do banco
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Acabou Banhou: Conclusão antecipada da missão com liberação operacional combinada. Registro neutro sem débito no banco de horas (0h) e sem desconto em folha.`;
      requerComprovante = false;
      requerObservacao = false;
      break;
    }

    // REGRA 1: FALTA (SEM JUSTIFICATIVA)
    // Envia para Desconto em Folha / Contracheque (0h no Banco de Horas)
    case 'FALTA_INJUSTIFICADA': {
      multiplicador = 0.0;
      saldoCalculado = 0.0; // NÃO afeta o saldo do Banco de Horas
      horasDescontoFolha = horasBrutas > 0 ? horasBrutas : 8.0;
      destinoLancamento = 'FOLHA_PAGAMENTO';
      descricaoRegra = `Falta Injustificada ('F' / 'D'): Enviada para Desconto em Folha / Contracheque (${horasDescontoFolha.toFixed(1)}h a descontar na folha; 0h no Banco de Horas).`;
      requerObservacao = true;
      break;
    }

    // REGRA 2: DISPENSA / SAÍDA ANTECIPADA / HORAS NEGATIVAS OPERACIONAIS (COMPENSAÇÃO)
    // Envia para o Banco de Horas -> Debita do saldo acumulado do colaborador (ex: -8h no banco)
    case 'COMPENSACAO_DISPENSA':
    case 'COMPENSACAO':
    case 'DISPENSA_OPERACIONAL': {
      multiplicador = 1.0;
      const horasDebito = Math.abs(horasBrutas) > 0 ? Math.abs(horasBrutas) : 8.0;
      saldoCalculado = -horasDebito;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'BANCO_HORAS';
      descricaoRegra = tipo === 'COMPENSACAO_DISPENSA'
        ? `Dispensa de SPTF / Compensação: Débito de -${horasDebito.toFixed(1)}h no Banco de Horas com emissão de guia em 2 vias.`
        : `Dispensa / Saída Antecipada / Débito em Banco ('COMP'): Debita -${horasDebito.toFixed(1)}h do Banco de Horas acumulado.`;
      requerObservacao = tipo !== 'COMPENSACAO_DISPENSA';
      break;
    }

    // REGRA 3: FALTA JUSTIFICADA (ATESTADO MÉDICO, LICENÇA LEGAL, ORDEM JUDICIAL, ETC.)
    // Registro neutro para auditoria (0h no Banco e 0h na Folha)
    case 'ATESTADO_MEDICO': {
      multiplicador = 0.0;
      saldoCalculado = 0.0;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Atestado Médico ('AT'): Registro neutro para auditoria (0h no Banco de Horas, 0h no Desconto em Folha). Anexo e observação obrigatórios.`;
      requerComprovante = true;
      requerObservacao = true;
      break;
    }

    case 'FALTA_JUSTIFICADA': {
      multiplicador = 0.0;
      saldoCalculado = 0.0;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Falta Justificada (Ordem Judicial/Gala/Luto): Registro neutro para auditoria (0h no Banco, 0h na Folha).`;
      requerObservacao = true;
      break;
    }

    case 'FERIAS': {
      multiplicador = 0.0;
      saldoCalculado = 0.0;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Férias ('FE'): Período regular de descanso homologado. Registro neutro (0h no Banco, 0h na Folha).`;
      requerObservacao = false;
      break;
    }

    case 'LICENCA': {
      multiplicador = 0.0;
      saldoCalculado = 0.0;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Licença Legal / Remunerada ('LIC'): Registro neutro para auditoria (0h no Banco, 0h na Folha).`;
      requerComprovante = true;
      requerObservacao = true;
      break;
    }

    default: {
      multiplicador = 1.0;
      saldoCalculado = horasBrutas;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'BANCO_HORAS';
      descricaoRegra = 'Lançamento regular no Banco de Horas';
    }
  }

  return {
    multiplicador,
    saldoCalculado: Number(saldoCalculado.toFixed(2)),
    horasDescontoFolha: Number(horasDescontoFolha.toFixed(2)),
    destinoLancamento,
    diaSemana,
    diaSemanaNome,
    eFeriado,
    nomeFeriado,
    descricaoRegra,
    requerComprovante,
    requerObservacao
  };
}

export const calculateCLTBalance = calculateSPTFBalance;

/**
 * Formata horas decimais em string legível com sinal: ex: "+12,5h", "-8,0h", "0,0h"
 */
export function formatHoursDecimal(hours: number): string {
  const sign = hours > 0 ? '+' : '';
  return `${sign}${hours.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}h`;
}

/**
 * Converte horas decimais para formato HH:MM (ex: 2.5 -> "+02:30", -8.25 -> "-08:15")
 */
export function formatHoursToHHMM(hours: number): string {
  const isNegative = hours < 0;
  const absHours = Math.abs(hours);
  const h = Math.floor(absHours);
  const m = Math.round((absHours - h) * 60);
  const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : `+${formatted}`;
}

/**
 * Converte saldo em horas para equivalente em dias de trabalho (Jornada base SPTF 8h/dia)
 */
export function formatHoursToDays(hours: number): string {
  const dias = hours / 8;
  const sign = dias > 0 ? '+' : '';
  return `${sign}${dias.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} dias`;
}

/**
 * Consolida o saldo total de um colaborador:
 * - Saldo do Banco de Horas = Saldo Inicial + Créditos no Banco - Débitos no Banco (Dispensas/Compensações)
 * - Faltas Injustificadas são contabilizadas como Desconto em Folha (não impactam o saldo do banco)
 */
export function getEmployeeTotalBalance(
  matricula: string,
  employees: Employee[],
  records: TimeRecord[]
): {
  saldoTotalHoras: number;
  saldoTotalDias: number;
  saldoInicial: number;
  totalCreditos: number;
  totalDebitos: number;
  totalAtestados: number;
  totalFaltas: number;
  totalHorasDescontoFolha: number;
  totalHorasExtras50: number;
  totalHorasExtras100: number;
  status: 'CREDOR' | 'DEVEDOR' | 'ZERADO';
} {
  const cleanMat = matricula.trim().toUpperCase();
  const emp = employees.find(e => e.matricula.trim().toUpperCase() === cleanMat || e.matricula.replace(/^0+/, '') === cleanMat.replace(/^0+/, ''));
  const saldoInicial = emp?.saldoInicialHoras || 0;
  
  const empRecords = records.filter(r => 
    r.matricula.trim().toUpperCase() === cleanMat || 
    r.matricula.replace(/^0+/, '') === cleanMat.replace(/^0+/, '')
  );

  let totalCreditos = 0;
  let totalDebitos = 0;
  let totalAtestados = 0;
  let totalFaltas = 0;
  let totalHorasDescontoFolha = 0;
  let totalHorasExtras50 = 0;
  let totalHorasExtras100 = 0;

  empRecords.forEach(r => {
    // 1. Créditos no Banco de Horas
    if (r.saldoCalculado > 0) {
      totalCreditos += r.saldoCalculado;
    } 
    // 2. Débitos no Banco de Horas (Dispensas operacionais, saídas antecipadas, folgas compensatórias)
    else if (r.saldoCalculado < 0) {
      totalDebitos += Math.abs(r.saldoCalculado);
    }

    // 3. Faltas Injustificadas -> Desconto em Folha
    if (r.tipoOcorrencia === 'FALTA_INJUSTIFICADA') {
      totalFaltas++;
      totalHorasDescontoFolha += (r.horasDescontoFolha || (r.horasBrutas > 0 ? r.horasBrutas : 8.0));
    }

    // 4. Atestados / Justificativas
    if (r.tipoOcorrencia === 'ATESTADO_MEDICO' || r.tipoOcorrencia === 'FALTA_JUSTIFICADA') {
      totalAtestados++;
    }

    // 5. Horas extras por multiplicador
    if (r.tipoOcorrencia === 'TRABALHO') {
      if (r.multiplicador === 1.5) {
        totalHorasExtras50 += r.horasBrutas;
      } else if (r.multiplicador === 2.0) {
        totalHorasExtras100 += r.horasBrutas;
      }
    }
  });

  const saldoTotalHoras = Number((saldoInicial + totalCreditos - totalDebitos).toFixed(2));
  const saldoTotalDias = Number((saldoTotalHoras / 8).toFixed(2));

  let status: 'CREDOR' | 'DEVEDOR' | 'ZERADO' = 'ZERADO';
  if (saldoTotalHoras > 0.05) status = 'CREDOR';
  else if (saldoTotalHoras < -0.05) status = 'DEVEDOR';

  return {
    saldoTotalHoras,
    saldoTotalDias,
    saldoInicial,
    totalCreditos: Number(totalCreditos.toFixed(2)),
    totalDebitos: Number(totalDebitos.toFixed(2)),
    totalAtestados,
    totalFaltas,
    totalHorasDescontoFolha: Number(totalHorasDescontoFolha.toFixed(2)),
    totalHorasExtras50: Number(totalHorasExtras50.toFixed(2)),
    totalHorasExtras100: Number(totalHorasExtras100.toFixed(2)),
    status
  };
}
