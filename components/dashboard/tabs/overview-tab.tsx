"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import IntegrationLifecyclePipeline, { buildIntegrationSteps, getProgressFromStep, getStepLabel } from "../integration-lifecycle"
import { apiClient } from "@/lib/api-client"

interface OverviewTabProps {
  onNavigate?: (tab: string) => void
}

interface PartnerRow {
  id: string
  name: string
  code: string
  integrationType: "api" | "edi"
  communicationChannel?: string
  lifecycle?: {
    currentStepId?: number
    stepCompletionDates?: Record<number, string> | Record<string, string>
  }
}

interface TransactionRow {
  id: string
  docType: string
  partner: string
  status: string
  direction: "inbound" | "outbound"
  date: string
  time: string
  integrationType?: "api" | "edi"
}

interface NotificationRow {
  id: number
  title: string
  message: string
  read: boolean
  environment: string
  date: string
  time: string
}

export default function OverviewTab({ onNavigate }: OverviewTabProps) {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [showPanels, setShowPanels] = useState(true)

  useEffect(() => {
    Promise.all([apiClient.getPartners(), apiClient.getTransactions(), apiClient.getNotifications()]).then(([p, t, n]) => {
      if (p.success && Array.isArray(p.data)) setPartners(p.data as PartnerRow[])
      if (t.success && Array.isArray(t.data)) setTransactions(t.data as TransactionRow[])
      if (n.success && Array.isArray(n.data)) setNotifications(n.data as NotificationRow[])
    })
  }, [])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const totalPartners = partners.length
    const ediPartners = partners.filter((p) => p.integrationType === "edi").length
    const apiPartners = partners.filter((p) => p.integrationType === "api").length
    const todayTransactions = transactions.filter((t) => t.date === today).length
    const pendingActions = notifications.filter((n) => !n.read).length

    return [
      { title: "Trading Partners", value: String(totalPartners), link: "partners" },
      { title: "EDI Partners", value: String(ediPartners), link: "partners" },
      { title: "API Partners", value: String(apiPartners), link: "partners" },
      { title: "Today's Transactions", value: String(todayTransactions), link: "transactions" },
      { title: "Pending Actions", value: String(pendingActions), link: "notifications" },
    ]
  }, [partners, transactions, notifications])

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
      .slice(0, 8)
  }, [transactions])

  const partnerStatus = useMemo(() => {
    return partners.slice(0, 8).map((p) => {
      const lifecycle = p.lifecycle || {}
      const currentStepId = lifecycle.currentStepId ?? 1
      const dates = (lifecycle.stepCompletionDates || {}) as Record<number, string>
      const liveTxn = transactions.filter((t) => t.partner === p.name).length
      return {
        partner: p.name,
        code: p.code,
        integrationType: p.integrationType,
        channel: p.communicationChannel || (p.integrationType === "api" ? "REST_API" : "AS2"),
        currentStepId,
        completionDates: dates,
        liveTxn,
      }
    })
  }, [partners, transactions])

  const channelHealth = useMemo(() => {
    return partnerStatus.map((p) => ({
      name: p.partner,
      protocol: p.channel,
      status: p.currentStepId >= 5 ? "active" : "testing",
      messages: transactions.filter((t) => t.partner === p.partner).length,
    }))
  }, [partnerStatus, transactions])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Dashboard</h2>
          <p className="text-muted-foreground text-sm">All metrics are computed from /v1 partners, transactions and notifications</p>
        </div>
        <button onClick={() => setShowPanels((s) => !s)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          {showPanels ? "Hide Panels" : "Show Panels"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all" onClick={() => onNavigate?.(stat.link)}>
            <p className="text-xs font-medium text-muted-foreground mb-1">{stat.title}</p>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>

      {showPanels && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">Communication Channels</h3>
                <p className="text-sm text-muted-foreground">Computed by partner lifecycle and transaction volume</p>
              </div>
              <Button variant="outline" size="sm" className="bg-transparent" onClick={() => onNavigate?.("partners")}>View Partners</Button>
            </div>
            <div className="space-y-3">
              {channelHealth.map((ch) => (
                <div key={`${ch.name}-${ch.protocol}`} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${ch.status === "active" ? "bg-green-500" : "bg-amber-500"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{ch.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{ch.protocol}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{ch.messages}</p>
                    <p className="text-xs text-muted-foreground">messages</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">Recent Transactions</h3>
                <p className="text-sm text-muted-foreground">Latest records from database</p>
              </div>
              <Button variant="outline" size="sm" className="bg-transparent" onClick={() => onNavigate?.("transactions")}>View All</Button>
            </div>
            <div className="space-y-3">
              {recentTransactions.map((trx) => (
                <div key={trx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{trx.id}</p>
                    <p className="text-xs text-muted-foreground">{trx.partner} | {trx.docType} | {trx.date} {trx.time}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${trx.status === "completed" ? "bg-green-100 text-green-700" : trx.status === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {trx.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Partner Integration Lifecycle</h3>
            <p className="text-sm text-muted-foreground">5-step pipeline from partner records</p>
          </div>
          <Button variant="outline" size="sm" className="bg-transparent" onClick={() => onNavigate?.("partners")}>Manage Partners</Button>
        </div>
        <div className="space-y-3">
          {partnerStatus.map((p) => (
            <div key={p.code} className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{p.code.slice(0, 2)}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{p.partner}</span>
                    <span className="text-xs font-mono text-muted-foreground">({p.code})</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.integrationType === "api" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
                      {p.integrationType.toUpperCase()} / {p.channel}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.currentStepId >= 5 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {p.currentStepId >= 5 ? "Live" : getStepLabel(p.currentStepId)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <IntegrationLifecyclePipeline
                      steps={buildIntegrationSteps(p.currentStepId, p.completionDates, p.integrationType)}
                      currentStepId={p.currentStepId}
                      progress={getProgressFromStep(p.currentStepId)}
                      variant="compact"
                    />
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-foreground">{p.liveTxn.toLocaleString()} txn</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
