'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Customer, Business } from '@/types'
import { Loader } from 'lucide-react'

export function isIntakeComplete(customer: Customer): boolean {
  return !!(
    customer.business_name?.trim() &&
    customer.website_url?.trim() &&
    customer.primary_service?.trim() &&
    customer.geographic_market?.trim()
  )
}

interface IntakeGateProps {
  customer: Customer
  existingBusiness?: Business | null
  onComplete: (updatedCustomer: Customer, business: Business) => void
}

export default function IntakeGate({ customer, existingBusiness, onComplete }: IntakeGateProps) {
  const [stage, setStage] = useState<'intro' | 'form' | 'loading'>('intro')
  const [businessName, setBusinessName] = useState(existingBusiness?.business_name || customer.business_name || '')
  const [websiteUrl, setWebsiteUrl] = useState(existingBusiness?.website_url || customer.website_url || '')
  const [primaryService, setPrimaryService] = useState(existingBusiness?.primary_service || customer.primary_service || '')
  const [geographicMarket, setGeographicMarket] = useState(existingBusiness?.geographic_market || customer.geographic_market || '')
  const [gmbUrl, setGmbUrl] = useState(existingBusiness?.gmb_url || '')
  const [honeypot, setHoneypot] = useState('')
  const [secondHoneypot, setSecondHoneypot] = useState('')
  const [formStartTime] = useState(Date.now())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [step1, setStep1] = useState(false)
  const [step2, setStep2] = useState(false)
  const [step3, setStep3] = useState(false)

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!businessName.trim()) errs.businessName = 'Business name is required'
    if (!websiteUrl.trim()) errs.websiteUrl = 'Website URL is required'
    if (!primaryService.trim()) errs.primaryService = 'Primary service is required'
    if (!geographicMarket.trim()) errs.geographicMarket = 'Geographic market is required'
    if (gmbUrl.trim() && !gmbUrl.trim().startsWith('http://') && !gmbUrl.trim().startsWith('https://')) {
      errs.gmbUrl = 'Please enter a valid URL starting with http:// or https://'
    }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Silently reject bots
    if (honeypot || secondHoneypot) return
    const timeSpent = Date.now() - formStartTime
    if (timeSpent < 3000) return

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setStage('loading')

    // Animate steps sequentially
    setStep1(true)
    setTimeout(() => setStep2(true), 1500)
    setTimeout(() => setStep3(true), 3000)

    let business: Business | null = null

    if (existingBusiness) {
      // Update existing business
      const supabase = createClient()
      await supabase
        .from('businesses')
        .update({
          business_name: businessName.trim(),
          website_url: websiteUrl.trim(),
          primary_service: primaryService.trim(),
          geographic_market: geographicMarket.trim(),
          gmb_url: gmbUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBusiness.id)

      // Run research with businessId
      await Promise.all([
        fetch('/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: existingBusiness.id,
            businessName: businessName.trim(),
            websiteUrl: websiteUrl.trim(),
            primaryService: primaryService.trim(),
            geographicMarket: geographicMarket.trim(),
            gmbUrl: gmbUrl.trim() || undefined,
          }),
        }).catch(() => null),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ])

      // Fetch updated business
      const { data: updatedBusiness } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', existingBusiness.id)
        .single()

      business = updatedBusiness
    } else {
      // Create new business
      const [createRes] = await Promise.all([
        fetch('/api/businesses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName: businessName.trim(),
            websiteUrl: websiteUrl.trim(),
            primaryService: primaryService.trim(),
            geographicMarket: geographicMarket.trim(),
            gmbUrl: gmbUrl.trim() || undefined,
          }),
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])

      if (createRes.ok) {
        const createData = await createRes.json()
        business = createData.business

        // Store active business
        if (business) {
          localStorage.setItem('signalshot_active_business', business.id)
        }

        // Run research with new businessId
        if (business) {
          await Promise.all([
            fetch('/api/research', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                businessId: business.id,
                businessName: businessName.trim(),
                websiteUrl: websiteUrl.trim(),
                primaryService: primaryService.trim(),
                geographicMarket: geographicMarket.trim(),
                gmbUrl: gmbUrl.trim() || undefined,
              }),
            }).catch(() => null),
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ])

          // Fetch updated business with research
          const supabase = createClient()
          const { data: updatedBusiness } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', business.id)
            .single()

          if (updatedBusiness) business = updatedBusiness
        }
      }
    }

    // If business is missing, try to fetch it directly
    if (!business) {
      const fallbackSupabase = createClient()
      const { data: freshBusiness } = await fallbackSupabase
        .from('businesses')
        .select('*')
        .eq('id', existingBusiness?.id || '')
        .single()
      business = freshBusiness
    }

    // Fetch refreshed customer record
    const supabase = createClient()
    const { data: updated } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customer.id)
      .single()

    if (business) {
      onComplete(updated || customer, business)
    } else {
      // Last resort — reload the page
      window.location.reload()
    }
  }

  return (
    <>
      <style>{`
        @keyframes intakeFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Overlay */}
      <div
        className="fixed inset-0 z-[900] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ animation: 'intakeFadeIn 0.3s ease-out' }}
        >
          {stage !== 'intro' && (
            /* Logo — shown on form and loading stages */
            <div className="flex justify-center pt-8 pb-0">
              <div className="relative w-36 h-10">
                <Image src="/images/signalshot-logo.png" alt="SignalShot" fill className="object-contain" priority onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span style="font-size:20px;font-weight:700;color:#43C6AC;letter-spacing:-0.5px">SignalShot\u2122</span>'; }} />
              </div>
            </div>
          )}

          {stage === 'intro' && (
            <div className="p-8 pt-6 text-center">
              {/* Logo */}
              <div className="flex justify-center mb-6">
                <img
                  src="/images/signalshot-logo.png"
                  alt="SignalShot"
                  style={{ width: 140, height: 'auto' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
              <h2
                className="text-2xl font-bold mb-3"
                style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
              >
                Welcome to SignalShot™
              </h2>
              <p
                className="text-sm mb-4 leading-relaxed"
                style={{ color: '#4b5563', fontFamily: 'DM Sans, sans-serif' }}
              >
                SignalShot uses Alex — an AI discovery strategist — to build
                your complete Ideal Customer Profile through a live conversation.
              </p>
              <p
                className="text-sm mb-8 leading-relaxed"
                style={{ color: '#4b5563', fontFamily: 'DM Sans, sans-serif' }}
              >
                Before Alex can start, he needs 60 seconds of context about
                your business. This helps him skip the basics and start with
                smarter questions.
              </p>
              {/* What Alex builds — three items */}
              <div className="space-y-3 mb-8 text-left">
                {[
                  {
                    icon: '🎯',
                    title: 'Your Ideal Customer Profile',
                    desc: 'A complete document identifying exactly who your best customer is'
                  },
                  {
                    icon: '📣',
                    title: 'Your Messaging Framework',
                    desc: 'The exact language that resonates with your ideal customer'
                  },
                  {
                    icon: '🚀',
                    title: 'Your Go-To-Market Strategy',
                    desc: 'Channels, content, and a 90-day action plan to reach them'
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#f8f9fc' }}
                  >
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        {item.title}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStage('form')}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm"
                style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
              >
                Let&apos;s Get Started →
              </button>
              <p
                className="text-xs mt-3"
                style={{ color: '#9ca3af', fontFamily: 'DM Sans, sans-serif' }}
              >
                Takes about 60 seconds
              </p>
            </div>
          )}

          {stage === 'form' && (
            <form onSubmit={handleSubmit} className="p-8 pt-5">
              <h2
                className="text-2xl font-bold mb-1 text-center"
                style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
              >
                {existingBusiness ? 'Update your business details' : 'Tell Alex about your business'}
              </h2>
              <p
                className="text-sm text-center mb-6"
                style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}
              >
                Alex will use this to skip the basics and start your SignalMap™ session with smarter, more specific questions.
              </p>

              {/* Honeypot fields — hidden from real users */}
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

              <div className="space-y-4">
                <Field
                  label="Business Name"
                  placeholder="e.g. Acme Marketing Co."
                  hint="The name of your company or brand"
                  value={businessName}
                  onChange={setBusinessName}
                  error={errors.businessName}
                />
                <Field
                  label="Website URL"
                  placeholder="e.g. acmemarketing.com"
                  hint="Your main website"
                  value={websiteUrl}
                  onChange={setWebsiteUrl}
                  error={errors.websiteUrl}
                />
                <Field
                  label="Primary Service or Product"
                  placeholder="e.g. SEO & content marketing for B2B SaaS"
                  hint="The core thing you sell"
                  value={primaryService}
                  onChange={setPrimaryService}
                  error={errors.primaryService}
                />
                <Field
                  label="Primary Geographic Market"
                  placeholder="e.g. United States, North America, Global"
                  hint="Where your customers are located"
                  value={geographicMarket}
                  onChange={setGeographicMarket}
                  error={errors.geographicMarket}
                />
                <Field
                  label="Google My Business URL"
                  placeholder="e.g. https://g.page/your-business"
                  hint="Optional — your GMB profile URL helps Alex understand your local presence"
                  value={gmbUrl}
                  onChange={setGmbUrl}
                  error={errors.gmbUrl}
                />
              </div>

              <button
                type="submit"
                className="w-full mt-6 py-3 rounded-xl font-semibold text-white text-sm"
                style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
              >
                Find My Customers
              </button>
            </form>
          )}

          {stage === 'loading' && (
            <div className="p-8 pt-5 text-center">
              <h2
                className="text-2xl font-bold mb-6"
                style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
              >
                Alex is getting ready for your session...
              </h2>
              <div className="flex justify-center mb-8">
                <Loader size={32} className="animate-spin" style={{ color: '#43C6AC' }} />
              </div>
              <div className="space-y-4 text-left">
                <ResearchStep active={step1} label="Reviewing your website" />
                <ResearchStep active={step2} label="Researching your market position" />
                <ResearchStep active={step3} label="Preparing your SignalMap™ session" />
              </div>
              <div className="h-6" />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Field({
  label,
  placeholder,
  hint,
  value,
  onChange,
  error,
}: {
  label: string
  placeholder: string
  hint: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label
        className="block text-sm font-medium mb-1"
        style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all"
        style={{
          borderColor: error ? '#ef4444' : focused ? '#43C6AC' : '#e5e7eb',
          boxShadow: focused ? '0 0 0 3px rgba(67,198,172,0.12)' : 'none',
          fontFamily: 'DM Sans, sans-serif',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error ? (
        <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>
      ) : (
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{hint}</p>
      )}
    </div>
  )
}

function ResearchStep({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-5 h-5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: active ? '#43C6AC' : '#e5e7eb',
          transition: 'background-color 0.4s ease',
        }}
      />
      <span
        className="text-sm"
        style={{
          color: active ? '#191654' : '#9ca3af',
          fontWeight: active ? 500 : 400,
          fontFamily: 'DM Sans, sans-serif',
          transition: 'color 0.4s ease',
        }}
      >
        {label}
      </span>
    </div>
  )
}
