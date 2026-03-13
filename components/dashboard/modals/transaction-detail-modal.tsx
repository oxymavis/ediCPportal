"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type TabType = "raw" | "errors" | "logs"
type TxError = {
  code?: string
  severity?: "error" | "warning" | string
  segment?: string
  position?: string
  message?: string
  details?: string
}
type TxLog = { timestamp?: string; level?: string; message?: string }

export default function TransactionDetailModal({
  transaction,
  onClose,
}: {
  transaction: any
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<TabType>("raw")
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportTransaction = () => {
    const isApi = transaction.integrationType === "api"
    const content = typeof transaction.raw === "string" ? transaction.raw : JSON.stringify(transaction.raw, null, 2)
    const ext = isApi ? "json" : "x12"
    const mime = isApi ? "application/json" : "text/plain"
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${transaction.id || "transaction"}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const errors: TxError[] = Array.isArray(transaction.errors) ? transaction.errors : []
  const logs: TxLog[] = Array.isArray(transaction.logs) ? transaction.logs : []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              transaction.status === "completed" ? "bg-green-500" :
              transaction.status === "error" ? "bg-red-500" : "bg-blue-500"
            }`} />
            <div>
              <h2 className="text-xl font-bold text-foreground">{transaction.id}</h2>
              <p className="text-sm text-muted-foreground">
                {transaction.type} - {transaction.partner} - {transaction.direction.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
          >
            X
          </button>
        </div>

        {/* Enhanced Status Bar - Validation / Delivery / Acknowledgment */}
        <div className="px-6 py-3 bg-secondary/20 border-b border-border flex items-center gap-6">
          {/* Validation Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              transaction.status === "completed" ? "bg-green-500" : transaction.status === "error" ? "bg-red-500" : "bg-amber-500"
            }`} />
            <span className="text-xs text-muted-foreground">Validation:</span>
            <span className={`text-xs font-semibold ${
              transaction.status === "completed" ? "text-green-700" : transaction.status === "error" ? "text-red-700" : "text-amber-700"
            }`}>
              {transaction.status === "completed" ? "Valid" : transaction.status === "error" ? "Invalid" : "Pending"}
            </span>
          </div>
          {/* Delivery Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              transaction.status === "completed" ? "bg-green-500" : "bg-amber-500"
            }`} />
            <span className="text-xs text-muted-foreground">Delivery:</span>
            <span className={`text-xs font-semibold ${
              transaction.status === "completed" ? "text-green-700" : "text-amber-700"
            }`}>
              {transaction.status === "completed" ? "Delivered" : "Pending"}
            </span>
          </div>
          {/* Acknowledgment Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              transaction.status === "completed" ? "bg-green-500" : transaction.status === "error" ? "bg-red-500" : "bg-slate-400"
            }`} />
            <span className="text-xs text-muted-foreground">{transaction.integrationType === "api" ? "API Ack:" : "997 Ack:"}</span>
            <span className={`text-xs font-semibold ${
              transaction.status === "completed" ? "text-green-700" : transaction.status === "error" ? "text-red-700" : "text-slate-500"
            }`}>
              {transaction.status === "completed" ? "Accepted" : transaction.status === "error" ? "Rejected" : "Not Acknowledged"}
            </span>
          </div>
          {/* Stream */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stream:</span>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Live</span>
          </div>
          {/* Direction */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Direction:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              transaction.direction === "inbound" ? "bg-cyan-100 text-cyan-700" : "bg-purple-100 text-purple-700"
            }`}>
              {transaction.direction === "inbound" ? "IN" : "OUT"}
            </span>
          </div>
        </div>

        {/* Metadata Bar */}
        <div className="px-6 py-4 bg-secondary/30 border-b border-border grid grid-cols-2 md:grid-cols-7 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Date & Time</p>
            <p className="font-medium text-foreground">
              {transaction.date} {transaction.time}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Size</p>
            <p className="font-medium text-foreground">{transaction.size}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Records</p>
            <p className="font-medium text-foreground">{transaction.records}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Interchange Ref</p>
            <p className="font-mono text-xs font-medium text-foreground">{transaction.id.replace("TXN-", "ICN-")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Group Ref</p>
            <p className="font-mono text-xs font-medium text-foreground">GS-{transaction.id.split("-")[1]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Transaction Ref</p>
            <p className="font-mono text-xs font-medium text-foreground">ST-{transaction.id.split("-")[1]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Errors</p>
            <p className={`font-medium ${errors.length > 0 ? "text-red-600" : "text-green-600"}`}>
              {errors.filter(e => e.severity === "error").length} error(s), {errors.filter(e => e.severity === "warning").length} warning(s)
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border px-6 bg-card">
          {(["raw", "errors", "logs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tab === "raw" ? "Raw X12" : tab === "errors" ? `Errors (${errors.length})` : "Logs"}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {/* Raw X12 Tab */}
          {activeTab === "raw" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">
                  {transaction.integrationType === "api" ? "Raw API Payload" : "Raw EDI X12 Format"}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => copyToClipboard(transaction.raw)}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <pre className="p-4 bg-secondary/50 rounded-lg overflow-auto max-h-96 text-xs font-mono text-foreground border border-border whitespace-pre-wrap">
                {transaction.raw}
              </pre>
            </div>
          )}

          {/* Errors Tab */}
          {activeTab === "errors" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Validation Errors & Warnings</h3>
                {errors.length > 0 && (
                  <div className="flex gap-4 text-sm">
                    <span className="text-red-600 font-medium">
                      {errors.filter(e => e.severity === "error").length} Error(s)
                    </span>
                    <span className="text-amber-600 font-medium">
                      {errors.filter(e => e.severity === "warning").length} Warning(s)
                    </span>
                  </div>
                )}
              </div>
              
              {errors.length > 0 ? (
                <div className="space-y-3">
                  {errors.map((error, idx) => (
                    <Card 
                      key={idx} 
                      className={`p-4 border-l-4 ${
                        error.severity === "error" 
                          ? "border-l-red-500 bg-red-50/50" 
                          : "border-l-amber-500 bg-amber-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            error.severity === "error" 
                              ? "bg-red-100 text-red-700" 
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {String(error.severity ?? "warning").toUpperCase()}
                          </span>
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {error.code}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          Segment: {error.segment} | Position: {error.position}
                        </span>
                      </div>
                      <p className="font-medium text-foreground mb-2">{error.message}</p>
                      <p className="text-sm text-muted-foreground">{error.details}</p>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-green-50/50 rounded-lg border border-green-200">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-green-600 text-xl font-bold">OK</span>
                  </div>
                  <p className="font-semibold text-green-700">No Errors Found</p>
                  <p className="text-sm text-green-600 mt-1">
                    This transaction passed all validation checks successfully.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === "logs" && (
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground mb-4">Processing Logs</h3>
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg text-xs font-mono ${
                    log.level === "error"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : log.level === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : log.level === "warning"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-secondary/50 text-foreground border border-border"
                  }`}
                >
                  <div className="flex gap-2">
                    <span className="text-muted-foreground min-w-fit">[{log.timestamp}]</span>
                    <span className="font-semibold uppercase">[{log.level}]</span>
                    <span>{log.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border p-6 bg-card">
          <Button className="flex-1 gap-2 bg-primary hover:bg-primary/90" onClick={exportTransaction}>
            Export Transaction
          </Button>
          <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  )
}
