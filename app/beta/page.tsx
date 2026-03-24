'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function BetaSignupPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [betaCode, setBetaCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [secondHoneypot, setSecondHoneypot] = useState('')
  const [formStartTime] = useState(Date.now())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Silently reject bots
    if (honeypot || secondHoneypot) return
    const timeSpent = Date.now() - formStartTime
    if (timeSpent < 3000) return

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/beta/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          betaCode: betaCode.trim(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      // Sign in and redirect
      window.location.href = '/dashboard'
    } catch {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  const inputClass = 'w-full px-4 py-3 rounded-lg border text-sm transition-all outline-none'

  function inputFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = '#43C6AC'
    e.target.style.boxShadow = '0 0 0 3px rgba(67,198,172,0.15)'
  }
  function inputBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = '#e5e7eb'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#191654' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative w-48 h-12">
            <Image
              src="/images/signalshot-logo.png"
              alt="SignalShot"
              fill
              className="object-contain"
              priority
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.parentElement!.innerHTML =
                  '<span style="font-size:24px;font-weight:700;color:#43C6AC;letter-spacing:-0.5px">SignalShot\u2122</span>'
              }}
            />
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-3xl font-bold text-center mb-2"
          style={{ fontFamily: 'Playfair Display, serif', color: '#ffffff' }}
        >
          Join the SignalShot™ Beta
        </h1>
        <p
          className="text-center text-sm mb-8"
          style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'DM Sans, sans-serif' }}
        >
          Get full access to SignalShot in exchange for your feedback. Limited spots available.
        </p>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot fields */}
            <input
              type="text"
              name="website_url_confirm"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ display: 'none' }}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            <input
              type="email"
              name="confirm_email_address"
              value={secondHoneypot}
              onChange={(e) => setSecondHoneypot(e.target.value)}
              style={{ display: 'none' }}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
                style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                Beta Access Code
              </label>
              <input
                type="text"
                required
                value={betaCode}
                onChange={(e) => setBetaCode(e.target.value)}
                placeholder="Enter your beta code"
                className={inputClass}
                style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={inputClass}
                style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Must match password"
                className={inputClass}
                style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
            >
              {loading ? 'Creating your account...' : 'Claim My Beta Access'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#43C6AC' }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
