import React, { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center p-8 gap-4 bg-brand-cream rounded-[22px] min-h-[200px] border border-gray-100">
          <p className="text-gray-600 font-medium">Có lỗi xảy ra trong quá trình hiển thị</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="bg-brand-primary text-white px-6 py-2 rounded-xl font-bold"
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
