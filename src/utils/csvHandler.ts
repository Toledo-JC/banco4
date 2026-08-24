import Papa from 'papaparse';
import { Employee, TimeRecord, Branch, EmployeeStatus, OccurrenceType } from '../types';
import { calculateSPTFBalance } from './calculations';

export interface CSVImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  skippedCount: number;
}

export type DuplicateAction = 'update' | 'skip' | 'error';

/**
 * Higieniza células de CSV exportadas do Excel com a sintaxe ="valor" ou aspas duplas.
 */
export function sanitizeCsvCell(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return '';
  let str = String(cellValue).trim();
  
  // Desenrola repetidamente padrões do Excel: ="valor", "=""valor""", """valor""", "valor", etc.
  let previous = '';
  while (str !== previous) {
    previous = str;
    str = str.trim();
    if (str.startsWith('="') && str.endsWith('"')) {
      str = str.substring(2, str.length - 1);
    } else if (str.startsWith('=\\"') && str.endsWith('\\"')) {
      str = str.substring(3, str.length - 2);
    } else if (str.startsWith('"') && str.endsWith('"')) {
      str = str.substring(1, str.length - 1);
    } else if (str.startsWith("'") && str.endsWith("'")) {
      str = str.substring(1, str.length - 1);
    } else if (str.startsWith('=') && !str.startsWith('==')) {
      str = str.substring(1);
    }
  }
  return str.trim();
}

/**
 * Normaliza nomes de cabeçalhos de CSV removendo sintaxe do Excel, aspas, espaços e caracteres especiais.
 */
export function sanitizeHeaderKey(header: string): string {
  const clean = sanitizeCsvCell(header);
  return clean
    .replace(/^["'=]+|["'=]+$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/**
 * Busca o valor de uma coluna no objeto da linha através de múltiplos aliases possíveis.
 */
export function getRowValue(row: any, ...aliases: string[]): string {
  if (!row || typeof row !== 'object') return '';

  const normalizedAliases = aliases.map(a => sanitizeHeaderKey(a));

  // 1. Verificação direta nos campos do objeto
  for (const alias of normalizedAliases) {
    if (row[alias] !== undefined && row[alias] !== null) {
      const sanitized = sanitizeCsvCell(row[alias]);
      if (sanitized !== '') return sanitized;
    }
  }

  // 2. Verificação varrendo todas as chaves (fallback para cabeçalhos com caracteres residuais)
  for (const [key, val] of Object.entries(row)) {
    const cleanKey = sanitizeHeaderKey(key);
    if (normalizedAliases.includes(cleanKey)) {
      if (val !== undefined && val !== null) {
        const sanitized = sanitizeCsvCell(val);
        if (sanitized !== '') return sanitized;
      }
    }
  }

  return '';
}

/**
 * Converte datas em múltiplos formatos (DD/MM/YYYY, YYYY-MM-DD, D/M/YYYY) para YYYY-MM-DD
 */
export function parseDateCell(raw: any, defaultDate: string = '2024-01-01'): string {
  const clean = sanitizeCsvCell(raw);
  if (!clean) return defaultDate;

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return clean;
}

/**
 * Faz o parsing de um arquivo CSV de colaboradores e normaliza os campos com suporte a dados do Excel.
 */
export function parseEmployeesCSV(
  fileContent: string,
  existingEmployees: Employee[],
  duplicateAction: DuplicateAction = 'update'
): Promise<CSVImportResult<Employee>> {
  return new Promise((resolve) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => sanitizeHeaderKey(header),
      complete: (results) => {
        const errors: string[] = [];
        const validEmployees: Employee[] = [];
        let duplicateCount = 0;
        let skippedCount = 0;

        const existingMap = new Map<string, Employee>();
        existingEmployees.forEach((emp) => {
          existingMap.set(sanitizeCsvCell(emp.matricula).toUpperCase(), emp);
        });

        results.data.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +1 zero-indexed, +1 header row

          // 1. Mapeamento robusto com getRowValue (suporta Funcionarios DECO-KO.csv e outros formatos)
          const matriculaRaw = getRowValue(
            row,
            'matricula', 'matricula_numero', 'mat', 'id', 'codigo', 'codigoexterno', 'codigo_externo'
          );
          const nomeRaw = getRowValue(
            row,
            'nomecompleto', 'nome_completo', 'nome', 'colaborador', 'funcionario', 'name'
          );
          const cpfRaw = getRowValue(
            row,
            'cpf', 'documento', 'cpf_numero'
          );
          const departamentoRaw = getRowValue(
            row,
            'departamentonome', 'departamento_nome', 'departamento', 'depto', 'setor'
          );
          const cargoRaw = getRowValue(
            row,
            'cargonome', 'cargo_nome', 'cargo', 'funcao', 'função', 'cargo_cbo', 'role'
          );
          const dataAdmissaoRaw = getRowValue(
            row,
            'dataadmissao', 'data_admissao', 'admissao', 'hiredate'
          );
          const dataNascimentoRaw = getRowValue(
            row,
            'datanascimento', 'data_nascimento', 'nascimento', 'birthdate'
          );
          const pisRaw = getRowValue(
            row,
            'pis', 'pispasep', 'pis_pasep'
          );
          const celularRaw = getRowValue(
            row,
            'celular', 'telefone', 'tel', 'phone'
          );
          const emailRaw = getRowValue(
            row,
            'email', 'e_mail'
          );
          const horarioRaw = getRowValue(
            row,
            'horarionome', 'horario_nome', 'horario', 'jornada', 'jornadadetrabalho', 'jornadatrabalho'
          );
          const sedeRaw = getRowValue(
            row,
            'sede', 'sedeorigem', 'sede_origem', 'filial', 'unidade', 'base'
          );
          const statusRaw = getRowValue(
            row,
            'status', 'situacao', 'situação'
          ) || 'Ativo';
          const senhaInicialRaw = getRowValue(
            row,
            'senhainicial', 'senha_inicial', 'senha', 'password', 'senhapadrao', 'senhaprovisoria'
          );
          const saldoInicialRaw = getRowValue(
            row,
            'saldoinicial', 'saldo_inicial', 'saldo'
          ) || '0';
          const fotoRaw = getRowValue(
            row,
            'urlfotoperfil', 'url_foto_perfil', 'foto', 'fotoperfil', 'avatar', 'avatarurl'
          );

          if (!matriculaRaw || !nomeRaw) {
            // Se linha totalmente vazia, apenas ignora
            if (!matriculaRaw && !nomeRaw && !cargoRaw) return;
            errors.push(`Linha ${rowNum}: 'Matrícula' ou 'Nome' não identificados.`);
            return;
          }

          // Matrícula preservando zeros à esquerda (ex: "00123" permanece "00123")
          const matricula = matriculaRaw;
          const nome = nomeRaw;
          const cargo = cargoRaw || 'Colaborador';
          const funcao = cargo;

          // Determinação da Sede / Sede Origem
          let sedeNormalized: Branch = 'KO';
          const deptoLower = (departamentoRaw || '').toLowerCase();
          const sedeLower = (sedeRaw || '').toLowerCase();

          if (deptoLower.includes('ko') || deptoLower.includes('coari') || sedeLower.includes('ko') || sedeLower.includes('coari')) {
            sedeNormalized = 'KO';
          } else if (deptoLower.includes('be') || deptoLower.includes('bel') || sedeLower.includes('be') || sedeLower.includes('bel')) {
            sedeNormalized = 'BE';
          } else if (deptoLower.includes('mn') || deptoLower.includes('man') || sedeLower.includes('mn') || sedeLower.includes('man')) {
            sedeNormalized = 'MN';
          } else if (deptoLower.includes('sp') || sedeLower.includes('sp')) {
            sedeNormalized = 'SP';
          } else if (deptoLower.includes('rj') || sedeLower.includes('rj')) {
            sedeNormalized = 'RJ';
          }

          // Normalização de Status
          let statusNormalized: EmployeeStatus = 'Ativo';
          const stUpper = statusRaw.toUpperCase();
          if (stUpper.includes('INAT')) statusNormalized = 'Inativo';
          else if (stUpper.includes('AFAST')) statusNormalized = 'Afastado';
          else if (stUpper.includes('FERIA') || stUpper.includes('FÉRIA')) statusNormalized = 'Férias';

          // Tratamento de Datas
          const dataAdmissao = parseDateCell(dataAdmissaoRaw, '2024-01-01');
          const dataNascimento = dataNascimentoRaw ? parseDateCell(dataNascimentoRaw, '') : undefined;

          const parsedSaldo = parseFloat(saldoInicialRaw.replace(',', '.')) || 0;
          const urlFoto = fotoRaw || undefined;

          // Se a senha inicial for fornecida no CSV (mínimo 4 caracteres)
          const hasSenhaInicial = Boolean(senhaInicialRaw && senhaInicialRaw.trim().length >= 4);

          const isDuplicate = existingMap.has(matricula.toUpperCase());

          if (isDuplicate) {
            duplicateCount++;
            if (duplicateAction === 'skip') {
              skippedCount++;
              return;
            }
          }

          const prevEmp = existingMap.get(matricula.toUpperCase());

          const primeiroAcesso = hasSenhaInicial
            ? false
            : (isDuplicate && prevEmp?.primeiroAcesso !== undefined ? prevEmp.primeiroAcesso : true);

          const senhaCadastrada = hasSenhaInicial
            ? true
            : (isDuplicate && prevEmp?.senhaCadastrada !== undefined ? prevEmp.senhaCadastrada : false);

          const employeeObj: Employee = {
            id: isDuplicate && prevEmp ? prevEmp.id : `emp-${Date.now()}-${index}`,
            matricula, // Preservando zeros à esquerda
            nome,
            funcao,
            cargo,
            departamento: departamentoRaw || undefined,
            sede: sedeNormalized,
            sede_origem: sedeNormalized,
            dataAdmissao,
            dataNascimento,
            cpf: cpfRaw || undefined,
            pis: pisRaw || undefined,
            status: statusNormalized,
            email: emailRaw || undefined,
            telefone: celularRaw || undefined,
            jornadaTrabalho: horarioRaw || undefined,
            saldoInicialHoras: parsedSaldo,
            primeiroAcesso,
            senhaCadastrada,
            senhaInicial: hasSenhaInicial ? senhaInicialRaw.trim() : undefined,
            avatarUrl: urlFoto || prevEmp?.avatarUrl,
            url_foto_perfil: urlFoto || prevEmp?.url_foto_perfil,
            id_drive_foto: prevEmp?.id_drive_foto,
          };

          validEmployees.push(employeeObj);
        });

        resolve({
          success: errors.length === 0 || validEmployees.length > 0,
          data: validEmployees,
          errors,
          totalRows: results.data.length,
          importedCount: validEmployees.length,
          duplicateCount,
          skippedCount,
        });
      },
      error: (err) => {
        resolve({
          success: false,
          data: [],
          errors: [err.message],
          totalRows: 0,
          importedCount: 0,
          duplicateCount: 0,
          skippedCount: 0,
        });
      },
    });
  });
}

/**
 * Faz o parsing de um arquivo CSV de lançamentos / histórico de ponto com suporte a dados sanitizados do Excel.
 */
export function parseTimeRecordsCSV(
  fileContent: string,
  employees: Employee[]
): Promise<CSVImportResult<TimeRecord>> {
  return new Promise((resolve) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => sanitizeHeaderKey(header),
      complete: (results) => {
        const errors: string[] = [];
        const validRecords: TimeRecord[] = [];
        const empMap = new Map(employees.map(e => [sanitizeCsvCell(e.matricula).toUpperCase(), e]));

        results.data.forEach((row: any, index: number) => {
          const rowNum = index + 2;

          const matriculaRaw = getRowValue(
            row,
            'matricula', 'matricula_numero', 'mat', 'id', 'colaborador', 'funcionario', 'codigo', 'codigoexterno'
          );
          const dataRaw = getRowValue(
            row,
            'data', 'dataregistro', 'data_registro', 'dia', 'date'
          );
          const horasRaw = getRowValue(
            row,
            'horas', 'horasbrutas', 'horas_brutas', 'quantidade', 'saldo'
          ) || '0';
          const tipoRaw = getRowValue(
            row,
            'tipo', 'tipoocorrencia', 'tipo_ocorrencia', 'ocorrencia', 'codigo_ocorrencia'
          ) || 'TRABALHO';
          const obsRaw = getRowValue(
            row,
            'observacao', 'observação', 'obs', 'motivo', 'justificativa'
          );
          const forcarFeriadoRaw = getRowValue(
            row,
            'feriado', 'eferiado', 'e_feriado', 'eferiado_manual'
          ) || 'NAO';

          if (!matriculaRaw || !dataRaw) {
            if (!matriculaRaw && !dataRaw) return;
            errors.push(`Linha ${rowNum}: 'Matrícula' e 'Data' são obrigatórios.`);
            return;
          }

          const matricula = matriculaRaw;
          const emp = empMap.get(matricula.toUpperCase());

          const dataRegistro = parseDateCell(dataRaw, new Date().toISOString().substring(0, 10));

          // Normalizar tipo de ocorrência
          let tipo: OccurrenceType = 'TRABALHO';
          const tUpper = tipoRaw.toUpperCase();
          if (tUpper.includes('FALT') || tUpper === 'F' || tUpper === 'D') tipo = 'FALTA_INJUSTIFICADA';
          else if (tUpper.includes('ATEST') || tUpper.includes('MED') || tUpper === 'AT') tipo = 'ATESTADO_MEDICO';
          else if (tUpper.includes('FOLG') || tUpper.includes('COMPENS') || tUpper === 'FOLGA') tipo = 'COMPENSACAO';
          else if (tUpper.includes('FERIA') || tUpper === 'FER') tipo = 'FERIAS';
          else if (tUpper.includes('LICEN') || tUpper === 'LIC') tipo = 'LICENCA';

          const horasBrutas = parseFloat(horasRaw.replace(',', '.')) || (tipo === 'FALTA_INJUSTIFICADA' ? 8 : 0);
          const forcarFeriado = ['SIM', 'TRUE', '1', 'S', 'YES'].includes(forcarFeriadoRaw.toUpperCase());

          const sptfCalc = calculateSPTFBalance(
            tipo,
            horasBrutas,
            dataRegistro,
            forcarFeriado,
            emp?.sede
          );

          const record: TimeRecord = {
            id: `rec-imp-${Date.now()}-${index}`,
            matricula,
            employeeName: emp?.nome || getRowValue(row, 'nome', 'nomecompleto', 'nome_completo') || 'Colaborador',
            employeeSede: emp?.sede || 'KO',
            employeeFuncao: emp?.funcao || emp?.cargo || 'Geral',
            dataRegistro,
            diaSemana: sptfCalc.diaSemana,
            diaSemanaNome: sptfCalc.diaSemanaNome,
            horasBrutas,
            tipoOcorrencia: tipo,
            codigoOcorrencia: tipo === 'FALTA_INJUSTIFICADA' 
              ? 'F' 
              : tipo === 'ATESTADO_MEDICO' 
                ? 'AT' 
                : tipo === 'COMPENSACAO' 
                  ? 'COMP' 
                  : tipo === 'FERIAS' 
                    ? 'FE' 
                    : tipo === 'LICENCA' 
                      ? 'LIC' 
                      : 'TRAB',
            eFeriado: sptfCalc.eFeriado,
            nomeFeriado: sptfCalc.nomeFeriado,
            multiplicador: sptfCalc.multiplicador,
            saldoCalculado: sptfCalc.saldoCalculado,
            observacao: obsRaw || undefined,
            criadoEm: new Date().toISOString()
          };

          validRecords.push(record);
        });

        resolve({
          success: errors.length === 0 || validRecords.length > 0,
          data: validRecords,
          errors,
          totalRows: results.data.length,
          importedCount: validRecords.length,
          duplicateCount: 0,
          skippedCount: 0
        });
      },
      error: (err) => {
        resolve({
          success: false,
          data: [],
          errors: [err.message],
          totalRows: 0,
          importedCount: 0,
          duplicateCount: 0,
          skippedCount: 0
        });
      }
    });
  });
}

/**
 * Gera um arquivo CSV modelo para cadastro de colaboradores no padrão oficial:
 * Matricula;Nome;CPF;DataNascimento;Funcao;Sede;Status;SenhaInicial
 */
export function generateEmployeesTemplateCSV(): string {
  const sampleData = [
    {
      Matricula: 'MAT-2001',
      Nome: 'Ana Carolina Peixoto',
      CPF: '123.456.789-01',
      DataNascimento: '1992-05-14',
      Funcao: 'Supervisora de Operações',
      Sede: 'KO',
      Status: 'Ativo',
      SenhaInicial: 'comara2025'
    },
    {
      Matricula: 'MAT-2002',
      Nome: 'Bruno Cesar Barreto',
      CPF: '234.567.890-12',
      DataNascimento: '1988-11-20',
      Funcao: 'Técnico de Manutenção',
      Sede: 'BE',
      Status: 'Ativo',
      SenhaInicial: ''
    },
    {
      Matricula: 'MAT-2003',
      Nome: 'Carla Vasconcelos Lima',
      CPF: '345.678.901-23',
      DataNascimento: '1995-03-08',
      Funcao: 'Engenheira de Segurança',
      Sede: 'MN',
      Status: 'Ativo',
      SenhaInicial: 'senha123'
    }
  ];

  return Papa.unparse(sampleData, { quotes: true, delimiter: ';' });
}

/**
 * Gera um arquivo CSV modelo para importação de lançamentos do Banco de Horas.
 */
export function generateTimeRecordsTemplateCSV(): string {
  const sampleData = [
    {
      Matricula: 'MAT-2001',
      Data: '2025-02-03',
      Horas: '2.5',
      Tipo: 'TRABALHO',
      Observacao: 'Horas extras na operação noturna',
      Feriado: 'NAO'
    },
    {
      Matricula: 'MAT-2001',
      Data: '2025-02-08',
      Horas: '4.0',
      Tipo: 'TRABALHO',
      Observacao: 'Trabalho no sábado (1.5x)',
      Feriado: 'NAO'
    },
    {
      Matricula: 'MAT-2002',
      Data: '2025-02-04',
      Horas: '8.0',
      Tipo: 'FALTA_INJUSTIFICADA',
      Observacao: 'Falta sem justificativa legal',
      Feriado: 'NAO'
    },
    {
      Matricula: 'MAT-2003',
      Data: '2025-02-05',
      Horas: '8.0',
      Tipo: 'ATESTADO_MEDICO',
      Observacao: 'Atestado médico de 1 dia (CID Z00.0)',
      Feriado: 'NAO'
    }
  ];

  return Papa.unparse(sampleData, { quotes: true, delimiter: ';' });
}

/**
 * Exporta colaboradores filtrados com seus respectivos saldos e status em formato CSV/Excel.
 */
export function exportFilteredBalancesCSV(
  employeesWithBalances: Array<Employee & { saldoTotalHoras: number; saldoTotalDias: number; totalAtestados: number; totalFaltas: number }>,
  titleScenario: string
): string {
  const rows = employeesWithBalances.map(emp => {
    let statusBanco = 'ZERADO';
    if (emp.saldoTotalHoras > 0.05) statusBanco = 'CREDOR';
    else if (emp.saldoTotalHoras < -0.05) statusBanco = 'DEVEDOR';

    return {
      'Cenario_Relatorio': titleScenario,
      'Matricula': emp.matricula,
      'Nome_Colaborador': emp.nome,
      'Cargo_Funcao': emp.funcao,
      'Sede_Origem': emp.sede,
      'Sede_Atual_Alocada': emp.sede_atual || emp.sede,
      'Status_Cadastral': emp.status,
      'Periodo_Status': emp.dataInicioStatus ? `${emp.dataInicioStatus} ate ${emp.dataFimStatus}` : 'N/A',
      'Saldo_Inicial_Horas': (emp.saldoInicialHoras || 0).toFixed(2),
      'Saldo_Total_Acumulado_Horas': emp.saldoTotalHoras.toFixed(2),
      'Saldo_Total_Acumulado_Dias': emp.saldoTotalDias.toFixed(2),
      'Status_Banco': statusBanco,
      'Total_Atestados_Medicos': emp.totalAtestados,
      'Total_Faltas_Injustificadas': emp.totalFaltas,
      'Data_Extracao': new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
  });

  return Papa.unparse(rows, { quotes: true, delimiter: ';' });
}

/**
 * Exporta lançamentos e dados consolidados em CSV pronto para Google Sheets e Looker Studio.
 */
export function exportTimeRecordsToLookerCSV(records: TimeRecord[], employees: Employee[]): string {
  const empMap = new Map(employees.map(e => [e.matricula, e]));

  const rows = records.map(r => {
    const emp = empMap.get(r.matricula);
    return {
      'ID_Registro': r.id,
      'Matricula': r.matricula,
      'Nome_Colaborador': r.employeeName || emp?.nome || 'N/D',
      'Sede': r.employeeSede || emp?.sede || 'KO',
      'Funcao_Cargo': r.employeeFuncao || emp?.funcao || 'N/D',
      'Data_Registro': r.dataRegistro,
      'Dia_Semana': r.diaSemanaNome,
      'Dia_Semana_Num': r.diaSemana,
      'E_Feriado': r.eFeriado ? 'SIM' : 'NAO',
      'Nome_Feriado': r.nomeFeriado || '',
      'Tipo_Ocorrencia': r.tipoOcorrencia,
      'Codigo_Ocorrencia': r.codigoOcorrencia || '',
      'Horas_Brutas': r.horasBrutas.toFixed(2),
      'Multiplicador_SPTF': r.multiplicador.toFixed(1),
      'Saldo_Calculado_Horas': r.saldoCalculado.toFixed(2),
      'Saldo_Calculado_Dias': (r.saldoCalculado / 8).toFixed(2),
      'Status_Lancamento': r.saldoCalculado > 0 ? 'CREDITO' : r.saldoCalculado < 0 ? 'DEBITO' : 'NEUTRO',
      'Tem_Comprovante': r.comprovante ? 'SIM' : 'NAO',
      'Link_Comprovante_Drive': r.comprovante?.driveViewUrl || '',
      'Observacao': r.observacao || '',
      'Data_Criacao': r.criadoEm,
    };
  });

  return Papa.unparse(rows, { quotes: true, delimiter: ';' });
}

/**
 * Dispara o download no navegador de um arquivo gerado.
 */
export function triggerFileDownload(content: string, fileName: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\ufeff' + content], { type: mimeType }); // \ufeff para forçar UTF-8 BOM no Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
