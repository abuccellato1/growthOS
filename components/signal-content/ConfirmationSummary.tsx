'use client'

import { Check, Zap } from 'lucide-react'
import type { PillarApprovalState, SelectedHook } from './types'

interface Props {
  approvedPillars: PillarApprovalState[]
  selectedHooks: SelectedHook[]
  onGenerate: () => void
  isGenerating: boolean
}

export default function ConfirmationSummary({
  approvedPillars, selectedHooks, onGenerate, isGenerating,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: '#191654' }}
        >
          <Zap size={24} style={{ color: '#43C6AC' }} />
        </div>
        <h2
          className="text-2xl font-black mb-2"
          style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}
        >
          Ready to generate
        </h2>
        <p className="text-sm" style={{ color: '#6b7280' }}>
          Review your approved pillars and hooks before we write your full content library.
        </p>
      </div>

      {/* Summary cards */}
      <div className="space-y-3 mb-8">
        {approvedPillars.map((state, i) => {
          const hook = selectedHooks.find(h => h.pillarName === state.pillar.name)
          return (
            <div
              key={i}
              className="p-4 rounded-2xl border"
              style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
            >
              <div className="flex items-start gap-3">
                {/* Pillar number */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: '#191654' }}
                >
                  <span className="text-xs font-bold" style={{ color: '#43C6AC' }}>
                    {i + 1}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Pillar name */}
                  <p className="text-sm font-bold mb-1" style={{ color: '#191654' }}>
                    {state.pillar.name}
                  </p>

                  {/* Selected hook */}
                  {hook ? (
                    <div
                      className="p-2.5 rounded-xl"
                      style={{
                        backgroundColor: 'rgba(67,198,172,0.06)',
                        border: '1px solid rgba(67,198,172,0.2)',
                      }}
                    >
                      <p className="text-xs font-bold mb-1" style={{ color: '#43C6AC' }}>
                        APPROVED HOOK
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>
                        &quot;{hook.hook}&quot;
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                        {hook.framework}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: '#9ca3af' }}>
                      No hook selected — Sonnet will generate one
                    </p>
                  )}
                </div>

                <Check size={16} className="flex-shrink-0 mt-1"
                  style={{ color: '#43C6AC' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* What happens next */}
      <div
        className="p-4 rounded-2xl mb-6"
        style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
      >
        <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>
          WHAT GETS GENERATED
        </p>
        <ul className="space-y-1">
          {[
            'Full LinkedIn, Instagram + Facebook posts for each pillar',
            'Posts built around your approved hooks',
            '4-week content calendar',
            'Reel scripts, carousel frameworks + story sequences',
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: '#43C6AC' }}
              />
              <p className="text-xs" style={{ color: '#6b7280' }}>{item}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="w-full py-4 rounded-2xl text-white font-black text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ backgroundColor: '#191654' }}
      >
        {isGenerating ? (
          <>
            <div
              className="w-4 h-4 border-2 rounded-full animate-spin"
              style={{ borderColor: '#43C6AC', borderTopColor: 'transparent' }}
            />
            Starting generation…
          </>
        ) : (
          <>
            <Zap size={16} style={{ color: '#43C6AC' }} />
            Generate My Content Library
          </>
        )}
      </button>
    </div>
  )
}
