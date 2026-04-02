'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

const REJECTION_REASONS = [
  'Not relevant to my business',
  'Already covered this topic',
  'Wrong audience angle',
  'Too generic',
  'Wrong tone for my brand',
]

interface Props {
  pillarName: string
  onConfirm: (reason: string, action: 'swap' | 'custom', customName?: string) => void
  onCancel: () => void
}

export default function PillarRejectionModal({ pillarName, onConfirm, onCancel }: Props) {
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [action, setAction] = useState<'swap' | 'custom' | null>(null)
  const [customName, setCustomName] = useState('')

  const reason = selectedReason || customReason

  function handleConfirm() {
    if (!reason || !action) return
    if (action === 'custom' && !customName.trim()) return
    onConfirm(reason, action, action === 'custom' ? customName.trim() : undefined)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md"
        style={{ border: '1px solid #e5e7eb' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: '#e5e7eb' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: '#191654' }}>
              Why doesn&apos;t this pillar work?
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              &quot;{pillarName}&quot;
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={16} style={{ color: '#9ca3af' }} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Predefined reasons */}
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>
              Select a reason
            </p>
            <div className="space-y-1.5">
              {REJECTION_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => { setSelectedReason(r); setCustomReason('') }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs border transition-all"
                  style={{
                    borderColor: selectedReason === r ? '#43C6AC' : '#e5e7eb',
                    backgroundColor: selectedReason === r
                      ? 'rgba(67,198,172,0.08)' : '#fff',
                    color: selectedReason === r ? '#191654' : '#6b7280',
                    fontWeight: selectedReason === r ? 600 : 400,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Custom reason */}
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: '#374151' }}>
              Or describe why
            </p>
            <textarea
              rows={2}
              placeholder="e.g. 'We tried this angle before and it didn't resonate'"
              value={customReason}
              onChange={e => { setCustomReason(e.target.value); setSelectedReason('') }}
              className="w-full text-xs px-3 py-2 rounded-lg border outline-none resize-none"
              style={{ borderColor: '#e5e7eb', color: '#374151' }}
            />
          </div>

          {/* Action choice */}
          {reason && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: '#374151' }}>
                What would you like instead?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAction('swap')}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    borderColor: action === 'swap' ? '#43C6AC' : '#e5e7eb',
                    backgroundColor: action === 'swap'
                      ? 'rgba(67,198,172,0.08)' : '#fff',
                    color: action === 'swap' ? '#191654' : '#6b7280',
                  }}
                >
                  🔄 Suggest a replacement
                </button>
                <button
                  onClick={() => setAction('custom')}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    borderColor: action === 'custom' ? '#43C6AC' : '#e5e7eb',
                    backgroundColor: action === 'custom'
                      ? 'rgba(67,198,172,0.08)' : '#fff',
                    color: action === 'custom' ? '#191654' : '#6b7280',
                  }}
                >
                  ✏️ Enter my own
                </button>
              </div>

              {/* Custom pillar name input */}
              {action === 'custom' && (
                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Enter your pillar name"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border outline-none"
                    style={{ borderColor: '#e5e7eb', color: '#374151' }}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={!reason || !action || (action === 'custom' && !customName.trim())}
            className="w-full py-3 rounded-xl text-white text-xs font-bold transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#191654' }}
          >
            {action === 'swap' ? 'Get Replacement Pillar' : 'Use My Pillar'}
          </button>
        </div>
      </div>
    </div>
  )
}
