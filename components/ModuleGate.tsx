'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, ArrowRight, Target, Share2, Mail, Map, Calendar } from 'lucide-react'
import { checkBusinessReady, PreflightResult } from '@/lib/module-preflight'
import PreflightBanner from '@/components/PreflightBanner'
import { Business } from '@/types'

const ICON_MAP = {
  Target,
  Share2,
  Mail,
  Map,
  Calendar,
} as const

type IconName = keyof typeof ICON_MAP

export type GateStatus = 'loading' | 'not-purchased' | 'alex-incomplete' | 'available'

interface ModuleGateProps {
  name: string
  description: string
  productType: string
  iconName: IconName
  children: (ctx: {
    businessId: string
    customerId: string
    preflight: PreflightResult | null
  }) => ReactNode
}

export default function ModuleGate({
  name,
  description,
  productType,
  iconName,
  children,
}: ModuleGateProps) {
  const [status, setStatus] = useState<GateStatus>('loading')
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [businessId, setBusinessId] = useState<string>('')
  const [customerId, setCustomerId] = useState<string>('')
  const router = useRouter()
  const Icon = ICON_MAP[iconName]

  useEffect(() => {
    const supabase = createClient()
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!customerData) return
      setCustomerId(customerData.id)

      // Check purchase
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('customer_id', customerData.id)
        .eq('product_type', productType)
        .maybeSingle()

      if (!purchase) {
        setStatus('not-purchased')
        return
      }

      // Check Alex completion
      const { data: session } = await supabase
        .from('sessions')
        .select('status')
        .eq('customer_id', customerData.id)
        .eq('status', 'completed')
        .maybeSingle()

      if (!session) {
        setStatus('alex-incomplete')
        return
      }

      // Fetch active business for preflight check
      const activeBizId = localStorage.getItem('signalshot_active_business')
      if (activeBizId) {
        setBusinessId(activeBizId)
        const { data: bizData } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', activeBizId)
          .single()
        if (bizData) {
          setPreflight(checkBusinessReady(bizData as Business))
        }
      }

      setStatus('available')
    }
    check()
  }, [router, productType])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: '#43C6AC', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: status === 'available' ? '#191654' : '#f3f4f6' }}
        >
          <Icon size={30} style={{ color: status === 'available' ? '#43C6AC' : '#9ca3af' }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            {name}
          </h1>
          <p className="text-base mt-1" style={{ color: '#6b7280' }}>{description}</p>
        </div>
      </div>

      {status === 'not-purchased' && (
        <div
          className="p-8 rounded-2xl border-2 text-center"
          style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}
        >
          <Lock size={40} className="mx-auto mb-4" style={{ color: '#d1d5db' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#374151' }}>
            Upgrade to unlock {name}
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            This module is available as an add-on or as part of a bundle.
          </p>
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: '#43C6AC' }}
          >
            Upgrade to unlock <ArrowRight size={16} />
          </a>
        </div>
      )}

      {status === 'alex-incomplete' && (
        <div
          className="p-8 rounded-2xl border-2 text-center"
          style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}
        >
          <Lock size={40} className="mx-auto mb-4" style={{ color: '#d1d5db' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#374151' }}>
            Complete your SignalMap interview to unlock this
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            {name} is built from the ICP data Alex collects. Finish your interview to generate your content.
          </p>
          <Link
            href="/dashboard/alex"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: '#191654' }}
          >
            Continue Your Session <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {status === 'available' && (
        <>
          {preflight && (
            <PreflightBanner preflight={preflight} moduleName={name} />
          )}
          {children({ businessId, customerId, preflight })}
        </>
      )}
    </div>
  )
}
