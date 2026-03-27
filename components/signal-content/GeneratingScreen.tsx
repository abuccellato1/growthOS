'use client'

import { useState, useEffect } from 'react'
import { Share2 } from 'lucide-react'

interface Step { label: string; duration: number }

interface Props {
  generationNumber: number
  bonusLoading: boolean
}

const CORE_STEPS: Step[] = [
  { label: 'Reading your SignalMap Interview Data', duration: 3000 },
  { label: 'Checking CustomerSignals Data', duration: 3000 },
  { label: 'Loading BusinessSignals Research', duration: 3000 },
  { label: 'Mapping Your 5 Content Pillars', duration: 4000 },
  { label: 'Writing your SignalContent Library', duration: 6000 },
]

const BONUS_STEPS: Step[] = [
  { label: 'Building your 4-Week Content Calendar', duration: 4000 },
  { label: 'Writing Reel Scripts + Carousel Frameworks', duration: 5000 },
  { label: 'Finalizing Story Sequences', duration: 3000 },
]

export default function GeneratingScreen({ generationNumber, bonusLoading }: Props) {
  const steps = bonusLoading ? BONUS_STEPS : CORE_STEPS
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  useEffect(() => {
    setCurrentStep(0)
    setCompletedSteps([])
    let stepIndex = 0
    let timeout: ReturnType<typeof setTimeout>
    function advance() {
      setCompletedSteps(prev => [...prev, stepIndex])
      stepIndex++
      if (stepIndex < steps.length) {
        setCurrentStep(stepIndex)
        timeout = setTimeout(advance, steps[stepIndex].duration)
      }
    }
    timeout = setTimeout(advance, steps[0].duration)
    return () => clearTimeout(timeout)
  }, [bonusLoading])

  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#191654' }}>
          <Share2 size={18} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: '#191654' }}>
            {bonusLoading
              ? 'Building bonus content formats…'
              : generationNumber === 1
                ? 'Building your content library…'
                : `Regenerating (${generationNumber}/3)…`}
          </p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            {bonusLoading ? 'Almost done — adding reels, carousels + calendar' : 'Takes about 30–45 seconds'}
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const isDone = completedSteps.includes(i)
          const isActive = currentStep === i
          const isPending = !isDone && !isActive
          return (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{
                backgroundColor: isActive ? 'rgba(67,198,172,0.06)' : 'transparent',
                border: isActive ? '1px solid rgba(67,198,172,0.2)' : '1px solid transparent',
                opacity: isPending ? 0.35 : 1,
              }}>
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {isDone ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="8" fill="#43C6AC" fillOpacity="0.15" />
                    <path d="M4.5 8L7 10.5L11.5 6" stroke="#43C6AC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isActive ? (
                  <div className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: '#43C6AC', borderTopColor: 'transparent' }} />
                ) : (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#e5e7eb' }} />
                )}
              </div>
              <p className="text-sm" style={{
                color: isDone ? '#6b7280' : isActive ? '#191654' : '#9ca3af',
                fontWeight: isActive ? 600 : 400,
              }}>
                {step.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
