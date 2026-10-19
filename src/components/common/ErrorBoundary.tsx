import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
    this.props.onReset?.();
  };

  private handleCopy = () => {
    const diagnostic = `Error: ${this.state.error?.message || 'Unknown'}\nStack:\n${
      this.state.errorInfo?.componentStack || this.state.error?.stack || 'No stack'
    }`;
    navigator.clipboard.writeText(diagnostic);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[260px] p-6 flex flex-col items-center justify-center bg-[#212121] border border-[#383838] rounded-2xl text-center m-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>

          <h3 className="text-sm font-semibold text-[#ececec] mb-1">
            {this.props.fallbackTitle || 'Component Error'}
          </h3>
          <p className="text-xs text-red-400 font-mono bg-[#171717] px-3 py-1.5 rounded-xl border border-[#303030] max-w-lg truncate mb-4">
            {this.state.error?.message || 'An unexpected rendering error occurred'}
          </p>

          <div className="flex items-center gap-2.5">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#ececec] hover:bg-white text-black transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
            <button
              onClick={this.handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec] border border-[#383838] transition-colors"
            >
              {this.state.copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#ececec]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Diagnostic
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
