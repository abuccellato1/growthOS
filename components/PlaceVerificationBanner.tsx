'use client'

import { useState } from 'react'
import { MapPin, X } from 'lucide-react'

interface PlaceVerificationBannerProps {
  onVerifyClick: () => void
}

export default function PlaceVerificationBanner({
  onVerifyClick,
}: PlaceVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      className="p-4 rounded-xl border mb-6 flex items-center justify-between gap-3"
      style={{ borderColor: 'rgba(67,198,172,0.3)', backgroundColor: 'rgba(67,198,172,0.06)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(67,198,172,0.15)' }}
        >
          <MapPin size={18} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#191654' }}>
            Verify your business on Google
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
            Unlock automatic review extraction, richer ad data, and photo access for all modules.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onVerifyClick}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#43C6AC' }}
        >
          Verify Now
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <X size={16} style={{ color: '#9ca3af' }} />
        </button>
      </div>
    </div>
  )
}
