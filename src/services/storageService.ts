import { Employee, TimeRecord, AdminUser, InsalubrityRecord, SystemConfig, PaystubRecord, DispensaSptfRecord } from '../types';
import { INITIAL_EMPLOYEES, INITIAL_TIME_RECORDS, INITIAL_ADMINS } from '../constants/defaultData';

const EMPLOYEES_KEY = 'banco_horas_employees_v1';
const RECORDS_KEY = 'banco_horas_records_v1';
const ADMINS_KEY = 'banco_horas_admins_v1';
const INSALUBRITY_KEY = 'banco_horas_insalubrity_v1';
const SYSTEM_CONFIG_KEY = 'banco_horas_system_config_v1';
const CURRENT_USER_EMAIL_KEY = 'banco_horas_current_email_v1';
const THEME_KEY = 'banco_horas_theme_v1';
const PAYSTUBS_KEY = 'comara_paystubs_v1';
const DISPENSAS_KEY = 'comara_dispensas_sptf_v1';

export const storageService = {
  getEmployees(): Employee[] {
    try {
      const stored = localStorage.getItem(EMPLOYEES_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler colaboradores do localStorage', e);
    }
    return [];
  },

  saveEmployees(employees: Employee[]) {
    try {
      localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
    } catch (e) {
      console.error('Erro ao salvar colaboradores no localStorage', e);
    }
  },

  getTimeRecords(): TimeRecord[] {
    try {
      const stored = localStorage.getItem(RECORDS_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler registros do localStorage', e);
    }
    return [];
  },

  saveTimeRecords(records: TimeRecord[]) {
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Erro ao salvar registros no localStorage', e);
    }
  },

  addTimeRecord(record: TimeRecord) {
    const records = this.getTimeRecords();
    records.unshift(record);
    this.saveTimeRecords(records);
    return records;
  },

  saveTimeRecord(record: TimeRecord) {
    const records = this.getTimeRecords();
    const idx = records.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      records[idx] = record;
    } else {
      records.unshift(record);
    }
    this.saveTimeRecords(records);
    return records;
  },

  addTimeRecordsBatch(newRecords: TimeRecord[]) {
    const records = this.getTimeRecords();
    const combined = [...newRecords, ...records];
    this.saveTimeRecords(combined);
    return combined;
  },

  deleteTimeRecord(id: string) {
    const records = this.getTimeRecords();
    const filtered = records.filter(r => r.id !== id);
    this.saveTimeRecords(filtered);
    return filtered;
  },

  updateEmployee(employee: Employee) {
    const employees = this.getEmployees();
    const index = employees.findIndex(e => e.id === employee.id || e.matricula === employee.matricula);
    if (index >= 0) {
      employees[index] = employee;
    } else {
      employees.push(employee);
    }
    this.saveEmployees(employees);
    return employees;
  },

  // Insalubridade Records
  getInsalubrityRecords(): InsalubrityRecord[] {
    try {
      const stored = localStorage.getItem(INSALUBRITY_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler registros de insalubridade do localStorage', e);
    }
    return [];
  },

  saveInsalubrityRecords(records: InsalubrityRecord[]) {
    try {
      localStorage.setItem(INSALUBRITY_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Erro ao salvar registros de insalubridade no localStorage', e);
    }
  },

  addInsalubrityRecord(record: InsalubrityRecord) {
    const records = this.getInsalubrityRecords();
    records.unshift(record);
    this.saveInsalubrityRecords(records);
    return records;
  },

  saveInsalubrityRecord(record: InsalubrityRecord) {
    const records = this.getInsalubrityRecords();
    const idx = records.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      records[idx] = record;
    } else {
      records.unshift(record);
    }
    this.saveInsalubrityRecords(records);
    return records;
  },

  deleteInsalubrityRecord(id: string) {
    const records = this.getInsalubrityRecords();
    const filtered = records.filter(r => r.id !== id);
    this.saveInsalubrityRecords(filtered);
    return filtered;
  },

  // System Configuration (Logo URL, etc.)
  getSystemConfig(): SystemConfig {
    try {
      const stored = localStorage.getItem(SYSTEM_CONFIG_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler configurações do sistema do localStorage', e);
    }
    return {
      logoUrl: '',
      companyName: 'COMARA',
      subtitle: 'Comissão de Aeroportos da Região Amazônica',
    };
  },

  saveSystemConfig(config: SystemConfig) {
    try {
      localStorage.setItem(SYSTEM_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Erro ao salvar configurações do sistema no localStorage', e);
    }
  },

  // RBAC & Admins
  getAdmins(): AdminUser[] {
    try {
      const stored = localStorage.getItem(ADMINS_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler administradores do localStorage', e);
    }
    this.saveAdmins(INITIAL_ADMINS);
    return INITIAL_ADMINS;
  },

  saveAdmins(admins: AdminUser[]) {
    try {
      localStorage.setItem(ADMINS_KEY, JSON.stringify(admins));
    } catch (e) {
      console.error('Erro ao salvar administradores no localStorage', e);
    }
  },

  getCurrentUserEmail(): string {
    return localStorage.getItem(CURRENT_USER_EMAIL_KEY) || 'coari.comara@gmail.com';
  },

  setCurrentUserEmail(email: string) {
    localStorage.setItem(CURRENT_USER_EMAIL_KEY, email);
  },

  isAdmin(email: string): boolean {
    const admins = this.getAdmins();
    const clean = email.trim().toLowerCase();
    return admins.some(a => a.ativo && a.email.trim().toLowerCase() === clean);
  },

  // Theme Management
  getTheme(): 'dark' | 'light' {
    return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark';
  },

  setTheme(theme: 'dark' | 'light') {
    localStorage.setItem(THEME_KEY, theme);
  },

  saveTheme(theme: 'dark' | 'light') {
    this.setTheme(theme);
  },

  // Paystubs (Contracheques Digitais)
  getPaystubs(): PaystubRecord[] {
    try {
      const stored = localStorage.getItem(PAYSTUBS_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler contracheques do localStorage', e);
    }
    return [];
  },

  savePaystubs(paystubs: PaystubRecord[]) {
    try {
      localStorage.setItem(PAYSTUBS_KEY, JSON.stringify(paystubs));
    } catch (e) {
      console.error('Erro ao salvar contracheques no localStorage', e);
    }
  },

  savePaystub(paystub: PaystubRecord) {
    const list = this.getPaystubs();
    const idx = list.findIndex(p => p.id === paystub.id || (p.matricula === paystub.matricula && p.mesAno === paystub.mesAno));
    if (idx >= 0) {
      list[idx] = paystub;
    } else {
      list.push(paystub);
    }
    this.savePaystubs(list);
    return list;
  },

  deletePaystub(id: string) {
    const list = this.getPaystubs().filter(p => p.id !== id);
    this.savePaystubs(list);
    return list;
  },

  getPaystubsByMatricula(matricula: string): PaystubRecord[] {
    const clean = matricula.trim().toUpperCase();
    return this.getPaystubs().filter(p => p.matricula.trim().toUpperCase() === clean);
  },

  // Dispensas de SPTF
  getDispensasSptf(): DispensaSptfRecord[] {
    try {
      const stored = localStorage.getItem(DISPENSAS_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Erro ao ler dispensas SPTF do localStorage', e);
    }
    return [];
  },

  saveDispensasSptf(dispensas: DispensaSptfRecord[]) {
    try {
      localStorage.setItem(DISPENSAS_KEY, JSON.stringify(dispensas));
    } catch (e) {
      console.error('Erro ao salvar dispensas SPTF no localStorage', e);
    }
  },

  addDispensaSptf(dispensa: DispensaSptfRecord) {
    const list = this.getDispensasSptf();
    const idx = list.findIndex(d => d.id === dispensa.id);
    if (idx >= 0) {
      list[idx] = dispensa;
    } else {
      list.unshift(dispensa);
    }
    this.saveDispensasSptf(list);
    return list;
  },

  deleteDispensaSptf(id: string) {
    const list = this.getDispensasSptf().filter(d => d.id !== id);
    this.saveDispensasSptf(list);
    return list;
  },

  // Zerar completamente a base para importação limpa
  clearAllData() {
    this.saveEmployees([]);
    this.saveTimeRecords([]);
    this.savePaystubs([]);
    this.saveDispensasSptf([]);
    return {
      employees: [] as Employee[],
      records: [] as TimeRecord[],
    };
  },

  // Restaurar dados padrão de demonstração
  resetToDefaults() {
    this.saveEmployees(INITIAL_EMPLOYEES);
    this.saveTimeRecords(INITIAL_TIME_RECORDS);
    this.saveAdmins(INITIAL_ADMINS);
    this.setCurrentUserEmail('coari.comara@gmail.com');
    return {
      employees: INITIAL_EMPLOYEES,
      records: INITIAL_TIME_RECORDS,
      admins: INITIAL_ADMINS,
    };
  }
};
