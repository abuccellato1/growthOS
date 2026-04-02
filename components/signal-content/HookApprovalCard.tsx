'use client'

import { ThumbsUp, ThumbsDown } from 'lucide-react'
import type { HookApprovalState } from './types'

interface Props {
  state: HookApprovalState
  pillarIndex: number
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

export default function HookApprovalCard({ state, pillarIndex, onChange }: Props) {
  const approvedCount = state.hooks.filter(h => h.approved).length

  function toggleHook(hookIndex: number) {
    const updated = {
      ...state,
      hooks: state.hooks.map((h, i) =>
        i === hookIndex ? { ...h, approved: !h.approved } : h
      ),
    }
    onChange(updated)
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: approvedCount === 0 ? '#fecaca' : '#e5e7eb',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}
      >
        <div>
          <p
            className="text-sm font-bold"
            style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}
          >
            {state.pillarName}
          </p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            Pillar {pillarIndex + 1}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {approvedCount === 0 ? (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
            >
              Select at least 1
            </span>
          ) : (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}
            >
              {approvedCount} approved
            </span>
          )}
        </div>
      </div>

      {/* Hooks */}
      <div className="divide-y divide-gray-100">
        {state.hooks.map((hook, hi) => {
          const frameworkColor = FRAMEWORK_COLORS[hook.framework] || '#9ca3af'
          return (
            <div
              key={hi}
              className="p-4 transition-all"
              style={{
                backgroundColor: hook.approved
                  ? 'rgba(67,198,172,0.04)' : '#ffffff',
              }}
            >
              <div className="flex items-start gap-3">
                {/* Approve/reject toggle */}
                <div className="flex flex-col gap-1 flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => !hook.approved && toggleHook(hi)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{
                      backgroundColor: hook.approved
                        ? 'rgba(67,198,172,0.15)' : '#f3f4f6',
                      color: hook.approved ? '#43C6AC' : '#9ca3af',
                    }}
                    title="Approve this hook"
                  >
                    <ThumbsUp size={13} />
                  </button>
                  <button
                    onClick={() => hook.approved && toggleHook(hi)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{
                      backgroundColor: !hook.approved
                        ? '#fef2f2' : '#f3f4f6',
                      color: !hook.approved ? '#dc2626' : '#9ca3af',
                    }}
                    title="Reject this hook"
                  >
                    <ThumbsDown size={13} />
                  </button>
                </div>

                {/* Hook content */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm leading-relaxed mb-2"
                    style={{
                      color: hook.approved ? '#191654' : '#6b7280',
                      fontWeight: hook.approved ? 500 : 400,
                    }}
                  >
                    {hook.text}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${frameworkColor}15`,
                        color: frameworkColor,
                      }}
                    >
                      {hook.framework}
                    </span>
                    <span className="text-xs" style={{ color: '#9ca3af' }}>
                      {hook.charCount || hook.text.length} chars
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
