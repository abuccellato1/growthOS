'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Customer, Purchase } from '@/types'
import { User, Loader } from 'lucide-react'

const PRODUCT_LABELS: Record<string, string> = {
  icp_blueprint: 'ICP Blueprint',
  complete_alex_pack: 'Complete Alex Pack',
  complete_intelligence_stack: 'Complete Intelligence Stack',
  founders_circle: "Founder's Circle",
  ad_pack: 'Ad Pack',
  social_pack: 'Social Pack',
  email_pack: 'Email Pack',
  gtm_plan: 'GTM Playbook',
  action_plan: '90-Day Action Plan',
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
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Edit form state
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
      setLoading(false)
    }
    load()
  }, [router])

  function openEdit() {
    if (!customer) return
    setFirstName(customer.first_name || '')
    setLastName(customer.last_name || '')
    setBusinessName(customer.business_name || '')
    setWebsiteUrl(customer.website_url || '')
    setPrimaryService(customer.primary_service || '')
    setGeographicMarket(customer.geographic_market || '')
    setEditing(true)
    setSuccessMsg('')
  }

  function cancelEdit() {
    setEditing(false)
    setSuccessMsg('')
  }

  async function handleSave() {
    if (!customer) return
    setSaving(true)

    const supabase = createClient()
    const updates = {
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      business_name: businessName.trim() || null,
      website_url: websiteUrl.trim() || null,
      primary_service: primaryService.trim() || null,
      geographic_market: geographicMarket.trim() || null,
    }

    await supabase.from('customers').update(updates).eq('id', customer.id)

    const businessFieldsChanged =
      businessName.trim() !== (customer.business_name || '') ||
      websiteUrl.trim() !== (customer.website_url || '') ||
      primaryService.trim() !== (customer.primary_service || '') ||
      geographicMarket.trim() !== (customer.geographic_market || '')

    if (businessFieldsChanged && businessName.trim() && websiteUrl.trim() && primaryService.trim()) {
      fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          businessName: businessName.trim(),
          websiteUrl: websiteUrl.trim(),
          primaryService: primaryService.trim(),
          geographicMarket: geographicMarket.trim(),
        }),
      }).catch(() => null)
    }

    const updatedCustomer: Customer = { ...customer, ...updates }
    setCustomer(updatedCustomer)
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
            Your profile, purchase history, and billing.
          </p>
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
                {customer?.business_name && (
                  <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>{customer.business_name}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Website</p>
                <p className="text-sm" style={{ color: '#374151' }}>
                  {customer?.website_url ? (
                    <a href={customer.website_url} target="_blank" rel="noopener noreferrer" style={{ color: '#43C6AC' }}>
                      {customer.website_url}
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
                <p className="text-sm" style={{ color: '#374151' }}>{customer?.primary_service || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Geographic market</p>
                <p className="text-sm" style={{ color: '#374151' }}>{customer?.geographic_market || '—'}</p>
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
