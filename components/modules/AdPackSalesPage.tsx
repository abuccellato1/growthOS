'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import CopyButton from '@/components/CopyButton'

interface AdPackSalesPageProps {
  businessId: string
}

interface CompetitorEntry {
  name: string
  website: string
}

type ViewState = 'form' | 'generating' | 'results'

interface AdOutput {
  summary?: {
    strategy?: string
    primaryAngle?: string
    keyDifferentiator?: string
  }
  googleSearchAds?: {
    headlines?: Array<{ text: string; charCount: number; angle: string }>
    descriptions?: Array<{ text: string; charCount: number }>
    adVariations?: Array<{ name: string; headlines: string[]; descriptions: string[]; notes: string }>
    negativeKeywords?: string[]
    audienceTargeting?: string
    bidStrategy?: string
  }
  metaAds?: {
    primaryTexts?: Array<{ text: string; charCount: number; hook: string }>
    headlines?: Array<{ text: string; charCount: number }>
    adSets?: Array<{ name: string; primaryText: string; headline: string; description: string; cta: string; targetingNotes: string }>
    audienceTargeting?: {
      coreAudiences?: string[]
      interests?: string[]
      behaviors?: string[]
      customAudiences?: string[]
      lookalikes?: string
    }
  }
  linkedInAds?: {
    sponsoredContent?: Array<{ introText: string; headline: string; description: string; cta: string }>
    targeting?: {
      jobTitles?: string[]
      industries?: string[]
      companySizes?: string[]
      skills?: string[]
    }
    messagingNotes?: string
  }
  crossPlatformStrategy?: {
    funnelApproach?: string
    messagingHierarchy?: string
    budgetAllocation?: string
    testingRecommendations?: string[]
  }
}

const PLATFORM_OPTIONS = [
  { value: 'google', label: 'Google Search Ads' },
  { value: 'meta', label: 'Meta (Facebook / Instagram)' },
  { value: 'linkedin', label: 'LinkedIn Ads' },
]

const BUDGET_OPTIONS = [
  '$500 - $1,000/mo',
  '$1,000 - $3,000/mo',
  '$3,000 - $5,000/mo',
  '$5,000 - $10,000/mo',
  '$10,000+/mo',
]

const TONE_OPTIONS = [
  'Professional & authoritative',
  'Friendly & approachable',
  'Bold & direct',
  'Educational & informative',
  'Conversational & relatable',
]

export default function AdPackSalesPage({ businessId }: AdPackSalesPageProps) {
  const [view, setView] = useState<ViewState>('form')
  const [goal, setGoal] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [budget, setBudget] = useState('')
  const [tone, setTone] = useState('')
  const [previousAttempts, setPreviousAttempts] = useState('')
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([
    { name: '', website: '' },
  ])
  const [ads, setAds] = useState<AdOutput | null>(null)
  const [outputId, setOutputId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [generationNumber, setGenerationNumber] = useState(1)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [activeTab, setActiveTab] = useState<'google' | 'meta' | 'linkedin' | 'strategy'>('google')

  // Load previous output if it exists
  useEffect(() => {
    const supabase = createClient()
    async function loadPrevious() {
      const { data } = await supabase
        .from('module_outputs')
        .select('*')
        .eq('business_id', businessId)
        .eq('module_type', 'signal_ads')
        .order('generation_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data?.output_data && data.status === 'complete') {
        setAds(data.output_data as AdOutput)
        setOutputId(data.id)
        setGenerationNumber((data.generation_number || 1) + 1)
        if (data.form_inputs) {
          const inputs = data.form_inputs as Record<string, unknown>
          setGoal((inputs.goal as string) || '')
          setPlatforms((inputs.platforms as string[]) || [])
          setBudget((inputs.budget as string) || '')
          setTone((inputs.tone as string) || '')
          setPreviousAttempts((inputs.previousAttempts as string) || '')
          if (inputs.competitors) setCompetitors(inputs.competitors as CompetitorEntry[])
        }
        setView('results')
      }
    }
    if (businessId) loadPrevious()
  }, [businessId])

  function togglePlatform(val: string) {
    setPlatforms(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
    )
  }

  function addCompetitor() {
    if (competitors.length < 5) {
      setCompetitors(prev => [...prev, { name: '', website: '' }])
    }
  }

  function updateCompetitor(idx: number, field: 'name' | 'website', val: string) {
    setCompetitors(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  }

  function removeCompetitor(idx: number) {
    setCompetitors(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleGenerate(regenerationFeedback?: string) {
    if (!goal.trim() || !platforms.length || !budget || !tone) {
      setError('Please fill in all required fields.')
      return
    }
    setError('')
    setView('generating')

    try {
      const res = await fetch('/api/signal-ads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          goal: goal.trim(),
          platforms,
          budget,
          tone,
          previousAttempts: previousAttempts.trim(),
          competitors: competitors.filter(c => c.name.trim() || c.website.trim()),
          regenerationFeedback,
          generationNumber,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || 'Generation failed. Please try again.')
        setView('form')
        return
      }

      const data = await res.json()
      setAds(data.data.ads)
      setOutputId(data.data.outputId)
      setGenerationNumber(prev => prev + 1)
      setFeedbackSent(false)
      setView('results')
    } catch {
      setError('Network error. Please try again.')
      setView('form')
    }
  }

  async function handleFeedback(rating: number, text: string) {
    if (!outputId) return
    try {
      await fetch('/api/signal-ads/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId, businessId, rating, feedback: text }),
      })
      setFeedbackSent(true)
    } catch { /* non-fatal */ }
  }

  if (view === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader size={36} className="animate-spin mb-4" style={{ color: '#43C6AC' }} />
        <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
          Generating your ad library...
        </h2>
        <p className="text-sm" style={{ color: '#6b7280' }}>
          Analyzing your ICP, messaging framework, and customer voice data.
          This typically takes 30-60 seconds.
        </p>
      </div>
    )
  }

  if (view === 'results' && ads) {
    return (
      <div>
        {/* Strategy summary */}
        {ads.summary && (
          <div className="p-5 rounded-xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#f8f9fc' }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: '#191654' }}>Campaign Strategy</h3>
            <p className="text-sm mb-1" style={{ color: '#4b5563' }}>{ads.summary.strategy}</p>
            {ads.summary.primaryAngle && (
              <p className="text-xs mt-2" style={{ color: '#6b7280' }}>
                <strong>Primary angle:</strong> {ads.summary.primaryAngle}
              </p>
            )}
            {ads.summary.keyDifferentiator && (
              <p className="text-xs" style={{ color: '#6b7280' }}>
                <strong>Key differentiator:</strong> {ads.summary.keyDifferentiator}
              </p>
            )}
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: '#e5e7eb' }}>
          {[
            { key: 'google' as const, label: 'Google Ads', show: !!ads.googleSearchAds },
            { key: 'meta' as const, label: 'Meta Ads', show: !!ads.metaAds },
            { key: 'linkedin' as const, label: 'LinkedIn Ads', show: !!ads.linkedInAds },
            { key: 'strategy' as const, label: 'Cross-Platform', show: !!ads.crossPlatformStrategy },
          ].filter(t => t.show).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
              style={{
                borderColor: activeTab === tab.key ? '#43C6AC' : 'transparent',
                color: activeTab === tab.key ? '#191654' : '#6b7280',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Google Ads tab */}
        {activeTab === 'google' && ads.googleSearchAds && (
          <div className="space-y-6">
            {ads.googleSearchAds.headlines && ads.googleSearchAds.headlines.length > 0 && (
              <AdSection title="Headlines">
                {ads.googleSearchAds.headlines.map((h, i) => (
                  <AdCard key={i} text={h.text} meta={`${h.charCount} chars | ${h.angle}`} />
                ))}
              </AdSection>
            )}
            {ads.googleSearchAds.descriptions && ads.googleSearchAds.descriptions.length > 0 && (
              <AdSection title="Descriptions">
                {ads.googleSearchAds.descriptions.map((d, i) => (
                  <AdCard key={i} text={d.text} meta={`${d.charCount} chars`} />
                ))}
              </AdSection>
            )}
            {ads.googleSearchAds.adVariations && ads.googleSearchAds.adVariations.length > 0 && (
              <AdSection title="Ad Variations">
                {ads.googleSearchAds.adVariations.map((v, i) => (
                  <div key={i} className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold" style={{ color: '#191654' }}>{v.name}</h4>
                      <CopyButton text={`${v.headlines.join('\n')}\n\n${v.descriptions.join('\n')}`} />
                    </div>
                    <div className="space-y-1">
                      {v.headlines.map((h, j) => (
                        <p key={j} className="text-sm font-medium" style={{ color: '#43C6AC' }}>{h}</p>
                      ))}
                      {v.descriptions.map((d, j) => (
                        <p key={j} className="text-sm" style={{ color: '#4b5563' }}>{d}</p>
                      ))}
                    </div>
                    {v.notes && <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>{v.notes}</p>}
                  </div>
                ))}
              </AdSection>
            )}
            {ads.googleSearchAds.negativeKeywords && ads.googleSearchAds.negativeKeywords.length > 0 && (
              <AdSection title="Negative Keywords">
                <div className="flex flex-wrap gap-2">
                  {ads.googleSearchAds.negativeKeywords.map((kw, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                      {kw}
                    </span>
                  ))}
                </div>
              </AdSection>
            )}
          </div>
        )}

        {/* Meta Ads tab */}
        {activeTab === 'meta' && ads.metaAds && (
          <div className="space-y-6">
            {ads.metaAds.adSets && ads.metaAds.adSets.length > 0 && (
              <AdSection title="Ad Sets">
                {ads.metaAds.adSets.map((set, i) => (
                  <div key={i} className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold" style={{ color: '#191654' }}>{set.name}</h4>
                      <CopyButton text={`${set.primaryText}\n\n${set.headline}\n${set.description}`} />
                    </div>
                    <p className="text-sm mb-1" style={{ color: '#4b5563' }}>{set.primaryText}</p>
                    <p className="text-sm font-medium" style={{ color: '#43C6AC' }}>{set.headline}</p>
                    <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{set.description}</p>
                    <div className="flex gap-3 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}>CTA: {set.cta}</span>
                    </div>
                    {set.targetingNotes && <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>{set.targetingNotes}</p>}
                  </div>
                ))}
              </AdSection>
            )}
            {ads.metaAds.primaryTexts && ads.metaAds.primaryTexts.length > 0 && (
              <AdSection title="Primary Texts">
                {ads.metaAds.primaryTexts.map((pt, i) => (
                  <AdCard key={i} text={pt.text} meta={`${pt.charCount} chars | Hook: ${pt.hook}`} />
                ))}
              </AdSection>
            )}
            {ads.metaAds.audienceTargeting && (
              <AdSection title="Audience Targeting">
                <div className="p-4 rounded-xl border space-y-2" style={{ borderColor: '#e5e7eb' }}>
                  {ads.metaAds.audienceTargeting.coreAudiences && ads.metaAds.audienceTargeting.coreAudiences.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#191654' }}>Core Audiences</p>
                      <div className="flex flex-wrap gap-1">
                        {ads.metaAds.audienceTargeting.coreAudiences.map((a, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {ads.metaAds.audienceTargeting.interests && ads.metaAds.audienceTargeting.interests.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#191654' }}>Interests</p>
                      <div className="flex flex-wrap gap-1">
                        {ads.metaAds.audienceTargeting.interests.map((a, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AdSection>
            )}
          </div>
        )}

        {/* LinkedIn Ads tab */}
        {activeTab === 'linkedin' && ads.linkedInAds && (
          <div className="space-y-6">
            {ads.linkedInAds.sponsoredContent && ads.linkedInAds.sponsoredContent.length > 0 && (
              <AdSection title="Sponsored Content">
                {ads.linkedInAds.sponsoredContent.map((sc, i) => (
                  <div key={i} className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold" style={{ color: '#191654' }}>Ad {i + 1}</h4>
                      <CopyButton text={`${sc.introText}\n\n${sc.headline}\n${sc.description}`} />
                    </div>
                    <p className="text-sm mb-1" style={{ color: '#4b5563' }}>{sc.introText}</p>
                    <p className="text-sm font-medium" style={{ color: '#43C6AC' }}>{sc.headline}</p>
                    <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{sc.description}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full mt-2 inline-block" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}>CTA: {sc.cta}</span>
                  </div>
                ))}
              </AdSection>
            )}
            {ads.linkedInAds.targeting && (
              <AdSection title="Targeting">
                <div className="p-4 rounded-xl border space-y-2" style={{ borderColor: '#e5e7eb' }}>
                  {ads.linkedInAds.targeting.jobTitles && ads.linkedInAds.targeting.jobTitles.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#191654' }}>Job Titles</p>
                      <div className="flex flex-wrap gap-1">
                        {ads.linkedInAds.targeting.jobTitles.map((t, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {ads.linkedInAds.targeting.industries && ads.linkedInAds.targeting.industries.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#191654' }}>Industries</p>
                      <div className="flex flex-wrap gap-1">
                        {ads.linkedInAds.targeting.industries.map((ind, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}>{ind}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AdSection>
            )}
          </div>
        )}

        {/* Cross-Platform Strategy tab */}
        {activeTab === 'strategy' && ads.crossPlatformStrategy && (
          <div className="space-y-4">
            {ads.crossPlatformStrategy.funnelApproach && (
              <div className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
                <h4 className="text-sm font-semibold mb-1" style={{ color: '#191654' }}>Funnel Approach</h4>
                <p className="text-sm" style={{ color: '#4b5563' }}>{ads.crossPlatformStrategy.funnelApproach}</p>
              </div>
            )}
            {ads.crossPlatformStrategy.budgetAllocation && (
              <div className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
                <h4 className="text-sm font-semibold mb-1" style={{ color: '#191654' }}>Budget Allocation</h4>
                <p className="text-sm" style={{ color: '#4b5563' }}>{ads.crossPlatformStrategy.budgetAllocation}</p>
              </div>
            )}
            {ads.crossPlatformStrategy.testingRecommendations && ads.crossPlatformStrategy.testingRecommendations.length > 0 && (
              <div className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
                <h4 className="text-sm font-semibold mb-1" style={{ color: '#191654' }}>Testing Recommendations</h4>
                <ul className="space-y-1">
                  {ads.crossPlatformStrategy.testingRecommendations.map((rec, i) => (
                    <li key={i} className="text-sm" style={{ color: '#4b5563' }}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Feedback + Regenerate */}
        <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{ borderColor: '#e5e7eb' }}>
          <button
            onClick={() => setView('form')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#e5e7eb', color: '#4b5563', background: 'white', cursor: 'pointer' }}
          >
            <RefreshCw size={14} /> Regenerate with new settings
          </button>

          {!feedbackSent ? (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#9ca3af' }}>Rate this output:</span>
              <button
                onClick={() => handleFeedback(5, 'Useful')}
                className="p-1.5 rounded-lg border hover:bg-green-50"
                style={{ borderColor: '#e5e7eb', background: 'white', cursor: 'pointer' }}
              >
                <ThumbsUp size={14} style={{ color: '#22c55e' }} />
              </button>
              <button
                onClick={() => handleFeedback(1, 'Not useful')}
                className="p-1.5 rounded-lg border hover:bg-red-50"
                style={{ borderColor: '#e5e7eb', background: 'white', cursor: 'pointer' }}
              >
                <ThumbsDown size={14} style={{ color: '#ef4444' }} />
              </button>
            </div>
          ) : (
            <span className="text-xs" style={{ color: '#43C6AC' }}>Thanks for your feedback!</span>
          )}
        </div>
      </div>
    )
  }

  // Form view
  return (
    <div>
      {error && (
        <div className="p-3 rounded-xl border mb-4" style={{ borderColor: '#fca5a5', backgroundColor: '#fff5f5' }}>
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleGenerate() }} className="space-y-6">
        {/* Goal */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#191654' }}>
            What&apos;s your primary ad campaign goal? *
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Generate qualified leads for our consulting service..."
            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none resize-none"
            style={{ borderColor: '#e5e7eb', minHeight: 80 }}
            rows={3}
          />
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#191654' }}>
            Which platforms? *
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => togglePlatform(opt.value)}
                className="px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                style={{
                  borderColor: platforms.includes(opt.value) ? '#43C6AC' : '#e5e7eb',
                  backgroundColor: platforms.includes(opt.value) ? 'rgba(67,198,172,0.08)' : 'white',
                  color: platforms.includes(opt.value) ? '#191654' : '#6b7280',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#191654' }}>
            Monthly ad budget range *
          </label>
          <select
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
            style={{ borderColor: '#e5e7eb', color: budget ? '#191654' : '#9ca3af' }}
          >
            <option value="">Select budget range</option>
            {BUDGET_OPTIONS.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Tone */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#191654' }}>
            Brand tone *
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
            style={{ borderColor: '#e5e7eb', color: tone ? '#191654' : '#9ca3af' }}
          >
            <option value="">Select brand tone</option>
            {TONE_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Previous attempts */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#191654' }}>
            What have you tried before that didn&apos;t work?
          </label>
          <textarea
            value={previousAttempts}
            onChange={(e) => setPreviousAttempts(e.target.value)}
            placeholder="Optional — describe past ad campaigns and what didn't resonate..."
            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none resize-none"
            style={{ borderColor: '#e5e7eb', minHeight: 60 }}
            rows={2}
          />
        </div>

        {/* Competitors */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#191654' }}>
            Competitors to research (optional)
          </label>
          <div className="space-y-2">
            {competitors.map((comp, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={comp.name}
                  onChange={(e) => updateCompetitor(idx, 'name', e.target.value)}
                  placeholder="Company name"
                  className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: '#e5e7eb' }}
                />
                <input
                  type="text"
                  value={comp.website}
                  onChange={(e) => updateCompetitor(idx, 'website', e.target.value)}
                  placeholder="Website URL"
                  className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: '#e5e7eb' }}
                />
                {competitors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCompetitor(idx)}
                    className="text-xs px-2 rounded-lg border"
                    style={{ borderColor: '#e5e7eb', color: '#9ca3af', background: 'white', cursor: 'pointer' }}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          {competitors.length < 5 && (
            <button
              type="button"
              onClick={addCompetitor}
              className="text-xs mt-2 font-medium"
              style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              + Add competitor
            </button>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-3 rounded-xl font-semibold text-white text-sm"
          style={{ backgroundColor: '#43C6AC', cursor: 'pointer' }}
        >
          Generate Ad Library
        </button>
      </form>
    </div>
  )
}

function AdSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3" style={{ color: '#191654' }}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function AdCard({ text, meta }: { text: string; meta: string }) {
  return (
    <div className="p-3 rounded-xl border flex items-start justify-between gap-3" style={{ borderColor: '#e5e7eb' }}>
      <div className="flex-1">
        <p className="text-sm" style={{ color: '#191654' }}>{text}</p>
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{meta}</p>
      </div>
      <CopyButton text={text} />
    </div>
  )
}
