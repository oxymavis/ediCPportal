"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RoutingRule {
  id: string
  messageType: string
  messageTypeName: string
  direction: "inbound" | "outbound"
  enabled: boolean
  sourcePartner?: string
  targetPartner?: string
  targetSubsidiary?: string
  routingType: "return_to_sender" | "specific_partner" | "broadcast"
  description?: string
}

interface MessageRoutingModalProps {
  partnerName: string
  partnerCode: string
  onClose: () => void
  onSave?: (rules: RoutingRule[]) => void
}

const availableMessageTypes = [
  { code: "204", name: "Motor Carrier Load Tender", direction: "outbound" as const },
  { code: "210", name: "Freight Invoice", direction: "inbound" as const },
  { code: "214", name: "Shipment Status", direction: "inbound" as const },
  { code: "810", name: "Invoice", direction: "outbound" as const },
  { code: "832", name: "Price/Sales Catalog", direction: "outbound" as const },
  { code: "846", name: "Inventory Inquiry/Advice", direction: "outbound" as const },
  { code: "850", name: "Purchase Order", direction: "inbound" as const },
  { code: "855", name: "Purchase Order Ack", direction: "outbound" as const },
  { code: "856", name: "Advance Ship Notice", direction: "outbound" as const },
  { code: "940", name: "Warehouse Shipping Order", direction: "inbound" as const },
  { code: "943", name: "Warehouse Stock Transfer", direction: "outbound" as const },
  { code: "944", name: "Warehouse Stock Receipt", direction: "inbound" as const },
  { code: "945", name: "Warehouse Shipping Advice", direction: "outbound" as const },
  { code: "947", name: "Warehouse Inventory Adj", direction: "outbound" as const },
  { code: "997", name: "Functional Ack", direction: "both" as const },
]

const availableTargetPartners = [
  { id: "wmt", name: "Walmart", code: "WMT", subsidiaries: ["Walmart US", "Walmart Canada", "Sam's Club"] },
  { id: "tgt", name: "Target Corporation", code: "TGT", subsidiaries: ["Target Stores", "Target.com"] },
  { id: "amzn", name: "Amazon", code: "AMZN", subsidiaries: ["Amazon Vendor Central", "Amazon Seller Central", "Amazon EU"] },
  { id: "cos", name: "Costco", code: "COS", subsidiaries: [] },
  { id: "hd", name: "Home Depot", code: "HD", subsidiaries: [] },
  { id: "return", name: "Return to Inbound TP", code: "RETURN", subsidiaries: [] },
]

export default function MessageRoutingModal({ partnerName, partnerCode, onClose, onSave }: MessageRoutingModalProps) {
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([
    {
      id: "rule-1",
      messageType: "850",
      messageTypeName: "Purchase Order",
      direction: "inbound",
      enabled: true,
      routingType: "return_to_sender",
      description: "Receive POs from trading partner"
    },
    {
      id: "rule-2",
      messageType: "856",
      messageTypeName: "Advance Ship Notice",
      direction: "outbound",
      enabled: true,
      targetPartner: "Walmart",
      targetSubsidiary: "Walmart US",
      routingType: "specific_partner",
      description: "Send ASN to Walmart US"
    },
    {
      id: "rule-3",
      messageType: "810",
      messageTypeName: "Invoice",
      direction: "outbound",
      enabled: true,
      routingType: "return_to_sender",
      description: "Return invoice to original PO sender"
    },
    {
      id: "rule-4",
      messageType: "997",
      messageTypeName: "Functional Ack",
      direction: "outbound",
      enabled: true,
      routingType: "return_to_sender",
      description: "Send FA back to message sender"
    },
  ])

  const [showAddRule, setShowAddRule] = useState(false)
  const [newRule, setNewRule] = useState<Partial<RoutingRule>>({
    direction: "outbound",
    routingType: "return_to_sender",
    enabled: true
  })

  const [selectedTargetPartner, setSelectedTargetPartner] = useState<string>("")

  const handleToggleRule = (ruleId: string) => {
    setRoutingRules(rules => 
      rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r)
    )
  }

  const handleAddRule = () => {
    if (!newRule.messageType) return

    const msgType = availableMessageTypes.find(m => m.code === newRule.messageType)
    const targetPartner = availableTargetPartners.find(p => p.id === selectedTargetPartner)

    const rule: RoutingRule = {
      id: `rule-${Date.now()}`,
      messageType: newRule.messageType,
      messageTypeName: msgType?.name || newRule.messageType,
      direction: newRule.direction as "inbound" | "outbound",
      enabled: true,
      routingType: newRule.routingType as RoutingRule["routingType"],
      targetPartner: targetPartner?.name,
      targetSubsidiary: newRule.targetSubsidiary,
      description: newRule.description
    }

    setRoutingRules([...routingRules, rule])
    setShowAddRule(false)
    setNewRule({ direction: "outbound", routingType: "return_to_sender", enabled: true })
    setSelectedTargetPartner("")
  }

  const handleSave = () => {
    onSave?.(routingRules)
    onClose()
  }

  const selectedPartnerData = availableTargetPartners.find(p => p.id === selectedTargetPartner)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-background">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Message Type Configuration</h2>
              <p className="text-muted-foreground mt-1">
                Configure message types and routing for <span className="font-semibold text-primary">{partnerName}</span> ({partnerCode})
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl">
              x
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">Message Routing Configuration</p>
            <p>
              Configure which message types this TPA can send/receive, and specify where outbound messages (like 856 ASN) 
              should be routed. Messages can be sent back to the original inbound partner or to a specific trading partner like Walmart or Target.
            </p>
          </div>

          {/* Current Routing Rules */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Configured Message Types</h3>
              <Button 
                size="sm" 
                onClick={() => setShowAddRule(true)}
                className="bg-primary hover:bg-primary/90"
              >
                + Add Message Type
              </Button>
            </div>

            <div className="space-y-3">
              {routingRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No message types configured. Click "Add Message Type" to start.
                </div>
              ) : (
                routingRules.map((rule) => (
                  <Card key={rule.id} className={`p-4 border ${rule.enabled ? "border-border" : "border-border/50 opacity-60"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${
                            rule.enabled ? "bg-green-500" : "bg-gray-300"
                          }`}
                        >
                          <span 
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              rule.enabled ? "left-7" : "left-1"
                            }`}
                          />
                        </button>

                        {/* Message Type Info */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">{rule.messageType}</span>
                            <span className="text-foreground font-medium">{rule.messageTypeName}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              rule.direction === "inbound" 
                                ? "bg-cyan-100 text-cyan-700" 
                                : "bg-purple-100 text-purple-700"
                            }`}>
                              {rule.direction}
                            </span>
                          </div>
                          {rule.description && (
                            <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Routing Info & Actions */}
                      <div className="flex items-center gap-4">
                        {rule.direction === "outbound" && (
                          <div className="text-sm text-right">
                            <p className="text-muted-foreground">Route to:</p>
                            <p className="font-medium text-foreground">
                              {rule.routingType === "return_to_sender" 
                                ? "Return to Inbound TP" 
                                : rule.targetPartner}
                              {rule.targetSubsidiary && (
                                <span className="text-muted-foreground"> / {rule.targetSubsidiary}</span>
                              )}
                            </p>
                          </div>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-transparent text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => setRoutingRules(rules => 
                            rules.map(r => r.id === rule.id ? { ...r, enabled: false } : r)
                          )}
                        >
                          Inactive
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Add New Rule Form */}
          {showAddRule && (
            <Card className="p-6 border-2 border-primary/30 bg-primary/5">
              <h4 className="font-semibold text-foreground mb-4">Add New Message Type</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Message Type */}
                  <div className="space-y-2">
                    <Label>Message Type</Label>
                    <select
                      value={newRule.messageType || ""}
                      onChange={(e) => {
                        const msgType = availableMessageTypes.find(m => m.code === e.target.value)
                        setNewRule({ 
                          ...newRule, 
                          messageType: e.target.value,
                          direction: msgType?.direction === "both" ? "outbound" : msgType?.direction || "outbound"
                        })
                      }}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">Select message type...</option>
                      {availableMessageTypes.map(msg => (
                        <option key={msg.code} value={msg.code}>
                          {msg.code} - {msg.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Direction */}
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <select
                      value={newRule.direction || "outbound"}
                      onChange={(e) => setNewRule({ ...newRule, direction: e.target.value as "inbound" | "outbound" })}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="inbound">Inbound (Receive)</option>
                      <option value="outbound">Outbound (Send)</option>
                    </select>
                  </div>
                </div>

                {/* Routing Type (for outbound only) */}
                {newRule.direction === "outbound" && (
                  <div className="space-y-4 p-4 bg-background rounded-lg border border-border">
                    <div className="space-y-2">
                      <Label>Routing Destination</Label>
                      <select
                        value={newRule.routingType || "return_to_sender"}
                        onChange={(e) => {
                          setNewRule({ ...newRule, routingType: e.target.value as RoutingRule["routingType"] })
                          if (e.target.value === "return_to_sender") {
                            setSelectedTargetPartner("")
                          }
                        }}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="return_to_sender">Return to Inbound Trading Partner</option>
                        <option value="specific_partner">Send to Specific Trading Partner</option>
                      </select>
                    </div>

                    {newRule.routingType === "specific_partner" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Target Trading Partner</Label>
                          <select
                            value={selectedTargetPartner}
                            onChange={(e) => {
                              setSelectedTargetPartner(e.target.value)
                              setNewRule({ ...newRule, targetSubsidiary: "" })
                            }}
                            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                          >
                            <option value="">Select partner...</option>
                            {availableTargetPartners.filter(p => p.code !== "RETURN").map(partner => (
                              <option key={partner.id} value={partner.id}>
                                {partner.name} ({partner.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedPartnerData && selectedPartnerData.subsidiaries.length > 0 && (
                          <div className="space-y-2">
                            <Label>Target Subsidiary</Label>
                            <select
                              value={newRule.targetSubsidiary || ""}
                              onChange={(e) => setNewRule({ ...newRule, targetSubsidiary: e.target.value })}
                              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                            >
                              <option value="">Select subsidiary...</option>
                              {selectedPartnerData.subsidiaries.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Input
                    placeholder="e.g., Send ASN to Walmart for all fulfilled orders"
                    value={newRule.description || ""}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleAddRule} className="bg-primary hover:bg-primary/90">
                    Add Message Type
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddRule(false)
                      setNewRule({ direction: "outbound", routingType: "return_to_sender", enabled: true })
                      setSelectedTargetPartner("")
                    }}
                    className="bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Summary */}
          <Card className="p-4 bg-secondary/30">
            <h4 className="font-semibold text-foreground mb-3">Configuration Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Message Types</p>
                <p className="text-2xl font-bold text-foreground">{routingRules.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Inbound</p>
                <p className="text-2xl font-bold text-cyan-600">
                  {routingRules.filter(r => r.direction === "inbound" && r.enabled).length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Outbound</p>
                <p className="text-2xl font-bold text-purple-600">
                  {routingRules.filter(r => r.direction === "outbound" && r.enabled).length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="bg-transparent">
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
            Save Configuration
          </Button>
        </div>
      </Card>
    </div>
  )
}
