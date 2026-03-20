'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types'
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
  onComplete: (updatedCustomer: Customer) => void
}

export default function IntakeGate({ customer, onComplete }: IntakeGateProps) {
  const [stage, setStage] = useState<'form' | 'loading'>('form')
  const [businessName, setBusinessName] = useState(customer.business_name || '')
  const [websiteUrl, setWebsiteUrl] = useState(customer.website_url || '')
  const [primaryService, setPrimaryService] = useState(customer.primary_service || '')
  const [geographicMarket, setGeographicMarket] = useState(customer.geographic_market || '')
  const [honeypot, setHoneypot] = useState('')
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
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Silently reject bots
    if (honeypot) return

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

    // Save intake fields + run research; enforce minimum 4s loading display
    await Promise.all([
      fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          businessName,
          websiteUrl,
          primaryService,
          geographicMarket,
        }),
      }).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ])

    // Fetch refreshed customer record
    const supabase = createClient()
    const { data: updated } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customer.id)
      .single()

    onComplete(updated || customer)
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
          {/* Logo */}
          <div className="flex justify-center pt-8 pb-0">
            <div className="relative w-36 h-10">
              <Image src="/images/growthos-logo.png" alt="GrowthOS" fill className="object-contain" priority />
            </div>
          </div>

          {stage === 'form' && (
            <form onSubmit={handleSubmit} className="p-8 pt-5">
              <h2
                className="text-2xl font-bold mb-1 text-center"
                style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
              >
                Tell us about your business
              </h2>
              <p
                className="text-sm text-center mb-6"
                style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}
              >
                Alex needs these details to run your discovery session.
              </p>

              {/* Honeypot — hidden from real users */}
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
                Alex is reviewing your business...
              </h2>
              <div className="flex justify-center mb-8">
                <Loader size={32} className="animate-spin" style={{ color: '#43C6AC' }} />
              </div>
              <div className="space-y-4 text-left">
                <ResearchStep active={step1} label="Reviewing your website" />
                <ResearchStep active={step2} label="Analyzing your market position" />
                <ResearchStep active={step3} label="Preparing your discovery session" />
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
