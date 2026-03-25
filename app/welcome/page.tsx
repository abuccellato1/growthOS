'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Customer, Purchase } from '@/types'
import { CheckCircle, Lock } from 'lucide-react'

const BUSINESS_TYPES = [
  'Service Business',
  'E-commerce',
  'Coaching/Consulting',
  'SaaS',
  'Agency',
  'Other',
]

const ACQUISITION_CHANNELS = [
  'Paid Ads',
  'Referrals',
  'Social Media',
  'Email',
  'Outbound/Cold',
  'SEO',
  'Other',
]

const PRODUCT_LABELS: Record<string, string> = {
  icp_blueprint: 'SignalMap',
  complete_alex_pack: 'SignalSuite',
  complete_intelligence_stack: 'SignalSuite',
  founders_circle: "Founder's Circle",
  ad_pack: 'SignalAds',
  social_pack: 'SignalContent',
  email_pack: 'SignalSequences',
  gtm_plan: 'SignalLaunch',
  action_plan: 'SignalSprint',
}

const LOCKED_PRODUCTS = ['ad_pack', 'social_pack', 'email_pack', 'gtm_plan', 'action_plan']

export default function WelcomePage() {
  const [step, setStep] = useState(1)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2
  const [businessType, setBusinessType] = useState('')
  const [primaryService, setPrimaryService] = useState('')
  const [marketingChallenge, setMarketingChallenge] = useState('')
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])

  const router = useRouter()

  useEffect(() => {
    async function loadCustomer() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (customerData) {
        setCustomer(customerData)
        setFirstName(customerData.first_name || '')
        setLastName(customerData.last_name || '')
        setBusinessName(customerData.business_name || '')
        setWebsiteUrl(customerData.website_url || '')
        setBusinessType(customerData.business_type || '')
        setPrimaryService(customerData.primary_service || '')
        setMarketingChallenge(customerData.marketing_challenge || '')
        setSelectedChannels(customerData.current_channels || [])
      }

      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('*')
        .eq('customer_id', customerData?.id)

      if (purchaseData) setPurchases(purchaseData)
      setLoading(false)
    }
    loadCustomer()
  }, [router])

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    setError('')

    const supabase = createClient()
    // Set password
    const { error: pwError } = await supabase.auth.updateUser({ password })
    if (pwError) {
      setError(pwError.message)
      setSubmitting(false)
      return
    }

    // Update customer record
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
        website_url: websiteUrl,
      })
      .eq('id', customer?.id)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    setStep(2)
    setSubmitting(false)
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        business_type: businessType,
        primary_service: primaryService,
        marketing_challenge: marketingChallenge,
        current_channels: selectedChannels,
      })
      .eq('id', customer?.id)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    setStep(3)
    setSubmitting(false)
  }

  function toggleChannel(channel: string) {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    )
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border text-sm transition-all outline-none"

  function inputFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = '#43C6AC'
    e.target.style.boxShadow = '0 0 0 3px rgba(67,198,172,0.15)'
  }
  function inputBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = '#e5e7eb'
    e.target.style.boxShadow = 'none'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
        <div className="text-white text-lg" style={{ fontFamily: 'DM Sans, sans-serif' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: '#191654' }}>
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative w-48 h-12">
            <Image src="/images/signalshot-logo.png" alt="SignalShot" fill className="object-contain" priority onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span style="font-size:24px;font-weight:700;color:#43C6AC;letter-spacing:-0.5px">SignalShot</span>'; }} />
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
                style={{
                  backgroundColor: s === step ? '#43C6AC' : s < step ? '#43C6AC' : 'rgba(255,255,255,0.2)',
                  color: s <= step ? '#191654' : 'rgba(255,255,255,0.5)',
                }}
              >
                {s < step ? '✓' : s}
              </div>
              {s < 3 && (
                <div
                  className="w-12 h-0.5"
                  style={{ backgroundColor: s < step ? '#43C6AC' : 'rgba(255,255,255,0.2)' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* Step 1 — Account Setup */}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                Set up your account
              </h1>
              <p className="text-sm mb-6" style={{ color: '#6b7280' }}>Step 1 of 3 — Account Setup</p>

              <form onSubmit={handleStep1} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>First name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClass}
                      style={{ borderColor: '#e5e7eb' }}
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Last name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputClass}
                      style={{ borderColor: '#e5e7eb' }}
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Business name</label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Website URL</label>
                  <input
                    type="url"
                    required
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yoursite.com"
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Confirm password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Must match password"
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-60"
                  style={{ backgroundColor: '#43C6AC' }}
                >
                  {submitting ? 'Saving...' : 'Continue →'}
                </button>
              </form>
            </>
          )}

          {/* Step 2 — Quick Context */}
          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                Help Alex get started
              </h1>
              <p className="text-sm mb-1" style={{ color: '#6b7280' }}>Step 2 of 3 — Quick Context</p>
              <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                These answers mean Alex skips the basics and starts with smarter questions.
              </p>

              <form onSubmit={handleStep2} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Business type</label>
                  <select
                    required
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  >
                    <option value="">Select a type...</option>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Primary service or product</label>
                  <input
                    type="text"
                    required
                    value={primaryService}
                    onChange={(e) => setPrimaryService(e.target.value)}
                    placeholder="e.g. SEO services, SaaS analytics tool"
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Biggest marketing challenge right now</label>
                  <textarea
                    required
                    value={marketingChallenge}
                    onChange={(e) => setMarketingChallenge(e.target.value)}
                    placeholder="e.g. We get traffic but very few conversions..."
                    rows={3}
                    className={inputClass}
                    style={{ borderColor: '#e5e7eb', resize: 'none' }}
                    onFocus={inputFocus as React.FocusEventHandler<HTMLTextAreaElement>}
                    onBlur={inputBlur as React.FocusEventHandler<HTMLTextAreaElement>}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>Current customer acquisition channels</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ACQUISITION_CHANNELS.map((channel) => (
                      <label
                        key={channel}
                        className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all"
                        style={{
                          borderColor: selectedChannels.includes(channel) ? '#43C6AC' : '#e5e7eb',
                          backgroundColor: selectedChannels.includes(channel) ? 'rgba(67,198,172,0.08)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedChannels.includes(channel)}
                          onChange={() => toggleChannel(channel)}
                          className="accent-teal-500"
                          style={{ accentColor: '#43C6AC' }}
                        />
                        <span className="text-sm" style={{ color: '#374151' }}>{channel}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-60"
                  style={{ backgroundColor: '#43C6AC' }}
                >
                  {submitting ? 'Saving...' : 'Continue →'}
                </button>
              </form>
            </>
          )}

          {/* Step 3 — What's Waiting */}
          {step === 3 && (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                Welcome to SignalShot, {firstName}.
              </h1>
              <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                Step 3 of 3 — Here&apos;s what&apos;s ready for you.
              </p>

              {/* Confirmed purchases */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#9ca3af' }}>
                  Your purchases
                </h2>
                <div className="space-y-2">
                  {purchases.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#f0fdf9' }}>
                      <CheckCircle size={18} style={{ color: '#43C6AC' }} />
                      <span className="text-sm font-medium" style={{ color: '#191654' }}>
                        {PRODUCT_LABELS[p.product_type] || p.product_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unlocked now */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#9ca3af' }}>
                  Unlocked now
                </h2>
                <div className="p-4 rounded-xl border-2" style={{ borderColor: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.05)' }}>
                  <div className="flex items-center gap-3 mb-1">
                    <CheckCircle size={20} style={{ color: '#43C6AC' }} />
                    <span className="font-semibold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
                      SignalMap Interview
                    </span>
                  </div>
                  <p className="text-sm ml-8" style={{ color: '#6b7280' }}>
                    Your AI-powered discovery session is ready. This is where everything starts.
                  </p>
                </div>
              </div>

              {/* Unlocks after Alex */}
              {purchases.some((p) => LOCKED_PRODUCTS.includes(p.product_type)) && (
                <div className="mb-8">
                  <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#9ca3af' }}>
                    Unlocks after Alex completes
                  </h2>
                  <div className="space-y-2">
                    {purchases
                      .filter((p) => LOCKED_PRODUCTS.includes(p.product_type))
                      .map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                          <Lock size={16} style={{ color: '#9ca3af' }} />
                          <span className="text-sm" style={{ color: '#9ca3af' }}>
                            {PRODUCT_LABELS[p.product_type] || p.product_type}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => router.push('/dashboard/alex')}
                className="w-full py-4 rounded-xl text-white font-bold text-base transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: '#191654', fontFamily: 'DM Sans, sans-serif' }}
              >
                Start Your Session With Alex →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
