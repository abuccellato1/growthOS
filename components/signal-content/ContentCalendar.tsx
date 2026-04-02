'use client'

import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Linkedin, Instagram, Facebook } from 'lucide-react'
import type { CalendarEntry } from './types'

interface CalendarData {
  week1: CalendarEntry[]
  week2: CalendarEntry[]
  week3: CalendarEntry[]
  week4: CalendarEntry[]
}

interface Props {
  calendar: CalendarData
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
  return `${entry.day}-${entry.platform}-${entry.pillar}`
}

function PostChip({ entry, isPast, onDragStart }: {
  entry: CalendarEntry; isPast: boolean
  onDragStart: (e: React.DragEvent, entry: CalendarEntry) => void
}) {
  const platformKey = entry.platform.toLowerCase()
  const Icon = PLATFORM_ICONS[platformKey]
  const color = PLATFORM_COLORS[platformKey] || '#9ca3af'
  const bg = PLATFORM_BG[platformKey] || '#f9fafb'

  return (
    <div draggable={!isPast} onDragStart={e => !isPast && onDragStart(e, entry)}
      className="rounded-lg px-2 py-1.5 mb-1.5 last:mb-0 transition-opacity"
      style={{ backgroundColor: bg, border: `1px solid ${color}33`,
        cursor: isPast ? 'default' : 'grab', userSelect: 'none' }}>
      <div className="flex items-center gap-1 mb-0.5">
        {Icon && <Icon size={10} style={{ color, flexShrink: 0 }} />}
        <span className="font-semibold truncate" style={{ color, fontSize: 10 }}>{entry.platform}</span>
      </div>
      <p className="leading-tight truncate" style={{ color: '#374151', fontSize: 10 }}>{entry.pillar}</p>
      <p style={{ color: '#9ca3af', fontSize: 9 }}>{entry.postType}</p>
    </div>
  )
}

export default function ContentCalendar({ calendar, outputId, businessId }: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [localCalendar, setLocalCalendar] = useState<CalendarData>(calendar)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)
  const dragEntry = useRef<CalendarEntry | null>(null)
  const dragSourceWeek = useRef<keyof CalendarData | null>(null)

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

  function handleDragStart(e: React.DragEvent, entry: CalendarEntry) {
    dragEntry.current = entry
    dragSourceWeek.current = weekKey
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => { (e.currentTarget as HTMLElement).style.opacity = '0.4' }, 0)
  }
  function handleDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = '1'
    setDragOverDay(null)
  }
  function handleDragOver(e: React.DragEvent, dayIndex: number, isPast: boolean) {
    if (isPast) return
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDay(dayIndex)
  }
  function handleDragLeave() { setDragOverDay(null) }
  function handleDrop(e: React.DragEvent, targetDayIndex: number, isPast: boolean) {
    e.preventDefault(); setDragOverDay(null)
    if (isPast || !dragEntry.current || !dragSourceWeek.current) return
    const targetDayLabel = DAYS[targetDayIndex]
    const entry = dragEntry.current
    const sourceWeek = dragSourceWeek.current
    if (entry.day === targetDayLabel && sourceWeek === weekKey) return

    const updatedCalendar = { ...localCalendar }
    updatedCalendar[sourceWeek] = localCalendar[sourceWeek].filter(e => entryKey(e) !== entryKey(entry))
    const targetDate = weekDates[targetDayIndex]
    const scheduledDate = targetDate.toISOString().split('T')[0]
    const updatedEntry: CalendarEntry = { ...entry, day: targetDayLabel, scheduledDate }
    updatedCalendar[weekKey] = [...(localCalendar[weekKey] || []), updatedEntry]
      .filter(e => entryKey(e) !== entryKey(entry) || e.day === targetDayLabel)
    updatedCalendar[weekKey].sort((a, b) => dayLabelToIndex(a.day) - dayLabelToIndex(b.day))

    setLocalCalendar(updatedCalendar)
    dragEntry.current = null; dragSourceWeek.current = null

    if (outputId && businessId) {
      fetch('/api/signal-content/calendar-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, outputId, contentCalendar: updatedCalendar }),
      }).catch(() => null)
    }
  }

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <div className="px-6 py-4 flex items-center justify-between border-b"
        style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
        <div>
          <p className="text-sm font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>Content Calendar</p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Drag posts between days to reschedule</p>
        </div>
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 py-2 border-b"
        style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
        {[0, 1, 2, 3].map(i => (
          <button key={i} onClick={() => setWeekOffset(i)} className="rounded-full transition-all"
            style={{ width: weekOffset === i ? 20 : 6, height: 6, backgroundColor: weekOffset === i ? '#43C6AC' : '#d1d5db' }} />
        ))}
      </div>

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
                outline: isDragTarget ? '2px solid #43C6AC' : 'none',
                outlineOffset: '-2px',
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
                <div className="flex items-center justify-center rounded-lg py-4"
                  style={{ border: isDragTarget ? '2px dashed #43C6AC' : '2px dashed #f3f4f6', minHeight: 40 }}>
                  {isDragTarget && <p className="text-xs font-semibold" style={{ color: '#43C6AC' }}>Drop here</p>}
                </div>
              ) : (
                <div>
                  {dayEntries.map((entry, i) => (
                    <div key={i} onDragEnd={handleDragEnd}>
                      <PostChip entry={entry} isPast={isPast} onDragStart={handleDragStart} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
