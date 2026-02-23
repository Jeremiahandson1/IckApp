import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
          <div className="text-5xl mb-4">🥦</div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-[#888] text-sm mb-6 max-w-xs">
            {this.props.message || "This section ran into an unexpected error. Your data is safe."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
            className="px-6 py-3 bg-[#c8f135] text-white rounded-sm font-medium"
          >
            Try Again
          </button>
          {this.props.showHome !== false && (
            <a href="/scan" className="mt-3 text-[#888] text-sm hover:text-[#bbb]">
              ← Back to scan
            </a>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
