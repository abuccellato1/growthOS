'use client'

import { useState, useEffect } from 'react'
import { Share2 } from 'lucide-react'

interface Props {
  generationNumber: number
  bonusLoading: boolean
  vocPhraseCount?: number
  businessName?: string
}

const CORE_MESSAGES = [
  { emoji: '🗺️', text: 'Reading your SignalMap Interview data' },
  { emoji: '🎙️', text: 'Analyzing CustomerSignals language patterns' },
  { emoji: '🏢', text: 'Loading BusinessSignals research profile' },
  { emoji: '🧠', text: 'Identifying your top content pillars' },
  { emoji: '✍️', text: 'Writing pillar 1 — platform posts' },
  { emoji: '✍️', text: 'Writing pillar 2 — platform posts' },
  { emoji: '✍️', text: 'Writing pillar 3 — platform posts' },
  { emoji: '✍️', text: 'Writing pillars 4 and 5' },
  { emoji: '🎣', text: 'Crafting scroll-stopping hooks' },
  { emoji: '✨', text: 'Finalizing your content library' },
]

const BONUS_MESSAGES = [
  { emoji: '📅', text: 'Building your 4-week content calendar' },
  { emoji: '🎬', text: 'Writing reel scripts for top pillars' },
  { emoji: '🎠', text: 'Creating carousel slide frameworks' },
  { emoji: '📱', text: 'Designing story sequences' },
  { emoji: '🎁', text: 'Packaging your bonus content formats' },
]

const FUN_FACTS = [
  'The average social post takes 27 minutes to write. Alex does it in seconds.',
  'Posts that use customer language convert 3x better than generic copy.',
  'Consistency beats virality — pillars help you post without thinking.',
  'Your best hooks come from your customers, not from copywriters.',
  'Content that addresses fear outperforms content that sells features.',
  'The hook is 80% of the post — everything else is the follow-through.',
  'Businesses that post 3x/week see 3.5x more engagement than 1x/week.',
  'Social proof in captions increases saves by up to 40%.',
]

export default function GeneratingScreen({
  generationNumber, bonusLoading, vocPhraseCount, businessName
}: Props) {
  const messages = bonusLoading ? BONUS_MESSAGES : CORE_MESSAGES
  const [messageIndex, setMessageIndex] = useState(0)
  const [factIndex, setFactIndex] = useState(Math.floor(Math.random() * FUN_FACTS.length))
  const [dots, setDots] = useState('.')
  const [fadeIn, setFadeIn] = useState(true)

  // Cycle through status messages
  useEffect(() => {
    setMessageIndex(0)
    const interval = setInterval(() => {
      setFadeIn(false)
      setTimeout(() => {
        setMessageIndex(prev => Math.min(prev + 1, messages.length - 1))
        setFadeIn(true)
      }, 300)
    }, bonusLoading ? 4000 : 5500)
    return () => clearInterval(interval)
  }, [bonusLoading, messages.length])

  // Cycle fun facts every 12 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex(prev => (prev + 1) % FUN_FACTS.length)
    }, 12000)
    return () => clearInterval(interval)
  }, [])

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const current = messages[Math.min(messageIndex, messages.length - 1)]

  return (
    <div className="max-w-lg mx-auto mt-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#191654' }}>
          <Share2 size={20} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: '#191654' }}>
            {bonusLoading
              ? 'Building bonus content formats'
              : generationNumber === 1
                ? `Building ${businessName ? `${businessName}'s` : 'your'} content library`
                : `Regenerating your content library (${generationNumber}/3)`}
          </p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            Takes 45–60 seconds — your content is worth the wait
          </p>
        </div>
      </div>

      {/* Animated status */}
      <div className="p-5 rounded-2xl mb-6"
        style={{
          backgroundColor: 'rgba(67,198,172,0.06)',
          border: '1px solid rgba(67,198,172,0.2)',
          transition: 'opacity 0.3s',
          opacity: fadeIn ? 1 : 0,
        }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">{current.emoji}</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#191654' }}>
              {current.text}{dots}
            </p>
            {messageIndex === 0 && (vocPhraseCount ?? 0) > 0 && (
              <p className="text-xs mt-0.5" style={{ color: '#43C6AC' }}>
                {vocPhraseCount} customer phrases ready to use
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="w-full rounded-full overflow-hidden" style={{ height: 4, backgroundColor: '#e5e7eb' }}>
          <div
            className="h-full rounded-full"
            style={{
              backgroundColor: '#43C6AC',
              width: `${Math.min(((messageIndex + 1) / messages.length) * 100, 95)}%`,
              transition: 'width 5.5s ease-in-out',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            Step {Math.min(messageIndex + 1, messages.length)} of {messages.length}
          </p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            {bonusLoading ? 'Bonus formats' : 'Core content'}
          </p>
        </div>
      </div>

      {/* Fun fact card */}
      <div className="p-4 rounded-2xl" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <p className="text-xs font-bold mb-1.5" style={{ color: '#9ca3af' }}>
          DID YOU KNOW
        </p>
        <p className="text-sm" style={{ color: '#374151', lineHeight: 1.5 }}>
          {FUN_FACTS[factIndex]}
        </p>
      </div>
    </div>
  )
}
