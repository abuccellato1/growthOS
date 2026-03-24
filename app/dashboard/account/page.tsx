'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Customer, Purchase, Business } from '@/types'
import { User, Loader, Building2, Plus, Lock } from 'lucide-react'

const PRODUCT_LABELS: Record<string, string> = {
  icp_blueprint: 'SignalMap™',
  complete_alex_pack: 'SignalSuite™',
  complete_intelligence_stack: 'SignalSuite™',
  founders_circle: "Founder's Circle",
  ad_pack: 'SignalAds™',
  social_pack: 'SignalContent™',
  email_pack: 'SignalSequences™',
  gtm_plan: 'SignalLaunch™',
  action_plan: 'SignalSprint™',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatAmount(cents: number | null) {
  if (!cents) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

interface EditField {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}

function EditInput({ label, value, onChange, placeholder }: EditField) {
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
          borderColor: focused ? '#43C6AC' : '#e5e7eb',
          boxShadow: focused ? '0 0 0 3px rgba(67,198,172,0.12)' : 'none',
          fontFamily: 'DM Sans, sans-serif',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  )
}

export default function AccountPage() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null)
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Edit form state — now edits business fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [primaryService, setPrimaryService] = useState('')
  const [geographicMarket, setGeographicMarket] = useState('')

  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (customerData) setCustomer(customerData)

      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('*')
        .eq('customer_id', customerData?.id)
        .order('created_at', { ascending: false })

      if (purchaseData) setPurchases(purchaseData)

      // Fetch businesses
      try {
        const res = await fetch('/api/businesses/list')
        if (res.ok) {
          const data = await res.json()
          const bizList = data.businesses || []
          setBusinesses(bizList)

          const stored = localStorage.getItem('signalshot_active_business')
          const active = bizList.find((b: Business) => b.id === stored) || bizList[0] || null
          setActiveBusiness(active)

          // Get session counts for each business
          const counts: Record<string, number> = {}
          for (const biz of bizList) {
            const { count } = await supabase
              .from('sessions')
              .select('*', { count: 'exact', head: true })
              .eq('business_id', biz.id)
            counts[biz.id] = count ?? 0
          }
          setSessionCounts(counts)
        }
      } catch {
        // Non-fatal
      }

      setLoading(false)
    }
    load()
  }, [router])

  function openEdit() {
    if (!customer || !activeBusiness) return
    setFirstName(customer.first_name || '')
    setLastName(customer.last_name || '')
    setBusinessName(activeBusiness.business_name || '')
    setWebsiteUrl(activeBusiness.website_url || '')
    setPrimaryService(activeBusiness.primary_service || '')
    setGeographicMarket(activeBusiness.geographic_market || '')
    setEditing(true)
    setSuccessMsg('')
  }

  function cancelEdit() {
    setEditing(false)
    setSuccessMsg('')
  }

  async function handleSwitchBusiness(biz: Business) {
    await fetch('/api/businesses/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: biz.id }),
    }).catch(() => null)

    localStorage.setItem('signalshot_active_business', biz.id)
    setActiveBusiness(biz)
  }

  async function handleSave() {
    if (!customer || !activeBusiness) return
    setSaving(true)

    const supabase = createClient()

    // Update customer name fields
    await supabase.from('customers').update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
    }).eq('id', customer.id)

    // Update business fields
    await supabase.from('businesses').update({
      business_name: businessName.trim() || null,
      website_url: websiteUrl.trim() || null,
      primary_service: primaryService.trim() || null,
      geographic_market: geographicMarket.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', activeBusiness.id)

    const businessFieldsChanged =
      businessName.trim() !== (activeBusiness.business_name || '') ||
      websiteUrl.trim() !== (activeBusiness.website_url || '') ||
      primaryService.trim() !== (activeBusiness.primary_service || '') ||
      geographicMarket.trim() !== (activeBusiness.geographic_market || '')

    if (businessFieldsChanged && businessName.trim() && websiteUrl.trim() && primaryService.trim()) {
      fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBusiness.id,
          businessName: businessName.trim(),
          websiteUrl: websiteUrl.trim(),
          primaryService: primaryService.trim(),
          geographicMarket: geographicMarket.trim(),
        }),
      }).catch(() => null)
    }

    const updatedCustomer: Customer = { ...customer, first_name: firstName.trim() || null, last_name: lastName.trim() || null }
    setCustomer(updatedCustomer)

    const updatedBiz: Business = {
      ...activeBusiness,
      business_name: businessName.trim(),
      website_url: websiteUrl.trim() || null,
      primary_service: primaryService.trim() || null,
      geographic_market: geographicMarket.trim() || null,
    }
    setActiveBusiness(updatedBiz)
    setBusinesses((prev) => prev.map((b) => b.id === updatedBiz.id ? updatedBiz : b))

    setEditing(false)
    setSaving(false)
    setSuccessMsg('Profile updated successfully')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin" style={{ color: '#43C6AC' }} />
      </div>
    )
  }

  const initials = customer
    ? `${customer.first_name?.[0] || ''}${customer.last_name?.[0] || ''}`.toUpperCase()
    : '?'

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
          <User size={26} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            Account
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Your profile, businesses, and purchase history.
          </p>
        </div>
      </div>

      {/* My Businesses */}
      <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2" style={{ color: '#9ca3af' }}>
            <Building2 size={14} /> My Businesses
          </h2>
        </div>

        <div className="space-y-3">
          {businesses.map((biz) => {
            const isActive = activeBusiness?.id === biz.id
            return (
              <div
                key={biz.id}
                className="flex items-center justify-between p-3 rounded-xl border"
                style={{
                  borderColor: isActive ? '#43C6AC' : '#e5e7eb',
                  backgroundColor: isActive ? 'rgba(67,198,172,0.04)' : 'transparent',
                }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#191654' }}>
                    {biz.business_name}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>
                    Created {formatDate(biz.created_at)} · {sessionCounts[biz.id] || 0} session{(sessionCounts[biz.id] || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={{ backgroundColor: 'rgba(67,198,172,0.15)', color: '#43C6AC' }}
                    >
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSwitchBusiness(biz)}
                      className="text-xs font-medium px-3 py-1 rounded-full border"
                      style={{ color: '#43C6AC', borderColor: '#43C6AC' }}
                    >
                      Switch
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4">
          {customer?.beta_user ? (
            <button
              onClick={() => router.push('/dashboard?new_business=true')}
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={14} /> Add Business
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#9ca3af' }}>
              <Lock size={14} /> Upgrade to add multiple businesses
            </div>
          )}
        </div>
      </div>

      {/* Profile */}
      <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
            Profile
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
            <div className="grid grid-cols-2 gap-4">
              <EditInput label="First Name" value={firstName} onChange={setFirstName} placeholder="Jane" />
              <EditInput label="Last Name" value={lastName} onChange={setLastName} placeholder="Smith" />
            </div>
            <EditInput label="Business Name" value={businessName} onChange={setBusinessName} placeholder="e.g. Acme Marketing Co." />
            <EditInput label="Website URL" value={websiteUrl} onChange={setWebsiteUrl} placeholder="e.g. acmemarketing.com" />
            <EditInput label="Primary Service or Product" value={primaryService} onChange={setPrimaryService} placeholder="e.g. SEO & content marketing for B2B SaaS" />
            <EditInput label="Primary Geographic Market" value={geographicMarket} onChange={setGeographicMarket} placeholder="e.g. United States, North America, Global" />

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm mt-2 disabled:opacity-60"
              style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="w-full text-center text-sm py-1"
              style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            {successMsg && (
              <p className="text-sm text-center" style={{ color: '#43C6AC' }}>{successMsg}</p>
            )}
          </div>
        ) : (
          <>
            {successMsg && (
              <p className="text-sm mb-4" style={{ color: '#43C6AC' }}>{successMsg}</p>
            )}
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
                style={{ backgroundColor: '#43C6AC' }}
              >
                {initials}
              </div>
              <div>
                <p className="text-lg font-semibold" style={{ color: '#191654' }}>
                  {customer?.first_name} {customer?.last_name}
                </p>
                <p className="text-sm" style={{ color: '#6b7280' }}>{customer?.email}</p>
                {activeBusiness?.business_name && (
                  <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>{activeBusiness.business_name}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Website</p>
                <p className="text-sm" style={{ color: '#374151' }}>
                  {activeBusiness?.website_url ? (
                    <a href={activeBusiness.website_url} target="_blank" rel="noopener noreferrer" style={{ color: '#43C6AC' }}>
                      {activeBusiness.website_url}
                    </a>
                  ) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Member since</p>
                <p className="text-sm" style={{ color: '#374151' }}>
                  {customer?.created_at ? formatDate(customer.created_at) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Primary service</p>
                <p className="text-sm" style={{ color: '#374151' }}>{activeBusiness?.primary_service || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Geographic market</p>
                <p className="text-sm" style={{ color: '#374151' }}>{activeBusiness?.geographic_market || '—'}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Purchase history */}
      <div className="p-6 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: '#9ca3af' }}>
          Purchase History
        </h2>

        {purchases.length === 0 ? (
          <p className="text-sm" style={{ color: '#9ca3af' }}>No purchases yet.</p>
        ) : (
          <div className="space-y-3">
            {purchases.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-3 border-b last:border-0"
                style={{ borderColor: '#f3f4f6' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: '#191654' }}>
                    {PRODUCT_LABELS[p.product_type] || p.product_type}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>{formatDate(p.created_at)}</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: '#43C6AC' }}>
                  {formatAmount(p.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
