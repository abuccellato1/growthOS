'use client'

import { Component, ReactNode } from 'react'
import Link from 'next/link'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
  errorId: string
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: '',
      errorId: '',
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
      errorId: Date.now().toString(36),
    }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Intentional console.error for error boundary logging
    console.error(JSON.stringify({
      level: 'error',
      message: 'React error boundary caught error',
      timestamp: new Date().toISOString(),
      errorName: error.name,
      errorMessage: error.message,
      errorId: this.state.errorId,
      componentStack: info.componentStack.slice(0, 500),
    }))
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div
          className="flex flex-col items-center justify-center min-h-[400px] p-8"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ backgroundColor: '#fff3f3' }}
          >
            <span style={{ fontSize: 32 }}>⚠️</span>
          </div>
          <h2
            className="text-2xl font-bold mb-3 text-center"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
          >
            Something went wrong
          </h2>
          <p
            className="text-sm text-center mb-2 max-w-md"
            style={{ color: '#6b7280' }}
          >
            An unexpected error occurred. Our team has been notified.
            Try refreshing the page or going back to the dashboard.
          </p>
          <p
            className="text-xs mb-8"
            style={{ color: '#d1d5db' }}
          >
            Error ID: {this.state.errorId}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                this.setState({
                  hasError: false,
                  errorMessage: '',
                  errorId: '',
                })
                window.location.reload()
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#43C6AC' }}
            >
              Try Again
            </button>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                backgroundColor: '#f3f4f6',
                color: '#374151',
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
