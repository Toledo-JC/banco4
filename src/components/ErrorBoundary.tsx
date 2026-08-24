import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro de renderização:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const isDomNotFoundError = 
        this.state.error?.message?.includes('removeChild') || 
        this.state.error?.message?.includes('NotFoundError') ||
        this.state.error?.name === 'NotFoundError';

      return (
        <div 
          translate="no"
          className={`notranslate p-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 text-white space-y-4 my-4 ${this.props.className || ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-300">
                {this.props.fallbackTitle || 'Aviso de Renderização Protegida'}
              </h3>
              <p className="text-xs text-amber-200/80">
                {isDomNotFoundError 
                  ? 'Extensões de tradução do navegador ou mutações externas tentaram alterar a árvore do React. O container foi isolado para evitar o fechamento da aplicação.'
                  : (this.props.fallbackMessage || 'Ocorreu uma inconsistência temporária na exibição deste bloco.')}
              </p>
            </div>
          </div>

          {this.state.error && (
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-[11px] text-amber-200 overflow-x-auto">
              {this.state.error.toString()}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restaurar Visualização</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
