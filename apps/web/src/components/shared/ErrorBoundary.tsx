import React from "react";
type S = { error?: Error };
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, S> {
  state: S = {};
  static getDerivedStateFromError(error: Error): S { return { error }; }
  componentDidCatch(error: Error) { console.error("ErrorBoundary:", error); }
  render() {
    if (this.state.error) {
      return <div className="p-4 border border-red-300 bg-red-50 text-red-800 rounded">
        Beklenmedik hata: {this.state.error.message}
      </div>;
    }
    return this.props.children;
  }
}
