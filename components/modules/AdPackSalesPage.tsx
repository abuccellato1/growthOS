'use client'

import Link from 'next/link'
import { Target, CheckCircle, Zap, Users, BarChart2, ArrowRight, MessageSquare } from 'lucide-react'

const BENEFITS = [
  { icon: Users, title: 'Built from your ICP', body: 'Every headline and angle is derived from the exact language Alex collected from your ideal customer — not generic templates.' },
  { icon: MessageSquare, title: 'CustomerSignals-powered copy', body: 'Real review language and voice-of-customer phrases are injected directly into your ad copy so it sounds like your buyers wrote it.' },
  { icon: BarChart2, title: 'Competitor gap analysis', body: 'An AI research agent scans Google and Meta ad libraries to find the angles your competitors are NOT covering — and exploits them.' },
  { icon: Zap, title: 'Ready to run', body: 'Google Search headlines (30 chars), Meta primary texts, LinkedIn sponsored content — all within platform character limits and ready to paste.' },
]

const DELIVERABLES = [
  '15 Google Search headlines with angle labels',
  '5 Google ad variations (headline sets + descriptions)',
  'Negative keyword recommendations',
  '5 Meta primary texts with hook classifications',
  '3 complete Meta ad sets with targeting notes',
  '3 LinkedIn sponsored content ads',
  'StrategySignals — full campaign rationale',
  'Competitor differentiation notes',
]

export default function AdPackSalesPage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-start gap-4 mb-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#191654' }}>
          <Target size={30} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold"
              style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
              SignalAds
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(67,198,172,0.12)', color: '#43C6AC' }}>
              Add-on
            </span>
          </div>
          <p className="text-base" style={{ color: '#6b7280' }}>
            Ad copy written in the exact language of your ideal customer — ready
            to hand to your ad manager or run today.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {BENEFITS.map((b) => {
          const Icon = b.icon
          return (
            <div key={b.title} className="p-5 rounded-2xl border"
              style={{ borderColor: '#e5e7eb', backgroundColor: '#fafafa' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: '#191654' }}>
                <Icon size={16} style={{ color: '#43C6AC' }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#191654' }}>{b.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{b.body}</p>
            </div>
          )
        })}
      </div>

      <div className="p-6 rounded-2xl border mb-8"
        style={{ borderColor: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.04)' }}>
        <p className="text-sm font-bold mb-4" style={{ color: '#191654' }}>What you get</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DELIVERABLES.map((d) => (
            <div key={d} className="flex items-start gap-2">
              <CheckCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#43C6AC' }} />
              <p className="text-xs" style={{ color: '#374151' }}>{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <div>
          <p className="text-xs font-semibold mb-0.5" style={{ color: '#9ca3af' }}>ADD-ON PRICING</p>
          <p className="text-2xl font-bold"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            Included in SignalSuite
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Or available as a standalone add-on</p>
        </div>
        <Link href="/pricing"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm flex-shrink-0 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#191654' }}>
          View pricing <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
