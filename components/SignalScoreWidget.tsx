'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock } from 'lucide-react'

interface SignalScoreWidgetProps {
  businessId: string
  compact?: boolean
}

interface ScoreData {
  total: number
  foundation: number
  messaging: number
  competitive: number
  content: number
  ads: number
  calculated_at?: string
}

function getScoreColor(score: number): string {
  if (score <= 40) return '#ef4444'
  if (score <= 65) return '#f59e0b'
  return '#43C6AC'
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-24 text-right flex-shrink-0" style={{ color: '#6b7280' }}>
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: '#e5e7eb' }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(score, 100)}%`, backgroundColor: getScoreColor(score) }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right" style={{ color: '#374151' }}>
        {score}
      </span>
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export default function SignalScoreWidget({ businessId, compact }: SignalScoreWidgetProps) {
  const [score, setScore] = useState<ScoreData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!businessId) { setLoading(false); return }
      const supabase = createClient()

      // Try signal_scores table first (most accurate)
      const { data: latestScore } = await supabase
        .from('signal_scores')
        .select('*')
        .eq('business_id', businessId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestScore) {
        setScore({
          total: latestScore.score_total,
          foundation: latestScore.score_foundation,
          messaging: latestScore.score_messaging,
          competitive: latestScore.score_competitive,
          content: latestScore.score_content,
          ads: latestScore.score_ads,
          calculated_at: latestScore.calculated_at,
        })
        setLoading(false)
        return
      }

      // Fall back to business.signal_score jsonb
      const { data } = await supabase
        .from('businesses')
        .select('signal_score')
        .eq('id', businessId)
        .single()

      if (data?.signal_score) {
        setScore(data.signal_score as ScoreData)
      }
      setLoading(false)
    }
    load()
  }, [businessId])

  if (loading) return null

  if (!score) {
    return (
      <div
        className="p-5 rounded-xl border mb-6 text-center"
        style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}
      >
        <Lock size={24} className="mx-auto mb-2" style={{ color: '#d1d5db' }} />
        <p className="text-sm font-medium" style={{ color: '#6b7280' }}>
          Complete your SignalMap interview to unlock your Signal Score
        </p>
      </div>
    )
  }

  const color = getScoreColor(score.total)

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${score.total}, 100`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: '#191654' }}>{score.total}</span>
        </div>
        <span className="text-xs font-medium" style={{ color: '#6b7280' }}>Signal Score</span>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
      <div className="flex items-center gap-4 mb-5">
        <div>
          <span className="text-4xl font-bold" style={{ color: '#191654' }}>{score.total}</span>
          <span className="text-lg" style={{ color: '#9ca3af' }}>/100</span>
          {score.total >= 81 && (
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(67,198,172,0.15)', color: '#43C6AC' }}>
              Strong
            </span>
          )}
        </div>
        <span className="text-sm font-semibold" style={{ color: '#191654' }}>Signal Score</span>
      </div>
      <div className="space-y-3">
        <ScoreBar label="Foundation" score={score.foundation} />
        <ScoreBar label="Messaging" score={score.messaging} />
        <ScoreBar label="Competitive" score={score.competitive} />
        <ScoreBar label="Content" score={score.content} />
        <ScoreBar label="Ads Ready" score={score.ads} />
      </div>
      {score.calculated_at && (
        <p className="text-xs mt-4" style={{ color: '#9ca3af' }}>Last updated: {formatRelativeTime(score.calculated_at)}</p>
      )}
    </div>
  )
}
