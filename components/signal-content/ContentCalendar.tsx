'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Linkedin, Instagram, Facebook } from 'lucide-react'
import type { CalendarEntry } from './types'

interface Props {
  calendar: {
    week1: CalendarEntry[]
    week2: CalendarEntry[]
    week3: CalendarEntry[]
    week4: CalendarEntry[]
  }
}

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

// Get the Monday of the current week
function getMondayOfCurrentWeek(): Date {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Format date as "Jun 2"
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Get 7 dates starting from a Monday
function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

// Map Sonnet day labels to day index (0=Mon, 6=Sun)
function dayLabelToIndex(label: string): number {
  const map: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
    Friday: 4, Saturday: 5, Sunday: 6,
  }
  return map[label] ?? -1
}

function PostChip({ entry }: { entry: CalendarEntry }) {
  const platformKey = entry.platform.toLowerCase()
  const Icon = PLATFORM_ICONS[platformKey]
  const color = PLATFORM_COLORS[platformKey] || '#9ca3af'
  const bg = PLATFORM_BG[platformKey] || '#f9fafb'

  return (
    <div
      className="rounded-lg px-2 py-1.5 mb-1.5 last:mb-0"
      style={{ backgroundColor: bg, border: `1px solid ${color}22` }}
    >
      <div className="flex items-center gap-1 mb-0.5">
        {Icon && <Icon size={10} style={{ color, flexShrink: 0 }} />}
        <span className="text-xs font-semibold truncate" style={{ color, fontSize: 10 }}>
          {entry.platform}
        </span>
      </div>
      <p className="text-xs leading-tight" style={{ color: '#374151', fontSize: 10 }}>
        {entry.pillar}
      </p>
      <p className="text-xs" style={{ color: '#9ca3af', fontSize: 9 }}>
        {entry.postType}
      </p>
    </div>
  )
}

export default function ContentCalendar({ calendar }: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const baseMonday = getMondayOfCurrentWeek()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Current displayed week's Monday
  const displayedMonday = new Date(baseMonday)
  displayedMonday.setDate(baseMonday.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(displayedMonday)

  // Which week's data to show (0-3)
  const weekKey = (['week1', 'week2', 'week3', 'week4'] as const)[weekOffset]
  const entries = weekOffset <= 3 ? (calendar[weekKey] || []) : []

  // Group entries by day label
  const entriesByDay: Record<number, CalendarEntry[]> = {}
  entries.forEach(entry => {
    const idx = dayLabelToIndex(entry.day)
    if (idx >= 0) {
      if (!entriesByDay[idx]) entriesByDay[idx] = []
      entriesByDay[idx].push(entry)
    }
  })

  // Week label
  const weekStart = formatDate(weekDates[0])
  const weekEnd = formatDate(weekDates[6])

  return (
    <div className="border rounded-2xl overflow-hidden"
      style={{ borderColor: '#e5e7eb' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        <p className="text-sm font-bold"
          style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
          Content Calendar
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>
            {weekStart} — {weekEnd}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
              className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30"
              style={{ color: '#191654' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekOffset(prev => Math.min(3, prev + 1))}
              disabled={weekOffset === 3}
              className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30"
              style={{ color: '#191654' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Week indicator dots */}
      <div className="flex items-center justify-center gap-1.5 py-2"
        style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        {[0, 1, 2, 3].map(i => (
          <button
            key={i}
            onClick={() => setWeekOffset(i)}
            className="rounded-full transition-all"
            style={{
              width: weekOffset === i ? 20 : 6,
              height: 6,
              backgroundColor: weekOffset === i ? '#43C6AC' : '#d1d5db',
            }}
          />
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 divide-x divide-gray-200">
        {DAYS.map((dayLabel, dayIndex) => {
          const date = weekDates[dayIndex]
          const isPast = date < today
          const isToday = date.getTime() === today.getTime()
          const dayEntries = entriesByDay[dayIndex] || []

          return (
            <div
              key={dayLabel}
              className="p-2"
              style={{
                backgroundColor: isPast ? '#fafafa' : '#ffffff',
                minHeight: 120,
                borderTop: '1px solid #e5e7eb',
              }}
            >
              {/* Day header */}
              <div className="mb-2 text-center">
                <p className="text-xs font-bold"
                  style={{ color: isPast ? '#d1d5db' : '#374151' }}>
                  {dayLabel}
                </p>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center mx-auto mt-0.5"
                  style={{
                    backgroundColor: isToday ? '#191654' : 'transparent',
                  }}
                >
                  <p className="text-xs"
                    style={{
                      color: isToday ? '#43C6AC' : isPast ? '#d1d5db' : '#6b7280',
                      fontWeight: isToday ? 700 : 400,
                    }}>
                    {date.getDate()}
                  </p>
                </div>
              </div>

              {/* Posts for this day */}
              {isPast ? (
                <div className="flex items-center justify-center h-12">
                  <div className="w-8 h-px" style={{ backgroundColor: '#e5e7eb' }} />
                </div>
              ) : (
                <div>
                  {dayEntries.map((entry, i) => (
                    <PostChip key={i} entry={entry} />
                  ))}
                  {dayEntries.length === 0 && (
                    <div className="flex items-center justify-center h-12">
                      <div className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: '#e5e7eb' }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
