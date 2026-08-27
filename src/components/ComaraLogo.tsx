import React, { useState } from 'react';

export interface LogoComaraProps {
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'header' | 'print';
  showText?: boolean;
  subtitle?: string;
  theme?: 'dark' | 'light';
  className?: string;
  onClick?: () => void;
  altText?: string;
}

/**
 * URL Padrão Institucional do PNG Transparente da COMARA
 */
export const DEFAULT_COMARA_LOGO_URL = '/comara-logo.png';

/**
 * Representação SVG Vetorial Pura para Injeção Direta em HTML de Impressão (@media print)
 */
export const COMARA_LOGO_SVG_STRING = `
<svg viewBox="0 0 100 120" style="height:58px; width:auto; max-height:60px; display:inline-block; vertical-align:middle;" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M 6 6 L 94 6 L 94 65 C 94 95 74 114 50 114 C 26 114 6 95 6 65 Z" fill="#0B2545" stroke="#134074" stroke-width="3" />
  <path d="M 9 9 L 91 9 L 91 65 C 91 92 72 111 50 111 C 28 111 9 92 9 65 Z" fill="#134074" />
  <rect x="12" y="14" width="76" height="18" rx="3" fill="#1E40AF" stroke="#60A5FA" stroke-width="1" />
  <text x="50" y="27" fill="#FFFFFF" font-size="10" font-weight="900" text-anchor="middle" font-family="Arial, sans-serif">COMARA</text>
  <path d="M 49 38 L 51 38 L 51 96 L 49 96 Z" fill="#F59E0B" />
  <path d="M 43 49 L 57 49 L 57 53 L 43 53 Z" fill="#F59E0B" />
  <path d="M 50 34 L 54 38 L 46 38 Z" fill="#FDE047" />
  <path d="M 46 54 C 34 46 18 48 12 56 C 22 59 34 62 46 66 Z" fill="#93C5FD" />
  <path d="M 54 54 C 66 46 82 48 88 56 C 78 59 66 62 54 66 Z" fill="#93C5FD" />
</svg>
`;

/**
 * Componente Institucional de Logo da COMARA
 * Otimizado para suportar PNGs com fundo transparente sem distorção em tela e impressão (@media print).
 * Inclui crossOrigin="anonymous" e referrerPolicy="no-referrer" para compatibilidade com PDF e canvas.
 */
export const LogoComara: React.FC<LogoComaraProps> = ({
  logoUrl = DEFAULT_COMARA_LOGO_URL,
  size = 'md',
  showText = false,
  subtitle = 'Comissão de Aeroportos da Região Amazônica',
  theme = 'dark',
  className = '',
  onClick,
  altText = 'Brasão Oficial COMARA'
}) => {
  const isDark = theme === 'dark';
  const [imageError, setImageError] = useState(false);

  // Mapeamento rigoroso e proporcional de tamanhos (Tela e Impressão A4)
  const sizeClasses: Record<string, string> = {
    sm: 'h-8 w-auto max-h-8 min-w-[32px]',
    header: 'h-10 w-auto max-h-10 min-w-[40px]', // Altura máxima de 40px no Header/Navegação
    md: 'h-10 w-auto max-h-10 min-w-[40px]',
    lg: 'h-14 w-auto max-h-14 min-w-[56px]',
    print: 'h-[58px] sm:h-[60px] w-auto max-h-[60px] max-w-[70px]', // Célula de impressão A4 (~60px x 60px)
    xl: 'h-20 w-auto max-h-20 min-w-[80px]',
    '2xl': 'h-28 w-auto max-h-28 min-w-[112px]',
  };

  const textSizes: Record<string, { title: string; sub: string }> = {
    sm: { title: 'text-xs', sub: 'text-[9px]' },
    header: { title: 'text-sm', sub: 'text-[10px]' },
    md: { title: 'text-sm', sub: 'text-[10px]' },
    lg: { title: 'text-base sm:text-lg', sub: 'text-xs' },
    print: { title: 'text-sm', sub: 'text-[10px]' },
    xl: { title: 'text-xl sm:text-2xl', sub: 'text-xs sm:text-sm' },
    '2xl': { title: 'text-2xl sm:text-3xl', sub: 'text-sm' },
  };

  const effectiveLogoUrl = (logoUrl && logoUrl.trim().length > 0) ? logoUrl : DEFAULT_COMARA_LOGO_URL;
  const hasCustomImage = Boolean(effectiveLogoUrl && !imageError);

  // Ajustes ópticos e de contraste dinâmico para PNG transparente:
  // - Em tema escuro: adiciona leve brilho/drop-shadow para destacar detalhes sobre fundos pretos/grafite.
  // - Em tema claro / Impressão: contraste nítido preservando a pureza das cores institucionais da FAB.
  const imageContrastClasses = isDark 
    ? 'brightness-105 contrast-110 drop-shadow-[0_2px_8px_rgba(255,255,255,0.12)] print:brightness-100 print:contrast-100 print:drop-none' 
    : 'brightness-100 contrast-105 drop-shadow-[0_1px_3px_rgba(0,0,0,0.12)] print:drop-none';

  return (
    <div 
      className={`inline-flex items-center gap-3 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      title={onClick ? 'Clique para gerenciar a logomarca da COMARA' : 'COMARA - Comissão de Aeroportos da Região Amazônica (FAB)'}
    >
      {hasCustomImage ? (
        <div className="relative shrink-0 flex items-center justify-center">
          <img
            src={effectiveLogoUrl}
            alt={altText}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            className={`${sizeClasses[size] || sizeClasses.md} object-contain transition-all duration-200 hover:scale-105 ${imageContrastClasses}`}
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        /* Brasão e Insígnia Vetorial da Aeronáutica / COMARA com Asas Douradas */
        <div className={`relative shrink-0 flex items-center justify-center rounded-xl shadow-md transition-transform group-hover:scale-105 ${
          sizeClasses[size] || sizeClasses.md
        } bg-gradient-to-br from-[#0B2545] via-[#134074] to-[#00509D] text-white border ${
          isDark ? 'border-blue-400/30 shadow-blue-900/30' : 'border-blue-700/20 shadow-blue-500/20'
        } print:border-none print:shadow-none`}>
          <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="goldGradLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="50%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
              <linearGradient id="wingGradLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93C5FD" />
                <stop offset="50%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>

            {/* Asa Esquerda */}
            <path
              d="M 17 21 C 12 17 6 16 2 17 C 7 19 12 21 16 25 Z"
              fill="url(#wingGradLogo)"
              opacity="0.9"
            />
            <path
              d="M 18 24 C 13 22 7 21 4 23 C 8 24 13 25 17 28 Z"
              fill="url(#wingGradLogo)"
              opacity="0.75"
            />

            {/* Asa Direita */}
            <path
              d="M 23 21 C 28 17 34 16 38 17 C 33 19 28 21 24 25 Z"
              fill="url(#wingGradLogo)"
              opacity="0.9"
            />
            <path
              d="M 22 24 C 27 22 33 21 36 23 C 32 24 27 25 23 28 Z"
              fill="url(#wingGradLogo)"
              opacity="0.75"
            />

            {/* Escudo Central */}
            <path
              d="M 20 8 L 26 13 L 26 23 C 26 28 20 32 20 32 C 20 32 14 28 14 23 L 14 13 Z"
              fill="#0B2545"
              stroke="url(#goldGradLogo)"
              strokeWidth="1.2"
            />

            {/* Estrela Aeronáutica */}
            <polygon
              points="20,11 21.5,15 25.5,15 22.2,17.5 23.5,21.5 20,19 16.5,21.5 17.8,17.5 14.5,15 18.5,15"
              fill="url(#goldGradLogo)"
            />

            {/* Linhas de Pista / Bússola */}
            <line x1="20" y1="22" x2="20" y2="28" stroke="#60A5FA" strokeWidth="1" strokeDasharray="1 1" />
          </svg>
        </div>
      )}

      {showText && (
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className={`font-black tracking-tight ${(textSizes[size] || textSizes.md).title} ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              COMARA
            </span>
            <span className={`font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-[9px] ${
              isDark 
                ? 'bg-blue-950/60 text-blue-400 border border-blue-800/50' 
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              FAB • SPTF
            </span>
          </div>
          {subtitle && (
            <p className={`font-medium truncate ${(textSizes[size] || textSizes.md).sub} ${
              isDark ? 'text-[#8E9299]' : 'text-slate-500'
            }`}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Aliases para compatibilidade total em todas as importações
export const ComaraLogo = LogoComara;
export default LogoComara;
