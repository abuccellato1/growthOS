'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Session } from '@/types'
import {
  Vault, Search, Target, Share2, Mail, Map, Calendar,
  Loader, ExternalLink, FileText, Lock, ArrowRight,
  Copy, Check, X, ChevronDown, ChevronUp
} from 'lucide-react'
import Link from 'next/link'

const ICPDisplay = dynamic(() => import('@/components/ICPDisplay'), {
  loading: () => (
    <div className="flex items-center justify-center h-48">
      <Loader size={28} className="animate-spin" style={{ color: '#43C6AC' }} />
    </div>
  ),
  ssr: false,
})

interface VaultOutput {
  id: string
  module_type: string
  output_data: Record<string, unknown>
  form_inputs: Record<string, unknown>
  generation_number: number
  vault_label: string | null
  vault_pinned_at: string
  created_at: string
}

interface ResearchSession {
  id: string
  title: string
  vault_saved: boolean
  vault_label: string | null
  status: string
  auto_generated: boolean
  created_at: string
  updated_at: string
}

const MODULE_CONFIG: Record<string, {
  label: string
  icon: React.ElementType
  color: string
  route: string
}> = {
  signal_ads: { label: 'SignalAds', icon: Target, color: '#ef4444', route: '/dashboard/signal-ads' },
  signal_content: { label: 'SignalContent', icon: Share2, color: '#8b5cf6', route: '/dashboard/signal-content' },
  signal_sequences: { label: 'SignalSequences', icon: Mail, color: '#43C6AC', route: '/dashboard/signal-sequences' },
  signal_launch: { label: 'SignalLaunch', icon: Map, color: '#f59e0b', route: '/dashboard/signal-launch' },
  signal_sprint: { label: 'SignalSprint', icon: Calendar, color: '#3b82f6', route: '/dashboard/signal-sprint' },
}

const MODULE_TABS = [...Object.keys(MODULE_CONFIG), 'research']

function VaultCard({
  output, businessId, onUnsave, onLabel,
}: {
  output: VaultOutput
  businessId: string
  onUnsave: (id: string) => void
  onLabel: (id: string, label: string) => void
}) {
  const router = useRouter()
  const config = MODULE_CONFIG[output.module_type]
  const Icon = config?.icon || Vault
  const [open, setOpen] = useState(false)
  const [labeling, setLabeling] = useState(false)
  const [labelText, setLabelText] = useState(output.vault_label || '')
  const [unsaving, setUnsaving] = useState(false)

  const ss = (
    output.output_data?.strategySignals ||
    output.output_data?.strategy_signals
  ) as Record<string, unknown> | undefined
  const primaryAngle = (ss?.primaryAngle || ss?.sequenceGoal || ss?.primary_angle || '') as string
  const savedDate = new Date(output.vault_pinned_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  async function handleUnsave() {
    setUnsaving(true)
    await fetch('/api/vault/unsave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId: output.id }),
    })
    onUnsave(output.id)
  }

  async function handleSaveLabel() {
    await fetch('/api/vault/label', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId: output.id, label: labelText }),
    })
    onLabel(output.id, labelText)
    setLabeling(false)
  }

  return (
    <div className="border rounded-2xl overflow-hidden bg-white" style={{ borderColor: '#e5e7eb' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${config?.color}15` }}>
            <Icon size={16} style={{ color: config?.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p
                className="text-sm font-bold"
                style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
                {output.vault_label || config?.label || output.module_type}
              </p>
              <span
                className="text-xs px-2 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                Gen {output.generation_number}
              </span>
            </div>
            {primaryAngle && (
              <p className="text-xs truncate" style={{ color: '#6b7280' }}>{primaryAngle}</p>
            )}
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Saved {savedDate}</p>
          </div>
        </div>
        <div
          className="text-xs px-2 py-1 rounded-lg flex-shrink-0 ml-2"
          style={{ color: '#9ca3af' }}>
          {open ? '\u2191' : '\u2193'}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: '#f3f4f6' }}>
          <div className="pt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => router.push(`${config?.route || '/dashboard'}?outputId=${output.id}`)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold border"
              style={{ borderColor: '#191654', color: '#191654' }}>
              <ExternalLink size={12} /> Refine in module
            </button>
            <button
              onClick={() => setLabeling(!labeling)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold border"
              style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
              {output.vault_label ? 'Edit label' : 'Add label'}
            </button>
            <button
              onClick={handleUnsave}
              disabled={unsaving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold border ml-auto disabled:opacity-40"
              style={{ borderColor: '#fecaca', color: '#dc2626' }}>
              {unsaving ? <Loader size={12} className="animate-spin" /> : null}
              Archive
            </button>
          </div>
          {labeling && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={labelText}
                onChange={e => setLabelText(e.target.value)}
                placeholder="e.g. Best performing set, Q2 campaign\u2026"
                className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none"
                style={{ borderColor: '#e5e7eb' }}
                autoFocus
              />
              <button
                onClick={handleSaveLabel}
                className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold"
                style={{ backgroundColor: '#191654' }}>
                Save
              </button>
              <button
                onClick={() => setLabeling(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ color: '#9ca3af' }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SignalVaultPage() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [vault, setVault] = useState<Record<string, VaultOutput[]>>({})
  const [researchSessions, setResearchSessions] = useState<ResearchSession[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('signal_ads')
  const [signalMapCollapsed, setSignalMapCollapsed] = useState(false)

  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const id = localStorage.getItem('signalshot_active_business')
    if (!id) { router.push('/dashboard'); return }
    setBusinessId(id)

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (customerData) {
        const { data: bizSession } = await supabase
          .from('sessions')
          .select('*')
          .eq('business_id', id)
          .not('archived', 'is', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

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
      }

      fetch(`/api/vault/list?businessId=${id}`)
        .then(r => r.json())
        .then(json => {
          setVault(json.data?.vault || {})
          const firstWithContent = MODULE_TABS.find(
            t => t !== 'research' && (json.data?.vault?.[t]?.length || 0) > 0
          )
          if (firstWithContent) setActiveTab(firstWithContent)
        })
        .catch(() => null)

      fetch(`/api/nora/sessions?businessId=${id}`)
        .then(r => r.json())
        .then(json => {
          const saved = (json.data?.sessions || []).filter(
            (s: ResearchSession) => s.vault_saved
          )
          setResearchSessions(saved)
        })
        .catch(() => null)
        .finally(() => setLoading(false))
    }
    load()
  }, [router])

  async function handleShare() {
    if (!session) return
    setSharing(true)
    try {
      const res = await fetch('/api/icp/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })
      const json = await res.json()
      if (res.ok && json.data?.shareUrl) setShareUrl(json.data.shareUrl)
    } catch { /* non-fatal */ }
    setSharing(false)
  }

  function handleUnsave(id: string) {
    setVault(prev => {
      const updated = { ...prev }
      for (const key of Object.keys(updated)) {
        updated[key] = updated[key].filter(o => o.id !== id)
      }
      return updated
    })
  }

  function handleLabel(id: string, label: string) {
    setVault(prev => {
      const updated = { ...prev }
      for (const key of Object.keys(updated)) {
        updated[key] = updated[key].map(o => o.id === id ? { ...o, vault_label: label } : o)
      }
      return updated
    })
  }

  const hasIcp = !!(session?.icp_html && session.icp_html.length > 0)
  const activeOutputs = vault[activeTab] || []

  return (
    <div className="w-full space-y-8">

      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: '#191654' }}>
          <Vault size={22} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            SignalVault
          </h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Your saved outputs from every module \u2014 organized, persistent, ready to use.
          </p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border"
        style={{ border: '1px solid rgba(67,198,172,0.25)', backgroundColor: 'rgba(67,198,172,0.03)' }}>
        <button
          onClick={() => setSignalMapCollapsed(!signalMapCollapsed)}
          className="w-full px-6 py-4 flex items-center justify-between border-b text-left hover:bg-opacity-80 transition-all"
          style={{ borderColor: 'rgba(67,198,172,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#43C6AC' }} />
            <p className="text-xs font-bold tracking-widest" style={{ color: '#43C6AC' }}>
              SIGNALMAP INTERVIEW
            </p>
            {signalMapCollapsed && hasIcp && (
              <span className="text-xs px-2 py-0.5 rounded-md font-medium ml-2"
                style={{ backgroundColor: 'rgba(67,198,172,0.15)', color: '#43C6AC' }}>
                Complete
              </span>
            )}
          </div>
          {signalMapCollapsed
            ? <ChevronDown size={15} style={{ color: '#43C6AC' }} />
            : <ChevronUp size={15} style={{ color: '#43C6AC' }} />}
        </button>
        {!signalMapCollapsed && <div className="p-6">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader size={16} className="animate-spin" style={{ color: '#43C6AC' }} />
              <p className="text-sm" style={{ color: '#9ca3af' }}>Loading\u2026</p>
            </div>
          ) : !session || session.status === 'not_started' ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Complete your SignalMap interview to unlock all modules.
              </p>
              <Link href="/dashboard/alex">
                <button
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl text-white"
                  style={{ backgroundColor: '#191654' }}>
                  Start Interview <ArrowRight size={13} />
                </button>
              </Link>
            </div>
          ) : !hasIcp ? (
            <div className="flex items-center gap-3">
              <Lock size={16} style={{ color: '#9ca3af' }} />
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Finish your Alex session to generate your SignalMap results.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm font-semibold" style={{ color: '#374151' }}>
                  Your complete SignalMap results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShare}
                    disabled={sharing}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
                    {sharing ? <Loader size={12} className="animate-spin" /> : <Share2 size={12} />}
                    Share
                  </button>
                  <Link href="/dashboard/alex">
                    <button
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
                      <FileText size={12} /> Rebuild
                    </button>
                  </Link>
                </div>
              </div>
              {shareUrl && (
                <div className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                  <p className="text-xs flex-1 truncate" style={{ color: '#374151' }}>{shareUrl}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000) }}
                    className="flex items-center gap-1 text-xs font-semibold flex-shrink-0"
                    style={{ color: '#43C6AC' }}>
                    {shareCopied ? <Check size={12} /> : <Copy size={12} />}
                    {shareCopied ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={() => setShareUrl(null)}>
                    <X size={14} style={{ color: '#9ca3af' }} />
                  </button>
                </div>
              )}
              <ICPDisplay icpMarkdown={session.icp_html!} sessionId={session.id} />
            </div>
          )}
        </div>}
      </div>

      <div>
        <div className="flex gap-1 mb-5 border-b overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
          {MODULE_TABS.map(tab => {
            const config = MODULE_CONFIG[tab]
            const TabIcon = tab === 'research' ? Search : (config?.icon || Vault)
            const count = tab === 'research'
              ? researchSessions.length
              : vault[tab]?.length || 0
            const isActive = activeTab === tab
            const tabColor = tab === 'research' ? '#6366f1' : (config?.color || '#43C6AC')
            const label = tab === 'research' ? 'SignalResearch' : (config?.label || tab)
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px flex-shrink-0"
                style={{
                  borderBottomColor: isActive ? '#191654' : 'transparent',
                  color: isActive ? '#191654' : '#9ca3af',
                }}>
                <TabIcon size={13} style={{ color: isActive ? tabColor : undefined }} />
                {label}
                {count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: isActive ? '#191654' : '#f3f4f6',
                      color: isActive ? '#fff' : '#9ca3af',
                    }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {activeTab === 'research' && (
          <div className="space-y-3">
            {researchSessions.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}>
                  <Search size={22} style={{ color: '#6366f1' }} />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#374151' }}>
                  No research saved yet
                </p>
                <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
                  Ask Nora to research a topic and save the findings here.
                </p>
                <button
                  onClick={() => router.push('/dashboard/signal-research')}
                  className="text-xs font-semibold px-4 py-2 rounded-lg"
                  style={{ backgroundColor: '#6366f1', color: '#fff' }}>
                  Ask Nora \u2192
                </button>
              </div>
            ) : (
              researchSessions.map(rs => (
                <div key={rs.id}
                  className="border rounded-2xl p-5 bg-white"
                  style={{ borderColor: '#e5e7eb' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}>
                        <Search size={15} style={{ color: '#6366f1' }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-sm font-bold"
                            style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
                            {rs.vault_label || rs.title || 'Research session'}
                          </p>
                          {rs.auto_generated && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                              Auto
                            </span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>
                          Saved {new Date(rs.updated_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/dashboard/signal-research?sessionId=${rs.id}`)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border flex-shrink-0"
                      style={{ borderColor: '#6366f1', color: '#6366f1' }}>
                      <ExternalLink size={12} /> Open
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab !== 'research' && (
          <>
            {loading ? (
              <div className="flex items-center gap-2 py-12 justify-center">
                <Loader size={18} className="animate-spin" style={{ color: '#43C6AC' }} />
                <p className="text-sm" style={{ color: '#9ca3af' }}>Loading vault\u2026</p>
              </div>
            ) : activeOutputs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'rgba(67,198,172,0.08)' }}>
                  <Vault size={22} style={{ color: '#43C6AC' }} />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#374151' }}>
                  Nothing saved here yet
                </p>
                <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
                  Click &quot;Save to SignalVault&quot; in any module, or give a generation a thumbs up.
                </p>
                <button
                  onClick={() => router.push(MODULE_CONFIG[activeTab]?.route || '/dashboard')}
                  className="text-xs font-semibold px-4 py-2 rounded-lg"
                  style={{ backgroundColor: '#191654', color: '#fff' }}>
                  Go to {MODULE_CONFIG[activeTab]?.label}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {businessId && activeOutputs.map(output => (
                  <VaultCard
                    key={output.id}
                    output={output}
                    businessId={businessId}
                    onUnsave={handleUnsave}
                    onLabel={handleLabel}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
