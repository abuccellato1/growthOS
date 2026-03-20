'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'magic' | 'password'>('magic')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password. Please try again.')
    } else {
      window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#191654' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative w-48 h-12">
            <Image
              src="/images/growthos-logo.png"
              alt="GrowthOS"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1
            className="text-2xl font-bold text-center mb-2"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
          >
            Sign in to GrowthOS
          </h1>
          <p className="text-center text-sm mb-8" style={{ color: '#6b7280' }}>
            Your AI growth platform
          </p>

          {success ? (
            <div className="text-center py-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#f0fdf9' }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: '#43C6AC' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2
                className="text-xl font-semibold mb-2"
                style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
              >
                Check your email
              </h2>
              <p style={{ color: '#6b7280' }}>
                We sent you a login link. Click it to sign in.
              </p>
            </div>
          ) : (
            <>
              {/* Magic Link Form */}
              {mode === 'magic' && (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div>
                    <label
                      htmlFor="email-magic"
                      className="block text-sm font-medium mb-1"
                      style={{ color: '#374151' }}
                    >
                      Email address
                    </label>
                    <input
                      id="email-magic"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded-lg border text-sm transition-all outline-none"
                      style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#43C6AC'
                        e.target.style.boxShadow = '0 0 0 3px rgba(67,198,172,0.15)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#43C6AC' }}
                  >
                    {loading ? 'Sending...' : 'Send Login Link'}
                  </button>
                </form>
              )}

              {/* Password Form */}
              {mode === 'password' && (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="email-pass"
                      className="block text-sm font-medium mb-1"
                      style={{ color: '#374151' }}
                    >
                      Email address
                    </label>
                    <input
                      id="email-pass"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded-lg border text-sm transition-all outline-none"
                      style={{ borderColor: '#e5e7eb' }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#43C6AC'
                        e.target.style.boxShadow = '0 0 0 3px rgba(67,198,172,0.15)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium mb-1"
                      style={{ color: '#374151' }}
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-lg border text-sm transition-all outline-none"
                      style={{ borderColor: '#e5e7eb' }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#43C6AC'
                        e.target.style.boxShadow = '0 0 0 3px rgba(67,198,172,0.15)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#43C6AC' }}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 border-t" style={{ borderColor: '#e5e7eb' }} />
                <span className="px-4 text-xs" style={{ color: '#9ca3af' }}>
                  {mode === 'magic' ? 'or sign in with password' : 'or use a magic link'}
                </span>
                <div className="flex-1 border-t" style={{ borderColor: '#e5e7eb' }} />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'magic' ? 'password' : 'magic')
                  setError('')
                }}
                className="w-full py-3 rounded-lg text-sm font-medium border transition-colors"
                style={{ borderColor: '#e5e7eb', color: '#374151' }}
              >
                {mode === 'magic' ? 'Sign in with password instead' : 'Send me a magic link instead'}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Don&apos;t have an account? Access is granted after purchase.
        </p>
      </div>
    </div>
  )
}
