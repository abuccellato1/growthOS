'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  label?: string
  variant?: 'icon' | 'button'
}

export default function CopyButton({ text, label = 'Copy', variant = 'icon' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (variant === 'button') {
    return (
      <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
        style={{ backgroundColor: copied ? 'rgba(67,198,172,0.12)' : '#f3f4f6', color: copied ? '#43C6AC' : '#374151' }}>
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied!' : label}
      </button>
    )
  }

  return (
    <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0" title="Copy to clipboard">
      {copied ? <Check size={14} style={{ color: '#43C6AC' }} /> : <Copy size={14} style={{ color: '#9ca3af' }} />}
    </button>
  )
}
