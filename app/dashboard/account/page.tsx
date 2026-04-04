'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Customer, Purchase, Business } from '@/types'
import { User, Loader, Building2, Plus, Lock, ExternalLink } from 'lucide-react'

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
  hint?: string
}

function EditInput({ label, value, onChange, placeholder, hint }: EditField) {
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
      {hint && <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{hint}</p>}
    </div>
  )
}

function AccountSecuritySection() {
  const [emailInput, setEmailInput] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleChangeEmail() {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setEmailMessage({ type: 'error', text: 'Please enter a valid email address.' })
      return
    }
    setEmailSending(true)
    setEmailMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: emailInput.trim() })
    if (error) {
      setEmailMessage({ type: 'error', text: error.message })
    } else {
      setEmailMessage({
        type: 'success',
        text: 'Confirmation sent to your new email address. Click the link to confirm the change.',
      })
      setEmailInput('')
    }
    setEmailSending(false)
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setPasswordSaving(true)
    setPasswordMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordMessage({ type: 'error', text: error.message })
    } else {
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' })
      setNewPassword('')
      setConfirmPassword('')
    }
    setPasswordSaving(false)
  }

  async function handlePasswordResetEmail() {
    setEmailSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/dashboard/account`,
      })
      setPasswordMessage({
        type: 'success',
        text: `Password reset link sent to ${user.email}. Check your inbox.`,
      })
    }
    setEmailSending(false)
  }

  return (
    <div className="space-y-6 mt-8">
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: '#f3f4f6', backgroundColor: '#fafafa' }}>
          <p className="text-sm font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
            Change Email
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            A confirmation link will be sent to your new address.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: '#374151' }}>
              New Email Address
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={e => { setEmailInput(e.target.value); setEmailMessage(null) }}
              placeholder="new@email.com"
              className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
              style={{ borderColor: '#e5e7eb', color: '#374151', maxWidth: '400px', display: 'block' }}
            />
          </div>
          {emailMessage && (
            <p className="text-xs font-medium"
              style={{ color: emailMessage.type === 'success' ? '#43C6AC' : '#ef4444' }}>
              {emailMessage.text}
            </p>
          )}
          <button
            onClick={handleChangeEmail}
            disabled={emailSending || !emailInput.trim()}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-40"
            style={{ backgroundColor: '#191654' }}>
            {emailSending ? (
              <div className="w-3 h-3 rounded-full border-2 animate-spin"
                style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
            ) : null}
            {emailSending ? 'Sending\u2026' : 'Send confirmation'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: '#f3f4f6', backgroundColor: '#fafafa' }}>
          <p className="text-sm font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
            Change Password
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            Minimum 8 characters.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <div className="space-y-3" style={{ maxWidth: '400px' }}>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: '#374151' }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordMessage(null) }}
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
                style={{ borderColor: '#e5e7eb', color: '#374151' }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: '#374151' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordMessage(null) }}
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none"
                style={{ borderColor: '#e5e7eb', color: '#374151' }}
              />
            </div>
          </div>
          {passwordMessage && (
            <p className="text-xs font-medium"
              style={{ color: passwordMessage.type === 'success' ? '#43C6AC' : '#ef4444' }}>
              {passwordMessage.text}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleChangePassword}
              disabled={passwordSaving || !newPassword || !confirmPassword}
              className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-40"
              style={{ backgroundColor: '#191654' }}>
              {passwordSaving ? (
                <div className="w-3 h-3 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
              ) : null}
              {passwordSaving ? 'Updating\u2026' : 'Update password'}
            </button>
            <button
              onClick={handlePasswordResetEmail}
              className="text-xs font-semibold"
              style={{ color: '#9ca3af' }}>
              Send reset link to my email instead \u2192
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountPage() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [activeBizId, setActiveBizId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingAccount, setEditingAccount] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Account edit fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Fetch customer using auth_user_id
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!customerData) { setLoading(false); return }
      setCustomer(customerData)

      // Fetch purchases using customer.id
      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('*')
        .eq('customer_id', customerData.id)
        .order('created_at', { ascending: false })

      if (purchaseData) setPurchases(purchaseData)

      // Fetch businesses using the API route — not direct Supabase query
      // The API route uses the admin client which bypasses RLS correctly
      try {
        const bizRes = await fetch('/api/businesses/list')
        if (bizRes.ok) {
          const bizData = await bizRes.json()
          const bizList = bizData.data?.businesses || bizData.businesses || []
          setBusinesses(bizList)
        }
      } catch {
        // Non-fatal — businesses section shows empty
      }

      // Read active business from localStorage
      const activeBizId = localStorage.getItem('signalshot_active_business')
      if (activeBizId) setActiveBizId(activeBizId)

      setLoading(false)
    }
    load()
  }, [router])

  function openAccountEdit() {
    if (!customer) return
    setFirstName(customer.first_name || '')
    setLastName(customer.last_name || '')
    setEditingAccount(true)
    setSuccessMsg('')
  }

  async function handleSaveAccount() {
    if (!customer) return
    setSaving(true)

    const supabase = createClient()
    await supabase.from('customers').update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
    }).eq('id', customer.id)

    setCustomer({ ...customer, first_name: firstName.trim() || null, last_name: lastName.trim() || null })
    setEditingAccount(false)
    setSaving(false)
    setSuccessMsg('Account updated successfully')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function handleSwitchBusiness(biz: Business) {
    await fetch('/api/businesses/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: biz.id }),
    }).catch(() => null)

    localStorage.setItem('signalshot_active_business', biz.id)
    setActiveBizId(biz.id)
    window.location.reload()
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
    <div className="max-w-6xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
          <User size={26} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            Account
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Your account, businesses, and purchase history.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* My Account card — left column */}
        <div className="p-6 rounded-2xl border h-fit" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#374151' }}>
              My Account
            </h2>
            {!editingAccount && (
              <button
                onClick={openAccountEdit}
                className="text-sm font-medium"
                style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Edit
              </button>
            )}
          </div>

          {editingAccount ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <EditInput label="First Name" value={firstName} onChange={setFirstName} placeholder="Jane" />
                <EditInput label="Last Name" value={lastName} onChange={setLastName} placeholder="Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}>
                  Email
                </label>
                <p className="text-sm px-3 py-2.5 rounded-lg border" style={{ borderColor: '#e5e7eb', color: '#6b7280', backgroundColor: '#f9fafb' }}>
                  {customer?.email}
                </p>
                <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                  Changing your email will require you to verify the new address
                </p>
              </div>

              <button
                onClick={handleSaveAccount}
                disabled={saving}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm mt-2 disabled:opacity-60"
                style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => { setEditingAccount(false); setSuccessMsg('') }}
                disabled={saving}
                className="w-full text-center text-sm py-1"
                style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {successMsg && (
                <p className="text-sm mb-4" style={{ color: '#43C6AC' }}>{successMsg}</p>
              )}
              <div className="flex items-center gap-5">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: '#43C6AC' }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-lg font-semibold" style={{ color: '#191654' }}>
                    {customer?.first_name} {customer?.last_name}
                  </p>
                  <p className="text-sm" style={{ color: '#6b7280' }}>{customer?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs" style={{ color: '#9ca3af' }}>
                      Member since {customer?.created_at ? formatDate(customer.created_at) : '—'}
                    </p>
                    {customer?.beta_user && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(67,198,172,0.15)', color: '#43C6AC' }}
                      >
                        Beta Member
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* My Businesses card — right column */}
        <div className="p-6 rounded-2xl border h-fit" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2" style={{ color: '#374151' }}>
              <Building2 size={14} /> My Businesses
            </h2>
          </div>

          {businesses.length === 0 ? (
            <div className="text-center py-6">
              <Building2
                size={32}
                className="mx-auto mb-3"
                style={{ color: '#d1d5db' }}
              />
              <p className="text-sm mb-1" style={{ color: '#374151', fontWeight: 600 }}>
                No business registered yet
              </p>
              <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
                Complete the intake form to register your first business
              </p>
              <Link
                href="/dashboard"
                className="text-xs font-medium"
                style={{ color: '#43C6AC' }}
              >
                Go to Dashboard →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {businesses.map((biz) => {
                const isActive = activeBizId === biz.id
                return (
                  <div
                    key={biz.id}
                    className="p-4 rounded-xl border"
                    style={{
                      borderColor: isActive ? '#43C6AC' : '#e5e7eb',
                      backgroundColor: isActive ? 'rgba(67,198,172,0.04)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: '#191654' }}>
                          {biz.business_name}
                        </p>
                        {isActive && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'rgba(67,198,172,0.15)', color: '#43C6AC' }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      {!isActive && (
                        <button
                          onClick={() => handleSwitchBusiness(biz)}
                          className="text-xs font-medium px-3 py-1 rounded-full border"
                          style={{ color: '#43C6AC', borderColor: '#43C6AC' }}
                        >
                          Switch to this business
                        </button>
                      )}
                    </div>
                    {biz.website_url && (
                      <a
                        href={biz.website_url.startsWith('http') ? biz.website_url : `https://${biz.website_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs mb-1"
                        style={{ color: '#43C6AC' }}
                      >
                        {biz.website_url} <ExternalLink size={10} />
                      </a>
                    )}
                    <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                      Created {formatDate(biz.created_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4">
            {customer?.beta_user ? (
              <button
                onClick={() => router.push('/dashboard?new_business=true')}
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <Plus size={14} /> Add New Business
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#9ca3af' }}>
                <Lock size={14} /> Upgrade to add multiple businesses
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3 — Purchase History */}
      <div className="p-6 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: '#374151' }}>
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

      <AccountSecuritySection />
    </div>
  )
}
