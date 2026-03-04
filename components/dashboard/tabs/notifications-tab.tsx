"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type NotificationType = "warning" | "error" | "info"

interface Notification {
  id: number
  type: NotificationType
  title: string
  message: string
  date: string
  time: string
  read: boolean
  archived: boolean
  environment: "production" | "sandbox"
  action?: {
    label: string
    link: string
  }
  details?: {
    partnerName?: string
    certificateName?: string
    expiresIn?: string
    errorCode?: string
  }
}

export default function NotificationsTab() {
  const [environment, setEnvironment] = useState<"production" | "sandbox">("production")
  const [notifications, setNotifications] = useState<Notification[]>([
    // Production Notifications
    {
      id: 1,
      type: "warning",
      title: "Certificate Expiring Soon",
      message: "AS2 Certificate for Target Stores expires in 30 days",
      date: "2024-01-15",
      time: "14:30",
      read: false,
      archived: false,
      environment: "production",
      action: { label: "View Certificate", link: "#certificates" },
      details: {
        partnerName: "Target Corporation",
        certificateName: "Target Stores - AS2",
        expiresIn: "30 days",
      },
    },
    {
      id: 2,
      type: "error",
      title: "Transaction Processing Failed",
      message: "EDI-940 document processing failed due to validation error",
      date: "2024-01-14",
      time: "10:15",
      read: false,
      archived: false,
      environment: "production",
      action: { label: "View Transaction", link: "#transactions" },
      details: {
        partnerName: "SPS Commerce",
        errorCode: "VALIDATION_ERROR_001",
      },
    },
    {
      id: 3,
      type: "warning",
      title: "Certificate Expiring Soon",
      message: "SSL Certificate for SPS Commerce expired",
      date: "2024-01-12",
      time: "15:45",
      read: true,
      archived: false,
      environment: "production",
      details: {
        partnerName: "SPS Commerce",
        certificateName: "SPS Commerce - SSL",
        expiresIn: "Expired",
      },
    },
    {
      id: 4,
      type: "info",
      title: "New Trading Partner Added",
      message: "Home Depot has been successfully configured and is ready for transactions",
      date: "2024-01-11",
      time: "11:00",
      read: true,
      archived: false,
      environment: "production",
      details: {
        partnerName: "Home Depot",
      },
    },
    {
      id: 5,
      type: "error",
      title: "AS2 Connection Failed",
      message: "Failed to establish AS2 connection with Walmart Mexico endpoint",
      date: "2024-01-10",
      time: "08:30",
      read: true,
      archived: false,
      environment: "production",
      details: {
        partnerName: "Walmart Mexico",
        errorCode: "AS2_CONNECTION_TIMEOUT",
      },
    },
    {
      id: 6,
      type: "warning",
      title: "High Transaction Volume Alert",
      message: "Transaction volume for Amazon exceeded 10,000 in the last 24 hours",
      date: "2024-01-09",
      time: "09:00",
      read: true,
      archived: false,
      environment: "production",
      details: {
        partnerName: "Amazon",
      },
    },
    {
      id: 7,
      type: "error",
      title: "Document Rejection",
      message: "856 ASN rejected by Costco - Missing required segments",
      date: "2024-01-08",
      time: "14:22",
      read: true,
      archived: true,
      environment: "production",
      details: {
        partnerName: "Costco",
        errorCode: "MISSING_SEGMENTS_HL",
      },
    },
    // Sandbox Notifications
    {
      id: 101,
      type: "info",
      title: "Sandbox Environment Ready",
      message: "Test Partner A has been configured in the sandbox environment",
      date: "2024-01-15",
      time: "09:00",
      read: false,
      archived: false,
      environment: "sandbox",
      details: {
        partnerName: "Test Partner A",
      },
    },
    {
      id: 102,
      type: "warning",
      title: "Test Certificate Expiring",
      message: "Sandbox test certificate will expire in 90 days",
      date: "2024-01-14",
      time: "10:00",
      read: true,
      archived: false,
      environment: "sandbox",
      details: {
        certificateName: "Sandbox AS2 Certificate",
        expiresIn: "90 days",
      },
    },
    {
      id: 103,
      type: "error",
      title: "Test Connection Failed",
      message: "Test connection to Test Partner B endpoint failed",
      date: "2024-01-13",
      time: "11:30",
      read: true,
      archived: false,
      environment: "sandbox",
      details: {
        partnerName: "Test Partner B",
        errorCode: "TEST_CONNECTION_ERROR",
      },
    },
  ])

  const [filterType, setFilterType] = useState<NotificationType | "all">("all")
  const [showArchived, setShowArchived] = useState(false)

  const filteredNotifications = notifications.filter((notif) => {
    const envMatch = notif.environment === environment
    const typeMatch = filterType === "all" || notif.type === filterType
    const archivedMatch = showArchived ? notif.archived : !notif.archived
    return envMatch && typeMatch && archivedMatch
  })

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case "warning":
        return "!"
      case "error":
        return "X"
      default:
        return "i"
    }
  }

  const getIconStyle = (type: NotificationType) => {
    switch (type) {
      case "warning":
        return "bg-orange-100 text-orange-600 border-orange-300"
      case "error":
        return "bg-red-100 text-red-600 border-red-300"
      default:
        return "bg-blue-100 text-blue-600 border-blue-300"
    }
  }

  const getStatusColor = (type: NotificationType) => {
    switch (type) {
      case "warning":
        return "bg-orange-50 border-orange-200"
      case "error":
        return "bg-red-50 border-red-200"
      default:
        return "bg-blue-50 border-blue-200"
    }
  }

  const unreadCount = notifications.filter((n) => !n.read && !n.archived && n.environment === environment).length

  const handleMarkAsRead = (id: number) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map((n) => (n.archived || n.environment !== environment ? n : { ...n, read: true })))
  }

  const handleArchive = (id: number) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, archived: true } : n)))
  }

  const handleInactive = (id: number) => {
    setNotifications(notifications.map((n) => n.id === id ? { ...n, archived: true } : n))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-muted-foreground">Stay updated on important events and alerts</p>
        </div>
        {/* Environment Toggle */}
        <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setEnvironment("production")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              environment === "production"
                ? "bg-green-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Production
          </button>
          <button
            onClick={() => setEnvironment("sandbox")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              environment === "sandbox"
                ? "bg-amber-500 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sandbox
          </button>
        </div>
      </div>

      {/* Environment Indicator */}
      <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
        environment === "production" 
          ? "bg-green-50 text-green-700 border border-green-200" 
          : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}>
        Currently viewing: <span className="font-bold uppercase">{environment}</span> notifications
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex gap-2 flex-wrap">
          {(["all", "warning", "error", "info"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors capitalize ${
                filterType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-primary/10"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex gap-2 md:ml-auto">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showArchived ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archived
          </button>

          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} className="gap-2 bg-transparent">
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => (
            <Card
              key={notif.id}
              className={`p-5 border transition-all cursor-pointer hover:shadow-sm ${
                notif.read ? `${getStatusColor(notif.type)} opacity-75` : `${getStatusColor(notif.type)} border-current`
              }`}
              onClick={() => handleMarkAsRead(notif.id)}
            >
              <div className="flex gap-4">
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold ${getIconStyle(notif.type)}`}>
                  {getIcon(notif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className={`font-bold ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>
                        {notif.title}
                      </h3>
                      <p className={`text-sm mt-1 ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>
                        {notif.message}
                      </p>

                      {/* Details */}
                      {notif.details && (
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          {notif.details.partnerName && (
                            <span className="px-2 py-1 bg-background/50 rounded">
                              <span className="text-muted-foreground">Partner:</span>
                              <span className="ml-1 font-medium">{notif.details.partnerName}</span>
                            </span>
                          )}
                          {notif.details.certificateName && (
                            <span className="px-2 py-1 bg-background/50 rounded">
                              <span className="text-muted-foreground">Certificate:</span>
                              <span className="ml-1 font-medium">{notif.details.certificateName}</span>
                            </span>
                          )}
                          {notif.details.expiresIn && (
                            <span className="px-2 py-1 bg-background/50 rounded">
                              <span className="text-muted-foreground">Expires:</span>
                              <span className="ml-1 font-medium">{notif.details.expiresIn}</span>
                            </span>
                          )}
                          {notif.details.errorCode && (
                            <span className="px-2 py-1 bg-background/50 rounded font-mono">
                              {notif.details.errorCode}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Timestamp and Action */}
                      <div className="flex items-center gap-4 mt-3">
                        <time className="text-xs text-muted-foreground">
                          {notif.date} at {notif.time}
                        </time>
                        {notif.action && (
                          <a
                            href={notif.action.link}
                            className="text-xs font-semibold text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {notif.action.label}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Unread indicator */}
                    {!notif.read && <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></div>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleArchive(notif.id)
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-background/50 rounded transition-colors text-sm"
                    title="Archive"
                  >
                    Archive
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleInactive(notif.id)
                    }}
                    className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded transition-colors text-sm"
                    title="Mark as Inactive"
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border border-dashed border-border">
          <div className="text-5xl mb-4 opacity-50">i</div>
          <h3 className="font-semibold text-foreground mb-1">No Notifications</h3>
          <p className="text-muted-foreground text-sm">
            {showArchived
              ? "No archived notifications"
              : filterType === "all"
                ? "You're all caught up!"
                : `No ${filterType} notifications`}
          </p>
        </Card>
      )}
    </div>
  )
}
