'use client'

import { useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, MessageSquare } from 'lucide-react'

interface ModuleGateProps {
  productType: string
  salesPage: ReactNode
  children: ReactNode
}

type GateStatus = 'loading' | 'not-purchased' | 'needs-interview' | 'ready'

export default function ModuleGate({ productType, salesPage, children }: ModuleGateProps) {
  const [status, setStatus] = useState<GateStatus>('loading')
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (!customer) { router.push('/login'); return }

      const { data: purchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('product_type', productType)
        .maybeSingle()

      if (!purchase) {
        const { data: suite } = await supabase
          .from('purchases')
          .select('id')
          .eq('customer_id', customer.id)
          .in('product_type', ['complete_alex_pack', 'complete_intelligence_stack'])
          .maybeSingle()
        if (!suite) {
          setStatus('not-purchased')
          return
        }
      }

      const { data: session } = await supabase
        .from('sessions')
        .select('status')
        .eq('customer_id', customer.id)
        .eq('status', 'completed')
        .maybeSingle()

      if (!session) {
        setStatus('needs-interview')
        return
      }

      setStatus('ready')
    }
    check()
  }, [router, productType])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: '#43C6AC', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (status === 'not-purchased') return <>{salesPage}</>

  if (status === 'needs-interview') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: '#191654' }}>
          <MessageSquare size={28} style={{ color: '#43C6AC' }} />
        </div>
        <h2 className="text-2xl font-bold mb-3"
          style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
          Complete your SignalMap Interview first
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: '#6b7280' }}>
          This module is powered by your ICP data. Alex needs to finish learning
          about your business before we can generate anything useful.
        </p>
        <Link href="/dashboard/alex"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: '#191654' }}>
          Continue Your SignalMap Interview <ArrowRight size={16} />
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
