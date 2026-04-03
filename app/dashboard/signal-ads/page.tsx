'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModuleGate from '@/components/ModuleGate'
import AdPackSalesPage from '@/components/modules/AdPackSalesPage'
import CopyButton from '@/components/CopyButton'
import {
  Target, ChevronDown, ChevronUp, Plus, Trash2,
  RefreshCw, ThumbsUp, ThumbsDown, AlertCircle, Loader, CheckCircle, Bookmark, Sparkles
} from 'lucide-react'
import AgentChatPanel from '@/components/AgentChatPanel'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Competitor { name: string; website: string }

interface FormState {
  goal: string
  platforms: string[]
  budget: string
  tone: string
  previousAttempts: string
  competitors: Competitor[]
}

interface AdFeedbackItem {
  blockId: string
  contentText: string
  rating: number
  reasons: string[]
}

interface AdOutput {
  strategySignals?: {
    primaryAngle: string
    keyDifferentiator: string
    whyItWins: string
    dataSourcesUsed: string[]
    competitorInsights: string
    funnelApproach: string
    messagingHierarchy: string
    budgetAllocation: string
    platformRationale: string
    negativeKeywords: string[]
    testingRecommendations: string[]
  }
  googleSearchAds?: {
    headlines: Array<{ text: string; charCount: number; angle: string }>
    descriptions: Array<{ text: string; charCount: number }>
    adVariations: Array<{ name: string; headlines: string[]; descriptions: string[]; notes: string }>
  }
  metaAds?: {
    primaryTexts: Array<{ text: string; charCount: number; hook: string }>
    headlines: Array<{ text: string; charCount: number }>
    adSets: Array<{ name: string; primaryText: string; headline: string; description: string; cta: string; targetingNotes: string }>
    audienceTargeting: { coreAudiences: string[]; interests: string[]; behaviors: string[]; customAudiences: string[]; lookalikes: string }
    messagingNotes: string
  }
  linkedInAds?: {
    sponsoredContent: Array<{ introText: string; headline: string; description: string; cta: string }>
    targeting: { jobTitles: string[]; industries: string[]; companySizes: string[]; skills: string[] }
    messagingNotes: string
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ['Google Search', 'Meta (Facebook/Instagram)', 'LinkedIn']
const GOALS = ['Lead generation', 'Brand awareness', 'Event promotion', 'Product launch', 'Retargeting']
const BUDGETS = ['Under $500/mo', '$500–$1,500/mo', '$1,500–$5,000/mo', '$5,000–$15,000/mo', '$15,000+/mo']
const TONES = ['Professional', 'Conversational', 'Urgent', 'Empathetic', 'Bold/Direct']

const CHAR_LIMIT_GOOGLE_HEADLINE = 30
const CHAR_LIMIT_GOOGLE_DESC = 90
const CHAR_LIMIT_META_TEXT = 125
const CHAR_LIMIT_META_HEADLINE = 40
const CHAR_LIMIT_LI_INTRO = 150
const CHAR_LIMIT_LI_HEADLINE = 70

const REJECTION_REASONS = [
  'Too generic',
  'Wrong tone',
  "Doesn't sound like us",
  'Too long',
  'Angle already tried',
  "Doesn't address objection",
  'Wrong audience',
  'Too salesy',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function charColor(count: number, limit: number) {
  const pct = count / limit
  if (pct > 1) return '#ef4444'
  if (pct >= 0.9) return '#f59e0b'
  return '#10b981'
}

function CharBadge({ text, limit }: { text: string; limit: number }) {
  const count = text.length
  const over = count > limit
  return (
    <span className="flex items-center gap-0.5 text-xs font-mono font-bold flex-shrink-0"
      style={{ color: charColor(count, limit) }}>
      {over && <span title="Exceeds platform limit">⚠</span>}
      {count}/{limit}
    </span>
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        style={{ backgroundColor: '#f9fafb' }}>
        <span className="text-sm font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>{title}</span>
        {open ? <ChevronUp size={16} style={{ color: '#9ca3af' }} /> : <ChevronDown size={16} style={{ color: '#9ca3af' }} />}
      </button>
      {open && <div className="p-6">{children}</div>}
    </div>
  )
}

// ─── Per-ad feedback widget ───────────────────────────────────────────────────

function AdFeedbackWidget({
  blockId,
  contentText,
  adFeedback,
  onRate,
}: {
  blockId: string
  contentText: string
  adFeedback: Record<string, AdFeedbackItem>
  onRate: (item: AdFeedbackItem) => void
}) {
  const existing = adFeedback[blockId]
  const [showReasons, setShowReasons] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>(existing?.reasons || [])

  function handleThumbsUp() {
    onRate({ blockId, contentText, rating: 1, reasons: [] })
    setShowReasons(false)
  }

  function handleThumbsDown() {
    setShowReasons(true)
  }

  function toggleReason(r: string) {
    setSelectedReasons(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    )
  }

  function confirmReasons() {
    onRate({ blockId, contentText, rating: -1, reasons: selectedReasons })
    setShowReasons(false)
  }

  if (existing && !showReasons) {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {existing.rating === 1 ? (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
            <ThumbsUp size={11} /> Marked good
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            <ThumbsDown size={11} /> Flagged
          </span>
        )}
      </div>
    )
  }

  if (showReasons) {
    return (
      <div className="mt-2 w-full">
        <div className="p-3 rounded-xl border" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
          <p className="text-xs font-bold mb-2" style={{ color: '#dc2626' }}>Why didn&apos;t this work?</p>
          <div className="flex flex-wrap gap-1.5 mb-3" style={{ maxHeight: '120px', overflowY: 'auto' }}>
            {REJECTION_REASONS.map(r => (
              <button key={r} onClick={() => toggleReason(r)}
                className="text-xs px-2 py-1 rounded-md border font-medium transition-all"
                style={{
                  borderColor: selectedReasons.includes(r) ? '#dc2626' : '#fecaca',
                  backgroundColor: selectedReasons.includes(r) ? '#dc2626' : '#fff',
                  color: selectedReasons.includes(r) ? '#fff' : '#dc2626',
                }}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={confirmReasons}
              className="text-xs px-3 py-1 rounded-lg text-white font-semibold"
              style={{ backgroundColor: '#dc2626' }}>
              Flag this ad
            </button>
            <button onClick={() => setShowReasons(false)}
              className="text-xs px-3 py-1 rounded-lg font-semibold"
              style={{ color: '#9ca3af' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button onClick={handleThumbsUp} title="This works"
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <ThumbsUp size={13} style={{ color: '#9ca3af' }} />
      </button>
      <button onClick={handleThumbsDown} title="Flag this ad"
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <ThumbsDown size={13} style={{ color: '#9ca3af' }} />
      </button>
    </div>
  )
}

// ─── Generating screen ────────────────────────────────────────────────────────

function GeneratingScreen({ steps, generationNumber }: {
  steps: Array<{ label: string; duration: number }>
  generationNumber: number
}) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  useEffect(() => {
    let stepIndex = 0
    let timeout: ReturnType<typeof setTimeout>

    function advance() {
      setCompletedSteps(prev => [...prev, stepIndex])
      stepIndex++
      if (stepIndex < steps.length) {
        setCurrentStep(stepIndex)
        timeout = setTimeout(advance, steps[stepIndex].duration)
      }
    }

    timeout = setTimeout(advance, steps[0].duration)
    return () => clearTimeout(timeout)
  }, [steps])

  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#191654' }}>
          <Target size={18} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: '#191654' }}>
            {generationNumber === 1 ? 'Building your ad library…' : `Regenerating (${generationNumber}/3)…`}
          </p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Takes about 30–45 seconds</p>
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const isDone = completedSteps.includes(i)
          const isActive = currentStep === i
          const isPending = !isDone && !isActive
          return (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{
                backgroundColor: isActive ? 'rgba(67,198,172,0.06)' : 'transparent',
                border: isActive ? '1px solid rgba(67,198,172,0.2)' : '1px solid transparent',
                opacity: isPending ? 0.35 : 1,
              }}>
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {isDone ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="8" fill="#43C6AC" fillOpacity="0.15" />
                    <path d="M4.5 8L7 10.5L11.5 6" stroke="#43C6AC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isActive ? (
                  <div className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: '#43C6AC', borderTopColor: 'transparent' }} />
                ) : (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#e5e7eb' }} />
                )}
              </div>
              <p className="text-sm" style={{
                color: isDone ? '#6b7280' : isActive ? '#191654' : '#9ca3af',
                fontWeight: isActive ? 600 : 400,
              }}>
                {step.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main module ──────────────────────────────────────────────────────────────

function AdPackModule() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [outputId, setOutputId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    goal: '', platforms: [], budget: '', tone: '', previousAttempts: '',
    competitors: [{ name: '', website: '' }],
  })

  const [stage, setStage] = useState<'form' | 'generating' | 'results'>('form')
  const [ads, setAds] = useState<AdOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generationNumber, setGenerationNumber] = useState(1)
  const [adFeedback, setAdFeedback] = useState<Record<string, AdFeedbackItem>>({})
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [overallFeedbackMode, setOverallFeedbackMode] = useState<'idle' | 'thumbsdown'>('idle')
  const [overallFeedbackText, setOverallFeedbackText] = useState('')
  const [overallFeedbackDone, setOverallFeedbackDone] = useState(false)
  const [overallSubmitting, setOverallSubmitting] = useState(false)
  const [vaultSaved, setVaultSaved] = useState(false)
  const [vaultSaving, setVaultSaving] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('signalshot_active_business')
    if (!id) { router.push('/dashboard'); return }
    setBusinessId(id)

    const supabase = createClient()
    supabase
      .from('module_outputs')
      .select('id, output_data, form_inputs, generation_number')
      .eq('business_id', id)
      .eq('module_type', 'signal_ads')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data: lastOutput }) => {
        if (lastOutput?.output_data) {
          setAds(lastOutput.output_data as AdOutput)
          setOutputId(lastOutput.id)
          setGenerationNumber(lastOutput.generation_number || 1)
          setStage('results')
        }
      })
  }, [router])

  function togglePlatform(p: string) {
    setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }))
  }
  function addCompetitor() {
    if (form.competitors.length >= 5) return
    setForm(f => ({ ...f, competitors: [...f.competitors, { name: '', website: '' }] }))
  }
  function removeCompetitor(i: number) {
    setForm(f => ({ ...f, competitors: f.competitors.filter((_, idx) => idx !== i) }))
  }
  function updateCompetitor(i: number, field: keyof Competitor, value: string) {
    setForm(f => ({ ...f, competitors: f.competitors.map((c, idx) => idx === i ? { ...c, [field]: value } : c) }))
  }
  function isFormValid() { return form.goal && form.platforms.length > 0 && form.budget && form.tone }

  function handleAdRate(item: AdFeedbackItem) {
    setAdFeedback(prev => ({ ...prev, [item.blockId]: item }))
    if (!businessId || !outputId) return
    fetch('/api/signal-ads/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId, adFeedbackItems: [item] }),
    }).catch(() => null)
  }

  async function generate(regenFeedback?: string) {
    if (!businessId) return
    setError(null); setStage('generating'); setAdFeedback({})
    try {
      const res = await fetch('/api/signal-ads/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, ...form, regenerationFeedback: regenFeedback || undefined, generationNumber }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Generation failed'); setStage('form'); return }
      setAds(json.data.ads)
      setOutputId(json.data.outputId)
      setStage('results')
      setOverallFeedbackMode('idle'); setOverallFeedbackText(''); setOverallFeedbackDone(false)
    } catch { setError('Network error — please try again'); setStage('form') }
  }

  function handleAgentPatch(target: string, value: string) {
    setAds(prev => {
      if (!prev) return prev
      const updated = { ...prev } as Record<string, unknown>
      const parts = target.split('_')
      if (parts.length >= 3) {
        const [section, subsection, indexStr, field] = parts
        const sectionData = updated[section] as Record<string, unknown>
        if (sectionData && Array.isArray(sectionData[subsection])) {
          const arr = [...(sectionData[subsection] as Record<string, unknown>[])]
          const idx = parseInt(indexStr)
          if (!isNaN(idx) && arr[idx]) {
            arr[idx] = { ...arr[idx], [field || 'text']: value }
            updated[section] = { ...sectionData, [subsection]: arr }
          }
        }
      }
      if (parts[0] === 'strategySignals' && updated.strategySignals) {
        const ss = { ...(updated.strategySignals as Record<string, unknown>) }
        ss[parts[1]] = value
        updated.strategySignals = ss
      }
      return updated as typeof prev
    })
  }

  async function handleVaultSave() {
    if (!businessId || !outputId || vaultSaved) return
    setVaultSaving(true)
    await fetch('/api/vault/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId }),
    })
    setVaultSaving(false)
    setVaultSaved(true)
  }

  async function submitOverallFeedback(rating: number) {
    if (!businessId || !outputId) return
    setOverallSubmitting(true)
    await fetch('/api/signal-ads/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId, rating, feedbackText: overallFeedbackText || undefined }),
    })
    setOverallSubmitting(false); setOverallFeedbackDone(true)
    if (rating >= 4 && outputId && businessId) {
      fetch('/api/vault/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, outputId }),
      }).catch(() => null)
    }
  }

  async function handleRegenerate() {
    if (generationNumber >= 3) return
    setFeedbackSaving(true)
    const flagged = Object.values(adFeedback).filter(f => f.rating === -1)
    const flaggedSummary = flagged.length > 0
      ? `USER FLAGGED ${flagged.length} ADS AS NOT WORKING:\n` + flagged.map(f => `- "${f.contentText.slice(0, 80)}" — reasons: ${f.reasons.join(', ') || 'no reason given'}`).join('\n')
      : ''
    const combinedFeedback = [overallFeedbackText, flaggedSummary].filter(Boolean).join('\n\n')
    setFeedbackSaving(false)
    setGenerationNumber(n => n + 1)
    await generate(combinedFeedback || undefined)
  }

  // ── FORM ───────────────────────────────────────────────────────────────────
  if (stage === 'form') {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
            <Target size={22} style={{ color: '#43C6AC' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>SignalAds</h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>Tell us your campaign parameters — Alex handles the rest.</p>
          </div>
        </div>
        {error && (
          <div className="flex items-start gap-2 p-4 rounded-xl mb-6" style={{ backgroundColor: '#fff5f5', border: '1px solid #fca5a5' }}>
            <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
            <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        )}
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Campaign Goal *</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(g => (
                <button key={g} onClick={() => setForm(f => ({ ...f, goal: g }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ borderColor: form.goal === g ? '#43C6AC' : '#e5e7eb', backgroundColor: form.goal === g ? 'rgba(67,198,172,0.1)' : '#fff', color: form.goal === g ? '#191654' : '#6b7280' }}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Platforms * <span className="font-normal text-gray-400">(select all that apply)</span></label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => togglePlatform(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ borderColor: form.platforms.includes(p) ? '#43C6AC' : '#e5e7eb', backgroundColor: form.platforms.includes(p) ? 'rgba(67,198,172,0.1)' : '#fff', color: form.platforms.includes(p) ? '#191654' : '#6b7280' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Monthly Ad Budget *</label>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map(b => (
                <button key={b} onClick={() => setForm(f => ({ ...f, budget: b }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ borderColor: form.budget === b ? '#43C6AC' : '#e5e7eb', backgroundColor: form.budget === b ? 'rgba(67,198,172,0.1)' : '#fff', color: form.budget === b ? '#191654' : '#6b7280' }}>
                  {b}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Brand Tone *</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, tone: t }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ borderColor: form.tone === t ? '#43C6AC' : '#e5e7eb', backgroundColor: form.tone === t ? 'rgba(67,198,172,0.1)' : '#fff', color: form.tone === t ? '#191654' : '#6b7280' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: '#374151' }}>Competitors <span className="font-normal text-gray-400">(optional — enables ad library research)</span></label>
            <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>Add competitors and we&apos;ll scan Google Ads Transparency Center and Meta Ad Library for their active ads.</p>
            <div className="space-y-2">
              {form.competitors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="text" placeholder="Company name" value={c.name} onChange={e => updateCompetitor(i, 'name', e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#e5e7eb', color: '#374151' }} />
                  <input type="text" placeholder="website.com" value={c.website} onChange={e => updateCompetitor(i, 'website', e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#e5e7eb', color: '#374151' }} />
                  {form.competitors.length > 1 && (
                    <button onClick={() => removeCompetitor(i)} className="p-1.5 rounded-lg hover:bg-gray-100">
                      <Trash2 size={13} style={{ color: '#9ca3af' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.competitors.length < 5 && (
              <button onClick={addCompetitor} className="flex items-center gap-1.5 mt-2 text-xs font-semibold" style={{ color: '#43C6AC' }}>
                <Plus size={13} /> Add competitor
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: '#374151' }}>What hasn&apos;t worked in past ads? <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea rows={3} placeholder="e.g. 'Price-focused messaging didn't convert. Discount language attracts the wrong leads.'"
              value={form.previousAttempts} onChange={e => setForm(f => ({ ...f, previousAttempts: e.target.value }))}
              className="w-full text-xs px-3 py-2 rounded-lg border outline-none resize-none" style={{ borderColor: '#e5e7eb', color: '#374151' }} />
          </div>
          <button onClick={() => generate()} disabled={!isFormValid()}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-opacity"
            style={{ backgroundColor: isFormValid() ? '#191654' : '#d1d5db', cursor: isFormValid() ? 'pointer' : 'not-allowed' }}>
            Generate My Ad Library
          </button>
        </div>
      </div>
    )
  }

  // ── GENERATING ────────────────────────────────────────────────────────────
  if (stage === 'generating') {
    const competitorNames = form.competitors.filter(c => c.name).map(c => c.name).join(', ')
    const hasCompetitors = form.competitors.some(c => c.name || c.website)
    const steps = hasCompetitors
      ? [
          { label: 'Reading your SignalMap Interview Data', duration: 3000 },
          { label: 'Checking CustomerSignals Data', duration: 3000 },
          { label: 'Loading BusinessSignals Research', duration: 3000 },
          { label: `Scanning Google Ads Transparency Center for ${competitorNames}`, duration: 5000 },
          { label: `Scanning Meta Ad Library for ${competitorNames}`, duration: 5000 },
          { label: 'Identifying Competitor Gaps and Differentiation Angles', duration: 4000 },
          { label: 'Writing your SignalAds Libraries', duration: 6000 },
        ]
      : [
          { label: 'Reading your SignalMap Interview Data', duration: 3000 },
          { label: 'Checking CustomerSignals Data', duration: 3000 },
          { label: 'Loading BusinessSignals Research', duration: 3000 },
          { label: 'Analyzing SignalMap Messaging Angles', duration: 3000 },
          { label: 'Writing your SignalAds Libraries', duration: 6000 },
        ]
    return <GeneratingScreen steps={steps} generationNumber={generationNumber} />
  }

  // ── RESULTS (continued in next part) ──────────────────────────────────────
  if (!ads) return null
  const ss = ads.strategySignals
  const flaggedCount = Object.values(adFeedback).filter(f => f.rating === -1).length

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
            <Target size={18} style={{ color: '#43C6AC' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>Your Ad Library</h1>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Generation {generationNumber} of 3</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ backgroundColor: '#ef4444', color: '#fff' }}>
            <Sparkles size={13} /> Refine with Jaimie
          </button>
          <button onClick={handleVaultSave} disabled={vaultSaving || vaultSaved}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-60"
            style={{ borderColor: vaultSaved ? '#43C6AC' : '#e5e7eb', backgroundColor: vaultSaved ? 'rgba(67,198,172,0.08)' : '#fff', color: vaultSaved ? '#43C6AC' : '#6b7280' }}>
            {vaultSaving ? <Loader size={12} className="animate-spin" /> : <Bookmark size={12} fill={vaultSaved ? '#43C6AC' : 'none'} />}
            {vaultSaving ? 'Saving…' : vaultSaved ? 'Saved to SignalVault' : 'Save to SignalVault'}
          </button>
          <button onClick={() => { setStage('form'); setAds(null); setAdFeedback({}) }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
            Start over
          </button>
        </div>
      </div>

      {/* StrategySignals */}
      {ss && (
        <StrategySignalsBlock ss={ss} />
      )}

      {/* Google Search Ads */}
      {ads.googleSearchAds && form.platforms.includes('Google Search') && (
        <Section title="Google Search Ads">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>HEADLINES</p>
              <div className="space-y-2">
                {ads.googleSearchAds.headlines.map((h, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#191654' }}>{h.text}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{h.angle}</p>
                      </div>
                      <div className="flex items-start gap-2 flex-wrap flex-shrink-0">
                        <CharBadge text={h.text} limit={CHAR_LIMIT_GOOGLE_HEADLINE} />
                        <CopyButton text={h.text} />
                        <AdFeedbackWidget blockId={`google_headline_${i}`} contentText={h.text} adFeedback={adFeedback} onRate={handleAdRate} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>DESCRIPTIONS</p>
              <div className="space-y-2">
                {ads.googleSearchAds.descriptions.map((d, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm flex-1" style={{ color: '#191654' }}>{d.text}</p>
                      <div className="flex items-start gap-2 flex-wrap flex-shrink-0">
                        <CharBadge text={d.text} limit={CHAR_LIMIT_GOOGLE_DESC} />
                        <CopyButton text={d.text} />
                        <AdFeedbackWidget blockId={`google_desc_${i}`} contentText={d.text} adFeedback={adFeedback} onRate={handleAdRate} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {ads.googleSearchAds.adVariations?.length > 0 && (
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>AD VARIATIONS</p>
                <div className="space-y-3">
                  {ads.googleSearchAds.adVariations.map((v, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ border: '1px solid #e5e7eb' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold" style={{ color: '#191654' }}>{v.name}</p>
                        <div className="flex items-start gap-2 flex-wrap">
                          <CopyButton text={`Headlines:\n${v.headlines.join('\n')}\n\nDescriptions:\n${v.descriptions.join('\n')}`} variant="button" label="Copy set" />
                          <AdFeedbackWidget blockId={`google_variation_${i}`} contentText={v.headlines.join(' | ')} adFeedback={adFeedback} onRate={handleAdRate} />
                        </div>
                      </div>
                      <div className="space-y-1 mb-2">{v.headlines.map((h, j) => <p key={j} className="text-xs" style={{ color: '#374151' }}>{h}</p>)}</div>
                      <div className="space-y-1 mb-2">{v.descriptions.map((d, j) => <p key={j} className="text-xs" style={{ color: '#6b7280' }}>{d}</p>)}</div>
                      {v.notes && <p className="text-xs italic" style={{ color: '#9ca3af' }}>{v.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Meta Ads */}
      {ads.metaAds && form.platforms.includes('Meta (Facebook/Instagram)') && (
        <Section title="Meta Ads (Facebook / Instagram)">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>PRIMARY TEXTS</p>
              <div className="space-y-2">
                {ads.metaAds.primaryTexts.map((t, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm flex-1" style={{ color: '#191654' }}>{t.text}</p>
                      <div className="flex items-start gap-2 flex-wrap flex-shrink-0">
                        <CharBadge text={t.text} limit={CHAR_LIMIT_META_TEXT} />
                        <CopyButton text={t.text} />
                        <AdFeedbackWidget blockId={`meta_text_${i}`} contentText={t.text} adFeedback={adFeedback} onRate={handleAdRate} />
                      </div>
                    </div>
                    {t.hook && <p className="text-xs mt-1.5" style={{ color: '#9ca3af' }}>Hook: {t.hook}</p>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>HEADLINES</p>
              <div className="space-y-2">
                {ads.metaAds.headlines.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    <p className="text-sm flex-1" style={{ color: '#191654' }}>{h.text}</p>
                    <div className="flex items-start gap-2 flex-wrap ml-3 flex-shrink-0">
                      <CharBadge text={h.text} limit={CHAR_LIMIT_META_HEADLINE} />
                      <CopyButton text={h.text} />
                      <AdFeedbackWidget blockId={`meta_headline_${i}`} contentText={h.text} adFeedback={adFeedback} onRate={handleAdRate} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {ads.metaAds.adSets?.length > 0 && (
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>AD SETS</p>
                <div className="space-y-3">
                  {ads.metaAds.adSets.map((s, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ border: '1px solid #e5e7eb' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold" style={{ color: '#191654' }}>{s.name}</p>
                        <div className="flex items-start gap-2 flex-wrap">
                          <CopyButton text={`Primary Text: ${s.primaryText}\nHeadline: ${s.headline}\nDescription: ${s.description}\nCTA: ${s.cta}`} variant="button" label="Copy set" />
                          <AdFeedbackWidget blockId={`meta_adset_${i}`} contentText={s.primaryText} adFeedback={adFeedback} onRate={handleAdRate} />
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs" style={{ color: '#374151' }}>
                        <p><strong>Primary:</strong> {s.primaryText}</p>
                        <p><strong>Headline:</strong> {s.headline}</p>
                        <p><strong>Description:</strong> {s.description}</p>
                        <p><strong>CTA:</strong> {s.cta}</p>
                        {s.targetingNotes && <p className="italic" style={{ color: '#9ca3af' }}>{s.targetingNotes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ads.metaAds.audienceTargeting && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>AUDIENCE TARGETING</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {ads.metaAds.audienceTargeting.coreAudiences?.length > 0 && (
                    <div><strong style={{ color: '#374151' }}>Core:</strong> <span style={{ color: '#6b7280' }}>{ads.metaAds.audienceTargeting.coreAudiences.join(', ')}</span></div>
                  )}
                  {ads.metaAds.audienceTargeting.interests?.length > 0 && (
                    <div><strong style={{ color: '#374151' }}>Interests:</strong> <span style={{ color: '#6b7280' }}>{ads.metaAds.audienceTargeting.interests.join(', ')}</span></div>
                  )}
                  {ads.metaAds.audienceTargeting.lookalikes && (
                    <div className="col-span-2"><strong style={{ color: '#374151' }}>Lookalikes:</strong> <span style={{ color: '#6b7280' }}>{ads.metaAds.audienceTargeting.lookalikes}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* LinkedIn Ads */}
      {ads.linkedInAds && form.platforms.includes('LinkedIn') && (
        <Section title="LinkedIn Ads">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>SPONSORED CONTENT</p>
              <div className="space-y-3">
                {ads.linkedInAds.sponsoredContent.map((s, i) => (
                  <div key={i} className="p-4 rounded-xl" style={{ border: '1px solid #e5e7eb' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>Ad {i + 1}</span>
                      <div className="flex items-start gap-2 flex-wrap">
                        <CopyButton text={`Intro: ${s.introText}\nHeadline: ${s.headline}\nDescription: ${s.description}\nCTA: ${s.cta}`} variant="button" label="Copy ad" />
                        <AdFeedbackWidget blockId={`li_ad_${i}`} contentText={s.introText} adFeedback={adFeedback} onRate={handleAdRate} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs flex-1" style={{ color: '#374151' }}><strong>Intro:</strong> {s.introText}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <CharBadge text={s.introText} limit={CHAR_LIMIT_LI_INTRO} />
                          <CopyButton text={s.introText} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs flex-1" style={{ color: '#374151' }}><strong>Headline:</strong> {s.headline}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <CharBadge text={s.headline} limit={CHAR_LIMIT_LI_HEADLINE} />
                          <CopyButton text={s.headline} />
                        </div>
                      </div>
                      <p className="text-xs" style={{ color: '#6b7280' }}><strong>Description:</strong> {s.description}</p>
                      <p className="text-xs" style={{ color: '#6b7280' }}><strong>CTA:</strong> {s.cta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {ads.linkedInAds.targeting && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>TARGETING</p>
                <div className="space-y-1 text-xs" style={{ color: '#6b7280' }}>
                  {ads.linkedInAds.targeting.jobTitles?.length > 0 && <p><strong style={{ color: '#374151' }}>Job titles:</strong> {ads.linkedInAds.targeting.jobTitles.join(', ')}</p>}
                  {ads.linkedInAds.targeting.industries?.length > 0 && <p><strong style={{ color: '#374151' }}>Industries:</strong> {ads.linkedInAds.targeting.industries.join(', ')}</p>}
                  {ads.linkedInAds.targeting.companySizes?.length > 0 && <p><strong style={{ color: '#374151' }}>Company sizes:</strong> {ads.linkedInAds.targeting.companySizes.join(', ')}</p>}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Overall feedback + regen */}
      <OverallFeedbackBlock
        flaggedCount={flaggedCount}
        generationNumber={generationNumber}
        overallFeedbackDone={overallFeedbackDone}
        overallFeedbackMode={overallFeedbackMode}
        overallFeedbackText={overallFeedbackText}
        overallSubmitting={overallSubmitting}
        feedbackSaving={feedbackSaving}
        setOverallFeedbackMode={setOverallFeedbackMode}
        setOverallFeedbackText={setOverallFeedbackText}
        submitOverallFeedback={submitOverallFeedback}
        setOverallFeedbackDone={setOverallFeedbackDone}
        handleRegenerate={handleRegenerate}
      />
      <AgentChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        moduleType="signal_ads"
        agentName="Jaimie"
        agentTagline="Performance ad specialist"
        businessId={businessId || ''}
        outputId={outputId || ''}
        currentOutput={ads as unknown as Record<string, unknown>}
        onPatch={handleAgentPatch}
      />
    </div>
  )
}

// ─── StrategySignals block ────────────────────────────────────────────────────

function StrategySignalsBlock({ ss }: { ss: NonNullable<AdOutput['strategySignals']> }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(67,198,172,0.25)' }}>
      <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: 'rgba(67,198,172,0.08)' }}>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#43C6AC' }} />
        <p className="text-xs font-bold tracking-widest" style={{ color: '#43C6AC' }}>STRATEGYSIGNALS</p>
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>PRIMARY ANGLE</p>
            <p className="text-sm" style={{ color: '#191654' }}>{ss.primaryAngle}</p>
          </div>
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>KEY DIFFERENTIATOR</p>
            <p className="text-sm" style={{ color: '#191654' }}>{ss.keyDifferentiator}</p>
          </div>
        </div>
        {ss.whyItWins && (
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>WHAT SIGNALS DROVE THIS STRATEGY</p>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{ss.whyItWins}</p>
          </div>
        )}
        {ss.dataSourcesUsed && ss.dataSourcesUsed.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>DATA SOURCES USED</p>
            <div className="flex flex-wrap gap-1.5">
              {ss.dataSourcesUsed.map((s, i) => (
                <span key={i} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-semibold"
                  style={{ backgroundColor: 'rgba(25,22,84,0.07)', color: '#191654' }}>
                  <CheckCircle size={11} style={{ color: '#43C6AC' }} /> {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {ss.competitorInsights && (
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>COMPETITOR INSIGHTS</p>
            <p className="text-sm" style={{ color: '#374151' }}>{ss.competitorInsights}</p>
          </div>
        )}
        {ss.negativeKeywords && ss.negativeKeywords.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>NEGATIVE KEYWORDS</p>
            <div className="flex flex-wrap gap-1.5">
              {ss.negativeKeywords.map((kw, i) => (
                <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                  <span className="text-xs" style={{ color: '#dc2626' }}>{kw}</span>
                  <CopyButton text={kw} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: 'rgba(67,198,172,0.15)' }}>
          {ss.funnelApproach && (<div><p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>FUNNEL APPROACH</p><p className="text-xs" style={{ color: '#374151' }}>{ss.funnelApproach}</p></div>)}
          {ss.budgetAllocation && (<div><p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>BUDGET ALLOCATION</p><p className="text-xs" style={{ color: '#374151' }}>{ss.budgetAllocation}</p></div>)}
          {ss.platformRationale && (<div className="sm:col-span-2"><p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>PLATFORM RATIONALE</p><p className="text-xs" style={{ color: '#374151' }}>{ss.platformRationale}</p></div>)}
          {ss.messagingHierarchy && (<div className="sm:col-span-2"><p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>MESSAGING HIERARCHY</p><p className="text-xs" style={{ color: '#374151' }}>{ss.messagingHierarchy}</p></div>)}
        </div>
        {ss.testingRecommendations && ss.testingRecommendations.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>TESTING RECOMMENDATIONS</p>
            <ul className="space-y-1">
              {ss.testingRecommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-xs font-bold mt-0.5" style={{ color: '#43C6AC' }}>{i + 1}.</span>
                  <p className="text-xs" style={{ color: '#374151' }}>{r}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Overall feedback block ───────────────────────────────────────────────────

function OverallFeedbackBlock({
  flaggedCount, generationNumber, overallFeedbackDone, overallFeedbackMode,
  overallFeedbackText, overallSubmitting, feedbackSaving,
  setOverallFeedbackMode, setOverallFeedbackText, submitOverallFeedback,
  setOverallFeedbackDone, handleRegenerate,
}: {
  flaggedCount: number; generationNumber: number; overallFeedbackDone: boolean
  overallFeedbackMode: 'idle' | 'thumbsdown'; overallFeedbackText: string
  overallSubmitting: boolean; feedbackSaving: boolean
  setOverallFeedbackMode: (m: 'idle' | 'thumbsdown') => void
  setOverallFeedbackText: (t: string) => void
  submitOverallFeedback: (r: number) => void
  setOverallFeedbackDone: (d: boolean) => void
  handleRegenerate: () => void
}) {
  if (overallFeedbackDone && overallFeedbackMode !== 'thumbsdown') {
    return (
      <div className="p-5 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
        <p className="text-sm text-center font-semibold" style={{ color: '#43C6AC' }}>Thanks — your feedback helps Alex improve.</p>
      </div>
    )
  }

  if (overallFeedbackMode === 'thumbsdown') {
    return (
      <div className="p-5 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
        <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>
          What missed the mark overall? {generationNumber < 3 ? "We'll regenerate with your feedback." : "We'll note this for future improvements."}
        </p>
        {flaggedCount > 0 && (
          <div className="flex items-center gap-1.5 mb-3 text-xs p-2 rounded-lg" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            <ThumbsDown size={12} /> {flaggedCount} ad{flaggedCount > 1 ? 's' : ''} already flagged — those will be included in the regeneration context automatically.
          </div>
        )}
        <textarea rows={3} placeholder="e.g. 'The angles feel too generic. Need to lean harder into our speed of response differentiator.'"
          value={overallFeedbackText} onChange={e => setOverallFeedbackText(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border outline-none resize-none mb-3" style={{ borderColor: '#e5e7eb', color: '#374151' }} />
        <div className="flex items-center gap-2 flex-wrap">
          {generationNumber < 3 ? (
            <button onClick={handleRegenerate}
              disabled={overallFeedbackText.length < 20 || feedbackSaving || overallSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40"
              style={{ backgroundColor: '#191654' }}>
              {feedbackSaving ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Regenerate ({generationNumber}/3 used)
            </button>
          ) : (
            <button onClick={() => submitOverallFeedback(1)}
              disabled={overallFeedbackText.length < 20 || overallSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40"
              style={{ backgroundColor: '#191654' }}>
              {overallSubmitting ? <Loader size={13} className="animate-spin" /> : null}
              Submit feedback
            </button>
          )}
          {generationNumber >= 3 && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>
              Max regenerations reached. <a href="mailto:support@goodfellastech.com" className="underline">Contact support</a> if you need further help.
            </p>
          )}
          <button onClick={() => setOverallFeedbackMode('idle')} className="text-xs" style={{ color: '#9ca3af' }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: '#374151' }}>How did this ad library land?</p>
          {flaggedCount > 0 && (
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              {flaggedCount} ad{flaggedCount > 1 ? 's' : ''} flagged — click &quot;Needs work&quot; to regenerate with that context.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { submitOverallFeedback(5); setOverallFeedbackDone(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
            <ThumbsUp size={13} /> Looks great
          </button>
          <button onClick={() => setOverallFeedbackMode('thumbsdown')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
            <ThumbsDown size={13} /> {flaggedCount > 0 ? `Needs work (${flaggedCount} flagged)` : 'Needs work'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────
export default function AdPackPage() {
  return (
    <ModuleGate productType="ad_pack" salesPage={<AdPackSalesPage />}>
      <AdPackModule />
    </ModuleGate>
  )
}
