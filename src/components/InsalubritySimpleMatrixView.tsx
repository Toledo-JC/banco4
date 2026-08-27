import React, { useState, useMemo } from 'react';
import { Employee, InsalubrityRecord, ConstructionSite, AdminRole } from '../types';
import { ComaraLogo } from './ComaraLogo';
import { getSignaturesForCanteiro } from '../services/canteiroService';
import { 
  FileSpreadsheet, 
  Calendar, 
  Search, 
  Download, 
  Printer, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Layers, 
  Trash2, 
  Settings2,
  Briefcase,
  Edit3,
  ArrowRightLeft,
  FileText,
  UploadCloud
} from 'lucide-react';
import { ImportInsalubrityMatrixModal } from './ImportInsalubrityMatrixModal';

interface InsalubritySimpleMatrixViewProps {
  employees: Employee[];
  insalubrityRecords: InsalubrityRecord[];
  onSaveRecord: (record: InsalubrityRecord) => Promise<void>;
  onSaveBatchRecords?: (records: InsalubrityRecord[]) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onUpdateEmployees?: (employees: Employee[]) => Promise<void> | void;
  constructionSites?: ConstructionSite[];
  currentUserEmail?: string;
  userRole?: AdminRole;
  theme?: 'dark' | 'light';
  onSwitchToCompleteMode?: () => void;
  onOpenConversionModal?: () => void;
  onNavigateToReports?: () => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Atividades mais frequentes em canteiros de obras COMARA
const DEFAULT_ACTIVITIES = [
  'CANALETA',
  'CONCRETO',
  'TOPOGRAFIA',
  'ASFALTO',
  'MANUTENÇÃO',
  'CARPINTARIA',
  'ARMADOR',
  'TERRAPLENAGEM',
  'DRENAGEM',
  'PINTURA',
  'SERVIÇOS GERAIS'
];

export const InsalubritySimpleMatrixView: React.FC<InsalubritySimpleMatrixViewProps> = ({
  employees,
  insalubrityRecords,
  onSaveRecord,
  onSaveBatchRecords,
  onDeleteRecord,
  onUpdateEmployees,
  constructionSites = [],
  currentUserEmail = 'coari.comara@gmail.com',
  userRole = 'SUPER_ADMIN',
  theme = 'dark',
  onSwitchToCompleteMode,
  onOpenConversionModal,
  onNavigateToReports,
}) => {
  const isDark = theme === 'dark';

  // 1. Período Selecionado (Ano, Mês, Modo de Janela de Dias e Navegação)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0 = Jan
  const [periodViewMode, setPeriodViewMode] = useState<'Q1' | 'Q2' | 'FULL' | 'CUSTOM'>(
    now.getDate() <= 15 ? 'Q1' : 'Q2'
  );
  // Dia inicial da visualização (1 a daysInMonth)
  const [startDayOffset, setStartDayOffset] = useState<number>(now.getDate() <= 15 ? 1 : 16);
  // Tamanho da janela em dias (padrão 15)
  const [windowSize, setWindowSize] = useState<number>(15);

  // 2. Filtros de visualização
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('TODAS');
  const [selectedCargo, setSelectedCargo] = useState<string>('TODOS');
  const [onlyWithRecords, setOnlyWithRecords] = useState(false);

  // 3. Atividade Ativa para Lançamento Rápido
  const [activeActivity, setActiveActivity] = useState<string>('CONCRETO');
  const [customActivityInput, setCustomActivityInput] = useState<string>('');

  // 4. Modais
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [cellEditTarget, setCellEditTarget] = useState<{
    emp: Employee;
    dayMeta: { dayNumber: number; formattedDate: string; weekdayInitial: string; isWeekend: boolean };
    record?: InsalubrityRecord;
  } | null>(null);

  const handleImportMatrixBatch = async (
    records: InsalubrityRecord[],
    newEmployees?: Employee[],
    targetMonth?: number,
    targetYear?: number
  ) => {
    if (targetYear !== undefined) setSelectedYear(targetYear);
    if (targetMonth !== undefined) setSelectedMonth(targetMonth);
    setPeriodViewMode('FULL');

    // Cadastra novos colaboradores se houver
    if (newEmployees && newEmployees.length > 0 && onUpdateEmployees) {
      const existingMatriculas = new Set(employees.map(e => e.matricula.trim().toUpperCase()));
      const toAdd = newEmployees.filter(e => !existingMatriculas.has(e.matricula.trim().toUpperCase()));
      if (toAdd.length > 0) {
        await onUpdateEmployees([...employees, ...toAdd]);
      }
    }

    // Salva o lote de registros de insalubridade
    if (onSaveBatchRecords) {
      await onSaveBatchRecords(records);
    }
  };

  // Estado do Formulário em Lote de Atividades (Modo Simples: Data + Atividade + Busca + Seleção)
  const [batchSelectedEmpIds, setBatchSelectedEmpIds] = useState<string[]>([]);
  const [batchActivity, setBatchActivity] = useState('CONCRETO');
  const [batchLaunchDate, setBatchLaunchDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Total de dias no mês selecionado
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Lista completa de todos os dias do mês
  const allMonthDays = useMemo(() => {
    const list = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const dayOfWeek = date.getDay(); // 0 = Dom, 6 = Sáb
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      list.push({
        dayNumber: day,
        dayOfWeek,
        weekdayInitial: WEEKDAY_INITIALS[dayOfWeek],
        isWeekend,
        formattedDate,
      });
    }
    return list;
  }, [selectedYear, selectedMonth, daysInMonth]);

  // Dias Visíveis na Matriz com base no modo selecionado ou deslocamento de dias
  const visibleDays = useMemo(() => {
    if (periodViewMode === 'Q1') {
      return allMonthDays.filter(d => d.dayNumber >= 1 && d.dayNumber <= 15);
    }
    if (periodViewMode === 'Q2') {
      return allMonthDays.filter(d => d.dayNumber >= 16);
    }
    if (periodViewMode === 'FULL') {
      return allMonthDays;
    }
    // Modo CUSTOM (Janela Deslizante)
    const start = Math.max(1, Math.min(startDayOffset, daysInMonth));
    const end = Math.min(start + windowSize - 1, daysInMonth);
    return allMonthDays.filter(d => d.dayNumber >= start && d.dayNumber <= end);
  }, [allMonthDays, periodViewMode, startDayOffset, windowSize, daysInMonth]);

  // Alias para manter compatibilidade com relatórios e lote
  const currentQuinzenaDays = visibleDays;

  // Rótulo textual do período selecionado
  const currentPeriodLabel = useMemo(() => {
    if (periodViewMode === 'Q1') return '1ª Quinzena (Dias 01 a 15)';
    if (periodViewMode === 'Q2') return `2ª Quinzena (Dias 16 a ${daysInMonth})`;
    if (periodViewMode === 'FULL') return `Mês Completo (Dias 01 a ${daysInMonth})`;
    if (visibleDays.length > 0) {
      const first = visibleDays[0].dayNumber.toString().padStart(2, '0');
      const last = visibleDays[visibleDays.length - 1].dayNumber.toString().padStart(2, '0');
      return `Intervalo Personalizado (Dias ${first} a ${last})`;
    }
    return `Dias 01 a ${daysInMonth}`;
  }, [periodViewMode, daysInMonth, visibleDays]);

  // Deslocar dias para frente ou para trás
  const handleShiftDays = (delta: number) => {
    let currentStart = 1;
    if (periodViewMode === 'Q1') currentStart = 1;
    else if (periodViewMode === 'Q2') currentStart = 16;
    else if (periodViewMode === 'FULL') currentStart = 1;
    else currentStart = startDayOffset;

    let newStart = currentStart + delta;

    if (newStart < 1) {
      // Se recuar além do dia 1, vai para o dia 1 do mês atual (ou volta o mês se já estava em 1)
      if (currentStart === 1) {
        handlePrevMonth();
        return;
      }
      newStart = 1;
    } else if (newStart > daysInMonth - 4) {
      // Se avançar além do fim do mês
      if (currentStart >= daysInMonth - 4) {
        handleNextMonth();
        return;
      }
      newStart = Math.max(1, daysInMonth - windowSize + 1);
    }

    setStartDayOffset(newStart);
    setPeriodViewMode('CUSTOM');
  };

  const handleSelectQuinzena = (q: 'Q1' | 'Q2') => {
    setPeriodViewMode(q);
    setStartDayOffset(q === 'Q1' ? 1 : 16);
  };

  const handleSelectFullMonth = () => {
    setPeriodViewMode('FULL');
    setStartDayOffset(1);
  };

  // Lista de funções disponíveis para o filtro
  const availableCargos = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      const c = e.funcao || e.cargo;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Map de registros de insalubridade indexados por "matricula_YYYY-MM-DD"
  const recordsMap = useMemo(() => {
    const map = new Map<string, InsalubrityRecord>();
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    insalubrityRecords.forEach(rec => {
      if (rec.dataEvento.startsWith(monthPrefix)) {
        const key = `${rec.matricula.trim().toUpperCase()}_${rec.dataEvento}`;
        map.set(key, rec);
      }
    });
    return map;
  }, [insalubrityRecords, selectedYear, selectedMonth]);

  // Lista filtrada de colaboradores
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // 1. Busca texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = emp.nome.toLowerCase().includes(q);
        const matchMat = emp.matricula.toLowerCase().includes(q);
        const matchCargo = (emp.funcao || emp.cargo || '').toLowerCase().includes(q);
        if (!matchName && !matchMat && !matchCargo) return false;
      }

      // 2. Sede / Canteiro
      if (selectedBranch !== 'TODAS') {
        const empSede = emp.sede_atual || emp.sede;
        if (empSede !== selectedBranch) return false;
      }

      // 3. Cargo
      if (selectedCargo !== 'TODOS') {
        const empCargo = emp.funcao || emp.cargo;
        if (empCargo !== selectedCargo) return false;
      }

      // 4. Apenas com registros no mês
      if (onlyWithRecords) {
        const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        const hasRec = insalubrityRecords.some(
          r => r.matricula.trim().toUpperCase() === emp.matricula.trim().toUpperCase() && r.dataEvento.startsWith(monthPrefix)
        );
        if (!hasRec) return false;
      }

      return true;
    });
  }, [employees, searchQuery, selectedBranch, selectedCargo, onlyWithRecords, selectedYear, selectedMonth, insalubrityRecords]);

  // Estatísticas do Período Visível e do Mês
  const periodStats = useMemo(() => {
    let totalApontamentosPeriodo = 0;
    let totalApontamentosMes = 0;
    const colaboradoresComAtividadePeriodo = new Set<string>();

    const visibleDatesSet = new Set(visibleDays.map(d => d.formattedDate));

    filteredEmployees.forEach(emp => {
      allMonthDays.forEach(d => {
        const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
        const rec = recordsMap.get(key);
        if (rec) {
          totalApontamentosMes++;
          if (visibleDatesSet.has(d.formattedDate)) {
            totalApontamentosPeriodo++;
            colaboradoresComAtividadePeriodo.add(emp.matricula);
          }
        }
      });
    });

    const diasUteisPeriodo = visibleDays.filter(d => !d.isWeekend).length;

    return {
      totalApontamentosPeriodo,
      totalApontamentosMes,
      totalColaboradoresAtivosPeriodo: colaboradoresComAtividadePeriodo.size,
      diasUteisPeriodo,
    };
  }, [filteredEmployees, allMonthDays, visibleDays, recordsMap]);

  // Navegação de Mês
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  // Clique rápido em célula da matriz
  const handleCellClick = async (emp: Employee, dayMeta: typeof currentQuinzenaDays[0]) => {
    const key = `${emp.matricula.trim().toUpperCase()}_${dayMeta.formattedDate}`;
    const existing = recordsMap.get(key);

    if (existing) {
      // Abre diálogo para editar a atividade ou excluir o dia
      setCellEditTarget({ emp, dayMeta, record: existing });
    } else {
      // Cria apontamento rápido com a atividade selecionada
      const effectiveActivity = (activeActivity === 'OUTRA' && customActivityInput.trim()) 
        ? customActivityInput.trim().toUpperCase() 
        : activeActivity.toUpperCase();

      const newRec: InsalubrityRecord = {
        id: `ins-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        matricula: emp.matricula,
        nomeColaborador: emp.nome,
        sede: emp.sede_atual || emp.sede || 'KO',
        funcao: emp.funcao || emp.cargo || 'Operacional',
        dataEvento: dayMeta.formattedDate,
        atividadeDesempenhada: effectiveActivity || 'CONCRETO',
        grauExposicao: '20%', // Valor interno padrão para compatibilidade
        quantidadeHorasDias: 8,
        unidade: 'HORAS',
        responsavelLancamento: 'Encarregado de Campo',
        observacoes: `Lançamento Modo Simples - ${effectiveActivity}`,
        criadoEm: new Date().toISOString(),
        criadoPorEmail: currentUserEmail,
      };

      await onSaveRecord(newRec);
    }
  };

  // Lançamento em Lote para Dias Úteis da Quinzena
  const handleFillWeekdaysForEmployee = async (emp: Employee) => {
    const weekdays = currentQuinzenaDays.filter(d => !d.isWeekend);
    const toSave: InsalubrityRecord[] = [];

    const effectiveActivity = (activeActivity === 'OUTRA' && customActivityInput.trim()) 
      ? customActivityInput.trim().toUpperCase() 
      : activeActivity.toUpperCase();

    weekdays.forEach(d => {
      const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
      if (!recordsMap.has(key)) {
        toSave.push({
          id: `ins-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          matricula: emp.matricula,
          nomeColaborador: emp.nome,
          sede: emp.sede_atual || emp.sede || 'KO',
          funcao: emp.funcao || emp.cargo || 'Operacional',
          dataEvento: d.formattedDate,
          atividadeDesempenhada: effectiveActivity || 'CONCRETO',
          grauExposicao: '20%',
          quantidadeHorasDias: 8,
          unidade: 'HORAS',
          responsavelLancamento: 'Encarregado de Campo',
          observacoes: `Lote dias úteis ${currentPeriodLabel} ${MONTH_NAMES[selectedMonth]}/${selectedYear}`,
          criadoEm: new Date().toISOString(),
          criadoPorEmail: currentUserEmail,
        });
      }
    });

    if (toSave.length === 0) {
      alert(`Todos os dias úteis deste período já estão apontados para ${emp.nome}.`);
      return;
    }

    if (onSaveBatchRecords) {
      await onSaveBatchRecords(toSave);
    } else {
      for (const rec of toSave) {
        await onSaveRecord(rec);
      }
    }
  };

  // Limpar Todos os Registros da Quinzena/Período para um Colaborador
  const handleClearQuinzenaForEmployee = async (emp: Employee) => {
    const toDeleteIds: string[] = [];
    currentQuinzenaDays.forEach(d => {
      const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
      const rec = recordsMap.get(key);
      if (rec) {
        toDeleteIds.push(rec.id);
      }
    });

    if (toDeleteIds.length === 0) {
      alert(`Nenhum apontamento encontrado neste período para ${emp.nome}.`);
      return;
    }

    if (window.confirm(`Deseja remover todos os ${toDeleteIds.length} apontamentos de (${currentPeriodLabel}) de ${emp.nome}?`)) {
      for (const id of toDeleteIds) {
        await onDeleteRecord(id);
      }
    }
  };

  // Executar Lote Multi-Colaborador (Modo Simples)
  const handleExecuteMultiBatch = async () => {
    if (batchSelectedEmpIds.length === 0) {
      alert('Selecione ao menos um colaborador.');
      return;
    }

    if (!batchLaunchDate) {
      alert('Informe a data do lançamento.');
      return;
    }

    setIsSavingBatch(true);
    const toSave: InsalubrityRecord[] = [];
    const effectiveActivity = batchActivity.trim().toUpperCase() || 'CONCRETO';

    batchSelectedEmpIds.forEach(empMat => {
      const emp = employees.find(e => e.matricula === empMat);
      if (!emp) return;

      const key = `${emp.matricula.trim().toUpperCase()}_${batchLaunchDate}`;
      const existing = recordsMap.get(key);

      toSave.push({
        id: existing?.id || `ins-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        matricula: emp.matricula,
        nomeColaborador: emp.nome,
        sede: emp.sede_atual || emp.sede || 'KO',
        funcao: emp.funcao || emp.cargo || 'Operacional',
        dataEvento: batchLaunchDate,
        atividadeDesempenhada: effectiveActivity,
        grauExposicao: '20%',
        quantidadeHorasDias: 8,
        unidade: 'HORAS',
        responsavelLancamento: 'Encarregado de Campo',
        observacoes: `Lançamento ${effectiveActivity} - ${batchLaunchDate}`,
        criadoEm: existing?.criadoEm || new Date().toISOString(),
        criadoPorEmail: currentUserEmail,
      });
    });

    try {
      if (onSaveBatchRecords) {
        await onSaveBatchRecords(toSave);
      } else {
        for (const rec of toSave) {
          await onSaveRecord(rec);
        }
      }
      setIsBatchModalOpen(false);
      setBatchSelectedEmpIds([]);
      setBatchSearchQuery('');
    } catch (err: any) {
      alert(`Erro ao salvar lote: ${err?.message || 'Falha na gravação'}`);
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Exportar Planilha Oficial Simples COMARA em CSV (Sem Porcentagem)
  const handleExportOfficialSpreadsheetCSV = () => {
    const quinzenaLabel = currentPeriodLabel.toUpperCase();
    const headerRow1 = `COMISSAO DE AEROPORTOS DA REGIAO AMAZONICA - COMARA`;
    const headerRow2 = `CONTROLE DO EFETIVO - MODO SIMPLES - ${MONTH_NAMES[selectedMonth].toUpperCase()}/${selectedYear} - ${quinzenaLabel}`;
    const headerRow3 = `CANTEIRO/SEDE: ${selectedBranch} | GERADO EM: ${new Date().toLocaleDateString('pt-BR')}`;
    
    const dayHeaders = currentQuinzenaDays.map(d => `${d.dayNumber} (${d.weekdayInitial})`).join(';');
    const tableHeader = `No;MATRICULA;NOME DO COLABORADOR;FUNCAO / CARGO;${dayHeaders};TOTAL DE DIAS TRABALHADOS;SEDE`;

    const rows = filteredEmployees.map((emp, index) => {
      let markedCount = 0;

      const dayValues = currentQuinzenaDays.map(d => {
        const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
        const rec = recordsMap.get(key);
        if (rec) {
          markedCount++;
          return `"${(rec.atividadeDesempenhada || 'TRABALHO').replace(/"/g, '""')}"`;
        }
        return '';
      }).join(';');

      return `${index + 1};${emp.matricula};"${emp.nome.replace(/"/g, '""')}";"${(emp.funcao || emp.cargo || 'Operacional').replace(/"/g, '""')}";${dayValues};${markedCount};${emp.sede_atual || emp.sede || 'KO'}`;
    });

    const csvContent = '\uFEFF' + [headerRow1, headerRow2, headerRow3, '', tableHeader, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodFileSlug = periodViewMode.toLowerCase();
    link.download = `comara_efetivo_simples_${periodFileSlug}_${MONTH_NAMES[selectedMonth].toLowerCase()}_${selectedYear}_${selectedBranch}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------- */}
      {/* 1. CABEÇALHO INSTITUCIONAL COMARA & SELETOR DE MODO           */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-5 sm:p-6 rounded-2xl border shadow-xs transition-colors ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-red-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-amber-500">
                  COMARA • CONTROLE DE EFETIVO EM CAMPO
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  Modo Simples (Grade Quinzenal 15 Dias)
                </span>
              </div>
              <h1 className={`text-lg sm:text-xl font-bold tracking-tight mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Matriz Quinzenal de Serviços & Efetivo
              </h1>
              <p className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                Apontamento direto por atividade executada (sem porcentagens) em blocos de 15 dias
              </p>
            </div>
          </div>

          {/* Botões de Ação Superior */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botão de Conversão para Perfis Avançados */}
            {onOpenConversionModal && (userRole === 'SUPER_ADMIN' || userRole === 'GESTOR_RH' || userRole === 'GERENTE_CAMPO' || userRole === 'ROLE_GERENTE') && (
              <button
                onClick={onOpenConversionModal}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-blue-600 hover:from-amber-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-600/20 active:scale-98 cursor-pointer"
                title="Converter e classificar lançamentos do modo simples para enquadramento oficial NR-15 (10%, 20%, 40%)"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Converter p/ NR-15</span>
              </button>
            )}

            {onNavigateToReports && (
              <button
                onClick={onNavigateToReports}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-[#E0E2E5]' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title="Abrir Relatório do Modo Simples e Gerencial"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Relatório Simples</span>
              </button>
            )}

            {onSwitchToCompleteMode && (
              <button
                onClick={onSwitchToCompleteMode}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-[#E0E2E5]' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title="Alternar para o Modo Detalhado NR-15"
              >
                <Settings2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Modo Completo (NR-15)</span>
              </button>
            )}

            {/* Botão de Importação de Planilha CSV de Campo */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-amber-600/20 active:scale-98 cursor-pointer"
              title="Importar Folha de Campo / Matriz de Apontamentos em CSV"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Importar Folha (CSV)</span>
            </button>

            <button
              onClick={() => {
                setBatchSelectedEmpIds(filteredEmployees.map(e => e.matricula));
                setIsBatchModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 active:scale-98 cursor-pointer"
              title="Lançar atividade em lote para colaboradores"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Lançamento em Lote</span>
            </button>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-[#E0E2E5]' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="Visualizar e Imprimir Folha Quinzenal de Campo"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>Imprimir Folha</span>
            </button>

            <button
              onClick={handleExportOfficialSpreadsheetCSV}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-[#E0E2E5]' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="Exportar Matriz Quinzenal em CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar (CSV)</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BARRA DE CONTROLES: NAVEGAÇÃO DE MÊS, QUINZENA, DIAS & FILTROS*/}
        {/* ------------------------------------------------------------- */}
        <div className={`mt-5 pt-4 border-t flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 ${
          isDark ? 'border-[#1F2229]' : 'border-slate-100'
        }`}>
          {/* Seletor de Mês, Ano e Período */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Navegação de Mês */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isDark ? 'border-[#1F2229] hover:bg-[#0D0F14] text-gray-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-2 ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}>
                <Calendar className="w-4 h-4 text-amber-500" />
                <span>{MONTH_NAMES[selectedMonth].toUpperCase()} / {selectedYear}</span>
              </div>

              <button
                onClick={handleNextMonth}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isDark ? 'border-[#1F2229] hover:bg-[#0D0F14] text-gray-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* SELETORES DE MODO DE PERÍODO */}
            <div className={`flex items-center p-1 rounded-xl border ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => handleSelectQuinzena('Q1')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodViewMode === 'Q1'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1ª Quinzena (1-15)
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuinzena('Q2')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodViewMode === 'Q2'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2ª Quinzena (16-{daysInMonth})
              </button>
              <button
                type="button"
                onClick={handleSelectFullMonth}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodViewMode === 'FULL'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mês Completo (1-{daysInMonth})
              </button>
            </div>

            {/* CONTROLES DE MOVIMENTAÇÃO DE DIAS (DESLIZAR / AVANÇAR / VOLTAR) */}
            <div className={`flex items-center gap-1 p-1 rounded-xl border ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => handleShiftDays(-5)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  isDark ? 'hover:bg-[#1A1D24] text-gray-300' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Voltar 5 dias"
              >
                ◀◀ -5d
              </button>
              <button
                type="button"
                onClick={() => handleShiftDays(-1)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  isDark ? 'hover:bg-[#1A1D24] text-gray-300' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Voltar 1 dia"
              >
                ◀ -1d
              </button>

              <div className="px-2 text-[10px] font-mono font-bold text-amber-500 whitespace-nowrap">
                {visibleDays.length > 0 ? `Dias ${visibleDays[0].dayNumber} - ${visibleDays[visibleDays.length - 1].dayNumber}` : ''}
              </div>

              <button
                type="button"
                onClick={() => handleShiftDays(1)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  isDark ? 'hover:bg-[#1A1D24] text-gray-300' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Avançar 1 dia"
              >
                +1d ▶
              </button>
              <button
                type="button"
                onClick={() => handleShiftDays(5)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  isDark ? 'hover:bg-[#1A1D24] text-gray-300' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title="Avançar 5 dias"
              >
                +5d ▶▶
              </button>
            </div>
          </div>

          {/* Filtros da Matriz */}
          <div className="flex items-center gap-2.5 flex-wrap w-full xl:w-auto">
            {/* Busca Colaborador */}
            <div className="relative flex-1 md:w-48">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar colaborador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs outline-hidden ${
                  isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white focus:border-amber-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500'
                }`}
              />
            </div>

            {/* Sede / Canteiro Unificado */}
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className={`px-3 py-1.5 rounded-xl border text-xs outline-hidden font-medium ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="TODAS">Todas as Sedes / Canteiros</option>
              <option value="KO">KO - Coari</option>
              <option value="BE">BE - Belém</option>
              <option value="MN">MN - Manaus</option>
              <option value="SP">SP - São Paulo</option>
              <option value="RJ">RJ - Rio de Janeiro</option>
              {constructionSites.map(cs => {
                const code = cs.code || cs.codigo || cs.branch || cs.sede;
                if (['KO', 'BE', 'MN', 'SP', 'RJ'].includes(code)) return null;
                return (
                  <option key={cs.id} value={code}>
                    {cs.name || cs.nome} ({code})
                  </option>
                );
              })}
            </select>

            {/* Cargo */}
            <select
              value={selectedCargo}
              onChange={(e) => setSelectedCargo(e.target.value)}
              className={`px-3 py-1.5 rounded-xl border text-xs outline-hidden font-medium ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="TODOS">Todas as Funções</option>
              {availableCargos.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Checkbox Apenas com Registros */}
            <label className={`flex items-center gap-1.5 text-xs cursor-pointer font-medium select-none ${
              isDark ? 'text-gray-300' : 'text-slate-700'
            }`}>
              <input
                type="checkbox"
                checked={onlyWithRecords}
                onChange={(e) => setOnlyWithRecords(e.target.checked)}
                className="rounded text-amber-500 focus:ring-0"
              />
              <span>Com lançamentos</span>
            </label>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BARRA DE ATIVIDADE ATIVA (CLIQUE RÁPIDO)                      */}
        {/* ------------------------------------------------------------- */}
        <div className={`mt-4 pt-3 border-t flex flex-wrap items-center gap-2 ${
          isDark ? 'border-[#1F2229]' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 mr-1">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Serviço / Atividade para Apontar:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {DEFAULT_ACTIVITIES.slice(0, 6).map(act => (
              <button
                key={act}
                type="button"
                onClick={() => setActiveActivity(act)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activeActivity === act
                    ? 'bg-amber-500 text-black shadow-xs font-black ring-2 ring-amber-400/50'
                    : isDark
                      ? 'bg-[#0D0F14] text-gray-300 border border-[#1F2229] hover:bg-[#1A1D24]'
                      : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                {act}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setActiveActivity('OUTRA')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeActivity === 'OUTRA'
                  ? 'bg-amber-500 text-black shadow-xs font-black ring-2 ring-amber-400/50'
                  : isDark
                    ? 'bg-[#0D0F14] text-gray-300 border border-[#1F2229] hover:bg-[#1A1D24]'
                    : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              + Outra
            </button>

            {activeActivity === 'OUTRA' && (
              <input
                type="text"
                placeholder="Digitar nome da atividade..."
                value={customActivityInput}
                onChange={(e) => setCustomActivityInput(e.target.value.toUpperCase())}
                className={`px-2.5 py-1 rounded-lg text-xs uppercase font-bold border outline-hidden ${
                  isDark ? 'bg-[#0D0F14] border-amber-500 text-white' : 'bg-white border-amber-500 text-slate-900'
                }`}
                autoFocus
              />
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. CARDS RESUMO DO PERÍODO SELECIONADO                        */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            Efetivo Filtrado
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {filteredEmployees.length}
            </span>
            <span className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              colaboradores
            </span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            Dias Úteis no Período
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-xl font-bold text-amber-500`}>
              {periodStats.diasUteisPeriodo}
            </span>
            <span className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              de {visibleDays.length} dias
            </span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            Dias Trabalhados (Período)
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-xl font-bold text-emerald-500`}>
              {periodStats.totalApontamentosPeriodo}
            </span>
            <span className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              apontamentos
            </span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${
          isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
        }`}>
          <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            Efetivo com Atividade
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-xl font-bold text-blue-400`}>
              {periodStats.totalColaboradoresAtivosPeriodo}
            </span>
            <span className={`text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              de {filteredEmployees.length}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MATRIZ DE EFETIVO COM NAVEGAÇÃO DE DIAS & TOTAL FIXO       */}
      {/* ------------------------------------------------------------- */}
      <div className={`rounded-2xl border shadow-xs overflow-hidden ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <Layers className="w-4 h-4 text-amber-500" />
            <span className={isDark ? 'text-white' : 'text-slate-900'}>
              Grade de Serviços: {currentPeriodLabel} — {MONTH_NAMES[selectedMonth]} / {selectedYear}
            </span>
          </div>

          {/* Atalhos Rápidos para Movimentar Dias */}
          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            <div className="flex items-center gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleShiftDays(-1)}
                className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 border transition-colors cursor-pointer text-xs ${
                  isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-gray-200' : 'border-slate-300 hover:bg-slate-100 text-slate-700 bg-white'
                }`}
                title="Voltar 1 dia (Deslizar grade para esquerda)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Voltar Dia</span>
              </button>

              <button
                type="button"
                onClick={() => handleShiftDays(1)}
                className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 border transition-colors cursor-pointer text-xs ${
                  isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-gray-200' : 'border-slate-300 hover:bg-slate-100 text-slate-700 bg-white'
                }`}
                title="Avançar 1 dia (Deslizar grade para direita)"
              >
                <span>Avançar Dia</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <span className={`italic hidden sm:inline ${isDark ? 'text-[#8E9299]' : 'text-slate-400'}`}>
              * Clique na célula para apontar <strong>{activeActivity}</strong> ou editar
            </span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[620px] relative">
          <table className="w-full text-[11px] border-collapse text-left">
            <thead className={`sticky top-0 z-30 ${
              isDark ? 'bg-[#1F2229] text-[#E0E2E5]' : 'bg-slate-100 text-slate-800'
            }`}>
              <tr>
                {/* Colunas Fixas de Identificação (Esquerda) */}
                <th className="py-2.5 px-3 font-mono font-bold w-10 min-w-[40px] text-center border-r border-b border-black/10 dark:border-white/10 sticky left-0 z-40 bg-[#1F2229] dark:bg-[#1F2229] light:bg-slate-100">
                  Nº
                </th>
                <th className="py-2.5 px-3 font-bold min-w-[210px] max-w-[260px] border-r border-b border-black/10 dark:border-white/10 sticky left-10 z-40 bg-[#1F2229] dark:bg-[#1F2229] light:bg-slate-100">
                  COLABORADOR / MATRÍCULA
                </th>
                <th className="py-2.5 px-3 font-bold min-w-[140px] border-r border-b border-black/10 dark:border-white/10">
                  FUNÇÃO / CARGO
                </th>

                {/* Colunas dos Dias Selecionados (Centro - que deslizam livremente) */}
                {visibleDays.map(d => (
                  <th
                    key={d.dayNumber}
                    className={`py-2 px-1 font-mono text-center font-bold min-w-[46px] border-r border-b border-black/10 dark:border-white/10 ${
                      d.isWeekend ? (isDark ? 'bg-[#15171C] text-red-400' : 'bg-slate-200/70 text-red-600') : ''
                    }`}
                    title={`${d.dayNumber} de ${MONTH_NAMES[selectedMonth]} (${d.weekdayInitial})`}
                  >
                    <div className="text-[12px] font-black leading-tight">{d.dayNumber}</div>
                    <div className={`text-[9px] font-semibold ${d.isWeekend ? 'text-red-400 font-bold' : isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      {d.weekdayInitial}
                    </div>
                  </th>
                ))}

                {/* Colunas Finais: Total de Dias Trabalhados e Ações Rápidas (STICKY FIXO À DIREITA) */}
                <th className={`py-2.5 px-3 font-bold text-center w-[130px] min-w-[130px] border-l-2 border-r border-b border-amber-500/40 sticky right-[110px] z-40 ${
                  isDark ? 'bg-[#1F2229] text-white shadow-[-6px_0_12px_rgba(0,0,0,0.35)]' : 'bg-slate-100 text-slate-900 shadow-[-6px_0_12px_rgba(0,0,0,0.08)]'
                }`}>
                  TOTAL DIAS
                </th>
                <th className={`py-2.5 px-3 font-bold text-center w-[110px] min-w-[110px] border-b border-black/10 dark:border-white/10 sticky right-0 z-40 ${
                  isDark ? 'bg-[#1F2229] text-[#E0E2E5]' : 'bg-slate-100 text-slate-800'
                }`}>
                  AÇÕES RÁPIDAS
                </th>
              </tr>
            </thead>

            <tbody className={`divide-y font-mono ${
              isDark ? 'divide-[#1F2229] text-gray-300' : 'divide-slate-200 text-slate-700'
            }`}>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={visibleDays.length + 5} className="py-12 text-center text-xs text-gray-500 font-sans">
                    Nenhum colaborador encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, index) => {
                  let employeeVisibleDaysCount = 0;
                  let employeeMonthDaysCount = 0;

                  // Calcula contagem do período visível e do mês inteiro
                  allMonthDays.forEach(d => {
                    const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
                    if (recordsMap.has(key)) {
                      employeeMonthDaysCount++;
                    }
                  });

                  return (
                    <tr
                      key={emp.id || emp.matricula}
                      className={`transition-colors group ${
                        isDark ? 'hover:bg-[#1A1D24]' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* 1. Nº Sequencial */}
                      <td className={`py-2 px-2 text-center text-[10px] font-bold border-r border-black/5 dark:border-white/5 sticky left-0 z-20 ${
                        isDark ? 'bg-[#15171C] group-hover:bg-[#1A1D24]' : 'bg-white group-hover:bg-slate-50'
                      }`}>
                        {index + 1}
                      </td>

                      {/* 2. Nome e Matrícula */}
                      <td className={`py-2 px-3 border-r border-black/5 dark:border-white/5 sticky left-10 z-20 ${
                        isDark ? 'bg-[#15171C] group-hover:bg-[#1A1D24]' : 'bg-white group-hover:bg-slate-50'
                      }`}>
                        <div className="font-sans font-bold truncate max-w-[240px] text-xs" title={emp.nome}>
                          {emp.nome}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
                          <span>MAT: {emp.matricula}</span>
                          <span>•</span>
                          <span>{emp.sede_atual || emp.sede}</span>
                        </div>
                      </td>

                      {/* 3. Função */}
                      <td className="py-2 px-3 border-r border-black/5 dark:border-white/5 truncate max-w-[140px] font-sans text-xs" title={emp.funcao || emp.cargo}>
                        {emp.funcao || emp.cargo || 'Operacional'}
                      </td>

                      {/* 4. Células dos Dias Selecionados */}
                      {visibleDays.map(d => {
                        const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
                        const record = recordsMap.get(key);

                        if (record) {
                          employeeVisibleDaysCount++;
                        }

                        const activityText = record?.atividadeDesempenhada || '';
                        // Abreviação para caber elegante no grid
                        const shortCode = activityText.length > 4 ? activityText.substring(0, 4) : activityText;

                        return (
                          <td
                            key={d.dayNumber}
                            onClick={() => handleCellClick(emp, d)}
                            className={`py-1 px-0.5 text-center cursor-pointer select-none transition-colors border-r border-black/5 dark:border-white/5 ${
                              d.isWeekend 
                                ? (isDark ? 'bg-black/20 hover:bg-amber-500/20' : 'bg-slate-100/60 hover:bg-amber-100/60') 
                                : isDark ? 'hover:bg-amber-500/20' : 'hover:bg-amber-100/60'
                            }`}
                            title={
                              record 
                                ? `Dia ${d.dayNumber}/${selectedMonth + 1}: ${record.atividadeDesempenhada} (Clique para editar/remover)` 
                                : `Dia ${d.dayNumber}/${selectedMonth + 1}: Vazio (Clique para marcar ${activeActivity})`
                            }
                          >
                            {record ? (
                              <div className="mx-auto min-w-[34px] px-1 py-1 rounded-md bg-amber-500 text-black text-[9px] font-black tracking-tight leading-none truncate shadow-xs">
                                {shortCode || 'OK'}
                              </div>
                            ) : (
                              <div className="w-7 h-6 mx-auto rounded-md flex items-center justify-center text-transparent hover:text-gray-400 text-xs">
                                •
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* 5. Total de Dias Trabalhados (FIXO À DIREITA / STICKY) */}
                      <td className={`py-2 px-2 text-center font-bold text-xs border-l-2 border-r border-amber-500/40 sticky right-[110px] z-20 w-[130px] min-w-[130px] ${
                        isDark 
                          ? 'bg-[#15171C] group-hover:bg-[#1A1D24] shadow-[-6px_0_12px_rgba(0,0,0,0.35)]' 
                          : 'bg-white group-hover:bg-slate-50 shadow-[-6px_0_12px_rgba(0,0,0,0.08)]'
                      }`}>
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                            employeeVisibleDaysCount > 0 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : isDark ? 'text-gray-500' : 'text-slate-400'
                          }`}>
                            {employeeVisibleDaysCount} {employeeVisibleDaysCount === 1 ? 'dia' : 'dias'}
                          </span>
                          {periodViewMode !== 'FULL' && (
                            <span className={`text-[9px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                              Mês: <strong>{employeeMonthDaysCount}d</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Ações Rápidas por Linha (FIXO À DIREITA / STICKY) */}
                      <td className={`py-1 px-2 text-center sticky right-0 z-20 w-[110px] min-w-[110px] border-b border-black/5 dark:border-white/5 ${
                        isDark ? 'bg-[#15171C] group-hover:bg-[#1A1D24]' : 'bg-white group-hover:bg-slate-50'
                      }`}>
                        <div className="flex items-center justify-center gap-1 font-sans">
                          <button
                            onClick={() => handleFillWeekdaysForEmployee(emp)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              isDark 
                                ? 'bg-blue-950/40 text-blue-300 border-blue-800/50 hover:bg-blue-900/60' 
                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            }`}
                            title="Preencher todos os dias úteis deste período"
                          >
                            + Úteis
                          </button>

                          {employeeMonthDaysCount > 0 && (
                            <button
                              onClick={() => handleClearQuinzenaForEmployee(emp)}
                              className={`p-1 rounded-lg text-[10px] border transition-colors cursor-pointer ${
                                isDark 
                                ? 'text-red-400 border-red-900/40 hover:bg-red-950/40' 
                                : 'text-red-600 border-red-200 hover:bg-red-50'
                              }`}
                              title="Limpar apontamentos deste período"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 4. MODAL DE EDIÇÃO/DETALHES DE UMA CÉLULA ESPECÍFICA          */}
      {/* ============================================================= */}
      {cellEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 ${
            isDark ? 'bg-[#15171C] border-[#1F2229] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm">
                  Apontamento — Dia {cellEditTarget.dayMeta.dayNumber} de {MONTH_NAMES[selectedMonth]}
                </h3>
              </div>
              <button
                onClick={() => setCellEditTarget(null)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#1F2229] text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Colaborador:</span>
                <div className="font-bold text-sm">{cellEditTarget.emp.nome}</div>
                <div className="text-gray-400 font-mono text-[11px]">MAT: {cellEditTarget.emp.matricula} • {cellEditTarget.emp.funcao || cellEditTarget.emp.cargo}</div>
              </div>

              <div>
                <label className="block font-bold mb-1 uppercase text-[10px] text-gray-400">
                  Serviço / Atividade Realizada:
                </label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {DEFAULT_ACTIVITIES.slice(0, 6).map(act => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => {
                        if (cellEditTarget.record) {
                          onSaveRecord({
                            ...cellEditTarget.record,
                            atividadeDesempenhada: act,
                          });
                        }
                        setCellEditTarget(null);
                      }}
                      className={`p-2 rounded-xl text-left font-bold text-xs border transition-colors cursor-pointer ${
                        cellEditTarget.record?.atividadeDesempenhada === act
                          ? 'bg-amber-500 text-black border-amber-400'
                          : isDark ? 'border-[#1F2229] hover:bg-[#1F2229] text-gray-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
              {cellEditTarget.record && (
                <button
                  type="button"
                  onClick={async () => {
                    if (cellEditTarget.record) {
                      await onDeleteRecord(cellEditTarget.record.id);
                    }
                    setCellEditTarget(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-800/50 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover Dia</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCellEditTarget(null)}
                className={`px-4 py-2 rounded-xl border font-bold text-xs ml-auto ${
                  isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-gray-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 5. MODAL DE LANÇAMENTO EM LOTE (SEM PORCENTAGEM)               */}
      {/* ============================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`w-full max-w-2xl p-6 rounded-2xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 ${
            isDark ? 'bg-[#15171C] border-[#1F2229] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base">Lançamento em Lote de Atividades (Modo Simples)</h3>
              </div>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#1F2229] text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. Data do Lançamento */}
              <div>
                <label className="block font-bold mb-1.5 uppercase text-[10px] text-gray-400">
                  1. Data do Lançamento:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={batchLaunchDate}
                    onChange={(e) => setBatchLaunchDate(e.target.value)}
                    className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold outline-none cursor-pointer ${
                      isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white focus:border-amber-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-600'
                    }`}
                  />
                  <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    {batchLaunchDate ? new Date(batchLaunchDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                  </span>
                </div>
              </div>

              {/* 2. Serviço / Atividade */}
              <div>
                <label className="block font-bold mb-1.5 uppercase text-[10px] text-gray-400">
                  2. Serviço / Atividade a ser atribuída:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {DEFAULT_ACTIVITIES.map(act => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setBatchActivity(act)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        batchActivity === act
                          ? 'bg-amber-500 text-black shadow-xs font-black'
                          : isDark ? 'bg-[#0D0F14] border border-[#1F2229] text-gray-300' : 'bg-slate-100 border border-slate-200 text-slate-700'
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={batchActivity}
                  onChange={(e) => setBatchActivity(e.target.value.toUpperCase())}
                  placeholder="Ou digite o nome do serviço (ex: CANALETA, ASFALTO...)"
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-hidden uppercase font-bold ${
                    isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* 3. Seleção de Colaboradores com Busca Rápida */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold uppercase text-[10px] text-gray-400">
                    3. Colaboradores Alvo ({batchSelectedEmpIds.length} selecionados):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const targetList = filteredEmployees.filter(e => {
                          const q = batchSearchQuery.trim().toLowerCase();
                          if (!q) return true;
                          return e.nome.toLowerCase().includes(q) || e.matricula.toLowerCase().includes(q);
                        });
                        const idsToAdd = targetList.map(e => e.matricula);
                        setBatchSelectedEmpIds(Array.from(new Set([...batchSelectedEmpIds, ...idsToAdd])));
                      }}
                      className="text-[11px] text-blue-400 hover:underline cursor-pointer font-bold"
                    >
                      Marcar Filtrados ({filteredEmployees.filter(e => {
                        const q = batchSearchQuery.trim().toLowerCase();
                        if (!q) return true;
                        return e.nome.toLowerCase().includes(q) || e.matricula.toLowerCase().includes(q);
                      }).length})
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setBatchSelectedEmpIds([])}
                      className="text-[11px] text-red-400 hover:underline cursor-pointer font-bold"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                {/* Campo de Busca Rápida no Modal */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    placeholder="🔍 Buscar por nome ou matrícula..."
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-white placeholder-gray-500 focus:border-amber-500' 
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-600'
                    }`}
                  />
                </div>

                <div className={`max-h-48 overflow-y-auto p-2 rounded-xl border divide-y ${
                  isDark ? 'bg-[#0D0F14] border-[#1F2229] divide-[#1F2229]' : 'bg-slate-50 border-slate-200 divide-slate-200'
                }`}>
                  {filteredEmployees
                    .filter(emp => {
                      const q = batchSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return emp.nome.toLowerCase().includes(q) || emp.matricula.toLowerCase().includes(q);
                    })
                    .map(emp => (
                      <label key={emp.matricula} className="flex items-center gap-2 py-1 px-1 cursor-pointer hover:bg-black/10 dark:hover:bg-white/5 rounded">
                        <input
                          type="checkbox"
                          checked={batchSelectedEmpIds.includes(emp.matricula)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBatchSelectedEmpIds([...batchSelectedEmpIds, emp.matricula]);
                            } else {
                              setBatchSelectedEmpIds(batchSelectedEmpIds.filter(m => m !== emp.matricula));
                            }
                          }}
                          className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="font-mono text-[11px] text-amber-400 font-bold">{emp.matricula}</span>
                        <span className="font-sans font-bold text-xs truncate max-w-xs">{emp.nome}</span>
                        <span className="text-gray-400 text-[10px]">({emp.funcao || emp.cargo})</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className={`px-4 py-2 rounded-xl border font-bold text-xs ${
                  isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-gray-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteMultiBatch}
                disabled={isSavingBatch || batchSelectedEmpIds.length === 0}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-md shadow-amber-600/20 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isSavingBatch ? 'Gravando no Firestore...' : `Gravar para ${batchSelectedEmpIds.length} Colaboradores`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 6. MODAL DE IMPRESSÃO QUINZENAL OFICIAL COMARA                */}
      {/* ============================================================= */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white text-black p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b mb-4 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-gray-900">Folha de Impressão Quinzenal COMARA (Modo Simples)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Agora (Ctrl+P)</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Documento Formatado para Impressão */}
            <div className="overflow-y-auto flex-1 font-sans text-xs p-2 space-y-4">
              {/* Cabeçalho Oficial da COMARA com Logo e Dados Institucionais */}
              <div className="border-b pb-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ComaraLogo size="print" theme="light" />
                  <div className="text-left space-y-0.5">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-gray-700">
                      COMANDO DA AERONÁUTICA • DEPARTAMENTO DE CONTROLE DO ESPAÇO AÉREO
                    </div>
                    <div className="text-xs sm:text-sm font-black tracking-tight text-gray-900 uppercase">
                      COMISSÃO DE AEROPORTOS DA REGIÃO AMAZÔNICA — COMARA
                    </div>
                    <div className="text-xs font-bold text-blue-900 uppercase">
                      PLANILHA DE EFETIVO EM CAMPO & ATIVIDADES — {currentPeriodLabel.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="text-right text-[10px] font-mono text-gray-600 space-y-0.5 shrink-0">
                  <div>MÊS/ANO: <strong>{MONTH_NAMES[selectedMonth].toUpperCase()} / {selectedYear}</strong></div>
                  <div>CANTEIRO/SEDE: <strong>{selectedBranch}</strong></div>
                  <div>EMISSÃO: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></div>
                </div>
              </div>

              {/* Tabela de Efetivo Quinzenal */}
              <table className="w-full text-[10px] border-collapse border border-gray-400">
                <thead>
                  <tr className="bg-gray-100 text-gray-900">
                    <th className="border border-gray-400 p-1 w-8 text-center">Nº</th>
                    <th className="border border-gray-400 p-1 text-left min-w-[150px]">NOME DO COLABORADOR</th>
                    <th className="border border-gray-400 p-1 text-left">MAT.</th>
                    <th className="border border-gray-400 p-1 text-left">FUNÇÃO</th>
                    {currentQuinzenaDays.map(d => (
                      <th key={d.dayNumber} className={`border border-gray-400 p-0.5 text-center w-6 ${d.isWeekend ? 'bg-gray-200' : ''}`}>
                        <div>{d.dayNumber}</div>
                        <div className="text-[8px] font-normal">{d.weekdayInitial}</div>
                      </th>
                    ))}
                    <th className="border border-gray-400 p-1 text-center min-w-[60px]">TOTAL DE DIAS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, idx) => {
                    let totalDays = 0;

                    return (
                      <tr key={emp.matricula} className="hover:bg-gray-50">
                        <td className="border border-gray-400 p-1 text-center font-mono">{idx + 1}</td>
                        <td className="border border-gray-400 p-1 font-bold truncate max-w-[170px]">{emp.nome}</td>
                        <td className="border border-gray-400 p-1 font-mono text-[9px]">{emp.matricula}</td>
                        <td className="border border-gray-400 p-1 truncate max-w-[110px]">{emp.funcao || emp.cargo}</td>
                        {currentQuinzenaDays.map(d => {
                          const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
                          const rec = recordsMap.get(key);
                          if (rec) {
                            totalDays++;
                          }
                          const act = rec?.atividadeDesempenhada || '';
                          const code = act.length > 4 ? act.substring(0, 4) : act;
                          return (
                            <td key={d.dayNumber} className={`border border-gray-400 p-0.5 text-center font-bold text-[8px] ${d.isWeekend ? 'bg-gray-100' : ''}`}>
                              {code}
                            </td>
                          );
                        })}
                        <td className="border border-gray-400 p-1 text-center font-bold font-mono">{totalDays}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Blocos de Assinatura Oficiais COMARA */}
              {(() => {
                const branchCode = selectedBranch === 'TODAS' ? 'KO' : selectedBranch;
                const sigs = getSignaturesForCanteiro(branchCode, constructionSites);
                return (
                  <div className="pt-8 grid grid-cols-3 gap-8 text-center text-[10px] print-avoid-break">
                    <div className="space-y-1">
                      <div className="border-t border-gray-800 pt-1 font-bold">
                        {sigs.assinatura1.titulo}
                      </div>
                      <div className="font-semibold text-gray-900 text-[10px]">{sigs.assinatura1.nome}</div>
                      <div className="text-gray-500 text-[9px]">{sigs.assinatura1.subtitulo}</div>
                    </div>

                    <div className="space-y-1">
                      <div className="border-t border-gray-800 pt-1 font-bold">
                        {sigs.assinatura2.titulo}
                      </div>
                      <div className="font-semibold text-gray-900 text-[10px]">{sigs.assinatura2.nome}</div>
                      <div className="text-gray-500 text-[9px]">{sigs.assinatura2.subtitulo}</div>
                    </div>

                    <div className="space-y-1">
                      <div className="border-t border-gray-800 pt-1 font-bold">
                        {sigs.assinatura3.titulo}
                      </div>
                      <div className="font-semibold text-gray-900 text-[10px]">{sigs.assinatura3.nome}</div>
                      <div className="text-gray-500 text-[9px]">{sigs.assinatura3.subtitulo}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Modal de Importação de Matriz de Campo CSV */}
      <ImportInsalubrityMatrixModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        employees={employees}
        constructionSites={constructionSites}
        onImportInsalubrityBatch={handleImportMatrixBatch}
        theme={theme}
        currentUserEmail={currentUserEmail}
      />
    </div>
  );
};
