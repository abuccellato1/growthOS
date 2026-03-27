'use client'
import ModuleGate from '@/components/ModuleGate'
import GenericSalesPage from '@/components/modules/GenericSalesPage'

export default function SocialPackPage() {
  return (
    <ModuleGate productType="social_pack" salesPage={
      <GenericSalesPage name="SignalContent"
        description="Content pillars and post templates built from your ICP data. Every piece speaks directly to your ideal customer's language, problems, and aspirations."
        iconName="Share2"
        deliverables={['5 content pillars mapped to ICP pain points','15 post templates per pillar','Platform-specific formatting (LinkedIn, Instagram, Facebook)','Hook formulas from CustomerSignals language','Content calendar framework','Repurposing guide across formats']} />
    }>
      <div className="max-w-2xl"><p className="text-sm" style={{ color: '#6b7280' }}>SignalContent is coming soon.</p></div>
    </ModuleGate>
  )
}
