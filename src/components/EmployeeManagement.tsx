import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Employee, TimeRecord, Branch, EmployeeStatus } from '../types';
import { parseEmployeesCSV, generateEmployeesTemplateCSV, triggerFileDownload } from '../utils/csvHandler';
import { getEmployeeTotalBalance, formatHoursDecimal, formatHoursToDays } from '../utils/calculations';
import { firestoreService } from '../services/firestoreService';
import { authService } from '../services/authService';
import { 
  Users, 
  UploadCloud, 
  Download, 
  UserPlus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Edit, 
  Plus, 
  Building, 
  FileSpreadsheet, 
  ExternalLink,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface EmployeeManagementProps {
  employees: Employee[];
  records: TimeRecord[];
  onUpdateEmployees: (employees: Employee[]) => void;
  onViewStatement: (matricula: string) => void;
  onQuickNewEntry: (matricula: string) => void;
  theme?: 'dark' | 'light';
}

export type BalanceFilter = 'TODOS' | 'CREDOR' | 'DEVEDOR' | 'ZERADO';
export type SortKey = 'nome' | 'saldo' | 'matricula' | 'funcao' | 'sede' | 'dataAdmissao' | 'status' | 'statusBanco';
export type MobileSortOption = 'nome_asc' | 'nome_desc' | 'saldo_asc' | 'saldo_desc';

export interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({
  employees,
  records,
  onUpdateEmployees,
  onViewStatement,
  onQuickNewEntry,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // 0. Detecção Responsiva de Mobile (< 768px)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Estados de Filtro & Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSede, setFilterSede] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('TODOS');
  
  // 2. Estado de Ordenação Dinâmica
  const [sortOption, setSortOption] = useState<MobileSortOption>('nome_asc');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'nome',
    direction: 'asc',
  });

  const [mobileExpandedMatricula, setMobileExpandedMatricula] = useState<string | null>(null);
  
  // CSV Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    success: boolean;
    message: string;
    errors?: string[];
  } | null>(null);

  // Manual Employee Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form State
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [funcao, setFuncao] = useState('');
  const [sede, setSede] = useState<Branch>('KO');
  const [sedeAtual, setSedeAtual] = useState<Branch>('KO');
  const [isAlocadoTemporario, setIsAlocadoTemporario] = useState(false);
  const [dataInicioAlocacao, setDataInicioAlocacao] = useState('');
  const [dataFimAlocacao, setDataFimAlocacao] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState('2024-01-15');
  const [status, setStatus] = useState<EmployeeStatus>('Ativo');
  const [dataInicioStatus, setDataInicioStatus] = useState('');
  const [dataFimStatus, setDataFimStatus] = useState('');
  const [motivoStatus, setMotivoStatus] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [grauInsalubridadeFixa, setGrauInsalubridadeFixa] = useState<string>('ISENTO');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const formatCPF = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleGenerateRandom6DigitPassword = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setInitialPassword(randomPin);
    setShowInitialPassword(true);
  };

  // -------------------------------------------------------------
  // CONTAGENS DE SALDO (PILLS KPI COUNTER)
  // -------------------------------------------------------------
  const balanceCounts = useMemo(() => {
    let todos = 0;
    let credor = 0;
    let devedor = 0;
    let zerado = 0;

    employees.forEach(emp => {
      const bal = getEmployeeTotalBalance(emp.matricula, employees, records);
      todos++;
      if (bal.saldoTotalHoras > 0.05) credor++;
      else if (bal.saldoTotalHoras < -0.05) devedor++;
      else zerado++;
    });

    return { todos, credor, devedor, zerado };
  }, [employees, records]);

  // -------------------------------------------------------------
  // COMBINAÇÃO DE BUSCA, FILTROS E ORDENAÇÃO VIA useMemo
  // -------------------------------------------------------------
  const filteredAndSortedEmployees = useMemo(() => {
    return employees
      .map((emp) => {
        const bal = getEmployeeTotalBalance(emp.matricula, employees, records);
        return { emp, bal };
      })
      .filter(({ emp, bal }) => {
        // 1. Filtro de Sede
        if (filterSede !== 'TODAS' && emp.sede !== filterSede && emp.sede_atual !== filterSede) {
          return false;
        }

        // 2. Filtro de Status Contratual
        if (filterStatus !== 'TODOS' && emp.status !== filterStatus) {
          return false;
        }

        // 3. Filtro Rápido de Saldo (Pills)
        if (balanceFilter === 'CREDOR' && bal.saldoTotalHoras <= 0.05) {
          return false;
        }
        if (balanceFilter === 'DEVEDOR' && bal.saldoTotalHoras >= -0.05) {
          return false;
        }
        if (balanceFilter === 'ZERADO' && Math.abs(bal.saldoTotalHoras) > 0.05) {
          return false;
        }

        // 4. Busca Textual por Nome, Matrícula ou Função/Cargo
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const matchMat = emp.matricula.toLowerCase().includes(q);
          const matchNome = emp.nome.toLowerCase().includes(q);
          const matchFunc = (emp.funcao || emp.cargo || '').toLowerCase().includes(q);
          if (!matchMat && !matchNome && !matchFunc) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortConfig.key) {
          case 'nome':
            comparison = a.emp.nome.localeCompare(b.emp.nome, 'pt-BR', { sensitivity: 'base' });
            break;
          case 'saldo':
            // Ordenação numérica real considerando positivos e negativos
            comparison = a.bal.saldoTotalHoras - b.bal.saldoTotalHoras;
            break;
          case 'matricula':
            comparison = a.emp.matricula.localeCompare(b.emp.matricula, 'pt-BR', { numeric: true });
            break;
          case 'funcao':
            comparison = (a.emp.funcao || '').localeCompare(b.emp.funcao || '', 'pt-BR', { sensitivity: 'base' });
            break;
          case 'sede':
            comparison = (a.emp.sede || '').localeCompare(b.emp.sede || '', 'pt-BR');
            break;
          case 'dataAdmissao':
            comparison = (a.emp.dataAdmissao || '').localeCompare(b.emp.dataAdmissao || '');
            break;
          case 'status':
            comparison = (a.emp.status || '').localeCompare(b.emp.status || '');
            break;
          case 'statusBanco':
            comparison = a.bal.status.localeCompare(b.bal.status);
            break;
          default:
            comparison = 0;
        }
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
  }, [employees, records, filterSede, filterStatus, balanceFilter, searchTerm, sortConfig]);

  // -------------------------------------------------------------
  // HANDLERS DE ORDENAÇÃO (MOBILE & DESKTOP)
  // -------------------------------------------------------------
  const handleSortOptionChange = (option: MobileSortOption) => {
    setSortOption(option);
    switch (option) {
      case 'nome_asc':
        setSortConfig({ key: 'nome', direction: 'asc' });
        break;
      case 'nome_desc':
        setSortConfig({ key: 'nome', direction: 'desc' });
        break;
      case 'saldo_asc':
        // Mais Devedor (Menor Saldo Primeiro: ex -20h antes de +10h)
        setSortConfig({ key: 'saldo', direction: 'asc' });
        break;
      case 'saldo_desc':
        // Mais Credor (Maior Saldo Primeiro: ex +20h antes de -10h)
        setSortConfig({ key: 'saldo', direction: 'desc' });
        break;
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      const newDir = prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : (key === 'saldo' ? 'desc' : 'asc');
      if (key === 'nome') {
        setSortOption(newDir === 'asc' ? 'nome_asc' : 'nome_desc');
      } else if (key === 'saldo') {
        setSortOption(newDir === 'asc' ? 'saldo_asc' : 'saldo_desc');
      }
      return {
        key,
        direction: newDir,
      };
    });
  };

  // Helper visual para os ícones de ordenação nos cabeçalhos
  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity ml-1 inline shrink-0" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-400 font-bold ml-1 inline shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-400 font-bold ml-1 inline shrink-0" />
    );
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateEmployeesTemplateCSV();
    triggerFileDownload(csvContent, 'template_colaboradores_banco_horas.csv');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportFeedback(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const result = await parseEmployeesCSV(content, employees, 'update');

      if (result.success) {
        const empMap = new Map<string, Employee>();
        employees.forEach((emp) => empMap.set(emp.matricula.toUpperCase(), emp));
        result.data.forEach((newEmp) => empMap.set(newEmp.matricula.toUpperCase(), newEmp));

        const updatedList = Array.from(empMap.values());
        onUpdateEmployees(updatedList);

        setImportFeedback({
          success: true,
          message: `Importação concluída com sucesso! ${result.importedCount} colaboradores processados (${result.duplicateCount} atualizados).`,
          errors: result.errors,
        });
      } else {
        setImportFeedback({
          success: false,
          message: `Falha na importação do CSV. Verifique a formatação do arquivo.`,
          errors: result.errors,
        });
      }
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setMatricula(`MAT-${Math.floor(1000 + Math.random() * 9000)}`);
    setNome('');
    setInitialPassword('');
    setShowInitialPassword(false);
    setFuncao('Operador de Campo');
    setSede('KO');
    setSedeAtual('KO');
    setIsAlocadoTemporario(false);
    setDataInicioAlocacao('');
    setDataFimAlocacao('');
    setDataAdmissao(new Date().toISOString().split('T')[0]);
    setStatus('Ativo');
    setDataInicioStatus('');
    setDataFimStatus('');
    setMotivoStatus('');
    setEmail('');
    setTelefone('');
    setSaldoInicial(0);
    setGrauInsalubridadeFixa('ISENTO');
    setAvatarUrl('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setMatricula(emp.matricula);
    setNome(emp.nome);
    setInitialPassword('');
    setShowInitialPassword(false);
    setFuncao(emp.funcao);
    setSede(emp.sede);
    setSedeAtual(emp.sede_atual || emp.sede);
    setIsAlocadoTemporario(Boolean(emp.sede_atual && emp.sede_atual !== emp.sede));
    setDataInicioAlocacao(emp.dataInicioAlocacao || '');
    setDataFimAlocacao(emp.dataFimAlocacao || '');
    setDataAdmissao(emp.dataAdmissao || '2024-01-01');
    setStatus(emp.status);
    setDataInicioStatus(emp.dataInicioStatus || '');
    setDataFimStatus(emp.dataFimStatus || '');
    setMotivoStatus(emp.motivoStatus || '');
    setEmail(emp.email || '');
    setTelefone(emp.telefone || '');
    setSaldoInicial(emp.saldoInicialHoras || 0);
    setGrauInsalubridadeFixa(emp.grauInsalubridadeFixa || 'ISENTO');
    setAvatarUrl(emp.avatarUrl || emp.url_foto_perfil || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setTimeout(() => {
        const photoData = event.target?.result as string;
        setAvatarUrl(photoData);
        setIsUploadingPhoto(false);
      }, 500);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!matricula.trim() || !nome.trim()) {
      setFormError('Matrícula e Nome são campos obrigatórios.');
      return;
    }

    const cleanMatricula = matricula.trim().toUpperCase();

    if (!editingEmployee) {
      const exists = employees.some((e) => e.matricula.toUpperCase() === cleanMatricula);
      if (exists) {
        setFormError(`Já existe um colaborador cadastrado com a matrícula "${cleanMatricula}".`);
        return;
      }
    }

    const hasInitialPassword = initialPassword.trim().length >= 4;
    const isEditing = Boolean(editingEmployee);

    // Regra de Negócio:
    // Se o RH preencher a senha no cadastro: senhaCadastrada: true e primeiroAcesso: false
    // Se o RH deixar em branco: primeiroAcesso: true e senhaCadastrada: false (ou manter estado atual se edição)
    const primeiroAcesso = hasInitialPassword
      ? false
      : (isEditing ? (editingEmployee!.primeiroAcesso ?? true) : true);

    const senhaCadastrada = hasInitialPassword
      ? true
      : (isEditing ? (editingEmployee!.senhaCadastrada ?? false) : false);

    const employeeToSave: Employee = {
      id: editingEmployee ? editingEmployee.id : `emp-${Date.now()}`,
      matricula: cleanMatricula,
      nome: nome.trim(),
      funcao: funcao.trim() || 'Técnico de Manutenção',
      cargo: funcao.trim() || 'Técnico de Manutenção',
      sede,
      sede_origem: sede,
      sede_atual: isAlocadoTemporario ? sedeAtual : sede,
      dataInicioAlocacao: isAlocadoTemporario ? dataInicioAlocacao : undefined,
      dataFimAlocacao: isAlocadoTemporario ? dataFimAlocacao : undefined,
      dataAdmissao: dataAdmissao || '2024-01-15',
      status,
      dataInicioStatus: ['Férias', 'Afastado'].includes(status) ? dataInicioStatus : undefined,
      dataFimStatus: ['Férias', 'Afastado'].includes(status) ? dataFimStatus : undefined,
      motivoStatus: ['Férias', 'Afastado'].includes(status) ? motivoStatus : undefined,
      email: email.trim(),
      telefone: telefone.trim(),
      saldoInicialHoras: Number(saldoInicial) || 0,
      grauInsalubridadeFixa: (grauInsalubridadeFixa as any) || 'ISENTO',
      primeiroAcesso,
      senhaCadastrada,
      senhaInicial: hasInitialPassword ? initialPassword.trim() : undefined,
      avatarUrl: avatarUrl || undefined,
      url_foto_perfil: avatarUrl || undefined,
      id_drive_foto: editingEmployee?.id_drive_foto || `foto_${cleanMatricula}_drive`,
    };

    setIsSaving(true);
    try {
      // 1. Gravação direta no Firestore
      await firestoreService.saveEmployee(employeeToSave);

      // 2. Se o RH definiu a senha inicial, registra no módulo de Auth
      if (hasInitialPassword) {
        await authService.setPasswordByAdmin(
          cleanMatricula,
          nome.trim(),
          initialPassword.trim(),
          'RH'
        );
      }

      // Log de Auditoria no Firestore
      await firestoreService.logSystemEvent({
        tipo: 'ALTERACAO_PERMISSAO_RBAC',
        descricao: editingEmployee 
          ? `Edição de perfil/cadastro do colaborador #${cleanMatricula} (${nome.trim()})`
          : `Cadastro de novo colaborador #${cleanMatricula} (${nome.trim()})`,
        usuario: 'GESTOR_RH',
        matricula: cleanMatricula,
        detalhes: {
          matricula: cleanMatricula,
          nome: nome.trim(),
          funcao: funcao.trim(),
          sede,
          status,
        }
      });

      // 3. Atualiza estado central no App
      let updatedList: Employee[];
      if (editingEmployee) {
        updatedList = employees.map((emp) => (emp.id === editingEmployee.id ? employeeToSave : emp));
      } else {
        updatedList = [employeeToSave, ...employees];
      }

      onUpdateEmployees(updatedList);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao salvar colaborador:', err);
      setFormError(err?.message || 'Erro ao gravar informações no Cloud Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {isMobile ? (
        /* ========================================================= */
        /* 1. VISÃO EXCLUSIVA MOBILE (< 768px)                       */
        /* ========================================================= */
        <div className="p-2 font-sans" id="mobile-employee-management">
          {/* Barra de Controle Mobile (Topo da Tela): Busca + Select de Ordenação + Pílulas */}
          <div className="flex flex-col gap-2 mb-4">
            {/* 1. Barra de Pesquisa */}
            <div className="relative w-full">
              <input 
                type="text" 
                placeholder="Pesquisar por nome ou matrícula..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className={`p-3 pr-9 border rounded-lg w-full text-base focus:outline-hidden ${
                  isDark 
                    ? 'bg-[#15171C] border-[#1F2229] text-white placeholder-[#8E9299] focus:border-blue-500' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                }`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className={`absolute right-3 top-3.5 text-xs p-1 cursor-pointer ${isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                  title="Limpar pesquisa"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* 2. Seletor de Ordenação */}
            <select 
              value={sortOption} 
              onChange={(e) => handleSortOptionChange(e.target.value as MobileSortOption)}
              className={`p-3 border rounded-lg w-full bg-white font-medium text-base focus:outline-hidden cursor-pointer ${
                isDark 
                  ? '!bg-[#15171C] border-[#1F2229] text-white focus:border-blue-500' 
                  : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
              }`}
            >
              <option value="nome_asc">Nome (A - Z)</option>
              <option value="nome_desc">Nome (Z - A)</option>
              <option value="saldo_asc">Mais Devedor (Menor Saldo)</option>
              <option value="saldo_desc">Mais Credor (Maior Saldo)</option>
            </select>

            {/* 3. Pílulas de Filtro Rápido: [Todos] [Positivos] [Negativos] */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBalanceFilter('TODOS')}
                className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold text-center border transition-all cursor-pointer select-none ${
                  balanceFilter === 'TODOS'
                    ? isDark 
                      ? 'bg-blue-600/30 text-blue-400 border-blue-500/50 shadow-xs' 
                      : 'bg-blue-100 text-blue-800 border-blue-300 shadow-xs font-black'
                    : isDark 
                      ? 'bg-[#15171C] text-[#8E9299] border-[#1F2229]' 
                      : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Todos ({balanceCounts.todos})
              </button>

              <button
                type="button"
                onClick={() => setBalanceFilter('CREDOR')}
                className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold text-center border transition-all cursor-pointer select-none ${
                  balanceFilter === 'CREDOR'
                    ? isDark 
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-xs' 
                      : 'bg-green-100 text-green-800 border-green-300 shadow-xs font-black'
                    : isDark 
                      ? 'bg-[#15171C] text-[#8E9299] border-[#1F2229]' 
                      : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Positivos ({balanceCounts.credor})
              </button>

              <button
                type="button"
                onClick={() => setBalanceFilter('DEVEDOR')}
                className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold text-center border transition-all cursor-pointer select-none ${
                  balanceFilter === 'DEVEDOR'
                    ? isDark 
                      ? 'bg-red-950/80 text-red-400 border-red-500/50 shadow-xs' 
                      : 'bg-red-100 text-red-800 border-red-300 shadow-xs font-black'
                    : isDark 
                      ? 'bg-[#15171C] text-[#8E9299] border-[#1F2229]' 
                      : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Negativos ({balanceCounts.devedor})
              </button>
            </div>
          </div>

          {/* Lista Mobile Enxuta (Cards de Linha Única) */}
          <div className="flex flex-col gap-2">
            {filteredAndSortedEmployees.length === 0 ? (
              <div className={`p-6 rounded-lg border text-center ${
                isDark ? 'bg-[#15171C] border-[#1F2229] text-gray-400' : 'bg-white border-slate-200 text-slate-500'
              }`}>
                <p className="text-xs font-semibold">Nenhum colaborador encontrado com os filtros atuais.</p>
              </div>
            ) : (
              filteredAndSortedEmployees.map(({ emp, bal }) => {
                const isPositivo = bal.saldoTotalHoras >= 0;
                const formattedSaldo = bal.saldoTotalHoras > 0 
                  ? `+${bal.saldoTotalHoras.toFixed(1)}h` 
                  : `${bal.saldoTotalHoras.toFixed(1)}h`;

                return (
                  <div 
                    key={emp.matricula} 
                    onClick={() => onViewStatement(emp.matricula)}
                    className={`p-3 rounded-lg border flex justify-between items-center shadow-xs cursor-pointer active:scale-[0.99] transition-all ${
                      isDark 
                        ? 'bg-[#15171C] border-[#1F2229] hover:border-blue-500/50' 
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <p className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>
                        {emp.nome}
                      </p>
                      <p className={`text-xs mt-0.5 font-mono ${isDark ? 'text-[#8E9299]' : 'text-gray-500'}`}>
                        Matrícula: {emp.matricula}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full font-bold text-sm shrink-0 font-mono ${
                      isPositivo 
                        ? isDark 
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' 
                          : 'bg-green-100 text-green-700 border border-green-200' 
                        : isDark 
                          ? 'bg-red-950/80 text-red-400 border border-red-800/60' 
                          : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      {formattedSaldo}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* 2. VISÃO DESKTOP (HEADER BANNER + FILTROS + TABELA)       */
        /* ========================================================= */
        <div className="space-y-6" id="desktop-employee-management">
          {/* Header Banner */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border shadow-xs transition-all ${
            isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
          }`}>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full font-mono border ${
                  isDark ? 'bg-[#1F2229] text-blue-400 border-[#2A2E38]' : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  Módulo A • Pessoas
                </span>
                <span className={`text-xs font-mono ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                  Gestão de Pessoas & Lotação
                </span>
              </div>
              <h2 className={`text-xl font-bold mt-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Gestão e Importação de Colaboradores
              </h2>
              <p className={`text-xs max-w-2xl mt-0.5 font-mono ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                Cadastre novos colaboradores manualmente ou realize a carga massiva via arquivo <strong className={isDark ? 'text-[#E0E2E5]' : 'text-slate-800'}>.CSV</strong> com suporte a tratamento automático de duplicidades pela <strong className={isDark ? 'text-[#E0E2E5]' : 'text-slate-800'}>Matrícula</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors font-mono border cursor-pointer ${
                  isDark 
                    ? 'text-[#E0E2E5] bg-[#1F2229] hover:bg-[#2A2E38] border-[#1F2229]' 
                    : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
                }`}
                title="Baixar planilha modelo CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
                Template CSV
              </button>
              
              <label className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors font-mono border ${
                isDark 
                  ? 'text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-800/50' 
                  : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
              }`}>
                <UploadCloud className="w-4 h-4 text-emerald-500" />
                <span>Importar CSV</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isImporting}
                />
              </label>

              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-lg transition-all shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Novo Colaborador
              </button>
            </div>
          </div>

          {/* Import Feedback Banner */}
          {importFeedback && (
            <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
              importFeedback.success 
                ? isDark ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isDark ? 'bg-red-950/40 border-red-800/60 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-start gap-2.5">
                {importFeedback.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-sm">{importFeedback.message}</p>
                  {importFeedback.errors && importFeedback.errors.length > 0 && (
                    <ul className={`mt-1.5 list-disc list-inside space-y-0.5 text-xs ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                      {importFeedback.errors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setImportFeedback(null)}
                className={`font-bold text-xs cursor-pointer ${isDark ? 'text-[#8E9299] hover:text-[#E0E2E5]' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Fechar
              </button>
            </div>
          )}

          {/* Filter, Search & Balance Pills Bar */}
          <div className={`p-4 rounded-2xl border shadow-xs space-y-3.5 ${
            isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
          }`}>
            {/* Linha Superior: Campo de Busca + Selects de Sede e Status */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, matrícula ou função..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-8 py-1.5 rounded-lg text-xs font-mono focus:outline-hidden border ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] placeholder-[#5C616A] focus:border-[#3B82F6]' 
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto text-xs font-mono">
                <select
                  value={filterSede}
                  onChange={(e) => setFilterSede(e.target.value)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium border focus:outline-hidden cursor-pointer ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-[#3B82F6]' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  <option value="TODAS">Todas as Sedes</option>
                  <option value="KO">Sede KO (Coari)</option>
                  <option value="BE">Sede BE (Belém)</option>
                  <option value="MN">Sede MN (Manaus)</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium border focus:outline-hidden cursor-pointer ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-[#3B82F6]' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Afastado">Afastado</option>
                  <option value="Férias">Férias</option>
                </select>
              </div>
            </div>

            {/* Linha Inferior: Pílulas de Filtro Rápido de Saldo (Filter Pills) */}
            <div className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono ${
              isDark ? 'border-[#1F2229]' : 'border-slate-100'
            }`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${
                  isDark ? 'text-[#8E9299]' : 'text-slate-500'
                }`}>
                  Saldo SPTF:
                </span>

                {/* Pílula: TODOS */}
                <button
                  type="button"
                  onClick={() => setBalanceFilter('TODOS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer select-none ${
                    balanceFilter === 'TODOS'
                      ? isDark 
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-xs' 
                        : 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs font-black'
                      : isDark 
                        ? 'bg-[#0D0F14] text-[#8E9299] hover:text-[#E0E2E5] border-[#1F2229]' 
                        : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200'
                  }`}
                >
                  <span>Todos</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    balanceFilter === 'TODOS' 
                      ? isDark ? 'bg-blue-500/30 text-blue-200' : 'bg-blue-200 text-blue-800' 
                      : isDark ? 'bg-[#1F2229] text-gray-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {balanceCounts.todos}
                  </span>
                </button>

                {/* Pílula: CRÉDITO (POSITIVO) */}
                <button
                  type="button"
                  onClick={() => setBalanceFilter('CREDOR')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer select-none ${
                    balanceFilter === 'CREDOR'
                      ? isDark 
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-xs' 
                        : 'bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs font-black'
                      : isDark 
                        ? 'bg-[#0D0F14] text-[#8E9299] hover:text-emerald-400 border-[#1F2229]' 
                        : 'bg-white text-slate-600 hover:text-emerald-700 border-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Crédito (Positivo)</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    balanceFilter === 'CREDOR' 
                      ? isDark ? 'bg-emerald-800/40 text-emerald-200' : 'bg-emerald-200 text-emerald-900' 
                      : isDark ? 'bg-[#1F2229] text-gray-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {balanceCounts.credor}
                  </span>
                </button>

                {/* Pílula: DÉBITO (NEGATIVO) */}
                <button
                  type="button"
                  onClick={() => setBalanceFilter('DEVEDOR')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer select-none ${
                    balanceFilter === 'DEVEDOR'
                      ? isDark 
                        ? 'bg-red-950/80 text-red-400 border-red-500/50 shadow-xs' 
                        : 'bg-red-50 text-red-800 border-red-400 shadow-xs font-black'
                      : isDark 
                        ? 'bg-[#0D0F14] text-[#8E9299] hover:text-red-400 border-[#1F2229]' 
                        : 'bg-white text-slate-600 hover:text-red-700 border-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span>Débito (Negativo)</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    balanceFilter === 'DEVEDOR' 
                      ? isDark ? 'bg-red-800/40 text-red-200' : 'bg-red-200 text-red-900' 
                      : isDark ? 'bg-[#1F2229] text-gray-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {balanceCounts.devedor}
                  </span>
                </button>

                {/* Pílula: ZERADO */}
                <button
                  type="button"
                  onClick={() => setBalanceFilter('ZERADO')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer select-none ${
                    balanceFilter === 'ZERADO'
                      ? isDark 
                        ? 'bg-slate-800 text-slate-200 border-slate-600 shadow-xs' 
                        : 'bg-slate-200 text-slate-900 border-slate-400 shadow-xs font-black'
                      : isDark 
                        ? 'bg-[#0D0F14] text-[#8E9299] hover:text-slate-200 border-[#1F2229]' 
                        : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>Zerado</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    balanceFilter === 'ZERADO' 
                      ? isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-300 text-slate-900' 
                      : isDark ? 'bg-[#1F2229] text-gray-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {balanceCounts.zerado}
                  </span>
                </button>
              </div>

              {/* Indicador de Ordenação Ativa e Contador de Resultados */}
              <div className="flex items-center gap-2">
                <span className={`text-[11px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                  Exibindo <strong>{filteredAndSortedEmployees.length}</strong> de {employees.length}
                </span>
                {(searchTerm || filterSede !== 'TODAS' || filterStatus !== 'TODOS' || balanceFilter !== 'TODOS') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterSede('TODAS');
                      setFilterStatus('TODOS');
                      setBalanceFilter('TODOS');
                    }}
                    className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                  >
                    Resetar Filtros
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* TABELA DESKTOP COMPLETA COM ROLAGEM & SORTING */}
          <div className={`rounded-2xl border shadow-xs overflow-hidden ${
            isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className={isDark ? 'bg-[#0D0F14]' : 'bg-slate-50'}>
                  <tr className={`text-[10px] uppercase font-bold border-b tracking-wider select-none ${
                    isDark ? 'text-[#8E9299] border-[#1F2229]' : 'text-slate-600 border-slate-200'
                  }`}>
                    {/* 1. Matrícula */}
                    <th 
                      onClick={() => handleSort('matricula')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors"
                      title="Clique para ordenar por Matrícula"
                    >
                      <div className="flex items-center gap-1">
                        <span>Matrícula</span>
                        {renderSortIcon('matricula')}
                      </div>
                    </th>

                    {/* 2. Nome */}
                    <th 
                      onClick={() => handleSort('nome')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors"
                      title="Clique para ordenar por Nome do Colaborador"
                    >
                      <div className="flex items-center gap-1">
                        <span>Nome do Colaborador</span>
                        {renderSortIcon('nome')}
                      </div>
                    </th>

                    {/* 3. Função / Cargo */}
                    <th 
                      onClick={() => handleSort('funcao')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors"
                      title="Clique para ordenar por Função / Cargo"
                    >
                      <div className="flex items-center gap-1">
                        <span>Função / Cargo</span>
                        {renderSortIcon('funcao')}
                      </div>
                    </th>

                    {/* 4. Sede */}
                    <th 
                      onClick={() => handleSort('sede')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors"
                      title="Clique para ordenar por Sede"
                    >
                      <div className="flex items-center gap-1">
                        <span>Sede</span>
                        {renderSortIcon('sede')}
                      </div>
                    </th>

                    {/* 5. Data Admissão */}
                    <th 
                      onClick={() => handleSort('dataAdmissao')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors"
                      title="Clique para ordenar por Data de Admissão"
                    >
                      <div className="flex items-center gap-1">
                        <span>Data Admissão</span>
                        {renderSortIcon('dataAdmissao')}
                      </div>
                    </th>

                    {/* 6. Status Contratual */}
                    <th 
                      onClick={() => handleSort('status')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors"
                      title="Clique para ordenar por Status"
                    >
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        {renderSortIcon('status')}
                      </div>
                    </th>

                    {/* 7. Saldo Atual SPTF (Numérico Real) */}
                    <th 
                      onClick={() => handleSort('saldo')}
                      className="py-3 px-4 text-right cursor-pointer group hover:text-blue-400 transition-colors"
                      title="Clique para ordenar por Saldo de Horas SPTF"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Saldo Atual (SPTF)</span>
                        {renderSortIcon('saldo')}
                      </div>
                    </th>

                    {/* 8. Status Banco */}
                    <th 
                      onClick={() => handleSort('statusBanco')}
                      className="py-3 px-4 text-center cursor-pointer group hover:text-blue-400 transition-colors"
                      title="Clique para ordenar por Status do Banco"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Status Banco</span>
                        {renderSortIcon('statusBanco')}
                      </div>
                    </th>

                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  isDark ? 'divide-[#1F2229] text-[#E0E2E5]' : 'divide-slate-200 text-slate-800'
                }`}>
                  {filteredAndSortedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={`py-12 text-center text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="w-6 h-6 text-gray-500" />
                          <p className="font-semibold text-sm">Nenhum colaborador localizado com os filtros selecionados.</p>
                          <p className="text-[11px]">Tente alterar a busca ou redefinir os filtros de saldo e sede.</p>
                          {(searchTerm || filterSede !== 'TODAS' || filterStatus !== 'TODOS' || balanceFilter !== 'TODOS') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchTerm('');
                                setFilterSede('TODAS');
                                setFilterStatus('TODOS');
                                setBalanceFilter('TODOS');
                              }}
                              className="mt-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Limpar Todos os Filtros
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedEmployees.map(({ emp, bal }) => {
                      return (
                        <tr key={emp.id} className={`transition-colors ${isDark ? 'hover:bg-[#1C1F26]' : 'hover:bg-slate-50/80'}`}>
                          <td className={`py-3.5 px-4 font-mono font-semibold whitespace-nowrap ${
                            isDark ? 'text-[#8E9299]' : 'text-slate-600'
                          }`}>
                            #{emp.matricula}
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            <div className="flex items-center gap-3">
                              {emp.avatarUrl || emp.url_foto_perfil ? (
                                <img
                                  src={emp.avatarUrl || emp.url_foto_perfil}
                                  alt={emp.nome}
                                  className={`w-8 h-8 rounded-full object-cover border shrink-0 ${
                                    isDark ? 'border-[#2A2E38]' : 'border-slate-200'
                                  }`}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                  isDark 
                                    ? 'bg-[#1F2229] border-[#2A2E38] text-blue-400' 
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}>
                                  {emp.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                                </div>
                              )}
                              <div>
                                <div className={`font-semibold text-xs ${isDark ? 'text-[#E0E2E5]' : 'text-slate-900'}`}>
                                  {emp.nome}
                                </div>
                                {emp.email && (
                                  <div className={`text-[11px] font-mono ${isDark ? 'text-[#5C616A]' : 'text-slate-500'}`}>
                                    {emp.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`py-3.5 px-4 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                            {emp.funcao}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2 py-0.5 font-bold rounded text-[10px] border ${
                                isDark 
                                  ? 'bg-[#1F2229] text-blue-400 border-[#2A2E38]' 
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {emp.sede}
                              </span>
                              {emp.sede_atual && emp.sede_atual !== emp.sede && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                  isDark 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`} title={`Alocado temporariamente em ${emp.sede_atual}`}>
                                  ➔ {emp.sede_atual}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`py-3.5 px-4 whitespace-nowrap ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                            {emp.dataAdmissao}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border ${
                                emp.status === 'Ativo' 
                                  ? isDark ? 'bg-emerald-950/40 text-green-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : emp.status === 'Férias'
                                  ? isDark ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                                  : isDark ? 'bg-purple-950/40 text-purple-300 border-purple-800/40' : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {emp.status}
                              </span>
                              {emp.dataInicioStatus && emp.dataFimStatus && (
                                <span className={`text-[9px] ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                                  {emp.dataInicioStatus} a {emp.dataFimStatus}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className={`font-bold text-xs ${
                              bal.saldoTotalHoras > 0 
                                ? isDark ? 'text-green-400' : 'text-emerald-600'
                                : bal.saldoTotalHoras < 0 
                                ? isDark ? 'text-red-400' : 'text-red-600'
                                : isDark ? 'text-[#8E9299]' : 'text-slate-500'
                            }`}>
                              {formatHoursDecimal(bal.saldoTotalHoras)}
                            </div>
                            <div className={`text-[10px] ${isDark ? 'text-[#5C616A]' : 'text-slate-400'}`}>
                              {formatHoursToDays(bal.saldoTotalHoras)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                              bal.status === 'CREDOR'
                                ? isDark ? 'bg-emerald-950/40 text-green-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : bal.status === 'DEVEDOR'
                                ? isDark ? 'bg-red-950/40 text-red-400 border-red-800/40' : 'bg-red-50 text-red-700 border-red-200'
                                : isDark ? 'bg-[#1F2229] text-[#8E9299] border-[#2A2E38]' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {bal.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5 font-sans">
                            <button
                              type="button"
                              onClick={() => onQuickNewEntry(emp.matricula)}
                              className={`px-2 py-1 font-bold rounded text-[11px] transition-colors border cursor-pointer ${
                                isDark 
                                  ? 'bg-[#1F2229] hover:bg-[#2A2E38] text-blue-400 border-[#1F2229]' 
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                              }`}
                              title="Lançar horas para este colaborador"
                            >
                              + Lançar
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewStatement(emp.matricula)}
                              className={`px-2 py-1 font-semibold rounded text-[11px] transition-colors border cursor-pointer ${
                                isDark 
                                  ? 'bg-[#1F2229] hover:bg-[#2A2E38] text-[#E0E2E5] border-[#1F2229]' 
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                              }`}
                              title="Ver extrato completo"
                            >
                              Extrato
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(emp)}
                              className={`p-1 rounded transition-colors inline-block align-middle cursor-pointer ${
                                isDark ? 'text-[#8E9299] hover:text-[#E0E2E5]' : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title="Editar colaborador"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE COLABORADOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div 
            className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border animate-in fade-in zoom-in-95 ${
              isDark ? 'bg-[#15171C] border-[#1F2229]' : 'bg-white border-slate-200'
            }`}
            id="employee-form-modal"
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isDark ? 'border-[#1F2229] bg-[#0D0F14]' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {editingEmployee ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={`cursor-pointer ${isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4 text-xs font-mono">
              {/* Foto de Perfil / Upload Google Drive */}
              <div className={`p-3.5 rounded-xl border flex items-center gap-4 ${
                isDark ? 'bg-[#0D0F14] border-[#1F2229]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="relative group shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Foto do colaborador"
                      className="w-14 h-14 rounded-full object-cover border-2 border-blue-500/50 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-14 h-14 rounded-full border flex items-center justify-center font-bold text-base ${
                      isDark 
                        ? 'bg-[#1F2229] border-[#2A2E38] text-blue-400' 
                        : 'bg-blue-50 border-blue-200 text-blue-600'
                    }`}>
                      {nome ? nome.split(' ').map((n) => n[0]).slice(0, 2).join('') : <Camera className="w-6 h-6 text-slate-400" />}
                    </div>
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={`font-bold text-[11px] block font-sans ${
                      isDark ? 'text-[#E0E2E5]' : 'text-slate-800'
                    }`}>
                      Foto de Perfil (Google Drive)
                    </label>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="text-[10px] text-red-500 hover:underline cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <p className={`text-[10px] font-sans ${isDark ? 'text-[#8E9299]' : 'text-slate-500'}`}>
                    Salva em <code className="text-blue-500">/Banco_de_Horas/Fotos_Colaboradores/FOTO_{matricula || 'MAT'}.jpg</code>
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className={`px-2.5 py-1 border rounded-md font-medium text-[10px] inline-flex items-center gap-1.5 transition-colors font-sans cursor-pointer ${
                        isDark 
                          ? 'bg-[#1F2229] hover:bg-[#2A2E38] text-[#E0E2E5] border-[#2A2E38]' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      <Camera className="w-3 h-3 text-blue-500" />
                      {avatarUrl ? 'Alterar Imagem' : 'Carregar Imagem (JPG/PNG)'}
                    </button>
                    {avatarUrl && (
                      <span className="text-[10px] text-emerald-500 inline-flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3" /> Imagem vinculada
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                    Matrícula <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    placeholder="Ex: MAT-1090"
                    className={`w-full px-3 py-2 rounded-lg font-mono font-bold border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                    Sede <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sede}
                    onChange={(e) => setSede(e.target.value as Branch)}
                    className={`w-full px-3 py-2 rounded-lg font-semibold border focus:outline-hidden cursor-pointer ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="KO">KO — Coari (AM)</option>
                    <option value="BE">BE — Belém (PA)</option>
                    <option value="MN">MN — Manaus (AM)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do colaborador"
                  className={`w-full px-3 py-2 rounded-lg border font-sans text-xs focus:outline-hidden ${
                    isDark 
                      ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                    Função / Cargo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    placeholder="Ex: Técnico de Campo"
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                    Data de Admissão
                  </label>
                  <input
                    type="date"
                    value={dataAdmissao}
                    onChange={(e) => setDataAdmissao(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden cursor-pointer ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Afastado">Afastado</option>
                    <option value="Férias">Férias</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className={`block font-semibold ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                      Insalubridade Fixa (NR-15)
                    </label>
                    <InfoTooltip 
                      theme={theme}
                      content="Percentual de adicional de insalubridade fixo em folha de pagamento (NR-15). ISENTO (0%), 10% (Grau Mínimo), 20% (Grau Médio) ou 40% (Grau Máximo)."
                    />
                  </div>
                  <select
                    value={grauInsalubridadeFixa}
                    onChange={(e) => setGrauInsalubridadeFixa(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden cursor-pointer font-bold ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-amber-400 focus:border-amber-500' 
                        : 'bg-white border-slate-300 text-amber-700 focus:border-amber-500'
                    }`}
                  >
                    <option value="ISENTO">ISENTO (Padrão)</option>
                    <option value="10%">10% (Grau Mínimo)</option>
                    <option value="20%">20% (Grau Médio)</option>
                    <option value="40%">40% (Grau Máximo)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className={`block font-semibold ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>
                      Saldo Inicial (Horas)
                    </label>
                    <InfoTooltip 
                      theme={theme}
                      content="Saldo legado de horas extras ou débitos anteriores ao início do controle neste sistema."
                    />
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    className={`w-full px-3 py-2 rounded-lg font-bold border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* CAMPOS DINÂMICOS DE STATUS (FÉRIAS / AFASTAMENTO) */}
              {['Férias', 'Afastado'].includes(status) && (
                <div className={`p-3.5 rounded-xl border space-y-2.5 animate-in fade-in ${
                  isDark ? 'bg-amber-950/20 border-amber-800/40' : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className={`flex items-center gap-1.5 font-bold text-[11px] ${
                    isDark ? 'text-amber-400' : 'text-amber-800'
                  }`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Período Vigente de {status.toUpperCase()}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                        Data Início do Período *
                      </label>
                      <input
                        type="date"
                        required
                        value={dataInicioStatus}
                        onChange={(e) => setDataInicioStatus(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                          isDark 
                            ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-amber-400' 
                            : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                        Data Término do Período *
                      </label>
                      <input
                        type="date"
                        required
                        value={dataFimStatus}
                        onChange={(e) => setDataFimStatus(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                          isDark 
                            ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-amber-400' 
                            : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                      Motivo / Justificativa (Ex: Período Aquisitivo, Licença INSS)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Férias 30 dias regulamentares"
                      value={motivoStatus}
                      onChange={(e) => setMotivoStatus(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                        isDark 
                          ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-amber-400' 
                            : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* ALOCAÇÃO TEMPORÁRIA / PRESTAÇÃO DE SERVIÇO EM OUTRA SEDE */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-blue-950/20 border-blue-900/40' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAlocadoTemporario}
                        onChange={(e) => setIsAlocadoTemporario(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span className={`font-bold text-[11px] ${isDark ? 'text-blue-400' : 'text-blue-800'}`}>
                        Prestação de Serviço Temporária (Missão em Outro Canteiro)
                      </span>
                    </label>
                    <InfoTooltip 
                      theme={theme}
                      content={`As horas registradas durante a vigência da missão temporária serão computadas e visualizadas no canteiro selecionado (${sedeAtual}).`}
                    />
                  </div>
                </div>

                {isAlocadoTemporario && (
                  <div className="space-y-2.5 pt-1 animate-in fade-in">
                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                          Canteiro Alocado
                        </label>
                        <select
                          value={sedeAtual}
                          onChange={(e) => setSedeAtual(e.target.value as Branch)}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold border focus:outline-hidden cursor-pointer ${
                            isDark 
                              ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-400' 
                              : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                          }`}
                        >
                          <option value="KO">KO — Coari</option>
                          <option value="BE">BE — Belém</option>
                          <option value="MN">MN — Manaus</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                          Início da Missão
                        </label>
                        <input
                          type="date"
                          value={dataInicioAlocacao}
                          onChange={(e) => setDataInicioAlocacao(e.target.value)}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                            isDark 
                              ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-400' 
                              : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-600'}`}>
                          Término Previsto
                        </label>
                        <input
                          type="date"
                          value={dataFimAlocacao}
                          onChange={(e) => setDataFimAlocacao(e.target.value)}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                            isDark 
                              ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-400' 
                              : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@empresa.com.br"
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#8E9299]' : 'text-slate-700'}`}>Telefone</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(92) 99999-9999"
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0D0F14] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* DEFINIÇÃO DE SENHA INICIAL PELO RH (OPCIONAL COM GERADOR DE 6 DÍGITOS) */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${
                isDark ? 'bg-[#0D0F14] border-[#2A2E38]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className={`flex items-center gap-1.5 font-bold text-xs ${
                      isDark ? 'text-[#E0E2E5]' : 'text-slate-800'
                    }`}>
                      <Lock className="w-3.5 h-3.5 text-blue-500" />
                      <span>Senha Inicial do Colaborador (Opcional - RH)</span>
                    </label>
                    <InfoTooltip 
                      theme={theme}
                      content="Regra: Se preenchida, o colaborador poderá consultar o extrato imediatamente informando Matrícula + Senha. Se deixada em branco, o colaborador definirá sua própria senha no Primeiro Acesso."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateRandom6DigitPassword}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all active:scale-95 cursor-pointer ${
                        isDark 
                          ? 'bg-blue-950/50 text-blue-300 border-blue-700/60 hover:bg-blue-900/60 shadow-xs' 
                          : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 shadow-xs'
                      }`}
                      title="Gerar sugestão de senha numérica aleatória de 6 dígitos"
                    >
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      <span>Gerar 6 Dígitos</span>
                    </button>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                      editingEmployee?.senhaCadastrada 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {editingEmployee?.senhaCadastrada ? 'Senha cadastrada' : 'Primeiro acesso pendente'}
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showInitialPassword ? 'text' : 'password'}
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    placeholder={editingEmployee ? "Deixe em branco para manter a senha atual ou use o gerador acima" : "Digite ou clique em 'Gerar 6 Dígitos' (mín. 4 caracteres)"}
                    className={`w-full px-3 py-2 pr-10 rounded-lg text-xs font-mono border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#15171C] border-[#1F2229] text-[#E0E2E5] focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowInitialPassword(!showInitialPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 p-1 cursor-pointer"
                  >
                    {showInitialPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className={`pt-4 border-t flex items-center justify-end space-x-2 font-sans ${
                isDark ? 'border-[#1F2229]' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 font-semibold cursor-pointer disabled:opacity-50 ${isDark ? 'text-[#8E9299] hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 font-bold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-lg shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isSaving ? 'Gravando no Firestore...' : 'Salvar Colaborador'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
