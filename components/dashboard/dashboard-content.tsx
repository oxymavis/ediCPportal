"use client"

import OverviewTab from "./tabs/overview-tab"
import DeveloperAppsTab from "./tabs/developer-apps-tab"
import CertificatesTab from "./tabs/certificates-tab"
import TransactionsTab from "./tabs/transactions-tab"
import PartnersTab from "./tabs/partners-tab"
import NotificationsTab from "./tabs/notifications-tab"
import SpecificationsTab from "./tabs/specifications-tab"
import ApiDocsTab from "./tabs/api-docs-tab"
import ConnectionTestingTab from "./tabs/connection-testing-tab"

interface DashboardContentProps {
  activeTab: string
  onNavigate?: (tab: string) => void
}

export default function DashboardContent({ activeTab, onNavigate }: DashboardContentProps) {
  const renderTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <OverviewTab onNavigate={onNavigate} />
      case "developer-apps":
        return <DeveloperAppsTab />
      case "partners":
        return <PartnersTab onNavigate={onNavigate} />
      case "certificates":
        return <CertificatesTab />
      case "specifications":
        return <SpecificationsTab />
      case "api-docs":
        return <ApiDocsTab />
      case "transactions":
        return <TransactionsTab />
      case "connection-testing":
        return <ConnectionTestingTab />
      case "notifications":
        return <NotificationsTab />
      default:
        return <OverviewTab onNavigate={onNavigate} />
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {renderTab()}
    </div>
  )
}
