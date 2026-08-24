import React, { useState } from 'react';
import { 
  Database, 
  Layers, 
  FileCode2, 
  Copy, 
  Check, 
  Sparkles, 
  Server, 
  HardDrive,
  Workflow,
  Calendar,
  ShieldCheck,
  TableProperties,
  ArrowRightLeft,
  UploadCloud,
  FileSpreadsheet,
  FolderTree,
  FileCheck2,
  ExternalLink,
  Code2,
  AlertTriangle,
  BookOpen,
  Mail,
  ShieldAlert,
  Users,
  Clock,
  FileText,
  CheckCircle2,
  BarChart3,
  Rocket,
  Award
} from 'lucide-react';

interface GoogleArchitectureSpecProps {
  theme?: 'dark' | 'light';
}

export const GoogleArchitectureSpec: React.FC<GoogleArchitectureSpecProps> = ({
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'etapa5_golive' | 'etapa4_manual' | 'etapa4_auditoria' | 'etapa2_csv_drive' | 'code_gs' | 'html_modal' | 'etapa1_banco' | 'looker_sql'>('etapa5_golive');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const completeAppsScriptCode = `/**
 * ============================================================================
 * PROJETO: SISTEMA DE GESTÃO DE BANCO DE HORAS SPTF & GOOGLE WORKSPACE
 * ARQUITETURA: Google Apps Script + Google Sheets + Google Drive + Looker Studio
 * AUTOR: Engenharia de Dados & RH Corporativo
 * VERSÃO: 4.0.0 (Etapa 1 + Etapa 2 + Etapa 4: Auditoria Automatizada & RH)
 * ============================================================================
 */

const CONFIG = {
  DRIVE_ROOT_FOLDER_NAME: 'Banco_de_Horas',
  DRIVE_COMPROVANTES_SUBFOLDER: 'Comprovantes',
  DRIVE_FOTOS_SUBFOLDER: 'Fotos_Colaboradores',
  SHEET_COLABORADORES: 'tb_colaboradores',
  SHEET_LANCAMENTOS: 'tb_lancamentos_diarios',
  SHEET_RESUMO_MENSAL: 'tb_resumo_mensal',
  SHEET_PARAMETROS: 'parametros_sistema',
  EMAIL_NOTIFICACAO_RH: 'rh.coari@empresa.com.br,coari.comara@gmail.com',
  LIMITE_HORAS_POSITIVAS_ALERTA: 40.0, // Risco de passivo trabalhista
  LIMITE_HORAS_NEGATIVAS_ALERTA: -20.0, // Déficit severo
  SEDES: ['KO', 'BE', 'MN'],
  FUNCOES: [
    'Técnico de Manutenção',
    'Engenheiro de Operações',
    'Operador de Produção',
    'Assistente Administrativo',
    'Supervisor de Campo',
    'Analista de Logística',
    'Motorista Operacional'
  ],
  TIPOS_OCORRENCIA: [
    'TRABALHO',
    'FALTA_INJUSTIFICADA',
    'ATESTADO_MEDICO',
    'COMPENSACAO',
    'FERIAS',
    'LICENCA'
  ],
  STATUS_COLABORADOR: ['Ativo', 'Inativo', 'Férias', 'Afastado']
};

/**
 * MENU PERSONALIZADO NO GOOGLE SHEETS
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Banco de Horas SPTF')
    .addItem('📥 Importar Colaboradores (CSV)', 'abrirModalImportacaoCSV')
    .addItem('🔍 Executar Auditoria de Inconsistências', 'gerarRelatorioAuditoria')
    .addSeparator()
    .addItem('📅 Consolidar Fechamento do Mês', 'executarFechamentoMensalManual')
    .addItem('🚀 Provisionar/Resetar Estrutura das Tabelas', 'setupBancoDeHorasSPTF')
    .addToUi();
}

/**
 * ============================================================================
 * ETAPA 4.1: ROTINA DE AUDITORIA E MENSAGENS DE ALERTA PARA O RH
 * ============================================================================
 * Dispara varredura integral para detectar:
 * 1. Atestados sem anexo Drive.
 * 2. Passivo Trabalhista (Saldo > +40h).
 * 3. Déficit Crítico (Saldo < -20h).
 * 4. Lançamentos duplicados no mesmo dia.
 */
function gerarRelatorioAuditoria() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const colabSheet = ss.getSheetByName(CONFIG.SHEET_COLABORADORES);
    const lancSheet = ss.getSheetByName(CONFIG.SHEET_LANCAMENTOS);

    if (!colabSheet || !lancSheet) {
      throw new Error('Tabelas tb_colaboradores ou tb_lancamentos_diarios não encontradas.');
    }

    const colaboradoresData = colabSheet.getDataRange().getValues();
    const lancamentosData = lancSheet.getDataRange().getValues();

    // 1. Dicionário de colaboradores e saldos atuais
    const colabMap = new Map();
    for (let r = 1; r < colaboradoresData.length; r++) {
      const mat = String(colaboradoresData[r][1] || '').trim();
      const nome = String(colaboradoresData[r][2] || '').trim();
      const sede = String(colaboradoresData[r][4] || 'KO').trim();
      const saldoInicial = parseFloat(colaboradoresData[r][7]) || 0.0;
      if (mat) {
        colabMap.set(mat, {
          matricula: mat,
          nome: nome,
          sede: sede,
          saldoInicial: saldoInicial,
          saldoAcumulado: saldoInicial,
          totalLancamentos: 0
        });
      }
    }

    const alertasAtestadosSemLink = [];
    const alertasDuplicidades = [];
    const registrosUnicosMap = new Map(); // Key: MATRICULA + '_' + DATA

    // 2. Análise da tb_lancamentos_diarios
    for (let i = 1; i < lancamentosData.length; i++) {
      const row = lancamentosData[i];
      const idLancamento = String(row[0] || '').trim();
      const mat = String(row[1] || '').trim();
      const nome = String(row[2] || '').trim();
      const dataReg = sanitizeDate(row[3]);
      const tipoOcorrencia = String(row[7] || '').trim().toUpperCase();
      const saldoLancamento = parseFloat(row[10]) || 0.0;
      const fileUrl = String(row[13] || '').trim();

      if (!mat || !dataReg) continue;

      // Soma saldo acumulado
      if (colabMap.has(mat)) {
        const emp = colabMap.get(mat);
        emp.saldoAcumulado += saldoLancamento;
        emp.totalLancamentos++;
      }

      // Check 1: Atestado sem URL/Link
      if (tipoOcorrencia === 'ATESTADO_MEDICO' || tipoOcorrencia === 'AT') {
        if (!fileUrl || fileUrl.indexOf('http') === -1) {
          alertasAtestadosSemLink.push({
            linha: i + 1,
            id: idLancamento,
            matricula: mat,
            nome: nome,
            data: dataReg
          });
        }
      }

      // Check 2: Duplicidades de registro no mesmo dia
      const chaveUnica = mat + '_' + dataReg;
      if (registrosUnicosMap.has(chaveUnica)) {
        alertasDuplicidades.push({
          linha: i + 1,
          matricula: mat,
          nome: nome,
          data: dataReg,
          primeiroId: registrosUnicosMap.get(chaveUnica)
        });
      } else {
        registrosUnicosMap.set(chaveUnica, idLancamento);
      }
    }

    // 3. Check de Limites de Saldo (Passivo Trabalhista & Déficit)
    const alertasPassivoAlto = [];
    const alertasDeficitAlto = [];

    colabMap.forEach((emp) => {
      if (emp.saldoAcumulado > CONFIG.LIMITE_HORAS_POSITIVAS_ALERTA) {
        alertasPassivoAlto.push({
          matricula: emp.matricula,
          nome: emp.nome,
          sede: emp.sede,
          saldo: emp.saldoAcumulado.toFixed(1)
        });
      } else if (emp.saldoAcumulado < CONFIG.LIMITE_HORAS_NEGATIVAS_ALERTA) {
        alertasDeficitAlto.push({
          matricula: emp.matricula,
          nome: emp.nome,
          sede: emp.sede,
          saldo: emp.saldoAcumulado.toFixed(1)
        });
      }
    });

    // 4. Montar Relatório em HTML para E-mail e Exibição UI
    const totalInconsistencias = alertasAtestadosSemLink.length + 
                                alertasDuplicidades.length + 
                                alertasPassivoAlto.length + 
                                alertasDeficitAlto.length;

    const relatorioHtml = montarCorpoEmailAuditoria({
      dataAuditoria: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
      totalInconsistencias: totalInconsistencias,
      alertasAtestados: alertasAtestadosSemLink,
      alertasDuplicidades: alertasDuplicidades,
      alertasPassivo: alertasPassivoAlto,
      alertasDeficit: alertasDeficitAlto
    });

    // 5. Envio de E-mail Automático para o RH se houver destinatário
    if (CONFIG.EMAIL_NOTIFICACAO_RH && totalInconsistencias > 0) {
      MailApp.sendEmail({
        to: CONFIG.EMAIL_NOTIFICACAO_RH,
        subject: '⚠️ [ALERTA RH] Relatório de Auditoria do Banco de Horas SPTF (' + totalInconsistencias + ' inconsistências)',
        htmlBody: relatorioHtml
      });
    }

    // Exibir no Google Sheets
    const ui = SpreadsheetApp.getUi();
    const mensagemResumo = 'Auditoria Concluída!\\n\\n' +
      '• Atestados sem Anexo: ' + alertasAtestadosSemLink.length + '\\n' +
      '• Lançamentos Duplicados: ' + alertasDuplicidades.length + '\\n' +
      '• Passivo Alto (>+' + CONFIG.LIMITE_HORAS_POSITIVAS_ALERTA + 'h): ' + alertasPassivoAlto.length + '\\n' +
      '• Déficit Crítico (<' + CONFIG.LIMITE_HORAS_NEGATIVAS_ALERTA + 'h): ' + alertasDeficitAlto.length + '\\n\\n' +
      (totalInconsistencias > 0 
        ? 'Um e-mail detalhado foi enviado para: ' + CONFIG.EMAIL_NOTIFICACAO_RH 
        : 'Parabéns! Nenhuma inconsistência encontrada no banco de dados.');

    ui.alert('🔍 Relatório de Auditoria e Riscos SPTF', mensagemResumo, ui.ButtonSet.OK);

    return {
      success: true,
      totalInconsistencias: totalInconsistencias,
      alertasAtestados: alertasAtestadosSemLink,
      alertasDuplicidades: alertasDuplicidades,
      alertasPassivo: alertasPassivoAlto,
      alertasDeficit: alertasDeficitAlto
    };

  } catch (error) {
    Logger.log('Erro na rotina de auditoria: ' + error.message);
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert('Erro na Auditoria', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return { success: false, message: error.message };
  }
}

/**
 * Gera o template HTML profissional de e-mail para o RH
 */
function montarCorpoEmailAuditoria(dados) {
  let html = '<div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">';
  html += '<div style="max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">';
  html += '<div style="background-color: #0A0B0D; padding: 20px; text-align: center; border-bottom: 3px solid #3B82F6;">';
  html += '<h2 style="color: #ffffff; margin: 0; font-size: 18px;">Relatório de Auditoria • Banco de Horas SPTF</h2>';
  html += '<p style="color: #9CA3AF; margin: 5px 0 0 0; font-size: 12px;">Data da Varredura: ' + dados.dataAuditoria + '</p>';
  html += '</div>';

  html += '<div style="padding: 24px;">';
  
  if (dados.totalInconsistencias === 0) {
    html += '<p style="color: #10B981; font-weight: bold; font-size: 14px;">✅ Base 100% íntegra. Nenhuma irregularidade identificada.</p>';
  } else {
    html += '<p style="color: #EF4444; font-weight: bold; font-size: 14px; margin-top: 0;">⚠️ Foram detectadas ' + dados.totalInconsistencias + ' ocorrências que exigem atenção do RH:</p>';

    // Seção 1: Atestados sem anexo
    if (dados.alertasAtestados.length > 0) {
      html += '<div style="margin-top: 16px; border-left: 4px solid #F59E0B; padding-left: 12px;">';
      html += '<h4 style="margin: 0 0 8px 0; color: #B45309; font-size: 13px;">1. Atestados Médicos sem Comprovante no Drive (' + dados.alertasAtestados.length + ')</h4>';
      html += '<ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #374151;">';
      dados.alertasAtestados.forEach(function(item) {
        html += '<li><strong>' + item.matricula + '</strong> - ' + item.nome + ' | Data: ' + item.data + ' (Linha: ' + item.linha + ')</li>';
      });
      html += '</ul></div>';
    }

    // Seção 2: Passivo Alto
    if (dados.alertasPassivo.length > 0) {
      html += '<div style="margin-top: 16px; border-left: 4px solid #EF4444; padding-left: 12px;">';
      html += '<h4 style="margin: 0 0 8px 0; color: #B91C1C; font-size: 13px;">2. Risco de Passivo Trabalhista - Saldo > +40h (' + dados.alertasPassivo.length + ')</h4>';
      html += '<ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #374151;">';
      dados.alertasPassivo.forEach(function(item) {
        html += '<li><strong>' + item.matricula + '</strong> - ' + item.nome + ' (' + item.sede + '): <span style="color: #10B981; font-weight: bold;">+' + item.saldo + 'h</span></li>';
      });
      html += '</ul></div>';
    }

    // Seção 3: Déficit Alto
    if (dados.alertasDeficit.length > 0) {
      html += '<div style="margin-top: 16px; border-left: 4px solid #8B5CF6; padding-left: 12px;">';
      html += '<h4 style="margin: 0 0 8px 0; color: #6D28D9; font-size: 13px;">3. Saldo Negativo Severo < -20h (' + dados.alertasDeficit.length + ')</h4>';
      html += '<ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #374151;">';
      dados.alertasDeficit.forEach(function(item) {
        html += '<li><strong>' + item.matricula + '</strong> - ' + item.nome + ' (' + item.sede + '): <span style="color: #EF4444; font-weight: bold;">' + item.saldo + 'h</span></li>';
      });
      html += '</ul></div>';
    }

    // Seção 4: Duplicidades
    if (dados.alertasDuplicidades.length > 0) {
      html += '<div style="margin-top: 16px; border-left: 4px solid #6B7280; padding-left: 12px;">';
      html += '<h4 style="margin: 0 0 8px 0; color: #374151; font-size: 13px;">4. Lançamentos Duplicados no Mesmo Dia (' + dados.alertasDuplicidades.length + ')</h4>';
      html += '<ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #374151;">';
      dados.alertasDuplicidades.forEach(function(item) {
        html += '<li><strong>' + item.matricula + '</strong> - ' + item.nome + ' | Data: ' + item.data + ' (Linha ' + item.linha + ')</li>';
      });
      html += '</ul></div>';
    }
  }

  html += '<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 11px; color: #9CA3AF;">';
  html += 'Sistema Corporativo de Gestão de Banco de Horas SPTF • Bases KO, BE, MN';
  html += '</div>';

  html += '</div></div></div>';
  return html;
}

/**
 * ============================================================================
 * ETAPA 2.1: MÓDULO DE IMPORTAÇÃO CSV COM UPSERT EM tb_colaboradores
 * ============================================================================
 */

/**
 * Abre o modal HTML moderno para seleção do arquivo CSV.
 */
function abrirModalImportacaoCSV() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile('ImportModal')
    .setWidth(520)
    .setHeight(460)
    .setTitle('📥 Importador de Colaboradores (CSV)');
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Importação de Colaboradores SPTF');
}

/**
 * Processa a string CSV enviada pelo modal e realiza o UPSERT na tb_colaboradores.
 * @param {string} csvContent Conteúdo texto puro do arquivo CSV
 * @returns {object} Relatório de processamento com total, inseridos, atualizados e erros
 */
function processarImportacaoCSV(csvContent) {
  try {
    if (!csvContent || typeof csvContent !== 'string') {
      throw new Error('O conteúdo do arquivo CSV está vazio ou inválido.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let colabSheet = ss.getSheetByName(CONFIG.SHEET_COLABORADORES);
    if (!colabSheet) {
      setupBancoDeHorasSPTF();
      colabSheet = ss.getSheetByName(CONFIG.SHEET_COLABORADORES);
    }

    // 1. Parser do CSV com suporte a delimitadores ',' ou ';' e quebras de linha
    const rows = parseCSVString(csvContent);
    if (rows.length < 2) {
      throw new Error('O CSV deve conter ao menos a linha de cabeçalho e 1 linha de dados.');
    }

    const rawHeaders = rows[0].map(h => normalizeHeader(h));
    
    // Mapeamento dinâmico de colunas
    const colMap = {
      matricula: findHeaderIndex(rawHeaders, ['matricula', 'mat', 'id_matricula']),
      nome: findHeaderIndex(rawHeaders, ['nome', 'nome_completo', 'colaborador', 'funcionario']),
      funcao: findHeaderIndex(rawHeaders, ['funcao', 'cargo', 'ocupacao']),
      sede: findHeaderIndex(rawHeaders, ['sede', 'unidade', 'filial', 'base']),
      data_admissao: findHeaderIndex(rawHeaders, ['data_admissao', 'admissao', 'dt_admissao']),
      status: findHeaderIndex(rawHeaders, ['status', 'situacao', 'ativo']),
      saldo_inicial: findHeaderIndex(rawHeaders, ['saldo_inicial', 'saldo_inicial_horas', 'saldo']),
      email: findHeaderIndex(rawHeaders, ['email', 'email_corporativo', 'e_mail']),
      telefone: findHeaderIndex(rawHeaders, ['telefone', 'contato', 'tel', 'whatsapp'])
    };

    if (colMap.matricula === -1 || colMap.nome === -1) {
      throw new Error('Cabeçalhos obrigatórios não encontrados. É necessário ao menos "Matricula" e "Nome".');
    }

    // 2. Carregar colaboradores existentes para verificar duplicidade (UPSERT)
    const existingData = colabSheet.getDataRange().getValues();
    const existingMap = new Map(); // Key: matricula normalizada -> Row Index (1-based no Sheets)

    for (let r = 1; r < existingData.length; r++) {
      const mat = String(existingData[r][1]).trim().toUpperCase();
      if (mat) {
        existingMap.set(mat, r + 1); // r + 1 = Linha física na planilha
      }
    }

    let inseridos = 0;
    let atualizados = 0;
    const erros = [];
    const timestampAtual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    // 3. Iterar pelas linhas do CSV
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

      const matriculaRaw = colMap.matricula !== -1 ? String(row[colMap.matricula] || '').trim() : '';
      const nome = colMap.nome !== -1 ? String(row[colMap.nome] || '').trim() : '';
      
      if (!matriculaRaw || !nome) {
        erros.push('Linha ' + (i + 1) + ': Matrícula ou Nome em branco.');
        continue;
      }

      const matriculaKey = matriculaRaw.toUpperCase();
      const funcao = colMap.funcao !== -1 ? String(row[colMap.funcao] || 'Técnico de Manutenção').trim() : 'Técnico de Manutenção';
      
      let sede = colMap.sede !== -1 ? String(row[colMap.sede] || 'KO').trim().toUpperCase() : 'KO';
      if (!CONFIG.SEDES.includes(sede)) sede = 'KO';

      const dataAdmissao = colMap.data_admissao !== -1 ? sanitizeDate(row[colMap.data_admissao]) : '2026-01-01';
      
      let status = colMap.status !== -1 ? String(row[colMap.status] || 'Ativo').trim() : 'Ativo';
      if (!CONFIG.STATUS_COLABORADOR.includes(status)) status = 'Ativo';

      const saldoInicial = colMap.saldo_inicial !== -1 ? parseFloat(String(row[colMap.saldo_inicial]).replace(',', '.')) || 0.0 : 0.0;
      const email = colMap.email !== -1 ? String(row[colMap.email] || '').trim() : '';
      const telefone = colMap.telefone !== -1 ? String(row[colMap.telefone] || '').trim() : '';

      if (existingMap.has(matriculaKey)) {
        // --- CASO 1: MATRÍCULA JÁ EXISTE -> UPDATE ---
        const physicalRow = existingMap.get(matriculaKey);
        const idExistente = colabSheet.getRange(physicalRow, 1).getValue() || ('COL_' + matriculaRaw);
        const criadoEmExistente = colabSheet.getRange(physicalRow, 11).getValue() || timestampAtual;

        const rowAtualizada = [
          idExistente,
          matriculaRaw,
          nome,
          funcao,
          sede,
          dataAdmissao,
          status,
          saldoInicial,
          email,
          telefone,
          criadoEmExistente
        ];

        colabSheet.getRange(physicalRow, 1, 1, rowAtualizada.length).setValues([rowAtualizada]);
        atualizados++;
      } else {
        // --- CASO 2: MATRÍCULA NÃO EXISTE -> INSERT ---
        const novoId = 'COL_' + matriculaRaw.replace(/[^A-Za-z0-9]/g, '');
        const novaRow = [
          novoId,
          matriculaRaw,
          nome,
          funcao,
          sede,
          dataAdmissao,
          status,
          saldoInicial,
          email,
          telefone,
          timestampAtual
        ];

        colabSheet.appendRow(novaRow);
        existingMap.set(matriculaKey, colabSheet.getLastRow());
        inseridos++;
      }
    }

    return {
      success: true,
      totalProcessados: inseridos + atualizados,
      inseridos: inseridos,
      atualizados: atualizados,
      erros: erros
    };

  } catch (error) {
    Logger.log('Erro no processamento do CSV: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * ============================================================================
 * ETAPA 2.2: MÓDULO DE GESTÃO DE COMPROVANTES NO GOOGLE DRIVE
 * ============================================================================
 */

/**
 * Faz upload do atestado/comprovante na hierarquia /Banco_de_Horas/Comprovantes/[ANO]/[SEDE]
 * e renomeia para ATESTADO_[MATRICULA]_[DATA_OCORRENCIA].[ext]
 * 
 * @param {string} base64Data Dados do arquivo em base64
 * @param {string} nomeArquivoOriginal Nome original com extensão (ex: 'atestado_carlos.pdf')
 * @param {string} mimeType Tipo MIME (ex: 'application/pdf', 'image/jpeg')
 * @param {string} matricula Matrícula do funcionário (ex: 'MAT-1091')
 * @param {string} dataOcorrencia Data do evento no formato YYYY-MM-DD
 * @param {string} sede Sede operacional ('KO', 'BE', 'MN')
 * @returns {object} Dados do arquivo criado no Google Drive (ID, URL compartilhável, Nome)
 */
function uploadComprovanteDrive(base64Data, nomeArquivoOriginal, mimeType, matricula, dataOcorrencia, sede) {
  try {
    if (!base64Data || !matricula || !dataOcorrencia) {
      throw new Error('Parâmetros insuficientes para upload do comprovante.');
    }

    // 1. Validar e formatar ano e sede
    const ano = String(dataOcorrencia).substring(0, 4) || '2026';
    const sedeSanitizada = (sede && CONFIG.SEDES.includes(sede.toUpperCase())) ? sede.toUpperCase() : 'GERAL';
    const matriculaLimpa = String(matricula).replace(/[^A-Za-z0-9_-]/g, '');

    // 2. Extrair extensão do arquivo
    let extensao = 'pdf';
    if (nomeArquivoOriginal && nomeArquivoOriginal.indexOf('.') !== -1) {
      extensao = nomeArquivoOriginal.split('.').pop().toLowerCase();
    } else if (mimeType === 'image/jpeg') extensao = 'jpg';
    else if (mimeType === 'image/png') extensao = 'png';

    // 3. Gerar nome padronizado obrigatório
    const nomePadronizado = 'ATESTADO_' + matriculaLimpa + '_' + dataOcorrencia + '.' + extensao;

    // 4. Navegar ou criar a estrutura de pastas no Drive: /Banco_de_Horas/Comprovantes/[ANO]/[SEDE]
    const pastaRaiz = obterOuCriarPasta(DriveApp.getRootFolder(), CONFIG.DRIVE_ROOT_FOLDER_NAME);
    const pastaComprovantes = obterOuCriarPasta(pastaRaiz, CONFIG.DRIVE_COMPROVANTES_SUBFOLDER);
    const pastaAno = obterOuCriarPasta(pastaComprovantes, ano);
    const pastaDestino = obterOuCriarPasta(pastaAno, sedeSanitizada);

    // 5. Decodificar base64 e criar o arquivo Blob
    const bytesDecodificados = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytesDecodificados, mimeType || 'application/pdf', nomePadronizado);
    
    const arquivoCriado = pastaDestino.createFile(blob);

    // 6. Conceder permissão de visualização com link seguro
    try {
      arquivoCriado.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {
      Logger.log('Aviso de permissão no Drive: ' + permErr.message);
    }

    const fileId = arquivoCriado.getId();
    const viewUrl = arquivoCriado.getUrl();
    const downloadUrl = arquivoCriado.getDownloadUrl ? arquivoCriado.getDownloadUrl() : ('https://drive.google.com/uc?export=download&id=' + fileId);

    return {
      success: true,
      fileId: fileId,
      viewUrl: viewUrl,
      downloadUrl: downloadUrl,
      fileName: nomePadronizado,
      folderPath: '/' + CONFIG.DRIVE_ROOT_FOLDER_NAME + '/' + CONFIG.DRIVE_COMPROVANTES_SUBFOLDER + '/' + ano + '/' + sedeSanitizada
    };

  } catch (error) {
    Logger.log('Erro no upload do comprovante para o Drive: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Faz upload da foto de perfil do colaborador no Google Drive:
 * /Banco_de_Horas/Fotos_Colaboradores/FOTO_[MATRICULA].[ext]
 * e atualiza a coluna url_foto_perfil na tb_colaboradores.
 * 
 * @param {string} base64Data Imagem em base64
 * @param {string} mimeType Tipo MIME ('image/jpeg', 'image/png')
 * @param {string} matricula Matrícula do colaborador (ex: 'MAT-1010')
 * @returns {object} Resultado do upload com ID, URLs e link direto para exibição
 */
function uploadFotoPerfilDrive(base64Data, mimeType, matricula) {
  try {
    if (!base64Data || !matricula) {
      throw new Error('Base64 e Matrícula são obrigatórios para salvar a foto.');
    }

    const matriculaLimpa = String(matricula).replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();
    let extensao = 'jpg';
    if (mimeType === 'image/png') extensao = 'png';

    const nomePadronizado = 'FOTO_' + matriculaLimpa + '.' + extensao;

    // 1. Obter ou criar pasta /Banco_de_Horas/Fotos_Colaboradores/
    const pastaRaiz = obterOuCriarPasta(DriveApp.getRootFolder(), CONFIG.DRIVE_ROOT_FOLDER_NAME);
    const pastaFotos = obterOuCriarPasta(pastaRaiz, CONFIG.DRIVE_FOTOS_SUBFOLDER);

    // 2. Verificar e sobrescrever arquivo existente com o mesmo nome
    const arquivosExistentes = pastaFotos.getFilesByName(nomePadronizado);
    while (arquivosExistentes.hasNext()) {
      const arqAntigo = arquivosExistentes.next();
      arqAntigo.setTrashed(true);
    }

    // 3. Criar o novo arquivo Blob
    const bytesDecodificados = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytesDecodificados, mimeType || 'image/jpeg', nomePadronizado);
    const arquivoCriado = pastaFotos.createFile(blob);

    try {
      arquivoCriado.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {
      Logger.log('Aviso de permissão na foto do Drive: ' + permErr.message);
    }

    const fileId = arquivoCriado.getId();
    const viewUrl = arquivoCriado.getUrl();
    const directImageUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;

    // 4. Atualizar automaticamente a URL na tb_colaboradores se a linha existir
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const colabSheet = ss.getSheetByName(CONFIG.SHEET_COLABORADORES);
    if (colabSheet) {
      const data = colabSheet.getDataRange().getValues();
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][1]).trim().toUpperCase() === matriculaLimpa) {
          // Coluna 12: url_foto_perfil (L), Coluna 13: id_drive_foto (M)
          colabSheet.getRange(r + 1, 12).setValue(directImageUrl);
          colabSheet.getRange(r + 1, 13).setValue(fileId);
          break;
        }
      }
    }

    return {
      success: true,
      fileId: fileId,
      viewUrl: viewUrl,
      directImageUrl: directImageUrl,
      fileName: nomePadronizado,
      folderPath: '/' + CONFIG.DRIVE_ROOT_FOLDER_NAME + '/' + CONFIG.DRIVE_FOTOS_SUBFOLDER
    };

  } catch (error) {
    Logger.log('Erro no upload da foto para o Drive: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Salva um lançamento diário na tb_lancamentos_diarios com upload opcional de atestado.
 */
function salvarLancamentoComAtestado(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let lancSheet = ss.getSheetByName(CONFIG.SHEET_LANCAMENTOS);
    if (!lancSheet) {
      setupBancoDeHorasSPTF();
      lancSheet = ss.getSheetByName(CONFIG.SHEET_LANCAMENTOS);
    }

    let fileId = '';
    let fileUrl = '';

    // Se houver arquivo anexado, envia para o Google Drive
    if (payload.arquivoBase64 && payload.arquivoNome) {
      const uploadRes = uploadComprovanteDrive(
        payload.arquivoBase64,
        payload.arquivoNome,
        payload.arquivoMime || 'application/pdf',
        payload.matricula,
        payload.dataRegistro,
        payload.sede || 'KO'
      );

      if (uploadRes.success) {
        fileId = uploadRes.fileId;
        fileUrl = uploadRes.viewUrl;
      }
    }

    // Regras de cálculo SPTF
    const dt = new Date(payload.dataRegistro + 'T00:00:00');
    const diaSemanaNum = dt.getDay();
    const diasNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemanaNome = diasNomes[diaSemanaNum];
    const eFeriado = Boolean(payload.eFeriado);

    let multiplicador = 1.0;
    let saldoHoras = 0.0;
    const horasBrutas = parseFloat(payload.horasBrutas) || 0.0;

    if (payload.tipoOcorrencia === 'TRABALHO') {
      if (eFeriado || diaSemanaNum === 0) multiplicador = 2.0;
      else if (diaSemanaNum === 6) multiplicador = 1.5;
      else multiplicador = 1.0;
      saldoHoras = horasBrutas * multiplicador;
    } else if (payload.tipoOcorrencia === 'FALTA_INJUSTIFICADA') {
      multiplicador = 0.0;
      saldoHoras = -8.0; // Débito padrão da jornada integral
    } else if (payload.tipoOcorrencia === 'COMPENSACAO') {
      multiplicador = 1.0;
      saldoHoras = -1.0 * horasBrutas;
    } else {
      // Atestado Médico, Férias, Licença abonam o dia (saldo 0)
      multiplicador = 0.0;
      saldoHoras = 0.0;
    }

    const saldoDias = saldoHoras / 8.0;
    const idLancamento = 'LAN_' + payload.dataRegistro.replace(/-/g, '') + '_' + Math.floor(1000 + Math.random() * 9000);
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const usuario = Session.getActiveUser().getEmail() || 'Sistema';

    const novaLinha = [
      idLancamento,
      payload.matricula,
      payload.nomeColaborador || '',
      payload.dataRegistro,
      diaSemanaNum,
      diaSemanaNome,
      eFeriado,
      payload.tipoOcorrencia,
      horasBrutas,
      multiplicador,
      saldoHoras,
      saldoDias,
      fileId,
      fileUrl,
      payload.observacao || '',
      usuario,
      timestamp
    ];

    lancSheet.appendRow(novaLinha);

    return {
      success: true,
      idLancamento: idLancamento,
      saldoCalculadoHoras: saldoHoras,
      fileUrl: fileUrl
    };

  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * ============================================================================
 * UTILITÁRIOS E HELPERS DE PARSER E DRIVE
 * ============================================================================
 */

function obterOuCriarPasta(parentFolder, folderName) {
  const pastas = parentFolder.getFoldersByName(folderName);
  if (pastas.hasNext()) {
    return pastas.next();
  }
  return parentFolder.createFolder(folderName);
}

function parseCSVString(text) {
  const lines = text.split(/\r?\n/);
  const result = [];

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l].trim();
    if (!line) continue;
    
    // Detecção automática de delimitador (ponto e vírgula ou vírgula)
    const delimiter = (line.indexOf(';') !== -1 && (line.match(/;/g) || []).length >= (line.match(/,/g) || []).length) ? ';' : ',';
    
    const parsedRow = [];
    let insideQuotes = false;
    let currentToken = '';

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        parsedRow.push(currentToken.trim().replace(/^["']|["']$/g, ''));
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    parsedRow.push(currentToken.trim().replace(/^["']|["']$/g, ''));
    result.push(parsedRow);
  }
  return result;
}

function normalizeHeader(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function findHeaderIndex(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (aliases.includes(h)) return i;
  }
  return -1;
}

function sanitizeDate(dateStr) {
  if (!dateStr) return '2026-01-01';
  dateStr = String(dateStr).trim();
  // Formato DD/MM/YYYY -> YYYY-MM-DD
  if (dateStr.indexOf('/') !== -1) {
    const p = dateStr.split('/');
    if (p.length === 3) {
      const dia = p[0].padStart(2, '0');
      const mes = p[1].padStart(2, '0');
      const ano = p[2].length === 2 ? '20' + p[2] : p[2];
      return ano + '-' + mes + '-' + dia;
    }
  }
  return dateStr.substring(0, 10);
}
`;

  const htmlModalCode = `<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background-color: #0D0F14;
        color: #E0E2E5;
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        padding: 20px;
      }
      .card {
        background: #15171C;
        border: 1px solid #1F2229;
        border-radius: 12px;
        padding: 16px;
      }
      h2 {
        font-size: 14px;
        font-weight: 700;
        color: #FFFFFF;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      p.subtitle {
        color: #8E9299;
        font-size: 11px;
        margin-bottom: 16px;
        line-height: 1.4;
      }
      .dropzone {
        border: 2px dashed #2A2E38;
        background: #0D0F14;
        border-radius: 8px;
        padding: 24px 16px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .dropzone:hover, .dropzone.dragover {
        border-color: #3B82F6;
        background: rgba(59, 130, 246, 0.05);
      }
      .dropzone p {
        color: #8E9299;
        font-size: 11px;
        margin-top: 8px;
      }
      .dropzone strong {
        color: #60A5FA;
      }
      input[type="file"] {
        display: none;
      }
      .btn {
        width: 100%;
        background: #3B82F6;
        color: #FFFFFF;
        border: none;
        padding: 10px 16px;
        border-radius: 6px;
        font-family: inherit;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        margin-top: 14px;
        transition: background 0.2s;
      }
      .btn:hover { background: #2563EB; }
      .btn:disabled { background: #2A2E38; color: #6B7280; cursor: not-allowed; }
      .status-box {
        margin-top: 14px;
        padding: 10px 12px;
        border-radius: 6px;
        font-size: 11px;
        display: none;
        line-height: 1.4;
      }
      .status-box.success {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #34D399;
      }
      .status-box.error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #F87171;
      }
      .status-box.loading {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #60A5FA;
        display: block;
      }
      .file-info {
        margin-top: 10px;
        color: #E0E2E5;
        font-size: 11px;
        background: #1F2229;
        padding: 6px 10px;
        border-radius: 4px;
        display: none;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>📥 Importar Colaboradores</h2>
      <p class="subtitle">
        Envie o arquivo <strong>.CSV</strong> contendo as colunas: Matricula, Nome, Funcao, Sede, Data_Admissao, Status. Se a matrícula já existir, os dados serão atualizados (UPSERT).
      </p>

      <div class="dropzone" id="dropzone" onclick="document.getElementById('fileInput').click()">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" style="margin: 0 auto;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <p>Clique para selecionar ou arraste o <strong>arquivo .CSV</strong> aqui</p>
      </div>

      <input type="file" id="fileInput" accept=".csv,text/csv">
      <div id="fileInfo" class="file-info"></div>

      <button id="importBtn" class="btn" disabled onclick="executarImportacao()">
        Processar UPSERT no Google Sheets
      </button>

      <div id="statusBox" class="status-box"></div>
    </div>

    <script>
      let fileContent = '';
      const fileInput = document.getElementById('fileInput');
      const dropzone = document.getElementById('dropzone');
      const fileInfo = document.getElementById('fileInfo');
      const importBtn = document.getElementById('importBtn');
      const statusBox = document.getElementById('statusBox');

      fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
          handleFile(e.target.files[0]);
        }
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          handleFile(e.dataTransfer.files[0]);
        }
      });

      function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
          showStatus('error', 'Por favor, selecione exclusivamente um arquivo .CSV válido.');
          return;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
          fileContent = evt.target.result;
          fileInfo.textContent = '📄 ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
          fileInfo.style.display = 'block';
          importBtn.disabled = false;
          statusBox.style.display = 'none';
        };
        reader.readAsText(file);
      }

      function executarImportacao() {
        if (!fileContent) return;

        importBtn.disabled = true;
        showStatus('loading', '⏳ Processando registros e realizando UPSERT na tabela...');

        google.script.run
          .withSuccessHandler(function(res) {
            if (res && res.success) {
              let msg = '✅ Sucesso! Total: ' + res.totalProcessados + ' registros.<br>' +
                        '• Inseridos: <strong>' + res.inseridos + '</strong><br>' +
                        '• Atualizados: <strong>' + res.atualizados + '</strong>';
              if (res.erros && res.erros.length > 0) {
                msg += '<br>⚠️ Avisos: ' + res.erros.join(', ');
              }
              showStatus('success', msg);
            } else {
              showStatus('error', '❌ Erro: ' + (res.message || 'Falha desconhecida.'));
              importBtn.disabled = false;
            }
          })
          .withFailureHandler(function(err) {
            showStatus('error', '❌ Erro de execução no Apps Script: ' + err.message);
            importBtn.disabled = false;
          })
          .processarImportacaoCSV(fileContent);
      }

      function showStatus(type, html) {
        statusBox.className = 'status-box ' + type;
        statusBox.innerHTML = html;
        statusBox.style.display = 'block';
      }
    </script>
  </body>
</html>`;

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className={`p-6 rounded-2xl border shadow-md transition-colors ${
        isDark ? 'bg-[#15171C] text-white border-[#1F2229]' : 'bg-white text-slate-900 border-slate-200'
      }`}>
        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-0.5 border text-xs font-semibold rounded-full flex items-center gap-1.5 font-mono ${
            isDark ? 'bg-[#1F2229] text-blue-400 border-[#2A2E38]' : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            <Server className="w-3.5 h-3.5 text-blue-500" />
            Google Workspace Architecture • Etapa 1 & 2
          </span>
        </div>
        <h2 className="text-xl font-bold mt-2 font-sans tracking-tight">
          Engenharia de Dados, Importação CSV (UPSERT) & Google Drive Storage
        </h2>
        <p className={`text-xs max-w-3xl mt-1 font-mono ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
          Especificação formal e scripts completos para provisionar o banco no Sheets, executar UPSERT via CSV com modal moderno, e gerenciar armazenamento hierárquico de atestados médicos no Google Drive.
        </p>
      </div>

      {/* Tabs */}
      <div className={`rounded-2xl border shadow-md overflow-hidden transition-colors ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className={`flex border-b px-4 pt-2 overflow-x-auto gap-2 ${
          isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
        }`}>
          <button
            onClick={() => setActiveTab('etapa5_golive')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'etapa5_golive'
                ? isDark ? 'border-emerald-500 text-emerald-400 bg-[#15171C] rounded-t-lg' : 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-xs'
                : isDark ? 'border-transparent text-[#8E9299] hover:text-[#E0E2E5]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Rocket className="w-4 h-4 text-emerald-500" />
            Etapa 5: Go-Live & Looker Studio
          </button>
          <button
            onClick={() => setActiveTab('etapa4_manual')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'etapa4_manual'
                ? isDark ? 'border-blue-500 text-blue-400 bg-[#15171C] rounded-t-lg' : 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : isDark ? 'border-transparent text-[#8E9299] hover:text-[#E0E2E5]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-cyan-500" />
            Etapa 4: Manual do Usuário (RH/Gestores)
          </button>
          <button
            onClick={() => setActiveTab('etapa4_auditoria')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'etapa4_auditoria'
                ? isDark ? 'border-blue-500 text-blue-400 bg-[#15171C] rounded-t-lg' : 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : isDark ? 'border-transparent text-[#8E9299] hover:text-[#E0E2E5]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-red-500" />
            Etapa 4: Auditoria & Alertas RH
          </button>
          <button
            onClick={() => setActiveTab('etapa2_csv_drive')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'etapa2_csv_drive'
                ? isDark ? 'border-blue-500 text-blue-400 bg-[#15171C] rounded-t-lg' : 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : isDark ? 'border-transparent text-[#8E9299] hover:text-[#E0E2E5]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-emerald-500" />
            Etapa 2: CSV UPSERT & Google Drive
          </button>
          <button
            onClick={() => setActiveTab('code_gs')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'code_gs'
                ? isDark ? 'border-blue-500 text-blue-400 bg-[#15171C] rounded-t-lg' : 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : isDark ? 'border-transparent text-[#8E9299] hover:text-[#E0E2E5]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-4 h-4 text-amber-500" />
            Code.gs (Apps Script Completo)
          </button>
          <button
            onClick={() => setActiveTab('html_modal')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'html_modal'
                ? isDark ? 'border-blue-500 text-blue-400 bg-[#15171C] rounded-t-lg' : 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : isDark ? 'border-transparent text-[#8E9299] hover:text-[#E0E2E5]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-4 h-4 text-purple-500" />
            ImportModal.html (Interface)
          </button>
          <button
            onClick={() => setActiveTab('etapa1_banco')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'etapa1_banco'
                ? isDark ? 'border-blue-500 text-blue-400 bg-[#15171C] rounded-t-lg' : 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : isDark ? 'border-transparent text-[#8E9299] hover:text-[#E0E2E5]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <TableProperties className="w-4 h-4 text-blue-500" />
            Etapa 1: Dicionário & Transição Mensal
          </button>
          <button
            onClick={() => setActiveTab('looker_sql')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'looker_sql'
                ? isDark ? 'border-blue-500 text-blue-400 bg-[#15171C] rounded-t-lg' : 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : isDark ? 'border-transparent text-[#8E9299] hover:text-[#E0E2E5]' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Looker Studio & BigQuery
          </button>
        </div>

        {/* ETAPA 5: GO-LIVE & LOOKER STUDIO */}
        {activeTab === 'etapa5_golive' && (
          <div className="p-6 space-y-6">
            {/* Resumo Executivo */}
            <div className="bg-gradient-to-r from-blue-950/40 via-[#1C1F26] to-[#1C1F26] p-6 rounded-xl border border-blue-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base font-sans">
                    Resumo Executivo do Projeto • Diretoria & Gestão
                  </h3>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PRONTO PARA PRODUÇÃO
                </span>
              </div>
              <p className="text-xs text-[#E0E2E5] leading-relaxed">
                O <strong>Sistema Corporativo de Gestão de Banco de Horas SPTF</strong> centraliza e automatiza com rigor legal a apuração da jornada de trabalho para as bases operacionais de <strong>Coari (KO), Belém (BE) e Manaus (MN)</strong>. Desenvolvido nativamente sobre o ecossistema <strong>Google Workspace (Sheets + Drive + Apps Script)</strong> e conectado ao <strong>Looker Studio</strong>, o sistema elimina 100% dos custos recorrentes de licenças de software de terceiros, oferecendo segurança, alta disponibilidade e governança completa de dados.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Passivo Zero</span>
                  <div className="text-sm font-bold text-white mt-0.5">Controle SPTF Rígido</div>
                  <p className="text-[11px] text-[#8E9299] mt-1">Multiplicadores automáticos (1.0x Seg-Sex, 1.5x Sáb, 2.0x Dom/Feriado) e limite de +40h.</p>
                </div>
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Drive Seguro</span>
                  <div className="text-sm font-bold text-white mt-0.5">Pastas Hierárquicas</div>
                  <p className="text-[11px] text-[#8E9299] mt-1">Organização automática por Ano e Sede com nomenclatura padronizada e link auditável.</p>
                </div>
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Auditoria Ativa</span>
                  <div className="text-sm font-bold text-white mt-0.5">Alertas no E-mail</div>
                  <p className="text-[11px] text-[#8E9299] mt-1">Notificação imediata ao RH de atestados sem anexo, duplicidades e estouros de saldo.</p>
                </div>
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">BI Executivo</span>
                  <div className="text-sm font-bold text-white mt-0.5">Looker Studio 24/7</div>
                  <p className="text-[11px] text-[#8E9299] mt-1">Dashboards em tempo real com extrato individual e distribuição por bases.</p>
                </div>
              </div>
            </div>

            {/* Checklist de Go-Live */}
            <div className="bg-[#1C1F26] p-6 rounded-xl border border-[#2A2E38] space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2E38] pb-3">
                <div className="flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-white text-sm font-sans">
                    Checklist Oficial de Entrada em Produção (Go-Live em 5 Passos)
                  </h3>
                </div>
                <span className="text-xs text-[#8E9299]">Roteiro RH & TI</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-[#0D0F14] p-3.5 rounded-lg border border-[#1F2229]">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Configuração de Permissões da Pasta no Google Drive</h4>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Crie a pasta raiz <code>Banco_de_Horas</code> ou permita que o script a gere automaticamente. Conceda permissão de <strong>Editor</strong> apenas aos membros autorizados do RH e permissão de <strong>Leitor</strong> (ou sem acesso direto) aos demais colaboradores.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0D0F14] p-3.5 rounded-lg border border-[#1F2229]">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Ativação dos Gatilhos Temporais (Triggers) no Google Apps Script</h4>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      No Editor do Apps Script, acesse o menu lateral <strong>Acionadores (Ícone de Relógio) &gt; Adicionar Acionador</strong>:
                    </p>
                    <ul className="list-disc pl-5 text-xs text-[#CBD5E1] space-y-1 mt-1">
                      <li><code>gerarRelatorioAuditoria</code>: Orientado por tempo &gt; Temporizador semanal (ou diário às 08:00).</li>
                      <li><code>executarFechamentoMensalManual</code>: Temporizador mensal (último dia do mês às 23:00).</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0D0F14] p-3.5 rounded-lg border border-[#1F2229]">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Validação da Lista de E-mails de Notificação</h4>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Verifique se a constante <code>CONFIG.EMAIL_NOTIFICACAO_RH</code> no <code>Code.gs</code> contém os e-mails oficiais (atualmente configurado para: <code>rh.coari@empresa.com.br, coari.comara@gmail.com</code>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0D0F14] p-3.5 rounded-lg border border-[#1F2229]">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Homologação do 1º Lote de Colaboradores via CSV</h4>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Utilize o modal de importação (menu <strong>Banco de Horas SPTF &gt; Importar Colaboradores</strong>) para carregar o arquivo CSV com a lista de colaboradores das bases KO, BE e MN, validando o UPSERT inicial.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0D0F14] p-3.5 rounded-lg border border-[#1F2229]">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    5
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Backup Inicial & Histórico de Versões</h4>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Nomeie a versão de homologação no Google Sheets em <strong>Arquivo &gt; Histórico de Versões &gt; Nomear versão atual</strong> como <code>v1.0.0 - Go Live Produção</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Guia Looker Studio */}
            <div className="bg-[#1C1F26] p-6 rounded-xl border border-[#2A2E38] space-y-4">
              <div className="flex items-center justify-between border-b border-[#2A2E38] pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-sm font-sans">
                    Guia Prático: Construção dos 3 Gráficos Principais no Looker Studio
                  </h3>
                </div>
                <button
                  onClick={() => copyToClipboard(`/* Fórmulas Calculadas Looker Studio */
/* 1. Horas_Ponderadas_SPTF */
CASE 
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) IN (0,1,2,3,4) THEN horas_brutas * 1.0
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) = 5 THEN horas_brutas * 1.5
  WHEN tipo_ocorrencia = 'TRABALHO' AND (WEEKDAY(data_registro) = 6 OR e_feriado = TRUE) THEN horas_brutas * 2.0
  WHEN tipo_ocorrencia IN ('F', 'D', 'FALTA_INJUSTIFICADA') THEN -8.0
  WHEN tipo_ocorrencia = 'COMPENSACAO' THEN -1.0 * horas_brutas
  WHEN tipo_ocorrencia IN ('AT', 'ATESTADO_MEDICO', 'FE', 'FERIAS', 'LIC', 'LICENCA') THEN 0.0
  ELSE 0.0
END

/* 2. Saldo_Em_Dias_SPTF */
Horas_Ponderadas_SPTF / 8.0`, 'looker_golive')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {copiedKey === 'looker_golive' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'looker_golive' ? 'Copiado!' : 'Copiar Fórmulas Looker'}
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-[#0D0F14] p-4 rounded-lg border border-[#1F2229] space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      1. Card de KPI: Saldo Acumulado do Mês (Horas e Dias)
                    </h4>
                    <span className="text-[10px] bg-[#1F2229] text-[#8E9299] px-2 py-0.5 rounded">Visão Geral</span>
                  </div>
                  <p className="text-xs text-[#8E9299]">
                    • <strong>Fonte de Dados</strong>: <code>tb_lancamentos_diarios</code> (ou <code>tb_resumo_mensal</code>).<br />
                    • <strong>Métrica Principal</strong>: <code>SUM(saldo_horas_sptf)</code> ou campo calculado <code>SUM(Horas_Ponderadas_SPTF)</code>.<br />
                    • <strong>Métrica Secundária</strong>: <code>SUM(saldo_dias_sptf)</code>.<br />
                    • <strong>Filtro Padrão</strong>: Data do registro = Este Mês / Mês Atual.
                  </p>
                </div>

                <div className="bg-[#0D0F14] p-4 rounded-lg border border-[#1F2229] space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      2. Gráfico de Barras: Distribuição de Ocorrências por Sede (KO, BE, MN)
                    </h4>
                    <span className="text-[10px] bg-[#1F2229] text-[#8E9299] px-2 py-0.5 rounded">Análise de Base</span>
                  </div>
                  <p className="text-xs text-[#8E9299]">
                    • <strong>Dimensão</strong>: <code>sede</code> (KO, BE, MN).<br />
                    • <strong>Dimensão de Detalhamento</strong>: <code>tipo_ocorrencia</code> (TRABALHO, ATESTADO, FALTA, COMPENSACAO).<br />
                    • <strong>Métrica</strong>: <code>COUNT(id_lancamento)</code> ou <code>SUM(horas_brutas)</code>.<br />
                    • <strong>Estilo</strong>: Barras empilhadas com percentual ou total absoluto.
                  </p>
                </div>

                <div className="bg-[#0D0F14] p-4 rounded-lg border border-[#1F2229] space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      3. Tabela Extrato do Colaborador com Link do Drive e Auditoria
                    </h4>
                    <span className="text-[10px] bg-[#1F2229] text-[#8E9299] px-2 py-0.5 rounded">Extrato Auditável</span>
                  </div>
                  <p className="text-xs text-[#8E9299]">
                    • <strong>Dimensões</strong>: <code>data_registro</code>, <code>matricula</code>, <code>nome_colaborador</code>, <code>tipo_ocorrencia</code>, <code>multiplicador_sptf</code>, <code>saldo_horas_sptf</code>, <code>link_comprovante_drive</code>.<br />
                    • <strong>Campo de Link</strong>: Configure <code>link_comprovante_drive</code> como tipo <strong>URL / Hiperlink</strong> com texto de âncora "Abrir Atestado 📄".<br />
                    • <strong>Controles de Filtro</strong>: Adicione um menu suspenso para seleção de Colaborador e período de datas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 4: MANUAL DO USUÁRIO */}
        {activeTab === 'etapa4_manual' && (
          <div className="p-6 space-y-6">
            <div className="bg-[#1C1F26] p-5 rounded-xl border border-[#2A2E38] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-white text-sm font-sans">
                    Manual Prático do Usuário • Guia Rápido RH e Supervisores de Sede (KO, BE, MN)
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold rounded">
                  GUIA OPERACIONAL
                </span>
              </div>
              <p className="text-xs text-[#8E9299] leading-relaxed font-sans">
                Este manual orienta os Supervisores Operacionais e Analistas de Departamento Pessoal na gestão diária do Banco de Horas SPTF, garantindo conformidade jurídica e rastreabilidade total.
              </p>
            </div>

            {/* 4 Processos Operacionais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Processo 1 */}
              <div className="bg-[#15171C] p-5 rounded-xl border border-[#1F2229] space-y-3">
                <div className="flex items-center gap-2.5 text-blue-400">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h4 className="font-bold text-white text-xs font-sans">Cadastrar Colaboradores ou Importar CSV</h4>
                </div>
                <div className="space-y-2 text-[11px] text-[#A0A5AE] leading-relaxed">
                  <p><strong>• Cadastro Individual:</strong> Acesse a aba <em>Colaboradores</em> &gt; <em>+ Novo Colaborador</em>. Preencha Matrícula, Nome, Cargo, Sede (KO, BE ou MN) e Saldo Inicial.</p>
                  <p><strong>• Carga em Lote (CSV):</strong> Baixe o modelo clicando em <em>Template CSV</em>. Preencha com sua equipe e clique em <em>Importar CSV</em>. O sistema executará o <strong>UPSERT automático</strong> (atualiza existentes e cadastra novos sem duplicidade).</p>
                </div>
              </div>

              {/* Processo 2 */}
              <div className="bg-[#15171C] p-5 rounded-xl border border-[#1F2229] space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h4 className="font-bold text-white text-xs font-sans">Lançar Horas e Anexar Atestados Médicos</h4>
                </div>
                <div className="space-y-2 text-[11px] text-[#A0A5AE] leading-relaxed">
                  <p><strong>• Registro Diário:</strong> Clique em <em>+ Novo Lançamento</em>, selecione o colaborador e informe a data e horas trabalhadas.</p>
                  <p><strong>• Multiplicadores SPTF:</strong> Seg-Sex (1.0x), Sábado (1.5x), Dom/Feriado (2.0x), Falta (-8h débito).</p>
                  <p><strong>• Atestados / Afastamentos:</strong> Selecione <em>ATESTADO_MEDICO</em> e anexe a imagem/PDF. O arquivo é armazenado no Google Drive na pasta da Sede/Ano e o link é gravado no registro.</p>
                </div>
              </div>

              {/* Processo 3 */}
              <div className="bg-[#15171C] p-5 rounded-xl border border-[#1F2229] space-y-3">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h4 className="font-bold text-white text-xs font-sans">Consultar Extrato e Exportar (PDF / Excel)</h4>
                </div>
                <div className="space-y-2 text-[11px] text-[#A0A5AE] leading-relaxed">
                  <p><strong>• Visualização Individual:</strong> Acesse a aba <em>Extrato por Colaborador</em> e selecione a matrícula desejada para ver a linha do tempo e saldo consolidado.</p>
                  <p><strong>• Impressão / PDF Oficial:</strong> Clique em <em>Imprimir Extrato / PDF</em> para gerar o espelho de ponto oficial pronto para assinatura do empregado.</p>
                  <p><strong>• Planilha Excel (CSV):</strong> Clique em <em>Exportar CSV</em> para conciliação em planilhas externas.</p>
                </div>
              </div>

              {/* Processo 4 */}
              <div className="bg-[#15171C] p-5 rounded-xl border border-[#1F2229] space-y-3">
                <div className="flex items-center gap-2.5 text-purple-400">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <h4 className="font-bold text-white text-xs font-sans">Fechamento Mensal da Folha (Imutabilidade)</h4>
                </div>
                <div className="space-y-2 text-[11px] text-[#A0A5AE] leading-relaxed">
                  <p><strong>• Último Dia do Mês:</strong> No Google Sheets, clique no menu superior <em>⚡ Banco de Horas SPTF &gt; 📅 Consolidar Fechamento do Mês</em> (ou aguarde o gatilho automático às 23:59).</p>
                  <p><strong>• Snapshot Congelado:</strong> O sistema grava o saldo final na <code>tb_resumo_mensal</code>. Este valor se torna o <strong>Saldo Anterior</strong> da próxima competência, eliminando dependência circular e erros <code>#REF!</code>.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 4: AUDITORIA E ALERTAS */}
        {activeTab === 'etapa4_auditoria' && (
          <div className="p-6 space-y-6">
            <div className="bg-[#1C1F26] p-5 rounded-xl border border-[#2A2E38] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <h3 className="font-bold text-white text-sm font-sans">
                    Rotina de Auditoria de Riscos e Notificações por E-mail (Apps Script)
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold rounded">
                  COMPLIANCE SPTF
                </span>
              </div>
              <p className="text-xs text-[#8E9299] leading-relaxed font-sans">
                A função <code>gerarRelatorioAuditoria()</code> executa uma varredura automatizada nas tabelas e envia um relatório HTML por e-mail para o RH (<code>rh.coari@empresa.com.br</code>) detectando 4 condições críticas:
              </p>
            </div>

            {/* 4 Critérios de Auditoria */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-[#0D0F14] p-4 rounded-xl border border-[#1F2229] space-y-2">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" /> 1. Atestado sem Link
                </div>
                <p className="text-[11px] text-[#8E9299]">
                  Lançamento <code>ATESTADO_MEDICO</code> sem URL do Google Drive gravada nas colunas M/N.
                </p>
              </div>

              <div className="bg-[#0D0F14] p-4 rounded-xl border border-[#1F2229] space-y-2">
                <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                  <Clock className="w-4 h-4" /> 2. Passivo &gt; +40h
                </div>
                <p className="text-[11px] text-[#8E9299]">
                  Colaborador acumulando mais de 40h positivas. Risco de passivo trabalhista e necessidade de folga compensatória.
                </p>
              </div>

              <div className="bg-[#0D0F14] p-4 rounded-xl border border-[#1F2229] space-y-2">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" /> 3. Déficit &lt; -20h
                </div>
                <p className="text-[11px] text-[#8E9299]">
                  Saldo acumulado negativo abaixo de 20h. Requer intervenção do gestor para plano de reposição.
                </p>
              </div>

              <div className="bg-[#0D0F14] p-4 rounded-xl border border-[#1F2229] space-y-2">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" /> 4. Duplicidades
                </div>
                <p className="text-[11px] text-[#8E9299]">
                  Mais de um registro de ocorrência para o mesmo colaborador na mesma data.
                </p>
              </div>
            </div>

            {/* Como acionar no Sheets */}
            <div className="bg-[#0D0F14] p-4 rounded-xl border border-[#1F2229] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white font-sans">Como Executar a Auditoria no Google Sheets:</span>
                <span className="text-[11px] text-emerald-400 font-mono">Menu: ⚡ Banco de Horas SPTF &gt; 🔍 Executar Auditoria</span>
              </div>
              <p className="text-[11px] text-[#8E9299] leading-relaxed">
                Você pode executar manualmente a qualquer momento pelo menu da planilha ou programar um <strong>Gatilho por Tempo (Time-driven Trigger)</strong> semanal no Apps Script para receber o relatório toda segunda-feira às 08:00.
              </p>
            </div>
          </div>
        )}

        {/* ETAPA 2 CONTENT */}
        {activeTab === 'etapa2_csv_drive' && (
          <div className="p-6 space-y-6">
            {/* Card 1: CSV UPSERT Logic */}
            <div className="bg-[#1C1F26] p-5 rounded-xl border border-[#2A2E38] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm font-sans">
                    1. Módulo de Importação CSV com UPSERT em tb_colaboradores
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded">
                  UPSERT AUTOMÁTICO
                </span>
              </div>
              <p className="text-xs text-[#8E9299] leading-relaxed">
                O script lê qualquer arquivo <code>.csv</code> enviado pelo usuário no modal do Google Sheets, mapeia dinamicamente os cabeçalhos e aplica a regra de negócio do RH:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="bg-[#0D0F14] p-3.5 rounded-lg border border-[#1F2229]">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-1">
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Se a Matrícula JÁ EXISTIR (UPDATE)
                  </div>
                  <p className="text-[11px] text-[#8E9299]">
                    Localiza a linha física na planilha e atualiza <em>Nome, Função, Sede, Status, Saldo Inicial, Email e Telefone</em> preservando o ID mestre original e a data de criação original.
                  </p>
                </div>
                <div className="bg-[#0D0F14] p-3.5 rounded-lg border border-[#1F2229]">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                    <FileCheck2 className="w-3.5 h-3.5" /> Se a Matrícula NÃO EXISTIR (INSERT)
                  </div>
                  <p className="text-[11px] text-[#8E9299]">
                    Gera um novo <code>id_colaborador</code> único (ex: <code>COL_1094</code>), aplica o carimbo de data/hora atual e adiciona a nova linha no final da tabela.
                  </p>
                </div>
              </div>

              {/* CSV Example format */}
              <div className="bg-[#0D0F14] p-4 rounded-lg border border-[#1F2229] space-y-2">
                <div className="flex justify-between items-center text-[11px] text-[#8E9299]">
                  <span className="font-bold text-white">Formato Padrão do CSV de Entrada:</span>
                  <button
                    onClick={() => copyToClipboard(`Matricula,Nome,Funcao,Sede,Data_Admissao,Status,Saldo_Inicial,Email,Telefone
MAT-1091,Carlos Eduardo Silva,Técnico de Manutenção,KO,2022-03-15,Ativo,4.0,carlos.silva@empresa.com.br,(92) 98111-2233
MAT-1092,Ana Paula Medeiros,Engenheiro de Operações,BE,2021-08-01,Ativo,-2.0,ana.medeiros@empresa.com.br,(91) 98222-3344
MAT-1093,Roberto Santos,Operador de Produção,MN,2023-01-10,Ativo,0.0,roberto.santos@empresa.com.br,(92) 98333-4455
MAT-1094,Juliana Costa,Analista de Logística,KO,2024-02-01,Ativo,0.0,juliana.costa@empresa.com.br,(92) 98444-5566`, 'csv_template')}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {copiedKey === 'csv_template' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'csv_template' ? 'Copiado!' : 'Copiar Modelo CSV'}
                  </button>
                </div>
                <pre className="text-[11px] text-[#E0E2E5] overflow-x-auto p-2 bg-[#15171C] rounded border border-[#1F2229]">
{`Matricula,Nome,Funcao,Sede,Data_Admissao,Status,Saldo_Inicial,Email,Telefone
MAT-1091,Carlos Eduardo Silva,Técnico de Manutenção,KO,2022-03-15,Ativo,4.0,carlos.silva@empresa.com.br,(92) 98111-2233
MAT-1092,Ana Paula Medeiros,Engenheiro de Operações,BE,2021-08-01,Ativo,-2.0,ana.medeiros@empresa.com.br,(91) 98222-3344
MAT-1093,Roberto Santos,Operador de Produção,MN,2023-01-10,Ativo,0.0,roberto.santos@empresa.com.br,(92) 98333-4455`}
                </pre>
              </div>
            </div>

            {/* Card 2: Google Drive Storage Architecture */}
            <div className="bg-[#1C1F26] p-5 rounded-xl border border-[#2A2E38] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderTree className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-white text-sm font-sans">
                    2. Módulo de Upload de Atestados no Google Drive
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold rounded">
                  HIERARQUIA DRIVE
                </span>
              </div>
              <p className="text-xs text-[#8E9299] leading-relaxed">
                Ao registrar ocorrências de afastamento ou atestados médicos (<code>ATESTADO_MEDICO</code>), os documentos anexados (PDF ou imagens) são enviados diretamente para o Google Drive sob estrutura organizada por ano e base operacional.
              </p>

              <div className="bg-[#0D0F14] p-4 rounded-xl border border-[#1F2229] space-y-3">
                <h4 className="font-bold text-white text-xs">Árvore de Diretórios Criada Automaticamente:</h4>
                <div className="text-[11px] text-[#A0A5AE] space-y-1 font-mono pl-2 border-l-2 border-blue-500">
                  <p className="text-white font-bold">📁 Meu Drive /</p>
                  <p className="pl-4">└── 📁 Banco_de_Horas /</p>
                  <p className="pl-8">└── 📁 Comprovantes /</p>
                  <p className="pl-12">├── 📁 2026 /</p>
                  <p className="pl-16">├── 📁 KO /  <span className="text-emerald-400">→ ATESTADO_MAT-1091_2026-01-15.pdf</span></p>
                  <p className="pl-16">├── 📁 BE /  <span className="text-emerald-400">→ ATESTADO_MAT-1092_2026-01-20.jpg</span></p>
                  <p className="pl-16">└── 📁 MN /  <span className="text-emerald-400">→ ATESTADO_MAT-1093_2026-02-05.pdf</span></p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-[#8E9299] uppercase font-bold">Nomenclatura Padrão</span>
                  <p className="text-xs font-bold text-white mt-1">
                    ATESTADO_[MAT]_[DATA].[ext]
                  </p>
                  <p className="text-[10px] text-[#8E9299] mt-0.5">Ex: ATESTADO_MAT-1091_2026-01-15.pdf</p>
                </div>
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-[#8E9299] uppercase font-bold">Permissão de Visualização</span>
                  <p className="text-xs font-bold text-emerald-400 mt-1">
                    ANYONE_WITH_LINK (View)
                  </p>
                  <p className="text-[10px] text-[#8E9299] mt-0.5">Acesso direto via link gravado na tabela</p>
                </div>
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-[#8E9299] uppercase font-bold">Gravação na Fato</span>
                  <p className="text-xs font-bold text-blue-400 mt-1">
                    Colunas M e N
                  </p>
                  <p className="text-[10px] text-[#8E9299] mt-0.5">id_drive_comprovante & url_comprovante</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CODE.GS TAB */}
        {activeTab === 'code_gs' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm font-sans">
                  Código Google Apps Script Completo (Code.gs)
                </h3>
                <p className="text-xs text-[#8E9299]">
                  Contém a criação das 3 tabelas, menu personalizado, rotina de UPSERT de CSV e upload hierárquico no Google Drive.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(completeAppsScriptCode, 'codegs')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                {copiedKey === 'codegs' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'codegs' ? 'Copiado!' : 'Copiar Code.gs'}
              </button>
            </div>

            <div className="bg-[#0D0F14] text-[#E0E2E5] p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[600px] leading-relaxed border border-[#1F2229]">
              <pre>{completeAppsScriptCode}</pre>
            </div>
          </div>
        )}

        {/* HTML MODAL TAB */}
        {activeTab === 'html_modal' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm font-sans">
                  Arquivo HTML do Modal de Importação (ImportModal.html)
                </h3>
                <p className="text-xs text-[#8E9299]">
                  No Editor do Apps Script, clique em <strong>+ &gt; HTML</strong>, nomeie como <code>ImportModal</code> e cole o código abaixo.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(htmlModalCode, 'modalhtml')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                {copiedKey === 'modalhtml' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'modalhtml' ? 'Copiado!' : 'Copiar ImportModal.html'}
              </button>
            </div>

            <div className="bg-[#0D0F14] text-[#E0E2E5] p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[600px] leading-relaxed border border-[#1F2229]">
              <pre>{htmlModalCode}</pre>
            </div>
          </div>
        )}

        {/* ETAPA 1 TAB */}
        {activeTab === 'etapa1_banco' && (
          <div className="p-6 space-y-6">
            <div className="bg-[#1C1F26] p-4 rounded-xl border border-[#2A2E38]">
              <h3 className="font-bold text-white text-sm mb-2 font-sans">
                Resumo da Modelagem Relacional (Google Sheets / BigQuery)
              </h3>
              <p className="text-xs text-[#8E9299]">
                O banco de dados é composto por 3 tabelas complementares que garantem rastreabilidade integral da folha de pagamento e eliminam dependência circular no saldo de horas:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-blue-400 font-bold">DIMENSÃO MESTRE</span>
                  <h4 className="font-bold text-white text-xs mt-1">tb_colaboradores</h4>
                  <p className="text-[11px] text-[#8E9299] mt-1">Cadastro único de funcionários, matrículas, sedes (KO, BE, MN) e saldos iniciais.</p>
                </div>
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-amber-400 font-bold">FATO / OCORRÊNCIAS</span>
                  <h4 className="font-bold text-white text-xs mt-1">tb_lancamentos_diarios</h4>
                  <p className="text-[11px] text-[#8E9299] mt-1">Registros diários com multiplicadores SPTF (1.0x, 1.5x, 2.0x), saldo em horas/dias e links Drive.</p>
                </div>
                <div className="bg-[#0D0F14] p-3 rounded-lg border border-[#1F2229]">
                  <span className="text-[10px] text-purple-400 font-bold">SNAPSHOTS CONGELADOS</span>
                  <h4 className="font-bold text-white text-xs mt-1">tb_resumo_mensal</h4>
                  <p className="text-[11px] text-[#8E9299] mt-1">Fechamentos imutáveis mês a mês que eliminam dependência circular entre competências.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOOKER STUDIO TAB */}
        {activeTab === 'looker_sql' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm font-sans">
                  Fórmulas de Campos Calculados para o Looker Studio
                </h3>
                <p className="text-xs text-[#8E9299]">
                  Crie estes campos calculados na sua fonte de dados conectada à <code>tb_lancamentos_diarios</code>.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(`/* CAMPO 1: Horas_Ponderadas_SPTF */
CASE 
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) IN (0,1,2,3,4) THEN horas_brutas * 1.0
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) = 5 THEN horas_brutas * 1.5
  WHEN tipo_ocorrencia = 'TRABALHO' AND (WEEKDAY(data_registro) = 6 OR e_feriado = TRUE) THEN horas_brutas * 2.0
  WHEN tipo_ocorrencia IN ('F', 'D', 'FALTA_INJUSTIFICADA') THEN -8.0
  WHEN tipo_ocorrencia = 'COMPENSACAO' THEN -1.0 * horas_brutas
  ELSE 0.0
END

/* CAMPO 2: Saldo_Em_Dias_SPTF */
Horas_Ponderadas_SPTF / 8.0`, 'looker')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                {copiedKey === 'looker' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'looker' ? 'Copiado!' : 'Copiar Fórmulas Looker'}
              </button>
            </div>

            <div className="bg-[#0D0F14] text-[#E0E2E5] p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-[#1F2229]">
              <pre>{`/* CAMPO 1: Horas_Ponderadas_SPTF (Looker Studio) */
CASE 
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) IN (0,1,2,3,4) THEN horas_brutas * 1.0
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) = 5 THEN horas_brutas * 1.5
  WHEN tipo_ocorrencia = 'TRABALHO' AND (WEEKDAY(data_registro) = 6 OR e_feriado = TRUE) THEN horas_brutas * 2.0
  WHEN tipo_ocorrencia IN ('F', 'D', 'FALTA_INJUSTIFICADA') THEN -8.0
  WHEN tipo_ocorrencia = 'COMPENSACAO' THEN -1.0 * horas_brutas
  WHEN tipo_ocorrencia IN ('AT', 'ATESTADO_MEDICO', 'FE', 'FERIAS', 'LIC', 'LICENCA') THEN 0.0
  ELSE 0.0
END

/* CAMPO 2: Saldo_Em_Dias_SPTF */
Horas_Ponderadas_SPTF / 8.0`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
