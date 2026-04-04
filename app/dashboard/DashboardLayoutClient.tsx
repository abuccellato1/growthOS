'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Customer, Purchase, Business } from '@/types'
import {
  LayoutDashboard,
  MessageSquare,
  Building2,
  Target,
  Share2,
  Mail,
  Map,
  Calendar,
  User,
  LogOut,
  Lock,
  Menu,
  ChevronDown,
  Plus,
  Mic,
  Wand2,
  Vault,
  FlaskConical,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  productType?: string
}

interface NavSection {
  label?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'SignalBoard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'BusinessSignals', href: '/dashboard/business-signals', icon: Building2 },
      { label: 'CustomerSignals', href: '/dashboard/voice-of-customer', icon: Mic },
      { label: 'Brand Voice', href: '/dashboard/brand-voice', icon: Wand2 },
      { label: 'SignalVault', href: '/dashboard/signal-vault', icon: Vault },
      { label: 'Account', href: '/dashboard/account', icon: User },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { label: 'SignalResearch', href: '/dashboard/signal-research', icon: FlaskConical },
    ],
  },
  {
    label: 'MODULES',
    items: [
      { label: 'SignalMap Interview', href: '/dashboard/alex', icon: MessageSquare },
      { label: 'SignalAds', href: '/dashboard/signal-ads', icon: Target, productType: 'ad_pack' },
      { label: 'SignalContent', href: '/dashboard/signal-content', icon: Share2, productType: 'social_pack' },
      { label: 'SignalSequences', href: '/dashboard/signal-sequences', icon: Mail, productType: 'email_pack' },
      { label: 'SignalLaunch', href: '/dashboard/signal-launch', icon: Map, productType: 'gtm_plan' },
      { label: 'SignalSprint', href: '/dashboard/signal-sprint', icon: Calendar, productType: 'action_plan' },
    ],
  },
]

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [alexComplete, setAlexComplete] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null)
  const [showBusinessMenu, setShowBusinessMenu] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function load() {
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

      if (purchaseData) setPurchases(purchaseData)

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('status')
        .eq('customer_id', customerData?.id)
        .eq('status', 'completed')
        .maybeSingle()

      setAlexComplete(!!sessionData)

      // Fetch businesses
      try {
        const res = await fetch('/api/businesses/list')
        if (res.ok) {
          const data = await res.json()
          const bizList = data.data?.businesses || data.businesses || []
          setBusinesses(bizList)

          // Determine active business
          const stored = localStorage.getItem('signalshot_active_business')
          if (stored && bizList.find((b: Business) => b.id === stored)) {
            setActiveBusiness(bizList.find((b: Business) => b.id === stored))
          } else if (bizList.length > 0) {
            setActiveBusiness(bizList[0])
            localStorage.setItem('signalshot_active_business', bizList[0].id)
          }
        }
      } catch {
        // Non-fatal
      }
    }
    load()
  }, [router])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSwitchBusiness(biz: Business) {
    await fetch('/api/businesses/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: biz.id }),
    }).catch(() => null)

    localStorage.setItem('signalshot_active_business', biz.id)
    setActiveBusiness(biz)
    setShowBusinessMenu(false)
    router.push('/dashboard')
    window.location.href = '/dashboard'
  }

  function handleAddBusiness() {
    setShowBusinessMenu(false)
    if (customer?.beta_user) {
      router.push('/dashboard?new_business=true')
    } else {
      alert('Adding multiple businesses requires a SignalShot upgrade. Contact us at support@goodfellastech.com')
    }
  }

  const purchasedTypes = purchases.map((p) => p.product_type)

  function getNavItemState(item: NavItem): 'active' | 'available' | 'purchased-locked' | 'not-purchased' {
    if (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) {
      return 'active'
    }
    if (!item.productType) return 'available'
    if (!(purchasedTypes as string[]).includes(item.productType)) return 'not-purchased'
    if (!alexComplete) return 'purchased-locked'
    return 'available'
  }

  const initials = customer
    ? `${customer.first_name?.[0] || ''}${customer.last_name?.[0] || ''}`.toUpperCase()
    : '?'

  function BusinessSelector() {
    if (businesses.length === 0 && !activeBusiness) return null

    const displayName = activeBusiness
      ? activeBusiness.business_name.length > 20
        ? activeBusiness.business_name.slice(0, 20) + '...'
        : activeBusiness.business_name
      : 'Select Business'

    return (
      <div className="relative mx-2 mb-2">
        <button
          onClick={() => setShowBusinessMenu(!showBusinessMenu)}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-[10px] text-left transition-all"
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <span
            className="text-[13px] font-medium text-white truncate"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {displayName}
          </span>
          {activeBusiness?.research_status === 'running' && (
            <span
              className="w-2 h-2 rounded-full animate-pulse ml-1 flex-shrink-0 inline-block"
              style={{ backgroundColor: '#43C6AC' }}
            />
          )}
          <ChevronDown
            size={14}
            style={{
              color: 'rgba(255,255,255,0.6)',
              transform: showBusinessMenu ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
              flexShrink: 0,
            }}
          />
        </button>

        {showBusinessMenu && (
          <div
            className="absolute left-0 right-0 mt-1 rounded-[10px] shadow-lg overflow-hidden z-50"
            style={{ backgroundColor: '#ffffff' }}
          >
            {businesses.map((biz) => {
              const isActive = activeBusiness?.id === biz.id
              return (
                <button
                  key={biz.id}
                  onClick={() => handleSwitchBusiness(biz)}
                  className="flex items-center justify-between w-full px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                  style={{
                    borderLeft: isActive ? '3px solid #43C6AC' : '3px solid transparent',
                  }}
                >
                  <span
                    className="text-[13px] truncate"
                    style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {biz.business_name}
                  </span>
                  {isActive && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(67,198,172,0.15)', color: '#43C6AC' }}
                    >
                      Active
                    </span>
                  )}
                </button>
              )
            })}
            <button
              onClick={handleAddBusiness}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-left transition-colors hover:bg-gray-50 border-t"
              style={{ borderColor: '#f3f4f6' }}
            >
              <Plus size={14} style={{ color: '#43C6AC' }} />
              <span
                className="text-[13px] font-medium"
                style={{ color: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
              >
                Add New Business
              </span>
            </button>
          </div>
        )}
      </div>
    )
  }

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full" style={{ backgroundColor: '#191654' }}>
        <div className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="relative w-36 h-8">
            <Image src="/images/signalshot-logo.png" alt="SignalShot" fill className="object-contain object-left" onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<span style="font-size:18px;font-weight:700;color:#43C6AC;letter-spacing:-0.5px">SignalShot</span>'; }} />
          </div>
        </div>

        {/* Business Selector */}
        <div className="pt-3">
          <BusinessSelector />
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {si > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', margin: '8px 0' }} />
              )}
              {section.label && (
                <p style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: '#43C6AC',
                  padding: '4px 12px 2px',
                  textTransform: 'uppercase',
                }}>
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const state = getNavItemState(item)
                const Icon = item.icon
                const isActive = state === 'active'
                const isLocked = state === 'not-purchased' || state === 'purchased-locked'

                return (
                  <Link
                    key={item.href}
                    href={isLocked ? '#' : item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all"
                    style={{
                      backgroundColor: isActive ? 'rgba(67,198,172,0.15)' : 'transparent',
                      borderLeft: isActive ? '3px solid #43C6AC' : '3px solid transparent',
                      opacity: state === 'not-purchased' ? 0.4 : 1,
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Icon
                      size={18}
                      style={{ color: isActive ? '#43C6AC' : 'rgba(255,255,255,0.75)', flexShrink: 0 }}
                    />
                    <span
                      className="text-sm font-medium flex-1"
                      style={{ color: isActive ? '#43C6AC' : 'rgba(255,255,255,0.75)', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {item.label}
                    </span>
                    {isLocked && (
                      <Lock size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <LogOut size={18} />
            <span className="text-sm font-medium" style={{ fontFamily: 'DM Sans, sans-serif' }}>Sign out</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f8f9fc' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0" style={{ backgroundColor: '#191654' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 z-10" style={{ backgroundColor: '#191654' }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
        >
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1 rounded"
              onClick={() => setMobileOpen(true)}
              style={{ color: '#191654' }}
            >
              <Menu size={22} />
            </button>
            <span className="text-lg font-bold" style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}>
              SignalShot
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:block" style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
              {customer?.first_name}
            </span>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: '#43C6AC' }}
            >
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
