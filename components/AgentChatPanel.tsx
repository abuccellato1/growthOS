'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader, Sparkles } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  patch?: { target: string; value: string } | null
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
    'The hook isn\'t strong enough',
    'Make this more platform-native',
    'Punch up the opening line',
    'This feels too formal',
  ],
  signal_sequences: [
    'The subject line isn\'t compelling',
    'Email 2 feels disconnected',
    'The CTA is too vague',
    'Make the body shorter and punchier',
  ],
}

export default function AgentChatPanel({
  isOpen, onClose, moduleType, agentName, agentTagline,
  businessId, outputId, currentOutput, onPatch,
}: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const color = AGENT_COLORS[moduleType] || '#43C6AC'
  const starters = AGENT_STARTERS[moduleType] || []

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: `Hey, I\u2019m ${agentName}. I\u2019ve reviewed everything we generated. What would you like to refine?`,
          patch: null,
        }])
      }
    }
  }, [isOpen])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
          currentOutput,
          messages: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
          userMessage,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        const { message, patch } = json.data
        setMessages(prev => [...prev, { role: 'assistant', content: message, patch }])
        if (patch?.target && patch?.value) {
          onPatch(patch.target, patch.value)
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong \u2014 try again.', patch: null }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error \u2014 try again.', patch: null }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-20"
        onClick={onClose}
      />

      {/* Panel */}
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

        {/* Messages */}
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
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
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
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ backgroundColor: '#9ca3af', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick starters — only show before first user message */}
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

        {/* Input */}
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
              {loading ? (
                <Loader size={14} className="animate-spin text-white" />
              ) : (
                <Send size={14} style={{ color: '#fff' }} />
              )}
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: '#d1d5db' }}>Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </>
  )
}
