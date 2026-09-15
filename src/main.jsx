import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('Get Ransom crashed:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', color: '#d9e4ea', background: '#030710', minHeight: '100svh' }}>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>Something broke in the UI</h1>
          <p style={{ color: '#6f8794', fontSize: 14 }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('gr-route-v1')
              } catch { /* noop */ }
              window.location.href = '/'
            }}
            style={{
              marginTop: 16,
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,217,138,0.15)',
              color: '#ffd98a',
              cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
