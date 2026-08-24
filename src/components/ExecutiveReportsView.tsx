import React, { useState, useMemo, useRef } from 'react';
import { Employee, TimeRecord, InsalubrityRecord, Branch, SystemConfig } from '../types';
import { getEmployeeTotalBalance, formatHoursDecimal, formatHoursToDays } from '../utils/calculations';
import { ComaraLogo } from './ComaraLogo';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Calendar, 
  Filter, 
  Search, 
  Building2, 
  Clock, 
  ShieldAlert, 
  FileText, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  HardHat,
  Sparkles,
  ChevronDown
} from 'lucide-react';

interface ExecutiveReportsViewProps {
  employees: Employee[];
  records: TimeRecord[];
  insalubrityRecords: InsalubrityRecord[];
  systemConfig?: SystemConfig;
  currentUserEmail?: string;
  theme?: 'dark' | 'light';
}

type ReportType = 'BANCO_HORAS' | 'INSALUBRIDADE' | 'CONSOLIDADO_GERAL';

export const ExecutiveReportsView: React.FC<ExecutiveReportsViewProps> = ({
  employees,
  records,
  insalubrityRecords,
  systemConfig,
  currentUserEmail = 'coari.comara@gmail.com',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const printRef = useRef<HTMLDivElement>(null);

  // Período Padrão: Mês atual
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [reportType, setReportType] = useState<ReportType>('BANCO_HORAS');
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);
  const [selectedBranch, setSelectedBranch] = useState<string>('TODAS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');

  // -------------------------------------------------------------
  // PRESET RÁPIDO DE DATAS
  // -------------------------------------------------------------
  const applyDatePreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | 'YEAR_TO_DATE' | 'ALL_TIME') => {
    const now = new Date();
    if (preset === 'THIS_MONTH') {
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
      setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
    } else if (preset === 'LAST_MONTH') {
      setStartDate(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]);
      setEndDate(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]);
    } else if (preset === 'YEAR_TO_DATE') {
      setStartDate(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]);
      setEndDate(new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]);
    } else if (preset === 'ALL_TIME') {
      setStartDate('2020-01-01');
      setEndDate(new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0]);
    }
  };

  // -------------------------------------------------------------
  // FUNÇÕES AUXILIARES DE TRATAMENTO DE REGISTROS E DATAS
  // -------------------------------------------------------------
  const normalizeDateStr = (raw: string | undefined): string => {
    if (!raw) return '';
    const clean = raw.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('/');
      return `${y}-${m}-${d}`;
    }
    return clean.split('T')[0];
  };

  const getRecordDate = (r: TimeRecord): string => {
    return normalizeDateStr(r.dataRegistro || r.data_ocorrencia || (r as any).data || (r as any).date || r.criadoEm);
  };

  const matchRecordToEmployee = (r: TimeRecord, emp: Employee): boolean => {
    const cleanEmpMat = (emp.matricula || '').trim().toUpperCase();
    const cleanEmpMatNoZero = cleanEmpMat.replace(/^0+/, '');
    
    const cleanRecMat = (r.matricula || '').trim().toUpperCase();
    const cleanRecMatNoZero = cleanRecMat.replace(/^0+/, '');
    
    if (cleanRecMat && cleanEmpMat && (cleanRecMat === cleanEmpMat || cleanRecMatNoZero === cleanEmpMatNoZero)) {
      return true;
    }
    if ((r as any).employeeId && (r as any).employeeId === emp.id) {
      return true;
    }
    return false;
  };

  const extractRecordImpact = (r: TimeRecord) => {
    let saldo = Number(r.saldoCalculado);
    const horasBrutas = Number(r.horasBrutas) || 0;
    const mult = Number(r.multiplicador) || 1;

    // Fallback caso saldoCalculado não esteja computado
    if (isNaN(saldo) || (saldo === 0 && (horasBrutas > 0 || (r as any).horasExtras50 || (r as any).horasExtras100))) {
      if (r.tipoOcorrencia === 'TRABALHO' && horasBrutas > 0) {
        saldo = horasBrutas * mult;
      } else if (r.tipoOcorrencia === 'COMPENSACAO' || r.tipoOcorrencia === 'DISPENSA_OPERACIONAL') {
        saldo = -(horasBrutas > 0 ? horasBrutas : 8.0);
      } else if (Number((r as any).horasExtras50) > 0 || Number((r as any).horasExtras100) > 0) {
        saldo = (Number((r as any).horasExtras50) || 0) + (Number((r as any).horasExtras100) || 0);
      } else if (Number((r as any).folgasCompensatorias) > 0 || Number((r as any).horasAtrasoFalta) > 0) {
        saldo = -((Number((r as any).folgasCompensatorias) || 0) + (Number((r as any).horasAtrasoFalta) || 0));
      }
    }

    let credit = 0;
    let debit = 0;
    let he50 = 0;
    let he100 = 0;
    let folgas = 0;
    let atrasos = 0;

    if (saldo > 0) {
      credit = saldo;
      if (mult === 2.0 || r.eFeriado || r.diaSemana === 0 || Number((r as any).horasExtras100) > 0) {
        he100 = saldo;
      } else if (mult === 1.5 || r.diaSemana === 6 || Number((r as any).horasExtras50) > 0) {
        he50 = saldo;
      } else {
        he50 = saldo;
      }
    } else if (saldo < 0) {
      debit = Math.abs(saldo);
      if (r.tipoOcorrencia === 'COMPENSACAO' || r.tipoOcorrencia === 'DISPENSA_OPERACIONAL' || Number((r as any).folgasCompensatorias) > 0) {
        folgas = Math.abs(saldo);
      } else {
        atrasos = Math.abs(saldo);
      }
    }

    return { credit, debit, he50, he100, folgas, atrasos, saldo };
  };

  // -------------------------------------------------------------
  // PROCESSAMENTO: DADOS DE BANCO DE HORAS POR PERÍODO
  // -------------------------------------------------------------
  const bancoHorasData = useMemo(() => {
    return employees
      .filter((emp) => {
        if (selectedBranch !== 'TODAS' && (emp.sede_atual || emp.sede) !== selectedBranch) return false;
        if (selectedStatus !== 'TODOS' && emp.status !== selectedStatus) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = emp.nome.toLowerCase().includes(q);
          const matchMat = emp.matricula.toLowerCase().includes(q);
          const matchFunc = (emp.funcao || emp.cargo || '').toLowerCase().includes(q);
          if (!matchName && !matchMat && !matchFunc) return false;
        }
        return true;
      })
      .map((emp) => {
        // Encontrar todos os registros do colaborador
        const empRecords = records.filter((r) => matchRecordToEmployee(r, emp));

        // 1. Saldo Anterior (registros com data anterior a startDate)
        const priorRecords = empRecords.filter((r) => {
          const d = getRecordDate(r);
          return d && d < startDate;
        });

        const priorCredits = priorRecords.reduce((sum, r) => sum + extractRecordImpact(r).credit, 0);
        const priorDebits = priorRecords.reduce((sum, r) => sum + extractRecordImpact(r).debit, 0);
        const saldoAnterior = (Number(emp.saldoInicialHoras) || 0) + priorCredits - priorDebits;

        // 2. Movimentação no Período Selecionado (startDate <= data <= endDate)
        const periodRecords = empRecords.filter((r) => {
          const d = getRecordDate(r);
          return d && d >= startDate && d <= endDate;
        });

        let he50Periodo = 0;
        let he100Periodo = 0;
        let creditosPeriodo = 0;
        let folgasPeriodo = 0;
        let atrasosPeriodo = 0;
        let debitosPeriodo = 0;

        periodRecords.forEach((r) => {
          const impact = extractRecordImpact(r);
          he50Periodo += impact.he50;
          he100Periodo += impact.he100;
          creditosPeriodo += impact.credit;
          folgasPeriodo += impact.folgas;
          atrasosPeriodo += impact.atrasos;
          debitosPeriodo += impact.debit;
        });

        const saldoPeriodo = creditosPeriodo - debitosPeriodo;

        // 3. Saldo Final Consolidado (Saldo Anterior + Saldo Período)
        const saldoFinalHoras = saldoAnterior + saldoPeriodo;
        const saldoFinalDias = saldoFinalHoras / 8.8; // 8.8h padrão jornada operacional COMARA

        return {
          matricula: emp.matricula,
          nome: emp.nome,
          sede: emp.sede_atual || emp.sede,
          funcao: emp.funcao || emp.cargo || 'Operacional',
          status: emp.status,
          saldoAnterior,
          he50Periodo,
          he100Periodo,
          creditosPeriodo,
          folgasPeriodo,
          atrasosPeriodo,
          debitosPeriodo,
          saldoPeriodo,
          saldoFinalHoras,
          saldoFinalDias,
          totalRegistrosPeriodo: periodRecords.length,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [employees, records, startDate, endDate, selectedBranch, selectedStatus, searchQuery]);

  // Totais do Banco de Horas
  const totalBancoHoras = useMemo(() => {
    return bancoHorasData.reduce(
      (acc, curr) => ({
        saldoAnterior: acc.saldoAnterior + curr.saldoAnterior,
        creditosPeriodo: acc.creditosPeriodo + curr.creditosPeriodo,
        debitosPeriodo: acc.debitosPeriodo + curr.debitosPeriodo,
        saldoPeriodo: acc.saldoPeriodo + curr.saldoPeriodo,
        saldoFinalHoras: acc.saldoFinalHoras + curr.saldoFinalHoras,
        credorCount: acc.credorCount + (curr.saldoFinalHoras > 0.05 ? 1 : 0),
        devedorCount: acc.devedorCount + (curr.saldoFinalHoras < -0.05 ? 1 : 0),
        zeradoCount: acc.zeradoCount + (Math.abs(curr.saldoFinalHoras) <= 0.05 ? 1 : 0),
      }),
      {
        saldoAnterior: 0,
        creditosPeriodo: 0,
        debitosPeriodo: 0,
        saldoPeriodo: 0,
        saldoFinalHoras: 0,
        credorCount: 0,
        devedorCount: 0,
        zeradoCount: 0,
      }
    );
  }, [bancoHorasData]);

  // -------------------------------------------------------------
  // PROCESSAMENTO: DADOS DE INSALUBRIDADE POR PERÍODO
  // -------------------------------------------------------------
  const insalubridadeData = useMemo(() => {
    return employees
      .filter((emp) => {
        if (selectedBranch !== 'TODAS' && (emp.sede_atual || emp.sede) !== selectedBranch) return false;
        if (selectedStatus !== 'TODOS' && emp.status !== selectedStatus) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = emp.nome.toLowerCase().includes(q);
          const matchMat = emp.matricula.toLowerCase().includes(q);
          if (!matchName && !matchMat) return false;
        }
        return true;
      })
      .map((emp) => {
        const cleanEmpMat = (emp.matricula || '').trim().toUpperCase();
        const cleanEmpMatNoZero = cleanEmpMat.replace(/^0+/, '');

        const empInsalubrity = insalubrityRecords.filter((r) => {
          const rMat = (r.matricula || '').trim().toUpperCase();
          const rMatNoZero = rMat.replace(/^0+/, '');
          const matchMat = rMat && (rMat === cleanEmpMat || rMatNoZero === cleanEmpMatNoZero);
          const rDate = normalizeDateStr(r.dataEvento);
          return matchMat && rDate >= startDate && rDate <= endDate;
        });

        const horas40 = empInsalubrity
          .filter(r => r.grauExposicao === '40%' && r.unidade === 'HORAS')
          .reduce((sum, r) => sum + (Number(r.quantidadeHorasDias) || 0), 0);

        const horas20 = empInsalubrity
          .filter(r => r.grauExposicao === '20%' && r.unidade === 'HORAS')
          .reduce((sum, r) => sum + (Number(r.quantidadeHorasDias) || 0), 0);

        const horas10 = empInsalubrity
          .filter(r => r.grauExposicao === '10%' && r.unidade === 'HORAS')
          .reduce((sum, r) => sum + (Number(r.quantidadeHorasDias) || 0), 0);

        const diasAtividade = empInsalubrity
          .filter(r => r.unidade === 'DIAS')
          .reduce((sum, r) => sum + (Number(r.quantidadeHorasDias) || 0), 0);

        const totalHorasAtividade = horas40 + horas20 + horas10;
        const atividadesUnicas = Array.from(new Set(empInsalubrity.map(r => r.atividadeDesempenhada)));

        return {
          matricula: emp.matricula,
          nome: emp.nome,
          sede: emp.sede_atual || emp.sede,
          funcao: emp.funcao || emp.cargo || 'Operacional',
          grauFixo: emp.grauInsalubridadeFixa || 'ISENTO',
          horas40,
          horas20,
          horas10,
          totalHorasAtividade,
          diasAtividade,
          totalApontamentos: empInsalubrity.length,
          atividadesDescricao: atividadesUnicas.join('; ') || 'Sem apontamento no período',
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [employees, insalubrityRecords, startDate, endDate, selectedBranch, selectedStatus, searchQuery]);

  // Totais de Insalubridade
  const totalInsalubridade = useMemo(() => {
    return insalubridadeData.reduce(
      (acc, curr) => ({
        totalFixoComAdicional: acc.totalFixoComAdicional + (curr.grauFixo !== 'ISENTO' ? 1 : 0),
        totalHoras40: acc.totalHoras40 + curr.horas40,
        totalHoras20: acc.totalHoras20 + curr.horas20,
        totalHoras10: acc.totalHoras10 + curr.horas10,
        totalHorasGeral: acc.totalHorasGeral + curr.totalHorasAtividade,
        totalDiasGeral: acc.totalDiasGeral + curr.diasAtividade,
        totalApontamentos: acc.totalApontamentos + curr.totalApontamentos,
      }),
      {
        totalFixoComAdicional: 0,
        totalHoras40: 0,
        totalHoras20: 0,
        totalHoras10: 0,
        totalHorasGeral: 0,
        totalDiasGeral: 0,
        totalApontamentos: 0,
      }
    );
  }, [insalubridadeData]);

  // -------------------------------------------------------------
  // EXPORTAÇÃO EXCEL (CSV FORMATADO BR)
  // -------------------------------------------------------------
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = '';

    if (reportType === 'BANCO_HORAS') {
      filename = `relatorio_banco_horas_${startDate}_a_${endDate}.csv`;
      headers = [
        'Matrícula',
        'Colaborador',
        'Sede',
        'Função/Cargo',
        'Status',
        'Saldo Anterior (h)',
        'HE 50% (h)',
        'HE 100% (h)',
        'Total Créditos (h)',
        'Folgas Compensatórias (h)',
        'Atrasos/Faltas (h)',
        'Total Débitos (h)',
        'Resultado Período (h)',
        'Saldo Final (h)',
        'Saldo Final (Dias 8.8h)',
        'Situação Banco',
      ];

      rows = bancoHorasData.map((item) => [
        `"${item.matricula}"`,
        `"${item.nome}"`,
        `"${item.sede}"`,
        `"${item.funcao}"`,
        `"${item.status}"`,
        item.saldoAnterior.toFixed(2).replace('.', ','),
        item.he50Periodo.toFixed(2).replace('.', ','),
        item.he100Periodo.toFixed(2).replace('.', ','),
        item.creditosPeriodo.toFixed(2).replace('.', ','),
        item.folgasPeriodo.toFixed(2).replace('.', ','),
        item.atrasosPeriodo.toFixed(2).replace('.', ','),
        item.debitosPeriodo.toFixed(2).replace('.', ','),
        item.saldoPeriodo.toFixed(2).replace('.', ','),
        item.saldoFinalHoras.toFixed(2).replace('.', ','),
        item.saldoFinalDias.toFixed(2).replace('.', ','),
        item.saldoFinalHoras > 0.05 ? 'CREDOR' : item.saldoFinalHoras < -0.05 ? 'DEVEDOR' : 'ZERADO',
      ]);
    } else {
      filename = `relatorio_insalubridade_${startDate}_a_${endDate}.csv`;
      headers = [
        'Matrícula',
        'Colaborador',
        'Sede',
        'Função/Cargo',
        'Insalubridade Fixa',
        'Horas 40% Máximo (h)',
        'Horas 20% Médio (h)',
        'Horas 10% Mínimo (h)',
        'Total Horas Insalubres (h)',
        'Total Dias Insalubres (dias)',
        'Total Apontamentos',
        'Resumo Atividades Executadas',
      ];

      rows = insalubridadeData.map((item) => [
        `"${item.matricula}"`,
        `"${item.nome}"`,
        `"${item.sede}"`,
        `"${item.funcao}"`,
        `"${item.grauFixo}"`,
        item.horas40.toFixed(1).replace('.', ','),
        item.horas20.toFixed(1).replace('.', ','),
        item.horas10.toFixed(1).replace('.', ','),
        item.totalHorasAtividade.toFixed(1).replace('.', ','),
        item.diasAtividade.toString(),
        item.totalApontamentos.toString(),
        `"${item.atividadesDescricao.replace(/"/g, '""')}"`,
      ]);
    }

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------------------------------------------
  // IMPRESSÃO / SALVAR EM PDF
  // -------------------------------------------------------------
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. BARRA SUPERIOR DE COMANDOS & SELEÇÃO DE RELATÓRIO          */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm print:hidden ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-lg sm:text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Gerador de Relatórios Executivos
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                COMARA • SPTF
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
              Emissão analítica e sintética de Banco de Horas e Insalubridade com filtro de período
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-98 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel (CSV)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-98 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF Oficial</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. PAINEL DE FILTROS & SELEÇÃO DE PERÍODO                     */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-5 rounded-2xl border space-y-4 print:hidden ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        {/* Tipo de Relatório Toggle */}
        <div className="flex items-center gap-2 border-b pb-4 flex-wrap">
          <span className={`text-xs font-bold mr-2 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
            TIPO DE RELATÓRIO:
          </span>
          
          <button
            onClick={() => setReportType('BANCO_HORAS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              reportType === 'BANCO_HORAS'
                ? isDark 
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-xs' 
                  : 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                : isDark 
                  ? 'text-[#8E9299] hover:bg-[#1F2229]' 
                  : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>1. Banco de Horas (Saldo Anterior, Acumulado, Saldo Final)</span>
          </button>

          <button
            onClick={() => setReportType('INSALUBRIDADE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              reportType === 'INSALUBRIDADE'
                ? isDark 
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-xs' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200 shadow-xs'
                : isDark 
                  ? 'text-[#8E9299] hover:bg-[#1F2229]' 
                  : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>2. Insalubridade (Adicional Fixo + Apontamentos por Atividade)</span>
          </button>
        </div>

        {/* Filtros em Linha */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          {/* Data Início & Fim */}
          <div>
            <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
              DATA INICIAL DO PERÍODO
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs outline-hidden ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
              DATA FINAL DO PERÍODO
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs outline-hidden ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Sede */}
          <div>
            <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
              SEDE OPERACIONAL
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs outline-hidden ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
              }`}
            >
              <option value="TODAS">Todas as Sedes (KO, BE, MN, etc.)</option>
              <option value="KO">KO (Coari - Base Principal)</option>
              <option value="BE">BE (Belém - Sede)</option>
              <option value="MN">MN (Manaus - Destacamento)</option>
              <option value="SP">SP (São Paulo)</option>
              <option value="RJ">RJ (Rio de Janeiro)</option>
            </select>
          </div>

          {/* Busca por Colaborador */}
          <div>
            <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
              BUSCA POR NOME / MATRÍCULA
            </label>
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Filtrar colaborador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-8.5 pr-3 py-2 rounded-xl border text-xs outline-hidden ${
                  isDark ? 'bg-[#0D0F14] border-[#1F2229] text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Presets Rápidos de Data */}
        <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
          <span className={`text-[11px] font-bold ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
            Períodos Rápidos:
          </span>
          <button
            onClick={() => applyDatePreset('THIS_MONTH')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229] text-gray-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Mês Atual
          </button>
          <button
            onClick={() => applyDatePreset('LAST_MONTH')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229] text-gray-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Mês Anterior
          </button>
          <button
            onClick={() => applyDatePreset('YEAR_TO_DATE')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229] text-gray-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Ano Atual (YTD)
          </button>
          <button
            onClick={() => applyDatePreset('ALL_TIME')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
              isDark ? 'bg-[#0D0F14] border-[#1F2229] text-gray-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Histórico Completo
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. DOCUMENTO OFICIAL FORMATADO PARA TELA E IMPRESSÃO (PDF)    */}
      {/* ------------------------------------------------------------- */}
      <div 
        ref={printRef}
        className={`p-6 sm:p-8 rounded-2xl border shadow-sm print:border-none print:shadow-none print:p-0 font-mono ${
          isDark ? 'bg-[#15171C] border-[#1F2229] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Cabeçalho Oficial do Relatório COMARA */}
        <div className="border-b pb-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <ComaraLogo logoUrl={systemConfig?.logoUrl} size="lg" />
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight uppercase text-blue-400 print:text-black">
                  COMISSÃO DE AEROPORTOS DA REGIÃO AMAZÔNICA - COMARA
                </h2>
                <h3 className="text-sm font-bold tracking-tight text-slate-200 print:text-black">
                  {reportType === 'BANCO_HORAS' 
                    ? 'RELATÓRIO GERENCIAL DE BANCO DE HORAS SPTF / CLT'
                    : 'RELATÓRIO ANALÍTICO DE INSALUBRIDADE (NR-15)'}
                </h3>
                <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                  Sedes: KO (Coari) • BE (Belém) • MN (Manaus) • Sistema Centralizado
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-slate-400 print:text-slate-600 space-y-1">
              <div><strong>Período Apurado:</strong> {startDate.split('-').reverse().join('/')} até {endDate.split('-').reverse().join('/')}</div>
              <div><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</div>
              <div><strong>Responsável:</strong> {currentUserEmail}</div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RELATÓRIO 1: BANCO DE HORAS                               */}
        {/* ========================================================= */}
        {reportType === 'BANCO_HORAS' && (
          <div className="space-y-6">
            {/* Resumo Sintético do Período */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block font-bold">TOTAL CRÉDITOS PERÍODO</span>
                <span className="text-lg font-black text-emerald-400 print:text-emerald-700">+{totalBancoHoras.creditosPeriodo.toFixed(1)}h</span>
              </div>
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block font-bold">TOTAL DÉBITOS / FOLGAS</span>
                <span className="text-lg font-black text-amber-400 print:text-amber-700">-{totalBancoHoras.debitosPeriodo.toFixed(1)}h</span>
              </div>
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block font-bold">RESULTADO LÍQUIDO PERÍODO</span>
                <span className={`text-lg font-black ${totalBancoHoras.saldoPeriodo >= 0 ? 'text-emerald-400 print:text-emerald-700' : 'text-red-400 print:text-red-700'}`}>
                  {totalBancoHoras.saldoPeriodo >= 0 ? `+${totalBancoHoras.saldoPeriodo.toFixed(1)}h` : `${totalBancoHoras.saldoPeriodo.toFixed(1)}h`}
                </span>
              </div>
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block font-bold">SALDO FINAL CONSOLIDADO</span>
                <span className={`text-lg font-black ${totalBancoHoras.saldoFinalHoras >= 0 ? 'text-blue-400 print:text-blue-700' : 'text-red-400 print:text-red-700'}`}>
                  {totalBancoHoras.saldoFinalHoras >= 0 ? `+${totalBancoHoras.saldoFinalHoras.toFixed(1)}h` : `${totalBancoHoras.saldoFinalHoras.toFixed(1)}h`}
                </span>
              </div>
            </div>

            {/* Tabela Detalhada */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border border-slate-700 print:border-slate-300">
                <thead>
                  <tr className="bg-slate-800/80 print:bg-slate-100 text-slate-300 print:text-slate-800 text-[10px] uppercase font-bold border-b border-slate-700 print:border-slate-300">
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300">Matrícula</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300">Colaborador</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-center">Sede</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300">Função</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right">Saldo Ant.</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right text-emerald-400 print:text-emerald-700">Créditos</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right text-amber-400 print:text-amber-700">Débitos</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right font-bold">Saldo Per.</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right font-black text-blue-400 print:text-blue-700">Saldo Final (h)</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right">Equiv. Dias</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                  {bancoHorasData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-slate-500">
                        Nenhum registro localizado no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    bancoHorasData.map((item) => {
                      const isCredor = item.saldoFinalHoras > 0.05;
                      const isDevedor = item.saldoFinalHoras < -0.05;
                      return (
                        <tr key={item.matricula} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 font-bold whitespace-nowrap">{item.matricula}</td>
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 font-medium whitespace-nowrap">{item.nome}</td>
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 text-center font-bold">{item.sede}</td>
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 truncate max-w-[130px]">{item.funcao}</td>
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono">{item.saldoAnterior.toFixed(1)}h</td>
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono text-emerald-400 print:text-emerald-700">+{item.creditosPeriodo.toFixed(1)}h</td>
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono text-amber-400 print:text-amber-700">-{item.debitosPeriodo.toFixed(1)}h</td>
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono font-bold">
                            {item.saldoPeriodo >= 0 ? `+${item.saldoPeriodo.toFixed(1)}h` : `${item.saldoPeriodo.toFixed(1)}h`}
                          </td>
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono font-black text-blue-400 print:text-black">
                            {item.saldoFinalHoras >= 0 ? `+${item.saldoFinalHoras.toFixed(1)}h` : `${item.saldoFinalHoras.toFixed(1)}h`}
                          </td>
                          <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono text-slate-400 print:text-slate-600">
                            {item.saldoFinalDias.toFixed(1)}d
                          </td>
                          <td className="p-2 text-center whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isCredor 
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                : isDevedor 
                                  ? 'bg-red-500/15 text-red-400 border border-red-500/30' 
                                  : 'bg-slate-700 text-slate-300'
                            }`}>
                              {isCredor ? 'CREDOR' : isDevedor ? 'DEVEDOR' : 'ZERADO'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 print:bg-slate-200 font-bold border-t-2 border-slate-600">
                    <td colSpan={4} className="p-2.5 text-right border-r border-slate-700 uppercase">TOTAIS CONSOLIDADOS ({bancoHorasData.length} COLABORADORES):</td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono">{totalBancoHoras.saldoAnterior.toFixed(1)}h</td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono text-emerald-400 print:text-emerald-800">+{totalBancoHoras.creditosPeriodo.toFixed(1)}h</td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono text-amber-400 print:text-amber-800">-{totalBancoHoras.debitosPeriodo.toFixed(1)}h</td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono">
                      {totalBancoHoras.saldoPeriodo >= 0 ? `+${totalBancoHoras.saldoPeriodo.toFixed(1)}h` : `${totalBancoHoras.saldoPeriodo.toFixed(1)}h`}
                    </td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono font-black text-blue-400 print:text-black">
                      {totalBancoHoras.saldoFinalHoras >= 0 ? `+${totalBancoHoras.saldoFinalHoras.toFixed(1)}h` : `${totalBancoHoras.saldoFinalHoras.toFixed(1)}h`}
                    </td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono text-slate-400 print:text-slate-700">
                      {(totalBancoHoras.saldoFinalHoras / 8.8).toFixed(1)}d
                    </td>
                    <td className="p-2.5 text-center text-[10px]">
                      {totalBancoHoras.credorCount}C / {totalBancoHoras.devedorCount}D
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* RELATÓRIO 2: INSALUBRIDADE                                */}
        {/* ========================================================= */}
        {reportType === 'INSALUBRIDADE' && (
          <div className="space-y-6">
            {/* Resumo Sintético do Período */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block font-bold">COLABORADORES COM FIXO</span>
                <span className="text-lg font-black text-amber-400 print:text-amber-700">{totalInsalubridade.totalFixoComAdicional}</span>
              </div>
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block font-bold">HORAS EXPOSTAS 40% (MÁXIMO)</span>
                <span className="text-lg font-black text-red-400 print:text-red-700">{totalInsalubridade.totalHoras40.toFixed(1)}h</span>
              </div>
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block font-bold">HORAS EXPOSTAS 20% (MÉDIO)</span>
                <span className="text-lg font-black text-amber-400 print:text-amber-700">{totalInsalubridade.totalHoras20.toFixed(1)}h</span>
              </div>
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block font-bold">TOTAL APONTAMENTOS CANTEIRO</span>
                <span className="text-lg font-black text-purple-400 print:text-purple-700">{totalInsalubridade.totalApontamentos}</span>
              </div>
            </div>

            {/* Tabela de Insalubridade */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border border-slate-700 print:border-slate-300">
                <thead>
                  <tr className="bg-slate-800/80 print:bg-slate-100 text-slate-300 print:text-slate-800 text-[10px] uppercase font-bold border-b border-slate-700 print:border-slate-300">
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300">Matrícula</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300">Colaborador</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-center">Sede</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300">Função</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-center">Insalubridade Fixa</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right text-red-400 print:text-red-700">Horas 40%</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right text-amber-400 print:text-amber-700">Horas 20%</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right text-blue-400 print:text-blue-700">Horas 10%</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-right font-bold">Total Horas</th>
                    <th className="p-2.5 border-r border-slate-700 print:border-slate-300 text-center">Dias Expostos</th>
                    <th className="p-2.5">Atividades Realizadas no Período</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                  {insalubridadeData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-slate-500">
                        Nenhum colaborador localizado para o relatório de insalubridade.
                      </td>
                    </tr>
                  ) : (
                    insalubridadeData.map((item) => (
                      <tr key={item.matricula} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 font-bold whitespace-nowrap">{item.matricula}</td>
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 font-medium whitespace-nowrap">{item.nome}</td>
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 text-center font-bold">{item.sede}</td>
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 truncate max-w-[130px]">{item.funcao}</td>
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.grauFixo === '40%' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                            item.grauFixo === '20%' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                            item.grauFixo === '10%' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {item.grauFixo}
                          </span>
                        </td>
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono">{item.horas40 > 0 ? `${item.horas40.toFixed(1)}h` : '-'}</td>
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono">{item.horas20 > 0 ? `${item.horas20.toFixed(1)}h` : '-'}</td>
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono">{item.horas10 > 0 ? `${item.horas10.toFixed(1)}h` : '-'}</td>
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 text-right font-mono font-bold">
                          {item.totalHorasAtividade > 0 ? `${item.totalHorasAtividade.toFixed(1)}h` : '-'}
                        </td>
                        <td className="p-2 border-r border-slate-800 print:border-slate-200 text-center font-mono">
                          {item.diasAtividade > 0 ? `${item.diasAtividade}d` : '-'}
                        </td>
                        <td className="p-2 text-[11px] text-slate-300 print:text-slate-700 truncate max-w-xs" title={item.atividadesDescricao}>
                          {item.atividadesDescricao}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 print:bg-slate-200 font-bold border-t-2 border-slate-600">
                    <td colSpan={4} className="p-2.5 text-right border-r border-slate-700 uppercase">TOTAIS APONTADOS:</td>
                    <td className="p-2.5 text-center border-r border-slate-700 font-mono">{totalInsalubridade.totalFixoComAdicional} com adicional</td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono text-red-400 print:text-red-800">{totalInsalubridade.totalHoras40.toFixed(1)}h</td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono text-amber-400 print:text-amber-800">{totalInsalubridade.totalHoras20.toFixed(1)}h</td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono text-blue-400 print:text-blue-800">{totalInsalubridade.totalHoras10.toFixed(1)}h</td>
                    <td className="p-2.5 text-right border-r border-slate-700 font-mono font-black">{totalInsalubridade.totalHorasGeral.toFixed(1)}h</td>
                    <td className="p-2.5 text-center border-r border-slate-700 font-mono">{totalInsalubridade.totalDiasGeral}d</td>
                    <td className="p-2.5 text-slate-400 print:text-slate-600 text-[10px]">{totalInsalubridade.totalApontamentos} eventos registrados</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Rodapé Oficial de Assinatura COMARA */}
        <div className="mt-12 pt-8 border-t border-slate-700 print:border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
          <div className="space-y-1">
            <div className="w-48 h-0.5 bg-slate-500 mx-auto mb-2"></div>
            <div className="font-bold">Chefe da Seção de Pessoal / RH</div>
            <div className="text-[10px] text-slate-400 print:text-slate-600">COMARA • Sede Regional</div>
          </div>
          <div className="space-y-1">
            <div className="w-48 h-0.5 bg-slate-500 mx-auto mb-2"></div>
            <div className="font-bold">Chefe de Canteiro / Fiscal de Obras</div>
            <div className="text-[10px] text-slate-400 print:text-slate-600">COMARA • Destacamento Operacional</div>
          </div>
        </div>
      </div>
    </div>
  );
};
