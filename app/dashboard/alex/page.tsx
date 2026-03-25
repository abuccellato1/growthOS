'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/client'
import { getPhaseConfig, PHASE_TRANSITIONS } from '@/lib/prompts'
import { generateUUID } from '@/lib/utils'
import { Customer, Phase, Message, Business, Session } from '@/types'
import { Send, CheckCircle, Loader, MessageSquare, ArrowRight } from 'lucide-react'
import Link from 'next/link'

function buildCustomerContext(business: Business): string {
  let ctx = `CUSTOMER CONTEXT — collected during onboarding, do not ask again:
- Business Name: ${business.business_name}
- Website: ${business.website_url || 'Not provided'}
- Primary Service/Product: ${business.primary_service || 'Not provided'}
- Geographic Market: ${business.geographic_market || 'Not provided'}`

  if (business.gmb_url) {
    ctx += `\n- Google My Business: ${business.gmb_url}`
  }

  ctx += `\nUse this context to skip basic discovery questions you already know.
Start Phase 1 with more specific, deeper questions.`

  if (business.business_research?.websiteFound) {
    const r = business.business_research
    ctx += `\n\nPRE-SESSION RESEARCH:\n`
    ctx += `What they do: ${r.whatTheyDo}\n`
    ctx += `Years in business: ${r.yearsInBusiness}\n`
    ctx += `Apparent target customer: ${r.apparentTargetCustomer}\n`
    ctx += `Differentiators: ${r.differentiators}\n`
    ctx += `Note: Surface-level only. Find who is ACTUALLY buying.\n`
  }

  if (business.business_research?.gmbData) {
    const gmb = business.business_research.gmbData
    ctx += `\nGMB SIGNALS:\n`
    if (gmb.reviewCount) ctx += `- Reviews: ${gmb.reviewCount}\n`
    if (gmb.averageRating) ctx += `- Average rating: ${gmb.averageRating}\n`
    if (gmb.categories) ctx += `- Business categories: ${gmb.categories}\n`
    if (gmb.serviceArea) ctx += `- Service area: ${gmb.serviceArea}\n`
  }

  return ctx
}

function buildOpeningMessage(customer: Customer): string {
  const firstName = customer.first_name || 'there'
  return `Hi ${firstName}! I'm Alex, your Client Discovery Strategist at SignalShot. I've reviewed what you shared about your business during setup, and I'm ready to dig in. Let's start by making sure I have a clear picture of what's actually happening in your business right now. What does your business do — and what's the core problem you solve for your customers?`
}

async function persistSession(
  msgs: Message[],
  currentPhase: Phase,
  status: string,
  sid: string,
  uuid: string,
  custId: string,
  sa: string | null,
  businessId?: string | null,
  icpData?: Record<string, unknown>
) {
  const supabase = createClient()
  const payload: Record<string, unknown> = {
    id: sid,
    customer_id: custId,
    session_uuid: uuid,
    phase: currentPhase,
    message_history: msgs,
    status,
    last_activity: new Date().toISOString(),
    started_at: sa ?? new Date().toISOString(),
  }
  if (businessId) payload.business_id = businessId
  if (icpData) payload.icp_data = icpData
  if (status === 'completed') payload.completed_at = new Date().toISOString()
  await supabase.from('sessions').upsert(payload)
}

export default function AlexPage() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionUuid, setSessionUuid] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [phaseMessages, setPhaseMessages] = useState<Message[]>([])
  const phaseTranscriptsRef = useRef<Record<string, Message[]>>({})
  const [phase, setPhase] = useState<Phase>(1)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [phaseComplete, setPhaseComplete] = useState(false)
  const [openingMessage, setOpeningMessage] = useState<string | null>(null)

  // ICP Already Complete state
  const [completedSession, setCompletedSession] = useState<Session | null>(null)
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!customerData) { router.push('/dashboard'); return }

      // Get active business from localStorage
      const activeBizId = localStorage.getItem('signalshot_active_business')
      if (!activeBizId) { router.push('/dashboard'); return }

      const { data: bizData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', activeBizId)
        .single()

      if (!bizData) { router.push('/dashboard'); return }

      // Check intake completion using business fields
      const intakeComplete = !!(
        bizData.business_name?.trim() &&
        bizData.website_url?.trim() &&
        bizData.primary_service?.trim() &&
        bizData.geographic_market?.trim()
      )
      if (!intakeComplete) { router.push('/dashboard'); return }

      setCustomer(customerData)
      setActiveBusiness(bizData)

      // Check for completed non-archived session for this business
      const { data: existingCompleted } = await supabase
        .from('sessions')
        .select('*')
        .eq('business_id', bizData.id)
        .eq('status', 'completed')
        .not('archived', 'is', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingCompleted) {
        setCompletedSession(existingCompleted)
        setInitializing(false)
        return
      }

      // Check for in_progress session for this business, fall back to customer_id
      // First: try by business_id
      let existingSession = null
      const { data: bizInProgress } = await supabase
        .from('sessions')
        .select('*')
        .eq('business_id', bizData.id)
        .in('status', ['in_progress', 'not_started'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Fall back: if no business session, try by customer_id
      // (handles sessions created before business architecture existed)
      existingSession = bizInProgress
      if (!existingSession) {
        const { data: custInProgress } = await supabase
          .from('sessions')
          .select('*')
          .eq('customer_id', customerData.id)
          .in('status', ['in_progress', 'not_started'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        existingSession = custInProgress
      }

      if (existingSession && existingSession.message_history?.length > 0) {
        setSessionId(existingSession.id)
        setSessionUuid(existingSession.session_uuid)
        setMessages(existingSession.message_history)
        setPhase(existingSession.phase as Phase)
        setStartedAt(existingSession.started_at)
        if (existingSession.phase_transcripts) {
          phaseTranscriptsRef.current = existingSession.phase_transcripts as Record<string, Message[]>
        }
        setInitializing(false)
        return
      }

      // Create new session
      const uuid = generateUUID()
      const newSessionId = generateUUID()
      setSessionUuid(uuid)
      setSessionId(newSessionId)

      await supabase.from('sessions').insert({
        id: newSessionId,
        customer_id: customerData.id,
        business_id: bizData.id,
        session_uuid: uuid,
        phase: 1,
        message_history: [],
        status: 'not_started',
        started_at: null,
        archived: false,
      })

      const greeting = buildOpeningMessage(customerData)
      setOpeningMessage(greeting)
      setMessages([{ role: 'assistant', content: greeting }])
      setInitializing(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConfirmRebuild() {
    if (!completedSession) return
    const supabase = createClient()

    // Archive the existing completed session
    await supabase
      .from('sessions')
      .update({ archived: true })
      .eq('id', completedSession.id)

    setShowRebuildConfirm(false)
    setCompletedSession(null)

    // Start new session
    if (customer && activeBusiness) {
      const uuid = generateUUID()
      const newSessionId = generateUUID()
      setSessionUuid(uuid)
      setSessionId(newSessionId)

      await supabase.from('sessions').insert({
        id: newSessionId,
        customer_id: customer.id,
        business_id: activeBusiness.id,
        session_uuid: uuid,
        phase: 1,
        message_history: [],
        status: 'not_started',
        started_at: null,
        archived: false,
      })

      const greeting = buildOpeningMessage(customer)
      setOpeningMessage(greeting)
      setMessages([{ role: 'assistant', content: greeting }])
    }
  }

  const callAlexApi = useCallback(async (
    currentMessages: Message[],
    currentPhaseMessages: Message[],
    currentPhaseTranscripts: Record<string, Message[]>,
    currentPhase: Phase,
    customerContext: string,
    cust: Customer,
    sid: string,
    uuid: string,
    sa: string | null,
  ) => {
    setStreaming(true)

    const actualStartedAt = sa ?? new Date().toISOString()
    if (!sa) setStartedAt(actualStartedAt)

    let fullText = ''

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentPhase === 4 ? [] : currentPhaseMessages,
          phase: currentPhase,
          customerContext: currentPhase === 1 ? customerContext : undefined,
          sessionId: sid,
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      fullText = data.reply ?? ''

      const finalMessages: Message[] = [...currentMessages, { role: 'assistant', content: fullText }]
      setMessages(finalMessages)

      const finalPhaseMessages: Message[] = [...currentPhaseMessages, { role: 'assistant' as const, content: fullText }]
      setPhaseMessages(finalPhaseMessages)

      if (data.shouldAdvancePhase) {
        const nextPhase = (currentPhase + 1) as Phase
        if (nextPhase <= 4) {
          setPhase(nextPhase)
        }

        const completedTranscript = {
          ...currentPhaseTranscripts,
          [currentPhase.toString()]: finalPhaseMessages,
        }
        phaseTranscriptsRef.current = completedTranscript

        const supabase = createClient()
        await supabase
          .from('sessions')
          .update({ phase_transcripts: completedTranscript })
          .eq('id', sid)

        setPhaseMessages([])

        const transitionText = PHASE_TRANSITIONS[currentPhase]
        if (transitionText) {
          const withTransition: Message[] = [
            ...finalMessages,
            { role: 'assistant', content: transitionText },
          ]
          setMessages(withTransition)
          await persistSession(withTransition, nextPhase <= 4 ? nextPhase : currentPhase, 'in_progress', sid, uuid, cust.id, actualStartedAt, activeBusiness?.id)
          setTimeout(() => setPhaseComplete(true), 1500)
        }
      } else if (data.isIcpComplete) {
        await fetch('/api/save-icp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, icpMarkdown: fullText }),
        }).catch(() => null)

        const icpData = { raw: fullText }
        await persistSession(finalMessages, 4, 'completed', sid, uuid, cust.id, actualStartedAt, activeBusiness?.id, icpData)

        const supabase = createClient()
        const { data: purchasesData } = await supabase
          .from('purchases')
          .select('product_type')
          .eq('customer_id', cust.id)

        const purchaseTypes = purchasesData?.map((p) => p.product_type) ?? []

        if (purchaseTypes.length > 0) {
          await supabase.from('deliverables').insert(
            purchaseTypes.map((pt) => ({
              customer_id: cust.id,
              business_id: activeBusiness?.id || null,
              session_id: sid,
              deliverable_type: pt,
              status: 'pending',
            }))
          )
        }

        const completionMsg = `That's everything. Your **SignalMap** is ready — head to [My Deliverables](/dashboard/deliverables) to view, download as PDF, or copy it into Google Docs.`
        const withCompletion: Message[] = [
          ...finalMessages,
          { role: 'assistant', content: completionMsg },
        ]
        setMessages(withCompletion)
        setCompleted(true)
      } else {
        await persistSession(finalMessages, currentPhase, 'in_progress', sid, uuid, cust.id, actualStartedAt, activeBusiness?.id)
      }
    } catch (err) {
      let status: number | undefined
      if (err instanceof Error && err.message.includes('API error:')) {
        const match = err.message.match(/\d{3}/)
        status = match ? parseInt(match[0]) : undefined
      }

      let errMsg: string
      if (status === 429) {
        errMsg = "You're sending messages too quickly. Please wait a moment before continuing."
      } else if (status === 413) {
        errMsg = "Your message was too long. Please try a shorter response."
      } else if (status === 401 || status === 403) {
        errMsg = "Your session has expired. Redirecting to login..."
        router.push('/login')
      } else if (status === 500) {
        errMsg = "Alex encountered a technical issue. Your session is saved — please try again in a moment."
      } else {
        errMsg = "Something went wrong. Your session is saved — please refresh and continue."
      }

      const errorId = Date.now().toString(36)
      // Intentional console.error for client-side error tracking
      console.error(JSON.stringify({
        level: 'error',
        message: 'Alex API error in client',
        errorId,
        timestamp: new Date().toISOString(),
      }))

      setMessages((prev) => [...prev, { role: 'assistant', content: `${errMsg} (Ref: ${errorId})` }])
    }

    setStreaming(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness])

  useEffect(() => {
    if (!phaseComplete || !customer || !sessionId || !sessionUuid || !activeBusiness) return
    setPhaseComplete(false)
    const ctx = buildCustomerContext(activeBusiness)
    callAlexApi(
      messages,
      [],
      phaseTranscriptsRef.current,
      phase,
      ctx,
      customer,
      sessionId,
      sessionUuid,
      startedAt
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseComplete])

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || streaming || !customer || !sessionId || !sessionUuid || !activeBusiness) return

    setInput('')

    const ctx = buildCustomerContext(activeBusiness)

    let updatedMessages: Message[]
    let updatedPhaseMessages: Message[]

    if (openingMessage !== null) {
      updatedMessages = [
        { role: 'assistant', content: openingMessage },
        { role: 'user', content: text },
      ]
      updatedPhaseMessages = [{ role: 'user', content: text }]
      setOpeningMessage(null)
    } else {
      updatedMessages = [...messages, { role: 'user', content: text }]
      updatedPhaseMessages = [...phaseMessages, { role: 'user', content: text }]
    }

    setMessages(updatedMessages)
    setPhaseMessages(updatedPhaseMessages)

    await callAlexApi(
      updatedMessages,
      updatedPhaseMessages,
      phaseTranscriptsRef.current,
      phase,
      ctx,
      customer,
      sessionId,
      sessionUuid,
      startedAt
    )
  }

  if (initializing) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        style={{ minHeight: '60vh' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: '#191654' }}
        >
          <MessageSquare size={32} style={{ color: '#43C6AC' }} />
        </div>
        <div className="text-center">
          <h2
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
          >
            Starting your SignalMap interview...
          </h2>
          <p style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
            Setting up your interview
          </p>
        </div>
        <Loader size={24} className="animate-spin" style={{ color: '#43C6AC' }} />
      </div>
    )
  }

  // ICP ALREADY COMPLETE SCREEN
  if (completedSession) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center" style={{ maxWidth: 480 }}>
          <CheckCircle size={56} style={{ color: '#43C6AC' }} className="mx-auto mb-4" />
          <h2
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
          >
            Your SignalMap is complete.
          </h2>
          <p className="mb-6" style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
            Alex has already built your customer intelligence for{' '}
            {activeBusiness?.business_name || 'your business'}. Your ICP document is in your deliverables.
          </p>

          <Link href="/dashboard/deliverables">
            <button
              className="w-full py-3 rounded-xl text-white font-semibold text-sm mb-4"
              style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
            >
              View My SignalMap →
            </button>
          </Link>

          <div
            className="p-4 border rounded-xl"
            style={{ borderColor: '#e5e7eb' }}
          >
            <p className="text-sm text-center mb-3" style={{ color: '#6b7280' }}>
              Want to start fresh with a new session?
            </p>
            <button
              onClick={() => setShowRebuildConfirm(true)}
              className="w-full py-2.5 rounded-xl text-sm font-medium border"
              style={{
                color: '#191654',
                borderColor: '#191654',
                backgroundColor: 'transparent',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              Rebuild My ICP
            </button>
          </div>

          {/* Rebuild Confirmation Modal */}
          {showRebuildConfirm && (
            <div
              className="fixed inset-0 z-[900] flex items-center justify-center p-4"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            >
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
                >
                  Are you sure?
                </h3>
                <p className="text-sm mb-6" style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
                  Starting a new session will archive your current SignalMap. Your previous ICP will still be
                  accessible in your session history but your active deliverables will be replaced.
                </p>
                <button
                  onClick={handleConfirmRebuild}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm mb-3"
                  style={{ backgroundColor: '#43C6AC', fontFamily: 'DM Sans, sans-serif' }}
                >
                  Yes, Start Fresh
                </button>
                <button
                  onClick={() => setShowRebuildConfirm(false)}
                  className="w-full py-3 rounded-xl text-sm font-medium border"
                  style={{
                    color: '#6b7280',
                    borderColor: '#e5e7eb',
                    backgroundColor: 'transparent',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  Cancel — Keep My Current ICP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-6 -m-6 md:-m-8" style={{ height: 'calc(100vh - 73px)' }}>
      {/* Phase sidebar */}
      <div
        className="hidden lg:flex flex-col w-64 flex-shrink-0 p-6"
        style={{ backgroundColor: '#f9fafb', borderRight: '1px solid #e5e7eb' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#9ca3af' }}>
          SignalMap Progress
        </h3>
        <div className="space-y-1">
          {([1, 2, 3, 4] as Phase[]).map((phaseNum) => {
            const isActive = phase === phaseNum
            const isComplete = phase > phaseNum
            const config = getPhaseConfig(phaseNum)

            return (
              <div
                key={phaseNum}
                className="p-3 rounded-lg transition-all"
                style={{
                  backgroundColor: isActive ? 'rgba(67,198,172,0.08)' : 'transparent',
                  borderLeft: isActive ? '3px solid #43C6AC' : '3px solid transparent',
                }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor: isComplete ? '#43C6AC' : isActive ? '#191654' : '#e5e7eb',
                      color: isComplete || isActive ? '#ffffff' : '#9ca3af',
                    }}
                  >
                    {isComplete ? '✓' : phaseNum}
                  </div>
                  <div>
                    <p
                      className="text-xs font-semibold"
                      style={{ color: isActive ? '#191654' : isComplete ? '#43C6AC' : '#9ca3af' }}
                    >
                      Phase {phaseNum}
                    </p>
                    <p
                      className="text-xs leading-tight mt-0.5"
                      style={{ color: isActive ? '#374151' : '#9ca3af' }}
                    >
                      {config.title}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex flex-col max-w-2xl">
                  <span className="text-xs font-semibold mb-1 ml-1" style={{ color: '#9ca3af' }}>Alex</span>
                  <div
                    className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed prose prose-sm max-w-none"
                    style={{ backgroundColor: '#f3f4f6', color: '#1f2937', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {i === messages.length - 1 && streaming && msg.content === '' ? (
                      <span className="inline-block w-2 h-4 animate-pulse" style={{ backgroundColor: '#43C6AC' }} />
                    ) : (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )}
                  </div>
                </div>
              )}

              {msg.role === 'user' && (
                <div
                  className="max-w-xl px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
                  style={{ backgroundColor: '#191654', color: '#ffffff', fontFamily: 'DM Sans, sans-serif' }}
                >
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {streaming && (
            <div className="flex justify-start">
              <div className="flex gap-1 px-4 py-3 rounded-2xl" style={{ backgroundColor: '#f3f4f6' }}>
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#9ca3af', animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#9ca3af', animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#9ca3af', animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Completion card */}
        {completed && (
          <div
            className="mx-6 mb-4 p-5 rounded-2xl border-2 flex items-center justify-between gap-4"
            style={{ borderColor: '#43C6AC', backgroundColor: '#f0fdf9' }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle size={24} style={{ color: '#43C6AC', flexShrink: 0 }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}>
                  Your SignalMap is ready
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
                  View, download as PDF, or copy for Google Docs
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/deliverables"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold flex-shrink-0"
              style={{ backgroundColor: '#191654', fontFamily: 'DM Sans, sans-serif' }}
            >
              View Deliverables <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
          <form onSubmit={handleSend} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming || completed}
              placeholder={completed ? 'Session complete' : 'Type your answer...'}
              className="flex-1 px-4 py-3 rounded-xl border text-sm outline-none transition-all"
              style={{ borderColor: '#e5e7eb', fontFamily: 'DM Sans, sans-serif' }}
              onFocus={(e) => {
                e.target.style.borderColor = '#43C6AC'
                e.target.style.boxShadow = '0 0 0 3px rgba(67,198,172,0.15)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
            <button
              type="submit"
              disabled={streaming || !input.trim() || completed}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: '#43C6AC' }}
            >
              {streaming ? (
                <Loader size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
