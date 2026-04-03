'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModuleGate from '@/components/ModuleGate'
import GenericSalesPage from '@/components/modules/GenericSalesPage'
import CopyButton from '@/components/CopyButton'
import {
  Mail, ChevronDown, ChevronUp, RefreshCw,
  ThumbsUp, ThumbsDown, AlertCircle, Loader, CheckCircle, Bookmark, Sparkles
} from 'lucide-react'
import AgentChatPanel from '@/components/AgentChatPanel'
import { createClient } from '@/lib/supabase/client'

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

const FIELD_REASONS: Record<string, string[]> = {
  subject: ['Bad hook', 'Too vague', 'Too long', 'Clickbait-y', 'Wrong angle', 'Not specific enough'],
  preview: ['Repeats subject', 'Too vague', "Doesn't add intrigue", 'Too long', 'Missing curiosity gap'],
  body: ['Wrong tone', 'Too salesy', 'Too long', 'Too generic', 'Missing proof', 'Weak opening', 'Loses momentum'],
  cta: ['Too vague', 'Too pushy', 'Wrong next step', 'Missing urgency', 'Not specific enough'],
}

const GENERATING_STEPS = [
  { label: 'Reading your SignalMap Interview Data', duration: 3000 },
  { label: 'Checking CustomerSignals Data', duration: 3000 },
  { label: 'Loading BusinessSignals Research', duration: 3000 },
  { label: 'Mapping SignalMap journey stages', duration: 3000 },
  { label: 'Writing your 5-email sequence', duration: 6000 },
]

const EMAIL_FACTS = [
  'Subject lines with 6–10 words get the highest open rates — but specificity beats length every time.',
  '47% of recipients open email based on subject line alone. Preview text is your second chance.',
  'The average office worker gets 121 emails a day. Your subject has 3 seconds to earn the open.',
  'Emails that tell a story across a sequence convert 3x better than standalone blasts.',
  'The best CTAs finish a sentence — "I want to…" — not "Click here."',
  'Welcome sequences get 4x the open rate of regular campaigns. Your first email is your most read.',
  'Re-engagement sequences recover 10–25% of dormant subscribers when sent within 90 days.',
  'Preview text that repeats the subject line wastes your second impression. Use it to add intrigue.',
  'Abandoned action sequences have the highest ROI of any email type — intent is already there.',
  'Onboarding sequences reduce refund rates by up to 40% by helping customers get results faster.',
]

const ESP_OPTIONS = [
  { value: 'none', label: 'None / Plain text' },
  { value: 'mailchimp', label: 'Mailchimp' },
  { value: 'klaviyo', label: 'Klaviyo' },
  { value: 'activecampaign', label: 'ActiveCampaign' },
  { value: 'kit', label: 'Kit (ConvertKit)' },
  { value: 'constantcontact', label: 'Constant Contact' },
]

const MERGE_VAR_MAP: Record<string, Record<string, string>> = {
  mailchimp: {
    '[First Name]': '*|FNAME|*',
    '[Last Name]': '*|LNAME|*',
    '[Company]': '*|COMPANY|*',
    '[Email]': '*|EMAIL|*',
    '[Business Name]': '*|COMPANY|*',
  },
  klaviyo: {
    '[First Name]': '{{ first_name }}',
    '[Last Name]': '{{ last_name }}',
    '[Company]': '{{ company }}',
    '[Email]': '{{ email }}',
    '[Business Name]': '{{ company }}',
  },
  activecampaign: {
    '[First Name]': '%FIRSTNAME%',
    '[Last Name]': '%LASTNAME%',
    '[Company]': '%ORGNAME%',
    '[Email]': '%EMAIL%',
    '[Business Name]': '%ORGNAME%',
  },
  kit: {
    '[First Name]': '{{ subscriber.first_name }}',
    '[Last Name]': '{{ subscriber.last_name }}',
    '[Company]': '{{ subscriber.organization }}',
    '[Email]': '{{ subscriber.email_address }}',
    '[Business Name]': '{{ subscriber.organization }}',
  },
  constantcontact: {
    '[First Name]': '{{FIRSTNAME}}',
    '[Last Name]': '{{LASTNAME}}',
    '[Company]': '{{COMPANYNAME}}',
    '[Email]': '{{EMAIL}}',
    '[Business Name]': '{{COMPANYNAME}}',
  },
}

function transformMergeVars(text: string, esp: string): string {
  if (esp === 'none' || !MERGE_VAR_MAP[esp]) return text
  let result = text
  const map = MERGE_VAR_MAP[esp]
  Object.entries(map).forEach(([placeholder, tag]) => {
    result = result.replaceAll(placeholder, tag)
  })
  return result
}

function GeneratingScreen({ generationNumber }: { generationNumber: number }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [factIndex, setFactIndex] = useState(0)
  const [factVisible, setFactVisible] = useState(true)

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

  useEffect(() => {
    const interval = setInterval(() => {
      setFactVisible(false)
      setTimeout(() => {
        setFactIndex(i => (i + 1) % EMAIL_FACTS.length)
        setFactVisible(true)
      }, 400)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const isFinalStep = currentStep === GENERATING_STEPS.length - 1

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

      <div className="space-y-3 mb-8">
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

      {isFinalStep && (
        <div
          className="p-4 rounded-2xl transition-all duration-400"
          style={{
            border: '1px solid rgba(67,198,172,0.25)',
            backgroundColor: 'rgba(67,198,172,0.04)',
            opacity: factVisible ? 1 : 0,
            transform: factVisible ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
          }}>
          <p className="text-xs font-bold mb-1 tracking-widest" style={{ color: '#43C6AC' }}>📧 DID YOU KNOW</p>
          <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{EMAIL_FACTS[factIndex]}</p>
        </div>
      )}
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

function FieldFlagButton({
  fieldKey,
  emailNumber,
  fieldFeedback,
  onFlag,
}: {
  fieldKey: string
  emailNumber: number
  fieldFeedback: Record<string, string[]>
  onFlag: (emailNumber: number, fieldKey: string, reasons: string[]) => void
}) {
  const key = `${emailNumber}_${fieldKey}`
  const existing = fieldFeedback[key]
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  if (existing) {
    return (
      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-semibold"
        style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
        <ThumbsDown size={10} /> Flagged
      </span>
    )
  }

  if (open) {
    return (
      <div className="mt-2 w-full">
        <div className="p-3 rounded-xl border" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
          <p className="text-xs font-bold mb-2" style={{ color: '#dc2626' }}>What&apos;s wrong with this?</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(FIELD_REASONS[fieldKey] || []).map(r => (
              <button key={r} onClick={() => setSelected(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                className="text-xs px-2 py-1 rounded-md border font-medium transition-all"
                style={{
                  borderColor: selected.includes(r) ? '#dc2626' : '#fecaca',
                  backgroundColor: selected.includes(r) ? '#dc2626' : '#fff',
                  color: selected.includes(r) ? '#fff' : '#dc2626',
                }}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { onFlag(emailNumber, fieldKey, selected); setOpen(false) }}
              className="text-xs px-3 py-1 rounded-lg text-white font-semibold"
              style={{ backgroundColor: '#dc2626' }}>
              Flag this
            </button>
            <button onClick={() => setOpen(false)} className="text-xs px-3 py-1 rounded-lg font-semibold" style={{ color: '#9ca3af' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button onClick={() => setOpen(true)}
      className="p-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
      title="Flag this field">
      <ThumbsDown size={11} style={{ color: '#d1d5db' }} />
    </button>
  )
}

function EmailCard({
  email, emailFeedback, onRate, esp, businessId, totalEmails, fieldFeedback, onFieldFlag, previewCount, onPreviewSent,
}: {
  email: Email
  emailFeedback: Record<number, EmailFeedbackItem>
  onRate: (item: EmailFeedbackItem) => void
  esp: string
  businessId: string
  totalEmails: number
  fieldFeedback: Record<string, string[]>
  onFieldFlag: (emailNumber: number, fieldKey: string, reasons: string[]) => void
  previewCount: number
  onPreviewSent: () => void
}) {
  const [open, setOpen] = useState(email.emailNumber === 1)
  const [previewSending, setPreviewSending] = useState(false)
  const [previewSent, setPreviewSent] = useState(false)
  const [previewError, setPreviewError] = useState(false)

  const transformedBody = transformMergeVars(email.body, esp)
  const transformedSubject = transformMergeVars(email.subjectLine, esp)
  const transformedCta = transformMergeVars(email.cta, esp)
  const fullEmailText = `Subject: ${transformedSubject}\nPreview: ${email.previewText}\n\n${transformedBody}\n\nCTA: ${transformedCta}`

  const previewLimitReached = previewCount >= 3

  async function handleSendPreview() {
    if (previewLimitReached) return
    setPreviewSending(true)
    setPreviewError(false)
    try {
      const res = await fetch('/api/signal-sequences/send-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          emailNumber: email.emailNumber,
          totalEmails,
          subjectLine: transformedSubject,
          previewText: email.previewText,
          bodyText: transformedBody,
          cta: transformedCta,
          ctaUrl: email.ctaUrl,
          title: email.title,
        }),
      })
      if (res.ok) { setPreviewSent(true); onPreviewSent() } else { setPreviewError(true) }
    } catch { setPreviewError(true) }
    setPreviewSending(false)
  }

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
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <FieldFlagButton fieldKey="subject" emailNumber={email.emailNumber} fieldFeedback={fieldFeedback} onFlag={onFieldFlag} />
                <CopyButton text={transformedSubject} />
              </div>
            </div>
            <div className="border-t pt-3" style={{ borderColor: '#e5e7eb' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>PREVIEW TEXT</p>
                <FieldFlagButton fieldKey="preview" emailNumber={email.emailNumber} fieldFeedback={fieldFeedback} onFlag={onFieldFlag} />
              </div>
              <p className="text-sm" style={{ color: '#374151' }}>{email.previewText}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>EMAIL BODY</p>
              <div className="flex items-center gap-1.5">
                <FieldFlagButton fieldKey="body" emailNumber={email.emailNumber} fieldFeedback={fieldFeedback} onFlag={onFieldFlag} />
                <CopyButton text={transformedBody} />
              </div>
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
            <div className="flex items-center gap-1.5">
              <FieldFlagButton fieldKey="cta" emailNumber={email.emailNumber} fieldFeedback={fieldFeedback} onFlag={onFieldFlag} />
              <CopyButton text={transformedCta} />
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSendPreview}
                disabled={previewSending || previewSent || previewLimitReached}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
                style={{
                  backgroundColor: previewSent ? 'rgba(67,198,172,0.1)' : previewLimitReached ? '#f3f4f6' : '#43C6AC',
                  color: previewSent ? '#43C6AC' : previewLimitReached ? '#9ca3af' : '#fff',
                  border: previewSent ? '1px solid #43C6AC' : 'none',
                }}>
                {previewSending ? (
                  <div className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                ) : previewSent ? (
                  <CheckCircle size={13} />
                ) : (
                  <Mail size={13} />
                )}
                {previewLimitReached ? 'Preview limit reached' : previewSending ? 'Sending…' : previewSent ? 'Sent to your inbox' : 'Preview in inbox'}
              </button>
              {previewError && (
                <p className="text-xs" style={{ color: '#ef4444' }}>Send failed — try again</p>
              )}
              {previewLimitReached && !previewSent && (
                <p className="text-xs" style={{ color: '#9ca3af' }}>Preview limit reached for this session</p>
              )}
            </div>
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

function SignalSequencesModule() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [outputId, setOutputId] = useState<string | null>(null)
  const [sequenceType, setSequenceType] = useState('')
  const [guidedStep, setGuidedStep] = useState<'contact' | 'customer_goal' | 'confirmed'>('contact')
  const [tone, setTone] = useState('')
  const [topicsToAvoid, setTopicsToAvoid] = useState('')
  const [esp, setEsp] = useState('none')
  const [stage, setStage] = useState<'form' | 'generating' | 'results'>('form')
  const [sequence, setSequence] = useState<SequenceOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generationNumber, setGenerationNumber] = useState(1)
  const [emailFeedback, setEmailFeedback] = useState<Record<number, EmailFeedbackItem>>({})
  const [fieldFeedback, setFieldFeedback] = useState<Record<string, string[]>>({})
  const [previewCount, setPreviewCount] = useState(0)
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [overallFeedbackMode, setOverallFeedbackMode] = useState<'idle' | 'thumbsdown'>('idle')
  const [overallFeedbackText, setOverallFeedbackText] = useState('')
  const [overallFeedbackDone, setOverallFeedbackDone] = useState(false)
  const [overallSubmitting, setOverallSubmitting] = useState(false)
  const [vaultSaved, setVaultSaved] = useState(false)
  const [vaultSaving, setVaultSaving] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('signalshot_active_business')
    if (!id) { router.push('/dashboard'); return }
    setBusinessId(id)

    const supabase = createClient()
    supabase
      .from('module_outputs')
      .select('id, output_data, form_inputs, generation_number')
      .eq('business_id', id)
      .eq('module_type', 'signal_sequences')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data: lastOutput }) => {
        if (lastOutput?.output_data) {
          setSequence(lastOutput.output_data as SequenceOutput)
          setOutputId(lastOutput.id)
          setGenerationNumber(lastOutput.generation_number || 1)
          setStage('results')
          const inputs = lastOutput.form_inputs as Record<string, string> | null
          if (inputs?.esp) setEsp(inputs.esp)
          if (inputs?.sequenceType) { setSequenceType(inputs.sequenceType); setGuidedStep('confirmed') }
          if (inputs?.tone) setTone(inputs.tone)
        }
      })
  }, [router])

  function isFormValid() { return !!sequenceType && !!tone }

  function handleFieldFlag(emailNumber: number, fieldKey: string, reasons: string[]) {
    const key = `${emailNumber}_${fieldKey}`
    setFieldFeedback(prev => ({ ...prev, [key]: reasons }))
  }

  function handleEmailRate(item: EmailFeedbackItem) {
    setEmailFeedback(prev => ({ ...prev, [item.emailNumber]: item }))
    if (!businessId || !outputId) return
    fetch('/api/signal-sequences/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId, emailFeedbackItems: [item] }),
    }).catch(() => null)
  }

  async function generate(regenFeedback?: string) {
    if (!businessId) return
    setError(null); setStage('generating'); setEmailFeedback({})
    try {
      const res = await fetch('/api/signal-sequences/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sequenceType, tone, topicsToAvoid, esp, regenerationFeedback: regenFeedback || undefined, generationNumber }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Generation failed'); setStage('form'); return }
      setSequence(json.data.sequence)
      setOutputId(json.data.outputId)
      setStage('results')
      setOverallFeedbackMode('idle'); setOverallFeedbackText(''); setOverallFeedbackDone(false)
    } catch { setError('Network error — please try again'); setStage('form') }
  }

  function handleAgentPatch(target: string, value: string) {
    setSequence(prev => {
      if (!prev) return prev
      const updated = { ...prev }
      const emailMatch = target.match(/^email_(\d+)_(.+)$/)
      if (emailMatch && updated.emails) {
        const emailNum = parseInt(emailMatch[1])
        const field = emailMatch[2] as keyof Email
        updated.emails = updated.emails.map(e =>
          e.emailNumber === emailNum ? { ...e, [field]: value } : e
        )
      }
      const ssMatch = target.match(/^strategySignals_(.+)$/)
      if (ssMatch && updated.strategySignals) {
        const field = ssMatch[1] as keyof typeof updated.strategySignals
        updated.strategySignals = { ...updated.strategySignals, [field]: value }
      }
      return updated
    })
  }

  async function handleVaultSave() {
    if (!businessId || !outputId || vaultSaved) return
    setVaultSaving(true)
    await fetch('/api/vault/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId }),
    })
    setVaultSaving(false)
    setVaultSaved(true)
  }

  async function submitOverallFeedback(rating: number) {
    if (!businessId || !outputId) return
    setOverallSubmitting(true)
    await fetch('/api/signal-sequences/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, outputId, rating, feedbackText: overallFeedbackText || undefined }),
    })
    setOverallSubmitting(false); setOverallFeedbackDone(true)
    if (rating >= 4 && outputId && businessId) {
      fetch('/api/vault/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, outputId }),
      }).catch(() => null)
    }
  }

  async function handleRegenerate() {
    if (generationNumber >= 3) return
    setFeedbackSaving(true)

    // Email-level flags
    const flagged = Object.values(emailFeedback).filter(f => f.rating === -1)
    const emailFlagSummary = flagged.length > 0
      ? `USER FLAGGED ${flagged.length} EMAILS AS NOT WORKING:\n` + flagged.map(f => `- Email ${f.emailNumber} "${f.contentText.slice(0, 60)}" — reasons: ${f.reasons.join(', ') || 'no reason given'}`).join('\n')
      : ''

    // Field-level flags
    const fieldEntries = Object.entries(fieldFeedback)
    const fieldFlagSummary = fieldEntries.length > 0
      ? `FIELD-LEVEL FLAGS (fix these specific elements):\n` + fieldEntries.map(([key, reasons]) => {
          const [emailNum, field] = key.split('_')
          return `- Email ${emailNum} ${field.toUpperCase()}: ${reasons.length > 0 ? reasons.join(', ') : 'flagged as not working'}`
        }).join('\n')
      : ''

    const combinedFeedback = [overallFeedbackText, emailFlagSummary, fieldFlagSummary].filter(Boolean).join('\n\n')
    setFeedbackSaving(false)
    setGenerationNumber(n => n + 1)
    await generate(combinedFeedback || undefined)
  }

  if (stage === 'form') {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
            <Mail size={22} style={{ color: '#43C6AC' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>SignalSequences</h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>Tell us your sequence goal — Alex builds the full 5-email flow.</p>
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
            {guidedStep === 'confirmed' ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
                    {SEQUENCE_TYPES.find(s => s.value === sequenceType)?.label}
                  </span>
                  <button onClick={() => { setSequenceType(''); setGuidedStep('contact') }}
                    className="text-xs underline" style={{ color: '#9ca3af' }}>change</button>
                </div>
                {sequenceType === 'welcome_nurture' && (
                  <p className="text-xs" style={{ color: '#43C6AC' }}>⭐ Best starting point for most businesses</p>
                )}
                {sequenceType === 'abandoned_action' && (
                  <p className="text-xs" style={{ color: '#43C6AC' }}>⭐ Highest ROI sequence type</p>
                )}
                {sequenceType === 'sales_offer' && (
                  <p className="text-xs" style={{ color: '#43C6AC' }}>⭐ Where revenue happens</p>
                )}
              </div>
            ) : guidedStep === 'customer_goal' ? (
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>What&apos;s your goal with them?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button onClick={() => { setSequenceType('onboarding'); setGuidedStep('confirmed') }}
                    className="text-left px-4 py-4 rounded-xl border transition-all hover:border-green-300"
                    style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                    <p className="text-sm font-bold mb-1" style={{ color: '#191654' }}>Help them get results faster</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Onboarding — turns new customers into successful users</p>
                  </button>
                  <button onClick={() => { setSequenceType('upsell_crosssell'); setGuidedStep('confirmed') }}
                    className="text-left px-4 py-4 rounded-xl border transition-all hover:border-green-300"
                    style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                    <p className="text-sm font-bold mb-1" style={{ color: '#191654' }}>Offer them something more</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Upsell / Cross-Sell — increases customer lifetime value</p>
                  </button>
                </div>
                <button onClick={() => setGuidedStep('contact')} className="text-xs mt-3 underline" style={{ color: '#9ca3af' }}>← Back</button>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Where are these contacts in their journey? *</label>
                <div className="space-y-2">
                  <button onClick={() => { setSequenceType('welcome_nurture'); setGuidedStep('confirmed') }}
                    className="w-full text-left px-4 py-4 rounded-xl border transition-all hover:border-green-300"
                    style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#191654' }}>Brand new — just joined my list</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Welcome / Lead Nurture — turns subscribers into engaged prospects</p>
                  </button>
                  <button onClick={() => { setSequenceType('sales_offer'); setGuidedStep('confirmed') }}
                    className="w-full text-left px-4 py-4 rounded-xl border transition-all hover:border-green-300"
                    style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#191654' }}>Warm — they&apos;ve shown interest or engaged</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Sales / Offer — converts warm leads into customers</p>
                  </button>
                  <button onClick={() => { setSequenceType('abandoned_action'); setGuidedStep('confirmed') }}
                    className="w-full text-left px-4 py-4 rounded-xl border transition-all hover:border-green-300"
                    style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#191654' }}>They started but didn&apos;t finish</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Abandoned Action — recovers lost conversions (highest ROI)</p>
                  </button>
                  <button onClick={() => setGuidedStep('customer_goal')}
                    className="w-full text-left px-4 py-4 rounded-xl border transition-all hover:border-green-300"
                    style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#191654' }}>Already a customer</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Onboarding or Upsell — we&apos;ll help you pick</p>
                  </button>
                  <button onClick={() => { setSequenceType('reengagement'); setGuidedStep('confirmed') }}
                    className="w-full text-left px-4 py-4 rounded-xl border transition-all hover:border-green-300"
                    style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#191654' }}>Gone cold — haven&apos;t heard from them</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>Re-engagement — reactivates dormant subscribers</p>
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#374151' }}>Email Tone *</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ borderColor: tone === t ? '#43C6AC' : '#e5e7eb', backgroundColor: tone === t ? 'rgba(67,198,172,0.1)' : '#fff', color: tone === t ? '#191654' : '#6b7280' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: '#374151' }}>Topics to Avoid <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea rows={2} placeholder="e.g. &apos;Don&apos;t mention pricing. Avoid competitor comparisons.&apos;"
              value={topicsToAvoid} onChange={e => setTopicsToAvoid(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border outline-none resize-none" style={{ borderColor: '#e5e7eb', color: '#374151' }} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: '#374151' }}>
              Email Platform <span className="font-normal text-gray-400">(optional — formats merge tags for your ESP)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ESP_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setEsp(opt.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{
                    borderColor: esp === opt.value ? '#43C6AC' : '#e5e7eb',
                    backgroundColor: esp === opt.value ? 'rgba(67,198,172,0.1)' : '#fff',
                    color: esp === opt.value ? '#191654' : '#6b7280',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {esp !== 'none' && (
              <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
                Merge tags like [First Name] will auto-convert to {ESP_OPTIONS.find(o => o.value === esp)?.label} syntax when you copy.
              </p>
            )}
          </div>
          <button onClick={() => generate()} disabled={!isFormValid()}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-opacity"
            style={{ backgroundColor: isFormValid() ? '#191654' : '#d1d5db', cursor: isFormValid() ? 'pointer' : 'not-allowed' }}>
            Generate My Email Sequence
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'generating') {
    return <GeneratingScreen generationNumber={generationNumber} />
  }

  if (!sequence) return null
  const flaggedCount = Object.values(emailFeedback).filter(f => f.rating === -1).length

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#191654' }}>
            <Mail size={18} style={{ color: '#43C6AC' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>Your Email Sequence</h1>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Generation {generationNumber} of 3</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ backgroundColor: '#43C6AC', color: '#fff' }}>
            <Sparkles size={13} /> Refine with Emily
          </button>
          <button onClick={handleVaultSave} disabled={vaultSaving || vaultSaved}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-60"
            style={{ borderColor: vaultSaved ? '#43C6AC' : '#e5e7eb', backgroundColor: vaultSaved ? 'rgba(67,198,172,0.08)' : '#fff', color: vaultSaved ? '#43C6AC' : '#6b7280' }}>
            {vaultSaving ? <Loader size={12} className="animate-spin" /> : <Bookmark size={12} fill={vaultSaved ? '#43C6AC' : 'none'} />}
            {vaultSaving ? 'Saving…' : vaultSaved ? 'Saved to SignalVault' : 'Save to SignalVault'}
          </button>
          <button onClick={() => { setStage('form'); setSequence(null); setEmailFeedback({}) }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
            Start over
          </button>
        </div>
      </div>

      {sequence.strategySignals && <StrategySignalsBlock ss={sequence.strategySignals} />}
      {sequence.emails?.map(email => (
        <EmailCard key={email.emailNumber} email={email} emailFeedback={emailFeedback} onRate={handleEmailRate} esp={esp} businessId={businessId || ''} totalEmails={sequence.emails?.length || 5} fieldFeedback={fieldFeedback} onFieldFlag={handleFieldFlag} previewCount={previewCount} onPreviewSent={() => setPreviewCount(c => c + 1)} />
      ))}

      <div className="p-5 rounded-2xl border" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
        {overallFeedbackDone && overallFeedbackMode !== 'thumbsdown' ? (
          <p className="text-sm text-center font-semibold" style={{ color: '#43C6AC' }}>Thanks — your feedback helps Alex improve.</p>
        ) : overallFeedbackMode === 'thumbsdown' ? (
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>
              What missed the mark? {generationNumber < 3 ? "We'll regenerate with your feedback." : "We'll note this for future improvements."}
            </p>
            {flaggedCount > 0 && (
              <div className="flex items-center gap-1.5 mb-3 text-xs p-2 rounded-lg" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                <ThumbsDown size={12} /> {flaggedCount} email{flaggedCount > 1 ? 's' : ''} already flagged — included in regeneration context automatically.
              </div>
            )}
            <textarea rows={3} placeholder="e.g. &apos;The tone feels too formal. Lead heavier with the pain — they&apos;re not ready for solutions this early.&apos;"
              value={overallFeedbackText} onChange={e => setOverallFeedbackText(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border outline-none resize-none mb-3" style={{ borderColor: '#e5e7eb', color: '#374151' }} />
            <div className="flex items-center gap-2 flex-wrap">
              {generationNumber < 3 ? (
                <button onClick={handleRegenerate}
                  disabled={overallFeedbackText.length < 20 || feedbackSaving || overallSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40"
                  style={{ backgroundColor: '#191654' }}>
                  {feedbackSaving ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Regenerate ({generationNumber}/3 used)
                </button>
              ) : (
                <button onClick={() => submitOverallFeedback(1)}
                  disabled={overallFeedbackText.length < 20 || overallSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40"
                  style={{ backgroundColor: '#191654' }}>
                  {overallSubmitting ? <Loader size={13} className="animate-spin" /> : null}
                  Submit feedback
                </button>
              )}
              {generationNumber >= 3 && (
                <p className="text-xs" style={{ color: '#9ca3af' }}>
                  Max regenerations reached. <a href="mailto:support@goodfellastech.com" className="underline">Contact support</a> if you need further help.
                </p>
              )}
              <button onClick={() => setOverallFeedbackMode('idle')} className="text-xs" style={{ color: '#9ca3af' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold" style={{ color: '#374151' }}>How did this sequence land?</p>
              {flaggedCount > 0 && (
                <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                  {flaggedCount} email{flaggedCount > 1 ? 's' : ''} flagged — click &quot;Needs work&quot; to regenerate with that context.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { submitOverallFeedback(5); setOverallFeedbackDone(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
                <ThumbsUp size={13} /> Looks great
              </button>
              <button onClick={() => setOverallFeedbackMode('thumbsdown')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                <ThumbsDown size={13} /> {flaggedCount > 0 ? `Needs work (${flaggedCount} flagged)` : 'Needs work'}
              </button>
            </div>
          </div>
        )}
      </div>
      <AgentChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        moduleType="signal_sequences"
        agentName="Emily"
        agentTagline="Email sequence specialist"
        businessId={businessId || ''}
        outputId={outputId || ''}
        currentOutput={sequence as unknown as Record<string, unknown>}
        onPatch={handleAgentPatch}
      />
    </div>
  )
}

export default function EmailPackPage() {
  return (
    <ModuleGate productType="email_pack" salesPage={
      <GenericSalesPage name="SignalSequences"
        description="A 5-email nurture sequence that moves your ideal customer from pain-aware to ready-to-buy, using the exact language Alex uncovered in your interview."
        iconName="Mail"
        deliverables={['5-email sequence with subject lines & preview text', 'Pain-aware to solution-aware progression', 'Objection-handling email built from ICP data', 'Social proof email using CustomerSignals', 'CTA strategy matched to buying triggers', 'Per-email feedback + up to 3 regenerations']} />
    }>
      <SignalSequencesModule />
    </ModuleGate>
  )
}
