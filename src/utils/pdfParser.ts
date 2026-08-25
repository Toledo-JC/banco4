import * as pdfjsLib from 'pdfjs-dist';
import { PaystubRecord, PaystubRubrica } from '../types';

// Configure worker safely for browser environments (Vite)
if (typeof window !== 'undefined') {
  try {
    const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch (err) {
    console.warn('PDF.js worker setup notice:', err);
  }
}

export interface ParsePaystubResult {
  paystubs: PaystubRecord[];
  totalPages: number;
  totalExtracted: number;
  warnings: string[];
}

/**
 * Converte string de moeda brasileira (ex: "3.450,80" ou "3450.80") para número
 */
export function parseCurrencyBR(valStr: string | undefined | null): number {
  if (!valStr) return 0;
  const clean = valStr.trim().replace(/[R$\s]/g, '');
  if (!clean) return 0;

  // Se tiver vírgula e ponto (ex: 1.234,56)
  if (clean.includes(',') && clean.includes('.')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }
  // Se tiver apenas vírgula (ex: 1234,56)
  if (clean.includes(',')) {
    const normalized = clean.replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }
  // Se for float puro
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/**
 * Extrai texto posicional ordenado de uma página do PDF
 */
async function extractLinesFromPdfPage(page: any): Promise<string[]> {
  const textContent = await page.getTextContent({ normalizeWhitespace: true });
  const items = textContent.items as Array<{
    str: string;
    transform: number[]; // [scaleX, skewY, skewX, scaleY, x, y]
    width: number;
    height: number;
  }>;

  if (!items || items.length === 0) return [];

  // Agrupa itens por coordenada Y (linhas visuais) com tolerância de 3.5px
  const linesMap: { y: number; items: typeof items }[] = [];

  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;

    const y = item.transform[5];
    const x = item.transform[4];

    // Procura linha próxima
    let existingLine = linesMap.find((l) => Math.abs(l.y - y) <= 3.5);
    if (!existingLine) {
      existingLine = { y, items: [] };
      linesMap.push(existingLine);
    }
    existingLine.items.push(item);
  }

  // Ordena linhas de cima para baixo (Y decrescente)
  linesMap.sort((a, b) => b.y - a.y);

  // Para cada linha, ordena itens da esquerda para a direita (X crescente) e junta o texto
  const lines: string[] = [];
  for (const line of linesMap) {
    line.items.sort((a, b) => a.transform[4] - b.transform[4]);
    const lineText = line.items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
    if (lineText) {
      lines.push(lineText);
    }
  }

  return lines;
}

/**
 * Identifica se uma rubrica é um desconto conhecido
 */
export function isRubricaDesconto(codigo: string, descricao: string): boolean {
  const descUpper = descricao.toUpperCase();
  const codNum = parseInt(codigo, 10);

  // Códigos típicos de descontos
  if ([611, 901, 902, 903, 904, 905, 908, 910, 911, 915, 920, 925, 930, 940, 950, 999].includes(codNum)) {
    return true;
  }

  if (
    descUpper.includes('DESC') ||
    descUpper.includes('DESCONTO') ||
    descUpper.includes('INSS') ||
    descUpper.includes('IRRF') ||
    descUpper.includes('IMPOSTO DE RENDA') ||
    descUpper.includes('FALTA') ||
    descUpper.includes('ATRASO') ||
    descUpper.includes('PENSAO') ||
    descUpper.includes('PENSÃO') ||
    descUpper.includes('SINDICATO') ||
    descUpper.includes('VALE') ||
    descUpper.includes('ADIANTAMENTO') ||
    descUpper.includes('CONSIG')
  ) {
    return true;
  }

  return false;
}

/**
 * Parser de texto de um contracheque individual da COMARA
 */
export function parseSingleContrachequeText(
  lines: string[], 
  currentUserEmail?: string, 
  pageNumber?: number
): PaystubRecord | null {
  if (!lines || lines.length === 0) return null;

  let matricula = '';
  let nome = '';
  let cargo = '';
  let sede = 'KO-DL';
  let periodo = '';
  let mesAno = '';
  let mes = 7;
  let ano = 2026;
  let dataInicio = '';
  let dataFim = '';
  let cpf = '';
  let banco = '';
  let agencia = '';
  let conta = '';

  let totalProventos = 0;
  let totalDescontos = 0;
  let valorLiquido = 0;
  let salarioBase = 0;
  let baseInss = 0;
  let baseFgts = 0;
  let fgtsMes = 0;
  let baseIrrf = 0;

  const rubricas: PaystubRubrica[] = [];

  // 1. Extração de Matrícula e Nome
  // Regex oficial: ^(\d{6})\s+(.+) (ex: "013853 CLESIO DE SOUZA FARO LOPES")
  const matriculaNomeRegex = /(?:^|\s)(?:MATR[ÍI]CULA|MATR?\.?|SERV\.?)?[:\s]*(\d{6})\s+([A-ZÀ-Ú\s\.\'\-]{3,60})/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Busca Matrícula e Nome
    if (!matricula) {
      const match = line.match(matriculaNomeRegex);
      if (match) {
        matricula = match[1].trim();
        nome = match[2].trim().replace(/\s+(OPERADOR|MOTORISTA|ELETRICISTA|CARGO|SEDE|CANTEIRO).*/i, '').trim();
      } else {
        // Fallback: 6 dígitos isolados seguidos de nome na mesma linha
        const directMatch = line.match(/^(\d{6})\s+([A-ZÀ-Ú\s]{3,})/);
        if (directMatch) {
          matricula = directMatch[1].trim();
          nome = directMatch[2].trim();
        }
      }
    }

    // Busca Cargo / Função
    if (!cargo) {
      // Se linha contém "CARGO:" ou "FUNÇÃO:"
      const cargoPrefixMatch = line.match(/(?:CARGO|FUN[CÇ][AÃ]O|OCUPA[CÇ][AÃ]O)[:\s]+([A-ZÀ-Ú0-9\s\.\-\/]+)/i);
      if (cargoPrefixMatch) {
        cargo = cargoPrefixMatch[1].trim();
      } else if (
        line.match(/(OPERADOR DE|ELETRICISTA|MOTORISTA|SERVENTE|PEDREIRO|CARPINTEIRO|ENCARREGADO|APONTADOR|MECANICO|SOLDADOR|TECNICO|AUXILIAR|ENGENHEIRO|ANALISTA|TOPOGRAFO)/i) &&
        !line.includes('COMISSÃO') && !line.includes('COMANDO') && !line.includes('AERONÁUTICA')
      ) {
        // Linha identificada com nome de cargo da COMARA
        cargo = line.replace(/^(?:CARGO|FUNCAO|FUNÇÃO)[:\s]*/i, '').trim();
      }
    }

    // Busca Sede (ex: KO-DL, KO, BE, MN, etc.)
    if (line.match(/(?:SEDE|CANTEIRO|LOTA[CÇ][AÃ]O|UNIDADE)[:\s]*([A-Z]{2}(?:-[A-Z0-9]+)?)/i)) {
      const matchSede = line.match(/(?:SEDE|CANTEIRO|LOTA[CÇ][AÃ]O|UNIDADE)[:\s]*([A-Z]{2}(?:-[A-Z0-9]+)?)/i);
      if (matchSede) sede = matchSede[1].toUpperCase();
    } else if (line.match(/\b(KO-DL|KO|BE|MN|MN-AM|BE-PA|COARI|BEL[EÉ]M|MANAUS)\b/i)) {
      const matchSede = line.match(/\b(KO-DL|KO|BE|MN|MN-AM|BE-PA|COARI|BEL[EÉ]M|MANAUS)\b/i);
      if (matchSede) {
        const raw = matchSede[1].toUpperCase();
        sede = raw === 'COARI' ? 'KO-DL' : raw === 'BELÉM' || raw === 'BELEM' ? 'BE' : raw === 'MANAUS' ? 'MN' : raw;
      }
    }

    // Busca Período / Competência (ex: "01/07/2026 a 31/07/2026" ou "07/2026" ou "JULHO/2026")
    const dateRangeMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:a|A|à|À|-)\s*(\d{2}\/\d{2}\/\d{4})/);
    if (dateRangeMatch) {
      dataInicio = dateRangeMatch[1];
      dataFim = dateRangeMatch[2];
      const parts = dataFim.split('/');
      if (parts.length === 3) {
        mes = parseInt(parts[1], 10);
        ano = parseInt(parts[2], 10);
        mesAno = `${String(mes).padStart(2, '0')}-${ano}`;
        periodo = `${String(mes).padStart(2, '0')}/${ano}`;
      }
    } else {
      const compMatch = line.match(/(?:COMPET[EÊ]NCIA|M[EÊ]S\/ANO|PER[IÍ]ODO)[:\s]*(\d{2})[\/\-](\d{4})/i);
      if (compMatch) {
        mes = parseInt(compMatch[1], 10);
        ano = parseInt(compMatch[2], 10);
        mesAno = `${String(mes).padStart(2, '0')}-${ano}`;
        periodo = `${String(mes).padStart(2, '0')}/${ano}`;
      }
    }

    // Busca CPF
    const cpfMatch = line.match(/(?:CPF)[:\s]*(\d{3}\.\d{3}\.\d{3}\-\d{2}|\d{11})/i);
    if (cpfMatch) {
      cpf = cpfMatch[1].trim();
    }

    // Busca Dados Bancários
    const bancoMatch = line.match(/(?:BANCO|BCO)[:\s]*([A-Z0-9\s]+?)\s+(?:AG[EÊ]NCIA|AG)[:\s]*([0-9\-]+)\s+(?:C\/C|CONTA)[:\s]*([0-9\-]+)/i);
    if (bancoMatch) {
      banco = bancoMatch[1].trim();
      agencia = bancoMatch[2].trim();
      conta = bancoMatch[3].trim();
    }

    // 2. Extração de Rubricas (Linha por Linha)
    // Ex: "001 Salário Base 30D 3.450,00"
    // Ex: "032 Aux Transporte 22D 240,00"
    // Ex: "600 Auxílio Alimentação 650,00"
    // Ex: "611 Desc. auxilio transporte 6.00% 207,00"
    // Ex: "903 INSS Folha 14.00% 483,00"
    const rubricaRegex = /^(\d{3,4})\s+([A-Za-zÀ-ÿ0-9\.\,\-\/\%\(\)\s]+?)(?:\s+(\d+(?:[\:\,\.]\d+)?(?:%|D|H)?))?\s+([\d\.\,]+)(?:\s+([\d\.\,]+))?$/;
    const rubMatch = line.match(rubricaRegex);

    if (rubMatch) {
      const cod = rubMatch[1].trim();
      const desc = rubMatch[2].trim();
      const ref = rubMatch[3]?.trim() || '';
      const val1Str = rubMatch[4]?.trim();
      const val2Str = rubMatch[5]?.trim();

      // Ignora se for linha de totais ou cabeçalho
      const descUpper = desc.toUpperCase();
      if (
        !descUpper.includes('TOTAL') && 
        !descUpper.includes('LÍQUIDO') && 
        !descUpper.includes('LIQUIDO') && 
        !descUpper.includes('BASE DE CÁLCULO') &&
        !descUpper.includes('FGTS DO MÊS')
      ) {
        const val1 = parseCurrencyBR(val1Str);
        const val2 = parseCurrencyBR(val2Str);

        let provento = 0;
        let desconto = 0;

        // Se tiver duas colunas de valores, val1 costuma ser Provento e val2 Desconto
        if (val2Str) {
          provento = val1;
          desconto = val2;
        } else {
          // Se tiver apenas uma coluna de valor, classifica pela natureza da rubrica
          const isDesc = isRubricaDesconto(cod, desc);
          if (isDesc) {
            desconto = val1;
          } else {
            provento = val1;
          }
        }

        if (provento > 0 || desconto > 0) {
          rubricas.push({
            codigo: cod,
            descricao: desc,
            referencia: ref,
            provento,
            desconto,
            tipo: desconto > 0 ? 'DESCONTO' : 'PROVENTO'
          });
        }
      }
    }

    // 3. Extração de Totais e Bases Consolidadas no Rodapé
    if (line.match(/TOTAL\s+(?:DE\s+)?(?:VENCIMENTOS|PROVENTOS)/i)) {
      const matchTot = line.match(/TOTAL\s+(?:DE\s+)?(?:VENCIMENTOS|PROVENTOS)[:\s]*([\d\.\,]+)/i);
      if (matchTot) totalProventos = parseCurrencyBR(matchTot[1]);
    }

    if (line.match(/TOTAL\s+(?:DE\s+)?DESCONTOS/i)) {
      const matchTot = line.match(/TOTAL\s+(?:DE\s+)?DESCONTOS[:\s]*([\d\.\,]+)/i);
      if (matchTot) totalDescontos = parseCurrencyBR(matchTot[1]);
    }

    if (line.match(/(?:VALOR\s+)?L[ÍI]QUIDO(?:\s+A\s+RECEBER)?/i)) {
      const matchLiq = line.match(/(?:VALOR\s+)?L[ÍI]QUIDO(?:\s+A\s+RECEBER)?[:\s]*([\d\.\,]+)/i);
      if (matchLiq) valorLiquido = parseCurrencyBR(matchLiq[1]);
    }

    if (line.match(/SAL[ÁA]RIO\s+BASE[:\s]*([\d\.\,]+)/i)) {
      const matchSal = line.match(/SAL[ÁA]RIO\s+BASE[:\s]*([\d\.\,]+)/i);
      if (matchSal) salarioBase = parseCurrencyBR(matchSal[1]);
    }

    if (line.match(/BASE\s+(?:C[ÁA]LC(?:ULO)?\s+)?INSS[:\s]*([\d\.\,]+)/i)) {
      const matchInss = line.match(/BASE\s+(?:C[ÁA]LC(?:ULO)?\s+)?INSS[:\s]*([\d\.\,]+)/i);
      if (matchInss) baseInss = parseCurrencyBR(matchInss[1]);
    }

    if (line.match(/BASE\s+(?:C[ÁA]LC(?:ULO)?\s+)?FGTS[:\s]*([\d\.\,]+)/i)) {
      const matchFgts = line.match(/BASE\s+(?:C[ÁA]LC(?:ULO)?\s+)?FGTS[:\s]*([\d\.\,]+)/i);
      if (matchFgts) baseFgts = parseCurrencyBR(matchFgts[1]);
    }

    if (line.match(/FGTS\s+DO\s+M[EÊ]S[:\s]*([\d\.\,]+)/i)) {
      const matchFgtsMes = line.match(/FGTS\s+DO\s+M[EÊ]S[:\s]*([\d\.\,]+)/i);
      if (matchFgtsMes) fgtsMes = parseCurrencyBR(matchFgtsMes[1]);
    }

    if (line.match(/BASE\s+(?:C[ÁA]LC(?:ULO)?\s+)?IRRF[:\s]*([\d\.\,]+)/i)) {
      const matchIrrf = line.match(/BASE\s+(?:C[ÁA]LC(?:ULO)?\s+)?IRRF[:\s]*([\d\.\,]+)/i);
      if (matchIrrf) baseIrrf = parseCurrencyBR(matchIrrf[1]);
    }
  }

  // Validação mínima: precisa ter matrícula ou nome para ser um contracheque válido
  if (!matricula && !nome) {
    return null;
  }

  // Se a matrícula não foi encontrada mas achou nome, tenta gerar ID ou pegar 6 primeiros dígitos
  if (!matricula && nome) {
    matricula = `00${String(pageNumber || 1).padStart(4, '0')}`;
  }

  // Se período não foi achado, usa padrão Agosto/2026 ou Julho/2026
  if (!mesAno) {
    mesAno = '07-2026';
    periodo = '07/2026';
    ano = 2026;
    mes = 7;
  }

  // Se os totais não foram extraídos textualmente, calcula através das rubricas
  const sumProventos = rubricas.reduce((acc, r) => acc + r.provento, 0);
  const sumDescontos = rubricas.reduce((acc, r) => acc + r.desconto, 0);

  if (totalProventos === 0 && sumProventos > 0) {
    totalProventos = sumProventos;
  }
  if (totalDescontos === 0 && sumDescontos > 0) {
    totalDescontos = sumDescontos;
  }
  if (valorLiquido === 0) {
    valorLiquido = Math.max(0, totalProventos - totalDescontos);
  }

  const docId = `${matricula}_${mesAno}`;

  return {
    id: docId,
    matricula,
    nome: nome || 'COLABORADOR COMARA',
    cargo: cargo || 'COLABORADOR DA CONSTRUÇÃO',
    sede: sede || 'KO-DL',
    periodo: periodo || `${mesAno.replace('-', '/')}`,
    mesAno,
    ano,
    mes,
    dataInicio,
    dataFim,
    cpf,
    banco,
    agencia,
    conta,
    rubricas,
    totalProventos,
    totalDescontos,
    valorLiquido,
    salarioBase: salarioBase || (rubricas.find(r => r.codigo === '001')?.provento || 0),
    baseInss: baseInss || totalProventos,
    baseFgts: baseFgts || totalProventos,
    fgtsMes: fgtsMes || (baseFgts ? baseFgts * 0.08 : totalProventos * 0.08),
    baseIrrf: baseIrrf || Math.max(0, totalProventos - (baseInss * 0.14)),
    importadoEm: new Date().toISOString(),
    importadoPorEmail: currentUserEmail || 'coari.comara@gmail.com',
    observacoes: `Ficha Financeira Oficial extraída via Leitor PDF COMARA (Página ${pageNumber || 1})`
  };
}

/**
 * Processa um arquivo PDF completo no navegador (podendo ter múltiplos contracheques concatenados)
 */
export async function parseComaraPdfContracheques(
  pdfArrayBuffer: ArrayBuffer,
  currentUserEmail?: string,
  onProgress?: (current: number, total: number) => void
): Promise<ParsePaystubResult> {
  const warnings: string[] = [];
  const paystubsMap = new Map<string, PaystubRecord>();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfArrayBuffer,
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (onProgress) {
        onProgress(pageNum, totalPages);
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        const lines = await extractLinesFromPdfPage(page);

        if (lines.length > 0) {
          const parsed = parseSingleContrachequeText(lines, currentUserEmail, pageNum);
          if (parsed && parsed.matricula) {
            // Se já existir a mesma chave (ex: mesma matrícula no mesmo mês), mescla rubricas se necessário ou substitui
            paystubsMap.set(parsed.id, parsed);
          }
        }
      } catch (pageErr: any) {
        warnings.push(`Erro ao processar página ${pageNum}: ${pageErr?.message || pageErr}`);
      }
    }

    const paystubs = Array.from(paystubsMap.values());
    return {
      paystubs,
      totalPages,
      totalExtracted: paystubs.length,
      warnings
    };
  } catch (err: any) {
    throw new Error(`Falha ao ler o arquivo PDF: ${err.message || err}`);
  }
}

/**
 * Dados de Demonstração Oficiais COMARA para testes imediatos sem upload
 */
export function getDemoComaraPaystubs(): PaystubRecord[] {
  return [
    {
      id: '013853_07-2026',
      matricula: '013853',
      nome: 'CLESIO DE SOUZA FARO LOPES',
      cargo: 'OPERADOR DE MOTONIVEL',
      sede: 'KO-DL',
      periodo: '07/2026',
      mesAno: '07-2026',
      ano: 2026,
      mes: 7,
      dataInicio: '01/07/2026',
      dataFim: '31/07/2026',
      cpf: '***.482.912-**',
      banco: '001 - BANCO DO BRASIL',
      agencia: '2345-6',
      conta: '98765-4',
      rubricas: [
        { codigo: '001', descricao: 'Salário Base', referencia: '30D', provento: 3850.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '032', descricao: 'Aux Transporte', referencia: '22D', provento: 260.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '600', descricao: 'Auxílio Alimentação', referencia: '22D', provento: 750.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '722', descricao: 'Aux. Alimentação Atrasado', referencia: '', provento: 180.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '045', descricao: 'Insalubridade 40%', referencia: '40%', provento: 608.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '611', descricao: 'Desc. auxilio transporte', referencia: '6.00%', provento: 0, desconto: 231.00, tipo: 'DESCONTO' },
        { codigo: '903', descricao: 'INSS Folha', referencia: '14.00%', provento: 0, desconto: 539.00, tipo: 'DESCONTO' },
        { codigo: '904', descricao: 'IRRF Folha', referencia: '7.50%', provento: 0, desconto: 142.50, tipo: 'DESCONTO' },
      ],
      totalProventos: 5648.00,
      totalDescontos: 912.50,
      valorLiquido: 4735.50,
      salarioBase: 3850.00,
      baseInss: 4458.00,
      baseFgts: 4458.00,
      fgtsMes: 356.64,
      baseIrrf: 3919.00,
      importadoEm: new Date().toISOString(),
      importadoPorEmail: 'coari.comara@gmail.com',
      observacoes: 'Ficha Financeira Oficial - COMARA Canteiro Coari (KO-DL)'
    },
    {
      id: '014201_07-2026',
      matricula: '014201',
      nome: 'RAIMUNDO NONATO SILVA',
      cargo: 'ELETRICISTA DE INSTALACO',
      sede: 'KO-DL',
      periodo: '07/2026',
      mesAno: '07-2026',
      ano: 2026,
      mes: 7,
      dataInicio: '01/07/2026',
      dataFim: '31/07/2026',
      cpf: '***.194.882-**',
      banco: '104 - CAIXA ECONOMICA',
      agencia: '0456',
      conta: '10982-1',
      rubricas: [
        { codigo: '001', descricao: 'Salário Base', referencia: '30D', provento: 3450.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '032', descricao: 'Aux Transporte', referencia: '22D', provento: 240.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '600', descricao: 'Auxílio Alimentação', referencia: '22D', provento: 750.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '045', descricao: 'Insalubridade 20%', referencia: '20%', provento: 304.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '611', descricao: 'Desc. auxilio transporte', referencia: '6.00%', provento: 0, desconto: 207.00, tipo: 'DESCONTO' },
        { codigo: '903', descricao: 'INSS Folha', referencia: '12.00%', provento: 0, desconto: 414.00, tipo: 'DESCONTO' },
        { codigo: '904', descricao: 'IRRF Folha', referencia: '7.50%', provento: 0, desconto: 89.20, tipo: 'DESCONTO' },
      ],
      totalProventos: 4744.00,
      totalDescontos: 710.20,
      valorLiquido: 4033.80,
      salarioBase: 3450.00,
      baseInss: 3754.00,
      baseFgts: 3754.00,
      fgtsMes: 300.32,
      baseIrrf: 3340.00,
      importadoEm: new Date().toISOString(),
      importadoPorEmail: 'coari.comara@gmail.com',
      observacoes: 'Ficha Financeira Oficial - COMARA Canteiro Coari (KO-DL)'
    },
    {
      id: '015099_07-2026',
      matricula: '015099',
      nome: 'JOAO BATISTA ALVES',
      cargo: 'MOTORISTA DE CAMINHAO',
      sede: 'KO-DL',
      periodo: '07/2026',
      mesAno: '07-2026',
      ano: 2026,
      mes: 7,
      dataInicio: '01/07/2026',
      dataFim: '31/07/2026',
      cpf: '***.723.612-**',
      banco: '001 - BANCO DO BRASIL',
      agencia: '2345-6',
      conta: '54321-0',
      rubricas: [
        { codigo: '001', descricao: 'Salário Base', referencia: '30D', provento: 3600.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '032', descricao: 'Aux Transporte', referencia: '22D', provento: 250.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '600', descricao: 'Auxílio Alimentação', referencia: '22D', provento: 750.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '010', descricao: 'Horas Extras 50%', referencia: '12:00', provento: 294.50, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '611', descricao: 'Desc. auxilio transporte', referencia: '6.00%', provento: 0, desconto: 216.00, tipo: 'DESCONTO' },
        { codigo: '903', descricao: 'INSS Folha', referencia: '12.00%', provento: 0, desconto: 432.00, tipo: 'DESCONTO' },
        { codigo: '904', descricao: 'IRRF Folha', referencia: '7.50%', provento: 0, desconto: 105.40, tipo: 'DESCONTO' },
      ],
      totalProventos: 4894.50,
      totalDescontos: 753.40,
      valorLiquido: 4141.10,
      salarioBase: 3600.00,
      baseInss: 3894.50,
      baseFgts: 3894.50,
      fgtsMes: 311.56,
      baseIrrf: 3462.50,
      importadoEm: new Date().toISOString(),
      importadoPorEmail: 'coari.comara@gmail.com',
      observacoes: 'Ficha Financeira Oficial - COMARA Canteiro Coari (KO-DL)'
    }
  ];
}
