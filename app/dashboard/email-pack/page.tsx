'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModuleGate from '@/components/ModuleGate'
import GenericSalesPage from '@/components/modules/GenericSalesPage'
import CopyButton from '@/components/CopyButton'
import {
  Mail, ChevronDown, ChevronUp, RefreshCw,
  ThumbsUp, ThumbsDown, AlertCircle, Loader, CheckCircle
} from 'lucide-react'

interface EmailFeedbackItem {
  emailNumber: number
  contentText: string
  rating: number
  reasons: string[]
}

interface Email {
  emailNumber: number
  title: string
  purpose: string
  subjectLine: string
  previewText: string
  body: string
  cta: string
  ctaUrl: string
  sendTiming: string
}

interface SequenceOutput {
  strategySignals?: {
    sequenceGoal: string
    primaryAngle: string
    whyItWorks: string
    dataSourcesUsed: string[]
    icpStageTargeted: string
    keyObjectionsAddressed: string[]
    toneNotes: string
  }
  emails?: Email[]
}

const SEQUENCE_TYPES = [
  { value: 'welcome_nurture', label: 'Welcome / Lead Nurture', description: 'Turns new subscribers into engaged prospects' },
  { value: 'sales_offer', label: 'Sales / Offer', description: 'Converts warm leads into customers' },
  { value: 'abandoned_action', label: 'Abandoned Action', description: 'Recovers lost conversions — high ROI' },
  { value: 'onboarding', label: 'Onboarding', description: 'Turns new customers into successful users' },
  { value: 'reengagement', label: 'Re-engagement', description: 'Reactivates cold subscribers' },
  { value: 'upsell_crosssell', label: 'Upsell / Cross-Sell', description: 'Increases customer lifetime value' },
]

const TONES = ['Professional', 'Conversational', 'Authoritative', 'Empathetic', 'Direct']

const REJECTION_REASONS = [
  'Wrong tone',
  "Doesn't sound like us",
  'Too generic',
  'Wrong audience',
  'Bad subject line',
  'Body too long',
  'Weak CTA',
  'Angle already tried',
  'Too salesy',
]

const GENERATING_STEPS = [
  { label: 'Reading your SignalMap Interview Data', duration: 3000 },
  { label: 'Checking CustomerSignals Data', duration: 3000 },
  { label: 'Loading BusinessSignals Research', duration: 3000 },
  { label: 'Mapping ICP journey stages', duration: 3000 },
  { label: 'Writing your 5-email sequence', duration: 6000 },
]

function GeneratingScreen({ generationNumber }: { generationNumber: number }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  useEffect(() => {
    let stepIndex = 0
    let timeout: ReturnType<typeof setTimeout>
    function advance() {
      setCompletedSteps(prev => [...prev, stepIndex])
      stepIndex++
      if (stepIndex < GENERATING_STEPS.length) {
        setCurrentStep(stepIndex)
        timeout = setTimeout(advance, GENERATING_STEPS[stepIndex].duration)
      }
    }
    timeout = setTimeout(advance, GENERATING_STEPS[0].duration)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
          <Mail size={18} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: '#191654' }}>
            {generationNumber === 1 ? 'Building your email sequence…' : `Regenerating (${generationNumber}/3)…`}
          </p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Takes about 30–45 seconds</p>
        </div>
      </div>
      <div className="space-y-3">
        {GENERATING_STEPS.map((step, i) => {
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

function EmailFeedbackWidget({
  emailNumber, contentText, emailFeedback, onRate,
}: {
  emailNumber: number
  contentText: string
  emailFeedback: Record<number, EmailFeedbackItem>
  onRate: (item: EmailFeedbackItem) => void
}) {
  const existing = emailFeedback[emailNumber]
  const [showReasons, setShowReasons] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>(existing?.reasons || [])

  function handleThumbsUp() {
    onRate({ emailNumber, contentText, rating: 1, reasons: [] })
    setShowReasons(false)
  }

  function toggleReason(r: string) {
    setSelectedReasons(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  function confirmReasons() {
    onRate({ emailNumber, contentText, rating: -1, reasons: selectedReasons })
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
      <div className="mt-3 w-full">
        <div className="p-3 rounded-xl border" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
          <p className="text-xs font-bold mb-2" style={{ color: '#dc2626' }}>Why didn&apos;t this work?</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
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
              Flag this email
            </button>
            <button onClick={() => setShowReasons(false)} className="text-xs px-3 py-1 rounded-lg font-semibold" style={{ color: '#9ca3af' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button onClick={handleThumbsUp} title="This works" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <ThumbsUp size={13} style={{ color: '#9ca3af' }} />
      </button>
      <button onClick={() => setShowReasons(true)} title="Flag this email" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <ThumbsDown size={13} style={{ color: '#9ca3af' }} />
      </button>
    </div>
  )
}

function EmailCard({
  email, emailFeedback, onRate,
}: {
  email: Email
  emailFeedback: Record<number, EmailFeedbackItem>
  onRate: (item: EmailFeedbackItem) => void
}) {
  const [open, setOpen] = useState(email.emailNumber === 1)
  const fullEmailText = `Subject: ${email.subjectLine}\nPreview: ${email.previewText}\n\n${email.body}\n\nCTA: ${email.cta}`

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
        style={{ backgroundColor: open ? '#f9fafb' : '#fff' }}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
            style={{ backgroundColor: 'rgba(25,22,84,0.08)', color: '#191654' }}>
            {email.emailNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
                {email.title}
              </p>
              {email.sendTiming && (
                <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
                  {email.sendTiming}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{email.purpose}</p>
            {!open && (
              <p className="text-xs mt-1 truncate" style={{ color: '#6b7280' }}>
                ✉ {email.subjectLine}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <EmailFeedbackWidget
            emailNumber={email.emailNumber}
            contentText={email.subjectLine}
            emailFeedback={emailFeedback}
            onRate={onRate}
          />
          {open ? <ChevronUp size={16} style={{ color: '#9ca3af' }} /> : <ChevronDown size={16} style={{ color: '#9ca3af' }} />}
        </div>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-4 space-y-4">
          <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>SUBJECT LINE</p>
                <p className="text-sm font-semibold" style={{ color: '#191654' }}>{email.subjectLine}</p>
              </div>
              <CopyButton text={email.subjectLine} />
            </div>
            <div className="border-t pt-3" style={{ borderColor: '#e5e7eb' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>PREVIEW TEXT</p>
              <p className="text-sm" style={{ color: '#374151' }}>{email.previewText}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>EMAIL BODY</p>
              <CopyButton text={email.body} />
            </div>
            <div className="p-4 rounded-xl" style={{ border: '1px solid #e5e7eb' }}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#374151' }}>{email.body}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'rgba(67,198,172,0.06)', border: '1px solid rgba(67,198,172,0.2)' }}>
            <div>
              <p className="text-xs font-bold mb-0.5" style={{ color: '#43C6AC' }}>CALL TO ACTION</p>
              <p className="text-sm font-semibold" style={{ color: '#191654' }}>{email.cta}</p>
            </div>
            <CopyButton text={email.cta} />
          </div>
          <div className="flex justify-end">
            <CopyButton text={fullEmailText} variant="button" label="Copy full email" />
          </div>
        </div>
      )}
    </div>
  )
}

function StrategySignalsBlock({ ss }: { ss: NonNullable<SequenceOutput['strategySignals']> }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(67,198,172,0.25)' }}>
      <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: 'rgba(67,198,172,0.08)' }}>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#43C6AC' }} />
        <p className="text-xs font-bold tracking-widest" style={{ color: '#43C6AC' }}>STRATEGYSIGNALS</p>
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>SEQUENCE GOAL</p>
            <p className="text-sm" style={{ color: '#191654' }}>{ss.sequenceGoal}</p>
          </div>
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>PRIMARY ANGLE</p>
            <p className="text-sm" style={{ color: '#191654' }}>{ss.primaryAngle}</p>
          </div>
        </div>
        {ss.whyItWorks && (
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>WHAT SIGNALS DROVE THIS SEQUENCE</p>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{ss.whyItWorks}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: 'rgba(67,198,172,0.15)' }}>
          {ss.icpStageTargeted && (
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>ICP STAGE TARGETED</p>
              <p className="text-xs" style={{ color: '#374151' }}>{ss.icpStageTargeted}</p>
            </div>
          )}
          {ss.toneNotes && (
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>TONE NOTES</p>
              <p className="text-xs" style={{ color: '#374151' }}>{ss.toneNotes}</p>
            </div>
          )}
          {ss.keyObjectionsAddressed && ss.keyObjectionsAddressed.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>OBJECTIONS ADDRESSED</p>
              <div className="flex flex-wrap gap-1.5">
                {ss.keyObjectionsAddressed.map((o, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-md"
                    style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151' }}>
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── STOP HERE. Do not add anything else. Prompt 2 will append the rest. ──
