'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Vault, Target, Share2, Mail, Map, Calendar, Tag, Trash2, ExternalLink, Loader, ChevronDown, ChevronUp } from 'lucide-react'

const MODULE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; route: string }> = {
  signal_ads: { label: 'SignalAds', icon: Target, color: '#ef4444', route: '/dashboard/signal-ads' },
  signal_content: { label: 'SignalContent', icon: Share2, color: '#8b5cf6', route: '/dashboard/signal-content' },
  signal_sequences: { label: 'SignalSequences', icon: Mail, color: '#43C6AC', route: '/dashboard/signal-sequences' },
  signal_launch: { label: 'SignalLaunch', icon: Map, color: '#f59e0b', route: '/dashboard/signal-launch' },
  signal_sprint: { label: 'SignalSprint', icon: Calendar, color: '#3b82f6', route: '/dashboard/signal-sprint' },
}

const MODULE_TABS = Object.keys(MODULE_CONFIG)

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

function VaultCard({ output, businessId, onUnsave, onLabel }: {
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

  const ss = (output.output_data?.strategySignals || output.output_data?.strategy_signals) as Record<string, unknown> | undefined
  const primaryAngle = ss?.primaryAngle || ss?.sequenceGoal || ss?.primary_angle || ''
  const keyDiff = ss?.keyDifferentiator || ss?.primaryAngle || ''

  const savedDate = new Date(output.vault_pinned_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
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

  function handleRefine() {
    if (config?.route) {
      router.push(`${config.route}?outputId=${output.id}`)
    }
  }

  return (
    <div className="border rounded-2xl overflow-hidden bg-white" style={{ borderColor: '#e5e7eb' }}>
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${config?.color}15` }}>
            <Icon size={16} style={{ color: config?.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
                {output.vault_label || config?.label || output.module_type}
              </p>
              <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                Gen {output.generation_number}
              </span>
            </div>
            {primaryAngle && (
              <p className="text-xs truncate" style={{ color: '#6b7280' }}>{primaryAngle as string}</p>
            )}
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Saved {savedDate}</p>
          </div>
        </div>
        <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
          {open ? <ChevronUp size={15} style={{ color: '#9ca3af' }} /> : <ChevronDown size={15} style={{ color: '#9ca3af' }} />}
        </button>
      </div>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: '#f3f4f6' }}>
          {keyDiff && (
            <div className="pt-4 p-4 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>PRIMARY ANGLE</p>
              <p className="text-sm" style={{ color: '#374151' }}>{keyDiff as string}</p>
            </div>
          )}

          {labeling ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={labelText}
                onChange={e => setLabelText(e.target.value)}
                placeholder="e.g. Best performing set, Q2 campaign..."
                className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none"
                style={{ borderColor: '#e5e7eb', color: '#374151' }}
                autoFocus
              />
              <button onClick={handleSaveLabel}
                className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold"
                style={{ backgroundColor: '#191654' }}>
                Save
              </button>
              <button onClick={() => setLabeling(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ color: '#9ca3af' }}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleRefine}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all"
                style={{ borderColor: '#191654', color: '#191654' }}>
                <ExternalLink size={12} /> Refine in module
              </button>
              <button onClick={() => setLabeling(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all"
                style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
                <Tag size={12} /> {output.vault_label ? 'Edit label' : 'Add label'}
              </button>
              <button onClick={handleUnsave}
                disabled={unsaving}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all disabled:opacity-40 ml-auto"
                style={{ borderColor: '#fecaca', color: '#dc2626' }}>
                {unsaving ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Archive
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
  const [vault, setVault] = useState<Record<string, VaultOutput[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('signal_ads')

  useEffect(() => {
    const id = localStorage.getItem('signalshot_active_business')
    if (!id) { router.push('/dashboard'); return }
    setBusinessId(id)
    fetch(`/api/vault/list?businessId=${id}`)
      .then(r => r.json())
      .then(json => {
        setVault(json.data?.vault || {})
        // Set active tab to first tab with content
        const firstWithContent = MODULE_TABS.find(t => (json.data?.vault?.[t]?.length || 0) > 0)
        if (firstWithContent) setActiveTab(firstWithContent)
      })
      .finally(() => setLoading(false))
  }, [router])

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

  const activeOutputs = vault[activeTab] || []

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
          <Vault size={22} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>SignalVault</h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>Your saved outputs from every module — organized, persistent, ready to use.</p>
        </div>
      </div>

      {/* Module tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: '#e5e7eb' }}>
        {MODULE_TABS.map(tab => {
          const config = MODULE_CONFIG[tab]
          const Icon = config.icon
          const count = vault[tab]?.length || 0
          const isActive = activeTab === tab
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px"
              style={{
                borderBottomColor: isActive ? '#191654' : 'transparent',
                color: isActive ? '#191654' : '#9ca3af',
              }}>
              <Icon size={13} />
              {config.label}
              {count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: isActive ? '#191654' : '#f3f4f6', color: isActive ? '#fff' : '#9ca3af' }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 py-12 justify-center">
          <Loader size={18} className="animate-spin" style={{ color: '#43C6AC' }} />
          <p className="text-sm" style={{ color: '#9ca3af' }}>Loading your vault…</p>
        </div>
      ) : activeOutputs.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(67,198,172,0.08)' }}>
            <Vault size={22} style={{ color: '#43C6AC' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#374151' }}>Nothing saved here yet</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            Click &quot;Save to SignalVault&quot; in any module, or give a generation a thumbs up — it&apos;ll appear here automatically.
          </p>
          <button
            onClick={() => router.push(MODULE_CONFIG[activeTab]?.route || '/dashboard')}
            className="mt-4 text-xs font-semibold px-4 py-2 rounded-lg"
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
    </div>
  )
}
