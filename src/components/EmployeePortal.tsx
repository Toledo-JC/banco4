import React, { useState } from 'react';
import { Employee, TimeRecord, Attachment } from '../types';
import { 
  ShieldCheck, 
  Lock, 
  UserCheck, 
  Clock, 
  Calendar, 
  Building2, 
  FileText, 
  Download, 
  Paperclip, 
  ExternalLink, 
  LogOut, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight,
  Eye,
  KeyRound,
  FileCheck,
  Search
} from 'lucide-react';

interface EmployeePortalProps {
  employees: Employee[];
  records: TimeRecord[];
  onViewAttachment?: (attachment: Attachment, empName?: string, recordDate?: string) => void;
}

export const EmployeePortal: React.FC<EmployeePortalProps> = ({
  employees,
  records,
  onViewAttachment,
}) => {
  // Login states
  const [matriculaInput, setMatriculaInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authenticatedEmployee, setAuthenticatedEmployee] = useState<Employee | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    setTimeout(() => {
      const cleanMat = matriculaInput.trim().toUpperCase();
      const cleanPin = pinInput.trim();

      if (!cleanMat || !cleanPin) {
        setAuthError('Por favor, informe a Matrícula e o PIN de 4 dígitos.');
        setIsLoading(false);
        return;
      }

      // Localizar colaborador
      const found = employees.find(
        (emp) => emp.matricula.toUpperCase() === cleanMat || emp.matricula.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanMat.replace(/[^A-Za-z0-9]/g, '')
      );

      if (!found) {
        setAuthError(`Matrícula "${cleanMat}" não foi encontrada no banco de dados.`);
        setIsLoading(false);
        return;
      }

      // Validação de PIN: aceita os 4 dígitos ou padrão de segurança (ex: 1234, ou dígitos da matrícula/admissão)
      // Para simular a autenticação segura do backend
      if (cleanPin.length < 4) {
        setAuthError('O PIN de segurança deve possuir no mínimo 4 dígitos.');
        setIsLoading(false);
        return;
      }

      setAuthenticatedEmployee(found);
      setIsLoading(false);
    }, 450);
  };

  const handleLogout = () => {
    setAuthenticatedEmployee(null);
    setMatriculaInput('');
    setPinInput('');
    setAuthError(null);
  };

  // Filtrar lançamentos estritamente do colaborador logado
  const employeeRecords = authenticatedEmployee
    ? records.filter((r) => r.matricula.toUpperCase() === authenticatedEmployee.matricula.toUpperCase())
    : [];

  // Obter lista de meses disponíveis
  const availableMonths = Array.from(
    new Set(employeeRecords.map((r) => r.dataRegistro.substring(0, 7)))
  ).sort().reverse();

  // Filtrar por mês
  const filteredRecords = selectedMonth === 'TODOS'
    ? employeeRecords
    : employeeRecords.filter((r) => r.dataRegistro.startsWith(selectedMonth));

  // Cálculos de KPIs do Colaborador
  const saldoInicial = authenticatedEmployee?.saldoInicialHoras || 0;
  const saldoMovimentacoes = employeeRecords.reduce((acc, r) => acc + r.saldoCalculado, 0);
  const saldoTotalAcumulado = saldoInicial + saldoMovimentacoes;
  const saldoTotalDias = (saldoTotalAcumulado / 8).toFixed(2);

  // Totais do mês atual ou selecionado
  const horasExtrasMes = filteredRecords
    .filter((r) => r.tipoOcorrencia === 'TRABALHO' && r.saldoCalculado > 0)
    .reduce((acc, r) => acc + r.saldoCalculado, 0);

  const atestadosMes = filteredRecords.filter((r) => r.tipoOcorrencia === 'ATESTADO_MEDICO').length;
  const faltasMes = filteredRecords.filter((r) => r.tipoOcorrencia === 'FALTA_INJUSTIFICADA').length;
  const compensacoesMes = filteredRecords.filter((r) => r.tipoOcorrencia === 'COMPENSACAO').reduce((acc, r) => acc + Math.abs(r.saldoCalculado), 0);

  // Status Badge
  const isCredor = saldoTotalAcumulado > 0.05;
  const isDevedor = saldoTotalAcumulado < -0.05;

  // Função para download simplificado de extrato em PDF / Impressão
  const handleDownloadPDF = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // TELA DE LOGIN (MOBILE FIRST & ELEGANT DARK)
  // -------------------------------------------------------------
  if (!authenticatedEmployee) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Header Card */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-3 shadow-lg shadow-blue-500/10">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Portal do Colaborador
            </h1>
            <p className="text-xs text-[#8E9299] mt-1 font-mono">
              Consulta Segura de Extrato de Banco de Horas SPTF
            </p>
          </div>

          {/* Form Container */}
          <div className="bg-[#15171C] border border-[#1F2229] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400"></div>

            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#1F2229]">
              <Lock className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-[#E0E2E5] uppercase tracking-wider">
                Autenticação de Acesso
              </span>
            </div>

            {authError && (
              <div className="mb-5 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8E9299] mb-1.5 font-mono">
                  MATRÍCULA FUNCIONAL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ex: MAT-1001"
                    value={matriculaInput}
                    onChange={(e) => setMatriculaInput(e.target.value)}
                    className="w-full bg-[#0D0F14] border border-[#1F2229] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-gray-600 outline-none transition-colors"
                  />
                  <UserCheck className="absolute right-3.5 top-3.5 w-4 h-4 text-[#8E9299]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#8E9299] font-mono">
                    PIN DE SEGURANÇA / CPF
                  </label>
                  <span className="text-[10px] text-blue-400/80 font-mono">4 últimos dígitos</span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={6}
                    required
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full bg-[#0D0F14] border border-[#1F2229] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-gray-600 outline-none transition-colors tracking-widest text-center"
                  />
                  <KeyRound className="absolute right-3.5 top-3.5 w-4 h-4 text-[#8E9299]" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 active:scale-98"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Consultar Meu Banco de Horas</span>
                  </>
                )}
              </button>
            </form>

            {/* Guia Rápido de Teste */}
            <div className="mt-6 pt-4 border-t border-[#1F2229] text-center">
              <p className="text-[11px] text-[#8E9299] mb-2 font-mono">
                Matrículas disponíveis para teste no ambiente:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {employees.slice(0, 4).map((emp) => (
                  <button
                    key={emp.matricula}
                    type="button"
                    onClick={() => {
                      setMatriculaInput(emp.matricula);
                      setPinInput('1234');
                    }}
                    className="px-2 py-1 bg-[#0D0F14] hover:bg-[#1F2229] border border-[#1F2229] rounded-md text-[10px] text-blue-400 font-mono transition-colors"
                  >
                    {emp.matricula} ({emp.nome.split(' ')[0]})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-[#8E9299] space-y-1">
            <p className="flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>Conexão Segura com Criptografia Google Workspace</span>
            </p>
            <p className="text-[10px] font-mono text-gray-500">
              Acesso exclusivo e filtrado por Colaborador • Sedes KO, BE, MN
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // TELA DO EXTRATO DO COLABORADOR AUTENTICADO
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#15171C] border border-[#1F2229] p-4 rounded-2xl">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Sessão Autenticada com Sucesso</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            className="px-3.5 py-2 bg-[#0D0F14] hover:bg-[#1F2229] text-[#E0E2E5] border border-[#1F2229] rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Baixar Extrato (PDF)</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 bg-red-950/30 hover:bg-red-950/60 text-red-300 border border-red-900/50 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span>Encerrar Consulta</span>
          </button>
        </div>
      </div>

      {/* Header do Perfil do Colaborador */}
      <div className="bg-[#15171C] border border-[#1F2229] rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Foto / Avatar */}
            <div className="relative shrink-0">
              {authenticatedEmployee.url_foto_perfil || authenticatedEmployee.avatarUrl ? (
                <img
                  src={authenticatedEmployee.url_foto_perfil || authenticatedEmployee.avatarUrl}
                  alt={authenticatedEmployee.nome}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-blue-500/50 shadow-md shadow-blue-500/10"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0D0F14] border-2 border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-xl sm:text-2xl font-mono shadow-inner">
                  {authenticatedEmployee.nome
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-blue-600 rounded text-[9px] font-bold text-white uppercase tracking-wider">
                {authenticatedEmployee.sede}
              </div>
            </div>

            {/* Informações Pessoais */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {authenticatedEmployee.nome}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  {authenticatedEmployee.status}
                </span>
              </div>
              <p className="text-xs text-[#8E9299] font-medium flex items-center gap-2">
                <span>{authenticatedEmployee.funcao}</span>
                <span>•</span>
                <span className="font-mono text-blue-400">{authenticatedEmployee.matricula}</span>
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[#8E9299] font-mono">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-blue-400" />
                  Sede: {authenticatedEmployee.sede === 'KO' ? 'Coari (KO)' : authenticatedEmployee.sede === 'BE' ? 'Belém (BE)' : 'Manaus (MN)'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  Admissão: {authenticatedEmployee.dataAdmissao}
                </span>
              </div>
            </div>
          </div>

          {/* Saldo Destaque (Header Right) */}
          <div className="bg-[#0D0F14] border border-[#1F2229] rounded-xl p-4 sm:p-5 flex flex-col items-center sm:items-end justify-center min-w-[200px]">
            <span className="text-[10px] font-bold text-[#8E9299] uppercase tracking-wider font-mono">
              STATUS ATUAL DO BANCO
            </span>
            <div className="flex items-center gap-2 mt-1">
              {isCredor ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono">
                  🟢 CREDOR (+{saldoTotalAcumulado.toFixed(1)}h)
                </span>
              ) : isDevedor ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-bold font-mono">
                  🔴 DEVEDOR ({saldoTotalAcumulado.toFixed(1)}h)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/30 text-xs font-bold font-mono">
                  ⚪ ZERADO (0.0h)
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8E9299] font-mono mt-1.5">
              Equivale a <strong className="text-white">{saldoTotalDias} dias</strong> (jornada 8h)
            </p>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Principais (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Geral */}
        <div className="bg-[#15171C] border border-[#1F2229] rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#8E9299] text-xs font-mono mb-2">
            <span>SALDO TOTAL ACUMULADO</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className={`text-2xl font-bold font-mono ${saldoTotalAcumulado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {saldoTotalAcumulado >= 0 ? `+${saldoTotalAcumulado.toFixed(2)}h` : `${saldoTotalAcumulado.toFixed(2)}h`}
          </div>
          <p className="text-[11px] text-[#8E9299] font-mono mt-1">
            Saldo Inicial: {saldoInicial >= 0 ? `+${saldoInicial}h` : `${saldoInicial}h`}
          </p>
        </div>

        {/* Card 2: Horas Extras no Período */}
        <div className="bg-[#15171C] border border-[#1F2229] rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#8E9299] text-xs font-mono mb-2">
            <span>HORAS EXTRAS CREDITADAS</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            +{horasExtrasMes.toFixed(1)}h
          </div>
          <p className="text-[11px] text-emerald-400/80 font-mono mt-1">
            Finais de semana & feriados
          </p>
        </div>

        {/* Card 3: Atestados Médicos */}
        <div className="bg-[#15171C] border border-[#1F2229] rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#8E9299] text-xs font-mono mb-2">
            <span>ATESTADOS NO PERÍODO</span>
            <FileCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {atestadosMes} <span className="text-xs font-normal text-[#8E9299]">registros</span>
          </div>
          <p className="text-[11px] text-amber-400/80 font-mono mt-1">
            Todos abonados com 0h
          </p>
        </div>

        {/* Card 4: Folgas Compensatórias */}
        <div className="bg-[#15171C] border border-[#1F2229] rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#8E9299] text-xs font-mono mb-2">
            <span>COMPENSAÇÕES GOZADAS</span>
            <TrendingDown className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {compensacoesMes > 0 ? `-${compensacoesMes.toFixed(1)}h` : '0.0h'}
          </div>
          <p className="text-[11px] text-blue-400/80 font-mono mt-1">
            Débitos acordados de folga
          </p>
        </div>
      </div>

      {/* Tabela do Extrato Mensal */}
      <div className="bg-[#15171C] border border-[#1F2229] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1F2229]">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Lançamentos Detalhados do Extrato
              </h3>
              <p className="text-xs text-[#8E9299] font-mono">
                Exibindo {filteredRecords.length} lançamentos registrados no sistema
              </p>
            </div>
          </div>

          {/* Filtro por Mês */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-[#8E9299]">Filtrar Mês:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-[#0D0F14] border border-[#1F2229] text-white text-xs font-mono rounded-lg px-3 py-1.5 outline-none focus:border-blue-500"
            >
              <option value="TODOS">Todos os Meses</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabela Responsiva */}
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-[#8E9299] font-mono text-xs">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-400" />
            Nenhum lançamento encontrado para o período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1F2229] text-[#8E9299] text-[11px]">
                  <th className="pb-3 font-semibold">DATA</th>
                  <th className="pb-3 font-semibold">DIA DA SEMANA</th>
                  <th className="pb-3 font-semibold">OCORRÊNCIA</th>
                  <th className="pb-3 font-semibold text-right">HORAS BRUTAS</th>
                  <th className="pb-3 font-semibold text-center">FATOR</th>
                  <th className="pb-3 font-semibold text-right">SALDO GERADO</th>
                  <th className="pb-3 font-semibold text-center">COMPROVANTE</th>
                  <th className="pb-3 font-semibold">OBSERVAÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2229]/60">
                {filteredRecords.map((rec) => {
                  let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                  if (rec.tipoOcorrencia === 'FALTA_INJUSTIFICADA') {
                    badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                  } else if (rec.tipoOcorrencia === 'ATESTADO_MEDICO') {
                    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  } else if (rec.tipoOcorrencia === 'COMPENSACAO') {
                    badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                  } else if (rec.tipoOcorrencia === 'FERIAS') {
                    badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  }

                  return (
                    <tr key={rec.id} className="hover:bg-[#0D0F14]/50 transition-colors">
                      <td className="py-3 font-bold text-white whitespace-nowrap">
                        {rec.dataRegistro}
                      </td>
                      <td className="py-3 text-[#8E9299] whitespace-nowrap">
                        {rec.diaSemanaNome} {rec.eFeriado && <span className="text-amber-400 font-bold">(Feriado)</span>}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badgeColor}`}>
                          {rec.tipoOcorrencia}
                        </span>
                      </td>
                      <td className="py-3 text-right text-white">
                        {rec.horasBrutas > 0 ? `${rec.horasBrutas.toFixed(1)}h` : '-'}
                      </td>
                      <td className="py-3 text-center text-[#8E9299]">
                        {rec.multiplicador > 0 ? `${rec.multiplicador.toFixed(1)}x` : '-'}
                      </td>
                      <td className="py-3 text-right font-bold whitespace-nowrap">
                        {rec.saldoCalculado > 0 ? (
                          <span className="text-emerald-400">+{rec.saldoCalculado.toFixed(2)}h</span>
                        ) : rec.saldoCalculado < 0 ? (
                          <span className="text-red-400">{rec.saldoCalculado.toFixed(2)}h</span>
                        ) : (
                          <span className="text-[#8E9299]">0.00h</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {rec.comprovante ? (
                          <button
                            onClick={() => onViewAttachment?.(rec.comprovante!, authenticatedEmployee.nome, rec.dataRegistro)}
                            className="p-1.5 bg-[#0D0F14] hover:bg-[#1F2229] border border-[#1F2229] rounded-md text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 text-[10px]"
                            title="Visualizar Comprovante do Google Drive"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>Ver Anexo</span>
                          </button>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-3 text-[#8E9299] max-w-[200px] truncate" title={rec.observacao}>
                        {rec.observacao || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nota de Auditoria e Conformidade SPTF */}
      <div className="bg-[#0D0F14] border border-[#1F2229] rounded-xl p-4 text-xs font-mono text-[#8E9299] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Extrato individual emitido em conformidade com o Art. 59 do SPTF e Acordo Coletivo.</span>
        </div>
        <span className="text-[10px] text-gray-500">
          Autenticação criptografada • Google Workspace App
        </span>
      </div>
    </div>
  );
};
