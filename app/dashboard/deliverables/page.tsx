'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Deliverable, Session } from '@/types'
import { FileText, Download, Lock, Loader, CheckCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const DELIVERABLE_LABELS: Record<string, string> = {
  icp_blueprint: 'ICP Blueprint',
  complete_alex_pack: 'Complete Alex Pack',
  ad_pack: 'Ad Pack',
  social_pack: 'Social Pack',
  email_pack: 'Email Pack',
  gtm_plan: 'GTM Playbook',
  action_plan: '90-Day Action Plan',
}

export default function DeliverablesPage() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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

      if (!customerData) return

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('customer_id', customerData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionData) {
        setSession(sessionData)

        const { data: deliverableData } = await supabase
          .from('deliverables')
          .select('*')
          .eq('session_id', sessionData.id)
          .order('created_at', { ascending: true })

        if (deliverableData) setDeliverables(deliverableData)
      }

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

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
          <FileText size={26} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            My Deliverables
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            All documents Alex generated from your ICP session. Download any deliverable as a formatted PDF.
          </p>
        </div>
      </div>

      {!session || session.status === 'not_started' ? (
        <div className="p-8 rounded-2xl border-2 text-center" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
          <Lock size={40} className="mx-auto mb-4" style={{ color: '#d1d5db' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#374151' }}>
            Your deliverables will appear here
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            Complete your Alex session to generate your ICP document and unlock your content packs.
          </p>
          <Link
            href="/dashboard/alex"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: '#191654' }}
          >
            Start Your Session <ArrowRight size={16} />
          </Link>
        </div>
      ) : session.status === 'in_progress' ? (
        <div className="p-8 rounded-2xl border-2 text-center" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
          <Lock size={40} className="mx-auto mb-4" style={{ color: '#d1d5db' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#374151' }}>
            Session in progress
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            Finish your Alex session to unlock your deliverables.
          </p>
          <Link
            href="/dashboard/alex"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: '#191654' }}
          >
            Resume Session <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {deliverables.length === 0 ? (
            <div className="p-6 rounded-xl border text-center" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
              <Loader size={24} className="animate-spin mx-auto mb-2" style={{ color: '#9ca3af' }} />
              <p className="text-sm" style={{ color: '#6b7280' }}>Generating your deliverables...</p>
            </div>
          ) : (
            deliverables.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-5 rounded-xl border"
                style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
              >
                <div className="flex items-center gap-4">
                  {d.status === 'complete' ? (
                    <CheckCircle size={22} style={{ color: '#43C6AC' }} />
                  ) : (
                    <Loader size={22} className="animate-spin" style={{ color: '#9ca3af' }} />
                  )}
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#191654' }}>
                      {DELIVERABLE_LABELS[d.deliverable_type] || d.deliverable_type}
                    </p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>
                      {d.status === 'complete' ? 'Ready to download' : 'Generating...'}
                    </p>
                  </div>
                </div>

                {d.status === 'complete' && d.pdf_url && (
                  <a
                    href={d.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: '#f0fdf9', color: '#43C6AC' }}
                  >
                    <Download size={16} /> Download PDF
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
