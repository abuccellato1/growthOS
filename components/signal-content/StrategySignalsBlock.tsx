'use client'

import { CheckCircle } from 'lucide-react'
import type { StrategySignals } from './types'

interface Props { ss: StrategySignals }

export default function StrategySignalsBlock({ ss }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(67,198,172,0.25)' }}>
      <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: 'rgba(67,198,172,0.08)' }}>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#43C6AC' }} />
        <p className="text-xs font-bold tracking-widest" style={{ color: '#43C6AC' }}>STRATEGYSIGNALS</p>
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>PRIMARY THEME</p>
            <p className="text-sm" style={{ color: '#191654' }}>{ss.primaryTheme}</p>
          </div>
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>CONTENT MIX</p>
            <p className="text-sm" style={{ color: '#191654' }}>{ss.contentMix}</p>
          </div>
        </div>

        {ss.whyItWins && (
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>WHAT SIGNALS DROVE THIS STRATEGY</p>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{ss.whyItWins}</p>
          </div>
        )}

        {ss.dataSourcesUsed && ss.dataSourcesUsed.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>DATA SOURCES USED</p>
            <div className="flex flex-wrap gap-1.5">
              {ss.dataSourcesUsed.map((s, i) => (
                <span key={i} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-semibold"
                  style={{ backgroundColor: 'rgba(25,22,84,0.07)', color: '#191654' }}>
                  <CheckCircle size={11} style={{ color: '#43C6AC' }} />
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t"
          style={{ borderColor: 'rgba(67,198,172,0.15)' }}>
          {ss.postingRationale && (
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>POSTING RATIONALE</p>
              <p className="text-xs" style={{ color: '#374151' }}>{ss.postingRationale}</p>
            </div>
          )}
          {ss.platformNotes && (
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>PLATFORM NOTES</p>
              <p className="text-xs" style={{ color: '#374151' }}>{ss.platformNotes}</p>
            </div>
          )}
        </div>

        {ss.testingRecommendations && ss.testingRecommendations.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>TESTING RECOMMENDATIONS</p>
            <ul className="space-y-1">
              {ss.testingRecommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-xs font-bold mt-0.5" style={{ color: '#43C6AC' }}>{i + 1}.</span>
                  <p className="text-xs" style={{ color: '#374151' }}>{r}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
