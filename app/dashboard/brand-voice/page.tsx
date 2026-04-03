'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wand2, Loader, CheckCircle, ChevronDown, ChevronUp,
  X, Sparkles, Target, Share2, Mail
} from 'lucide-react'

interface GlobalPreferences {
  brandVoice: string
  alwaysInclude: string[]
  neverInclude: string[]
  writingStyle: string[]
  customSummary: string
  summaryGeneratedAt?: string
  updatedAt?: string
}

interface AgentPreferences {
  instructions: string
  alwaysInclude: string[]
  neverInclude: string[]
  updatedAt?: string
}

interface AllPreferences {
  global?: GlobalPreferences
  signal_ads?: Record<string, AgentPreferences>
  signal_content?: Record<string, AgentPreferences>
  signal_sequences?: Record<string, AgentPreferences>
}

const WRITING_STYLE_OPTIONS = [
  'Short sentences',
  'Active voice',
  'First person',
  'Data-driven',
  'Story-led',
  'Direct response',
  'Conversational',
  'Professional',
  'Empathetic',
  'Bold and direct',
]

const BRAND_VOICE_OPTIONS = [
  'Formal and authoritative',
  'Professional but approachable',
  'Conversational and warm',
  'Bold and direct',
  'Empathetic and supportive',
  'Educational and expert',
]

const AGENT_CONFIG = [
  {
    key: 'signal_ads' as const,
    agentKey: 'jaimie' as const,
    name: 'Jaimie',
    module: 'SignalAds',
    icon: Target,
    color: '#ef4444',
    placeholder: 'e.g. Always lead with the problem not the solution. Never use the word "best". Headlines should feel urgent not clever.',
  },
  {
    key: 'signal_content' as const,
    agentKey: 'sofia' as const,
    name: 'Sofia',
    module: 'SignalContent',
    icon: Share2,
    color: '#8b5cf6',
    placeholder: 'e.g. Instagram captions should always start with a hook question. LinkedIn posts should be written in first person from the owner.',
  },
  {
    key: 'signal_sequences' as const,
    agentKey: 'emily' as const,
    name: 'Emily',
    module: 'SignalSequences',
    icon: Mail,
    color: '#43C6AC',
    placeholder: 'e.g. Emails are always signed from the owner personally. Subject lines should never exceed 7 words. CTAs should always offer a free consultation.',
  },
]

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(value: string) {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag))
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border cursor-text min-h-10"
      style={{ borderColor: '#e5e7eb' }}
      onClick={() => inputRef.current?.focus()}>
      {tags.map(tag => (
        <span key={tag}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium"
          style={{ backgroundColor: 'rgba(25,22,84,0.07)', color: '#191654' }}>
          {tag}
          <button onClick={() => removeTag(tag)} className="hover:opacity-70">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input) }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 text-xs outline-none bg-transparent min-w-24"
        style={{ color: '#374151' }}
      />
    </div>
  )
}

function AgentInstructionsCard({
  config,
  prefs,
  businessId,
}: {
  config: typeof AGENT_CONFIG[0]
  prefs: AgentPreferences
  businessId: string
}) {
  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState(prefs.instructions || '')
  const [alwaysInclude, setAlwaysInclude] = useState<string[]>(prefs.alwaysInclude || [])
  const [neverInclude, setNeverInclude] = useState<string[]>(prefs.neverInclude || [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const Icon = config.icon

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/brand-voice/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        scope: 'agent',
        agentKey: `${config.key}.${config.agentKey}`,
        data: { instructions, alwaysInclude, neverInclude },
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const hasContent = instructions || alwaysInclude.length > 0 || neverInclude.length > 0

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${config.color}15` }}>
            <Icon size={16} style={{ color: config.color }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold" style={{ color: '#191654' }}>{config.name}</p>
              <span className="text-xs px-2 py-0.5 rounded-md"
                style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                {config.module}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              {hasContent ? 'Instructions set' : 'No instructions yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
          )}
          {open
            ? <ChevronUp size={15} style={{ color: '#9ca3af' }} />
            : <ChevronDown size={15} style={{ color: '#9ca3af' }} />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: '#f3f4f6' }}>
          <div className="pt-4">
            <label className="block text-xs font-bold mb-1.5" style={{ color: '#374151' }}>
              Instructions for {config.name}
              <span className="font-normal text-gray-400 ml-1">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder={config.placeholder}
              className="w-full text-xs px-3 py-2.5 rounded-lg border outline-none resize-none"
              style={{ borderColor: '#e5e7eb', color: '#374151', lineHeight: '1.6' }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: '#374151' }}>
              Always include
              <span className="font-normal text-gray-400 ml-1">(press Enter to add)</span>
            </label>
            <TagInput
              tags={alwaysInclude}
              onChange={setAlwaysInclude}
              placeholder="e.g. free consultation, 20 years experience\u2026"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: '#374151' }}>
              Never include
              <span className="font-normal text-gray-400 ml-1">(press Enter to add)</span>
            </label>
            <TagInput
              tags={neverInclude}
              onChange={setNeverInclude}
              placeholder="e.g. discount, cheap, guaranteed\u2026"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {saved && (
              <span className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: '#43C6AC' }}>
                <CheckCircle size={13} /> Saved
              </span>
            )}
            {!saved && <div />}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40"
              style={{ backgroundColor: config.color }}>
              {saving ? <Loader size={13} className="animate-spin" /> : null}
              {saving ? 'Saving\u2026' : `Save ${config.name}\u2019s instructions`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BrandVoicePage() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<AllPreferences>({})

  const [brandVoice, setBrandVoice] = useState('')
  const [brandVoiceCustom, setBrandVoiceCustom] = useState('')
  const [alwaysInclude, setAlwaysInclude] = useState<string[]>([])
  const [neverInclude, setNeverInclude] = useState<string[]>([])
  const [writingStyle, setWritingStyle] = useState<string[]>([])
  const [customSummary, setCustomSummary] = useState('')

  const [globalSaving, setGlobalSaving] = useState(false)
  const [globalSaved, setGlobalSaved] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [summaryGenerated, setSummaryGenerated] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('signalshot_active_business')
    if (!id) { router.push('/dashboard'); return }
    setBusinessId(id)

    fetch(`/api/brand-voice/load?businessId=${id}`)
      .then(r => r.json())
      .then(json => {
        const data = json.data?.preferences as AllPreferences || {}
        setPrefs(data)
        const global = data.global
        if (global) {
          setBrandVoice(global.brandVoice || '')
          setAlwaysInclude(global.alwaysInclude || [])
          setNeverInclude(global.neverInclude || [])
          setWritingStyle(global.writingStyle || [])
          setCustomSummary(global.customSummary || '')
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [router])

  function toggleWritingStyle(style: string) {
    setWritingStyle(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    )
  }

  async function handleGenerateSummary() {
    if (!businessId) return
    setGeneratingSummary(true)
    setSummaryGenerated(false)
    try {
      const res = await fetch('/api/brand-voice/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          brandVoice: brandVoiceCustom || brandVoice,
          alwaysInclude,
          neverInclude,
          writingStyle,
        }),
      })
      const json = await res.json()
      if (res.ok && json.data?.summary) {
        setCustomSummary(json.data.summary)
        setSummaryGenerated(true)
      }
    } catch { /* non-fatal */ }
    setGeneratingSummary(false)
  }

  async function handleGlobalSave() {
    if (!businessId) return
    setGlobalSaving(true)
    setGlobalSaved(false)
    await fetch('/api/brand-voice/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        scope: 'global',
        data: {
          brandVoice: brandVoiceCustom || brandVoice,
          alwaysInclude,
          neverInclude,
          writingStyle,
          customSummary,
          summaryGeneratedAt: summaryGenerated ? new Date().toISOString() : undefined,
        },
      }),
    })
    setGlobalSaving(false)
    setGlobalSaved(true)
    setTimeout(() => setGlobalSaved(false), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center">
        <Loader size={18} className="animate-spin" style={{ color: '#43C6AC' }} />
        <p className="text-sm" style={{ color: '#9ca3af' }}>Loading your brand voice\u2026</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl space-y-8">

      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: '#191654' }}>
          <Wand2 size={22} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            Brand Voice
          </h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Define how your business sounds. Every agent reads this before they write anything.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: '#e5e7eb' }}>
          <p className="text-xs font-bold tracking-widest" style={{ color: '#43C6AC' }}>
            GLOBAL BRAND INSTRUCTIONS
          </p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            \u2014 applies to all agents
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>
            Brand Voice
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {BRAND_VOICE_OPTIONS.map(opt => (
              <button key={opt}
                onClick={() => setBrandVoice(opt)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  borderColor: brandVoice === opt ? '#43C6AC' : '#e5e7eb',
                  backgroundColor: brandVoice === opt ? 'rgba(67,198,172,0.1)' : '#fff',
                  color: brandVoice === opt ? '#191654' : '#6b7280',
                }}>
                {opt}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={brandVoiceCustom}
            onChange={e => setBrandVoiceCustom(e.target.value)}
            placeholder="Describe your brand voice in your own words\u2026 e.g. We are direct and confident but never arrogant. We speak like a trusted expert, not a salesperson."
            className="w-full text-xs px-3 py-2.5 rounded-lg border outline-none resize-none"
            style={{ borderColor: '#e5e7eb', color: '#374151', lineHeight: '1.6' }}
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>
            Writing Style
            <span className="font-normal text-gray-400 ml-1">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {WRITING_STYLE_OPTIONS.map(style => (
              <button key={style}
                onClick={() => toggleWritingStyle(style)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  borderColor: writingStyle.includes(style) ? '#191654' : '#e5e7eb',
                  backgroundColor: writingStyle.includes(style) ? 'rgba(25,22,84,0.08)' : '#fff',
                  color: writingStyle.includes(style) ? '#191654' : '#6b7280',
                }}>
                {style}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: '#374151' }}>
            Always Include
            <span className="font-normal text-gray-400 ml-1">
              \u2014 press Enter to add each item
            </span>
          </label>
          <p className="text-xs mb-2" style={{ color: '#9ca3af' }}>
            Things every agent should reference \u2014 credentials, offers, proof points.
          </p>
          <TagInput
            tags={alwaysInclude}
            onChange={setAlwaysInclude}
            placeholder="e.g. 20 years experience, free consultation, Metro Atlanta\u2026"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: '#374151' }}>
            Never Include
            <span className="font-normal text-gray-400 ml-1">
              \u2014 press Enter to add each item
            </span>
          </label>
          <p className="text-xs mb-2" style={{ color: '#9ca3af' }}>
            Words, phrases, or angles every agent must avoid.
          </p>
          <TagInput
            tags={neverInclude}
            onChange={setNeverInclude}
            placeholder="e.g. cheap, discount, guaranteed, best in class\u2026"
          />
        </div>

        <div className="p-5 rounded-2xl space-y-3"
          style={{ border: '1px solid rgba(67,198,172,0.25)', backgroundColor: 'rgba(67,198,172,0.03)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold" style={{ color: '#43C6AC' }}>BRAND SUMMARY</p>
              <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                A synthesized paragraph every agent reads as their brief.
                Generate it from your inputs above, then edit freely.
              </p>
            </div>
            <button
              onClick={handleGenerateSummary}
              disabled={generatingSummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 flex-shrink-0 ml-3"
              style={{ backgroundColor: '#191654', color: '#fff' }}>
              {generatingSummary
                ? <Loader size={12} className="animate-spin" />
                : <Sparkles size={12} />}
              {generatingSummary ? 'Generating\u2026' : summaryGenerated ? 'Regenerate' : 'Generate summary'}
            </button>
          </div>
          <textarea
            rows={4}
            value={customSummary}
            onChange={e => setCustomSummary(e.target.value)}
            placeholder="Click &apos;Generate summary&apos; to create a brand brief from your inputs above, or write your own here\u2026"
            className="w-full text-xs px-3 py-2.5 rounded-lg border outline-none resize-none"
            style={{ borderColor: 'rgba(67,198,172,0.3)', color: '#374151', lineHeight: '1.7', backgroundColor: '#fff' }}
          />
        </div>

        <div className="flex items-center justify-between">
          {globalSaved && (
            <span className="flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: '#43C6AC' }}>
              <CheckCircle size={13} /> Global brand instructions saved
            </span>
          )}
          {!globalSaved && <div />}
          <button
            onClick={handleGlobalSave}
            disabled={globalSaving}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40"
            style={{ backgroundColor: '#191654' }}>
            {globalSaving ? <Loader size={14} className="animate-spin" /> : null}
            {globalSaving ? 'Saving\u2026' : 'Save brand instructions'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: '#e5e7eb' }}>
          <p className="text-xs font-bold tracking-widest" style={{ color: '#9ca3af' }}>
            AGENT-SPECIFIC INSTRUCTIONS
          </p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            \u2014 overrides global for that agent only
          </p>
        </div>
        <p className="text-xs" style={{ color: '#9ca3af' }}>
          Give each specialist additional rules that apply only to their module.
          These stack on top of your global brand instructions.
        </p>
        {AGENT_CONFIG.map(config => (
          <AgentInstructionsCard
            key={config.key}
            config={config}
            prefs={
              (prefs[config.key]?.[config.agentKey] as AgentPreferences) || {
                instructions: '',
                alwaysInclude: [],
                neverInclude: [],
              }
            }
            businessId={businessId || ''}
          />
        ))}
      </div>

    </div>
  )
}
