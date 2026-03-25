'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Customer, Business } from '@/types'
import { Loader, CheckCircle, Building2 } from 'lucide-react'
import { usePlaceSearch } from '@/lib/use-place-search'

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

const STEP_LABELS = [
  'Connecting to your website',
  'Reading your pages and services',
  'Scanning Google Business Profile',
  'Analyzing your customer reviews',
  'Researching your market position',
  'Identifying competitive signals',
  'Building your business profile',
  'Alex is ready',
]

const STEP_TIMINGS = [200, 1200, 2400, 3800, 5500, 7200, 9000]

export default function IntakeGate({ customer, existingBusiness, onComplete }: IntakeGateProps) {
  const [stage, setStage] = useState<'intro' | 'form' | 'loading' | 'summary'>('intro')
  const [businessName, setBusinessName] = useState(existingBusiness?.business_name || '')
  const [websiteUrl, setWebsiteUrl] = useState(existingBusiness?.website_url || '')
  const [primaryService, setPrimaryService] = useState(existingBusiness?.primary_service || '')
  const [geographicMarket, setGeographicMarket] = useState(existingBusiness?.geographic_market || '')
  const [gmbUrl, setGmbUrl] = useState(existingBusiness?.gmb_url || '')
  const [honeypot, setHoneypot] = useState('')
  const [secondHoneypot, setSecondHoneypot] = useState('')
  const [formStartTime] = useState(Date.now())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [steps, setSteps] = useState<boolean[]>(Array(8).fill(false))
  const [apiComplete, setApiComplete] = useState(false)
  const [researchResult, setResearchResult] = useState<Record<string, unknown> | null>(null)
  const [businessRef, setBusinessRef] = useState<Business | null>(null)
  const [manualEntry, setManualEntry] = useState(!!existingBusiness)

  const {
    locationQuery, locationSuggestions, selectedLocation,
    locationLoading, searchLocations, selectLocation, clearLocation,
    businessQuery, businessSuggestions, selectedBusiness,
    businessLoading, searchBusinesses, selectBusiness, clearBusiness,
  } = usePlaceSearch()

  useEffect(() => {
    if (selectedBusiness) {
      setBusinessName(selectedBusiness.name)
      if (selectedBusiness.website) {
        setWebsiteUrl(selectedBusiness.website.replace(/\/$/, ''))
      }
      if (selectedLocation) {
        setGeographicMarket(
          selectedLocation.name + (selectedLocation.address ? ', ' + selectedLocation.address : '')
        )
      }
    }
  }, [selectedBusiness, selectedLocation])

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!manualEntry && !selectedBusiness && !businessName.trim()) {
      errs.businessName = 'Please find your business or enter manually'
    }
    if (manualEntry && !businessName.trim()) {
      errs.businessName = 'Business name is required'
    }
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

    // Activate steps 1-7 on timers
    STEP_TIMINGS.forEach((ms, i) => {
      setTimeout(() => {
        setSteps(prev => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, ms)
    })

    let business: Business | null = null

    if (existingBusiness) {
      const supabase = createClient()
      await supabase.from('businesses').update({
        business_name: businessName.trim(),
        website_url: websiteUrl.trim(),
        primary_service: primaryService.trim(),
        geographic_market: geographicMarket.trim(),
        gmb_url: gmbUrl.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', existingBusiness.id)

      const [researchRes] = await Promise.all([
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
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ])

      // Parse research result
      if (researchRes && researchRes.ok) {
        const resData = await researchRes.json()
        setResearchResult(resData.data?.research || resData.research || null)
      }

      const { data: updatedBusiness } = await supabase
        .from('businesses').select('*').eq('id', existingBusiness.id).single()
      business = updatedBusiness
    } else {
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
            placeId: selectedBusiness?.placeId || undefined,
          }),
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])

      if (createRes.ok) {
        const createData = await createRes.json()
        business = createData.business

        if (business) {
          localStorage.setItem('signalshot_active_business', business.id)

          const [researchRes] = await Promise.all([
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
            new Promise((resolve) => setTimeout(resolve, 9000)),
          ])

          if (researchRes && researchRes.ok) {
            const resData = await researchRes.json()
            setResearchResult(resData.data?.research || resData.research || null)
          }

          const supabase = createClient()
          const { data: updatedBusiness } = await supabase
            .from('businesses').select('*').eq('id', business.id).single()
          if (updatedBusiness) business = updatedBusiness
        }
      }
    }

    if (!business) {
      const fallbackSupabase = createClient()
      const { data: freshBusiness } = await fallbackSupabase
        .from('businesses').select('*').eq('id', existingBusiness?.id || '').single()
      business = freshBusiness
    }

    // Activate step 8 (Alex is ready)
    setSteps(prev => {
      const next = [...prev]
      next[7] = true
      return next
    })
    setApiComplete(true)
    setBusinessRef(business)

    // Show summary after short delay
    setTimeout(() => setStage('summary'), 800)
  }

  function handleContinue() {
    const supabase = createClient()
    supabase.from('customers').select('*').eq('id', customer.id).single()
      .then(({ data }) => {
        if (businessRef) {
          onComplete(data || customer, businessRef)
        }
      })
  }

  return (
    <>
      <style>{`
        @keyframes intakeFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[900] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ animation: 'intakeFadeIn 0.3s ease-out' }}
        >
          {stage !== 'intro' && stage !== 'summary' && (
            <div className="flex justify-center pt-8 pb-0">
              <div className="relative w-36 h-10">
                <Image src="/images/signalshot-logo.png" alt="SignalShot" fill className="object-contain" priority onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span style="font-size:20px;font-weight:700;color:#43C6AC;letter-spacing:-0.5px">SignalShot</span>'; }} />
              </div>
            </div>
          )}

          {stage === 'intro' && (
            <div className="p-8 pt-6 text-center">
              <div className="flex justify-center mb-6">
                <Image
                  src="/images/signalshot-logo.png"
                  alt="SignalShot"
                  width={140}
                  height={50}
                  style={{ objectFit: 'contain' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                Welcome to SignalShot
              </h2>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: '#4b5563', fontFamily: 'DM Sans, sans-serif' }}>
                SignalShot uses Alex — an AI discovery strategist — to build your complete Ideal Customer Profile through a live conversation.
              </p>
              <p className="text-sm mb-8 leading-relaxed" style={{ color: '#4b5563', fontFamily: 'DM Sans, sans-serif' }}>
                Before Alex can start, he needs 60 seconds of context about your business. This helps him skip the basics and start with smarter questions.
              </p>
              <div className="space-y-3 mb-8 text-left">
                {[
                  { icon: '🎯', title: 'Your Ideal Customer Profile', desc: 'A complete document identifying exactly who your best customer is' },
                  { icon: '📣', title: 'Your Messaging Framework', desc: 'The exact language that resonates with your ideal customer' },
                  { icon: '🚀', title: 'Your Go-To-Market Strategy', desc: 'Channels, content, and a 90-day action plan to reach them' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: '#f8f9fc' }}>
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}>{item.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setStage('form')} className="w-full py-3 rounded-xl font-semibold text-white text-sm" style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}>
                Let&apos;s Get Started →
              </button>
              <p className="text-xs mt-3" style={{ color: '#9ca3af', fontFamily: 'DM Sans, sans-serif' }}>Takes about 60 seconds</p>
            </div>
          )}

          {stage === 'form' && (
            <form onSubmit={handleSubmit} className="p-8 pt-5">
              <h2 className="text-2xl font-bold mb-1 text-center" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                {existingBusiness ? 'Update your business details' : 'Tell Alex about your business'}
              </h2>
              <p className="text-sm text-center mb-6" style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
                Alex will use this to skip the basics and start your SignalMap interview with smarter, more specific questions.
              </p>
              <input type="text" name="website_url_confirm" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <input type="email" name="confirm_email_address" value={secondHoneypot} onChange={(e) => setSecondHoneypot(e.target.value)} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="space-y-4">
                {/* Place search — location + business */}
                {!manualEntry && (
                  <div className="space-y-4">
                    {!selectedLocation ? (
                      <div className="relative">
                        <label className="block text-sm font-medium mb-1" style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}>
                          Where is your business located?
                        </label>
                        <div className="relative">
                          <input
                            type="text" value={locationQuery} onChange={(e) => searchLocations(e.target.value)}
                            placeholder="City, region, or country..." autoComplete="off"
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
                          />
                          {locationLoading && <div className="absolute right-3 top-3"><Loader size={14} className="animate-spin" style={{ color: '#9ca3af' }} /></div>}
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Start typing your city — works worldwide</p>
                        {locationSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-xl shadow-lg mt-1 overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
                            {locationSuggestions.map((s) => (
                              <button key={s.placeId} type="button" onClick={() => selectLocation(s)} className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0 flex items-start gap-2" style={{ borderColor: '#f3f4f6' }}>
                                <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
                                <div>
                                  <p className="text-sm font-medium" style={{ color: '#191654' }}>{s.name}</p>
                                  {s.address && <p className="text-xs" style={{ color: '#9ca3af' }}>{s.address}</p>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5" style={{ backgroundColor: 'rgba(67,198,172,0.12)', color: '#43C6AC' }}>
                            📍 {selectedLocation.name}{selectedLocation.address && `, ${selectedLocation.address}`}
                            <button type="button" onClick={clearLocation} className="ml-1 hover:opacity-70" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#43C6AC', fontSize: 16, lineHeight: 1 }}>×</button>
                          </span>
                        </div>
                        {!selectedBusiness ? (
                          <div className="relative">
                            <label className="block text-sm font-medium mb-1" style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}>Find your business on Google</label>
                            <div className="relative">
                              <input
                                type="text" value={businessQuery} onChange={(e) => searchBusinesses(e.target.value)}
                                placeholder="Start typing your business name..." autoComplete="off" autoFocus
                                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                                style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
                              />
                              {businessLoading && <div className="absolute right-3 top-3"><Loader size={14} className="animate-spin" style={{ color: '#9ca3af' }} /></div>}
                            </div>
                            {businessSuggestions.length > 0 && (
                              <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-xl shadow-lg mt-1 overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
                                {businessSuggestions.map((s) => (
                                  <button key={s.placeId} type="button" onClick={() => selectBusiness(s)} className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0" style={{ borderColor: '#f3f4f6' }}>
                                    <p className="text-sm font-medium" style={{ color: '#191654' }}>{s.name}</p>
                                    <p className="text-xs" style={{ color: '#9ca3af' }}>{s.address}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border" style={{ borderColor: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.04)' }}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#191654' }}>
                                  <Building2 size={16} style={{ color: '#43C6AC' }} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold" style={{ color: '#191654' }}>✓ {selectedBusiness.name}</p>
                                  <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{selectedBusiness.address}</p>
                                  {selectedBusiness.rating && (
                                    <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                                      ⭐ {selectedBusiness.rating} · {selectedBusiness.reviewCount} reviews{selectedBusiness.category && ` · ${selectedBusiness.category}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button type="button" onClick={clearBusiness} className="text-xs font-medium flex-shrink-0 ml-2" style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}>Change</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!manualEntry && !selectedBusiness && (
                  <button type="button" onClick={() => setManualEntry(true)} className="text-xs w-full text-center pt-1" style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                    My business isn&apos;t on Google — enter manually
                  </button>
                )}
                {manualEntry && (
                  <div className="space-y-4">
                    <button type="button" onClick={() => setManualEntry(false)} className="text-xs flex items-center gap-1" style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}>
                      ← Search Google instead
                    </button>
                    <Field label="Business Name" placeholder="e.g. Acme Marketing Co." hint="The name of your company or brand" value={businessName} onChange={setBusinessName} error={errors.businessName} />
                  </div>
                )}
                {errors.businessName && !manualEntry && (
                  <p className="text-xs" style={{ color: '#ef4444' }}>{errors.businessName}</p>
                )}
                <Field label="Website URL" placeholder="e.g. acmemarketing.com" hint="Your main website" value={websiteUrl} onChange={setWebsiteUrl} error={errors.websiteUrl} />
                <Field label="Primary Service or Product" placeholder="e.g. SEO & content marketing for B2B SaaS" hint="The core thing you sell" value={primaryService} onChange={setPrimaryService} error={errors.primaryService} />
                <Field label="Primary Geographic Market" placeholder="e.g. United States, North America, Global" hint="Where your customers are located" value={geographicMarket} onChange={setGeographicMarket} error={errors.geographicMarket} />
                <Field label="Google My Business URL" placeholder="e.g. https://g.page/your-business" hint="Optional — your GMB profile URL helps Alex understand your local presence" value={gmbUrl} onChange={setGmbUrl} error={errors.gmbUrl} />
              </div>
              <button type="submit" className="w-full mt-6 py-3 rounded-xl font-semibold text-white text-sm" style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}>
                Find My Customers
              </button>
            </form>
          )}

          {stage === 'loading' && (
            <div className="p-8 pt-5 text-center">
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                Alex is researching your business...
              </h2>
              <div className="flex justify-center mb-8">
                <Loader size={32} className="animate-spin" style={{ color: '#43C6AC' }} />
              </div>
              <div className="space-y-3 text-left">
                {STEP_LABELS.map((label, i) => (
                  <ResearchStep
                    key={i}
                    active={steps[i]}
                    label={label}
                    isPulsing={i === 7 && steps[6] && !apiComplete}
                  />
                ))}
              </div>
              <div className="h-6" />
            </div>
          )}

          {stage === 'summary' && researchResult && (
            <div className="p-8 pt-6">
              <div className="flex justify-center mb-5">
                <Image src="/images/signalshot-logo.png" alt="SignalShot" width={120} height={40} style={{ objectFit: 'contain' }} />
              </div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(67,198,172,0.15)' }}>
                  <CheckCircle size={28} style={{ color: '#43C6AC' }} />
                </div>
                <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#191654', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                  Alex has finished his research
                </h2>
                <p style={{ color: '#6b7280', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}>
                  Here&apos;s what he found about {businessName}
                </p>
              </div>
              <div className="space-y-3 mb-6">
                {Boolean(researchResult.websiteFound) && (
                  <ResearchHighlight icon="🌐" label="Website analyzed" value={researchResult.websiteQuality === 'strong' ? 'Strong online presence detected' : 'Website found and reviewed'} />
                )}
                {(researchResult.gmbData as Record<string, string> | undefined)?.reviewCount ? (
                  <ResearchHighlight icon="⭐" label="Reviews analyzed" value={`${(researchResult.gmbData as Record<string, string>).reviewCount} reviews · ${(researchResult.gmbData as Record<string, string>).averageRating} avg rating`} />
                ) : null}
                {(researchResult.voiceOfCustomer as Record<string, unknown> | undefined)?.reviewsFound ? (
                  <ResearchHighlight icon="💬" label="Customer voice extracted" value={`${((researchResult.voiceOfCustomer as Record<string, unknown>)?.extractedPhrases as string[] | undefined)?.length || 0} key phrases identified`} />
                ) : null}
                {Boolean(researchResult.differentiators) && (
                  <ResearchHighlight icon="🎯" label="Differentiators identified" value="Unique positioning signals found" />
                )}
              </div>
              <button
                onClick={handleContinue}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm"
                style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
              >
                See What Alex Found →
              </button>
              <p className="text-center text-xs mt-3" style={{ color: '#9ca3af' }}>
                You&apos;ll be taken to BusinessSignals to review the full research before starting your SignalMap Interview
              </p>
            </div>
          )}

          {stage === 'summary' && !researchResult && (
            <div className="p-8 pt-6 text-center">
              <div className="flex justify-center mb-5">
                <Image src="/images/signalshot-logo.png" alt="SignalShot" width={120} height={40} style={{ objectFit: 'contain' }} />
              </div>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(67,198,172,0.15)' }}>
                <CheckCircle size={28} style={{ color: '#43C6AC' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                Your business profile is ready
              </h2>
              <button
                onClick={handleContinue}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm mt-4"
                style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
              >
                Continue →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Field({ label, placeholder, hint, value, onChange, error }: {
  label: string; placeholder: string; hint: string; value: string; onChange: (v: string) => void; error?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}>{label}</label>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all"
        style={{ borderColor: error ? '#ef4444' : focused ? '#43C6AC' : '#e5e7eb', boxShadow: focused ? '0 0 0 3px rgba(67,198,172,0.12)' : 'none', fontFamily: 'DM Sans, sans-serif' }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      />
      {error ? <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p> : <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{hint}</p>}
    </div>
  )
}

function ResearchStep({ active, label, isPulsing }: { active: boolean; label: string; isPulsing?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-5 h-5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: active ? '#43C6AC' : '#e5e7eb',
          transition: 'background-color 0.4s ease',
          animation: isPulsing ? 'pulseDot 1.2s ease-in-out infinite' : 'none',
        }}
      />
      <span className="text-sm" style={{ color: active ? '#191654' : '#9ca3af', fontWeight: active ? 500 : 400, fontFamily: 'DM Sans, sans-serif', transition: 'color 0.4s ease' }}>
        {label}
      </span>
    </div>
  )
}

function ResearchHighlight({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#f8f9fc' }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <p className="text-xs font-semibold" style={{ color: '#191654' }}>{label}</p>
        <p className="text-xs" style={{ color: '#6b7280' }}>{value}</p>
      </div>
    </div>
  )
}
