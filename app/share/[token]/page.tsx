'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader, FileText } from 'lucide-react'

const ICPDisplay = dynamic(() => import('@/components/ICPDisplay'), {
  loading: () => (
    <div className="flex items-center justify-center h-48">
      <Loader size={28} className="animate-spin" style={{ color: '#43C6AC' }} />
    </div>
  ),
  ssr: false,
})

interface ShareData {
  icp_html: string
  business_name: string
  expires_at: string
  shareability: Record<string, unknown> | null
}

export default function SharePage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<ShareData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/share/${token}`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          setError(errData.error || 'This link is no longer available.')
          setLoading(false)
          return
        }
        const result = await res.json()
        setData(result.data || result)
      } catch {
        setError('Failed to load shared document.')
      }
      setLoading(false)
    }
    if (token) load()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f9fc' }}>
        <Loader size={36} className="animate-spin" style={{ color: '#43C6AC' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f9fc' }}>
        <div className="text-center max-w-md px-6">
          <FileText size={48} className="mx-auto mb-4" style={{ color: '#d1d5db' }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
            {error}
          </h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            This shared SignalMap link may have expired or been removed.
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const expiresDate = new Date(data.expires_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9fc' }}>
      {/* Header */}
      <header className="border-b px-6 py-4" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#191654', fontFamily: 'Playfair Display, serif' }}>
              SignalMap — {data.business_name}
            </h1>
            <p className="text-xs" style={{ color: '#9ca3af' }}>
              Shared by {data.business_name} · Expires {expiresDate}
            </p>
          </div>
        </div>
      </header>

      {/* ICP Document */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
          <ICPDisplay icpMarkdown={data.icp_html} sessionId="" />
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8">
        <p className="text-xs" style={{ color: '#9ca3af' }}>
          Powered by SignalShot
        </p>
      </footer>
    </div>
  )
}
