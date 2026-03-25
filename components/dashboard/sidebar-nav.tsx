"use client"

export default function SidebarNav({
  activeTab,
  setActiveTab,
}: {
  activeTab: string
  setActiveTab: (tab: string) => void
}) {
  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "developer-apps", label: "Developer Apps" },
    { id: "partners", label: "Trading Partners" },
    { id: "certificates", label: "Certificates" },
    { id: "specifications", label: "Message Specifications" },
    { id: "api-docs", label: "API Documentation" },
    { id: "connection-testing", label: "Connection Testing" },
    { id: "transactions", label: "Transactions" },
    { id: "notifications", label: "Notifications" },
  ]

  return (
    <nav className="flex-1 px-4 py-6 space-y-1">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
            activeTab === item.id
              ? "bg-primary/10 text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
          }`}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
