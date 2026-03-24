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
  const [recovering, setRecovering] = useState(false)
  const [recoverError, setRecoverError] = useState<string | null>(null)
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

  async function handleRecover() {
    if (!session) return
    setRecovering(true)
    setRecoverError(null)
    try {
      const response = await fetch('/api/recover-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })
      if (response.ok) {
        window.location.reload()
      } else {
        const data = await response.json()
        setRecoverError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setRecoverError('Connection error. Please try again.')
    } finally {
      setRecovering(false)
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

      // Get active business
      const activeBizId = localStorage.getItem('signalshot_active_business')
      console.log('[deliverables] activeBizId from localStorage:', activeBizId)

      // Fetch session for active business (with fallback)
      let sessionData = null
      if (activeBizId) {
        // First: try to find session by business_id
        const { data: bizSession, error: bizError } = await supabase
          .from('sessions')
          .select('*')
          .eq('business_id', activeBizId)
          .not('archived', 'is', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        console.log('[deliverables] bizSession query result:', bizSession?.id, 'status:', bizSession?.status, 'icp_html length:', bizSession?.icp_html?.length, 'error:', bizError)

        // Fall back: if no business session found, try by customer_id
        // (handles sessions created before business architecture existed)
        sessionData = bizSession
        if (!sessionData) {
          const { data: customerSession, error: custError } = await supabase
            .from('sessions')
            .select('*')
            .eq('customer_id', customerData.id)
            .not('archived', 'is', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          console.log('[deliverables] customerSession fallback result:', customerSession?.id, 'status:', customerSession?.status, 'error:', custError)
          sessionData = customerSession
        }
      } else {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('customer_id', customerData.id)
          .not('archived', 'is', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        console.log('[deliverables] session query (no bizId) result:', data?.id, 'status:', data?.status, 'error:', error)
        sessionData = data
      }

      console.log('[deliverables] final sessionData:', sessionData ? { id: sessionData.id, status: sessionData.status, hasIcpHtml: !!(sessionData.icp_html?.length), archived: sessionData.archived, icp_generated_at: sessionData.icp_generated_at } : null)
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

  const hasIcp = !!(session?.icp_html && session.icp_html.length > 0)
  const sessionNotStarted = !session || session.status === 'not_started'
  console.log('[deliverables] render state:', { hasIcp, sessionNotStarted, sessionStatus: session?.status, sessionId: session?.id })
  const sessionEarlyInProgress =
    session?.status === 'in_progress' && (session.phase as number) < 3 && !hasIcp

  // Recovery condition: session complete or past phase 3 but ICP never generated
  const needsRecovery =
    !!session &&
    (session.phase as number) >= 3 &&
    (session.status === 'completed' || session.status === 'in_progress') &&
    !hasIcp &&
    !session.icp_generated_at &&
    !session.archived

  // Regenerate button: only if session completed/phase>=3, icp_generated_at IS NULL, not archived, and no ICP exists
  const showRegenerate =
    !!session &&
    !hasIcp &&
    !needsRecovery &&
    ((session.status === 'completed' || (session.phase as number) >= 3)) &&
    !session.icp_generated_at &&
    !session.archived

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
            Your SignalMap™ generated from your Alex session.
          </p>
        </div>
      </div>

      {/* Not started */}
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
            Complete your SignalMap™ session to generate your SignalMap™.
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

      {/* Early in-progress */}
      {sessionEarlyInProgress && (
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
            Finish your Alex session to unlock your SignalMap™.
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

      {/* Session complete but ICP not generated */}
      {needsRecovery && (
        <div
          className="p-8 rounded-2xl border-2 text-center"
          style={{ borderColor: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.04)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#191654' }}
          >
            <FileText size={28} style={{ color: '#43C6AC' }} />
          </div>
          <h2
            className="text-xl font-bold mb-2"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
          >
            Your session is complete.
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            All three phases are saved. Click below to generate your
            complete ICP document from your session data.
          </p>
          {recoverError && (
            <p className="text-sm mb-4" style={{ color: '#ef4444' }}>
              {recoverError}
            </p>
          )}
          <button
            onClick={handleRecover}
            disabled={recovering}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold"
            style={{
              backgroundColor: recovering ? '#9ca3af' : '#43C6AC',
              cursor: recovering ? 'not-allowed' : 'pointer',
            }}
          >
            {recovering ? (
              <>
                <Loader size={18} className="animate-spin" />
                Generating your SignalMap™... (this takes 30-60 seconds)
              </>
            ) : (
              <>
                <FileText size={18} />
                Generate My SignalMap™
              </>
            )}
          </button>
          <p className="text-xs mt-4" style={{ color: '#9ca3af' }}>
            Uses your complete 3-phase conversation to build your document.
          </p>
        </div>
      )}

      {/* Fallback regenerate */}
      {showRegenerate && (
        <div
          className="p-6 rounded-xl border text-center mb-6"
          style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}
        >
          <p className="text-sm mb-4" style={{ color: '#6b7280' }}>
            Your session is complete but your SignalMap™ document needs to be generated.
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
                Generating your SignalMap™...
              </>
            ) : (
              'Generate My SignalMap™'
            )}
          </button>
        </div>
      )}

      {/* ICP ready */}
      {hasIcp && session && (
        <>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
          >
            <ICPDisplay icpMarkdown={session.icp_html!} sessionId={session.id} />
          </div>

          {/* Rebuild link */}
          <div className="text-center mt-6">
            <Link
              href="/dashboard/alex"
              className="text-xs"
              style={{ color: '#9ca3af' }}
            >
              Want to rebuild your ICP? Go to your SignalMap™ Session →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
