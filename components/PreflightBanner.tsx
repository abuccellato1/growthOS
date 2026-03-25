'use client'

import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { PreflightResult } from '@/lib/module-preflight'

interface PreflightBannerProps {
  preflight: PreflightResult
  moduleName: string
}

export default function PreflightBanner({
  preflight,
  moduleName,
}: PreflightBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (preflight.ready && preflight.warnings.length === 0) return null

  // Hard block — module cannot run
  if (!preflight.ready && preflight.issues.length > 0) {
    return (
      <div
        className="p-4 rounded-xl border mb-6 flex items-start justify-between gap-3"
        style={{ borderColor: '#fca5a5', backgroundColor: '#fff5f5' }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: '#ef4444' }}>
              {moduleName} is not available yet
            </p>
            {preflight.issues.map((issue, i) => (
              <p key={i} className="text-xs" style={{ color: '#6b7280' }}>{issue}</p>
            ))}
            <Link
              href="/dashboard/business-signals"
              className="text-xs font-semibold mt-2 inline-block"
              style={{ color: '#ef4444' }}
            >
              Fix in BusinessSignals →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Soft warnings — module runs but with limitations
  return (
    <div
      className="p-4 rounded-xl border mb-6"
      style={{ borderColor: '#fcd34d', backgroundColor: '#fffbeb' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: '#92400e' }}>
              {moduleName} will run with limited data
            </p>
            {preflight.warnings.map((warning, i) => (
              <p key={i} className="text-xs mb-1" style={{ color: '#6b7280' }}>
                • {warning}
              </p>
            ))}
            <Link
              href="/dashboard/business-signals"
              className="text-xs font-semibold mt-1 inline-block"
              style={{ color: '#f59e0b' }}
            >
              Improve data quality in BusinessSignals →
            </Link>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
        >
          <X size={16} style={{ color: '#9ca3af' }} />
        </button>
      </div>
    </div>
  )
}
