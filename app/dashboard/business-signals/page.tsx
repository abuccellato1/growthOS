'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Business, Session } from '@/types'
import { Building2, Loader, ExternalLink, RefreshCw, FileText, Clock, MessageSquare } from 'lucide-react'
import SignalScoreWidget from '@/components/SignalScoreWidget'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface EditField {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  hint?: string
  required?: boolean
}

function EditInput({ label, value, onChange, placeholder, hint, required }: EditField) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label
        className="block text-sm font-medium mb-1"
        style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}
      >
        {label} {required === false && <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all"
        style={{
          borderColor: focused ? '#43C6AC' : '#e5e7eb',
          boxShadow: focused ? '0 0 0 3px rgba(67,198,172,0.12)' : 'none',
          fontFamily: 'DM Sans, sans-serif',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {hint && <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{hint}</p>}
    </div>
  )
}

export default function BusinessSignalsPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [vocCount, setVocCount] = useState(0)
  const [vocPhraseCount, setVocPhraseCount] = useState(0)
  const [vocTopPhrases, setVocTopPhrases] = useState<string[]>([])

  // Edit form
  const [businessName, setBusinessName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [gmbUrl, setGmbUrl] = useState('')
  const [primaryService, setPrimaryService] = useState('')
  const [geographicMarket, setGeographicMarket] = useState('')

  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const activeBizId = localStorage.getItem('signalshot_active_business')
      if (!activeBizId) { router.push('/dashboard'); return }

      const { data: bizData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', activeBizId)
        .single()

      if (!bizData) { router.push('/dashboard'); return }
      setBusiness(bizData)

      // Fetch sessions for this business
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('business_id', activeBizId)
        .order('created_at', { ascending: false })

      if (sessionData) setSessions(sessionData)

      // Fetch VOC data
      const { data: vocData } = await supabase
        .from('voice_of_customer')
        .select('id, extracted_phrases, top_phrases')
        .eq('business_id', activeBizId)

      if (vocData) {
        setVocCount(vocData.length)
        let phraseTotal = 0
        const phrases: string[] = []
        for (const v of vocData) {
          if (v.extracted_phrases) phraseTotal += (v.extracted_phrases as string[]).length
          if (v.top_phrases) phrases.push(...(v.top_phrases as string[]))
        }
        setVocPhraseCount(phraseTotal)
        setVocTopPhrases(phrases.slice(0, 3))
      }

      setLoading(false)
    }
    load()
  }, [router])

  function openEdit() {
    if (!business) return
    setBusinessName(business.business_name || '')
    setWebsiteUrl(business.website_url || '')
    setGmbUrl(business.gmb_url || '')
    setPrimaryService(business.primary_service || '')
    setGeographicMarket(business.geographic_market || '')
    setEditing(true)
    setSuccessMsg('')
  }

  async function handleSave() {
    if (!business) return
    setSaving(true)

    const supabase = createClient()
    await supabase.from('businesses').update({
      business_name: businessName.trim() || null,
      website_url: websiteUrl.trim() || null,
      gmb_url: gmbUrl.trim() || null,
      primary_service: primaryService.trim() || null,
      geographic_market: geographicMarket.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', business.id)

    // Run research in background
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
    }).catch(() => null)

    const updated: Business = {
      ...business,
      business_name: businessName.trim(),
      website_url: websiteUrl.trim() || null,
      gmb_url: gmbUrl.trim() || null,
      primary_service: primaryService.trim() || null,
      geographic_market: geographicMarket.trim() || null,
    }
    setBusiness(updated)
    setEditing(false)
    setSaving(false)
    setSuccessMsg('Business profile updated. Alex has fresh context for your next session.')
    setTimeout(() => setSuccessMsg(''), 5000)
  }

  async function handleRefreshResearch() {
    if (!business) return
    setRefreshing(true)
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          businessName: business.business_name,
          websiteUrl: business.website_url,
          primaryService: business.primary_service,
          geographicMarket: business.geographic_market,
          gmbUrl: business.gmb_url || undefined,
        }),
      })
      if (res.ok) {
        // Refetch business to get updated research
        const supabase = createClient()
        const { data: updated } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', business.id)
          .single()
        if (updated) setBusiness(updated)
        setSuccessMsg('Research refreshed successfully.')
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        setSuccessMsg('Research refresh failed. Profile changes were saved.')
        setTimeout(() => setSuccessMsg(''), 5000)
      }
    } catch {
      setSuccessMsg('Research refresh failed. Please try again later.')
      setTimeout(() => setSuccessMsg(''), 5000)
    }
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin" style={{ color: '#43C6AC' }} />
      </div>
    )
  }

  if (!business) return null

  const research = business.business_research
  const completedSessions = sessions.filter((s) => s.status === 'completed')

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
          <Building2 size={26} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            BusinessSignals
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Your business profile — the foundation Alex uses for every SignalMap interview.
          </p>
        </div>
      </div>

      {/* Signal Score */}
      <SignalScoreWidget businessId={business.id} />

      {/* Voice of Customer Summary */}
      <div className="p-5 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <div className="flex items-center gap-3 mb-3">
          <MessageSquare size={18} style={{ color: '#43C6AC' }} />
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
            Voice of Customer
          </h2>
        </div>
        {vocCount > 0 ? (
          <>
            <p className="text-sm mb-3" style={{ color: '#6b7280' }}>
              {vocCount} customer voice {vocCount === 1 ? 'entry' : 'entries'} · {vocPhraseCount} phrases extracted
            </p>
            {vocTopPhrases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {vocTopPhrases.map((p, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full text-xs"
                    style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#374151' }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
            <Link
              href="/dashboard/voice-of-customer"
              className="text-xs font-medium"
              style={{ color: '#43C6AC' }}
            >
              Add More Customer Voices →
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: '#9ca3af' }}>
              No customer voice data yet
            </p>
            <Link
              href="/dashboard/voice-of-customer"
              className="text-xs font-medium"
              style={{ color: '#43C6AC' }}
            >
              Add reviews and testimonials to make your marketing smarter →
            </Link>
          </>
        )}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div
          className="mb-6 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ backgroundColor: '#f0fdf9', color: '#43C6AC', border: '1px solid rgba(67,198,172,0.2)' }}
        >
          {successMsg}
        </div>
      )}

      {/* Card 1 — Business Profile */}
      <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
            Business Profile
          </h2>
          {!editing && (
            <button
              onClick={openEdit}
              className="text-sm font-medium"
              style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Edit Business Profile
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <EditInput label="Business Name" value={businessName} onChange={setBusinessName} placeholder="e.g. Acme Marketing Co." />
            <EditInput label="Website URL" value={websiteUrl} onChange={setWebsiteUrl} placeholder="e.g. acmemarketing.com" />
            <EditInput
              label="Google My Business Profile URL"
              value={gmbUrl}
              onChange={setGmbUrl}
              placeholder="e.g. https://g.page/your-business"
              hint="Your GMB profile URL — helps Alex understand your local presence and review signals"
              required={false}
            />
            <EditInput label="Primary Service or Product" value={primaryService} onChange={setPrimaryService} placeholder="e.g. SEO & content marketing for B2B SaaS" />
            <EditInput label="Primary Geographic Market" value={geographicMarket} onChange={setGeographicMarket} placeholder="e.g. United States, North America, Global" />

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm mt-2 disabled:opacity-60"
              style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
            >
              {saving ? 'Saving and refreshing research...' : 'Save & Refresh Alex\'s Research'}
            </button>
            <button
              onClick={() => { setEditing(false); setSuccessMsg('') }}
              disabled={saving}
              className="w-full text-center text-sm py-1"
              style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Business Name</p>
              <p className="text-sm font-medium" style={{ color: '#191654' }}>{business.business_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Website</p>
              <p className="text-sm" style={{ color: '#374151' }}>
                {business.website_url ? (
                  <a href={business.website_url.startsWith('http') ? business.website_url : `https://${business.website_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: '#43C6AC' }}>
                    {business.website_url} <ExternalLink size={12} />
                  </a>
                ) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Google My Business</p>
              <p className="text-sm" style={{ color: '#374151' }}>
                {business.gmb_url ? (
                  <a href={business.gmb_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: '#43C6AC' }}>
                    View GMB Profile <ExternalLink size={12} />
                  </a>
                ) : <span style={{ color: '#9ca3af' }}>Not set</span>}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Primary Service</p>
                <p className="text-sm" style={{ color: '#374151' }}>{business.primary_service || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Geographic Market</p>
                <p className="text-sm" style={{ color: '#374151' }}>{business.geographic_market || '—'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card 2 — Alex's Research */}
      {research && (
        <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
              Alex&apos;s Research
            </h2>
            <button
              onClick={handleRefreshResearch}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
              style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh Research'}
            </button>
          </div>

          <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
            Last scanned: {formatDate(business.updated_at)}
          </p>

          <div className="space-y-3">
            {research.whatTheyDo && (
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>What they do</p>
                <p className="text-sm" style={{ color: '#374151' }}>{research.whatTheyDo}</p>
              </div>
            )}
            {research.apparentTargetCustomer && (
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Apparent target customer</p>
                <p className="text-sm" style={{ color: '#374151' }}>{research.apparentTargetCustomer}</p>
              </div>
            )}
            {research.differentiators && (
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Differentiators</p>
                <p className="text-sm" style={{ color: '#374151' }}>{research.differentiators}</p>
              </div>
            )}
            {research.gmbData && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: '#f3f4f6' }}>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>GMB Signals</p>
                <div className="grid grid-cols-2 gap-3">
                  {research.gmbData.reviewCount && (
                    <div>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>Reviews</p>
                      <p className="text-sm font-medium" style={{ color: '#191654' }}>{research.gmbData.reviewCount}</p>
                    </div>
                  )}
                  {research.gmbData.averageRating && (
                    <div>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>Avg Rating</p>
                      <p className="text-sm font-medium" style={{ color: '#191654' }}>{research.gmbData.averageRating}</p>
                    </div>
                  )}
                  {research.gmbData.categories && (
                    <div>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>Categories</p>
                      <p className="text-sm" style={{ color: '#374151' }}>{research.gmbData.categories}</p>
                    </div>
                  )}
                  {research.gmbData.serviceArea && (
                    <div>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>Service Area</p>
                      <p className="text-sm" style={{ color: '#374151' }}>{research.gmbData.serviceArea}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card 3 — Session History */}
      <div className="p-6 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: '#9ca3af' }}>
          Session History
        </h2>
        <p className="text-sm mb-4" style={{ color: '#6b7280' }}>
          {completedSessions.length} completed SignalMap interview{completedSessions.length !== 1 ? 's' : ''}
        </p>

        {sessions.length === 0 ? (
          <p className="text-sm" style={{ color: '#9ca3af' }}>No sessions yet for this business.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-3 border-b last:border-0"
                style={{ borderColor: '#f3f4f6' }}
              >
                <div className="flex items-center gap-3">
                  {s.status === 'completed' ? (
                    <FileText size={16} style={{ color: '#43C6AC' }} />
                  ) : (
                    <Clock size={16} style={{ color: '#9ca3af' }} />
                  )}
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#191654' }}>
                      {s.status === 'completed' ? 'SignalMap Complete' : `Phase ${s.phase} of 4`}
                      {s.archived && <span className="text-xs ml-2" style={{ color: '#9ca3af' }}>(Archived)</span>}
                    </p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>
                      {formatDate(s.created_at)}
                    </p>
                  </div>
                </div>
                {s.status === 'completed' && !s.archived && (
                  <Link
                    href="/dashboard/deliverables"
                    className="text-xs font-medium"
                    style={{ color: '#43C6AC' }}
                  >
                    View →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
