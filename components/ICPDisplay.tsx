'use client'

import { useState } from 'react'
import { Download, Copy, CheckCircle } from 'lucide-react'
import { sanitizeHtml } from '@/lib/sanitize'
import { marked } from 'marked'

interface ICPDisplayProps {
  icpMarkdown: string
  sessionId: string
}

function getHtml(markdown: string): string {
  const raw = marked.parse(markdown)
  return sanitizeHtml(typeof raw === 'string' ? raw : '')
}

export default function ICPDisplay({ icpMarkdown, sessionId }: ICPDisplayProps) {
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleDownloadPdf() {
    setDownloading(true)
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: icpMarkdown }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'SignalMap.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download error:', err)
    } finally {
      setDownloading(false)
    }
  }

  async function handleCopyForDocs() {
    try {
      const html = getHtml(icpMarkdown)
      // Use ClipboardItem with both HTML and plain text for Google Docs compatibility
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([icpMarkdown], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(icpMarkdown)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error('Copy error:', err)
    }
  }

  const html = getHtml(icpMarkdown)

  // Suppress unused variable warning — sessionId reserved for future per-session PDF caching
  void sessionId

  return (
    <div className="flex flex-col gap-0">
      {/* Sticky action bar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b"
        style={{
          backgroundColor: '#ffffff',
          borderColor: '#e5e7eb',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <p className="text-sm font-semibold" style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}>
          SignalMap™
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyForDocs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{
              borderColor: '#e5e7eb',
              color: copied ? '#43C6AC' : '#374151',
              backgroundColor: copied ? '#f0fdf9' : '#ffffff',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy for Google Docs'}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#191654', fontFamily: 'DM Sans, sans-serif' }}
          >
            <Download size={15} />
            {downloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ICP content */}
      <style>{`
        .icp-body h1 { font-family: 'Playfair Display', serif; font-size: 1.75rem; font-weight: 700; color: #191654; margin: 0 0 0.5rem; line-height: 1.25; }
        .icp-body h2 { font-family: 'Playfair Display', serif; font-size: 1.2rem; font-weight: 700; color: #191654; margin: 2rem 0 0.5rem; padding-bottom: 0.4rem; border-bottom: 2px solid #43C6AC; }
        .icp-body h3 { font-family: 'DM Sans', sans-serif; font-size: 0.95rem; font-weight: 700; color: #191654; margin: 1.25rem 0 0.35rem; }
        .icp-body p { font-family: 'DM Sans', sans-serif; font-size: 0.9rem; color: #374151; line-height: 1.75; margin: 0 0 0.75rem; }
        .icp-body ul, .icp-body ol { margin: 0.25rem 0 0.75rem 1.25rem; padding: 0; }
        .icp-body li { font-family: 'DM Sans', sans-serif; font-size: 0.9rem; color: #374151; line-height: 1.75; margin-bottom: 0.2rem; }
        .icp-body blockquote { border-left: 3px solid #43C6AC; padding-left: 1rem; margin: 0.75rem 0; color: #6b7280; font-style: italic; }
        .icp-body blockquote p { color: #6b7280; margin: 0; }
        .icp-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
        .icp-body strong { font-weight: 700; color: #111827; }
        .icp-body em { font-style: italic; }
      `}</style>
      <div
        className="icp-body px-8 py-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
