'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader, Sparkles, MessageSquare, Settings, CheckCircle } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  patch?: { target: string; value: string } | null
}

interface AgentInstructions {
  instructions: string
  alwaysInclude: string[]
  neverInclude: string[]
}

interface AgentChatPanelProps {
  isOpen: boolean
  onClose: () => void
  moduleType: string
  agentName: string
  agentTagline: string
  businessId: string
  outputId: string
  currentOutput: Record<string, unknown>
  onPatch: (target: string, value: string) => void
}

const AGENT_COLORS: Record<string, string> = {
  signal_ads: '#ef4444',
  signal_content: '#8b5cf6',
  signal_sequences: '#43C6AC',
}

const AGENT_STARTERS: Record<string, string[]> = {
  signal_ads: [
    'Make this headline more urgent',
    'The description is too generic',
    'Rewrite for a colder audience',
    'Add more social proof',
  ],
  signal_content: [
    "The hook isn't strong enough",
    'Make this more platform-native',
    'Punch up the opening line',
    'This feels too formal',
  ],
  signal_sequences: [
    "The subject line isn't compelling",
    'Email 2 feels disconnected',
    'The CTA is too vague',
    'Make the body shorter and punchier',
  ],
}

const AGENT_MODULE_KEY: Record<string, string> = {
  signal_ads: 'signal_ads',
  signal_content: 'signal_content',
  signal_sequences: 'signal_sequences',
}

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
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed])
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
    if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1))
  }

  return (
    <div
      className="flex flex-wrap gap-1 p-2 rounded-lg border cursor-text min-h-9"
      style={{ borderColor: '#e5e7eb' }}
      onClick={() => inputRef.current?.focus()}>
      {tags.map(tag => (
        <span key={tag}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium"
          style={{ backgroundColor: 'rgba(25,22,84,0.07)', color: '#191654' }}>
          {tag}
          <button onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:opacity-70">
            <X size={9} />
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
        className="flex-1 text-xs outline-none bg-transparent min-w-20"
        style={{ color: '#374151' }}
      />
    </div>
  )
}

export default function AgentChatPanel({
  isOpen, onClose, moduleType, agentName, agentTagline,
  businessId, outputId, currentOutput, onPatch,
}: AgentChatPanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'instructions'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatSessionId = useRef(crypto.randomUUID())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [instructions, setInstructions] = useState('')
  const [alwaysInclude, setAlwaysInclude] = useState<string[]>([])
  const [neverInclude, setNeverInclude] = useState<string[]>([])
  const [instructionsSaving, setInstructionsSaving] = useState(false)
  const [instructionsSaved, setInstructionsSaved] = useState(false)
  const [instructionsLoaded, setInstructionsLoaded] = useState(false)

  const color = AGENT_COLORS[moduleType] || '#43C6AC'
  const starters = AGENT_STARTERS[moduleType] || []
  const agentKey = `${AGENT_MODULE_KEY[moduleType]}.${agentName.toLowerCase()}`

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!isOpen) return

    setTimeout(() => inputRef.current?.focus(), 300)

    if (messages.length === 0 && outputId) {
      fetch(`/api/agent-chat/history?outputId=${outputId}&businessId=${businessId}`)
        .then(r => r.json())
        .then(json => {
          if (json.data?.messages?.length > 0) {
            setMessages(json.data.messages.map((m: { role: 'user' | 'assistant'; content: string }) => ({
              role: m.role,
              content: m.content,
              patch: null,
            })))
            if (json.data.chatSessionId) {
              chatSessionId.current = json.data.chatSessionId
            }
          } else {
            setMessages([{
              role: 'assistant',
              content: `Hey, I\u2019m ${agentName}. I\u2019ve reviewed everything we generated. What would you like to refine?`,
              patch: null,
            }])
          }
        })
        .catch(() => {
          setMessages([{
            role: 'assistant',
            content: `Hey, I\u2019m ${agentName}. What would you like to refine?`,
            patch: null,
          }])
        })
    }

    if (!instructionsLoaded) {
      fetch(`/api/brand-voice/load?businessId=${businessId}`)
        .then(r => r.json())
        .then(json => {
          const prefs = json.data?.preferences as Record<string, unknown> || {}
          const [moduleKey, agentNameKey] = agentKey.split('.')
          const agentPrefs = (
            (prefs[moduleKey] as Record<string, unknown>)?.[agentNameKey] as AgentInstructions
          ) || null
          if (agentPrefs) {
            setInstructions(agentPrefs.instructions || '')
            setAlwaysInclude(agentPrefs.alwaysInclude || [])
            setNeverInclude(agentPrefs.neverInclude || [])
          }
          setInstructionsLoaded(true)
        })
        .catch(() => setInstructionsLoaded(true))
    }
  }, [isOpen])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function getCurrentInstructionsText(): string {
    const parts: string[] = []
    if (instructions) parts.push(instructions)
    if (alwaysInclude.length > 0) parts.push(`Always include: ${alwaysInclude.join(', ')}`)
    if (neverInclude.length > 0) parts.push(`Never include: ${neverInclude.join(', ')}`)
    return parts.join('\n')
  }

  async function handleSaveInstructions() {
    setInstructionsSaving(true)
    setInstructionsSaved(false)
    await fetch('/api/brand-voice/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        scope: 'agent',
        agentKey,
        data: { instructions, alwaysInclude, neverInclude },
      }),
    })
    setInstructionsSaving(false)
    setInstructionsSaved(true)
    setTimeout(() => setInstructionsSaved(false), 3000)
  }

  async function handleSend(text?: string) {
    const userMessage = text || input.trim()
    if (!userMessage || loading) return
    setInput('')

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/agent-chat/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          moduleType,
          outputId,
          chatSessionId: chatSessionId.current,
          currentOutput,
          messages: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
          userMessage,
          currentInstructions: getCurrentInstructionsText() || undefined,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        const { message, patch } = json.data
        setMessages(prev => [...prev, { role: 'assistant', content: message, patch }])
        if (patch?.target && patch?.value) onPatch(patch.target, patch.value)
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Something went wrong \u2014 try again.',
          patch: null,
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Network error \u2014 try again.',
        patch: null,
      }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!isOpen) return null

  const hasInstructions = instructions || alwaysInclude.length > 0 || neverInclude.length > 0

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black bg-opacity-20" onClick={onClose} />

      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: '420px',
          backgroundColor: '#fff',
          borderLeft: '1px solid #e5e7eb',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: color }}>
              {agentName[0]}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#191654' }}>{agentName}</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>{agentTagline}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} style={{ color: '#9ca3af' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: '#e5e7eb' }}>
          <button
            onClick={() => setActiveTab('chat')}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold border-b-2 transition-all"
            style={{
              borderBottomColor: activeTab === 'chat' ? color : 'transparent',
              color: activeTab === 'chat' ? '#191654' : '#9ca3af',
            }}>
            <MessageSquare size={12} /> Chat
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold border-b-2 transition-all"
            style={{
              borderBottomColor: activeTab === 'instructions' ? color : 'transparent',
              color: activeTab === 'instructions' ? '#191654' : '#9ca3af',
            }}>
            <Settings size={12} />
            Instructions
            {hasInstructions && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }} />
            )}
          </button>
        </div>

        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: color }}>
                      {agentName[0]}
                    </div>
                  )}
                  <div className="max-w-xs">
                    <div className="px-3 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={{
                        backgroundColor: msg.role === 'user' ? '#191654' : '#f9fafb',
                        color: msg.role === 'user' ? '#fff' : '#374151',
                        borderRadius: msg.role === 'user'
                          ? '16px 16px 4px 16px'
                          : '16px 16px 16px 4px',
                      }}>
                      {msg.content}
                    </div>
                    {msg.patch && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold"
                        style={{ color }}>
                        <Sparkles size={11} /> Updated live in results
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: color }}>
                    {agentName[0]}
                  </div>
                  <div className="px-3 py-2.5 rounded-2xl" style={{ backgroundColor: '#f9fafb' }}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ backgroundColor: '#9ca3af', animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {messages.filter(m => m.role === 'user').length === 0 && (
              <div className="px-5 pb-3 flex flex-wrap gap-1.5 flex-shrink-0">
                {starters.map((s, i) => (
                  <button key={i} onClick={() => handleSend(s)}
                    className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all hover:border-gray-400"
                    style={{ borderColor: '#e5e7eb', color: '#6b7280', backgroundColor: '#fff' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="px-4 py-4 border-t flex-shrink-0" style={{ borderColor: '#e5e7eb' }}>
              <div className="flex items-end gap-2 p-3 rounded-2xl border"
                style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask ${agentName} to refine anything\u2026`}
                  className="flex-1 text-sm bg-transparent outline-none resize-none"
                  style={{ color: '#374151', maxHeight: '120px' }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="p-2 rounded-xl flex-shrink-0 transition-all disabled:opacity-40"
                  style={{ backgroundColor: color }}>
                  {loading
                    ? <Loader size={14} className="animate-spin text-white" />
                    : <Send size={14} style={{ color: '#fff' }} />}
                </button>
              </div>
              <p className="text-center text-xs mt-2" style={{ color: '#d1d5db' }}>
                Enter to send \u00b7 Shift+Enter for new line
              </p>
            </div>
          </>
        )}

        {activeTab === 'instructions' && (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            <div className="p-4 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                Instructions you set here apply every time {agentName} writes for this business.
                They stack on top of your global brand voice.
              </p>
              <a
                href="/dashboard/brand-voice"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold mt-2 inline-block"
                style={{ color: color }}>
                Edit global brand voice \u2192
              </a>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: '#374151' }}>
                Instructions for {agentName}
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <textarea
                rows={5}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder={
                  moduleType === 'signal_ads'
                    ? "e.g. Always lead with the problem not the solution. Never use the word 'best'."
                    : moduleType === 'signal_sequences'
                    ? "e.g. Emails are always signed from the owner personally. Subject lines under 7 words."
                    : "e.g. Always start with a hook question. LinkedIn posts in first person from the owner."
                }
                className="w-full text-xs px-3 py-2.5 rounded-lg border outline-none resize-none"
                style={{ borderColor: '#e5e7eb', color: '#374151', lineHeight: '1.6' }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: '#374151' }}>
                Always Include
                <span className="font-normal text-gray-400 ml-1">\u2014 press Enter to add</span>
              </label>
              <TagInput
                tags={alwaysInclude}
                onChange={setAlwaysInclude}
                placeholder="e.g. free consultation, 20 years experience\u2026"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: '#374151' }}>
                Never Include
                <span className="font-normal text-gray-400 ml-1">\u2014 press Enter to add</span>
              </label>
              <TagInput
                tags={neverInclude}
                onChange={setNeverInclude}
                placeholder="e.g. discount, guaranteed, best in class\u2026"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {instructionsSaved && (
                <span className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: '#43C6AC' }}>
                  <CheckCircle size={13} /> Saved \u2014 {agentName} will use these going forward
                </span>
              )}
              {!instructionsSaved && (
                <p className="text-xs" style={{ color: '#9ca3af' }}>
                  {hasInstructions ? 'Instructions active' : 'No instructions set yet'}
                </p>
              )}
              <button
                onClick={handleSaveInstructions}
                disabled={instructionsSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40 flex-shrink-0 ml-3"
                style={{ backgroundColor: color }}>
                {instructionsSaving
                  ? <Loader size={12} className="animate-spin" />
                  : <CheckCircle size={12} />}
                {instructionsSaving ? 'Saving\u2026' : 'Save instructions'}
              </button>
            </div>

            <div className="pt-2 border-t" style={{ borderColor: '#f3f4f6' }}>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Switch to the Chat tab to refine your current output.
                {agentName} will automatically apply these instructions in every conversation.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
