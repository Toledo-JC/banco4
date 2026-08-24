import React from 'react';
import { Info, HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  content: string;
  className?: string;
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md';
  position?: 'top' | 'bottom' | 'left' | 'right';
  badge?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  className = '',
  theme = 'dark',
  size = 'sm',
  position = 'top',
  badge,
}) => {
  const isDark = theme === 'dark';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className={`relative inline-flex items-center group cursor-help ${className}`}>
      {badge ? (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
          isDark 
            ? 'bg-[#1A1D24] text-blue-300 border-[#2A2E38] hover:border-blue-500/50' 
            : 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400'
        }`}>
          <span>{badge}</span>
          <Info className="w-2.5 h-2.5 opacity-70" />
        </span>
      ) : (
        <span className={`p-0.5 rounded-full transition-all inline-flex items-center justify-center ${
          isDark 
            ? 'text-gray-400 hover:text-blue-400 hover:bg-[#1F2229]' 
            : 'text-gray-400 hover:text-blue-600 hover:bg-gray-100'
        }`}>
          <HelpCircle className={iconSize} />
        </span>
      )}

      {/* Popover Tooltip */}
      <div 
        className={`absolute z-50 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 w-64 p-2.5 text-[11px] leading-relaxed rounded-xl shadow-xl border font-sans ${positionClasses[position]} ${
          isDark 
            ? 'bg-[#181B22] text-[#D1D5DB] border-[#2E3340] shadow-black/60' 
            : 'bg-white text-gray-700 border-gray-200 shadow-gray-300/80'
        }`}
      >
        <div className="flex items-start gap-2">
          <Info className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          <div className="text-left font-normal break-words">{content}</div>
        </div>
      </div>
    </div>
  );
};
