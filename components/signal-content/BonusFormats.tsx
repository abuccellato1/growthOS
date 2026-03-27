'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Film, Layout, Layers } from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import type { ReelScript, CarouselFramework, StorySequence } from './types'

interface Props {
  reelScripts?: ReelScript[]
  carouselFrameworks?: CarouselFramework[]
  storySequences?: StorySequence[]
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        style={{ backgroundColor: '#f9fafb' }}>
        <div className="flex items-center gap-2">
          <Icon size={15} style={{ color: '#43C6AC' }} />
          <span className="text-sm font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>{title}</span>
        </div>
        {open ? <ChevronUp size={16} style={{ color: '#9ca3af' }} /> : <ChevronDown size={16} style={{ color: '#9ca3af' }} />}
      </button>
      {open && <div className="p-6">{children}</div>}
    </div>
  )
}

function ReelScriptCard({ reel, index }: { reel: ReelScript; index: number }) {
  const fullScript = `REEL: ${reel.pillar}\nDuration: ${reel.totalDuration}\n\nHOOK (opening):\n${reel.hook}\n\n${reel.segments.map(s => `[${s.timeCode}]\n${s.script}\nVisual: ${s.visualNote}`).join('\n\n')}\n\nCTA: ${reel.cta}\n\nCaption suggestion: ${reel.captionSuggestion}`
  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold" style={{ color: '#191654' }}>Reel {index + 1}: {reel.pillar}</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>{reel.totalDuration}</p>
        </div>
        <CopyButton text={fullScript} variant="button" label="Copy script" />
      </div>
      <div className="space-y-3">
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(67,198,172,0.06)', border: '1px solid rgba(67,198,172,0.15)' }}>
          <p className="text-xs font-bold mb-1" style={{ color: '#43C6AC' }}>HOOK (first 3 seconds)</p>
          <p className="text-xs" style={{ color: '#191654' }}>{reel.hook}</p>
        </div>
        {reel.segments.map((seg, si) => (
          <div key={si} className="p-3 rounded-lg" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>{seg.timeCode}</p>
            <p className="text-xs mb-1" style={{ color: '#374151' }}>{seg.script}</p>
            <p className="text-xs italic" style={{ color: '#9ca3af' }}>📷 {seg.visualNote}</p>
          </div>
        ))}
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs" style={{ color: '#374151' }}><strong>CTA:</strong> {reel.cta}</p>
          <CopyButton text={reel.cta} />
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs" style={{ color: '#6b7280' }}><strong>Caption:</strong> {reel.captionSuggestion}</p>
          <CopyButton text={reel.captionSuggestion} />
        </div>
      </div>
    </div>
  )
}

function CarouselCard({ carousel, index }: { carousel: CarouselFramework; index: number }) {
  const fullCarousel = `CAROUSEL: ${carousel.pillar}\n\nCOVER: ${carousel.coverSlide.headline}\n${carousel.coverSlide.subtext}\n\n${carousel.slides.map(s => `SLIDE ${s.slideNumber}: ${s.headline}\n${s.bodyText}\nVisual: ${s.visualNote}`).join('\n\n')}\n\nCLOSING: ${carousel.closingSlide.text}\n${carousel.closingSlide.cta}`
  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold" style={{ color: '#191654' }}>Carousel {index + 1}: {carousel.pillar}</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>{carousel.slideCount} slides</p>
        </div>
        <CopyButton text={fullCarousel} variant="button" label="Copy framework" />
      </div>
      <div className="space-y-2">
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(67,198,172,0.06)', border: '1px solid rgba(67,198,172,0.15)' }}>
          <p className="text-xs font-bold mb-0.5" style={{ color: '#43C6AC' }}>COVER SLIDE</p>
          <p className="text-xs font-semibold" style={{ color: '#191654' }}>{carousel.coverSlide.headline}</p>
          <p className="text-xs" style={{ color: '#6b7280' }}>{carousel.coverSlide.subtext}</p>
        </div>
        {carousel.slides.map((slide, si) => (
          <div key={si} className="p-3 rounded-lg flex items-start gap-3"
            style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <span className="text-xs font-bold flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#191654', color: '#43C6AC' }}>
              {slide.slideNumber}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold mb-0.5" style={{ color: '#191654' }}>{slide.headline}</p>
              <p className="text-xs mb-1" style={{ color: '#374151' }}>{slide.bodyText}</p>
              <p className="text-xs italic" style={{ color: '#9ca3af' }}>📷 {slide.visualNote}</p>
            </div>
          </div>
        ))}
        <div className="p-3 rounded-lg" style={{ backgroundColor: '#191654' }}>
          <p className="text-xs font-bold mb-0.5" style={{ color: '#43C6AC' }}>CLOSING SLIDE</p>
          <p className="text-xs" style={{ color: '#ffffff' }}>{carousel.closingSlide.text}</p>
          <p className="text-xs font-semibold mt-1" style={{ color: '#43C6AC' }}>{carousel.closingSlide.cta}</p>
        </div>
      </div>
    </div>
  )
}

function StoryCard({ story, index }: { story: StorySequence; index: number }) {
  const fullStory = `STORY: ${story.pillar}\n\n${story.frames.map(f => `FRAME ${f.frameNumber}: ${f.text}\nVisual: ${f.visualNote}\nSticker: ${f.stickerSuggestion}`).join('\n\n')}`
  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold" style={{ color: '#191654' }}>Story {index + 1}: {story.pillar}</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>{story.frameCount} frames</p>
        </div>
        <CopyButton text={fullStory} variant="button" label="Copy sequence" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {story.frames.map((frame, fi) => (
          <div key={fi} className="flex-shrink-0 w-32 rounded-xl p-3 flex flex-col justify-between"
            style={{ backgroundColor: '#191654', minHeight: 160 }}>
            <span className="text-xs font-bold" style={{ color: '#43C6AC' }}>{frame.frameNumber}</span>
            <p className="text-xs font-semibold text-center" style={{ color: '#ffffff' }}>{frame.text}</p>
            <div>
              <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.5)' }}>📷 {frame.visualNote}</p>
              {frame.stickerSuggestion && (
                <p className="text-xs mt-1" style={{ color: '#43C6AC' }}>🎯 {frame.stickerSuggestion}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BonusFormats({ reelScripts, carouselFrameworks, storySequences }: Props) {
  return (
    <div className="space-y-4">
      {reelScripts && reelScripts.length > 0 && (
        <Section title="Reel Scripts" icon={Film}>
          <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
            Word-for-word scripts ready to record. Just add your visuals.
          </p>
          <div className="space-y-4">
            {reelScripts.map((reel, i) => <ReelScriptCard key={i} reel={reel} index={i} />)}
          </div>
        </Section>
      )}

      {carouselFrameworks && carouselFrameworks.length > 0 && (
        <Section title="Carousel Frameworks" icon={Layout}>
          <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
            Slide-by-slide frameworks. Add your branded images to each slide.
          </p>
          <div className="space-y-4">
            {carouselFrameworks.map((c, i) => <CarouselCard key={i} carousel={c} index={i} />)}
          </div>
        </Section>
      )}

      {storySequences && storySequences.length > 0 && (
        <Section title="Story Sequences" icon={Layers}>
          <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
            Frame-by-frame story plans. Each frame = one screen.
          </p>
          <div className="space-y-4">
            {storySequences.map((s, i) => <StoryCard key={i} story={s} index={i} />)}
          </div>
        </Section>
      )}
    </div>
  )
}
