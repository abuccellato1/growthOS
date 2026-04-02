'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, AlertCircle, ChevronLeft, Loader } from 'lucide-react'
import ModuleGate from '@/components/ModuleGate'
import GenericSalesPage from '@/components/modules/GenericSalesPage'
import StrategySignalsBlock from '@/components/signal-content/StrategySignalsBlock'
import GeneratingScreen from '@/components/signal-content/GeneratingScreen'
import PillarCard from '@/components/signal-content/PillarCard'
import ContentCalendar from '@/components/signal-content/ContentCalendar'
import FeedbackBar from '@/components/signal-content/FeedbackBar'
import PillarApprovalCard from '@/components/signal-content/PillarApprovalCard'
import PillarRejectionModal from '@/components/signal-content/PillarRejectionModal'
import HookApprovalCard from '@/components/signal-content/HookApprovalCard'
import ConfirmationSummary from '@/components/signal-content/ConfirmationSummary'
import type {
  ContentOutput,
  ContentFeedbackItem,
  BonusContext,
  ContentStage,
  PillarProposal,
  PillarApprovalState,
  HookApprovalState,
  SelectedHook,
} from '@/components/signal-content/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ['LinkedIn', 'Instagram', 'Facebook', 'Twitter/X']
const FREQUENCIES = ['3x/week', '5x/week', 'Daily']
const GOALS = ['Build authority', 'Generate leads', 'Nurture existing audience']
const TONES = ['Professional', 'Conversational', 'Inspirational', 'Empathetic', 'Bold/Direct']

interface FormState {
  platforms: string[]
  postingFrequency: string
  contentGoal: string
  tone: string
  topicsToAvoid: string
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function BonusSkeleton({ label }: { label: string }) {
  return (
    <div className="border rounded-2xl overflow-hidden animate-pulse"
      style={{ borderColor: '#e5e7eb' }}>
      <div className="px-6 py-4 flex items-center gap-3"
        style={{ backgroundColor: '#f9fafb' }}>
        <div className="w-4 h-4 rounded-full border-2 animate-spin"
          style={{ borderColor: '#43C6AC', borderTopColor: 'transparent' }} />
        <p className="text-sm font-semibold" style={{ color: '#9ca3af' }}>{label}</p>
      </div>
      <div className="p-6 space-y-3">
        {[80, 60, 90, 50].map((w, i) => (
          <div key={i} className="h-3 rounded-full"
            style={{ backgroundColor: '#f3f4f6', width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}

function BonusFailedCard({ label }: { label: string }) {
  return (
    <div className="border rounded-2xl p-6 text-center"
      style={{ borderColor: '#fecaca', backgroundColor: '#fff5f5' }}>
      <p className="text-sm font-semibold mb-1" style={{ color: '#dc2626' }}>
        {label} unavailable
      </p>
      <p className="text-xs" style={{ color: '#9ca3af' }}>
        Try regenerating to get this content.
      </p>
    </div>
  )
}

// ─── Pillars loading screen ───────────────────────────────────────────────────

function PillarsLoadingScreen() {
  const steps = [
    'Reading your SignalMap Interview Data',
    'Checking CustomerSignals language patterns',
    'Identifying content opportunities',
    'Proposing your 5 content pillars',
  ]
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
        timeout = setTimeout(advance, 3000)
      }
    }
    timeout = setTimeout(advance, 3000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#191654' }}>
          <Share2 size={18} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: '#191654' }}>Analyzing your SignalMap data…</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Finding your strongest content angles</p>
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((label, i) => {
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
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {isDone ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="8" fill="#43C6AC" fillOpacity="0.15" />
                    <path d="M4.5 8L7 10.5L11.5 6" stroke="#43C6AC" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
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
              }}>{label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Hooks loading screen ─────────────────────────────────────────────────────

function HooksLoadingScreen() {
  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#191654' }}>
          <Share2 size={18} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: '#191654' }}>Writing your hooks…</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>3 scroll-stopping hooks per pillar — takes ~15 seconds</p>
        </div>
      </div>
      <div className="space-y-3">
        {['Applying 2026 hook frameworks', 'Using your CustomerSignals language',
          'Writing 3 hooks per pillar', 'Finalizing 15 hooks for your review',
        ].map((label, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
            style={{ backgroundColor: i === 3 ? 'rgba(67,198,172,0.06)' : 'transparent',
              border: i === 3 ? '1px solid rgba(67,198,172,0.2)' : '1px solid transparent' }}>
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              {i < 3 ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="8" fill="#43C6AC" fillOpacity="0.15" />
                  <path d="M4.5 8L7 10.5L11.5 6" stroke="#43C6AC" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#43C6AC', borderTopColor: 'transparent' }} />
              )}
            </div>
            <p className="text-sm" style={{ color: i < 3 ? '#6b7280' : '#191654', fontWeight: i === 3 ? 600 : 400 }}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main module ──────────────────────────────────────────────────────────────

function SignalContentModule() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [outputId, setOutputId] = useState<string | null>(null)
  const [stage, setStage] = useState<ContentStage>('form')
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    platforms: [], postingFrequency: '', contentGoal: '', tone: '', topicsToAvoid: '',
  })

  // Pillar approval state
  const [pillarStates, setPillarStates] = useState<PillarApprovalState[]>([])
  const [condensedContext, setCondensedContext] = useState('')
  const [rejectingIndex, setRejectingIndex] = useState<number | null>(null)
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null)

  // Hook approval state
  const [hookStates, setHookStates] = useState<HookApprovalState[]>([])

  // Results state
  const [content, setContent] = useState<ContentOutput | null>(null)
  const [generationNumber, setGenerationNumber] = useState(1)
  const [businessName, setBusinessName] = useState('')
  const [vocPhraseCount, setVocPhraseCount] = useState(0)
  const [bonusLoading, setBonusLoading] = useState(false)
  const [bonusFailed, setBonusFailed] = useState(false)
  const [contentFeedback, setContentFeedback] = useState<Record<string, ContentFeedbackItem>>({})
  const [overallFeedbackMode, setOverallFeedbackMode] = useState<'idle' | 'thumbsdown'>('idle')
  const [overallFeedbackText, setOverallFeedbackText] = useState('')
  const [overallFeedbackDone, setOverallFeedbackDone] = useState(false)
  const [overallSubmitting, setOverallSubmitting] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('signalshot_active_business')
    if (!id) { router.push('/dashboard'); return }
    setBusinessId(id)
  }, [router])

  function isFormValid() {
    return form.platforms.length > 0 && !!form.postingFrequency && !!form.contentGoal && !!form.tone
  }

  function togglePlatform(p: string) {
    setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }))
  }

  // ── Stage 1 → 2: Fetch pillar proposals ──────────────────────────────────

  async function fetchPillars() {
    if (!businessId) return
    setError(null)
    setStage('pillars-loading')
    try {
      const res = await fetch('/api/signal-content/pillars', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, ...form }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to generate pillar proposals'); setStage('form'); return }
      const data = json.data
      const proposals = data.pillars as PillarProposal[]
      setPillarStates(proposals.map(p => ({ pillar: p, status: 'pending' })))
      setCondensedContext(data.condensedContext || '')
      setStage('pillars-review')
    } catch { setError('Network error — please try again'); setStage('form') }
  }

  // ── Pillar approval actions ───────────────────────────────────────────────

  function approvePillar(index: number) {
    setPillarStates(prev => prev.map((s, i) => i === index ? { ...s, status: 'approved' } : s))
  }

  function openRejectModal(index: number) { setRejectingIndex(index) }

  async function handleRejectionConfirm(reason: string, action: 'swap' | 'custom', customName?: string) {
    if (rejectingIndex === null) return
    if (action === 'custom' && customName) {
      setPillarStates(prev => prev.map((s, i) => i === rejectingIndex ? {
        ...s, status: 'custom', rejectionReason: reason,
        pillar: { ...s.pillar, name: customName, rationale: 'Custom pillar added by user', icpConnection: '' },
      } : s))
      setRejectingIndex(null)
      return
    }
    const currentPillar = pillarStates[rejectingIndex]
    const existingNames = pillarStates.filter((_, i) => i !== rejectingIndex).map(s => s.pillar.name)
    setPillarStates(prev => prev.map((s, i) => i === rejectingIndex ? { ...s, status: 'rejected' } : s))
    setRejectingIndex(null)
    setSwappingIndex(rejectingIndex)
    try {
      const res = await fetch('/api/signal-content/pillar-swap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectedPillarName: currentPillar.pillar.name, rejectionReason: reason, existingPillarNames: existingNames, condensedContext }),
      })
      const json = await res.json()
      if (res.ok && json.data?.pillar) {
        setPillarStates(prev => prev.map((s, i) => i === rejectingIndex ? { ...s, status: 'swapped', rejectionReason: reason, pillar: json.data.pillar as PillarProposal } : s))
      } else {
        setPillarStates(prev => prev.map((s, i) => i === rejectingIndex ? { ...s, status: 'pending' } : s))
      }
    } catch {
      setPillarStates(prev => prev.map((s, i) => i === rejectingIndex ? { ...s, status: 'pending' } : s))
    } finally { setSwappingIndex(null) }
  }

  const allPillarsResolved = pillarStates.length === 5 &&
    pillarStates.every(s => s.status === 'approved' || s.status === 'swapped' || s.status === 'custom')
  const rejectedCount = pillarStates.filter(s => s.status === 'rejected').length

  // ── Stage 2 → 3: Fetch hooks ─────────────────────────────────────────────

  async function fetchHooks() {
    if (!businessId) return
    setError(null)
    setStage('hooks-loading')
    const approvedPillars = pillarStates
      .filter(s => s.status === 'approved' || s.status === 'swapped' || s.status === 'custom')
      .map(s => s.pillar)
    try {
      const res = await fetch('/api/signal-content/hooks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedPillars, condensedContext, tone: form.tone }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to generate hooks'); setStage('pillars-review'); return }
      const pillarHooks = json.data.pillarHooks as Array<{
        pillarName: string; hooks: Array<{ text: string; framework: string; charCount: number }>
      }>
      setHookStates(pillarHooks.map(ph => ({
        pillarName: ph.pillarName,
        hooks: ph.hooks.map((h, i) => ({ ...h, charCount: h.charCount || h.text.length, selected: i === 0 })),
      })))
      setStage('hooks-review')
    } catch { setError('Network error — please try again'); setStage('pillars-review') }
  }

  function updateHookState(index: number, updated: HookApprovalState) {
    setHookStates(prev => prev.map((s, i) => i === index ? updated : s))
  }

  const allHooksValid = hookStates.length > 0 && hookStates.every(s => s.hooks.some(h => h.selected))

  function buildSelectedHooks(): SelectedHook[] {
    return hookStates.map(s => {
      const selected = s.hooks.find(h => h.selected)
      return { pillarName: s.pillarName, hook: selected?.text || s.hooks[0]?.text || '', framework: selected?.framework || s.hooks[0]?.framework || '' }
    })
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  async function generate(regenFeedback?: string) {
    if (!businessId) return
    setError(null); setStage('generating'); setContentFeedback({})
    const approvedPillars = pillarStates
      .filter(s => s.status === 'approved' || s.status === 'swapped' || s.status === 'custom')
      .map(s => s.pillar)
    const selectedHooks = buildSelectedHooks()
    try {
      const res = await fetch('/api/signal-content/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, ...form, approvedPillars, selectedHooks, condensedContext, regenerationFeedback: regenFeedback || undefined, generationNumber }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Generation failed'); setStage('confirmation'); return }
      const data = json.data
      setContent(data.content as ContentOutput)
      setOutputId(data.outputId)
      setBusinessName(data.businessName || '')
      setVocPhraseCount(data.vocPhraseCount || 0)
      setOverallFeedbackMode('idle'); setOverallFeedbackText(''); setOverallFeedbackDone(false)

      setBonusLoading(true); setBonusFailed(false); setStage('results')
      try {
        const bonusContext: BonusContext = data.bonusContext
        const bonusRes = await fetch('/api/signal-content/bonus', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, outputId: data.outputId, ...bonusContext }),
        })
        if (bonusRes.ok) {
          const bonusJson = await bonusRes.json()
          setContent(prev => prev ? { ...prev, ...bonusJson.data.bonus } : prev)
        } else { setBonusFailed(true) }
      } catch { setBonusFailed(true) } finally { setBonusLoading(false) }
    } catch { setError('Network error — please try again'); setStage('confirmation') }
  }

  // ── Feedback ──────────────────────────────────────────────────────────────

  function handleContentRate(item: ContentFeedbackItem) {
    setContentFeedback(prev => ({ ...prev, [item.blockId]: item }))
    if (!businessId || !outputId) return
    fetch('/api/signal-content/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId, contentFeedbackItems: [item] }) }).catch(() => null)
  }

  async function submitOverallFeedback(rating: number) {
    if (!businessId || !outputId) return
    setOverallSubmitting(true)
    await fetch('/api/signal-content/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId, rating, feedbackText: overallFeedbackText || undefined }) })
    setOverallSubmitting(false); setOverallFeedbackDone(true)
  }

  async function handleRegenerate() {
    if (generationNumber >= 3) return
    const flagged = Object.values(contentFeedback).filter(f => f.rating === -1)
    const flaggedSummary = flagged.length > 0
      ? `USER FLAGGED ${flagged.length} POSTS:\n` + flagged.map(f => `- "${f.contentText.slice(0, 80)}" — reasons: ${f.reasons.join(', ') || 'none'}`).join('\n') : ''
    const combined = [overallFeedbackText, flaggedSummary].filter(Boolean).join('\n\n')
    setGenerationNumber(n => n + 1)
    await generate(combined || undefined)
  }

  const flaggedCount = Object.values(contentFeedback).filter(f => f.rating === -1).length

  // ── FORM ──────────────────────────────────────────────────────────────────
  if (stage === 'form') {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
            <Share2 size={22} style={{ color: '#43C6AC' }} />
          </div>
          <div>
            <h1 className="text-3xl font-black" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>SignalContent</h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>Tell us your settings — Alex proposes your content pillars first.</p>
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
            <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Platforms * <span className="font-normal text-gray-400">(select all that apply)</span></label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => togglePlatform(p)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ borderColor: form.platforms.includes(p) ? '#43C6AC' : '#e5e7eb', backgroundColor: form.platforms.includes(p) ? 'rgba(67,198,172,0.1)' : '#fff', color: form.platforms.includes(p) ? '#191654' : '#6b7280' }}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Posting Frequency *</label>
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map(f => (
                <button key={f} onClick={() => setForm(prev => ({ ...prev, postingFrequency: f }))} className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ borderColor: form.postingFrequency === f ? '#43C6AC' : '#e5e7eb', backgroundColor: form.postingFrequency === f ? 'rgba(67,198,172,0.1)' : '#fff', color: form.postingFrequency === f ? '#191654' : '#6b7280' }}>{f}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Primary Content Goal *</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(g => (
                <button key={g} onClick={() => setForm(prev => ({ ...prev, contentGoal: g }))} className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ borderColor: form.contentGoal === g ? '#43C6AC' : '#e5e7eb', backgroundColor: form.contentGoal === g ? 'rgba(67,198,172,0.1)' : '#fff', color: form.contentGoal === g ? '#191654' : '#6b7280' }}>{g}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Brand Tone *</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button key={t} onClick={() => setForm(prev => ({ ...prev, tone: t }))} className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ borderColor: form.tone === t ? '#43C6AC' : '#e5e7eb', backgroundColor: form.tone === t ? 'rgba(67,198,172,0.1)' : '#fff', color: form.tone === t ? '#191654' : '#6b7280' }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: '#374151' }}>Topics to avoid <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea rows={2} placeholder="e.g. 'No posts about pricing, no competitor comparisons'" value={form.topicsToAvoid}
              onChange={e => setForm(prev => ({ ...prev, topicsToAvoid: e.target.value }))}
              className="w-full text-xs px-3 py-2 rounded-lg border outline-none resize-none" style={{ borderColor: '#e5e7eb', color: '#374151' }} />
          </div>
          <button onClick={fetchPillars} disabled={!isFormValid()}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-opacity"
            style={{ backgroundColor: isFormValid() ? '#191654' : '#d1d5db', cursor: isFormValid() ? 'pointer' : 'not-allowed' }}>
            Find My Content Pillars →
          </button>
        </div>
      </div>
    )
  }

  // PILLARS LOADING
  if (stage === 'pillars-loading') return <PillarsLoadingScreen />

  // PILLARS REVIEW
  if (stage === 'pillars-review') {
    return (
      <div className="max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>Your Content Pillars</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>Alex found these based on your SignalMap and CustomerSignals data. Approve, swap, or enter your own.</p>
          </div>
          <button onClick={() => setStage('form')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
            <ChevronLeft size={13} /> Back
          </button>
        </div>
        {rejectedCount >= 3 && (
          <div className="p-4 rounded-xl mb-6" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
            <p className="text-xs font-semibold" style={{ color: '#d97706' }}>SignalContent works best with 5 strong pillars. Consider accepting some of these or swapping them for alternatives.</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {pillarStates.map((state, i) => (
            <PillarApprovalCard key={i} state={state} index={i} isSwapping={swappingIndex === i} onApprove={() => approvePillar(i)} onReject={() => openRejectModal(i)} />
          ))}
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: '#e5e7eb' }}>
            <div className="h-full rounded-full transition-all" style={{ backgroundColor: '#43C6AC', width: `${(pillarStates.filter(s => s.status === 'approved' || s.status === 'swapped' || s.status === 'custom').length / 5) * 100}%` }} />
          </div>
          <p className="text-xs font-semibold flex-shrink-0" style={{ color: '#6b7280' }}>
            {pillarStates.filter(s => s.status === 'approved' || s.status === 'swapped' || s.status === 'custom').length}/5 approved
          </p>
        </div>
        <button onClick={fetchHooks} disabled={!allPillarsResolved || !!swappingIndex}
          className="w-full max-w-md py-3.5 rounded-xl text-white font-bold text-sm transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: '#191654' }}>
          {swappingIndex !== null ? (<><Loader size={14} className="animate-spin" /> Getting replacement…</>) : 'Approve Pillars & Generate Hooks →'}
        </button>
        {rejectingIndex !== null && (
          <PillarRejectionModal pillarName={pillarStates[rejectingIndex]?.pillar.name || ''} onConfirm={handleRejectionConfirm} onCancel={() => setRejectingIndex(null)} />
        )}
      </div>
    )
  }

  // HOOKS LOADING
  if (stage === 'hooks-loading') return <HooksLoadingScreen />

  // HOOKS REVIEW
  if (stage === 'hooks-review') {
    return (
      <div className="max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>Choose Your Hooks</h1>
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>3 hooks per pillar — approve your favourites. At least 1 per pillar required. These become the opening lines of your posts.</p>
          </div>
          <button onClick={() => setStage('pillars-review')} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
            <ChevronLeft size={13} /> Back to Pillars
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 p-4 rounded-xl mb-6" style={{ backgroundColor: '#fff5f5', border: '1px solid #fca5a5' }}>
            <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
            <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {hookStates.map((state, i) => (
            <HookApprovalCard key={i} state={state} pillarIndex={i} condensedContext={condensedContext} tone={form.tone} onChange={updated => updateHookState(i, updated)} />
          ))}
        </div>
        <button onClick={() => setStage('confirmation')} disabled={!allHooksValid}
          className="w-full max-w-md py-3.5 rounded-xl text-white font-bold text-sm transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#191654' }}>
          Approve Hooks & Review Summary →
        </button>
      </div>
    )
  }

  // CONFIRMATION
  if (stage === 'confirmation') {
    const approvedPillars = pillarStates.filter(s => s.status === 'approved' || s.status === 'swapped' || s.status === 'custom')
    return <ConfirmationSummary approvedPillars={approvedPillars} selectedHooks={buildSelectedHooks()} onGenerate={() => generate()} isGenerating={false} />
  }

  // GENERATING
  if (stage === 'generating') {
    return <GeneratingScreen generationNumber={generationNumber} bonusLoading={false} businessName={businessName} vocPhraseCount={vocPhraseCount} />
  }

  // RESULTS
  if (!content) return null

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
            <Share2 size={18} style={{ color: '#43C6AC' }} />
          </div>
          <div>
            <h1 className="text-3xl font-black" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>Your Content Library</h1>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Generation {generationNumber} of 3</p>
          </div>
        </div>
        <button onClick={() => { setStage('form'); setContent(null); setContentFeedback({}); setPillarStates([]); setHookStates([]); setGenerationNumber(1) }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
          Start over
        </button>
      </div>

      {content.strategySignals && <StrategySignalsBlock ss={content.strategySignals} />}

      {bonusLoading ? <BonusSkeleton label="Building your content calendar…" />
        : bonusFailed ? <BonusFailedCard label="Content calendar" />
        : content.contentCalendar ? <ContentCalendar calendar={content.contentCalendar} reelScripts={content.reelScripts} carouselFrameworks={content.carouselFrameworks} storySequences={content.storySequences} outputId={outputId || undefined} businessId={businessId || undefined} /> : null}

      {content.pillars && content.pillars.map((pillar, pi) => (
        <PillarCard key={pi} pillar={pillar} pillarIndex={pi}
          activePlatforms={form.platforms.filter(p => p !== 'Twitter/X')}
          contentFeedback={contentFeedback} onRate={handleContentRate} />
      ))}



      <FeedbackBar generationNumber={generationNumber} flaggedCount={flaggedCount}
        overallFeedbackMode={overallFeedbackMode} overallFeedbackText={overallFeedbackText}
        overallFeedbackDone={overallFeedbackDone} overallSubmitting={overallSubmitting}
        onFeedbackTextChange={setOverallFeedbackText} onFeedbackModeChange={setOverallFeedbackMode}
        onThumbsUp={() => { submitOverallFeedback(5); setOverallFeedbackDone(true) }}
        onRegenerate={handleRegenerate} onSubmitFeedback={() => submitOverallFeedback(1)} />
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SocialPackPage() {
  return (
    <ModuleGate productType="social_pack" salesPage={
      <GenericSalesPage name="SignalContent"
        description="Content pillars and post templates built from your SignalMap data. Every piece speaks directly to your ideal customer's language, problems, and aspirations."
        iconName="Share2"
        deliverables={[
          '5 content pillars you approve before generation',
          '15 hooks to choose from (3 per pillar)',
          'LinkedIn, Instagram + Facebook posts per pillar',
          'Platform-accurate mockups with real images',
          '4-week content calendar',
          'Reel scripts, carousel frameworks + story sequences',
          'Per-post feedback + regeneration (up to 3x)',
        ]} />
    }>
      <SignalContentModule />
    </ModuleGate>
  )
}
