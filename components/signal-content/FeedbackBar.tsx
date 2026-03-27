'use client'

import { ThumbsUp, ThumbsDown, RefreshCw, Loader } from 'lucide-react'

interface Props {
  generationNumber: number
  flaggedCount: number
  overallFeedbackMode: 'idle' | 'thumbsdown'
  overallFeedbackText: string
  overallFeedbackDone: boolean
  overallSubmitting: boolean
  onFeedbackTextChange: (text: string) => void
  onFeedbackModeChange: (mode: 'idle' | 'thumbsdown') => void
  onThumbsUp: () => void
  onRegenerate: () => void
  onSubmitFeedback: () => void
}

export default function FeedbackBar({
  generationNumber, flaggedCount, overallFeedbackMode, overallFeedbackText,
  overallFeedbackDone, overallSubmitting, onFeedbackTextChange,
  onFeedbackModeChange, onThumbsUp, onRegenerate, onSubmitFeedback,
}: Props) {
  if (overallFeedbackDone && overallFeedbackMode !== 'thumbsdown') {
    return (
      <div className="p-5 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
        <p className="text-sm text-center font-semibold" style={{ color: '#43C6AC' }}>
          Thanks — your feedback helps Alex improve.
        </p>
      </div>
    )
  }

  if (overallFeedbackMode === 'thumbsdown') {
    return (
      <div className="p-5 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
        <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>
          What missed the mark overall?{' '}
          {generationNumber < 3 ? "We'll regenerate with your feedback." : "We'll note this for future improvements."}
        </p>
        {flaggedCount > 0 && (
          <div className="flex items-center gap-1.5 mb-3 text-xs p-2 rounded-lg"
            style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            <ThumbsDown size={12} />
            {flaggedCount} post{flaggedCount > 1 ? 's' : ''} already flagged — included in regeneration context automatically.
          </div>
        )}
        <textarea rows={3}
          placeholder="e.g. 'The pillars feel too broad. Need to be more specific to facility managers in the Southeast.'"
          value={overallFeedbackText}
          onChange={e => onFeedbackTextChange(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border outline-none resize-none mb-3"
          style={{ borderColor: '#e5e7eb', color: '#374151' }} />
        <div className="flex items-center gap-2 flex-wrap">
          {generationNumber < 3 ? (
            <button onClick={onRegenerate}
              disabled={overallFeedbackText.length < 20 || overallSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40"
              style={{ backgroundColor: '#191654' }}>
              <RefreshCw size={13} />
              Regenerate ({generationNumber}/3 used)
            </button>
          ) : (
            <button onClick={onSubmitFeedback}
              disabled={overallFeedbackText.length < 20 || overallSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40"
              style={{ backgroundColor: '#191654' }}>
              {overallSubmitting ? <Loader size={13} className="animate-spin" /> : null}
              Submit feedback
            </button>
          )}
          {generationNumber >= 3 && (
            <p className="text-xs" style={{ color: '#9ca3af' }}>
              Max regenerations reached. <a href="mailto:support@goodfellastech.com" className="underline">Contact support</a> if needed.
            </p>
          )}
          <button onClick={() => onFeedbackModeChange('idle')} className="text-xs" style={{ color: '#9ca3af' }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: '#374151' }}>How did this content library land?</p>
          {flaggedCount > 0 && (
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              {flaggedCount} post{flaggedCount > 1 ? 's' : ''} flagged — click &quot;Needs work&quot; to regenerate with that context.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onThumbsUp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
            <ThumbsUp size={13} /> Looks great
          </button>
          <button onClick={() => onFeedbackModeChange('thumbsdown')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
            <ThumbsDown size={13} />
            {flaggedCount > 0 ? `Needs work (${flaggedCount} flagged)` : 'Needs work'}
          </button>
        </div>
      </div>
    </div>
  )
}
