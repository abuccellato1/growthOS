'use client'
import ModuleGate from '@/components/ModuleGate'
import GenericSalesPage from '@/components/modules/GenericSalesPage'

export default function GTMPlanPage() {
  return (
    <ModuleGate productType="gtm_plan" salesPage={
      <GenericSalesPage name="SignalLaunch"
        description="Your full go-to-market strategy — channel recommendations, funnel structure, offer positioning, and messaging framework — all built from your ICP data."
        iconName="Map"
        deliverables={['Channel prioritization ranked by ICP fit','Full funnel structure with stage messaging','Offer positioning framework','Launch timeline and milestones','Budget allocation by channel','KPIs and success metrics']} />
    }>
      <div className="max-w-2xl"><p className="text-sm" style={{ color: '#6b7280' }}>SignalLaunch is coming soon.</p></div>
    </ModuleGate>
  )
}
