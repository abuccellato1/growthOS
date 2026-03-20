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

export default function AccountPage() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
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
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: '#9ca3af' }}>
          Profile
        </h2>
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
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Business type</p>
            <p className="text-sm" style={{ color: '#374151' }}>{customer?.business_type || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#9ca3af' }}>Primary service</p>
            <p className="text-sm" style={{ color: '#374151' }}>{customer?.primary_service || '—'}</p>
          </div>
        </div>
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
