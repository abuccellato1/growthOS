'use client'
import ModuleGate from '@/components/ModuleGate'
import GenericSalesPage from '@/components/modules/GenericSalesPage'

export default function ActionPlanPage() {
  return (
    <ModuleGate productType="action_plan" salesPage={
      <GenericSalesPage name="SignalSprint"
        description="A prioritized week-by-week action list for the first 90 days — exactly what to do first, second, and third so your ICP intelligence doesn't sit unused."
        iconName="Calendar"
        deliverables={['90-day week-by-week action plan','Priority-ranked task list by impact','Quick wins identified from ICP data','Channel activation sequence','Milestone checkpoints with success criteria','Resource and tool recommendations']} />
    }>
      <div className="max-w-2xl"><p className="text-sm" style={{ color: '#6b7280' }}>SignalSprint is coming soon.</p></div>
    </ModuleGate>
  )
}
