'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import type { ContentFeedbackItem } from './types'

const REJECTION_REASONS = [
  'Too generic',
  'Wrong tone',
  "Doesn't sound like us",
  'Too long',
  'Too salesy',
  'Wrong audience',
  'Already used this angle',
  'Not relevant to my business',
]

interface Props {
  blockId: string
  contentText: string
  contentFeedback: Record<string, ContentFeedbackItem>
  onRate: (item: ContentFeedbackItem) => void
}

export default function ContentFeedbackWidget({ blockId, contentText, contentFeedback, onRate }: Props) {
  const existing = contentFeedback[blockId]
  const [showReasons, setShowReasons] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>(existing?.reasons || [])

  function toggleReason(r: string) {
    setSelectedReasons(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  function confirmReasons() {
    onRate({ blockId, contentText, rating: -1, reasons: selectedReasons })
    setShowReasons(false)
  }

  if (existing && !showReasons) {
    return existing.rating === 1 ? (
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
        style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
        <ThumbsUp size={11} /> Good
      </span>
    ) : (
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
        style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
        <ThumbsDown size={11} /> Flagged
      </span>
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
              Flag this post
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
      <button onClick={() => onRate({ blockId, contentText, rating: 1, reasons: [] })}
        title="This works" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <ThumbsUp size={13} style={{ color: '#9ca3af' }} />
      </button>
      <button onClick={() => setShowReasons(true)} title="Flag this post"
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <ThumbsDown size={13} style={{ color: '#9ca3af' }} />
      </button>
    </div>
  )
}
