'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Business, Session } from '@/types'
import { Building2, Loader, ExternalLink, RefreshCw, FileText, Clock, MessageSquare, ArrowRight, CheckCircle, MapPin, Mic } from 'lucide-react'
import SignalScoreWidget from '@/components/SignalScoreWidget'
import PlaceVerificationBanner from '@/components/PlaceVerificationBanner'
import BusinessPlaceSearch from '@/components/BusinessPlaceSearch'
import { SelectedBusiness } from '@/lib/use-place-search'

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
  const [vocDetail, setVocDetail] = useState<Record<string, unknown> | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showPlaceSearch, setShowPlaceSearch] = useState(false)
  const [verifying, setVerifying] = useState(false)

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
        .select('*')
        .eq('business_id', activeBizId)
        .order('created_at', { ascending: false })

      if (vocData && vocData.length > 0) {
        setVocCount(vocData.length)
        let phraseTotal = 0
        const phrases: string[] = []
        for (const v of vocData) {
          if (v.extracted_phrases) phraseTotal += (v.extracted_phrases as string[]).length
          if (v.top_phrases) phrases.push(...(v.top_phrases as string[]))
        }
        setVocPhraseCount(phraseTotal)
        setVocTopPhrases(phrases.slice(0, 3))
        setVocDetail(vocData[0] as Record<string, unknown>)
      }

      setLoading(false)
    }
    load()
  }, [router])

  // Poll research_status while running
  useEffect(() => {
    if (business?.research_status !== 'running') return
    const supabase = createClient()
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('businesses')
        .select('research_status, business_research')
        .eq('id', business.id)
        .single()
      if (data?.research_status === 'complete') {
        setBusiness(prev => prev ? { ...prev, research_status: data.research_status, business_research: data.business_research } : prev)
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [business?.research_status, business?.id])

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
      research_status: 'running',
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
    setBusiness(prev => prev ? { ...prev, research_status: 'running' } : prev)
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

  async function handleDeleteBusiness() {
    if (!business || deleteConfirmText !== business.business_name) return
    setDeleting(true)
    try {
      const res = await fetch('/api/businesses/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          confirmName: deleteConfirmText,
        }),
      })
      if (res.ok) {
        localStorage.removeItem('signalshot_active_business')
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin" style={{ color: '#43C6AC' }} />
      </div>
    )
  }

  if (!business) return null

  const research = business?.business_research as Record<string, unknown> | null
  const gmbData = research?.gmbData as Record<string, unknown> | null
  const completedSessions = sessions.filter((s) => s.status === 'completed')
  const hasNoSession = sessions.length === 0 || sessions.every(s => s.status === 'not_started')

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

      {/* Research running indicator */}
      {business.research_status === 'running' && (
        <div className="flex items-center gap-3 p-4 rounded-xl mb-6" style={{ backgroundColor: 'rgba(67,198,172,0.08)', border: '1px solid rgba(67,198,172,0.2)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: '#43C6AC' }} />
          <p className="text-sm" style={{ color: '#191654' }}>
            Alex is researching your business profile. Some data may update in a moment.
          </p>
        </div>
      )}

      {/* Place verification banner */}
      {!business.place_id && !showPlaceSearch && (
        <PlaceVerificationBanner onVerifyClick={() => setShowPlaceSearch(true)} />
      )}

      {/* Place search overlay */}
      {showPlaceSearch && (
        <div
          className="p-6 rounded-2xl border mb-6"
          style={{ borderColor: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.04)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
              Find your business on Google
            </h3>
            <button onClick={() => setShowPlaceSearch(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              ✕
            </button>
          </div>
          <BusinessPlaceSearch
            onSelect={async (place: SelectedBusiness) => {
              setVerifying(true)
              try {
                const supabase = createClient()
                await supabase.from('businesses').update({
                  place_id: place.placeId,
                  business_name: place.name,
                  website_url: place.website || business?.website_url,
                  updated_at: new Date().toISOString(),
                }).eq('id', business!.id)
                await fetch('/api/research', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    businessId: business!.id,
                    businessName: place.name,
                    websiteUrl: place.website || business?.website_url || '',
                    primaryService: business?.primary_service || '',
                    geographicMarket: business?.geographic_market || '',
                    placeId: place.placeId,
                  }),
                }).catch(() => null)
                window.location.reload()
              } catch {
                setVerifying(false)
              }
            }}
          />
          {verifying && (
            <p className="text-sm text-center mt-4" style={{ color: '#43C6AC' }}>
              Verifying and refreshing business data...
            </p>
          )}
        </div>
      )}

      {/* Signal Score */}
      <SignalScoreWidget businessId={business.id} />

      {/* Start Interview CTA — show when no completed session */}
      {hasNoSession && (
        <div
          className="p-5 rounded-xl border-2 mb-6 cursor-pointer hover:shadow-md transition-all"
          style={{ borderColor: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.04)' }}
          onClick={() => router.push('/dashboard/alex')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#191654' }}>
                <MessageSquare size={22} style={{ color: '#43C6AC' }} />
              </div>
              <div>
                <p className="font-bold text-base" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                  Start Your SignalMap Interview
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                  Alex is ready. This takes 20-30 minutes and unlocks all your modules.
                </p>
              </div>
            </div>
            <ArrowRight size={18} style={{ color: '#43C6AC' }} />
          </div>
        </div>
      )}

      {/* CustomerSignals */}
      <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mic size={16} style={{ color: '#43C6AC' }} />
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
              CustomerSignals
            </h2>
          </div>
          <Link href="/dashboard/voice-of-customer" className="text-xs font-medium" style={{ color: '#43C6AC' }}>
            View All →
          </Link>
        </div>
        {vocCount > 0 && vocDetail ? (
          <>
            <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
              {vocCount} {vocCount === 1 ? 'source' : 'sources'} · {vocPhraseCount} phrases extracted · Alex uses these to ask sharper questions
            </p>
            {((vocDetail.top_phrases as string[]) || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {((vocDetail.top_phrases as string[]) || []).slice(0, 6).map((phrase: string, i: number) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(67,198,172,0.12)', color: '#43C6AC' }}>
                    &ldquo;{phrase}&rdquo;
                  </span>
                ))}
              </div>
            )}
            {((vocDetail.outcome_language as string[]) || []).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Results customers mention:</p>
                <ul className="space-y-1">
                  {((vocDetail.outcome_language as string[]) || []).slice(0, 3).map((item: string, i: number) => (
                    <li key={i} className="text-xs flex items-start gap-2" style={{ color: '#6b7280' }}>
                      <span style={{ color: '#43C6AC' }}>→</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link href="/dashboard/voice-of-customer" className="text-xs font-medium" style={{ color: '#43C6AC' }}>
              Add more to CustomerSignals →
            </Link>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm mb-1 font-medium" style={{ color: '#374151' }}>No customer signals yet</p>
            <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
              Run business research or add reviews manually to extract customer language for your modules.
            </p>
            <Link href="/dashboard/voice-of-customer" className="text-xs font-semibold" style={{ color: '#43C6AC' }}>
              Add to CustomerSignals →
            </Link>
          </div>
        )}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-medium" style={{ backgroundColor: '#f0fdf9', color: '#43C6AC', border: '1px solid rgba(67,198,172,0.2)' }}>
          {successMsg}
        </div>
      )}

      {/* Card 1 — Business Profile */}
      <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>Business Profile</h2>
          {!editing && (
            <button onClick={openEdit} className="text-sm font-medium" style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}>
              Edit Business Profile
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            {/* Google verification status */}
            <div className="mb-2">
              {business.place_id ? (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: 'rgba(67,198,172,0.08)' }}>
                  <CheckCircle size={16} style={{ color: '#43C6AC' }} />
                  <p className="text-xs" style={{ color: '#43C6AC' }}>Google verified · Place ID confirmed</p>
                  <button type="button" onClick={() => { setEditing(false); setShowPlaceSearch(true) }} className="text-xs ml-auto" style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Change business →
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => { setEditing(false); setShowPlaceSearch(true) }} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold" style={{ borderColor: '#43C6AC', color: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.04)' }}>
                  <MapPin size={16} />
                  Verify Your Business on Google
                </button>
              )}
            </div>
            <EditInput label="Business Name" value={businessName} onChange={setBusinessName} placeholder="e.g. Acme Marketing Co." />
            <EditInput label="Website URL" value={websiteUrl} onChange={setWebsiteUrl} placeholder="e.g. acmemarketing.com" />
            <EditInput label="Google My Business Profile URL" value={gmbUrl} onChange={setGmbUrl} placeholder="e.g. https://g.page/your-business" hint="Your GMB profile URL — helps Alex understand your local presence and review signals" required={false} />
            <EditInput label="Primary Service or Product" value={primaryService} onChange={setPrimaryService} placeholder="e.g. SEO & content marketing for B2B SaaS" />
            <EditInput label="Primary Geographic Market" value={geographicMarket} onChange={setGeographicMarket} placeholder="e.g. United States, North America, Global" />
            <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl font-semibold text-white text-sm mt-2 disabled:opacity-60" style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}>
              {saving ? 'Saving and refreshing research...' : 'Save & Refresh Alex\'s Research'}
            </button>
            <button onClick={() => { setEditing(false); setSuccessMsg('') }} disabled={saving} className="w-full text-center text-sm py-1" style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Business Name</p><p className="text-sm font-medium" style={{ color: '#191654' }}>{business.business_name}</p></div>
            <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Website</p><p className="text-sm" style={{ color: '#374151' }}>{business.website_url ? <a href={business.website_url.startsWith('http') ? business.website_url : `https://${business.website_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: '#43C6AC' }}>{business.website_url} <ExternalLink size={12} /></a> : '—'}</p></div>
            <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Google My Business</p><p className="text-sm" style={{ color: '#374151' }}>{business.gmb_url ? <a href={business.gmb_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: '#43C6AC' }}>View GMB Profile <ExternalLink size={12} /></a> : <span style={{ color: '#9ca3af' }}>Not set</span>}</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Primary Service</p><p className="text-sm" style={{ color: '#374151' }}>{business.primary_service || '—'}</p></div>
              <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Geographic Market</p><p className="text-sm" style={{ color: '#374151' }}>{business.geographic_market || '—'}</p></div>
            </div>
          </div>
        )}
      </div>

      {/* Card 2 — Alex's Research */}
      {research && (
        <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>Alex&apos;s Research</h2>
            <button onClick={handleRefreshResearch} disabled={refreshing} className="flex items-center gap-1.5 text-sm font-medium disabled:opacity-50" style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh Research'}
            </button>
          </div>
          <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>Last scanned: {formatDate(business.updated_at)}</p>
          <div className="space-y-3">
            {Boolean(research?.whatTheyDo) && <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>What they do</p><p className="text-sm" style={{ color: '#374151' }}>{String(research!.whatTheyDo)}</p></div>}
            {Boolean(research?.apparentTargetCustomer) && <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Apparent target customer</p><p className="text-sm" style={{ color: '#374151' }}>{String(research!.apparentTargetCustomer)}</p></div>}
            {Boolean(research?.differentiators) && <div><p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Differentiators</p><p className="text-sm" style={{ color: '#374151' }}>{String(research!.differentiators)}</p></div>}
            {gmbData && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: '#f3f4f6' }}>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>GMB Signals</p>
                <div className="grid grid-cols-2 gap-3">
                  {Boolean(gmbData.reviewCount) && <div><p className="text-xs" style={{ color: '#9ca3af' }}>Reviews</p><p className="text-sm font-medium" style={{ color: '#191654' }}>{String(gmbData.reviewCount)}</p></div>}
                  {Boolean(gmbData.averageRating) && <div><p className="text-xs" style={{ color: '#9ca3af' }}>Avg Rating</p><p className="text-sm font-medium" style={{ color: '#191654' }}>{String(gmbData.averageRating)}</p></div>}
                  {Boolean(gmbData.categories) && <div><p className="text-xs" style={{ color: '#9ca3af' }}>Categories</p><p className="text-sm" style={{ color: '#374151' }}>{String(gmbData.categories)}</p></div>}
                  {Boolean(gmbData.serviceArea) && <div><p className="text-xs" style={{ color: '#9ca3af' }}>Service Area</p><p className="text-sm" style={{ color: '#374151' }}>{String(gmbData.serviceArea)}</p></div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card 3 — Session History */}
      <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: '#9ca3af' }}>Session History</h2>
        <p className="text-sm mb-4" style={{ color: '#6b7280' }}>
          {completedSessions.length} completed SignalMap interview{completedSessions.length !== 1 ? 's' : ''}
        </p>
        {sessions.length === 0 ? (
          <p className="text-sm" style={{ color: '#9ca3af' }}>No sessions yet for this business.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: '#f3f4f6' }}>
                <div className="flex items-center gap-3">
                  {s.status === 'completed' ? <FileText size={16} style={{ color: '#43C6AC' }} /> : <Clock size={16} style={{ color: '#9ca3af' }} />}
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#191654' }}>
                      {s.status === 'completed' ? 'SignalMap Complete' : `Phase ${s.phase} of 4`}
                      {s.archived && <span className="text-xs ml-2" style={{ color: '#9ca3af' }}>(Archived)</span>}
                    </p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>{formatDate(s.created_at)}</p>
                  </div>
                </div>
                {s.status === 'completed' && !s.archived && (
                  <Link href="/dashboard/deliverables" className="text-xs font-medium" style={{ color: '#43C6AC' }}>View →</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="mt-8 p-6 rounded-2xl border-2" style={{ borderColor: '#fca5a5', backgroundColor: '#fff5f5' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: '#ef4444' }}>Danger Zone</h2>
        <p className="text-xs mb-4" style={{ color: '#6b7280' }}>Destructive actions that cannot be easily undone.</p>
        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: '#fca5a5', backgroundColor: '#ffffff' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#374151' }}>Delete this business</p>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Your business data is archived for 30 days, then permanently deleted. Your business slot remains used during this period.</p>
          </div>
          <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0 ml-4" style={{ backgroundColor: '#ef4444' }}>
            Delete Business
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
              Delete {business?.business_name}?
            </h3>
            <p className="text-sm mb-4" style={{ color: '#6b7280' }}>
              This will archive your business and all associated data for 30 days. After 30 days everything is permanently deleted and cannot be recovered. Your business slot remains used during the 30-day period.
            </p>
            <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: '#fff5f5', border: '1px solid #fca5a5' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#ef4444' }}>What will be deleted:</p>
              <ul className="text-xs space-y-1" style={{ color: '#6b7280' }}>
                <li>All SignalMap Interview transcripts</li>
                <li>Your ICP document and all deliverables</li>
                <li>Business research and signals data</li>
                <li>Voice of customer data</li>
                <li>Signal Score history</li>
              </ul>
            </div>
            <p className="text-sm mb-2" style={{ color: '#374151' }}>
              Type <strong>{business?.business_name}</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={business?.business_name}
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none mb-4"
              style={{ borderColor: '#e5e7eb' }}
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                Cancel
              </button>
              <button onClick={handleDeleteBusiness} disabled={deleteConfirmText !== business?.business_name || deleting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: '#ef4444' }}>
                {deleting ? 'Deleting...' : 'Delete Business'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
