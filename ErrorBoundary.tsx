
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, Shield } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch and handle rendering errors in its child components.
 */
// Fix: Use Component from react with generics to ensure 'props', 'state', and 'setState' are correctly inherited and typed.
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0f1c] text-slate-100 flex items-center justify-center p-6 font-['Cairo']">
          <div className="max-w-xl w-full bg-[#0f172a] border border-white/10 rounded-[3rem] shadow-3xl overflow-hidden">
            <div className="p-10 text-center space-y-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-red-500/10 rounded-[2rem] border-2 border-red-500/20 shadow-xl shadow-red-500/10">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              
              <div className="space-y-4">
                <h1 className="text-3xl font-black text-white">حدث خطأ غير متوقع</h1>
                <p className="text-slate-400 text-lg leading-relaxed">
                  نعتذر عن هذا الإزعاج. واجه النظام مشكلة تقنية مفاجئة أثناء معالجة البيانات.
                </p>
              </div>

              {this.state.error && (
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 text-left overflow-x-auto">
                  <code className="text-xs text-red-400/80 font-mono">
                    {this.state.error.toString()}
                  </code>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={this.handleReset}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
                >
                  <RefreshCw className="w-5 h-5" />
                  إعادة تشغيل النظام
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black border border-white/10 flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <Home className="w-5 h-5 text-slate-400" />
                  الصفحة الرئيسية
                </button>
              </div>
            </div>

            <div className="bg-white/5 p-6 border-t border-white/5 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 opacity-50">
                <Shield className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Nusuk Pro Security</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
