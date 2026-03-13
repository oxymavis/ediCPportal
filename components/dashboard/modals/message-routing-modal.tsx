"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"

interface RoutingRule {
  id: string
  messageType: string
  direction: "inbound" | "outbound"
  enabled: boolean
  routingType: "return_to_sender" | "specific_partner"
  targetPartner?: string
}

interface MessageRoutingModalProps {
  partnerId: string
  subsidiaryId: string
  partnerName: string
  partnerCode: string
  onClose: () => void
}

export default function MessageRoutingModal({ partnerId, subsidiaryId, partnerName, partnerCode, onClose }: MessageRoutingModalProps) {
  const [enabledTypes, setEnabledTypes] = useState<string[]>([])
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [newType, setNewType] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiClient.getSubsidiaryRouting(partnerId, subsidiaryId).then((res) => {
      if (res.success && res.data) {
        const data = res.data as { enabledTypes?: string[]; rules?: RoutingRule[] }
        setEnabledTypes(data.enabledTypes || [])
        setRules(data.rules || [])
      }
    })
  }, [partnerId, subsidiaryId])

  const toggleRule = (ruleId: string) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)))
  }

  const addMessageType = () => {
    const code = newType.trim().toUpperCase()
    if (!code) return
    if (enabledTypes.includes(code)) return
    setEnabledTypes((prev) => [...prev, code])
    setRules((prev) => [
      ...prev,
      {
        id: `rule-${Date.now()}`,
        messageType: code,
        direction: "outbound",
        enabled: true,
        routingType: "return_to_sender",
      },
    ])
    setNewType("")
  }

  const save = async () => {
    setSaving(true)
    const res = await apiClient.updateSubsidiaryRouting(partnerId, subsidiaryId, { enabledTypes, rules })
    setSaving(false)
    if (res.success) onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-background">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Message Routing</h2>
              <p className="text-muted-foreground mt-1">{partnerName} ({partnerCode}) - database backed</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl">x</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-3">Enabled message types</p>
            <div className="flex flex-wrap gap-2">
              {enabledTypes.map((t) => (
                <span key={t} className="px-2 py-1 rounded bg-secondary text-sm">{t}</span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Add message type (e.g. 850)" />
              <Button onClick={addMessageType}>Add</Button>
            </div>
          </Card>

          <div className="space-y-2">
            {rules.map((rule) => (
              <Card key={rule.id} className="p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{rule.messageType}</p>
                  <p className="text-xs text-muted-foreground">{rule.direction} | {rule.routingType}</p>
                </div>
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`px-3 py-1 rounded text-xs font-semibold ${rule.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {rule.enabled ? "Enabled" : "Disabled"}
                </button>
              </Card>
            ))}
            {rules.length === 0 && <p className="text-sm text-muted-foreground">No routing rules in database.</p>}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border p-6 bg-card shrink-0">
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>Close</Button>
        </div>
      </Card>
    </div>
  )
}
