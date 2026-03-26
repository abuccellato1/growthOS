'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface SignalScoreWidgetProps {
  businessId: string
  compact?: boolean
}

interface DimensionData {
  visibility: number
  credibility: number
  clarity: number
  reach: number
  conversion: number
  total: number
  calculated_at?: string
}

const DIMENSIONS = [
  { key: 'visibility', label: 'Visibility', hint: 'Verify on Google · Improve your website' },
  { key: 'credibility', label: 'Credibility', hint: 'Get more reviews · Add to CustomerSignals' },
  { key: 'clarity', label: 'Clarity', hint: 'Complete your SignalMap Interview' },
  { key: 'reach', label: 'Reach', hint: 'Generate SignalAds · Create SignalContent' },
  { key: 'conversion', label: 'Conversion', hint: 'Build your SignalLaunch plan' },
] as const

function getScoreColor(score: number): string {
  if (score <= 30) return '#ef4444'
  if (score <= 55) return '#f59e0b'
  if (score <= 75) return '#43C6AC'
  return '#10b981'
}

function getScoreLabel(score: number): string {
  if (score <= 20) return 'Getting Started'
  if (score <= 40) return 'Building'
  if (score <= 60) return 'Developing'
  if (score <= 75) return 'Strong'
  if (score <= 90) return 'Advanced'
  return 'Elite'
}

function RadarChart({ scores, size = 200 }: { scores: DimensionData; size?: number }) {
  const center = size / 2
  const maxRadius = size * 0.38
  const levels = 4

  const angles = [-90, -90 + 72, -90 + 144, -90 + 216, -90 + 288].map(a => (a * Math.PI) / 180)

  const dimensionValues = [
    scores.visibility / 100,
    scores.credibility / 100,
    scores.clarity / 100,
    scores.reach / 100,
    scores.conversion / 100,
  ]

  function axisPoint(i: number, fraction: number) {
    return {
      x: center + Math.cos(angles[i]) * maxRadius * fraction,
      y: center + Math.sin(angles[i]) * maxRadius * fraction,
    }
  }

  function labelPoint(i: number) {
    const labelRadius = maxRadius + 18
    return {
      x: center + Math.cos(angles[i]) * labelRadius,
      y: center + Math.sin(angles[i]) * labelRadius,
    }
  }

  function gridPolygon(fraction: number): string {
    return angles.map((_, i) => { const p = axisPoint(i, fraction); return `${p.x},${p.y}` }).join(' ')
  }

  const scorePolygon = dimensionValues.map((v, i) => { const p = axisPoint(i, Math.max(v, 0.02)); return `${p.x},${p.y}` }).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {Array.from({ length: levels }).map((_, i) => (
        <polygon key={i} points={gridPolygon((i + 1) / levels)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
      ))}
      {angles.map((_, i) => {
        const outer = axisPoint(i, 1)
        return <line key={i} x1={center} y1={center} x2={outer.x} y2={outer.y} stroke="#e5e7eb" strokeWidth="1" />
      })}
      <polygon points={scorePolygon} fill="rgba(67,198,172,0.15)" stroke="#43C6AC" strokeWidth="2" strokeLinejoin="round" />
      {dimensionValues.map((v, i) => {
        const p = axisPoint(i, Math.max(v, 0.02))
        return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#43C6AC" stroke="white" strokeWidth="1.5" />
      })}
      {DIMENSIONS.map((dim, i) => {
        const lp = labelPoint(i)
        const value = Math.round(dimensionValues[i] * 100)
        const anchor = lp.x < center - 5 ? 'end' : lp.x > center + 5 ? 'start' : 'middle'
        return (
          <g key={i}>
            <text x={lp.x} y={lp.y - 4} textAnchor={anchor} fontSize="8" fontWeight="600" fill="#6b7280" fontFamily="DM Sans, sans-serif" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dim.label}</text>
            <text x={lp.x} y={lp.y + 8} textAnchor={anchor} fontSize="10" fontWeight="700" fill={getScoreColor(value)} fontFamily="DM Sans, sans-serif">{value}</text>
          </g>
        )
      })}
      <text x={center} y={center - 6} textAnchor="middle" fontSize="20" fontWeight="800" fill="#191654" fontFamily="DM Sans, sans-serif">{scores.total}</text>
      <text x={center} y={center + 10} textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="DM Sans, sans-serif" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Signal Score</text>
    </svg>
  )
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

export default function SignalScoreWidget({ businessId, compact }: SignalScoreWidgetProps) {
  const [scores, setScores] = useState<DimensionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!businessId) { setLoading(false); return }
      const supabase = createClient()

      const { data: latestScore } = await supabase
        .from('signal_scores').select('*')
        .eq('business_id', businessId)
        .order('calculated_at', { ascending: false })
        .limit(1).maybeSingle()

      if (latestScore) {
        setScores({
          visibility: latestScore.score_ads || 0,
          credibility: latestScore.score_messaging || 0,
          clarity: latestScore.score_foundation || 0,
          reach: latestScore.score_competitive || 0,
          conversion: latestScore.score_content || 0,
          total: latestScore.score_total || 0,
          calculated_at: latestScore.calculated_at,
        })
        setLoading(false)
        return
      }

      const { data } = await supabase.from('businesses').select('signal_score').eq('id', businessId).single()
      if (data?.signal_score) {
        const s = data.signal_score as Record<string, unknown>
        setScores({
          visibility: (s.visibility as number) || 0,
          credibility: (s.credibility as number) || 0,
          clarity: (s.clarity as number) || 0,
          reach: (s.reach as number) || 0,
          conversion: (s.conversion as number) || 0,
          total: (s.total as number) || 0,
          calculated_at: s.calculated_at as string,
        })
      }
      setLoading(false)
    }
    load()
  }, [businessId])

  if (loading) return null

  if (!scores || scores.total === 0) {
    return (
      <div className="p-6 rounded-2xl border mb-6 text-center" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
        <Lock size={28} className="mx-auto mb-3" style={{ color: '#d1d5db' }} />
        <p className="text-sm font-semibold mb-1" style={{ color: '#374151' }}>Your Signal Score is waiting</p>
        <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>Verify your business on Google to start building your score — no interview needed.</p>
        <Link href="/dashboard/business-signals" className="text-xs font-semibold" style={{ color: '#43C6AC' }}>Start building your score →</Link>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={getScoreColor(scores.total)} strokeWidth="3" strokeDasharray={`${scores.total}, 100`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: '#191654' }}>{scores.total}</span>
        </div>
        <span className="text-xs font-medium" style={{ color: '#6b7280' }}>Signal Score</span>
      </div>
    )
  }

  const scoreColor = getScoreColor(scores.total)
  const scoreLabel = getScoreLabel(scores.total)

  const dimensionValues = [
    { key: 'visibility', value: scores.visibility, dim: DIMENSIONS[0] },
    { key: 'credibility', value: scores.credibility, dim: DIMENSIONS[1] },
    { key: 'clarity', value: scores.clarity, dim: DIMENSIONS[2] },
    { key: 'reach', value: scores.reach, dim: DIMENSIONS[3] },
    { key: 'conversion', value: scores.conversion, dim: DIMENSIONS[4] },
  ]
  const weakest = [...dimensionValues].sort((a, b) => a.value - b.value)[0]

  return (
    <div className="p-6 rounded-2xl border mb-6" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>Signal Score</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-3xl font-bold" style={{ color: '#191654' }}>{scores.total}</span>
            <span className="text-sm" style={{ color: '#9ca3af' }}>/100</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${scoreColor}18`, color: scoreColor }}>{scoreLabel}</span>
          </div>
        </div>
        <TrendingUp size={20} style={{ color: '#43C6AC' }} />
      </div>

      <div className="flex justify-center mb-4">
        <RadarChart scores={scores} size={220} />
      </div>

      {weakest.value < 80 && (
        <div className="p-3 rounded-xl mt-2" style={{ backgroundColor: 'rgba(67,198,172,0.06)', border: '1px solid rgba(67,198,172,0.15)' }}>
          <p className="text-xs" style={{ color: '#374151' }}>
            <span className="font-semibold" style={{ color: '#43C6AC' }}>Improve {weakest.dim.label}:</span>{' '}{weakest.dim.hint}
          </p>
        </div>
      )}

      {scores.calculated_at && (
        <p className="text-xs mt-3 text-center" style={{ color: '#9ca3af' }}>Last updated: {formatRelativeTime(scores.calculated_at)}</p>
      )}
    </div>
  )
}
