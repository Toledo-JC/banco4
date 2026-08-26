import React, { useState } from 'react';

interface ComaraLogoProps {
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  subtitle?: string;
  theme?: 'dark' | 'light';
  className?: string;
  onClick?: () => void;
}

export const ComaraLogo: React.FC<ComaraLogoProps> = ({
  logoUrl = '/comara-logo.png',
  size = 'md',
  showText = false,
  subtitle = 'Comissão de Aeroportos da Região Amazônica',
  theme = 'dark',
  className = '',
  onClick,
}) => {
  const isDark = theme === 'dark';
  const [imageError, setImageError] = useState(false);

  // Size mapping for the insignia / emblem (flat top, rounded bottom)
  const sizeClasses = {
    sm: 'h-8 w-auto max-h-8',
    md: 'h-10 w-auto max-h-10',
    lg: 'h-14 w-auto max-h-14',
    xl: 'h-20 w-auto max-h-20',
    '2xl': 'h-28 w-auto max-h-28',
  };

  const textSizes = {
    sm: { title: 'text-xs', sub: 'text-[9px]' },
    md: { title: 'text-sm', sub: 'text-[10px]' },
    lg: { title: 'text-base sm:text-lg', sub: 'text-xs' },
    xl: { title: 'text-xl sm:text-2xl', sub: 'text-xs sm:text-sm' },
    '2xl': { title: 'text-2xl sm:text-3xl', sub: 'text-sm' },
  };

  const effectiveLogoUrl = (logoUrl && logoUrl.trim().length > 0) ? logoUrl : '/comara-logo.png';
  const hasCustomImage = Boolean(effectiveLogoUrl && !imageError);

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
            alt="Brasão Oficial COMARA"
            className={`${sizeClasses[size]} object-contain drop-shadow-md transition-transform hover:scale-105 filter`}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        /* Vector Emblem for COMARA (Aeronautical Wings & Star Insignia) */
        <div className={`relative shrink-0 flex items-center justify-center rounded-xl shadow-md transition-transform group-hover:scale-105 ${
          sizeClasses[size]
        } bg-gradient-to-br from-[#0B2545] via-[#134074] to-[#00509D] text-white border ${
          isDark ? 'border-blue-400/30 shadow-blue-900/30' : 'border-blue-700/20 shadow-blue-500/20'
        }`}>
          {/* Stylized Aeronautical Wings SVG */}
          <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="50%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
              <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93C5FD" />
                <stop offset="100%" stopColor="#60A5FA" />
              </linearGradient>
            </defs>

            {/* Left Wing */}
            <path
              d="M 17 21 C 12 17 6 16 2 17 C 7 19 12 21 16 25 Z"
              fill="url(#wingGrad)"
              opacity="0.9"
            />
            <path
              d="M 18 24 C 13 22 7 21 4 23 C 8 24 13 25 17 28 Z"
              fill="url(#wingGrad)"
              opacity="0.75"
            />

            {/* Right Wing */}
            <path
              d="M 23 21 C 28 17 34 16 38 17 C 33 19 28 21 24 25 Z"
              fill="url(#wingGrad)"
              opacity="0.9"
            />
            <path
              d="M 22 24 C 27 22 33 21 36 23 C 32 24 27 25 23 28 Z"
              fill="url(#wingGrad)"
              opacity="0.75"
            />

            {/* Central Shield */}
            <path
              d="M 20 8 L 26 13 L 26 23 C 26 28 20 32 20 32 C 20 32 14 28 14 23 L 14 13 Z"
              fill="#0B2545"
              stroke="url(#goldGrad)"
              strokeWidth="1.2"
            />

            {/* Aeronautical Star */}
            <polygon
              points="20,11 21.5,15 25.5,15 22.2,17.5 23.5,21.5 20,19 16.5,21.5 17.8,17.5 14.5,15 18.5,15"
              fill="url(#goldGrad)"
            />

            {/* Center Runway Compass Lines */}
            <line x1="20" y1="22" x2="20" y2="28" stroke="#60A5FA" strokeWidth="1" strokeDasharray="1 1" />
          </svg>
        </div>
      )}

      {showText && (
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className={`font-black tracking-tight ${textSizes[size].title} ${
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
            <p className={`font-medium truncate ${textSizes[size].sub} ${
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
