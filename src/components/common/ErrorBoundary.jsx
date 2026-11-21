import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button.jsx";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Unhandled UI render exception:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4 shadow-sm">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-ink mb-2">Something went wrong</h2>
          <p className="max-w-md text-sm text-slate-500 mb-6">
            An unexpected error occurred while rendering this screen. You can try refreshing the view or reloading the app.
          </p>
          {this.state.error?.message && (
            <div className="mb-6 max-w-lg overflow-x-auto rounded-xl border border-red-200 bg-red-50/50 p-3 text-left font-mono text-xs text-red-700">
              {this.state.error.message}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="secondary" onClick={this.handleReset}>
              Try Again
            </Button>
            <Button variant="primary" icon={RefreshCw} onClick={this.handleReload}>
              Reload App
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
