'use client'

import { Check, X, Loader, RefreshCw } from 'lucide-react'
import type { PillarApprovalState } from './types'

interface Props {
  state: PillarApprovalState
  index: number
  isSwapping: boolean
  onApprove: () => void
  onReject: () => void
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Authority/expertise demonstration': { bg: 'rgba(67,198,172,0.1)', text: '#43C6AC' },
  'Customer transformation story': { bg: 'rgba(25,22,84,0.08)', text: '#191654' },
  'Problem awareness / education': { bg: '#fef3c7', text: '#d97706' },
  'Behind the scenes / process transparency': { bg: '#f0f9ff', text: '#0284c7' },
  'Social proof / results': { bg: '#f0fdf4', text: '#16a34a' },
  'Myth busting / industry truth': { bg: '#fef2f2', text: '#dc2626' },
  'Direct callout to ideal customer': { bg: '#faf5ff', text: '#7c3aed' },
}

export default function PillarApprovalCard({
  state, index, isSwapping, onApprove, onReject,
}: Props) {
  const { pillar, status } = state
  const colors = CATEGORY_COLORS[pillar.category] ||
    { bg: 'rgba(67,198,172,0.08)', text: '#43C6AC' }

  const isApproved = status === 'approved' || status === 'swapped' || status === 'custom'
  const isRejected = status === 'rejected'

  return (
    <div
      className="rounded-2xl border p-5 transition-all"
      style={{
        borderColor: isApproved ? '#43C6AC'
          : isRejected ? '#fecaca'
          : '#e5e7eb',
        backgroundColor: isApproved ? 'rgba(67,198,172,0.04)'
          : isRejected ? '#fff5f5'
          : '#ffffff',
      }}
    >
      {/* Pillar number + category */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>
          PILLAR {index + 1}
        </span>
        {isSwapping ? (
          <div className="flex items-center gap-1.5">
            <Loader size={12} className="animate-spin" style={{ color: '#43C6AC' }} />
            <span className="text-xs" style={{ color: '#43C6AC' }}>
              Finding replacement…
            </span>
          </div>
        ) : (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {pillar.category}
          </span>
        )}
      </div>

      {/* Pillar name */}
      <p
        className="text-base font-bold mb-1"
        style={{
          fontFamily: 'Playfair Display, serif',
          color: isRejected ? '#9ca3af' : '#191654',
          textDecoration: isRejected ? 'line-through' : 'none',
        }}
      >
        {pillar.name}
      </p>

      {/* Rationale */}
      <p className="text-xs mb-1 leading-relaxed" style={{ color: '#6b7280' }}>
        {pillar.rationale}
      </p>

      {/* ICP connection */}
      <p className="text-xs leading-relaxed" style={{ color: '#9ca3af' }}>
        <span className="font-semibold" style={{ color: '#43C6AC' }}>
          Why it works:{' '}
        </span>
        {pillar.icpConnection}
      </p>

      {/* Status badges / action buttons */}
      <div className="mt-4">
        {isApproved ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Check size={14} style={{ color: '#43C6AC' }} />
              <span className="text-xs font-semibold" style={{ color: '#43C6AC' }}>
                {status === 'swapped' ? 'Replacement approved'
                  : status === 'custom' ? 'Custom pillar added'
                  : 'Approved'}
              </span>
            </div>
            <button
              onClick={onReject}
              className="text-xs px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
              style={{ color: '#9ca3af' }}
            >
              <RefreshCw size={11} /> Change
            </button>
          </div>
        ) : isRejected ? (
          <div className="flex items-center gap-1.5">
            <X size={14} style={{ color: '#dc2626' }} />
            <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>
              Rejected
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onApprove}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ backgroundColor: '#43C6AC', color: '#fff' }}
            >
              <Check size={13} /> Approve
            </button>
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all"
              style={{ borderColor: '#fecaca', color: '#dc2626', backgroundColor: '#fff' }}
            >
              <X size={13} /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
