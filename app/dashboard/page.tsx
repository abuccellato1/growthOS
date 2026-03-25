'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Customer, Session, Purchase, Deliverable, Business } from '@/types'
import {
  MessageSquare,
  Target,
  Share2,
  Mail,
  Map,
  Calendar,
  Lock,
  Download,
  ArrowRight,
  FileText,
  Clock,
  CheckCircle,
  Loader,
} from 'lucide-react'
import SignalScoreWidget from '@/components/SignalScoreWidget'
import { formatDistanceToNow } from '@/lib/utils'
import IntakeGate from '@/components/IntakeGate'

const LOCKED_MODULES = [
  { label: 'SignalAds', icon: Target, productType: 'ad_pack', href: '/dashboard/ad-pack' },
  { label: 'SignalContent', icon: Share2, productType: 'social_pack', href: '/dashboard/social-pack' },
  { label: 'SignalSequences', icon: Mail, productType: 'email_pack', href: '/dashboard/email-pack' },
  { label: 'SignalLaunch', icon: Map, productType: 'gtm_plan', href: '/dashboard/gtm-plan' },
  { label: 'SignalSprint', icon: Calendar, productType: 'action_plan', href: '/dashboard/action-plan' },
]

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const isOnboarding = searchParams.get('onboarding') === 'true'
  const isNewBusiness = searchParams.get('new_business') === 'true'

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [showIntakeGate, setShowIntakeGate] = useState(isOnboarding)
  const [showToast, setShowToast] = useState(false)
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

      if (!customerData) { router.push('/login'); return }
      setCustomer(customerData)

      // Fetch businesses
      let bizList: Business[] = []
      try {
        const res = await fetch('/api/businesses/list')
        if (res.ok) {
          const data = await res.json()
          bizList = data.data?.businesses || data.businesses || []
        }
      } catch {
        // Non-fatal
      }

      // Auto-migration: create business from customer data if no businesses exist
      if (bizList.length === 0 && customerData.business_name?.trim()) {
        try {
          // Check if businesses exist (including inactive) before creating
          const checkRes = await fetch('/api/businesses/list?includeInactive=true')
          if (checkRes.ok) {
            const checkData = await checkRes.json()
            if ((checkData.data?.businesses || []).length > 0) {
              // Businesses exist but are inactive — reactivate the first one
              bizList = (checkData.data?.businesses || []).slice(0, 1)
              localStorage.setItem('signalshot_active_business', bizList[0].id)
            } else {
              // Truly no businesses — safe to migrate
              const migRes = await fetch('/api/businesses/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  businessName: customerData.business_name,
                  websiteUrl: customerData.website_url,
                  primaryService: customerData.primary_service,
                  geographicMarket: customerData.geographic_market,
                  migratingFromCustomer: true,
                }),
              })
              if (migRes.ok) {
                const migData = await migRes.json()
                if (migData.data?.business || migData.business) {
                  const biz = migData.data?.business || migData.business
                  bizList = [biz]
                  localStorage.setItem('signalshot_active_business', biz.id)
                }
              }
            }
          }
        } catch {
          // Non-fatal
        }
      }

      // Determine active business
      let currentBiz: Business | null = null
      const storedBizId = localStorage.getItem('signalshot_active_business')
      if (storedBizId && bizList.find((b) => b.id === storedBizId)) {
        currentBiz = bizList.find((b) => b.id === storedBizId) || null
      } else if (bizList.length > 0) {
        currentBiz = bizList[0]
        localStorage.setItem('signalshot_active_business', bizList[0].id)
      }
      setActiveBusiness(currentBiz)

      // Handle new_business param for beta users
      if (isNewBusiness && customerData.beta_user) {
        setShowIntakeGate(true)
        setLoading(false)
        return
      }

      // If no business exists, show intake gate
      if (!currentBiz) {
        setShowIntakeGate(true)
        setLoading(false)
        return
      }

      // Check if business intake is complete
      const bizIntakeComplete = !!(
        currentBiz.business_name?.trim() &&
        currentBiz.website_url?.trim() &&
        currentBiz.primary_service?.trim() &&
        currentBiz.geographic_market?.trim()
      )
      if (!bizIntakeComplete) {
        setShowIntakeGate(true)
      }

      // Fetch sessions for this business, fall back to customer_id
      // First: try by business_id
      const { data: bizSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('business_id', currentBiz.id)
        .not('archived', 'is', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Fall back: if no business session, try by customer_id
      // (handles sessions created before business architecture existed)
      let sessionData = bizSession
      if (!sessionData) {
        const { data: customerSession } = await supabase
          .from('sessions')
          .select('*')
          .eq('customer_id', customerData.id)
          .not('archived', 'is', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        sessionData = customerSession
      }

      if (sessionData) setSession(sessionData)

      // Purchases
      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('*')
        .eq('customer_id', customerData.id)

      if (purchaseData) setPurchases(purchaseData)

      // Deliverables from latest session
      if (sessionData) {
        const { data: deliverableData } = await supabase
          .from('deliverables')
          .select('*')
          .eq('session_id', sessionData.id)

        if (deliverableData) setDeliverables(deliverableData)
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  function handleIntakeComplete(updatedCustomer: Customer, business: Business) {
    setCustomer(updatedCustomer)
    setActiveBusiness(business)
    localStorage.setItem('signalshot_active_business', business.id)
    setShowIntakeGate(false)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
    // Reload to ensure dashboard has correct business context
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
        <Loader size={36} className="animate-spin" style={{ color: '#43C6AC' }} />
      </div>
    )
  }

  const purchasedTypes = purchases.map((p) => p.product_type)

  function determineState(): 'not_started' | 'in_progress' | 'generating' | 'complete' {
    if (!session || session.status === 'not_started') {
      return 'not_started'
    }
    if (session.status === 'in_progress') {
      return 'in_progress'
    }
    if (session.status === 'completed') {
      // If ICP exists — session is usable regardless of deliverable pack status
      if (session.icp_html && session.icp_html.length > 0) {
        // Check if all PURCHASED deliverable packs are complete
        const purchasedPacks = deliverables.filter(
          (d) => d.deliverable_type !== 'icp_blueprint'
        )
        if (
          purchasedPacks.length > 0 &&
          purchasedPacks.every((d) => d.status === 'complete')
        ) {
          return 'complete'
        }
        // ICP exists but packs pending or no packs purchased —
        // show as 'generating' which now has a full useful UI
        return 'generating'
      }
      // Session completed but no ICP yet — treat as generating
      return 'generating'
    }
    return 'not_started'
  }

  const state = determineState()

  function LockedModuleCards() {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
        {LOCKED_MODULES.map((mod) => {
          const Icon = mod.icon
          const isPurchased = (purchasedTypes as string[]).includes(mod.productType)
          return (
            <div
              key={mod.label}
              className="p-4 rounded-xl border text-center"
              style={{
                backgroundColor: '#f9fafb',
                borderColor: '#e5e7eb',
                opacity: isPurchased ? 0.7 : 0.4,
              }}
            >
              <Icon size={24} className="mx-auto mb-2" style={{ color: '#9ca3af' }} />
              <p className="text-xs font-medium" style={{ color: '#6b7280' }}>{mod.label}</p>
              <Lock size={12} className="mx-auto mt-1" style={{ color: '#d1d5db' }} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {/* Intake gate overlay */}
      {showIntakeGate && customer && (
        <IntakeGate
          customer={customer}
          existingBusiness={isNewBusiness ? null : activeBusiness}
          onComplete={handleIntakeComplete}
        />
      )}

      {/* Success toast */}
      {showToast && (
        <div
          className="fixed top-4 left-1/2 z-[9999] px-6 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
          style={{
            backgroundColor: '#43C6AC',
            transform: 'translateX(-50%)',
            fontFamily: 'DM Sans, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          Alex is ready for you. Start your interview when you are.
        </div>
      )}

      {/* Signal Score — always visible */}
      <SignalScoreWidget businessId={activeBusiness?.id || ''} />
      <div style={{ height: 20 }} />

      {/* State 1 — Not started */}
      {state === 'not_started' && (
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            Welcome to your SignalBoard, {customer?.first_name}.
          </h1>

          <p className="text-base mb-8" style={{ color: '#6b7280' }}>
            Your SignalMap interview is ready when you are. This takes 20–30 minutes — you can pause and resume any time.
          </p>

          <Link href="/dashboard/alex">
            <div
              className="p-6 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-lg mb-6"
              style={{ borderColor: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.05)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: '#191654' }}
                  >
                    <MessageSquare size={28} style={{ color: '#43C6AC' }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                      SignalMap Interview
                    </h2>
                    <p className="text-sm" style={{ color: '#6b7280' }}>
                      20–30 min · AI-powered discovery · Pause and resume anytime
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm"
                  style={{ backgroundColor: '#43C6AC' }}
                >
                  Start Your SignalMap Interview <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>

          <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#9ca3af' }}>
            Unlocks after your SignalMap interview is complete
          </h3>
          <LockedModuleCards />
        </div>
      )}

      {/* State 2 — In progress */}
      {state === 'in_progress' && (() => {
        const lastActive = session?.last_activity
          ? formatDistanceToNow(new Date(session.last_activity))
          : 'recently'
        return (
          <div>
            <h1 className="text-3xl font-bold mb-8" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
              Welcome back, {customer?.first_name}. Alex is waiting.
            </h1>

            <Link href="/dashboard/alex">
              <div
                className="p-6 rounded-2xl border cursor-pointer transition-all hover:shadow-lg mb-6"
                style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: '#191654' }}
                    >
                      <MessageSquare size={28} style={{ color: '#43C6AC' }} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
                        SignalMap Interview
                      </h2>
                      <div className="flex items-center gap-4 text-sm" style={{ color: '#6b7280' }}>
                        <span>Phase {session?.phase} of 4</span>
                        <span className="flex items-center gap-1">
                          <Clock size={13} /> Last active {lastActive} ago
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm"
                    style={{ backgroundColor: '#191654' }}
                  >
                    Resume Your SignalMap Interview <ArrowRight size={16} />
                  </div>
                </div>

                {/* Phase progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1" style={{ color: '#9ca3af' }}>
                    <span>Progress</span>
                    <span>Phase {session?.phase} / 4</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: '#e5e7eb' }}>
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ backgroundColor: '#43C6AC', width: `${((session?.phase ?? 1) / 4) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>

            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#9ca3af' }}>
              Unlocks after your SignalMap interview is complete
            </h3>
            <LockedModuleCards />
          </div>
        )
      })()}

      {/* State 3 — Generating */}
      {state === 'generating' && (
        <div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
          >
            Your SignalMap is complete, {customer?.first_name}.
          </h1>
          <p className="text-base mb-8" style={{ color: '#6b7280' }}>
            Your ICP document is ready in your deliverables.
          </p>

          {/* Primary CTA — go to deliverables */}
          <Link href="/dashboard/deliverables">
            <div
              className="p-6 rounded-2xl border-2 cursor-pointer
                         transition-all hover:shadow-lg mb-6"
              style={{
                borderColor: '#43C6AC',
                backgroundColor: 'rgba(67,198,172,0.05)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center
                               justify-center"
                    style={{ backgroundColor: '#191654' }}
                  >
                    <FileText size={28} style={{ color: '#43C6AC' }} />
                  </div>
                  <div>
                    <h2
                      className="text-xl font-bold"
                      style={{
                        fontFamily: 'Playfair Display, serif',
                        color: '#191654'
                      }}
                    >
                      View My SignalMap
                    </h2>
                    <p className="text-sm" style={{ color: '#6b7280' }}>
                      Your complete ICP document is ready to view and download
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 px-5 py-3 rounded-xl
                             text-white font-semibold text-sm"
                  style={{ backgroundColor: '#43C6AC' }}
                >
                  View Now <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>

          {/* Locked modules — still show what is available */}
          <h3
            className="text-sm font-semibold uppercase tracking-wide mb-3"
            style={{ color: '#9ca3af' }}
          >
            Expand your SignalShot
          </h3>
          <LockedModuleCards />
        </div>
      )}

      {/* State 4 — Complete */}
      {state === 'complete' && (
        <div>
          <h1 className="text-3xl font-bold mb-8" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            Your SignalBoard is ready, {customer?.first_name}.
          </h1>

          {/* VOC prompt card */}
          <div
            className="p-5 rounded-xl border mb-6 cursor-pointer hover:shadow-md transition-all"
            style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
            onClick={() => router.push('/dashboard/voice-of-customer')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(67,198,172,0.1)' }}
                >
                  <MessageSquare size={20} style={{ color: '#43C6AC' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#191654' }}>
                    Add Your Customer Voice
                  </p>
                  <p className="text-xs" style={{ color: '#6b7280' }}>
                    Paste reviews to make every module smarter
                  </p>
                </div>
              </div>
              <ArrowRight size={16} style={{ color: '#9ca3af' }} />
            </div>
          </div>

          {/* Unlocked deliverables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {deliverables.filter((d) => d.status === 'complete').map((d) => (
              <div key={d.id} className="p-5 rounded-xl border flex items-center justify-between" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} style={{ color: '#43C6AC' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#191654' }}>{d.deliverable_type}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Ready to download</p>
                  </div>
                </div>
                {d.pdf_url && (
                  <a
                    href={d.pdf_url}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: '#f0fdf9', color: '#43C6AC' }}
                  >
                    <Download size={14} /> PDF
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Upsell locked cards */}
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#9ca3af' }}>
            Expand your SignalShot
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LOCKED_MODULES.filter((m) => !(purchasedTypes as string[]).includes(m.productType)).map((mod) => {
              const Icon = mod.icon
              return (
                <div key={mod.label} className="p-5 rounded-xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
                  <Icon size={24} className="mb-3" style={{ color: '#9ca3af' }} />
                  <h3 className="text-sm font-semibold mb-1" style={{ color: '#374151' }}>{mod.label}</h3>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: '#43C6AC' }}
                  >
                    Upgrade to unlock →
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
