import React, { useState, useMemo } from 'react';
import { Employee, TimeRecord, Branch } from '../types';
import { formatHoursDecimal } from '../utils/calculations';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  Building, 
  Eye, 
  Plus, 
  Clock, 
  Sparkles, 
  Users, 
  Layers,
  CheckCircle2,
  AlertCircle,
  Zap
} from 'lucide-react';

interface DashboardCalendarViewProps {
  employees: Employee[];
  records: TimeRecord[];
  onOpenNewEntryModal: (matricula?: string, date?: string) => void;
  onViewEmployeeStatement: (matricula: string) => void;
  onOpenQuickBatchModal?: () => void;
  theme?: 'dark' | 'light';
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Helper to get start of week (Segunda-feira)
const getStartOfWeek = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const start = new Date(date.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
};

// Format Date YYYY-MM-DD
const toDateIso = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DashboardCalendarView: React.FC<DashboardCalendarViewProps> = ({
  employees,
  records,
  onOpenNewEntryModal,
  onViewEmployeeStatement,
  onOpenQuickBatchModal,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  // Mode: 7 Days (Week) | 14 Days (Biweekly)
  const [viewMode, setViewMode] = useState<'7_DAYS' | '14_DAYS'>('7_DAYS');

  // Active Start Date of visible window
  const [startDate, setStartDate] = useState<Date>(() => getStartOfWeek(new Date()));

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSede, setFilterSede] = useState<string>('TODAS');
  const [filterFuncao, setFilterFuncao] = useState<string>('TODAS');

  const daysCount = viewMode === '7_DAYS' ? 7 : 14;

  // Generate period days
  const daysInPeriod = useMemo(() => {
    const days = [];
    const todayIso = toDateIso(new Date());

    for (let i = 0; i < daysCount; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      const dateIso = toDateIso(cur);
      const dayOfWeek = cur.getDay();

      days.push({
        dateObj: cur,
        dateIso,
        dayNumber: cur.getDate(),
        monthNumber: cur.getMonth() + 1,
        monthName: MONTH_NAMES[cur.getMonth()],
        monthNameShort: MONTH_NAMES_SHORT[cur.getMonth()],
        year: cur.getFullYear(),
        dayOfWeek,
        dayName: WEEKDAY_SHORT[dayOfWeek],
        dayNameFull: WEEKDAY_FULL[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isSunday: dayOfWeek === 0,
        isSaturday: dayOfWeek === 6,
        isToday: dateIso === todayIso,
      });
    }
    return days;
  }, [startDate, daysCount]);

  // End date of period
  const endDate = useMemo(() => {
    if (daysInPeriod.length === 0) return startDate;
    return daysInPeriod[daysInPeriod.length - 1].dateObj;
  }, [daysInPeriod, startDate]);

  // Navigation handlers
  const handlePrevPeriod = () => {
    const next = new Date(startDate);
    next.setDate(startDate.getDate() - daysCount);
    setStartDate(next);
  };

  const handleNextPeriod = () => {
    const next = new Date(startDate);
    next.setDate(startDate.getDate() + daysCount);
    setStartDate(next);
  };

  const handleSetCurrentPeriod = () => {
    setStartDate(getStartOfWeek(new Date()));
  };

  // Unique sedes & funcoes
  const availableSedes = useMemo(() => {
    const s = new Set<string>();
    employees.forEach((e) => {
      if (e.sede) s.add(e.sede);
      if (e.sede_atual) s.add(e.sede_atual);
    });
    return Array.from(s).sort();
  }, [employees]);

  const availableFuncoes = useMemo(() => {
    const f = new Set<string>();
    employees.forEach((e) => {
      if (e.funcao) f.add(e.funcao);
    });
    return Array.from(f).sort();
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (filterSede !== 'TODAS' && (emp.sede_atual || emp.sede) !== filterSede) return false;
      if (filterFuncao !== 'TODAS' && emp.funcao !== filterFuncao) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mMat = (emp.matricula || '').toLowerCase().includes(q);
        const mNom = (emp.nome || '').toLowerCase().includes(q);
        const mFun = (emp.funcao || '').toLowerCase().includes(q);
        if (!mMat && !mNom && !mFun) return false;
      }
      return true;
    });
  }, [employees, filterSede, filterFuncao, searchQuery]);

  // Normalization helper for record dates
  const normalizeRecDate = (r: TimeRecord): string => {
    const raw = r.dataRegistro || r.data_ocorrencia || (r as any).data || (r as any).date || r.criadoEm || '';
    if (!raw) return '';
    const clean = raw.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('/');
      return `${y}-${m}-${d}`;
    }
    return clean.split('T')[0];
  };

  // Map of records by `matricula_dateIso`
  const recordsMap = useMemo(() => {
    const map = new Map<string, TimeRecord[]>();
    const startIso = daysInPeriod[0]?.dateIso || '';
    const endIso = daysInPeriod[daysInPeriod.length - 1]?.dateIso || '';

    records.forEach((rec) => {
      const recDate = normalizeRecDate(rec);
      if (recDate >= startIso && recDate <= endIso) {
        const mat = (rec.matricula || '').trim().toUpperCase();
        const key = `${mat}_${recDate}`;
        const current = map.get(key) || [];
        current.push(rec);
        map.set(key, current);
      }
    });

    return map;
  }, [records, daysInPeriod]);

  // Period Statistics
  const periodStats = useMemo(() => {
    const startIso = daysInPeriod[0]?.dateIso || '';
    const endIso = daysInPeriod[daysInPeriod.length - 1]?.dateIso || '';

    const periodRecords = records.filter((r) => {
      const d = normalizeRecDate(r);
      return d >= startIso && d <= endIso;
    });

    let totalHoras = 0;
    let totalAtestados = 0;
    let totalFaltas = 0;
    let totalTrabalho = 0;
    let totalCompensacao = 0;

    periodRecords.forEach((r) => {
      const saldo = Number(r.saldoCalculado);
      const horas = Number(r.horasBrutas) || 0;
      const mult = Number(r.multiplicador) || 1;

      if (!isNaN(saldo) && saldo !== 0) {
        totalHoras += saldo;
      } else if (r.tipoOcorrencia === 'TRABALHO' && horas > 0) {
        totalHoras += horas * mult;
      } else if (r.tipoOcorrencia === 'COMPENSACAO' || r.tipoOcorrencia === 'DISPENSA_OPERACIONAL') {
        totalHoras -= (horas > 0 ? horas : 8.0);
      }

      if (r.tipoOcorrencia === 'ATESTADO_MEDICO') totalAtestados++;
      else if (r.tipoOcorrencia === 'FALTA_INJUSTIFICADA') totalFaltas++;
      else if (r.tipoOcorrencia === 'TRABALHO') totalTrabalho++;
      else if (r.tipoOcorrencia === 'COMPENSACAO' || r.tipoOcorrencia === 'DISPENSA_OPERACIONAL') totalCompensacao++;
    });

    return {
      totalHoras,
      totalAtestados,
      totalFaltas,
      totalTrabalho,
      totalCompensacao,
      totalRegistros: periodRecords.length,
    };
  }, [records, daysInPeriod]);

  // Render Pill for an individual record
  const renderOccurrencePill = (rec: TimeRecord, index: number = 0) => {
    let saldo = Number(rec.saldoCalculado);
    const horasBrutas = Number(rec.horasBrutas) || 0;
    const mult = Number(rec.multiplicador) || 1;
    const itemKey = rec.id ? `rec_${rec.id}` : `rec_${rec.matricula}_${rec.dataRegistro}_${rec.tipoOcorrencia}_${index}`;

    if (isNaN(saldo) || (saldo === 0 && horasBrutas > 0)) {
      if (rec.tipoOcorrencia === 'TRABALHO') saldo = horasBrutas * mult;
      else if (rec.tipoOcorrencia === 'COMPENSACAO' || rec.tipoOcorrencia === 'DISPENSA_OPERACIONAL') saldo = -(horasBrutas > 0 ? horasBrutas : 8.0);
    }

    switch (rec.tipoOcorrencia) {
      case 'TRABALHO': {
        const isPositive = saldo > 0;
        return (
          <span
            key={itemKey}
            title={`Trabalho / HE: ${horasBrutas}h brutas (${mult}x = ${saldo > 0 ? '+' : ''}${saldo.toFixed(1)}h)${rec.observacao ? ` • ${rec.observacao}` : ''}`}
            className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold leading-tight shadow-2xs whitespace-nowrap ${
              isPositive
                ? isDark
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900/80'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                : isDark
                ? 'bg-blue-950/80 text-blue-300 border border-blue-700/60'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}
          >
            {saldo > 0 ? `+${saldo.toFixed(1)}h` : `${horasBrutas}h`}
          </span>
        );
      }
      case 'ATESTADO_MEDICO':
        return (
          <span
            key={itemKey}
            title={`Atestado Médico (Neutro 0h)${rec.observacao ? ` • ${rec.observacao}` : ''}`}
            className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold leading-tight ${
              isDark ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60' : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
          >
            AT (0h)
          </span>
        );
      case 'FALTA_INJUSTIFICADA':
        return (
          <span
            key={itemKey}
            title={`Falta Injustificada (-8.0h / Desconto)${rec.observacao ? ` • ${rec.observacao}` : ''}`}
            className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold leading-tight ${
              isDark ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60' : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}
          >
            -8.0h
          </span>
        );
      case 'FERIAS':
        return (
          <span
            key={itemKey}
            title="Férias Regulamentares"
            className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold leading-tight ${
              isDark ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60' : 'bg-cyan-100 text-cyan-800 border border-cyan-300'
            }`}
          >
            FÉRIAS
          </span>
        );
      case 'COMPENSACAO':
      case 'DISPENSA_OPERACIONAL':
        return (
          <span
            key={itemKey}
            title={`Folga / Compensação (${saldo.toFixed(1)}h)${rec.observacao ? ` • ${rec.observacao}` : ''}`}
            className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold leading-tight ${
              isDark ? 'bg-purple-950/80 text-purple-300 border border-purple-700/60' : 'bg-purple-100 text-purple-800 border border-purple-300'
            }`}
          >
            {saldo < 0 ? `${saldo.toFixed(1)}h` : 'COMP'}
          </span>
        );
      default:
        return (
          <span
            key={itemKey}
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-gray-500/20 text-gray-400"
          >
            {horasBrutas}h
          </span>
        );
    }
  };

  // Header period title formatted
  const periodLabel = useMemo(() => {
    if (daysInPeriod.length === 0) return '';
    const first = daysInPeriod[0];
    const last = daysInPeriod[daysInPeriod.length - 1];

    if (first.year === last.year && first.monthNumber === last.monthNumber) {
      return `${String(first.dayNumber).padStart(2, '0')} a ${String(last.dayNumber).padStart(2, '0')} de ${first.monthName} de ${first.year}`;
    }
    return `${String(first.dayNumber).padStart(2, '0')}/${String(first.monthNumber).padStart(2, '0')} a ${String(last.dayNumber).padStart(2, '0')}/${String(last.monthNumber).padStart(2, '0')}/${last.year}`;
  }, [daysInPeriod]);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* BARRA SUPERIOR: SELETOR DE MODO, NAVEGADOR E FILTROS          */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-4 rounded-2xl border flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${
        isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-white border-gray-200 shadow-xs'
      }`}>
        
        {/* Lado Esquerdo: Seletor de Modo (7d / 14d) + Navegador de Período */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Seletor de Alternância [ 7 Dias | 14 Dias ] */}
          <div className={`p-1 rounded-xl border flex items-center gap-1 ${
            isDark ? 'bg-[#15171C] border-[#2A2E38]' : 'bg-gray-100 border-gray-300'
          }`}>
            <button
              onClick={() => setViewMode('7_DAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === '7_DAYS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>7 Dias (Semanal)</span>
            </button>
            <button
              onClick={() => setViewMode('14_DAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === '14_DAYS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>14 Dias (Quinzenal)</span>
            </button>
          </div>

          {/* Navegador de Período com Setas */}
          <div className="flex items-center rounded-xl border overflow-hidden p-0.5 bg-black/20">
            <button
              onClick={handlePrevPeriod}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:bg-[#1F2229] text-gray-300' : 'hover:bg-white text-gray-700'
              }`}
              title={`Voltar ${daysCount} dias`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 flex items-center gap-2">
              <span className={`font-bold text-xs sm:text-sm tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {periodLabel}
              </span>
            </div>

            <button
              onClick={handleNextPeriod}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:bg-[#1F2229] text-gray-300' : 'hover:bg-white text-gray-700'
              }`}
              title={`Avançar ${daysCount} dias`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Botão Semana/Período Atual */}
          <button
            onClick={handleSetCurrentPeriod}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              isDark ? 'border-[#2A2E38] hover:bg-[#1F2229] text-blue-400' : 'border-gray-300 hover:bg-gray-100 text-blue-700'
            }`}
          >
            Semana Atual
          </button>

          {onOpenQuickBatchModal && (
            <button
              onClick={onOpenQuickBatchModal}
              className="px-3 py-1.5 rounded-xl border text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 border-blue-500/30 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Apontar horas para múltiplos colaboradores"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Lançamento em Lote</span>
            </button>
          )}
        </div>

        {/* Lado Direito: Filtros Rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Buscar colaborador ou matrícula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full sm:w-56 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none border transition-colors ${
                isDark ? 'bg-[#15171C] border-[#1F2229] text-white focus:border-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              }`}
            />
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </div>

          <select
            value={filterSede}
            onChange={(e) => setFilterSede(e.target.value)}
            className={`rounded-xl px-3 py-1.5 text-xs outline-none border font-medium ${
              isDark ? 'bg-[#15171C] border-[#1F2229] text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="TODAS">Todas as Sedes</option>
            {availableSedes.map((s) => (
              <option key={s} value={s}>Sede: {s}</option>
            ))}
          </select>

          <select
            value={filterFuncao}
            onChange={(e) => setFilterFuncao(e.target.value)}
            className={`rounded-xl px-3 py-1.5 text-xs outline-none border font-medium ${
              isDark ? 'bg-[#15171C] border-[#1F2229] text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="TODAS">Todas as Funções</option>
            {availableFuncoes.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* LEGENDA E RESUMO RÁPIDO DO PERÍODO                            */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
        isDark ? 'bg-[#101217] border-[#1F2229] text-[#8E9299]' : 'bg-gray-50 border-gray-200 text-gray-600'
      }`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-white dark:text-white font-sans text-xs">Legenda:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Trabalho / HE (+Horas)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Atestado Médico (AT)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>Falta Injustificada (-8h)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
            <span>Férias</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
            <span>Folga / Compensação</span>
          </span>
        </div>

        <div className="font-mono text-xs flex items-center gap-3">
          <div>
            <span className="opacity-75">Saldo do Período ({daysCount}d): </span>
            <strong className={periodStats.totalHoras >= 0 ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
              {formatHoursDecimal(periodStats.totalHoras)}
            </strong>
          </div>
          <span className="opacity-50">|</span>
          <div>
            <span className="opacity-75">Apontamentos: </span>
            <strong className="text-white font-bold">{periodStats.totalRegistros}</strong>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* GRADE DA TABELA COM NAVEGAÇÃO NAS EXTREMIDADES                */}
      {/* ------------------------------------------------------------- */}
      <div className={`rounded-2xl border overflow-x-auto shadow-inner ${
        isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200'
      }`}>
        <table className={`w-full text-left border-collapse ${viewMode === '7_DAYS' ? 'min-w-[920px]' : 'min-w-[1180px]'}`}>
          <thead>
            <tr className={`text-xs uppercase font-mono font-bold border-b ${
              isDark ? 'bg-[#0D0F14] text-[#8E9299] border-[#1F2229]' : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              
              {/* Coluna Fixa: Colaborador com botão retroceder integrado */}
              <th className={`py-3 px-3 sticky left-0 z-20 w-60 sm:w-64 min-w-[220px] max-w-[260px] shadow-sm backdrop-blur-xs border-r ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-gray-100 border-gray-200'
              }`}>
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">COLABORADOR ({filteredEmployees.length})</span>
                  </div>
                  {/* Botão de Retroceder Período na extremidade esquerda da grade */}
                  <button
                    onClick={handlePrevPeriod}
                    className={`p-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold shrink-0 ${
                      isDark ? 'bg-[#1C202B] border-[#2A3040] hover:bg-[#252B3A] text-blue-400' : 'bg-white border-gray-300 hover:bg-gray-100 text-blue-600'
                    }`}
                    title={`Retroceder ${daysCount} dias`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">-{daysCount}d</span>
                  </button>
                </div>
              </th>

              {/* Colunas de Datas Proporcionais */}
              {daysInPeriod.map((day) => (
                <th
                  key={day.dateIso}
                  className={`py-2 px-1 text-center font-mono border-l transition-colors ${
                    viewMode === '7_DAYS' ? 'min-w-[85px] sm:min-w-[95px]' : 'min-w-[62px] sm:min-w-[70px]'
                  } ${
                    day.isToday
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 font-bold'
                      : day.isSunday
                      ? isDark ? 'bg-rose-950/20 text-rose-300 border-[#1F2229]' : 'bg-rose-50 text-rose-700 border-gray-200'
                      : day.isSaturday
                      ? isDark ? 'bg-amber-950/20 text-amber-300 border-[#1F2229]' : 'bg-amber-50 text-amber-700 border-gray-200'
                      : isDark ? 'border-[#1F2229]' : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase ${day.isSunday ? 'text-rose-400' : day.isSaturday ? 'text-amber-400' : 'opacity-70'}`}>
                      {day.dayName}
                    </span>
                    <span className={`text-xs sm:text-sm font-black tracking-tight ${day.isToday ? 'text-blue-400' : ''}`}>
                      {String(day.dayNumber).padStart(2, '0')}/{day.monthNameShort}
                    </span>
                  </div>
                </th>
              ))}

              {/* Botão de Avançar Período na extremidade direita do cabeçalho */}
              <th className={`py-3 px-2 text-center w-28 min-w-[95px] max-w-[115px] border-l ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-gray-100 border-gray-200'
              }`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] sm:text-[11px] font-bold font-sans truncate">SALDO</span>
                  <button
                    onClick={handleNextPeriod}
                    className={`p-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold shrink-0 ${
                      isDark ? 'bg-[#1C202B] border-[#2A3040] hover:bg-[#252B3A] text-blue-400' : 'bg-white border-gray-300 hover:bg-gray-100 text-blue-600'
                    }`}
                    title={`Avançar ${daysCount} dias`}
                  >
                    <span className="hidden md:inline">+{daysCount}d</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </th>
            </tr>
          </thead>

          <tbody className={`text-xs divide-y ${
            isDark ? 'divide-[#1F2229] text-[#E0E2E5]' : 'divide-gray-200 text-gray-800'
          }`}>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={daysInPeriod.length + 2} className="py-14 text-center text-gray-500 font-mono">
                  Nenhum colaborador encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const cleanMat = (emp.matricula || '').trim().toUpperCase();

                // Computar Saldo do Período para o Colaborador
                let empPeriodBalance = 0;
                daysInPeriod.forEach((day) => {
                  const key = `${cleanMat}_${day.dateIso}`;
                  const dayRecords = recordsMap.get(key) || [];
                  dayRecords.forEach((r) => {
                    let s = Number(r.saldoCalculado);
                    const h = Number(r.horasBrutas) || 0;
                    const m = Number(r.multiplicador) || 1;
                    if (isNaN(s) || (s === 0 && h > 0)) {
                      if (r.tipoOcorrencia === 'TRABALHO') s = h * m;
                      else if (r.tipoOcorrencia === 'COMPENSACAO' || r.tipoOcorrencia === 'DISPENSA_OPERACIONAL') s = -(h > 0 ? h : 8.0);
                    }
                    if (!isNaN(s)) empPeriodBalance += s;
                  });
                });

                return (
                  <tr
                    key={emp.id || emp.matricula}
                    className={`transition-colors ${isDark ? 'hover:bg-[#1C1F26]' : 'hover:bg-blue-50/40'}`}
                  >
                    {/* Coluna Fixa: Colaborador Compacta (Linha 1: Nome, Linha 2: #Mat • Sede • Função) */}
                    <td className={`py-2 px-3 sticky left-0 z-10 font-sans border-r w-60 sm:w-64 min-w-[220px] max-w-[260px] backdrop-blur-xs ${
                      isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                          {emp.url_foto_perfil || emp.avatarUrl ? (
                            <img
                              src={emp.url_foto_perfil || emp.avatarUrl}
                              alt={emp.nome}
                              className="w-6 h-6 rounded-full object-cover shrink-0 border"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-[9px] shrink-0">
                              {(emp.nome || 'C')[0]}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => onViewEmployeeStatement(emp.matricula)}
                              className={`font-bold hover:text-blue-500 truncate block text-left transition-colors cursor-pointer text-xs leading-tight ${
                                isDark ? 'text-white' : 'text-gray-900'
                              }`}
                              title={emp.nome}
                            >
                              {emp.nome}
                            </button>
                            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 block truncate leading-tight mt-0.5">
                              #{emp.matricula} • {emp.sede_atual || emp.sede || 'KO'} • {emp.funcao || emp.cargo || 'Serviço Geral'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => onViewEmployeeStatement(emp.matricula)}
                          className="p-1 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 shrink-0 cursor-pointer"
                          title="Ver Extrato do Colaborador"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Células dos Dias */}
                    {daysInPeriod.map((day) => {
                      const key = `${cleanMat}_${day.dateIso}`;
                      const dayRecords = recordsMap.get(key) || [];

                      return (
                        <td
                          key={`cell_${cleanMat}_${day.dateIso}`}
                          onClick={() => onOpenNewEntryModal(emp.matricula, day.dateIso)}
                          className={`p-1.5 text-center border-l transition-all cursor-pointer group align-middle ${
                            day.isToday
                              ? 'bg-blue-500/5'
                              : day.isSunday
                              ? isDark ? 'bg-rose-950/5' : 'bg-rose-50/40'
                              : day.isSaturday
                              ? isDark ? 'bg-amber-950/5' : 'bg-amber-50/40'
                              : ''
                          } ${isDark ? 'border-[#1F2229] hover:bg-blue-500/10' : 'border-gray-200 hover:bg-blue-50'}`}
                          title={`Clique para lançar horas em ${day.dateIso} para ${emp.nome}`}
                        >
                          {dayRecords.length > 0 ? (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              {dayRecords.map((r, rIdx) => renderOccurrencePill(r, rIdx))}
                            </div>
                          ) : (
                            <div className="h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="px-1.5 py-0.5 rounded-md bg-blue-600/20 text-blue-400 text-[9px] font-bold flex items-center gap-0.5">
                                <Plus className="w-2.5 h-2.5" />
                                <span>Lançar</span>
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Saldo Acumulado no Período (7d ou 14d) */}
                    <td className={`py-2 px-2 text-center font-mono font-black border-l whitespace-nowrap w-28 min-w-[95px] max-w-[115px] ${
                      isDark ? 'border-[#1F2229]' : 'border-gray-200'
                    }`}>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] inline-block font-mono ${
                        empPeriodBalance > 0
                          ? isDark ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-800/50' : 'text-emerald-700 bg-emerald-100 border border-emerald-300'
                          : empPeriodBalance < 0
                          ? isDark ? 'text-rose-400 bg-rose-950/50 border border-rose-800/50' : 'text-rose-700 bg-rose-100 border border-rose-300'
                          : 'text-gray-500 bg-gray-500/10'
                      }`}>
                        {formatHoursDecimal(empPeriodBalance)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

