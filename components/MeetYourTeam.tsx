'use client'

import { useState } from 'react'
import {
  MessageSquare, Target, Share2, Mail,
  Map, Calendar, Search, ArrowRight, Loader
} from 'lucide-react'

const TEAM = [
  {
    name: 'Alex',
    module: 'SignalMap Interview',
    icon: MessageSquare,
    color: '#43C6AC',
    description: 'Alex built your entire customer profile. Every other agent has read it.',
  },
  {
    name: 'Nora',
    module: 'SignalResearch',
    icon: Search,
    color: '#6366f1',
    description: 'Nora goes out and finds market intelligence, competitor insights, and proof points for your team.',
  },
  {
    name: 'Jaimie',
    module: 'SignalAds',
    icon: Target,
    color: '#ef4444',
    description: 'Sharp and data-driven. Jaimie writes ad copy that converts across Google, Meta, and LinkedIn.',
  },
  {
    name: 'Sofia',
    module: 'SignalContent',
    icon: Share2,
    color: '#8b5cf6',
    description: 'Creative director energy. Sofia knows what stops the scroll on every platform.',
  },
  {
    name: 'Emily',
    module: 'SignalSequences',
    icon: Mail,
    color: '#43C6AC',
    description: 'Empathetic and persuasive. Emily builds sequences that move people from cold to converted.',
  },
  {
    name: 'Marcus',
    module: 'SignalLaunch',
    icon: Map,
    color: '#f59e0b',
    description: 'Bold and launch-obsessed. Marcus builds your go-to-market plan from scratch.',
  },
  {
    name: 'Dana',
    module: 'SignalSprint',
    icon: Calendar,
    color: '#3b82f6',
    description: 'Organized and calm. Dana turns your strategy into a clear week-by-week action plan.',
  },
]

interface MeetYourTeamProps {
  customerName?: string
  onDismiss: () => void
}

export default function MeetYourTeam({ customerName, onDismiss }: MeetYourTeamProps) {
  const [dismissing, setDismissing] = useState(false)

  async function handleDismiss() {
    setDismissing(true)
    try {
      await fetch('/api/customers/team-introduced', { method: 'PATCH' })
    } catch { /* non-fatal */ }
    onDismiss()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full overflow-hidden"
        style={{ maxWidth: '680px', maxHeight: '90vh' }}>

        <div
          className="px-8 pt-8 pb-6 text-center"
          style={{ background: 'linear-gradient(135deg, #191654 0%, #2d2a8a 100%)' }}>
          <p className="text-xs font-bold tracking-widest mb-2" style={{ color: '#43C6AC' }}>
            YOUR SIGNALMAP IS COMPLETE
          </p>
          <h2
            className="text-2xl font-bold text-white mb-2"
            style={{ fontFamily: 'Playfair Display, serif' }}>
            Meet your marketing team{customerName ? `, ${customerName}` : ''}.
          </h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Alex briefed everyone. They know your business, your customers, and your edge.
            Tell them what you need.
          </p>
        </div>

        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: '55vh' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEAM.map(member => {
              const Icon = member.icon
              return (
                <div
                  key={member.name}
                  className="flex items-start gap-3 p-4 rounded-2xl border"
                  style={{ borderColor: '#f3f4f6', backgroundColor: '#fafafa' }}>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${member.color}18` }}>
                    <Icon size={18} style={{ color: member.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: '#191654' }}>
                        {member.name}
                      </p>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: `${member.color}15`, color: member.color }}>
                        {member.module}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                      {member.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div
          className="px-8 py-5 border-t flex items-center justify-between flex-wrap gap-3"
          style={{ borderColor: '#f3f4f6' }}>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            Find every specialist in the left nav under their module name.
          </p>
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ backgroundColor: '#191654' }}>
            {dismissing
              ? <Loader size={15} className="animate-spin" />
              : <>Go to SignalBoard <ArrowRight size={15} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
