import { jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
export default class ErrorBoundary extends React.Component {
    state = {};
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error) { console.error("ErrorBoundary:", error); }
    render() {
        if (this.state.error) {
            return _jsxs("div", { className: "p-4 border border-red-300 bg-red-50 text-red-800 rounded", children: ["Beklenmedik hata: ", this.state.error.message] });
        }
        return this.props.children;
    }
}
