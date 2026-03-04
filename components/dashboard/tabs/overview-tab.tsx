"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Area, AreaChart
} from "recharts"
import IntegrationLifecyclePipeline, { buildIntegrationSteps, getProgressFromStep, getStepLabel } from "../integration-lifecycle"

interface OverviewTabProps {
  onNavigate?: (tab: string) => void
}

const monthlyVolume = [
  { month: "Aug", inbound: 1820, outbound: 1560 },
  { month: "Sep", inbound: 2100, outbound: 1780 },
  { month: "Oct", inbound: 1950, outbound: 1920 },
  { month: "Nov", inbound: 2400, outbound: 2100 },
  { month: "Dec", inbound: 2850, outbound: 2650 },
  { month: "Jan", inbound: 2200, outbound: 2050 },
]

const ackStatusData = [
  { name: "Accepted", value: 892, color: "#22c55e" },
  { name: "Rejected", value: 23, color: "#ef4444" },
  { name: "Overdue", value: 15, color: "#f59e0b" },
  { name: "Pending", value: 67, color: "#94a3b8" },
]

const typeDistribution = [
  { type: "850", name: "Purchase Order", count: 320 },
  { type: "856", name: "ASN", count: 285 },
  { type: "810", name: "Invoice", count: 270 },
  { type: "855", name: "PO Ack", count: 210 },
  { type: "940", name: "WH Ship Order", count: 145 },
  { type: "997", name: "Func Ack", count: 380 },
  { type: "945", name: "WH Ship Advice", count: 120 },
  { type: "214", name: "Shipment Status", count: 95 },
]

const deliveryTrend = [
  { day: "Mon", delivered: 182, failed: 3 },
  { day: "Tue", delivered: 195, failed: 5 },
  { day: "Wed", delivered: 210, failed: 2 },
  { day: "Thu", delivered: 178, failed: 4 },
  { day: "Fri", delivered: 220, failed: 1 },
  { day: "Sat", delivered: 85, failed: 0 },
  { day: "Sun", delivered: 62, failed: 1 },
]

export default function OverviewTab({ onNavigate }: OverviewTabProps) {
  const [showDashboard, setShowDashboard] = useState(true)

  const stats = [
    { title: "Trading Partners", value: "6", change: "+1", link: "partners" },
    { title: "EDI Partners", value: "4", change: "0", link: "partners" },
    { title: "API Partners", value: "2", change: "+1", link: "partners" },
    { title: "Today's Transactions", value: "342", change: "+18%", link: "transactions" },
    { title: "Active Certificates", value: "12", change: "+2", link: "certificates" },
    { title: "Pending Actions", value: "3", change: "-2", link: "notifications" },
  ]

  const partnerStatus: Array<{
    partner: string
    code: string
    integrationType: "api" | "edi"
    channel: string
    currentStepId: number
    liveTxn: number
    duration: string
    completionDates: Record<number, string>
  }> = [
    { partner: "Walmart", code: "WMT", integrationType: "edi", channel: "AS2", currentStepId: 6, liveTxn: 45230, duration: "12 months", completionDates: { 1: "Jan 2023", 2: "Feb 2023", 3: "Mar 2023", 4: "Apr 2023", 5: "May 2023" } },
    { partner: "Target Corporation", code: "TGT", integrationType: "edi", channel: "AS2", currentStepId: 6, liveTxn: 28500, duration: "8 months", completionDates: { 1: "May 2023", 2: "Jun 2023", 3: "Jul 2023", 4: "Aug 2023", 5: "Sep 2023" } },
    { partner: "Amazon", code: "AMZN", integrationType: "api", channel: "REST API", currentStepId: 4, liveTxn: 0, duration: "5 months", completionDates: { 1: "Aug 2024", 2: "Sep 2024", 3: "Oct 2024" } },
    { partner: "SPS Commerce", code: "SPS", integrationType: "edi", channel: "VAN", currentStepId: 6, liveTxn: 15420, duration: "10 months", completionDates: { 1: "Mar 2023", 2: "Apr 2023", 3: "May 2023", 4: "Jun 2023", 5: "Jul 2023" } },
    { partner: "Acme Logistics", code: "ACME", integrationType: "edi", channel: "AS2", currentStepId: 3, liveTxn: 0, duration: "3 months", completionDates: { 1: "Oct 2024", 2: "Nov 2024" } },
    { partner: "Costco Wholesale", code: "COST", integrationType: "api", channel: "REST API", currentStepId: 2, liveTxn: 0, duration: "1 month", completionDates: { 1: "Dec 2025" } },
  ]

  const recentActivity = [
    { partner: "Walmart", code: "WMT", action: "856 ASN sent to Walmart US", time: "10 min ago", status: "success", type: "856", direction: "OUT" as const },
    { partner: "Target", code: "TGT", action: "850 PO received from Target Stores", time: "25 min ago", status: "success", type: "850", direction: "IN" as const },
    { partner: "Amazon", code: "AMZN", action: "API: 810 Invoice POST accepted", time: "1 hr ago", status: "success", type: "810", direction: "OUT" as const },
    { partner: "SPS Commerce", code: "SPS", action: "997 FA - Transaction rejected (invalid segment)", time: "2 hr ago", status: "error", type: "997", direction: "IN" as const },
    { partner: "Costco", code: "COST", action: "API: Webhook test ping sent", time: "3 hr ago", status: "success", type: "PING", direction: "OUT" as const },
    { partner: "Walmart", code: "WMT", action: "940 Warehouse Shipping Order to Acme", time: "4 hr ago", status: "success", type: "940", direction: "OUT" as const },
  ]

  const totalAck = ackStatusData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Dashboard</h2>
          <p className="text-muted-foreground text-sm">Real-time EDI & API transaction monitoring and partner status</p>
        </div>
        <button onClick={() => setShowDashboard(!showDashboard)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          {showDashboard ? "Hide Charts" : "Show Charts"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
            onClick={() => onNavigate?.(stat.link)}
          >
            <p className="text-xs font-medium text-muted-foreground mb-1">{stat.title}</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                stat.change.startsWith("+") && stat.change !== "+0"
                  ? "bg-green-50 text-green-700"
                  : stat.change.startsWith("-")
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-50 text-slate-500"
              }`}>
                {stat.change}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {showDashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="col-span-2 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">Transaction Volume</h3>
                  <p className="text-sm text-muted-foreground">Monthly inbound vs outbound (last 6 months)</p>
                </div>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyVolume} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="inbound" name="Inbound" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outbound" name="Outbound" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground">Acknowledgment Status</h3>
                <p className="text-sm text-muted-foreground">997 FA confirmation metrics</p>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ackStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                      {ackStatusData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} (${((value / totalAck) * 100).toFixed(1)}%)`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ackStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-semibold text-foreground ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground">Delivery Status (Last 7 Days)</h3>
                <p className="text-sm text-muted-foreground">Delivered vs failed transmissions</p>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={deliveryTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground">Transaction Type Distribution</h3>
                <p className="text-sm text-muted-foreground">Documents processed this month</p>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="type" type="category" tick={{ fontSize: 12 }} width={35} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return <div className="bg-background border rounded-lg p-2 shadow-lg text-sm"><p className="font-semibold">{data.type} - {data.name}</p><p className="text-muted-foreground">{data.count} transactions</p></div>
                      }
                      return null
                    }} />
                    <Bar dataKey="count" name="Count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Partner Integration Lifecycle (5-step) */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Partner Integration Lifecycle</h3>
            <p className="text-sm text-muted-foreground">5-step pipeline: Partner Setup to Go Live</p>
          </div>
          <Button variant="outline" size="sm" className="bg-transparent" onClick={() => onNavigate?.("partners")}>Manage Partners</Button>
        </div>
        <div className="space-y-3">
          {partnerStatus.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{p.code.slice(0, 2)}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{p.partner}</span>
                    <span className="text-xs font-mono text-muted-foreground">({p.code})</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      p.integrationType === "api" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                    }`}>
                      {p.integrationType === "api" ? "API" : "EDI"} / {p.channel}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${
                      p.currentStepId >= 6 ? "bg-green-100 text-green-700" :
                      p.currentStepId >= 3 ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {p.currentStepId >= 6 ? "Live" : getStepLabel(p.currentStepId)}
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
                <p className="text-sm font-medium text-foreground">{p.liveTxn > 0 ? `${p.liveTxn.toLocaleString()} txn` : "--"}</p>
                <p className="text-xs text-muted-foreground">{p.duration}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Connection Testing Quick View + Channel Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Communication Channels</h3>
              <p className="text-sm text-muted-foreground">Active connection health</p>
            </div>
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => onNavigate?.("partners")}>View Partners</Button>
          </div>
          <div className="space-y-3">
            {[
              { name: "Walmart", protocol: "AS2", status: "active", messages: 342 },
              { name: "Target", protocol: "AS2", status: "active", messages: 218 },
              { name: "Amazon", protocol: "REST API", status: "testing", messages: 12 },
              { name: "SPS Commerce", protocol: "VAN", status: "active", messages: 89 },
              { name: "Acme Logistics", protocol: "AS2", status: "testing", messages: 5 },
            ].map((ch, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${ch.status === "active" ? "bg-green-500" : "bg-amber-500"}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{ch.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      ch.protocol === "AS2" ? "bg-sky-100 text-sky-700" :
                      ch.protocol === "REST API" ? "bg-violet-100 text-violet-700" : "bg-green-100 text-green-700"
                    }`}>{ch.protocol}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{ch.messages}</p>
                  <p className="text-xs text-muted-foreground">msg/24h</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Connection Testing</h3>
              <p className="text-sm text-muted-foreground">Partner testing progress</p>
            </div>
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => onNavigate?.("connection-testing")}>View All</Button>
          </div>
          <div className="space-y-3">
            {[
              { name: "Acme Logistics (AS2)", progress: 40, status: "in-progress", step: "Connection Testing" },
              { name: "Amazon (API)", progress: 60, status: "in-progress", step: "Integration Validation" },
              { name: "Costco (API)", progress: 20, status: "in-progress", step: "Communication Setup" },
              { name: "Walmart (AS2)", progress: 100, status: "passed", step: "Live" },
            ].map((sc, idx) => (
              <div key={idx} className="py-2 border-b border-border last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{sc.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      sc.status === "passed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {sc.step}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-foreground">{sc.progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${sc.status === "passed" ? "bg-green-500" : "bg-primary"}`} style={{ width: `${sc.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Recent Activity</h3>
            <p className="text-sm text-muted-foreground">Latest events across all partners (EDI + API)</p>
          </div>
          <Button variant="outline" size="sm" className="bg-transparent" onClick={() => onNavigate?.("transactions")}>View All</Button>
        </div>
        <div className="space-y-3">
          {recentActivity.map((activity, idx) => (
            <div key={idx} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{activity.code.slice(0, 2)}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{activity.partner}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activity.direction === "IN" ? "bg-cyan-100 text-cyan-700" : "bg-purple-100 text-purple-700"}`}>{activity.direction}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-secondary text-foreground">{activity.type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.action}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <p className="text-sm text-muted-foreground">{activity.time}</p>
                <div className={`w-2.5 h-2.5 rounded-full ${activity.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
