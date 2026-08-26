import { useState, useEffect, useRef, useCallback } from 'react';
import { AdminRole } from '../types';

export interface UseIdleTimerOptions {
  /**
   * Se o monitor de inatividade está ativo (ex: usuário autenticado)
   */
  enabled?: boolean;
  /**
   * Perfil do usuário atual para definir o tempo adaptativo (AUX_DA = 15min, RH_ADMIN/outros = 30min)
   */
  role?: AdminRole | string | null;
  /**
   * Tempo de aviso prévio antes do logout (padrão: 60 segundos)
   */
  warnSeconds?: number;
  /**
   * Sobrescrever tempo total de inatividade em segundos (opcional)
   */
  customTimeoutSeconds?: number;
  /**
   * Callback invocado quando o tempo de inatividade se esgota (Auto-Logoff)
   */
  onTimeout: () => void;
}

export interface UseIdleTimerReturn {
  /**
   * Se o modal de contagem regressiva/aviso deve estar aberto (faltando <= 60s)
   */
  isWarning: boolean;
  /**
   * Segundos restantes até o auto-logoff (ex: 60, 59... 0)
   */
  remainingSeconds: number;
  /**
   * Tempo total de inatividade configurado para este perfil (em segundos)
   */
  totalTimeoutSeconds: number;
  /**
   * Segundos acumulados de inatividade
   */
  elapsedIdleSeconds: number;
  /**
   * Nome legível do perfil e tempo configurado
   */
  profileLabel: string;
  /**
   * Função para resetar manualmente a inatividade e manter o usuário conectado
   */
  resetTimer: () => void;
  /**
   * Forçar o encerramento imediato da sessão
   */
  forceTimeout: () => void;
}

/**
 * Determina o tempo limite de inatividade baseado no perfil do usuário
 * - AUX_DA / Canteiro: 15 minutos (900 segundos)
 * - RH_ADMIN / Gestores / Super Admin: 30 minutos (1800 segundos)
 */
export function getTimeoutForRole(role?: AdminRole | string | null): { seconds: number; label: string } {
  if (!role) {
    return { seconds: 30 * 60, label: 'Perfil Geral (30 min)' };
  }

  const normalized = role.toString().trim().toUpperCase();

  // Perfil AUX_DA / Canteiro / Operacional: 15 Minutos
  if (
    normalized === 'AUX_DA' || 
    normalized === 'CHEFE_CANTEIRO' || 
    normalized === 'GERENTE_CAMPO' || 
    normalized === 'ROLE_GERENTE' ||
    normalized.includes('AUX') ||
    normalized.includes('CANTEIRO')
  ) {
    return { seconds: 15 * 60, label: 'Perfil AUX_DA / Canteiro (15 min)' };
  }

  // Perfil RH_ADMIN / GESTOR_RH / SUPER_ADMIN / AUDITOR: 30 Minutos
  if (
    normalized === 'SUPER_ADMIN' ||
    normalized === 'GESTOR_RH' ||
    normalized === 'RH_ADMIN' ||
    normalized === 'AUDITOR' ||
    normalized.includes('ADMIN') ||
    normalized.includes('RH')
  ) {
    return { seconds: 30 * 60, label: 'Perfil RH_ADMIN / Gestão (30 min)' };
  }

  return { seconds: 30 * 60, label: 'Perfil Administrador (30 min)' };
}

export function useIdleTimer({
  enabled = true,
  role,
  warnSeconds = 60,
  customTimeoutSeconds,
  onTimeout,
}: UseIdleTimerOptions): UseIdleTimerReturn {
  const { seconds: defaultTimeout, label: profileLabel } = getTimeoutForRole(role);
  const totalTimeoutSeconds = customTimeoutSeconds ?? defaultTimeout;

  const [isWarning, setIsWarning] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(warnSeconds);
  const [elapsedIdleSeconds, setElapsedIdleSeconds] = useState<number>(0);

  // Guarda o timestamp da última interação do usuário
  const lastActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Reseta o cronômetro de inatividade
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsWarning(false);
    setRemainingSeconds(warnSeconds);
    setElapsedIdleSeconds(0);
  }, [warnSeconds]);

  // Força logout imediato
  const forceTimeout = useCallback(() => {
    setIsWarning(false);
    onTimeoutRef.current();
  }, []);

  // Monitora eventos globais de interação no navegador
  useEffect(() => {
    if (!enabled) {
      setIsWarning(false);
      return;
    }

    // Reseta ao habilitar
    lastActivityRef.current = Date.now();
    setIsWarning(false);
    setRemainingSeconds(warnSeconds);

    let lastThrottle = 0;
    const THROTTLE_MS = 800; // Reduz chamadas desnecessárias de eventos de alta frequência

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottle < THROTTLE_MS) return;
      lastThrottle = now;

      // Atualiza o timestamp de atividade
      lastActivityRef.current = now;

      // Se estava no aviso, qualquer interação válida do usuário renova a sessão
      setIsWarning((prev) => {
        if (prev) {
          setRemainingSeconds(warnSeconds);
          return false;
        }
        return false;
      });
    };

    // Eventos globais de interação monitorados
    const events = [
      'mousemove',
      'keydown',
      'click',
      'touchstart',
      'scroll',
      'wheel',
      'pointerdown',
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    // Quando a aba/janela volta ao foco, recalcula imediatamente
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const elapsed = Math.floor((now - lastActivityRef.current) / 1000);
        if (elapsed >= totalTimeoutSeconds) {
          // Expirou enquanto a aba estava em segundo plano
          setIsWarning(false);
          onTimeoutRef.current();
        } else if (elapsed >= totalTimeoutSeconds - warnSeconds) {
          setIsWarning(true);
          setRemainingSeconds(Math.max(0, totalTimeoutSeconds - elapsed));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    // Loop de verificação a cada 1 segundo (usando delta de timestamp real)
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastActivityRef.current) / 1000);
      setElapsedIdleSeconds(elapsed);

      // 1. Limite atingido -> Efetuar Auto-Logoff
      if (elapsed >= totalTimeoutSeconds) {
        setIsWarning(false);
        setRemainingSeconds(0);
        onTimeoutRef.current();
        return;
      }

      // 2. Faltando <= warnSeconds (60s) -> Abrir Modal de Aviso
      const remaining = totalTimeoutSeconds - elapsed;
      if (remaining <= warnSeconds) {
        setIsWarning(true);
        setRemainingSeconds(Math.max(0, remaining));
      } else {
        setIsWarning(false);
        setRemainingSeconds(warnSeconds);
      }
    }, 1000);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [enabled, totalTimeoutSeconds, warnSeconds]);

  return {
    isWarning,
    remainingSeconds,
    totalTimeoutSeconds,
    elapsedIdleSeconds,
    profileLabel,
    resetTimer,
    forceTimeout,
  };
}
