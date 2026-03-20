'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/client'
import { getPhaseConfig, PHASE_TRANSITIONS } from '@/lib/prompts'
import { generateUUID } from '@/lib/utils'
import { Customer, Phase, Message } from '@/types'
import { Send, CheckCircle, Loader } from 'lucide-react'

function buildCustomerContext(customer: Customer): string {
  let ctx = `CUSTOMER CONTEXT — collected during onboarding, do not ask again:
- Business Name: ${customer.business_name || 'Not provided'}
- Website: ${customer.website_url || 'Not provided'}
- Business Type: ${customer.business_type || 'Not provided'}
- Primary Service/Product: ${customer.primary_service || 'Not provided'}
- Geographic Market: ${customer.geographic_market || 'Not provided'}
- Biggest Marketing Challenge: ${customer.marketing_challenge || 'Not provided'}
- Current Acquisition Channels: ${(customer.current_channels || []).join(', ') || 'Not provided'}

Use this context to skip basic discovery questions you already know the answer to. Start Phase 1 with more specific, deeper questions building on what is already known.`

  const research = customer.business_research
  if (research && research.websiteFound) {
    ctx += `\n\nPRE-SESSION RESEARCH:\n`
    ctx += `What they do: ${research.whatTheyDo}\n`
    ctx += `Years in business: ${research.yearsInBusiness}\n`
    ctx += `Primary product: ${research.primaryProduct}\n`
    ctx += `Apparent target customer: ${research.apparentTargetCustomer}\n`
    ctx += `Differentiators: ${research.differentiators}\n`
    ctx += `Note: This is surface-level website data only. Find who is ACTUALLY buying.\n`
  }

  return ctx
}

function buildOpeningMessage(customer: Customer): string {
  const firstName = customer.first_name || 'there'
  return `Hi ${firstName}! I'm Alex, your Client Discovery Strategist at Good Fellas Digital Marketing. I've reviewed what you shared about your business during setup, and I'm ready to dig in. Let's start by making sure I have a clear picture of what's actually happening in your business right now. What does your business do — and what's the core problem you solve for your customers?`
}

async function persistSession(
  msgs: Message[],
  currentPhase: Phase,
  status: string,
  sid: string,
  uuid: string,
  custId: string,
  sa: string | null,
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
  if (icpData) payload.icp_data = icpData
  if (status === 'completed') payload.completed_at = new Date().toISOString()
  await supabase.from('sessions').upsert(payload)
}

export default function AlexPage() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionUuid, setSessionUuid] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [phase, setPhase] = useState<Phase>(1)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [phaseComplete, setPhaseComplete] = useState(false)
  // Tracks whether the opening message has been sent by the user yet
  const [openingMessage, setOpeningMessage] = useState<string | null>(null)

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

      // Require intake completion before starting Alex session
      const intakeComplete = !!(
        customerData.business_name?.trim() &&
        customerData.website_url?.trim() &&
        customerData.primary_service?.trim() &&
        customerData.geographic_market?.trim()
      )
      if (!intakeComplete) { router.push('/dashboard'); return }

      setCustomer(customerData)

      // Look for existing in-progress session
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('customer_id', customerData.id)
        .in('status', ['in_progress', 'not_started'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingSession && existingSession.message_history?.length > 0) {
        setSessionId(existingSession.id)
        setSessionUuid(existingSession.session_uuid)
        setMessages(existingSession.message_history)
        setPhase(existingSession.phase as Phase)
        setStartedAt(existingSession.started_at)
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
        session_uuid: uuid,
        phase: 1,
        message_history: [],
        status: 'not_started',
        started_at: null,
      })

      // Show hardcoded opening message — no API call on mount
      const greeting = buildOpeningMessage(customerData)
      setOpeningMessage(greeting)
      setMessages([{ role: 'assistant', content: greeting }])
      setInitializing(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const callAlexApi = useCallback(async (
    currentMessages: Message[],
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
          messages: currentMessages,
          phase: currentPhase,
          customerContext: currentPhase === 1 ? customerContext : undefined,
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      fullText = data.reply ?? ''

      const finalMessages: Message[] = [...currentMessages, { role: 'assistant', content: fullText }]
      setMessages(finalMessages)

      if (data.shouldAdvancePhase) {
        const nextPhase = (currentPhase + 1) as Phase
        if (nextPhase <= 4) {
          setPhase(nextPhase)
        }
        const transitionText = PHASE_TRANSITIONS[currentPhase]
        if (transitionText) {
          const withTransition: Message[] = [
            ...finalMessages,
            { role: 'assistant', content: transitionText },
          ]
          setMessages(withTransition)
          await persistSession(withTransition, nextPhase <= 4 ? nextPhase : currentPhase, 'in_progress', sid, uuid, cust.id, actualStartedAt)
          setTimeout(() => setPhaseComplete(true), 1500)
        }
      } else if (data.isIcpComplete) {
        const icpData = { raw: fullText }
        await persistSession(finalMessages, 4, 'completed', sid, uuid, cust.id, actualStartedAt, icpData)

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
              session_id: sid,
              deliverable_type: pt,
              status: 'pending',
            }))
          )
        }

        if (process.env.NEXT_PUBLIC_MAKE_WEBHOOK_URL) {
          await fetch(process.env.NEXT_PUBLIC_MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: cust.email,
              session_uuid: uuid,
              icp_content: fullText,
              purchased_products: purchaseTypes,
            }),
          }).catch(console.error)
        }

        setCompleted(true)
        setTimeout(() => router.push('/dashboard/deliverables'), 3000)
      } else {
        await persistSession(finalMessages, currentPhase, 'in_progress', sid, uuid, cust.id, actualStartedAt)
      }
    } catch (err) {
      console.error('API error:', err)
      const errMsg = "I'm sorry, I encountered an error. Please try again."
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }])
    }

    setStreaming(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [router])

  // Auto-advance phase when phaseComplete flag is set
  useEffect(() => {
    if (!phaseComplete || !customer || !sessionId || !sessionUuid) return
    setPhaseComplete(false)
    const ctx = buildCustomerContext(customer)
    callAlexApi(messages, phase, ctx, customer, sessionId, sessionUuid, startedAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseComplete])

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || streaming || !customer || !sessionId || !sessionUuid) return

    setInput('')

    const ctx = buildCustomerContext(customer)

    // First user message: include the opening message as the first assistant turn
    // so Anthropic always receives at least one message.
    let messagesForApi: Message[]
    if (openingMessage !== null) {
      messagesForApi = [
        { role: 'assistant', content: openingMessage },
        { role: 'user', content: text },
      ]
      setOpeningMessage(null) // opening message is now in history
    } else {
      messagesForApi = [...messages, { role: 'user', content: text }]
    }

    setMessages(messagesForApi)
    await callAlexApi(messagesForApi, phase, ctx, customer, sessionId, sessionUuid, startedAt)
  }

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader size={36} className="animate-spin mx-auto mb-3" style={{ color: '#43C6AC' }} />
          <p style={{ color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>Starting your session...</p>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <CheckCircle size={56} className="mx-auto mb-4" style={{ color: '#43C6AC' }} />
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            Your ICP is complete.
          </h2>
          <p style={{ color: '#6b7280' }}>Redirecting to your deliverables...</p>
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
          Session Progress
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

        {/* Input */}
        <div className="border-t p-4" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
          <form onSubmit={handleSend} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming}
              placeholder="Type your answer..."
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
              disabled={streaming || !input.trim()}
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
