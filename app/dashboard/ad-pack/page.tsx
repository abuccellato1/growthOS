import ModuleGate from '@/components/ModuleGate'
import AdPackSalesPage from '@/components/modules/AdPackSalesPage'

export default function AdPackPage() {
  return (
    <ModuleGate
      name="SignalAds"
      description="Hooks, angles, and ad copy frameworks written in the exact language of your ideal customer. Ready to hand to your ad manager or use directly in your campaigns."
      productType="ad_pack"
      iconName="Target"
    >
      {({ businessId }) => (
        <AdPackSalesPage businessId={businessId} />
      )}
    </ModuleGate>
  )
}
