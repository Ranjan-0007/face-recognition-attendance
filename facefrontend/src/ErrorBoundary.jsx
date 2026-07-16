import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", background: "#f9fafb", padding: "2rem"
        }}>
          <div style={{
            background: "white", borderRadius: "1.5rem", padding: "3rem",
            maxWidth: "28rem", width: "100%", textAlign: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)"
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1f2937", marginBottom: "0.5rem" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1.5rem" }}>
              The page encountered an error. Please try refreshing.
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{
                padding: "0.75rem 2rem", borderRadius: "0.75rem",
                background: "#1E2A78", color: "white", border: "none",
                fontWeight: 700, fontSize: "0.875rem", cursor: "pointer"
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
