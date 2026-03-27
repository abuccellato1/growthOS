'use client'

import Link from 'next/link'
import { ArrowRight, Share2, Mail, Map, Calendar } from 'lucide-react'

const ICON_MAP = { Share2, Mail, Map, Calendar } as const
type IconName = keyof typeof ICON_MAP

interface GenericSalesPageProps {
  name: string
  description: string
  iconName: IconName
  deliverables: string[]
}

export default function GenericSalesPage({ name, description, iconName, deliverables }: GenericSalesPageProps) {
  const Icon = ICON_MAP[iconName]
  return (
    <div className="max-w-2xl">
      <div className="flex items-start gap-4 mb-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#191654' }}>
          <Icon size={30} style={{ color: '#43C6AC' }} />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold"
              style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
              {name}
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(67,198,172,0.12)', color: '#43C6AC' }}>
              Add-on
            </span>
          </div>
          <p className="text-base" style={{ color: '#6b7280' }}>{description}</p>
        </div>
      </div>

      <div className="p-6 rounded-2xl border mb-8"
        style={{ borderColor: '#43C6AC', backgroundColor: 'rgba(67,198,172,0.04)' }}>
        <p className="text-sm font-bold mb-4" style={{ color: '#191654' }}>What you get</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {deliverables.map((d) => (
            <div key={d} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#43C6AC' }} />
              <p className="text-xs" style={{ color: '#374151' }}>{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
        <div>
          <p className="text-xs font-semibold mb-0.5" style={{ color: '#9ca3af' }}>ADD-ON PRICING</p>
          <p className="text-2xl font-bold"
            style={{ fontFamily: 'Playfair Display, serif', color: '#191654' }}>
            Included in SignalSuite
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Or available as a standalone add-on</p>
        </div>
        <Link href="/pricing"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm flex-shrink-0 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#191654' }}>
          View pricing <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
