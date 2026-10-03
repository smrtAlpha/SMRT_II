import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

type Props = { label: string; children: ReactNode };
type State = { error: Error | null };

// If one section crashes while drawing, show what went wrong inside that section instead of
// leaving the whole screen blank — and keep the rest of the app (the tabs, the status bar) working.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.label} crashed:`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
          <AlertCircle size={24} className="mx-auto mb-2 text-red-600" />
          <p className="text-sm font-medium text-red-800">{this.props.label} ran into a problem</p>
          <p className="mt-1 text-xs break-words text-red-700">{this.state.error.message}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}