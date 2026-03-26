'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Loader, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

interface ExtractedData {
  extracted_phrases?: string[]
  outcome_language?: string[]
  emotional_language?: string[]
  problem_language?: string[]
  top_phrases?: string[]
  copy_themes?: string[]
  social_proof_statements?: string[]
}

interface VocEntry {
  id: string
  source: string
  created_at: string
  top_phrases: string[] | null
  extracted_phrases: string[] | null
  outcome_language: string[] | null
  emotional_language: string[] | null
  problem_language: string[] | null
  raw_reviews: Array<{ text: string; rating: number; authorName: string }> | null
}

const SOURCES = [
  { key: 'google_reviews', label: 'Google Reviews', icon: '⭐', prompt: 'Paste your Google reviews here — especially ones that mention specific results, timelines, or what made you different from competitors.', placeholder: 'Paste 3-10 Google reviews here. Include the reviewer name and star rating if possible.' },
  { key: 'facebook_reviews', label: 'Facebook Reviews', icon: '👍', prompt: 'Paste Facebook reviews or recommendations here.', placeholder: 'Paste Facebook reviews or recommendations here.' },
  { key: 'email_testimonials', label: 'Email Replies', icon: '✉️', prompt: 'Paste replies from happy customers — emails, texts, or DMs where they described their results.', placeholder: 'Paste customer emails, text messages, or DMs here. These are often your most authentic voice of customer data.' },
  { key: 'case_studies', label: 'Case Studies', icon: '📋', prompt: 'Paste any before/after stories, success stories, or detailed case study language here.', placeholder: 'Paste case study content, success stories, or detailed testimonials here.' },
  { key: 'other', label: 'Other', icon: '💬', prompt: 'Paste any other customer feedback — directory reviews, contractor site reviews, press quotes, etc.', placeholder: 'Paste any other customer feedback here.' },
]

const SOURCE_BADGE_STYLES: Record<string, { label: string; color: string }> = {
  google_reviews: { label: 'Google', color: '#4285f4' },
  google_places_api: { label: 'Google API', color: '#43C6AC' },
  facebook_reviews: { label: 'Facebook', color: '#1877f2' },
  email_testimonials: { label: 'Email', color: '#6366f1' },
  case_studies: { label: 'Case Study', color: '#f59e0b' },
  other: { label: 'Other', color: '#9ca3af' },
  web_search: { label: 'Web Search', color: '#374151' },
  testimonials: { label: 'Testimonials', color: '#6366f1' },
  email_replies: { label: 'Email', color: '#6366f1' },
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
    >
      {copied ? <Check size={14} style={{ color: '#43C6AC' }} /> : <Copy size={14} style={{ color: '#9ca3af' }} />}
    </button>
  )
}

export default function VoiceOfCustomerPage() {
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [activeSource, setActiveSource] = useState(SOURCES[0].key)
  const [sourceUrl, setSourceUrl] = useState('')
  const [rawText, setRawText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [history, setHistory] = useState<VocEntry[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rawReviews, setRawReviews] = useState<Array<{ text: string; rating: number; authorName: string }>>([])
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const bizId = localStorage.getItem('signalshot_active_business')
      if (!bizId) { router.push('/dashboard'); return }
      setBusinessId(bizId)

      const { data: vocData } = await supabase
        .from('voice_of_customer')
        .select('id, source, created_at, top_phrases, extracted_phrases, outcome_language, emotional_language, problem_language, raw_reviews')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false })

      if (vocData) {
        setHistory(vocData as VocEntry[])
        const withReviews = (vocData as VocEntry[]).find(v => v.raw_reviews && v.raw_reviews.length > 0)
        if (withReviews?.raw_reviews) setRawReviews(withReviews.raw_reviews)
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSubmit() {
    if (!businessId || !rawText.trim()) return
    setSubmitting(true)
    setExtracted(null)
    try {
      const res = await fetch('/api/voc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, source: activeSource, sourceUrl: sourceUrl.trim() || undefined, rawText: rawText.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setExtracted(data.data?.extracted || data.extracted || null)
        const supabase = createClient()
        const { data: vocData } = await supabase
          .from('voice_of_customer')
          .select('id, source, created_at, top_phrases, extracted_phrases, outcome_language, emotional_language, problem_language, raw_reviews')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
        if (vocData) setHistory(vocData as VocEntry[])
      }
    } catch { /* Non-fatal */ } finally { setSubmitting(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader size={32} className="animate-spin" style={{ color: '#43C6AC' }} /></div>
  }

  const totalPhrases = history.reduce((sum, e) => sum + (e.extracted_phrases?.length || 0), 0)
  const currentSource = SOURCES.find(s => s.key === activeSource)!

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
          <MessageSquare size={26} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>CustomerSignals</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>Your customers are sending signals. Here&apos;s what they&apos;re saying.</p>
        </div>
      </div>

      {/* Intro card */}
      <div className="p-5 rounded-xl mb-6" style={{ backgroundColor: '#191654' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
          The most converting marketing copy comes directly from your customers&apos; words. Paste in Google reviews, testimonials, or email replies and SignalShot will extract the exact phrases that resonate — then use them to make every module smarter.
        </p>
      </div>

      {/* Input section */}
      <div className="p-6 rounded-xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        {/* Source tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {SOURCES.map((s) => (
            <button key={s.key} type="button" onClick={() => setActiveSource(s.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
              style={{ backgroundColor: activeSource === s.key ? '#191654' : '#f3f4f6', color: activeSource === s.key ? '#ffffff' : '#6b7280' }}
            >
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>

        {/* Source prompt */}
        <div className="p-3 rounded-xl mb-3" style={{ backgroundColor: 'rgba(67,198,172,0.06)', border: '1px solid rgba(67,198,172,0.15)' }}>
          <p className="text-xs" style={{ color: '#374151' }}>💡 {currentSource.prompt}</p>
        </div>

        <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Link to source page (optional)"
          className="w-full px-3 py-2.5 rounded-lg border text-sm mb-4 outline-none" style={{ borderColor: '#e5e7eb' }}
        />

        <textarea value={rawText} onChange={(e) => setRawText(e.target.value)}
          placeholder={currentSource.placeholder}
          className="w-full px-3 py-3 rounded-lg border text-sm outline-none resize-y"
          style={{ borderColor: '#e5e7eb', minHeight: '200px' }}
        />

        <button onClick={handleSubmit} disabled={submitting || rawText.trim().length < 50}
          className="w-full mt-4 py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
          style={{ backgroundColor: '#43C6AC' }}
        >
          {submitting ? 'Analyzing your customers\' words...' : 'Extract Marketing Language'}
        </button>
      </div>

      {/* Extracted results */}
      {extracted && (
        <div className="space-y-4 mb-8">
          {extracted.extracted_phrases && extracted.extracted_phrases.length > 0 && (
            <div className="p-5 rounded-xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#191654' }}>Phrases Worth Using in Ads</h3>
              <div className="space-y-2">
                {extracted.extracted_phrases.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm" style={{ color: '#374151' }}>
                    <span>&ldquo;{p}&rdquo;</span>
                    <CopyButton text={p} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {extracted.outcome_language && extracted.outcome_language.length > 0 && (
            <div className="p-5 rounded-xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#191654' }}>How Customers Describe the Outcome</h3>
              {extracted.outcome_language.map((p, i) => <p key={i} className="text-sm mb-1" style={{ color: '#374151' }}>{p}</p>)}
            </div>
          )}
          {extracted.emotional_language && extracted.emotional_language.length > 0 && (
            <div className="p-5 rounded-xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#191654' }}>The Emotional Language They Use</h3>
              {extracted.emotional_language.map((p, i) => <p key={i} className="text-sm mb-1" style={{ color: '#374151' }}>{p}</p>)}
            </div>
          )}
          {extracted.top_phrases && extracted.top_phrases.length > 0 && (
            <div className="p-5 rounded-xl border" style={{ borderColor: 'rgba(67,198,172,0.3)', backgroundColor: 'rgba(67,198,172,0.04)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#43C6AC' }}>Top Copy Phrases</h3>
              <div className="flex flex-wrap gap-2">
                {extracted.top_phrases.map((p, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(67,198,172,0.12)', color: '#191654' }}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Source Reviews */}
      {rawReviews.length > 0 && (
        <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>Source Reviews</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>{rawReviews.length} from Google</span>
          </div>
          <p className="text-xs mb-4" style={{ color: '#6b7280' }}>These are the actual reviews Alex analyzed to extract your CustomerSignals phrases.</p>
          <div className="space-y-4">
            {(showAllReviews ? rawReviews : rawReviews.slice(0, 2)).map((review, i) => (
              <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: '#f8f9fc' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#191654' }}>
                    {review.authorName[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#191654' }}>{review.authorName}</p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: review.rating }).map((_, j) => <span key={j} style={{ color: '#f59e0b', fontSize: 10 }}>★</span>)}
                    </div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>&ldquo;{review.text}&rdquo;</p>
              </div>
            ))}
          </div>
          {rawReviews.length > 2 && (
            <button onClick={() => setShowAllReviews(!showAllReviews)} className="mt-4 text-xs font-medium w-full text-center" style={{ color: '#43C6AC', background: 'none', border: 'none', cursor: 'pointer' }}>
              {showAllReviews ? 'Show less' : `Show all ${rawReviews.length} reviews`}
            </button>
          )}
        </div>
      )}

      {/* Impact meter */}
      {history.length > 0 && (
        <div className="p-4 rounded-xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
          <p className="text-sm" style={{ color: '#6b7280' }}>{history.length} {history.length === 1 ? 'source' : 'sources'} · {totalPhrases} phrases extracted</p>
        </div>
      )}

      {/* History section */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: '#9ca3af' }}>Previous Submissions</h2>
          <div className="space-y-3">
            {history.map((entry) => {
              const isExpanded = expandedId === entry.id
              const badge = SOURCE_BADGE_STYLES[entry.source] || { label: entry.source, color: '#9ca3af' }
              return (
                <div key={entry.id} className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: badge.color }}>{badge.label}</span>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>{new Date(entry.created_at).toLocaleDateString()}</span>
                      {entry.extracted_phrases && <span className="text-xs" style={{ color: '#6b7280' }}>{entry.extracted_phrases.length} phrases</span>}
                    </div>
                    {isExpanded ? <ChevronUp size={16} style={{ color: '#9ca3af' }} /> : <ChevronDown size={16} style={{ color: '#9ca3af' }} />}
                  </div>
                  {!isExpanded && entry.top_phrases && entry.top_phrases.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {entry.top_phrases.slice(0, 3).map((p, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#374151' }}>{p}</span>
                      ))}
                    </div>
                  )}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: '#f3f4f6' }}>
                      {entry.extracted_phrases && entry.extracted_phrases.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>Phrases</p>
                          {entry.extracted_phrases.map((p, i) => <p key={i} className="text-sm" style={{ color: '#374151' }}>&ldquo;{p}&rdquo;</p>)}
                        </div>
                      )}
                      {entry.outcome_language && entry.outcome_language.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>Outcome Language</p>
                          {entry.outcome_language.map((p, i) => <p key={i} className="text-sm" style={{ color: '#374151' }}>{p}</p>)}
                        </div>
                      )}
                      {entry.emotional_language && entry.emotional_language.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>Emotional Language</p>
                          {entry.emotional_language.map((p, i) => <p key={i} className="text-sm" style={{ color: '#374151' }}>{p}</p>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
