export const dynamic = 'force-dynamic'

import DashboardLayoutClient from './DashboardLayoutClient'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayoutClient>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </DashboardLayoutClient>
  )
}
