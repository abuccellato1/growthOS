'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, AlertCircle } from 'lucide-react'
import ModuleGate from '@/components/ModuleGate'
import GenericSalesPage from '@/components/modules/GenericSalesPage'
import StrategySignalsBlock from '@/components/signal-content/StrategySignalsBlock'
import GeneratingScreen from '@/components/signal-content/GeneratingScreen'
import PillarCard from '@/components/signal-content/PillarCard'
import ContentCalendar from '@/components/signal-content/ContentCalendar'
import BonusFormats from '@/components/signal-content/BonusFormats'
import FeedbackBar from '@/components/signal-content/FeedbackBar'
import type { ContentOutput, ContentFeedbackItem, BonusContext } from '@/components/signal-content/types'

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

// ─── Intake Form ──────────────────────────────────────────────────────────────

function ContentForm({
  form, setForm, onSubmit, error, isValid,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSubmit: () => void
  error: string | null
  isValid: boolean
}) {
  function togglePlatform(p: string) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }))
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: '#191654' }}>
          <Share2 size={22} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1 className="text-3xl font-black"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            SignalContent
          </h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            5 content pillars + post templates built from your SignalMap data.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl mb-6"
          style={{ backgroundColor: '#fff5f5', border: '1px solid #fca5a5' }}>
          <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>
            Platforms * <span className="font-normal text-gray-400">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => togglePlatform(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  borderColor: form.platforms.includes(p) ? '#43C6AC' : '#e5e7eb',
                  backgroundColor: form.platforms.includes(p) ? 'rgba(67,198,172,0.1)' : '#fff',
                  color: form.platforms.includes(p) ? '#191654' : '#6b7280',
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>
            Posting Frequency *
          </label>
          <div className="flex flex-wrap gap-2">
            {FREQUENCIES.map(f => (
              <button key={f} onClick={() => setForm(prev => ({ ...prev, postingFrequency: f }))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  borderColor: form.postingFrequency === f ? '#43C6AC' : '#e5e7eb',
                  backgroundColor: form.postingFrequency === f ? 'rgba(67,198,172,0.1)' : '#fff',
                  color: form.postingFrequency === f ? '#191654' : '#6b7280',
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>
            Primary Content Goal *
          </label>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(g => (
              <button key={g} onClick={() => setForm(prev => ({ ...prev, contentGoal: g }))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  borderColor: form.contentGoal === g ? '#43C6AC' : '#e5e7eb',
                  backgroundColor: form.contentGoal === g ? 'rgba(67,198,172,0.1)' : '#fff',
                  color: form.contentGoal === g ? '#191654' : '#6b7280',
                }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>
            Brand Tone *
          </label>
          <div className="flex flex-wrap gap-2">
            {TONES.map(t => (
              <button key={t} onClick={() => setForm(prev => ({ ...prev, tone: t }))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  borderColor: form.tone === t ? '#43C6AC' : '#e5e7eb',
                  backgroundColor: form.tone === t ? 'rgba(67,198,172,0.1)' : '#fff',
                  color: form.tone === t ? '#191654' : '#6b7280',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1" style={{ color: '#374151' }}>
            Topics to avoid <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea rows={2}
            placeholder="e.g. 'No posts about pricing, no competitor comparisons'"
            value={form.topicsToAvoid}
            onChange={e => setForm(prev => ({ ...prev, topicsToAvoid: e.target.value }))}
            className="w-full text-xs px-3 py-2 rounded-lg border outline-none resize-none"
            style={{ borderColor: '#e5e7eb', color: '#374151' }} />
        </div>

        <button onClick={onSubmit} disabled={!isValid}
          className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-opacity"
          style={{
            backgroundColor: isValid ? '#191654' : '#d1d5db',
            cursor: isValid ? 'pointer' : 'not-allowed',
          }}>
          Generate My Content Library
        </button>
      </div>
    </div>
  )
}

// ─── Main Module ──────────────────────────────────────────────────────────────

function BonusSkeleton({ label }: { label: string }) {
  return (
    <div className="border rounded-2xl overflow-hidden animate-pulse"
      style={{ borderColor: '#e5e7eb' }}>
      <div className="px-6 py-4 flex items-center gap-3"
        style={{ backgroundColor: '#f9fafb' }}>
        <div className="w-4 h-4 rounded-full animate-spin border-2"
          style={{ borderColor: '#43C6AC', borderTopColor: 'transparent' }} />
        <p className="text-sm font-semibold" style={{ color: '#9ca3af' }}>
          {label}
        </p>
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

function SignalContentModule() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [outputId, setOutputId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    platforms: [],
    postingFrequency: '',
    contentGoal: '',
    tone: '',
    topicsToAvoid: '',
  })

  const [stage, setStage] = useState<'form' | 'generating' | 'results'>('form')
  const [content, setContent] = useState<ContentOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generationNumber, setGenerationNumber] = useState(1)
  const [contentFeedback, setContentFeedback] = useState<Record<string, ContentFeedbackItem>>({})

  const [overallFeedbackMode, setOverallFeedbackMode] = useState<'idle' | 'thumbsdown'>('idle')
  const [overallFeedbackText, setOverallFeedbackText] = useState('')
  const [overallFeedbackDone, setOverallFeedbackDone] = useState(false)
  const [overallSubmitting, setOverallSubmitting] = useState(false)
  const [businessName, setBusinessName] = useState<string>('')
  const [vocPhraseCount, setVocPhraseCount] = useState<number>(0)
  const [bonusLoading, setBonusLoading] = useState(false)
  const [bonusFailed, setBonusFailed] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('signalshot_active_business')
    if (!id) { router.push('/dashboard'); return }
    setBusinessId(id)
  }, [router])

  function isFormValid() {
    return form.platforms.length > 0 && !!form.postingFrequency && !!form.contentGoal && !!form.tone
  }

  function handleContentRate(item: ContentFeedbackItem) {
    setContentFeedback(prev => ({ ...prev, [item.blockId]: item }))
    if (!businessId || !outputId) return
    fetch('/api/signal-content/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId, contentFeedbackItems: [item] }),
    }).catch(() => null)
  }

  async function generate(regenFeedback?: string) {
    if (!businessId) return
    setError(null)
    setStage('generating')
    setContentFeedback({})

    try {
      // Call 1 — core pillars + strategy
      const res = await fetch('/api/signal-content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          ...form,
          regenerationFeedback: regenFeedback || undefined,
          generationNumber,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Generation failed')
        setStage('form')
        return
      }

      const data = json.data

      // Show core content immediately
      setContent(data.content as ContentOutput)
      setOutputId(data.outputId)
      setBusinessName(data.businessName || '')
      setVocPhraseCount(data.vocPhraseCount || 0)
      setOverallFeedbackMode('idle')
      setOverallFeedbackText('')
      setOverallFeedbackDone(false)

      // Call 2 — bonus formats + calendar (background, non-fatal)
      setBonusLoading(true)
      setBonusFailed(false)
      setStage('results') // Show results immediately while bonus loads

      try {
        const bonusContext: BonusContext = data.bonusContext
        const bonusRes = await fetch('/api/signal-content/bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            outputId: data.outputId,
            ...bonusContext,
          }),
        })
        if (bonusRes.ok) {
          const bonusJson = await bonusRes.json()
          setContent(prev => prev ? { ...prev, ...bonusJson.data.bonus } : prev)
        } else {
          setBonusFailed(true)
        }
      } catch {
        setBonusFailed(true)
      } finally {
        setBonusLoading(false)
      }
    } catch {
      setError('Network error — please try again')
      setStage('form')
    }
  }

  async function submitOverallFeedback(rating: number) {
    if (!businessId || !outputId) return
    setOverallSubmitting(true)
    await fetch('/api/signal-content/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId, outputId, rating,
        feedbackText: overallFeedbackText || undefined,
      }),
    })
    setOverallSubmitting(false)
    setOverallFeedbackDone(true)
  }

  async function handleRegenerate() {
    if (generationNumber >= 3) return
    const flagged = Object.values(contentFeedback).filter(f => f.rating === -1)
    const flaggedSummary = flagged.length > 0
      ? `USER FLAGGED ${flagged.length} POSTS:\n` +
        flagged.map(f => `- "${f.contentText.slice(0, 80)}" — reasons: ${f.reasons.join(', ') || 'none'}`).join('\n')
      : ''
    const combined = [overallFeedbackText, flaggedSummary].filter(Boolean).join('\n\n')
    setGenerationNumber(n => n + 1)
    await generate(combined || undefined)
  }

  const flaggedCount = Object.values(contentFeedback).filter(f => f.rating === -1).length

  // ── Stages ────────────────────────────────────────────────────────────────

  if (stage === 'form') {
    return (
      <ContentForm
        form={form}
        setForm={setForm}
        onSubmit={() => generate()}
        error={error}
        isValid={isFormValid()}
      />
    )
  }

  if (stage === 'generating') {
    return <GeneratingScreen generationNumber={generationNumber} bonusLoading={false} businessName={businessName} vocPhraseCount={vocPhraseCount} />
  }

  if (!content) return null

  // ── Results ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#191654' }}>
            <Share2 size={18} style={{ color: '#43C6AC' }} />
          </div>
          <div>
            <h1 className="text-3xl font-black"
              style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
              Your Content Library
            </h1>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Generation {generationNumber} of 3</p>
          </div>
        </div>
        <button
          onClick={() => { setStage('form'); setContent(null); setContentFeedback({}) }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
          style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
          Start over
        </button>
      </div>

      {/* StrategySignals */}
      {content.strategySignals && (
        <StrategySignalsBlock ss={content.strategySignals} />
      )}

      {/* Standalone Hooks */}
      {content.hooks && content.hooks.length > 0 && (
        <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
          <div className="px-6 py-4" style={{ backgroundColor: '#f9fafb' }}>
            <p className="text-sm font-bold"
              style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
              Standalone Hooks
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              Use these anywhere — carousel openers, story text, email subject lines.
            </p>
          </div>
          <div className="p-6 space-y-2">
            {content.hooks.map((hook, i) => (
              <div key={i} className="flex items-start justify-between gap-2 p-3 rounded-xl"
                style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <p className="text-sm flex-1" style={{ color: '#191654' }}>{hook}</p>
                <div className="flex-shrink-0">
                  <button
                    onClick={() => navigator.clipboard.writeText(hook)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Copy">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4-Week Calendar */}
      {bonusLoading ? (
        <BonusSkeleton label="Building your content calendar…" />
      ) : bonusFailed ? (
        <BonusFailedCard label="Content calendar" />
      ) : content.contentCalendar ? (
        <ContentCalendar calendar={content.contentCalendar} />
      ) : null}

      {/* Content Pillars */}
      {content.pillars && content.pillars.map((pillar, pi) => (
        <PillarCard
          key={pi}
          pillar={pillar}
          pillarIndex={pi}
          activePlatforms={form.platforms.filter(p => p !== 'Twitter/X')}
          contentFeedback={contentFeedback}
          onRate={handleContentRate}
        />
      ))}

      {/* Bonus Formats */}
      {bonusLoading ? (
        <BonusSkeleton label="Writing reel scripts, carousels + story sequences…" />
      ) : bonusFailed ? (
        <BonusFailedCard label="Bonus content formats" />
      ) : (content.reelScripts || content.carouselFrameworks || content.storySequences) ? (
        <BonusFormats
          reelScripts={content.reelScripts}
          carouselFrameworks={content.carouselFrameworks}
          storySequences={content.storySequences}
          unsplashQuery={`${content.pillars?.[0]?.unsplashQuery || ''} professional`}
        />
      ) : null}

      {/* Feedback */}
      <FeedbackBar
        generationNumber={generationNumber}
        flaggedCount={flaggedCount}
        overallFeedbackMode={overallFeedbackMode}
        overallFeedbackText={overallFeedbackText}
        overallFeedbackDone={overallFeedbackDone}
        overallSubmitting={overallSubmitting}
        onFeedbackTextChange={setOverallFeedbackText}
        onFeedbackModeChange={setOverallFeedbackMode}
        onThumbsUp={() => { submitOverallFeedback(5); setOverallFeedbackDone(true) }}
        onRegenerate={handleRegenerate}
        onSubmitFeedback={() => submitOverallFeedback(1)}
      />
    </div>
  )
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function SocialPackPage() {
  return (
    <ModuleGate
      productType="social_pack"
      salesPage={
        <GenericSalesPage
          name="SignalContent"
          description="Content pillars and post templates built from your SignalMap data. Every piece speaks directly to your ideal customer's language, problems, and aspirations."
          iconName="Share2"
          deliverables={[
            '5 content pillars mapped to SignalMap pain points',
            'LinkedIn, Instagram + Facebook post previews per pillar',
            'Platform-accurate mockups with real images',
            'Hook formulas from CustomerSignals language',
            '4-week content calendar',
            '10 standalone hooks for any format',
            'Reel scripts, carousel frameworks + story sequences',
            'Per-post feedback + regeneration (up to 3x)',
          ]}
        />
      }
    >
      <SignalContentModule />
    </ModuleGate>
  )
}
