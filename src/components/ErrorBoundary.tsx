import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Barnhem ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FFFDF9]">
          <div className="max-w-md w-full rounded-[32px] border-2 border-[#F3B7C0] bg-white p-7 text-center space-y-4 pastel-shadow">
            <div className="text-4xl">🩹</div>
            <h1 className="text-xl font-bold text-[#3D322C]">
              พบข้อผิดพลาดชั่วคราว
            </h1>
            <p className="text-xs text-[#6E5C52] break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[46px] rounded-2xl bg-[#3D322C] text-white font-bold cursor-pointer"
            >
              รีโหลดหน้าแอปใหม่
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
