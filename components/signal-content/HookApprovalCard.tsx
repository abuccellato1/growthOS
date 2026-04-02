'use client'

import { useState } from 'react'
import { RefreshCw, Loader, Check } from 'lucide-react'
import type { HookApprovalState } from './types'

interface Props {
  state: HookApprovalState
  pillarIndex: number
  condensedContext: string
  tone: string
  onChange: (updated: HookApprovalState) => void
}

const FRAMEWORK_COLORS: Record<string, string> = {
  'Hyper-specific relatability': '#7c3aed',
  'Negative warning': '#dc2626',
  'Emotional vulnerability': '#d97706',
  'POV/disguised advice': '#0284c7',
  'Timeframe tension': '#16a34a',
  'Direct callout': '#43C6AC',
  'Bold controversial claim': '#191654',
  'Authority builder': '#6b7280',
}

export default function HookApprovalCard({
  state, pillarIndex, condensedContext, tone, onChange,
}: Props) {
  const [regenLoading, setRegenLoading] = useState(false)
  const selectedCount = state.hooks.filter(h => h.selected).length

  function toggleHook(hookIndex: number) {
    const hook = state.hooks[hookIndex]
    if (hook.selected && selectedCount <= 1) return
    const updated = state.hooks.map((h, i) => {
      if (i === hookIndex) return { ...h, selected: !h.selected }
      if (!hook.selected && selectedCount >= 3) {
        const firstSelected = state.hooks.findIndex(x => x.selected)
        if (i === firstSelected) return { ...h, selected: false }
      }
      return h
    })
    onChange({ ...state, hooks: updated })
  }

  async function handleRegen() {
    setRegenLoading(true)
    try {
      const existingHooks = state.hooks.map(h => h.text)
      const res = await fetch('/api/signal-content/hooks-regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillarName: state.pillarName,
          pillarRationale: '',
          pillarIcpConnection: '',
          condensedContext,
          tone,
          existingHooks,
        }),
      })
      const json = await res.json()
      if (res.ok && json.data?.hooks) {
        const newHooks = (json.data.hooks as Array<{
          text: string; framework: string; charCount: number
        }>).map((h, i) => ({
          ...h,
          charCount: h.charCount || h.text.length,
          selected: i === 0,
        }))
        onChange({ ...state, hooks: newHooks })
      }
    } catch {
      // Non-fatal
    } finally {
      setRegenLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: selectedCount === 0 ? '#fecaca' : '#e5e7eb' }}>
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b"
        style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
        <div>
          <p className="text-sm font-bold"
            style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
            {state.pillarName}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            Pillar {pillarIndex + 1} — select up to 3 hooks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-md"
            style={{
              backgroundColor: selectedCount === 0 ? '#fef2f2' : 'rgba(67,198,172,0.1)',
              color: selectedCount === 0 ? '#dc2626' : '#43C6AC',
            }}>
            {selectedCount}/3 selected
          </span>
          <button onClick={handleRegen} disabled={regenLoading}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
            style={{ borderColor: '#e5e7eb', color: '#6b7280' }}
            title="Generate 5 fresh hooks for this pillar">
            {regenLoading ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {regenLoading ? 'Generating…' : 'New hooks'}
          </button>
        </div>
      </div>

      {/* Hook cards */}
      <div className="divide-y divide-gray-100">
        {state.hooks.map((hook, hi) => {
          const color = FRAMEWORK_COLORS[hook.framework] || '#9ca3af'
          const isSelected = hook.selected
          return (
            <button key={hi} onClick={() => toggleHook(hi)}
              className="w-full text-left p-4 transition-all"
              style={{ backgroundColor: isSelected ? 'rgba(67,198,172,0.04)' : '#ffffff' }}>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                  style={{
                    borderColor: isSelected ? '#43C6AC' : '#d1d5db',
                    backgroundColor: isSelected ? '#43C6AC' : 'transparent',
                  }}>
                  {isSelected && <Check size={11} color="white" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed mb-2"
                    style={{ color: isSelected ? '#191654' : '#6b7280', fontWeight: isSelected ? 500 : 400 }}>
                    {hook.text}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: `${color}15`, color }}>
                      {hook.framework}
                    </span>
                    <span className="text-xs" style={{ color: '#9ca3af' }}>
                      {hook.charCount || hook.text.length} chars
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
