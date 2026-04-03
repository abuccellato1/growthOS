'use client'

import { useState, useRef } from 'react'
import {
  ChevronLeft, ChevronRight,
  Linkedin, Instagram, Facebook,
  Film, Layout, Layers, Camera, X, Eye,
} from 'lucide-react'
import type {
  CalendarEntry, ReelScript, CarouselFramework, StorySequence
} from './types'

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
  previewContent: string
}

interface Props {
  calendar: CalendarData
  reelScripts?: ReelScript[]
  carouselFrameworks?: CarouselFramework[]
  storySequences?: StorySequence[]
  outputId?: string
  businessId?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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

const PLATFORM_BG: Record<string, string> = {
  linkedin: '#f0f7ff',
  instagram: '#fff0f6',
  facebook: '#f0f4ff',
}

const DRAFT_ICONS: Record<string, React.ElementType> = {
  reel: Film,
  carousel: Layout,
  story: Layers,
}

const DRAFT_COLORS: Record<string, string> = {
  reel: '#7c3aed',
  carousel: '#0284c7',
  story: '#d97706',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
    Friday: 4, Saturday: 5, Sunday: 6,
  }
  return map[label] ?? -1
}

function entryKey(e: CalendarEntry): string {
  return `${e.day}-${e.platform}-${e.pillar}-${e.status || 'scheduled'}`
}

// ── PostChip ──────────────────────────────────────────────────────────────────

function PostChip({
  entry, isPast, onDragStart,
}: {
  entry: CalendarEntry
  isPast: boolean
  onDragStart: (e: React.DragEvent, entry: CalendarEntry) => void
}) {
  const platformKey = entry.platform.toLowerCase()
  const Icon = PLATFORM_ICONS[platformKey]
  const color = PLATFORM_COLORS[platformKey] || '#9ca3af'
  const bg = PLATFORM_BG[platformKey] || '#f9fafb'
  const isDraft = entry.status === 'draft'

  return (
    <div
      draggable={!isPast}
      onDragStart={e => !isPast && onDragStart(e, entry)}
      className="rounded-lg px-2 py-1.5 mb-1 last:mb-0"
      style={{
        backgroundColor: isDraft ? '#faf5ff' : bg,
        border: isDraft ? '1px dashed #7c3aed' : `1px solid ${color}33`,
        cursor: isPast ? 'default' : 'grab',
        userSelect: 'none',
      }}
    >
      <div className="flex items-center gap-1 mb-0.5">
        {isDraft
          ? <Camera size={9} style={{ color: '#7c3aed', flexShrink: 0 }} />
          : Icon && <Icon size={9} style={{ color, flexShrink: 0 }} />
        }
        <span className="font-semibold truncate"
          style={{ color: isDraft ? '#7c3aed' : color, fontSize: 9 }}>
          {isDraft ? `${entry.draftType}` : entry.platform}
        </span>
      </div>
      <p className="leading-tight truncate" style={{ color: '#374151', fontSize: 9 }}>
        {entry.pillar}
      </p>
      {isDraft && (
        <p style={{ color: '#9ca3af', fontSize: 8 }}>📷 needs visual</p>
      )}
    </div>
  )
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  item, onClose,
}: {
  item: DraftItem
  onClose: () => void
}) {
  const Icon = DRAFT_ICONS[item.type]
  const color = DRAFT_COLORS[item.type]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-96 flex flex-col"
        style={{ border: '1px solid #e5e7eb' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}>
              <Icon size={14} style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#191654' }}>
                {item.title}
              </p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>{item.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={15} style={{ color: '#9ca3af' }} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          <pre className="text-xs leading-relaxed whitespace-pre-wrap"
            style={{ color: '#374151', fontFamily: 'inherit' }}>
            {item.previewContent}
          </pre>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar Draft Card ────────────────────────────────────────────────────────

function SidebarDraftCard({
  item, onDragStart, onPreview,
}: {
  item: DraftItem
  onDragStart: (e: React.DragEvent, item: DraftItem) => void
  onPreview: (item: DraftItem) => void
}) {
  const Icon = DRAFT_ICONS[item.type]
  const color = DRAFT_COLORS[item.type]

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, item)}
      className="p-3 rounded-xl border mb-2 last:mb-0 group"
      style={{
        backgroundColor: '#ffffff',
        border: `1px solid ${color}25`,
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: `${color}15` }}>
          <Icon size={12} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate" style={{ color: '#191654' }}>
            {item.title}
          </p>
          <p className="text-xs truncate" style={{ color: '#9ca3af' }}>
            {item.subtitle}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onPreview(item) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity
            p-1 rounded-md hover:bg-gray-100 flex-shrink-0"
          title="Preview content"
        >
          <Eye size={11} style={{ color: '#9ca3af' }} />
        </button>
      </div>
      <div className="flex items-center gap-1 mt-2">
        <Camera size={9} style={{ color: '#9ca3af' }} />
        <p style={{ color: '#9ca3af', fontSize: 9 }}>
          Drag to calendar · needs visual
        </p>
      </div>
    </div>
  )
}

// ── Main ContentCalendar ──────────────────────────────────────────────────────

export default function ContentCalendar({
  calendar, reelScripts, carouselFrameworks, storySequences,
  outputId, businessId,
}: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [localCalendar, setLocalCalendar] = useState<CalendarData>(calendar)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)
  const [previewItem, setPreviewItem] = useState<DraftItem | null>(null)
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
    if (idx >= 0) {
      if (!entriesByDay[idx]) entriesByDay[idx] = []
      entriesByDay[idx].push(entry)
    }
  })

  const weekStart = formatDate(weekDates[0])
  const weekEnd = formatDate(weekDates[6])

  // Build draft items with full preview content
  const draftItems: DraftItem[] = [
    ...(reelScripts || []).map((r, i): DraftItem => ({
      id: `reel-${i}`,
      type: 'reel',
      title: r.pillar,
      pillar: r.pillar,
      subtitle: `${r.totalDuration} reel script`,
      previewContent: [
        `REEL: ${r.pillar}`,
        `Duration: ${r.totalDuration}`,
        ``,
        `HOOK:`,
        r.hook,
        ``,
        ...r.segments.map(s => `[${s.timeCode}]\n${s.script}\nVisual: ${s.visualNote}`),
        ``,
        `CTA: ${r.cta}`,
        ``,
        `Caption: ${r.captionSuggestion}`,
      ].join('\n'),
    })),
    ...(carouselFrameworks || []).map((c, i): DraftItem => ({
      id: `carousel-${i}`,
      type: 'carousel',
      title: c.pillar,
      pillar: c.pillar,
      subtitle: `${c.slideCount}-slide carousel`,
      previewContent: [
        `CAROUSEL: ${c.pillar}`,
        ``,
        `COVER: ${c.coverSlide.headline}`,
        c.coverSlide.subtext,
        ``,
        ...c.slides.map(s =>
          `SLIDE ${s.slideNumber}: ${s.headline}\n${s.bodyText}\nVisual: ${s.visualNote}`
        ),
        ``,
        `CLOSING: ${c.closingSlide.text}`,
        c.closingSlide.cta,
      ].join('\n'),
    })),
    ...(storySequences || []).map((s, i): DraftItem => ({
      id: `story-${i}`,
      type: 'story',
      title: s.pillar,
      pillar: s.pillar,
      subtitle: `${s.frameCount}-frame story`,
      previewContent: [
        `STORY: ${s.pillar}`,
        ``,
        ...s.frames.map(f =>
          `FRAME ${f.frameNumber}: ${f.text}\nVisual: ${f.visualNote}\nSticker: ${f.stickerSuggestion}`
        ),
      ].join('\n'),
    })),
  ]

  const hasDrafts = draftItems.length > 0

  // ── Persist calendar ──────────────────────────────────────────────────────

  function persistCalendar(updated: CalendarData) {
    if (outputId && businessId) {
      fetch('/api/signal-content/calendar-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId, outputId, contentCalendar: updated,
        }),
      }).catch(() => null)
    }
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleCalendarDragStart(e: React.DragEvent, entry: CalendarEntry) {
    dragCalendarEntry.current = entry
    dragCalendarSourceWeek.current = weekKey
    dragDraftItem.current = null
    dragSource.current = 'calendar'
    e.dataTransfer.effectAllowed = 'move'
    const target = e.currentTarget as HTMLElement
    setTimeout(() => { target.style.opacity = '0.4' }, 0)
  }

  function handleDraftDragStart(e: React.DragEvent, item: DraftItem) {
    dragDraftItem.current = item
    dragCalendarEntry.current = null
    dragSource.current = 'draft'
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd(e: React.DragEvent) {
    const target = e.currentTarget as HTMLElement
    target.style.opacity = '1'
    setDragOverDay(null)
  }

  function handleDragOver(e: React.DragEvent, dayIndex: number, isPast: boolean) {
    if (isPast) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDay(dayIndex)
  }

  function handleDragLeave() {
    setDragOverDay(null)
  }

  function handleDrop(e: React.DragEvent, targetDayIndex: number, isPast: boolean) {
    e.preventDefault()
    setDragOverDay(null)
    if (isPast) return

    const targetDayLabel = DAYS[targetDayIndex]
    const targetDate = weekDates[targetDayIndex]
    const scheduledDate = targetDate.toISOString().split('T')[0]

    if (dragSource.current === 'calendar' && dragCalendarEntry.current) {
      const entry = dragCalendarEntry.current
      const sourceWeek = dragCalendarSourceWeek.current || weekKey
      if (entry.day === targetDayLabel && sourceWeek === weekKey) return

      const updatedCalendar = { ...localCalendar }
      updatedCalendar[sourceWeek] = localCalendar[sourceWeek].filter(
        e => entryKey(e) !== entryKey(entry)
      )
      const updatedEntry: CalendarEntry = {
        ...entry, day: targetDayLabel, scheduledDate,
      }
      updatedCalendar[weekKey] = [
        ...(localCalendar[weekKey] || []).filter(
          e => entryKey(e) !== entryKey(entry)
        ),
        updatedEntry,
      ].sort((a, b) => dayLabelToIndex(a.day) - dayLabelToIndex(b.day))

      setLocalCalendar(updatedCalendar)
      persistCalendar(updatedCalendar)

    } else if (dragSource.current === 'draft' && dragDraftItem.current) {
      const item = dragDraftItem.current
      const newEntry: CalendarEntry = {
        day: targetDayLabel,
        platform: 'Instagram',
        pillar: item.pillar,
        postType: item.type === 'reel' ? 'Reel'
          : item.type === 'carousel' ? 'Carousel' : 'Story',
        scheduledDate,
        status: 'draft',
        visualRequired: true,
        draftType: item.type,
        draftTitle: item.title,
      }
      const updatedCalendar = {
        ...localCalendar,
        [weekKey]: [
          ...(localCalendar[weekKey] || []),
          newEntry,
        ].sort((a, b) => dayLabelToIndex(a.day) - dayLabelToIndex(b.day)),
      }
      setLocalCalendar(updatedCalendar)
      persistCalendar(updatedCalendar)
    }

    dragCalendarEntry.current = null
    dragCalendarSourceWeek.current = null
    dragDraftItem.current = null
    dragSource.current = null
  }

  return (
    <>
      {/* Preview modal */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}

      <div className="border rounded-2xl overflow-hidden"
        style={{ borderColor: '#e5e7eb' }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b"
          style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
          <div>
            <p className="text-sm font-bold"
              style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
              Content Calendar
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              Drag posts between days · Drag drafts from sidebar to schedule
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>
              {weekStart} — {weekEnd}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
                disabled={weekOffset === 0}
                className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors
                  disabled:opacity-30"
                style={{ color: '#191654' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setWeekOffset(prev => Math.min(3, prev + 1))}
                disabled={weekOffset === 3}
                className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors
                  disabled:opacity-30"
                style={{ color: '#191654' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Drafts discovery banner */}
        {showDraftsBanner && hasDrafts && (
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{
              backgroundColor: 'rgba(67,198,172,0.08)',
              borderColor: 'rgba(67,198,172,0.25)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: '#43C6AC' }} />
              <p className="text-xs font-semibold" style={{ color: '#191654' }}>
                {draftItems.length} bonus formats in the sidebar →
                drag them onto any calendar day to schedule
              </p>
            </div>
            <button
              onClick={() => setShowDraftsBanner(false)}
              className="p-1 rounded-md ml-3 flex-shrink-0 hover:bg-white
                transition-colors"
            >
              <X size={12} style={{ color: '#9ca3af' }} />
            </button>
          </div>
        )}

        {/* Week dots */}
        <div className="flex items-center justify-center gap-1.5 py-2 border-b"
          style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
          {[0, 1, 2, 3].map(i => (
            <button key={i} onClick={() => setWeekOffset(i)}
              className="rounded-full transition-all"
              style={{
                width: weekOffset === i ? 20 : 6,
                height: 6,
                backgroundColor: weekOffset === i ? '#43C6AC' : '#d1d5db',
              }} />
          ))}
        </div>

        {/* Two-panel layout: sidebar + calendar */}
        <div className="flex">

          {/* Drafts sidebar — always visible when drafts exist */}
          {hasDrafts && (
            <div
              className="flex-shrink-0 border-r overflow-y-auto"
              style={{
                width: 200,
                borderColor: '#e5e7eb',
                backgroundColor: '#fafafa',
                maxHeight: 480,
              }}
            >
              <div className="p-3">
                <p className="text-xs font-bold mb-3 flex items-center gap-1"
                  style={{ color: '#9ca3af' }}>
                  <Camera size={10} />
                  DRAFTS ({draftItems.length})
                </p>

                {/* Group by type */}
                {(['reel', 'carousel', 'story'] as const).map(type => {
                  const items = draftItems.filter(d => d.type === type)
                  if (items.length === 0) return null
                  const Icon = DRAFT_ICONS[type]
                  const color = DRAFT_COLORS[type]
                  const label = type === 'reel' ? 'Reels'
                    : type === 'carousel' ? 'Carousels' : 'Stories'
                  return (
                    <div key={type} className="mb-3 last:mb-0">
                      <p className="text-xs font-bold mb-1.5 flex items-center gap-1"
                        style={{ color }}>
                        <Icon size={10} /> {label}
                      </p>
                      {items.map(item => (
                        <SidebarDraftCard
                          key={item.id}
                          item={item}
                          onDragStart={handleDraftDragStart}
                          onPreview={setPreviewItem}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Calendar grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-7 h-full"
              style={{ borderTop: 'none' }}>
              {DAYS.map((dayLabel, dayIndex) => {
                const date = weekDates[dayIndex]
                const isPast = date < today
                const isToday = date.getTime() === today.getTime()
                const dayEntries = entriesByDay[dayIndex] || []
                const isDragTarget = dragOverDay === dayIndex && !isPast

                return (
                  <div
                    key={dayLabel}
                    onDragOver={e => handleDragOver(e, dayIndex, isPast)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, dayIndex, isPast)}
                    className="p-1.5 transition-all"
                    style={{
                      backgroundColor: isDragTarget
                        ? 'rgba(67,198,172,0.08)'
                        : isPast ? '#fafafa' : '#ffffff',
                      borderRight: dayIndex < 6 ? '1px solid #f3f4f6' : 'none',
                      borderTop: '1px solid #e5e7eb',
                      outline: isDragTarget ? '2px solid #43C6AC' : 'none',
                      outlineOffset: '-2px',
                    }}
                  >
                    {/* Day header */}
                    <div className="mb-1.5 text-center">
                      <p className="font-bold"
                        style={{ color: isPast ? '#d1d5db' : '#374151', fontSize: 10 }}>
                        {dayLabel}
                      </p>
                      <div
                        className="w-5 h-5 rounded-full flex items-center
                          justify-center mx-auto mt-0.5"
                        style={{ backgroundColor: isToday ? '#191654' : 'transparent' }}
                      >
                        <p style={{
                          fontSize: 10,
                          color: isToday ? '#43C6AC'
                            : isPast ? '#d1d5db' : '#6b7280',
                          fontWeight: isToday ? 700 : 400,
                        }}>
                          {date.getDate()}
                        </p>
                      </div>
                    </div>

                    {/* Posts */}
                    {isPast ? (
                      <div className="flex items-center justify-center py-3">
                        <div className="w-6 h-px"
                          style={{ backgroundColor: '#e5e7eb' }} />
                      </div>
                    ) : dayEntries.length === 0 ? (
                      <div
                        className="flex items-center justify-center rounded-lg py-4"
                        style={{
                          border: isDragTarget
                            ? '1.5px dashed #43C6AC'
                            : '1.5px dashed #f0f0f0',
                          minHeight: 36,
                        }}
                      >
                        {isDragTarget && (
                          <p style={{ color: '#43C6AC', fontSize: 9, fontWeight: 600 }}>
                            Drop here
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        {dayEntries.map((entry, i) => (
                          <div key={i} onDragEnd={handleDragEnd}>
                            <PostChip
                              entry={entry}
                              isPast={isPast}
                              onDragStart={handleCalendarDragStart}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
