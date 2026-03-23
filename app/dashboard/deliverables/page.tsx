'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Session } from '@/types'
import { FileText, Lock, Loader, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const ICPDisplay = dynamic(() => import('@/components/ICPDisplay'), {
  loading: () => (
    <div className="flex items-center justify-center h-48">
      <Loader size={28} className="animate-spin" style={{ color: '#43C6AC' }} />
    </div>
  ),
  ssr: false,
})

export default function DeliverablesPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const router = useRouter()

  async function handleRegenerateICP() {
    if (!session) return
    setRegenerating(true)
    try {
      const response = await fetch('/api/regenerate-icp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })
      if (response.ok) {
        window.location.reload()
      } else {
        console.error('Regeneration failed')
      }
    } catch (err) {
      console.error('Regeneration error:', err)
    } finally {
      setRegenerating(false)
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!customerData) { setLoading(false); return }

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('customer_id', customerData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionData) setSession(sessionData)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <Loader size={32} className="animate-spin" style={{ color: '#43C6AC' }} />
      </div>
    )
  }

  const hasIcp = !!(session?.icp_html)
  const sessionInProgress = session?.status === 'in_progress'
  const sessionNotStarted = !session || session.status === 'not_started'

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#191654' }}
        >
          <FileText size={26} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
          >
            My Deliverables
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
            Your ICP Blueprint generated from your Alex session.
          </p>
        </div>
      </div>

      {/* States */}
      {sessionNotStarted && (
        <div
          className="p-8 rounded-2xl border-2 text-center"
          style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}
        >
          <Lock size={40} className="mx-auto mb-4" style={{ color: '#d1d5db' }} />
          <h2
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: 'Playfair Display, serif', color: '#374151' }}
          >
            Your deliverables will appear here
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            Complete your Alex session to generate your ICP Blueprint.
          </p>
          <Link
            href="/dashboard/alex"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: '#191654' }}
          >
            Start Your Session <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {sessionInProgress && !hasIcp && (
        <div
          className="p-8 rounded-2xl border-2 text-center"
          style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}
        >
          <Lock size={40} className="mx-auto mb-4" style={{ color: '#d1d5db' }} />
          <h2
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: 'Playfair Display, serif', color: '#374151' }}
          >
            Session in progress
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            Finish your Alex session to unlock your ICP Blueprint.
          </p>
          <Link
            href="/dashboard/alex"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: '#191654' }}
          >
            Resume Session <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {session?.status === 'completed' && !hasIcp && (
        <div
          className="p-6 rounded-xl border text-center mb-6"
          style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}
        >
          <p className="text-sm mb-4" style={{ color: '#6b7280' }}>
            Your session is complete but your ICP document needs to be generated.
          </p>
          <button
            onClick={handleRegenerateICP}
            disabled={regenerating}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: regenerating ? '#9ca3af' : '#43C6AC' }}
          >
            {regenerating ? (
              <>
                <Loader size={16} className="animate-spin" />
                Generating your ICP...
              </>
            ) : (
              'Generate My ICP'
            )}
          </button>
        </div>
      )}

      {hasIcp && session && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
        >
          <ICPDisplay icpMarkdown={session.icp_html!} sessionId={session.id} />
        </div>
      )}
    </div>
  )
}
