"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import DashboardContent from "./dashboard-content"
import SidebarNav from "./sidebar-nav"

export default function DashboardLayout({ user }: { user: any }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/")
  }

  const tabTitles: Record<string, string> = {
    dashboard: "Dashboard",
    partners: "Trading Partners",
    certificates: "Certificates",
    specifications: "Message Specifications",
    "api-docs": "API Documentation",
    "connection-testing": "Connection Testing",
    transactions: "Transactions",
    notifications: "Notifications",
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 bg-card border-r border-border overflow-hidden flex flex-col`}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-12 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-sm tracking-wide">EDI</span>
            </div>
            <span className="font-semibold text-foreground">UNIS EDI Portal</span>
          </div>
        </div>

        <SidebarNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* User Info and Logout */}
        <div className="mt-auto p-6 border-t border-border space-y-4">
          <div className="text-sm">
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start gap-2 text-destructive hover:bg-destructive/5 bg-transparent"
          >
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors md:hidden text-xl font-bold"
            >
              {sidebarOpen ? "\u00d7" : "\u2630"}
            </button>
            <h1 className="text-lg font-semibold text-foreground">{tabTitles[activeTab]}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Company:</span>
            <span className="text-sm font-semibold text-foreground">Midea Group</span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <DashboardContent activeTab={activeTab} onNavigate={setActiveTab} />
        </main>
      </div>
    </div>
  )
}
