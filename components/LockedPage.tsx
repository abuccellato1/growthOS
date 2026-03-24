'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, CheckCircle, ArrowRight, Target, Share2, Mail, Map, Calendar } from 'lucide-react'

const ICON_MAP = {
  Target,
  Share2,
  Mail,
  Map,
  Calendar,
} as const

type IconName = keyof typeof ICON_MAP

interface LockedPageProps {
  name: string
  description: string
  productType: string
  iconName: IconName
}

export default function LockedPage({ name, description, productType, iconName }: LockedPageProps) {
  const [status, setStatus] = useState<'loading' | 'not-purchased' | 'alex-incomplete' | 'available'>('loading')
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
    <div className="max-w-2xl">
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
            Complete your Alex session to unlock this
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            {name} is built from the ICP data Alex collects. Finish your session to generate your content.
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
        <div
          className="p-8 rounded-2xl border-2 text-center"
          style={{ borderColor: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.05)' }}
        >
          <CheckCircle size={40} className="mx-auto mb-4" style={{ color: '#43C6AC' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            {name} is being prepared
          </h2>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Your content is generating. You&apos;ll be notified when it&apos;s ready to download.
          </p>
        </div>
      )}
    </div>
  )
}
