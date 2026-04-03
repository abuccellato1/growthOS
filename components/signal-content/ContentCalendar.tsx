'use client'

import { useState, useRef } from 'react'
import {
  ChevronLeft, ChevronRight,
  Linkedin, Instagram, Facebook,
  Film, Layout, Layers, Camera,
} from 'lucide-react'
import type { CalendarEntry, ReelScript, CarouselFramework, StorySequence } from './types'

interface CalendarData {
  week1: CalendarEntry[]
  week2: CalendarEntry[]
  week3: CalendarEntry[]
  week4: CalendarEntry[]
}

interface DraftItem {
  id: string
  type: 'reel' | 'carousel' | 'story'
  title: string
  pillar: string
  subtitle: string
}

interface Props {
  calendar: CalendarData
  reelScripts?: ReelScript[]
  carouselFrameworks?: CarouselFramework[]
  storySequences?: StorySequence[]
  outputId?: string
  businessId?: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  linkedin: Linkedin, instagram: Instagram, facebook: Facebook,
}
const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#0A66C2', instagram: '#E1306C', facebook: '#1877F2',
}
const PLATFORM_BG: Record<string, string> = {
  linkedin: '#f0f7ff', instagram: '#fff0f6', facebook: '#f0f4ff',
}
const DRAFT_TYPE_ICONS: Record<string, React.ElementType> = {
  reel: Film, carousel: Layout, story: Layers,
}
const DRAFT_TYPE_COLORS: Record<string, string> = {
  reel: '#7c3aed', carousel: '#0284c7', story: '#d97706',
}

function getMondayOfCurrentWeek(): Date {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function dayLabelToIndex(label: string): number {
  const map: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
  }
  return map[label] ?? -1
}

function entryKey(entry: CalendarEntry): string {
  return `${entry.day}-${entry.platform}-${entry.pillar}-${entry.status || 'scheduled'}`
}

function PostChip({ entry, isPast, onDragStart }: {
  entry: CalendarEntry; isPast: boolean
  onDragStart: (e: React.DragEvent, entry: CalendarEntry, source: 'calendar') => void
}) {
  const platformKey = entry.platform.toLowerCase()
  const Icon = PLATFORM_ICONS[platformKey]
  const color = PLATFORM_COLORS[platformKey] || '#9ca3af'
  const bg = PLATFORM_BG[platformKey] || '#f9fafb'
  const isDraft = entry.status === 'draft'

  return (
    <div draggable={!isPast} onDragStart={e => !isPast && onDragStart(e, entry, 'calendar')}
      className="rounded-lg px-2 py-1.5 mb-1.5 last:mb-0 transition-opacity"
      style={{
        backgroundColor: isDraft ? '#faf5ff' : bg,
        border: isDraft ? '1px dashed #7c3aed' : `1px solid ${color}33`,
        cursor: isPast ? 'default' : 'grab', userSelect: 'none',
        opacity: isDraft ? 0.85 : 1,
      }}>
      <div className="flex items-center gap-1 mb-0.5">
        {isDraft ? (
          <Camera size={10} style={{ color: '#7c3aed', flexShrink: 0 }} />
        ) : (
          Icon && <Icon size={10} style={{ color, flexShrink: 0 }} />
        )}
        <span className="font-semibold truncate"
          style={{ color: isDraft ? '#7c3aed' : color, fontSize: 10 }}>
          {isDraft ? `${entry.draftType} draft` : entry.platform}
        </span>
      </div>
      <p className="leading-tight truncate" style={{ color: '#374151', fontSize: 10 }}>{entry.pillar}</p>
      {isDraft && <p style={{ color: '#9ca3af', fontSize: 9 }}>📷 Needs visual</p>}
    </div>
  )
}

function DraftCard({ item, onDragStart }: {
  item: DraftItem
  onDragStart: (e: React.DragEvent, item: DraftItem, source: 'draft') => void
}) {
  const Icon = DRAFT_TYPE_ICONS[item.type]
  const color = DRAFT_TYPE_COLORS[item.type]

  return (
    <div draggable onDragStart={e => onDragStart(e, item, 'draft')}
      className="p-3 rounded-xl border mb-2 last:mb-0 cursor-grab transition-colors hover:border-opacity-50"
      style={{ backgroundColor: '#ffffff', border: `1px solid ${color}33`, userSelect: 'none' }}>
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15` }}>
          <Icon size={13} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate" style={{ color: '#191654' }}>{item.title}</p>
          <p className="text-xs truncate" style={{ color: '#9ca3af' }}>{item.subtitle}</p>
          <div className="flex items-center gap-1 mt-1">
            <Camera size={9} style={{ color: '#9ca3af' }} />
            <p style={{ color: '#9ca3af', fontSize: 9 }}>Drag to calendar to schedule</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ContentCalendar({
  calendar, reelScripts, carouselFrameworks, storySequences, outputId, businessId,
}: Props) {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'drafts'>('scheduled')
  const [weekOffset, setWeekOffset] = useState(0)
  const [localCalendar, setLocalCalendar] = useState<CalendarData>(calendar)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)
  const [showDraftsBanner, setShowDraftsBanner] = useState(true)

  const dragCalendarEntry = useRef<CalendarEntry | null>(null)
  const dragCalendarSourceWeek = useRef<keyof CalendarData | null>(null)
  const dragDraftItem = useRef<DraftItem | null>(null)
  const dragSource = useRef<'calendar' | 'draft' | null>(null)

  const baseMonday = getMondayOfCurrentWeek()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const displayedMonday = new Date(baseMonday)
  displayedMonday.setDate(baseMonday.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(displayedMonday)

  const weekKey = (['week1', 'week2', 'week3', 'week4'] as const)[weekOffset]
  const entries = weekOffset <= 3 ? (localCalendar[weekKey] || []) : []

  const entriesByDay: Record<number, CalendarEntry[]> = {}
  entries.forEach(entry => {
    const idx = dayLabelToIndex(entry.day)
    if (idx >= 0) { if (!entriesByDay[idx]) entriesByDay[idx] = []; entriesByDay[idx].push(entry) }
  })

  const weekStart = formatDate(weekDates[0])
  const weekEnd = formatDate(weekDates[6])

  const draftItems: DraftItem[] = [
    ...(reelScripts || []).map((r, i): DraftItem => ({ id: `reel-${i}`, type: 'reel', title: r.pillar, pillar: r.pillar, subtitle: `${r.totalDuration} reel script` })),
    ...(carouselFrameworks || []).map((c, i): DraftItem => ({ id: `carousel-${i}`, type: 'carousel', title: c.pillar, pillar: c.pillar, subtitle: `${c.slideCount}-slide carousel` })),
    ...(storySequences || []).map((s, i): DraftItem => ({ id: `story-${i}`, type: 'story', title: s.pillar, pillar: s.pillar, subtitle: `${s.frameCount}-frame story` })),
  ]

  function handleCalendarDragStart(e: React.DragEvent, entry: CalendarEntry, source: 'calendar') {
    dragCalendarEntry.current = entry; dragCalendarSourceWeek.current = weekKey
    dragDraftItem.current = null; dragSource.current = source
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => { (e.currentTarget as HTMLElement).style.opacity = '0.4' }, 0)
  }

  function handleDraftDragStart(e: React.DragEvent, item: DraftItem, source: 'draft') {
    dragDraftItem.current = item; dragCalendarEntry.current = null; dragSource.current = source
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = '1'; setDragOverDay(null)
  }

  function handleDragOver(e: React.DragEvent, dayIndex: number, isPast: boolean) {
    if (isPast) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDay(dayIndex)
  }

  function handleDragLeave() { setDragOverDay(null) }

  function persistCalendar(updated: CalendarData) {
    if (outputId && businessId) {
      fetch('/api/signal-content/calendar-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, outputId, contentCalendar: updated }),
      }).catch(() => null)
    }
  }

  function handleDrop(e: React.DragEvent, targetDayIndex: number, isPast: boolean) {
    e.preventDefault(); setDragOverDay(null)
    if (isPast) return
    const targetDayLabel = DAYS[targetDayIndex]
    const targetDate = weekDates[targetDayIndex]
    const scheduledDate = targetDate.toISOString().split('T')[0]

    if (dragSource.current === 'calendar' && dragCalendarEntry.current) {
      const entry = dragCalendarEntry.current
      const sourceWeek = dragCalendarSourceWeek.current || weekKey
      if (entry.day === targetDayLabel && sourceWeek === weekKey) return
      const updatedCalendar = { ...localCalendar }
      updatedCalendar[sourceWeek] = localCalendar[sourceWeek].filter(e => entryKey(e) !== entryKey(entry))
      const updatedEntry: CalendarEntry = { ...entry, day: targetDayLabel, scheduledDate }
      updatedCalendar[weekKey] = [...(localCalendar[weekKey] || []), updatedEntry]
        .sort((a, b) => dayLabelToIndex(a.day) - dayLabelToIndex(b.day))
      setLocalCalendar(updatedCalendar)
      persistCalendar(updatedCalendar)
    } else if (dragSource.current === 'draft' && dragDraftItem.current) {
      const item = dragDraftItem.current
      const newEntry: CalendarEntry = {
        day: targetDayLabel, platform: 'Instagram', pillar: item.pillar,
        postType: item.type === 'reel' ? 'Reel' : item.type === 'carousel' ? 'Carousel' : 'Story',
        scheduledDate, status: 'draft', visualRequired: true, draftType: item.type, draftTitle: item.title,
      }
      const updatedCalendar = {
        ...localCalendar,
        [weekKey]: [...(localCalendar[weekKey] || []), newEntry]
          .sort((a, b) => dayLabelToIndex(a.day) - dayLabelToIndex(b.day)),
      }
      setLocalCalendar(updatedCalendar)
      persistCalendar(updatedCalendar)
    }
    dragCalendarEntry.current = null; dragCalendarSourceWeek.current = null
    dragDraftItem.current = null; dragSource.current = null
  }

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b"
        style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
        <div>
          <p className="text-sm font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>Content Calendar</p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Drag posts to reschedule · Drag drafts onto days to schedule them</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'scheduled' && (
            <>
              <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>{weekStart} — {weekEnd}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))} disabled={weekOffset === 0}
                  className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30" style={{ color: '#191654' }}>
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setWeekOffset(prev => Math.min(3, prev + 1))} disabled={weekOffset === 3}
                  className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30" style={{ color: '#191654' }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drafts discovery banner */}
      {showDraftsBanner && draftItems.length > 0 && (
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{
            backgroundColor: 'rgba(67,198,172,0.08)',
            borderColor: 'rgba(67,198,172,0.25)',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#43C6AC' }} />
            <p className="text-xs font-semibold" style={{ color: '#191654' }}>
              {draftItems.length} bonus formats (reels, carousels + stories)
              are ready in the{' '}
              <button
                onClick={() => {
                  setActiveTab('drafts')
                  setShowDraftsBanner(false)
                }}
                className="underline font-bold"
                style={{ color: '#43C6AC' }}
              >
                Drafts tab →
              </button>
            </p>
          </div>
          <button
            onClick={() => setShowDraftsBanner(false)}
            className="text-xs px-2 py-0.5 rounded-md ml-3 flex-shrink-0"
            style={{ color: '#9ca3af' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: '#e5e7eb' }}>
        {(['scheduled', 'drafts'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-xs font-bold transition-colors"
            style={{
              color: activeTab === tab ? '#191654' : '#9ca3af',
              borderBottom: activeTab === tab ? '2px solid #43C6AC' : '2px solid transparent',
              backgroundColor: activeTab === tab ? '#ffffff' : '#f9fafb',
            }}>
            {tab === 'scheduled' ? '📅 Scheduled' : '📝 Drafts'}
            {tab === 'drafts' && draftItems.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: 'rgba(67,198,172,0.1)', color: '#43C6AC' }}>
                {draftItems.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Week dots */}
      {activeTab === 'scheduled' && (
        <div className="flex items-center justify-center gap-1.5 py-2 border-b"
          style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
          {[0, 1, 2, 3].map(i => (
            <button key={i} onClick={() => setWeekOffset(i)} className="rounded-full transition-all"
              style={{ width: weekOffset === i ? 20 : 6, height: 6, backgroundColor: weekOffset === i ? '#43C6AC' : '#d1d5db' }} />
          ))}
        </div>
      )}

      {/* SCHEDULED TAB */}
      {activeTab === 'scheduled' && (
        <div className="grid grid-cols-7" style={{ borderTop: '1px solid #e5e7eb' }}>
          {DAYS.map((dayLabel, dayIndex) => {
            const date = weekDates[dayIndex]
            const isPast = date < today
            const isToday = date.getTime() === today.getTime()
            const dayEntries = entriesByDay[dayIndex] || []
            const isDragTarget = dragOverDay === dayIndex && !isPast
            return (
              <div key={dayLabel}
                onDragOver={e => handleDragOver(e, dayIndex, isPast)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, dayIndex, isPast)}
                className="p-2 transition-all"
                style={{
                  backgroundColor: isDragTarget ? 'rgba(67,198,172,0.08)' : isPast ? '#fafafa' : '#ffffff',
                  borderRight: dayIndex < 6 ? '1px solid #f3f4f6' : 'none',
                  outline: isDragTarget ? '2px solid #43C6AC' : 'none', outlineOffset: '-2px',
                }}>
                <div className="mb-2 text-center">
                  <p className="text-xs font-bold" style={{ color: isPast ? '#d1d5db' : '#374151' }}>{dayLabel}</p>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto mt-0.5"
                    style={{ backgroundColor: isToday ? '#191654' : 'transparent' }}>
                    <p className="text-xs" style={{
                      color: isToday ? '#43C6AC' : isPast ? '#d1d5db' : '#6b7280',
                      fontWeight: isToday ? 700 : 400,
                    }}>{date.getDate()}</p>
                  </div>
                </div>
                {isPast ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-8 h-px" style={{ backgroundColor: '#e5e7eb' }} />
                  </div>
                ) : dayEntries.length === 0 ? (
                  <div className="flex items-center justify-center rounded-lg py-6"
                    style={{ border: isDragTarget ? '2px dashed #43C6AC' : '2px dashed #f3f4f6', minHeight: 40 }}>
                    {isDragTarget && <p className="text-xs font-semibold" style={{ color: '#43C6AC' }}>Drop here</p>}
                  </div>
                ) : (
                  <div>
                    {dayEntries.map((entry, i) => (
                      <div key={i} onDragEnd={handleDragEnd}>
                        <PostChip entry={entry} isPast={isPast} onDragStart={handleCalendarDragStart} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* DRAFTS TAB */}
      {activeTab === 'drafts' && (
        <div className="p-6">
          {draftItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#9ca3af' }}>Bonus content is still generating…</p>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-xl mb-4" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <p className="text-xs" style={{ color: '#6b7280' }}>
                  These formats need visuals before publishing. Drag any card onto a calendar day to schedule it.
                </p>
              </div>
              {(reelScripts || []).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#7c3aed' }}>
                    <Film size={12} /> Reel Scripts
                  </p>
                  {draftItems.filter(d => d.type === 'reel').map(item => (
                    <DraftCard key={item.id} item={item} onDragStart={handleDraftDragStart} />
                  ))}
                </div>
              )}
              {(carouselFrameworks || []).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#0284c7' }}>
                    <Layout size={12} /> Carousel Frameworks
                  </p>
                  {draftItems.filter(d => d.type === 'carousel').map(item => (
                    <DraftCard key={item.id} item={item} onDragStart={handleDraftDragStart} />
                  ))}
                </div>
              )}
              {(storySequences || []).length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#d97706' }}>
                    <Layers size={12} /> Story Sequences
                  </p>
                  {draftItems.filter(d => d.type === 'story').map(item => (
                    <DraftCard key={item.id} item={item} onDragStart={handleDraftDragStart} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
