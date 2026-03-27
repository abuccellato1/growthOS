'use client'
import ModuleGate from '@/components/ModuleGate'
import GenericSalesPage from '@/components/modules/GenericSalesPage'

export default function EmailPackPage() {
  return (
    <ModuleGate productType="email_pack" salesPage={
      <GenericSalesPage name="SignalSequences"
        description="A 5-part nurture sequence that moves your ideal customer from pain-aware to ready-to-buy, using the exact language Alex uncovered in your interview."
        iconName="Mail"
        deliverables={['5-email nurture sequence with subject lines','Pain-aware to solution-aware progression','Objection-handling email built from ICP data','Social proof email using CustomerSignals','CTA strategy matched to buying triggers','Re-engagement sequence variant']} />
    }>
      <div className="max-w-2xl"><p className="text-sm" style={{ color: '#6b7280' }}>SignalSequences is coming soon.</p></div>
    </ModuleGate>
  )
}
