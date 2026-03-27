'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Linkedin, Instagram, Facebook } from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import type { CalendarEntry } from './types'

interface Props {
  calendar: { week1: CalendarEntry[]; week2: CalendarEntry[]; week3: CalendarEntry[]; week4: CalendarEntry[] }
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#0A66C2',
  instagram: '#E1306C',
  facebook: '#1877F2',
}

function WeekSection({ title, entries, defaultOpen }: { title: string; entries: CalendarEntry[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ backgroundColor: '#f9fafb' }}>
        <span className="text-xs font-bold" style={{ color: '#191654' }}>{title}</span>
        {open ? <ChevronUp size={14} style={{ color: '#9ca3af' }} /> : <ChevronDown size={14} style={{ color: '#9ca3af' }} />}
      </button>
      {open && (
        <div className="p-3 space-y-1.5">
          {entries.map((entry, i) => {
            const platformKey = entry.platform.toLowerCase()
            const PlatformIcon = PLATFORM_ICONS[platformKey]
            const color = PLATFORM_COLORS[platformKey] || '#9ca3af'
            const copyText = `${entry.day} | ${entry.platform} | ${entry.pillar} | ${entry.postType}`
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg"
                style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}>
                <span className="text-xs font-semibold w-10 flex-shrink-0" style={{ color: '#191654' }}>{entry.day}</span>
                {PlatformIcon && <PlatformIcon size={13} style={{ color, flexShrink: 0 }} />}
                <span className="text-xs flex-1" style={{ color: '#374151' }}>{entry.pillar}</span>
                <span className="text-xs px-2 py-0.5 rounded-md flex-shrink-0"
                  style={{ backgroundColor: 'rgba(25,22,84,0.07)', color: '#191654' }}>
                  {entry.postType}
                </span>
                <CopyButton text={copyText} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ContentCalendar({ calendar }: Props) {
  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <div className="px-6 py-4" style={{ backgroundColor: '#f9fafb' }}>
        <p className="text-sm font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
          4-Week Content Calendar
        </p>
      </div>
      <div className="p-6 space-y-3">
        <WeekSection title="Week 1" entries={calendar.week1} defaultOpen={true} />
        <WeekSection title="Week 2" entries={calendar.week2} defaultOpen={false} />
        <WeekSection title="Week 3" entries={calendar.week3} defaultOpen={false} />
        <WeekSection title="Week 4" entries={calendar.week4} defaultOpen={false} />
      </div>
    </div>
  )
}
