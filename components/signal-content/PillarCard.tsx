'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import PostPreviewCard from './PostPreviewCard'
import type { Pillar, ContentFeedbackItem } from './types'

interface Props {
  pillar: Pillar
  pillarIndex: number
  activePlatforms: string[]
  contentFeedback: Record<string, ContentFeedbackItem>
  onRate: (item: ContentFeedbackItem) => void
}

export default function PillarCard({ pillar, pillarIndex, activePlatforms, contentFeedback, onRate }: Props) {
  const [open, setOpen] = useState(true)

  const platformMap: Record<string, 'linkedin' | 'instagram' | 'facebook'> = {
    'LinkedIn': 'linkedin',
    'Instagram': 'instagram',
    'Facebook': 'facebook',
  }

  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        style={{ backgroundColor: '#f9fafb' }}>
        <div>
          <span className="text-2xl font-black" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
            Pillar {pillarIndex + 1}: {pillar.name}
          </span>
        </div>
        {open ? <ChevronUp size={16} style={{ color: '#9ca3af' }} /> : <ChevronDown size={16} style={{ color: '#9ca3af' }} />}
      </button>

      {open && (
        <div className="p-6 space-y-5">
          {/* Pillar context */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(67,198,172,0.04)', border: '1px solid rgba(67,198,172,0.15)' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#43C6AC' }}>THEME</p>
            <p className="text-xs mb-3" style={{ color: '#374151' }}>{pillar.theme}</p>
            <p className="text-xs font-bold mb-1" style={{ color: '#43C6AC' }}>WHY THIS RESONATES WITH YOUR SIGNALMAP</p>
            <p className="text-xs" style={{ color: '#374151' }}>{pillar.icpConnection}</p>
          </div>

          {/* Platform previews — responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePlatforms.map(platform => {
              const key = platformMap[platform]
              if (!key || !pillar.posts[key]) return null
              return (
                <div key={platform} className="flex flex-col">
                  <p className="text-xs font-bold mb-3"
                    style={{ color: '#9ca3af' }}>
                    {platform.toUpperCase()}
                  </p>
                  <PostPreviewCard
                    pillarIndex={pillarIndex}
                    platform={key}
                    post={pillar.posts[key]!}
                    unsplashQuery={pillar.unsplashQuery}
                    contentFeedback={contentFeedback}
                    onRate={onRate}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
