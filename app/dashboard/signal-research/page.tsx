'use client'

import { Loader } from 'lucide-react'

export default function SignalResearchPage() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}>
          <Loader size={22} style={{ color: '#6366f1' }} className="animate-spin" />
        </div>
        <p className="text-sm font-semibold" style={{ color: '#191654' }}>
          SignalResearch is being set up…
        </p>
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
          Nora will be ready shortly.
        </p>
      </div>
    </div>
  )
}
