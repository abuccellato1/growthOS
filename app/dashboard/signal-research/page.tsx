'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, Send, Loader, Paperclip, Link as LinkIcon,
  Plus, Vault, CheckCircle,
  ChevronRight, X, FileText, Globe
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  attachments?: AttachmentMeta[]
  urlFetched?: { url: string; title: string }
}

interface AttachmentMeta {
  storagePath: string
  filename: string
  mediaType: string
  size: number
}

interface ResearchSession {
  id: string
  title: string
  vault_saved: boolean
  vault_label: string | null
  status: string
  auto_generated: boolean
  created_at: string
  updated_at: string
}

function NoraWelcome({ onStart }: { onStart: (message: string) => void }) {
  const STARTER_TOPICS = [
    'Research my top 3 competitors',
    'What are the latest trends in my industry?',
    'Find proof points and statistics for my marketing',
    'What messaging gaps do my competitors have?',
  ]

  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}>
          <Search size={28} style={{ color: '#6366f1' }} />
        </div>
        <h2 className="text-2xl font-bold mb-3"
          style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
          Hi, I&apos;m Nora.
        </h2>
        <p className="text-sm leading-relaxed mb-2" style={{ color: '#6b7280' }}>
          I&apos;m your research specialist. While Alex knows your business inside out,
          I go out and find what&apos;s happening in your market.
        </p>
        <p className="text-sm leading-relaxed mb-6" style={{ color: '#6b7280' }}>
          I can search the web, analyze files you upload, and read any URL you share.
          Everything I find can be saved to SignalVault for Jaimie, Emily, and Sofia to use.
        </p>
        <div className="space-y-2">
          {STARTER_TOPICS.map((topic, i) => (
            <button key={i}
              onClick={() => onStart(topic)}
              className="w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all hover:border-indigo-300 hover:bg-indigo-50"
              style={{ borderColor: '#e5e7eb', color: '#374151' }}>
              <ChevronRight size={14} className="inline mr-2" style={{ color: '#6366f1' }} />
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionItem({
  session,
  isActive,
  onClick,
}: {
  session: ResearchSession
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
      style={{
        backgroundColor: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
        border: isActive ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
      }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <p className="text-xs font-semibold truncate flex-1"
          style={{ color: isActive ? '#4f46e5' : '#374151' }}>
          {session.vault_label || session.title || 'Research session'}
        </p>
        {session.auto_generated && (
          <span className="text-xs font-medium flex-shrink-0"
            style={{ color: '#9ca3af' }}>Auto</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {session.vault_saved && (
          <span className="text-xs font-medium" style={{ color: '#43C6AC' }}>Saved</span>
        )}
        <span className="text-xs" style={{ color: '#9ca3af' }}>
          {new Date(session.updated_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric',
          })}
        </span>
      </div>
    </button>
  )
}

export default function SignalResearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [businessId, setBusinessId] = useState<string | null>(null)

  const [sessions, setSessions] = useState<ResearchSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentMeta[]>([])
  const [pendingUrl, setPendingUrl] = useState<{
    url: string; title: string; content: string
  } | null>(null)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [offerSave, setOfferSave] = useState(false)
  const [savingToVault, setSavingToVault] = useState(false)
  const [savedToVault, setSavedToVault] = useState(false)
  const [vaultLabel, setVaultLabel] = useState('')
  const [showLabelInput, setShowLabelInput] = useState(false)

  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [urlError, setUrlError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadSessions = useCallback(async (bizId: string) => {
    try {
      const res = await fetch(`/api/nora/sessions?businessId=${bizId}`)
      const json = await res.json()
      setSessions(json.data?.sessions || [])
      return json.data?.sessions || []
    } catch {
      return []
    }
  }, [])

  const loadSessionMessages = useCallback(async (sessionId: string, bizId: string) => {
    setSessionLoading(true)
    setMessages([])
    setOfferSave(false)
    try {
      const res = await fetch(`/api/nora/session?businessId=${bizId}&sessionId=${sessionId}`)
      const json = await res.json()
      if (res.ok && json.data?.session) {
        const session = json.data.session
        const loaded = (session.messages as Array<{
          role: 'user' | 'assistant'
          content: string
          timestamp?: string
        }> || []).map((m: { role: 'user' | 'assistant'; content: string; timestamp?: string }) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }))
        setMessages(loaded)
        setSavedToVault(session.vault_saved || false)
        setVaultLabel(session.vault_label || '')
      }
    } catch { /* non-fatal */ }
    setSessionLoading(false)
  }, [])

  useEffect(() => {
    const id = localStorage.getItem('signalshot_active_business')
    if (!id) { router.push('/dashboard'); return }
    setBusinessId(id)

    const sessionIdParam = searchParams.get('sessionId')

    loadSessions(id).then((sessionList: ResearchSession[]) => {
      setSessionsLoading(false)
      if (sessionIdParam) {
        const target = sessionList.find((s: ResearchSession) => s.id === sessionIdParam)
        if (target) {
          setActiveSessionId(target.id)
          setSavedToVault(target.vault_saved)
          loadSessionMessages(target.id, id)
        }
      }
    })
  }, [router, searchParams, loadSessions, loadSessionMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function startNewSession() {
    setActiveSessionId(null)
    setMessages([])
    setPendingAttachments([])
    setPendingUrl(null)
    setOfferSave(false)
    setSavedToVault(false)
    setVaultLabel('')
    setShowLabelInput(false)
    setInput('')
    setShowUrlInput(false)
    setUrlInput('')
    setUrlError('')
    setUploadError('')
  }

  async function handleSend(overrideMessage?: string) {
    const userMessage = overrideMessage || input.trim()
    if (!userMessage || loading || !businessId) return
    setInput('')
    setUploadError('')

    const userMsg: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
      urlFetched: pendingUrl
        ? { url: pendingUrl.url, title: pendingUrl.title }
        : undefined,
    }

    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setOfferSave(false)

    const urlContentToSend = pendingUrl
    const attachmentsToSend = [...pendingAttachments]
    setPendingAttachments([])
    setPendingUrl(null)
    setShowUrlInput(false)
    setUrlInput('')

    try {
      const res = await fetch('/api/nora/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          sessionId: activeSessionId || undefined,
          userMessage,
          attachmentUrls: attachmentsToSend.map(a => ({
            url: a.storagePath,
            filename: a.filename,
            mediaType: a.mediaType,
          })),
          urlContent: urlContentToSend || undefined,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const json = await res.json()
      if (res.ok) {
        const { response, sessionId: newSessionId, offerSave: shouldOfferSave } = json.data

        if (newSessionId && !activeSessionId) {
          setActiveSessionId(newSessionId)
          loadSessions(businessId)
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        }])

        if (shouldOfferSave) setOfferSave(true)
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: json.error || 'Something went wrong \u2014 try again.',
          timestamp: new Date().toISOString(),
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Network error \u2014 try again.',
        timestamp: new Date().toISOString(),
      }])
    }
    setLoading(false)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !businessId) return

    setUploadingFile(true)
    setUploadError('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('businessId', businessId)
    if (activeSessionId) formData.append('sessionId', activeSessionId)

    try {
      const res = await fetch('/api/nora/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (res.ok) {
        setPendingAttachments(prev => [...prev, json.data])
      } else {
        setUploadError(json.error || 'Upload failed')
      }
    } catch {
      setUploadError('Upload failed \u2014 try again')
    }
    setUploadingFile(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFetchUrl() {
    if (!urlInput.trim() || !businessId) return
    setFetchingUrl(true)
    setUrlError('')

    try {
      const res = await fetch('/api/nora/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, url: urlInput.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        setPendingUrl({
          url: urlInput.trim(),
          title: json.data.title,
          content: json.data.content,
        })
        setShowUrlInput(false)
        setUrlInput('')
      } else {
        setUrlError(json.error || 'Failed to fetch URL')
      }
    } catch {
      setUrlError('Network error \u2014 check the URL and try again')
    }
    setFetchingUrl(false)
  }

  async function handleSaveToVault() {
    if (!businessId || !activeSessionId) return
    if (!vaultLabel.trim()) { setShowLabelInput(true); return }

    setSavingToVault(true)
    try {
      const res = await fetch('/api/nora/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          sessionId: activeSessionId,
          label: vaultLabel,
        }),
      })
      if (res.ok) {
        setSavedToVault(true)
        setOfferSave(false)
        setShowLabelInput(false)
        loadSessions(businessId)
      }
    } catch { /* non-fatal */ }
    setSavingToVault(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const hasConversation = messages.length > 0
  const canSend = (input.trim().length > 0 ||
    pendingAttachments.length > 0 ||
    pendingUrl !== null) && !loading

  return (
    <div className="flex w-full" style={{ height: 'calc(100vh - 137px)' }}>

      <div className="flex-shrink-0 flex flex-col border-r"
        style={{ width: '240px', borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}>

        <div className="p-4 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}>
              <Search size={14} style={{ color: '#6366f1' }} />
            </div>
            <p className="text-xs font-bold" style={{ color: '#191654' }}>
              SignalResearch
            </p>
          </div>
          <button
            onClick={startNewSession}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            title="New research session">
            <Plus size={14} style={{ color: '#6b7280' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessionsLoading ? (
            <div className="flex justify-center py-4">
              <Loader size={16} className="animate-spin" style={{ color: '#9ca3af' }} />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: '#9ca3af' }}>
              No research yet
            </p>
          ) : (
            sessions.map(session => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={activeSessionId === session.id}
                onClick={() => {
                  if (activeSessionId === session.id) return
                  setActiveSessionId(session.id)
                  setOfferSave(false)
                  setPendingAttachments([])
                  setPendingUrl(null)
                  if (businessId) loadSessionMessages(session.id, businessId)
                }}
              />
            ))
          )}
        </div>

        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: '#e5e7eb' }}>
          <button
            onClick={() => router.push('/dashboard/signal-vault')}
            className="flex items-center gap-1.5 w-full text-xs font-semibold px-3 py-2 rounded-lg transition-all hover:bg-gray-200"
            style={{ color: '#6b7280' }}>
            <Vault size={13} /> View SignalVault
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">

        <div className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
          style={{ borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: '#6366f1' }}>
              N
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#191654' }}>Nora</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Research specialist \u00b7 Web search \u00b7 File analysis \u00b7 URL reading
              </p>
            </div>
          </div>
          {savedToVault && (
            <span
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
              <CheckCircle size={12} /> Saved to SignalVault
            </span>
          )}
        </div>

        {sessionLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}>
                <div className="w-5 h-5 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#6366f1', borderTopColor: 'transparent' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: '#374151' }}>
                Loading conversation…
              </p>
            </div>
          </div>
        ) : !hasConversation ? (
          <NoraWelcome onStart={msg => handleSend(msg)} />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {messages.map((msg, i) => (
              <div key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: '#6366f1' }}>
                    N
                  </div>
                )}
                <div style={{ maxWidth: '75%' }}>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                      {msg.attachments.map((a, j) => (
                        <span key={j}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                          style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                          <FileText size={11} /> {a.filename}
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.urlFetched && (
                    <div
                      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mb-2"
                      style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                      <Globe size={11} />
                      <span className="truncate max-w-xs">
                        {msg.urlFetched.title || msg.urlFetched.url}
                      </span>
                    </div>
                  )}
                  <div
                    className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                    style={{
                      backgroundColor: msg.role === 'user' ? '#191654' : '#f9fafb',
                      color: msg.role === 'user' ? '#fff' : '#374151',
                      borderRadius: msg.role === 'user'
                        ? '18px 18px 4px 18px'
                        : '18px 18px 18px 4px',
                    }}>
                    {msg.role === 'user' ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <div className="prose-nora">
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => <p className="font-bold text-base mb-2 mt-3" style={{ color: '#191654' }}>{children}</p>,
                            h2: ({ children }) => <p className="font-bold text-sm mb-1.5 mt-3" style={{ color: '#191654' }}>{children}</p>,
                            h3: ({ children }) => <p className="font-semibold text-sm mb-1 mt-2" style={{ color: '#374151' }}>{children}</p>,
                            p: ({ children }) => <p className="mb-2 last:mb-0 text-sm leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="mb-2 space-y-0.5 pl-4">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-2 space-y-0.5 pl-4 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="text-sm leading-relaxed list-disc">{children}</li>,
                            strong: ({ children }) => <strong className="font-bold" style={{ color: '#191654' }}>{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            hr: () => <hr className="my-3" style={{ borderColor: '#e5e7eb' }} />,
                            code: ({ children }) => <code className="text-xs px-1 py-0.5 rounded font-mono" style={{ backgroundColor: 'rgba(25,22,84,0.06)', color: '#191654' }}>{children}</code>,
                          }}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: '#6366f1' }}>
                  N
                </div>
                <div className="px-4 py-3 rounded-2xl" style={{ backgroundColor: '#f9fafb' }}>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i}
                          className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{
                            backgroundColor: '#9ca3af',
                            animationDelay: `${i * 0.15}s`,
                          }} />
                      ))}
                    </div>
                    <span className="text-xs" style={{ color: '#9ca3af' }}>
                      Researching\u2026
                    </span>
                  </div>
                </div>
              </div>
            )}

            {offerSave && !savedToVault && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-4 rounded-2xl border w-full max-w-sm"
                  style={{
                    borderColor: 'rgba(67,198,172,0.3)',
                    backgroundColor: 'rgba(67,198,172,0.04)',
                  }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#191654' }}>
                    Save this research to SignalVault?
                  </p>
                  <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                    Jaimie, Emily, and Sofia will reference it in future generations.
                  </p>
                  {showLabelInput ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={vaultLabel}
                        onChange={e => setVaultLabel(e.target.value)}
                        placeholder="Label this research\u2026"
                        className="flex-1 text-xs px-3 py-1.5 rounded-lg border outline-none"
                        style={{ borderColor: '#e5e7eb', color: '#374151' }}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveToVault() }}
                      />
                      <button
                        onClick={handleSaveToVault}
                        disabled={savingToVault || !vaultLabel.trim()}
                        className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold disabled:opacity-40"
                        style={{ backgroundColor: '#43C6AC' }}>
                        {savingToVault
                          ? <Loader size={12} className="animate-spin" />
                          : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowLabelInput(true)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-semibold"
                        style={{ backgroundColor: '#43C6AC' }}>
                        <Vault size={12} /> Save to SignalVault
                      </button>
                      <button
                        onClick={() => setOfferSave(false)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                        style={{ color: '#9ca3af' }}>
                        Keep chatting
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {savedToVault && (
              <div className="flex justify-center">
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
                  <CheckCircle size={12} /> Saved to SignalVault \u2014 your team will use this
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {(pendingAttachments.length > 0 || pendingUrl || uploadError) && (
          <div
            className="px-6 py-2 flex flex-wrap gap-1.5 flex-shrink-0 border-t"
            style={{ borderColor: '#f3f4f6' }}>
            {pendingAttachments.map((a, i) => (
              <div key={i}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                <FileText size={11} /> {a.filename}
                <button
                  onClick={() => setPendingAttachments(prev => prev.filter((_, j) => j !== i))}>
                  <X size={10} />
                </button>
              </div>
            ))}
            {pendingUrl && (
              <div
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                <Globe size={11} />
                <span className="truncate max-w-48">
                  {pendingUrl.title || pendingUrl.url}
                </span>
                <button onClick={() => setPendingUrl(null)}><X size={10} /></button>
              </div>
            )}
            {uploadError && (
              <p className="text-xs" style={{ color: '#ef4444' }}>{uploadError}</p>
            )}
          </div>
        )}

        {showUrlInput && (
          <div
            className="px-6 py-3 border-t flex items-center gap-2 flex-shrink-0"
            style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}>
            <Globe size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
            <input
              type="url"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setUrlError('') }}
              placeholder="Paste a URL for Nora to read\u2026"
              className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none"
              style={{
                borderColor: urlError ? '#fca5a5' : '#e5e7eb',
                color: '#374151',
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleFetchUrl() }}
              autoFocus
            />
            {urlError && (
              <p className="text-xs flex-shrink-0" style={{ color: '#ef4444' }}>
                {urlError}
              </p>
            )}
            <button
              onClick={handleFetchUrl}
              disabled={fetchingUrl || !urlInput.trim()}
              className="text-xs px-3 py-2 rounded-lg text-white font-semibold disabled:opacity-40 flex-shrink-0"
              style={{ backgroundColor: '#6366f1' }}>
              {fetchingUrl ? <Loader size={12} className="animate-spin" /> : 'Fetch'}
            </button>
            <button
              onClick={() => { setShowUrlInput(false); setUrlInput(''); setUrlError('') }}
              className="flex-shrink-0">
              <X size={14} style={{ color: '#9ca3af' }} />
            </button>
          </div>
        )}

        <div className="px-6 py-4 border-t flex-shrink-0" style={{ borderColor: '#e5e7eb' }}>
          <div
            className="flex items-end gap-3 p-3 rounded-2xl border"
            style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>

            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40"
                title="Upload file">
                {uploadingFile
                  ? <Loader size={15} className="animate-spin" style={{ color: '#6366f1' }} />
                  : <Paperclip size={15} style={{ color: '#9ca3af' }} />}
              </button>
              <button
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                title="Fetch a URL"
                style={{ color: showUrlInput ? '#6366f1' : undefined }}>
                <LinkIcon size={15}
                  style={{ color: showUrlInput ? '#6366f1' : '#9ca3af' }} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Nora to research anything\u2026"
              className="flex-1 text-sm bg-transparent outline-none resize-none"
              style={{ color: '#374151', maxHeight: '160px' }}
            />

            <button
              onClick={() => handleSend()}
              disabled={!canSend}
              className="p-2 rounded-xl flex-shrink-0 transition-all disabled:opacity-40"
              style={{ backgroundColor: '#6366f1' }}>
              {loading
                ? <Loader size={15} className="animate-spin text-white" />
                : <Send size={15} style={{ color: '#fff' }} />}
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: '#d1d5db' }}>
            Enter to send \u00b7 Shift+Enter for new line \u00b7 Attach files or paste URLs
          </p>
        </div>
      </div>
    </div>
  )
}
