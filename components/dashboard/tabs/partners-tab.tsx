"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import PartnerDetailModal from "../modals/partner-detail-modal"
import AddPartnerModal from "../modals/add-partner-modal"
import IntegrationLifecyclePipeline, { buildIntegrationSteps, getProgressFromStep, getStepLabel } from "../integration-lifecycle"

interface AS2Profile {
  id: string
  name: string
  as2Id: string
  url: string
  encryptionCert?: string
  signingCert?: string
  status: "active" | "inactive"
}

interface Subsidiary {
  id: string
  name: string
  code: string
  region: string
  as2Profiles: AS2Profile[]
  documentTypes: string[]
  status: "active" | "inactive"
}

interface CommunicationChannel {
  type: "AS2" | "SFTP" | "VAN" | "REST_API"
  status: "configured" | "testing" | "active"
  config: Record<string, string>
}

interface TradingPartner {
  id: string
  name: string
  code: string
  type: "platform" | "retailer" | "van" | "3pl" | "manufacturer"
  tier: "enterprise" | "standard" | "basic"
  email: string
  status: "active" | "inactive"
  integrationType: "api" | "edi"
  communicationChannel?: CommunicationChannel
  currentStepId: number // 1-5 (or 6 = fully live)
  onboardingStartDate: string
  stepCompletionDates?: Record<number, string>
  subsidiaries: Subsidiary[]
  as2Profiles: AS2Profile[]
  documentTypes: string[]
  lastSync: string
  transactionCount: number
}

export default function PartnersTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [partners, setPartners] = useState<TradingPartner[]>([
    {
      id: "tp-001",
      name: "SPS Commerce",
      code: "SPS",
      type: "van",
      tier: "enterprise",
      email: "support@spscommerce.com",
      status: "active",
      integrationType: "edi",
      communicationChannel: { type: "VAN", status: "active", config: { vanProvider: "SPS Commerce", networkId: "SPS-NET-001" } },
      currentStepId: 6,
      onboardingStartDate: "2023-03-15",
      stepCompletionDates: { 1: "Mar 2023", 2: "Apr 2023", 3: "May 2023", 4: "Jun 2023", 5: "Jul 2023" },
      subsidiaries: [
        { id: "sub-001", name: "SPS Commerce - Retail", code: "SPS-RTL", region: "North America", status: "active", documentTypes: ["850", "855", "856", "810"],
          as2Profiles: [{ id: "as2-001", name: "SPS Retail Primary", as2Id: "SPS-RETAIL-PROD", url: "https://as2.spscommerce.com/retail", encryptionCert: "sps-retail-enc.cer", signingCert: "sps-retail-sign.cer", status: "active" }]
        },
        { id: "sub-002", name: "SPS Commerce - Grocery", code: "SPS-GRO", region: "North America", status: "active", documentTypes: ["850", "855", "856", "810", "832"],
          as2Profiles: [{ id: "as2-003", name: "SPS Grocery", as2Id: "SPS-GROCERY-PROD", url: "https://as2.spscommerce.com/grocery", encryptionCert: "sps-grocery-enc.cer", signingCert: "sps-grocery-sign.cer", status: "active" }]
        },
      ],
      as2Profiles: [],
      documentTypes: [],
      lastSync: "2024-01-15 14:30:22",
      transactionCount: 15420
    },
    {
      id: "tp-002",
      name: "Walmart",
      code: "WMT",
      type: "retailer",
      tier: "enterprise",
      email: "edi@walmart.com",
      status: "active",
      integrationType: "edi",
      communicationChannel: { type: "AS2", status: "active", config: { as2Id: "WALMART-US-PROD", endpoint: "https://as2.wal-mart.com", encryption: "AES-256", mdn: "Synchronous" } },
      currentStepId: 6,
      onboardingStartDate: "2023-01-10",
      stepCompletionDates: { 1: "Jan 2023", 2: "Feb 2023", 3: "Mar 2023", 4: "Apr 2023", 5: "May 2023" },
      subsidiaries: [
        { id: "sub-004", name: "Walmart US", code: "WMT-US", region: "United States", status: "active", documentTypes: ["850", "855", "856", "810", "940", "945"],
          as2Profiles: [{ id: "as2-005", name: "Walmart US Primary", as2Id: "WALMART-US-PROD", url: "https://as2.wal-mart.com/us", encryptionCert: "wmt-us-enc.cer", signingCert: "wmt-us-sign.cer", status: "active" }]
        },
        { id: "sub-005", name: "Walmart Canada", code: "WMT-CA", region: "Canada", status: "active", documentTypes: ["850", "855", "856", "810"],
          as2Profiles: [{ id: "as2-007", name: "Walmart Canada", as2Id: "WALMART-CA-PROD", url: "https://as2.walmart.ca", encryptionCert: "wmt-ca-enc.cer", signingCert: "wmt-ca-sign.cer", status: "active" }]
        },
        { id: "sub-007", name: "Sam's Club", code: "SAMS", region: "United States", status: "active", documentTypes: ["850", "855", "856", "810"],
          as2Profiles: [{ id: "as2-009", name: "Sam's Club", as2Id: "SAMS-CLUB-PROD", url: "https://as2.samsclub.com", encryptionCert: "sams-enc.cer", signingCert: "sams-sign.cer", status: "active" }]
        }
      ],
      as2Profiles: [],
      documentTypes: [],
      lastSync: "2024-01-15 16:45:00",
      transactionCount: 45230
    },
    {
      id: "tp-003",
      name: "Target Corporation",
      code: "TGT",
      type: "retailer",
      tier: "enterprise",
      email: "edi@target.com",
      status: "active",
      integrationType: "edi",
      communicationChannel: { type: "AS2", status: "active", config: { as2Id: "TARGET-STORES-PROD", endpoint: "https://as2.target.com", encryption: "3DES", mdn: "Asynchronous" } },
      currentStepId: 6,
      onboardingStartDate: "2023-05-20",
      stepCompletionDates: { 1: "May 2023", 2: "Jun 2023", 3: "Jul 2023", 4: "Aug 2023", 5: "Sep 2023" },
      subsidiaries: [
        { id: "sub-008", name: "Target Stores", code: "TGT-STR", region: "United States", status: "active", documentTypes: ["850", "855", "856", "810", "846"],
          as2Profiles: [{ id: "as2-010", name: "Target Stores AS2", as2Id: "TARGET-STORES-PROD", url: "https://as2.target.com/stores", encryptionCert: "tgt-str-enc.cer", signingCert: "tgt-str-sign.cer", status: "active" }]
        },
      ],
      as2Profiles: [],
      documentTypes: [],
      lastSync: "2024-01-15 12:00:00",
      transactionCount: 28500
    },
    {
      id: "tp-004",
      name: "Amazon",
      code: "AMZN",
      type: "platform",
      tier: "enterprise",
      email: "vendor-support@amazon.com",
      status: "active",
      integrationType: "api",
      communicationChannel: { type: "REST_API", status: "testing", config: { baseUrl: "https://api.unis-edi.com/v1", tokenId: "tok_amzn_****3f7a", webhook: "https://vendor.amazon.com/webhooks/edi" } },
      currentStepId: 4,
      onboardingStartDate: "2024-08-01",
      stepCompletionDates: { 1: "Aug 2024", 2: "Sep 2024", 3: "Oct 2024" },
      subsidiaries: [
        { id: "sub-010", name: "Amazon Vendor Central", code: "AMZN-VC", region: "North America", status: "active", documentTypes: ["850", "855", "856", "810"],
          as2Profiles: []
        },
      ],
      as2Profiles: [],
      documentTypes: ["850", "855", "856", "810", "846"],
      lastSync: "2024-01-15 18:20:00",
      transactionCount: 0
    },
    {
      id: "tp-005",
      name: "Acme Logistics",
      code: "ACME",
      type: "3pl",
      tier: "standard",
      email: "edi@acmelogistics.com",
      status: "active",
      integrationType: "edi",
      communicationChannel: { type: "AS2", status: "testing", config: { as2Id: "ACME-LOG-PROD", endpoint: "https://edi.acmelogistics.com/as2", encryption: "AES-256", mdn: "Synchronous" } },
      currentStepId: 3,
      onboardingStartDate: "2024-10-15",
      stepCompletionDates: { 1: "Oct 2024", 2: "Nov 2024" },
      subsidiaries: [],
      as2Profiles: [{ id: "as2-016", name: "Acme Primary", as2Id: "ACME-LOG-PROD", url: "https://edi.acmelogistics.com/as2", encryptionCert: "acme-enc.cer", signingCert: "acme-sign.cer", status: "active" }],
      documentTypes: ["940", "945", "943", "944"],
      lastSync: "--",
      transactionCount: 0
    },
    {
      id: "tp-006",
      name: "Costco Wholesale",
      code: "COST",
      type: "retailer",
      tier: "enterprise",
      email: "edi@costco.com",
      status: "active",
      integrationType: "api",
      currentStepId: 2,
      onboardingStartDate: "2025-12-01",
      stepCompletionDates: { 1: "Dec 2025" },
      subsidiaries: [],
      as2Profiles: [],
      documentTypes: ["850", "855", "856", "810"],
      lastSync: "--",
      transactionCount: 0
    }
  ])

  const [selectedPartner, setSelectedPartner] = useState<TradingPartner | null>(null)
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<Subsidiary | null>(null)
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set(["tp-005"]))
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStage, setFilterStage] = useState<string>("all")
  const [filterIntegration, setFilterIntegration] = useState<string>("all")

  const toggleExpanded = (partnerId: string) => {
    const newExpanded = new Set(expandedPartners)
    if (newExpanded.has(partnerId)) newExpanded.delete(partnerId)
    else newExpanded.add(partnerId)
    setExpandedPartners(newExpanded)
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = { platform: "Platform", retailer: "Retailer", van: "VAN", "3pl": "3PL", manufacturer: "MFG" }
    return labels[type] || type
  }
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = { platform: "bg-purple-100 text-purple-700", retailer: "bg-blue-100 text-blue-700", van: "bg-green-100 text-green-700", "3pl": "bg-orange-100 text-orange-700", manufacturer: "bg-gray-100 text-gray-700" }
    return colors[type] || "bg-gray-100 text-gray-700"
  }

  const filteredPartners = partners.filter(partner => {
    const matchesSearch = partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === "all" || partner.type === filterType
    const matchesIntegration = filterIntegration === "all" || partner.integrationType === filterIntegration
    const matchesStage = filterStage === "all" ||
      (filterStage === "setup" && partner.currentStepId <= 2) ||
      (filterStage === "testing" && (partner.currentStepId === 3 || partner.currentStepId === 4)) ||
      (filterStage === "live" && partner.currentStepId >= 5)
    return matchesSearch && matchesType && matchesIntegration && matchesStage
  })

  const stageCount = {
    setup: partners.filter(p => p.currentStepId <= 2).length,
    testing: partners.filter(p => p.currentStepId === 3 || p.currentStepId === 4).length,
    live: partners.filter(p => p.currentStepId >= 5).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Trading Partners</h2>
          <p className="text-muted-foreground text-sm">
            Manage partner integrations across API and EDI (AS2/SFTP/VAN) paths
          </p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setShowAddModal(true)}>
          + Add Partner
        </Button>
      </div>

      {/* Pipeline Stage Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: "setup", label: "Setup", desc: "Partner & communication setup", count: stageCount.setup, colorBg: "bg-slate-50", colorBorder: "border-slate-400", colorText: "text-slate-600", colorCount: "text-slate-700", colorDot: "bg-slate-100 text-slate-500" },
          { key: "testing", label: "Testing", desc: "Connection & integration validation", count: stageCount.testing, colorBg: "bg-amber-50", colorBorder: "border-amber-400", colorText: "text-amber-600", colorCount: "text-amber-700", colorDot: "bg-amber-100 text-amber-600" },
          { key: "live", label: "Live", desc: "Production active", count: stageCount.live, colorBg: "bg-green-50", colorBorder: "border-green-400", colorText: "text-green-600", colorCount: "text-green-700", colorDot: "bg-green-100 text-green-600" },
        ].map(stage => (
          <Card
            key={stage.key}
            className={`p-4 border-2 cursor-pointer transition-all ${
              filterStage === stage.key ? `${stage.colorBorder} ${stage.colorBg}` : "border-border hover:border-muted-foreground/30"
            }`}
            onClick={() => setFilterStage(filterStage === stage.key ? "all" : stage.key)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${stage.colorText}`}>{stage.label}</p>
                <p className={`text-2xl font-bold ${stage.colorCount}`}>{stage.count}</p>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${stage.colorDot}`}>
                {stage.count}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{stage.desc}</p>
          </Card>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input placeholder="Search partners or codes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-background" />
        </div>
        <select value={filterIntegration} onChange={(e) => setFilterIntegration(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
          <option value="all">All Paths</option>
          <option value="edi">EDI (AS2/SFTP/VAN)</option>
          <option value="api">API</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
          <option value="all">All Types</option>
          <option value="retailer">Retailer</option>
          <option value="platform">Platform</option>
          <option value="van">VAN</option>
          <option value="3pl">3PL</option>
        </select>
      </div>

      {/* Partners List */}
      <div className="space-y-4">
        {filteredPartners.map((partner) => (
          <Card key={partner.id} className="border border-border overflow-hidden">
            {/* Partner Row */}
            <div
              className="p-4 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => toggleExpanded(partner.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <span className={`transform transition-transform text-muted-foreground font-mono ${expandedPartners.has(partner.id) ? "rotate-90" : ""}`}>
                    {">"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg text-foreground">{partner.name}</h3>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">{partner.code}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getTypeColor(partner.type)}`}>{getTypeLabel(partner.type)}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        partner.integrationType === "api" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                      }`}>
                        {partner.integrationType === "api" ? "API" : "EDI"}
                        {partner.communicationChannel && ` / ${partner.communicationChannel.type}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{partner.email}</span>
                      {partner.subsidiaries.length > 0 && (
                        <>
                          <span className="text-border">|</span>
                          <span>{partner.subsidiaries.length} subsidiaries</span>
                        </>
                      )}
                      {partner.transactionCount > 0 && (
                        <>
                          <span className="text-border">|</span>
                          <span>{partner.transactionCount.toLocaleString()} transactions</span>
                        </>
                      )}
                    </div>
                    {/* Compact 5-step Pipeline */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <IntegrationLifecyclePipeline
                        steps={buildIntegrationSteps(partner.currentStepId, partner.stepCompletionDates, partner.integrationType)}
                        currentStepId={partner.currentStepId}
                        progress={getProgressFromStep(partner.currentStepId)}
                        variant="compact"
                      />
                      <span className="text-xs text-muted-foreground">
                        (since {new Date(partner.onboardingStartDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    partner.currentStepId >= 5 ? "bg-green-50 text-green-700" :
                    partner.currentStepId >= 3 ? "bg-amber-50 text-amber-700" :
                    "bg-slate-50 text-slate-700"
                  }`}>
                    {partner.currentStepId >= 6 ? "Live" : `Step ${partner.currentStepId}/5`}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent"
                    onClick={(e) => { e.stopPropagation(); setSelectedPartner(partner); setSelectedSubsidiary(null) }}
                  >
                    Details
                  </Button>
                </div>
              </div>
            </div>

            {/* Expanded: Full Lifecycle Pipeline */}
            {expandedPartners.has(partner.id) && (
              <div className="border-t border-border p-5 bg-muted/20">
                <IntegrationLifecyclePipeline
                  steps={buildIntegrationSteps(partner.currentStepId, partner.stepCompletionDates, partner.integrationType)}
                  currentStepId={partner.currentStepId}
                  progress={getProgressFromStep(partner.currentStepId)}
                  integrationType={partner.integrationType}
                  variant="full"
                  partnerName={partner.name}
                  onNavigate={onNavigate}
                />

                {/* Communication Channel Info */}
                {partner.communicationChannel && (
                  <div className="mt-4 p-3 bg-background border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide">Communication Channel</h5>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        partner.communicationChannel.status === "active" ? "bg-green-100 text-green-700" :
                        partner.communicationChannel.status === "testing" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {partner.communicationChannel.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      {Object.entries(partner.communicationChannel.config).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                          <span className="font-mono text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Expanded: Subsidiaries */}
            {expandedPartners.has(partner.id) && partner.subsidiaries.length > 0 && (
              <div className="border-t border-border">
                {partner.subsidiaries.map((subsidiary, idx) => (
                  <div
                    key={subsidiary.id}
                    className={`p-4 pl-12 ${idx < partner.subsidiaries.length - 1 ? "border-b border-border" : ""} hover:bg-secondary/20 transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">S</div>
                          <h4 className="font-semibold text-foreground">{subsidiary.name}</h4>
                          <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded text-xs font-mono">{subsidiary.code}</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{subsidiary.region}</span>
                        </div>
                        {subsidiary.as2Profiles.length > 0 && (
                          <div className="mt-2 ml-9">
                            <div className="flex flex-wrap gap-2">
                              {subsidiary.as2Profiles.map((profile) => (
                                <div key={profile.id} className={`px-3 py-1.5 rounded-lg border text-xs ${profile.status === "active" ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                                  <span className="font-semibold text-foreground">{profile.name}</span>
                                  <span className="text-muted-foreground ml-2 font-mono">{profile.as2Id}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 ml-9">
                          <span className="text-xs text-muted-foreground">Documents:</span>
                          <div className="flex gap-1 flex-wrap">
                            {subsidiary.documentTypes.map((doc) => (
                              <span key={doc} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">{doc}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${subsidiary.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-700"}`}>
                        {subsidiary.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Expanded: Direct AS2 Profiles (no subsidiaries) */}
            {expandedPartners.has(partner.id) && partner.subsidiaries.length === 0 && partner.as2Profiles.length > 0 && (
              <div className="border-t border-border p-4 pl-12">
                <p className="text-sm text-muted-foreground font-medium mb-3">AS2 Profiles ({partner.as2Profiles.length})</p>
                <div className="flex flex-wrap gap-3">
                  {partner.as2Profiles.map((profile) => (
                    <div key={profile.id} className={`px-4 py-3 rounded-lg border ${profile.status === "active" ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                      <div className="font-semibold text-foreground text-sm">{profile.name}</div>
                      <div className="font-mono text-xs text-muted-foreground mt-1">{profile.as2Id}</div>
                      <div className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{profile.url}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-sm text-muted-foreground">Documents:</span>
                  <div className="flex gap-1 flex-wrap">
                    {partner.documentTypes.map((doc) => (
                      <span key={doc} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">{doc}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Expanded: API partners with no subsidiaries/profiles */}
            {expandedPartners.has(partner.id) && partner.integrationType === "api" && partner.subsidiaries.length === 0 && partner.as2Profiles.length === 0 && (
              <div className="border-t border-border p-4 pl-12">
                <p className="text-sm text-muted-foreground font-medium mb-3">Supported Document Types</p>
                <div className="flex gap-1 flex-wrap">
                  {partner.documentTypes.map((doc) => (
                    <span key={doc} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">{doc}</span>
                  ))}
                </div>
                {!partner.communicationChannel && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700">API channel not yet configured. Complete Communication Setup to proceed.</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Partner Detail Modal */}
      {selectedPartner && (
        <PartnerDetailModal
          partner={selectedPartner}
          subsidiary={selectedSubsidiary}
          onClose={() => { setSelectedPartner(null); setSelectedSubsidiary(null) }}
        />
      )}

      {/* Add Partner Modal */}
      {showAddModal && (
        <AddPartnerModal
          onClose={() => setShowAddModal(false)}
          onSave={(newPartner: any) => { setPartners(prev => [...prev, newPartner]); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}
