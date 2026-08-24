export type Branch = 'KO' | 'BE' | 'MN' | 'SP' | 'RJ';

export type EmployeeStatus = 'Ativo' | 'Inativo' | 'Afastado' | 'Férias';

export type GrauInsalubridade = 'ISENTO' | '10%' | '20%' | '40%';

export type OccurrenceType = 
  | 'TRABALHO'                  // Horas Trabalhadas Normais/Extras (+ Crédito no Banco de Horas)
  | 'ACABOU_BANHOU'             // Acabou Banhou: Conclusão de Missão (Neutro: 0h Banco, 0h Folha, sem desconto)
  | 'FALTA_INJUSTIFICADA'       // 'F' ou 'D' (Desconto em Folha / Contracheque - 0h no Banco)
  | 'FALTA_JUSTIFICADA'         // Atestado, Licença Gala/Luto, Ordem Judicial (Neutro: 0h Banco, 0h Folha)
  | 'DISPENSA_OPERACIONAL'      // Dispensa / Saída Antecipada / Horas Negativas Operacionais (Débito no Banco)
  | 'COMPENSACAO'               // Folga Compensatória / Débito em Banco (Débito no Banco)
  | 'ATESTADO_MEDICO'           // 'AT' (Falta Justificada Médica - Neutro: 0h Banco, 0h Folha)
  | 'FERIAS'                    // 'FE' (Descanso Anual - Neutro: 0h Banco, 0h Folha)
  | 'LICENCA';                  // 'LIC' (Licença Legal/Gala/Luto - Neutro: 0h Banco, 0h Folha)

export type CompensationStatus = 'ABERTO' | 'PARCIALMENTE_COMPENSADO' | 'TOTALMENTE_COMPENSADO';

export interface LiquidationLink {
  id_origem: string;
  id_baixa: string;
  data_origem: string;
  data_baixa: string;
  horas_liquidadas: number;
  tipo_baixa: OccurrenceType;
  observacao?: string;
}

export type AdminRole = 'SUPER_ADMIN' | 'GESTOR_RH' | 'AUX_DA' | 'AUDITOR' | 'CHEFE_CANTEIRO' | 'ROLE_GERENTE' | 'GERENTE_CAMPO';

export type AccessLogType = 
  | 'LOGIN_COLABORADOR' 
  | 'CONSULTA_SALDO' 
  | 'PRIMEIRO_ACESSO' 
  | 'DEFINICAO_SENHA' 
  | 'LOGIN_GESTAO_RH' 
  | 'RESET_SENHA_RH' 
  | 'TENTATIVA_INVALIDA';

export interface EmployeeAuth {
  matricula: string;
  passwordHash?: string;
  senhaDefinida: boolean;
  email?: string;
  tokenRecuperacao?: string;
  tokenExpiracao?: string;
  ultimoAcesso?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface AccessLog {
  id: string;
  timestamp: string;
  matricula: string;
  nome: string;
  tipoAcao: AccessLogType;
  sucesso: boolean;
  detalhes: string;
  ipOrigem?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  nivelAcesso: AdminRole;
  role?: AdminRole;
  sede?: string;
  ativo: boolean;
  passwordHash?: string;
  senha?: string;
  criadoEm: string;
  atualizadoEm?: string;
}

export interface AuthSession {
  email: string;
  nome: string;
  matricula?: string;
  role: AdminRole;
  cargo?: string;
  loginTime: string;
}

export interface Employee {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
  sede: Branch; // Sede padrão/fixa
  sede_origem?: Branch; // Sede contratual / fixa
  sede_atual?: Branch; // Canteiro / sede temporária
  dataInicioAlocacao?: string; // Início da missão
  dataFimAlocacao?: string; // Fim da missão
  dataAdmissao: string;
  status: EmployeeStatus;
  dataInicioStatus?: string; // Início de Férias ou Afastamento
  dataFimStatus?: string; // Término de Férias ou Afastamento
  data_inicio_status?: string;
  data_fim_status?: string;
  motivoStatus?: string;
  observacao_status?: string;
  cpf?: string;
  rg?: string;
  pis?: string;
  dataNascimento?: string;
  cargo?: string;
  departamento?: string;
  jornadaTrabalho?: string;
  horarioTrabalho?: string;
  email?: string;
  telefone?: string;
  saldoInicialHoras?: number;
  grauInsalubridadeFixa?: GrauInsalubridade;
  primeiroAcesso?: boolean;
  senhaCadastrada?: boolean;
  senhaInicial?: string;
  avatarUrl?: string;
  url_foto_perfil?: string;
  id_drive_foto?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  dataUrl?: string;
  driveFileId: string;
  driveViewUrl: string;
  uploadTimestamp: string;
}

export interface TimeRecord {
  id: string;
  matricula: string;
  employeeName?: string;
  employeeSede?: Branch;
  employeeFuncao?: string;
  employeeAvatarUrl?: string;
  dataRegistro: string; // YYYY-MM-DD
  data_ocorrencia?: string; // Data exata em que a hora positiva ou negativa ocorreu
  tipoOcorrencia: OccurrenceType;
  codigoOcorrencia?: 'TRAB' | 'F' | 'D' | 'AT' | 'FE' | 'LIC' | 'COMP';
  horasBrutas: number; // Ex: 8.0 ou 2.5
  multiplicador: number; // 1.0, 1.5, 2.0, ou 0.0
  saldoCalculado: number; // Em horas decimais (ex: +3.75, -8.0, 0.0)
  horasDescontoFolha?: number; // Horas destinadas a Desconto em Folha (para Falta Injustificada)
  destinoLancamento?: 'FOLHA_PAGAMENTO' | 'BANCO_HORAS' | 'NEUTRO_AUDITORIA';
  saldo_remanescente?: number; // Quantidade de horas daquela data que ainda não foram abatidas
  status_compensacao?: CompensationStatus; // ABERTO, PARCIALMENTE_COMPENSADO, TOTALMENTE_COMPENSADO
  liquidacoes?: LiquidationLink[]; // Detalhes de baixas/compensações atreladas a este lançamento
  eFeriado: boolean;
  nomeFeriado?: string;
  diaSemana: number; // 0=Dom, 1=Seg, ..., 6=Sab
  diaSemanaNome: string;
  observacao?: string;
  comprovante?: Attachment;
  criadoPorEmail?: string;
  criadoEm: string;
  atualizadoEm?: string;
  editadoPor?: string;
  editadoEm?: string;
}

export interface Holiday {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: 'Nacional' | 'Estadual' | 'Municipal';
  sedeAtingida?: Branch | 'TODAS';
}

export interface DashboardFilter {
  dataInicio: string;
  dataFim: string;
  sede: string; // 'TODAS' | Branch
  funcao: string; // 'TODAS' | string
  matriculaOrNome: string;
  statusBanco: 'TODOS' | 'CREDOR' | 'DEVEDOR' | 'ZERADO';
  tipoOcorrencia: string; // 'TODOS' | OccurrenceType
}

export interface MonthlyEmployeeSummary {
  matricula: string;
  nome: string;
  funcao: string;
  sede: Branch;
  anoMes: string; // YYYY-MM
  saldoAnteriorHoras: number;
  creditoHorasMes: number;
  debitoHorasMes: number;
  saldoFinalHoras: number;
  saldoFinalDias: number; // saldoFinalHoras / 8
  totalAtestados: number;
  totalFaltas: number;
  totalHorasExtras50: number;
  totalHorasExtras100: number;
}

export interface InsalubrityRecord {
  id: string;
  matricula: string;
  nomeColaborador: string;
  sede: Branch;
  funcao: string;
  dataEvento: string; // YYYY-MM-DD
  atividadeDesempenhada: string;
  grauExposicao: '10%' | '20%' | '40%';
  quantidadeHorasDias: number;
  unidade: 'HORAS' | 'DIAS';
  responsavelLancamento: string; // Encarregado / RH
  observacoes?: string;
  criadoEm: string;
  criadoPorEmail?: string;
  atualizadoEm?: string;
  editadoPor?: string;
  editadoEm?: string;
}

export interface ConstructionSite {
  id: string;
  codigo: string; // Ex: KO-01, BE-01, MN-01
  nome: string; // Ex: Canteiro Aeroporto Coari
  endereco?: string;
  sede?: Branch;
  chefeCanteiro?: string; // Encarregado / Chefe de Canteiro
  chefeContato?: string; // Telefone / Contato do Chefe de Canteiro
  chiefContact?: string;
  gerente?: string; // Fiscal / Gerente
  status: 'Ativo' | 'Em Desmobilização' | 'Encerrado' | 'ACTIVE' | 'INACTIVE' | 'PLANNED';
  grauInsalubridade?: GrauInsalubridade;
  insalubrityLevel?: GrauInsalubridade;
  dataInicio?: string;
  dataPrevisaoFim?: string;
  startDate?: string;
  expectedEndDate?: string;
  observacoes?: string;
  notes?: string;
  workerCount?: number;
  chief?: string;
  manager?: string;
  branch?: Branch;
  name?: string;
  code?: string;
  address?: string;
  createdAt?: string;
  criadoEm?: string;
  updatedAt?: string;
  atualizadoEm?: string;
}

export interface SystemConfig {
  logoUrl?: string;
  companyName?: string;
  subtitle?: string;
  insalubrityMode?: 'COMPLETA' | 'SIMPLES';
  atualizadoEm?: string;
  atualizadoPor?: string;
}

