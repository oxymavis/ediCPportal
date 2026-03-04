"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import IntegrationLifecyclePipeline, { buildIntegrationSteps, getProgressFromStep } from "../integration-lifecycle"

// ==================== Types ====================

interface TestDocumentResult {
  id: string
  documentType: string
  documentName: string
  direction: "IN" | "OUT"
  testCount: number
  lastResult: "pass" | "fail" | "pending"
  errorCount: number
  lastTestedAt?: string
  errors?: ValidationError[]
}

interface ValidationError {
  segmentId: string
  elementPosition: string
  errorType: "structural" | "value" | "missing" | "conditional"
  severity: "error" | "warning"
  expected: string
  actual: string
  description: string
}

interface PartnerTestingStatus {
  partnerId: string
  partnerName: string
  partnerCode: string
  integrationType: "api" | "edi"
  channelType: "AS2" | "SFTP" | "VAN" | "REST_API"
  lifecycleStepId: number
  lifecycleCompletionDates?: Record<number, string>
  overallProgress: number
  startDate: string
  lastActivity: string
}

// ==================== Mock Data ====================

const partnerStatuses: PartnerTestingStatus[] = [
  {
    partnerId: "tp-002", partnerName: "Walmart", partnerCode: "WMT",
    integrationType: "edi", channelType: "AS2",
    lifecycleStepId: 6, lifecycleCompletionDates: { 1: "Jan 2023", 2: "Feb 2023", 3: "Mar 2023", 4: "Apr 2023", 5: "May 2023" },
    overallProgress: 100, startDate: "2023-01-10", lastActivity: "2023-05-15",
  },
  {
    partnerId: "tp-004", partnerName: "Amazon", partnerCode: "AMZN",
    integrationType: "api", channelType: "REST_API",
    lifecycleStepId: 4, lifecycleCompletionDates: { 1: "Aug 2024", 2: "Sep 2024", 3: "Oct 2024" },
    overallProgress: 60, startDate: "2024-08-01", lastActivity: "2024-12-20",
  },
  {
    partnerId: "tp-005", partnerName: "Acme Logistics", partnerCode: "ACME",
    integrationType: "edi", channelType: "AS2",
    lifecycleStepId: 3, lifecycleCompletionDates: { 1: "Oct 2024", 2: "Nov 2024" },
    overallProgress: 40, startDate: "2024-10-15", lastActivity: "2025-01-10",
  },
  {
    partnerId: "tp-006", partnerName: "Costco Wholesale", partnerCode: "COST",
    integrationType: "api", channelType: "REST_API",
    lifecycleStepId: 2, lifecycleCompletionDates: { 1: "Dec 2025" },
    overallProgress: 20, startDate: "2025-12-01", lastActivity: "2025-12-15",
  },
]

const sampleDocResults: TestDocumentResult[] = [
  { id: "td-1", documentType: "850", documentName: "Purchase Order", direction: "IN", testCount: 3, lastResult: "pass", errorCount: 0, lastTestedAt: "2024-12-18 14:30" },
  {
    id: "td-2", documentType: "855", documentName: "PO Acknowledgment", direction: "OUT", testCount: 2, lastResult: "fail", errorCount: 3, lastTestedAt: "2024-12-18 15:00",
    errors: [
      { segmentId: "BAK", elementPosition: "BAK03", errorType: "value", severity: "error", expected: "AD", actual: "AC", description: "BAK03 Acknowledgment Type must be 'AD' when line items have modified quantities" },
      { segmentId: "DTM", elementPosition: "DTM02", errorType: "structural", severity: "error", expected: "CCYYMMDD", actual: "YYMMDD", description: "DTM02 Date format must use century year (CCYYMMDD)" },
      { segmentId: "PO1", elementPosition: "PO104", errorType: "value", severity: "warning", expected: "EA", actual: "PC", description: "PO104 Unit 'PC' is non-standard, recommend 'EA'" },
    ],
  },
  { id: "td-3", documentType: "856", documentName: "Ship Notice / ASN", direction: "OUT", testCount: 1, lastResult: "fail", errorCount: 2, lastTestedAt: "2024-12-17 11:00",
    errors: [
      { segmentId: "BSN", elementPosition: "BSN02", errorType: "missing", severity: "error", expected: "Required", actual: "Empty", description: "BSN02 Shipment ID is required but empty" },
      { segmentId: "HL", elementPosition: "HL03", errorType: "conditional", severity: "error", expected: "S (Shipment)", actual: "O (Order)", description: "HL03 first level must be 'S' not 'O'" },
    ],
  },
  { id: "td-4", documentType: "810", documentName: "Invoice", direction: "OUT", testCount: 0, lastResult: "pending", errorCount: 0 },
]

// ==================== Main Component ====================

export default function ConnectionTestingTab() {
  const [selectedPartner, setSelectedPartner] = useState<PartnerTestingStatus | null>(null)
  const [pathFilter, setPathFilter] = useState<"all" | "edi" | "api">("all")

  const filteredPartners = partnerStatuses.filter(p =>
    pathFilter === "all" || p.integrationType === pathFilter
  )

  if (selectedPartner) {
    return (
      <PartnerTestingDetail
        partner={selectedPartner}
        onBack={() => setSelectedPartner(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Connection Testing</h2>
          <p className="text-sm text-muted-foreground">Test AS2/SFTP connections and API endpoints for each trading partner</p>
        </div>
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {(["all", "edi", "api"] as const).map(f => (
            <button
              key={f}
              onClick={() => setPathFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pathFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "edi" ? "EDI" : "API"}
            </button>
          ))}
        </div>
      </div>

      {/* Partner Cards */}
      <div className="space-y-3">
        {filteredPartners.map(partner => (
          <Card
            key={partner.partnerId}
            className="p-5 border border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
            onClick={() => setSelectedPartner(partner)}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-foreground">{partner.partnerName}</h3>
                  <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 bg-secondary rounded">{partner.partnerCode}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    partner.integrationType === "api" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                  }`}>
                    {partner.integrationType === "api" ? "API" : `EDI / ${partner.channelType}`}
                  </span>
                  {partner.overallProgress === 100 && (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Live</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Started {partner.startDate} -- Last activity {partner.lastActivity}
                </p>
                <IntegrationLifecyclePipeline
                  steps={buildIntegrationSteps(partner.lifecycleStepId, partner.lifecycleCompletionDates, partner.integrationType)}
                  currentStepId={partner.lifecycleStepId}
                  progress={getProgressFromStep(partner.lifecycleStepId)}
                  variant="compact"
                />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">{partner.overallProgress}%</p>
                <p className="text-xs text-muted-foreground">Progress</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ==================== Partner Detail ====================

function PartnerTestingDetail({ partner, onBack }: { partner: PartnerTestingStatus; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<string>(
    partner.integrationType === "api" ? "api-testing" : "as2-connection"
  )

  const tabs = partner.integrationType === "edi"
    ? [
        { id: "as2-connection", label: "AS2 Connection Test" },
        { id: "document-testing", label: "Document Testing" },
        { id: "payload-validator", label: "Payload Validator" },
      ]
    : [
        { id: "api-testing", label: "API Testing" },
        { id: "document-testing", label: "Document Testing" },
        { id: "payload-validator", label: "Payload Validator" },
      ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="bg-transparent" onClick={onBack}>
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-lg text-foreground">{partner.partnerName}</h3>
            <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 bg-secondary rounded">{partner.partnerCode}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              partner.integrationType === "api" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
            }`}>
              {partner.integrationType === "api" ? "API / REST" : `EDI / ${partner.channelType}`}
            </span>
          </div>
        </div>
      </div>

      {/* Lifecycle Pipeline */}
      <Card className="p-5 border border-border">
        <IntegrationLifecyclePipeline
          steps={buildIntegrationSteps(partner.lifecycleStepId, partner.lifecycleCompletionDates, partner.integrationType)}
          currentStepId={partner.lifecycleStepId}
          progress={getProgressFromStep(partner.lifecycleStepId)}
          integrationType={partner.integrationType}
          variant="full"
          partnerName={partner.partnerName}
        />
      </Card>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "as2-connection" && <AS2ConnectionTest partner={partner} />}
      {activeTab === "api-testing" && <APITestingPanel partner={partner} />}
      {activeTab === "document-testing" && <DocumentTestingPanel partner={partner} />}
      {activeTab === "payload-validator" && <PayloadValidatorPanel partner={partner} />}
    </div>
  )
}

// ==================== AS2 Connection Test ====================

function AS2ConnectionTest({ partner }: { partner: PartnerTestingStatus }) {
  const [steps, setSteps] = useState([
    { id: 1, name: "DNS Resolution", desc: "Resolve AS2 endpoint hostname", status: "pending" as string, detail: "" },
    { id: 2, name: "TCP Connection", desc: "Establish TCP connection on port 443", status: "pending", detail: "" },
    { id: 3, name: "TLS Handshake", desc: "Verify TLS certificate chain", status: "pending", detail: "" },
    { id: 4, name: "Certificate Validation", desc: "Validate encryption & signing certs", status: "pending", detail: "" },
    { id: 5, name: "AS2 Handshake", desc: "Send AS2 ping message", status: "pending", detail: "" },
    { id: 6, name: "MDN Response", desc: "Await MDN acknowledgment", status: "pending", detail: "" },
    { id: 7, name: "EDI Compliance", desc: "Verify ISA/GS envelope compliance", status: "pending", detail: "" },
  ])
  const [testing, setTesting] = useState(false)
  const [complete, setComplete] = useState(false)

  const runTest = () => {
    setTesting(true)
    setComplete(false)
    setSteps(prev => prev.map(s => ({ ...s, status: "pending", detail: "" })))

    const results = [
      { status: "pass", detail: "Resolved endpoint -> 203.0.113.42" },
      { status: "pass", detail: "TCP connected in 45ms" },
      { status: "pass", detail: "TLS 1.3 handshake OK, cert valid to 2025-06-15" },
      { status: "pass", detail: "Encryption SHA-256 OK, Signing RSA-2048 OK" },
      { status: "pass", detail: "AS2 ping accepted, partner ID confirmed" },
      { status: "pass", detail: "Sync MDN received, disposition: processed" },
      { status: "pass", detail: "ISA/GS compliant with X12 004010" },
    ]

    results.forEach((result, idx) => {
      setTimeout(() => {
        setSteps(prev => prev.map((s, i) =>
          i === idx ? { ...s, status: result.status, detail: result.detail } :
          i === idx + 1 ? { ...s, status: "running" } : s
        ))
        if (idx === results.length - 1) {
          setTimeout(() => { setTesting(false); setComplete(true) }, 300)
        }
      }, (idx + 1) * 700)
    })

    setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: "running" } : s))
  }

  return (
    <div className="space-y-4">
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
        <h4 className="font-semibold text-sky-800 mb-1">AS2 Connection Diagnostics</h4>
        <p className="text-sm text-sky-700">
          Run a 7-step diagnostic to verify AS2 connectivity with {partner.partnerName}. Each step tests a specific layer of the communication stack.
        </p>
      </div>

      <div className="flex gap-3">
        <Button className="bg-primary hover:bg-primary/90" onClick={runTest} disabled={testing}>
          {testing ? "Testing..." : "Run Connection Test"}
        </Button>
        {complete && (
          <span className="flex items-center gap-2 text-sm text-green-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500" /> All 7 steps passed
          </span>
        )}
      </div>

      <div className="space-y-2">
        {steps.map(step => (
          <Card key={step.id} className={`p-4 border-l-4 ${
            step.status === "pass" ? "border-l-green-500" :
            step.status === "fail" ? "border-l-red-500" :
            step.status === "running" ? "border-l-primary" :
            "border-l-secondary"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step.status === "pass" ? "bg-green-100 text-green-700" :
                  step.status === "fail" ? "bg-red-100 text-red-700" :
                  step.status === "running" ? "bg-primary/10 text-primary animate-pulse" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {step.status === "pass" ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> :
                   step.status === "running" ? "..." : step.id}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{step.name}</h4>
                  <p className="text-xs text-muted-foreground">{step.detail || step.desc}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ==================== API Testing Panel ====================

function APITestingPanel({ partner }: { partner: PartnerTestingStatus }) {
  const [messageType, setMessageType] = useState("850")
  const [payload, setPayload] = useState("")
  const [response, setResponse] = useState<null | { status: number; statusText: string; body: string; latency: number }>(null)
  const [sending, setSending] = useState(false)

  const samplePayloads: Record<string, string> = {
    "850": JSON.stringify({
      transactionType: "850",
      purchaseOrderNumber: "PO-2024-001234",
      orderDate: "2024-12-18",
      buyer: { name: "Amazon Vendor Central", id: "AMZN-VC" },
      seller: { name: "Midea Group", id: "MIDEA-001" },
      lineItems: [
        { lineNumber: 1, sku: "MDA-AC-5000BTU", quantity: 500, unit: "EA", unitPrice: 189.99, description: "Midea 5000 BTU Window AC" },
        { lineNumber: 2, sku: "MDA-AC-8000BTU", quantity: 200, unit: "EA", unitPrice: 289.99, description: "Midea 8000 BTU Window AC" },
      ],
      shipTo: { name: "Amazon Fulfillment Center", address: "1234 Commerce Way", city: "Dallas", state: "TX", zip: "75201" },
    }, null, 2),
    "855": JSON.stringify({
      transactionType: "855",
      purchaseOrderNumber: "PO-2024-001234",
      acknowledgmentType: "AC",
      acknowledgmentDate: "2024-12-19",
      lineItems: [
        { lineNumber: 1, sku: "MDA-AC-5000BTU", quantityAcknowledged: 500, status: "IA" },
        { lineNumber: 2, sku: "MDA-AC-8000BTU", quantityAcknowledged: 150, status: "IB", backorderQuantity: 50 },
      ],
    }, null, 2),
  }

  const handleSendTest = () => {
    setSending(true)
    setResponse(null)
    // Simulate API call
    setTimeout(() => {
      setResponse({
        status: 200,
        statusText: "OK",
        latency: 234,
        body: JSON.stringify({
          success: true,
          transactionId: `TXN-${Date.now()}`,
          message: "Message accepted for processing",
          validationStatus: "passed",
          estimatedProcessingTime: "< 30 seconds",
        }, null, 2),
      })
      setSending(false)
    }, 1500)
  }

  return (
    <div className="space-y-4">
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
        <h4 className="font-semibold text-violet-800 mb-1">API Testing Console</h4>
        <p className="text-sm text-violet-700">
          Send test API requests to validate message processing for {partner.partnerName}. Token authentication is pre-configured for the sandbox environment.
        </p>
      </div>

      {/* API Config Info */}
      <Card className="p-4 border border-border">
        <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">API Configuration</h5>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Base URL</span>
            <p className="font-mono text-foreground text-xs">https://api.unis-edi.com/v1</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Auth Token</span>
            <p className="font-mono text-foreground text-xs">tok_amzn_****3f7a</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Environment</span>
            <p className="font-mono text-foreground text-xs">Sandbox</p>
          </div>
        </div>
      </Card>

      {/* Request Builder */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground">Request</h5>
            <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 bg-secondary rounded">POST /messages/{messageType}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Message Type</label>
            <select value={messageType} onChange={e => { setMessageType(e.target.value); setPayload(""); setResponse(null) }} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
              <option value="850">850 - Purchase Order</option>
              <option value="855">855 - PO Acknowledgment</option>
              <option value="856">856 - Ship Notice</option>
              <option value="810">810 - Invoice</option>
              <option value="204">204 - Load Tender</option>
              <option value="214">214 - Transportation Status</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-foreground">JSON Payload</label>
              <button onClick={() => setPayload(samplePayloads[messageType] || "{}")} className="text-xs text-primary hover:underline">Load Sample</button>
            </div>
            <textarea
              value={payload}
              onChange={e => { setPayload(e.target.value); setResponse(null) }}
              placeholder="Enter JSON payload..."
              className="w-full h-64 px-3 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-xs resize-y"
            />
          </div>
          <div className="flex gap-2">
            <Button className="bg-primary hover:bg-primary/90" onClick={handleSendTest} disabled={sending || !payload}>
              {sending ? "Sending..." : "Send Test Request"}
            </Button>
            <Button variant="outline" className="bg-transparent" onClick={() => { setPayload(""); setResponse(null) }}>Clear</Button>
          </div>
        </div>

        {/* Response */}
        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-foreground">Response</h5>
          {response ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  response.status < 300 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {response.status} {response.statusText}
                </span>
                <span className="text-xs text-muted-foreground">{response.latency}ms</span>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground border-b border-border">Response Body</div>
                <pre className="p-3 text-xs font-mono text-foreground bg-background overflow-auto max-h-72">{response.body}</pre>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground">Send a request to see the response</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== Document Testing ====================

function DocumentTestingPanel({ partner }: { partner: PartnerTestingStatus }) {
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const docResults = (partner.partnerId === "tp-004" || partner.partnerId === "tp-002") ? sampleDocResults : []

  if (docResults.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
        <h4 className="font-semibold text-slate-700 mb-2">No Test Results Yet</h4>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          UNIS team is setting up document testing for {partner.partnerName}. Results will appear here once testing begins.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-1">Document Test Results</h4>
        <p className="text-sm text-blue-700">
          View testing status for each document type with {partner.partnerName}. Click a row to expand validation details.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-3 border border-border"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold text-foreground">{docResults.length}</p></Card>
        <Card className="p-3 border border-border"><p className="text-xs text-muted-foreground">Passed</p><p className="text-xl font-bold text-green-600">{docResults.filter(d => d.lastResult === "pass").length}</p></Card>
        <Card className="p-3 border border-border"><p className="text-xs text-muted-foreground">Failed</p><p className="text-xl font-bold text-red-600">{docResults.filter(d => d.lastResult === "fail").length}</p></Card>
        <Card className="p-3 border border-border"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold text-slate-500">{docResults.filter(d => d.lastResult === "pending").length}</p></Card>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50">
              <th className="text-left px-4 py-3 font-semibold text-foreground">Document</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Direction</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Tests</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Result</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Errors</th>
              <th className="text-left px-4 py-3 font-semibold text-foreground">Last Tested</th>
            </tr>
          </thead>
          <tbody>
            {docResults.map(doc => (
              <DocRow key={doc.id} doc={doc} expanded={expandedDoc === doc.id} onToggle={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DocRow({ doc, expanded, onToggle }: { doc: TestDocumentResult; expanded: boolean; onToggle: () => void }) {
  const resultBadge = doc.lastResult === "pass"
    ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Pass</span>
    : doc.lastResult === "fail"
      ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Fail</span>
      : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-500">Pending</span>

  return (
    <>
      <tr className={`border-t border-border cursor-pointer hover:bg-secondary/30 transition-colors ${expanded ? "bg-secondary/20" : ""}`} onClick={onToggle}>
        <td className="px-4 py-3">
          <span className="font-mono font-semibold text-foreground">{doc.documentType}</span>
          <span className="text-muted-foreground ml-2">{doc.documentName}</span>
        </td>
        <td className="px-4 py-3">
          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${doc.direction === "IN" ? "bg-cyan-100 text-cyan-700" : "bg-purple-100 text-purple-700"}`}>{doc.direction}</span>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{doc.testCount}</td>
        <td className="px-4 py-3">{resultBadge}</td>
        <td className="px-4 py-3">{doc.errorCount > 0 ? <span className="text-red-600 font-semibold">{doc.errorCount}</span> : doc.lastResult === "pending" ? <span className="text-slate-400">-</span> : <span className="text-green-600">0</span>}</td>
        <td className="px-4 py-3 text-muted-foreground text-xs">{doc.lastTestedAt || "-"}</td>
      </tr>
      {expanded && doc.errors && doc.errors.length > 0 && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-secondary/10">
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="text-left px-3 py-2 font-semibold">Severity</th>
                    <th className="text-left px-3 py-2 font-semibold">Segment</th>
                    <th className="text-left px-3 py-2 font-semibold">Element</th>
                    <th className="text-left px-3 py-2 font-semibold">Expected</th>
                    <th className="text-left px-3 py-2 font-semibold">Actual</th>
                    <th className="text-left px-3 py-2 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.errors.map((err, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${err.severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{err.severity.toUpperCase()}</span></td>
                      <td className="px-3 py-2 font-mono font-semibold">{err.segmentId}</td>
                      <td className="px-3 py-2 font-mono">{err.elementPosition}</td>
                      <td className="px-3 py-2 text-green-700 font-mono">{err.expected}</td>
                      <td className="px-3 py-2 text-red-700 font-mono">{err.actual}</td>
                      <td className="px-3 py-2 text-muted-foreground">{err.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
      {expanded && doc.lastResult === "pass" && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-green-50/50">
            <p className="text-sm text-green-700">All validation checks passed. No errors detected.</p>
          </td>
        </tr>
      )}
    </>
  )
}

// ==================== Payload Validator ====================

function PayloadValidatorPanel({ partner }: { partner: PartnerTestingStatus }) {
  const [format, setFormat] = useState<"x12" | "json" | "xml">(partner.integrationType === "api" ? "json" : "x12")
  const [payload, setPayload] = useState("")
  const [result, setResult] = useState<null | { valid: boolean; errors: string[]; warnings: string[] }>(null)

  const validate = () => {
    if (!payload.trim()) {
      setResult({ valid: false, errors: ["Payload is empty"], warnings: [] })
      return
    }
    if (format === "x12") {
      const isX12 = payload.includes("ISA") || payload.includes("GS")
      if (isX12) {
        setResult({ valid: true, errors: [], warnings: ["DTM segment date format should use CCYYMMDD", "N1 segment optional qualifier N103 not provided"] })
      } else {
        setResult({ valid: false, errors: ["Invalid X12 format - Missing ISA envelope header", "Missing GS functional group header"], warnings: [] })
      }
    } else if (format === "json") {
      try {
        JSON.parse(payload)
        setResult({ valid: true, errors: [], warnings: ["Schema validation passed"] })
      } catch {
        setResult({ valid: false, errors: ["Invalid JSON syntax"], warnings: [] })
      }
    } else {
      setResult({ valid: true, errors: [], warnings: ["XML schema validation passed with minor warnings"] })
    }
  }

  const loadSample = () => {
    if (format === "x12") {
      setPayload(`ISA*00*          *00*          *ZZ*UNISTEST       *ZZ*${partner.partnerCode.padEnd(15)}*240115*1200*U*00401*000000001*0*T*>~\nGS*PO*UNISTEST*${partner.partnerCode}*20240115*1200*1*X*004010~\nST*850*0001~\nBEG*00*NE*PO-12345**20240115~\nN1*ST*Ship To Location*92*LOC001~\nPO1*1*10*EA*29.99*PE*UP*012345678901~\nCTT*1~\nSE*7*0001~\nGE*1*1~\nIEA*1*000000001~`)
    } else {
      setPayload(JSON.stringify({
        transactionType: "850",
        purchaseOrderNumber: "PO-TEST-001",
        sender: { id: "UNIS-TEST", name: "UNIS EDI Hub" },
        receiver: { id: partner.partnerCode, name: partner.partnerName },
        lineItems: [{ sku: "SAMPLE-001", quantity: 10, unitPrice: 29.99 }],
      }, null, 2))
    }
    setResult(null)
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-1">Payload Validator</h4>
        <p className="text-sm text-blue-700">
          Validate your {partner.integrationType === "api" ? "JSON API" : "EDI"} payload against UNIS specifications and {partner.partnerName} guidelines.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Format</label>
          <select value={format} onChange={e => { setFormat(e.target.value as any); setResult(null) }} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
            {partner.integrationType === "edi" && <option value="x12">X12 EDI</option>}
            <option value="json">JSON</option>
            <option value="xml">XML</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Direction</label>
          <select className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm">
            <option value="IN">Inbound (Receive)</option>
            <option value="OUT">Outbound (Send)</option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-foreground">Payload</label>
          <button onClick={loadSample} className="text-xs text-primary hover:underline">Load Sample</button>
        </div>
        <textarea
          value={payload}
          onChange={e => { setPayload(e.target.value); setResult(null) }}
          placeholder={format === "x12" ? "ISA*00*..." : format === "json" ? '{ "transactionType": "850", ... }' : '<?xml version="1.0"?>...'}
          className="w-full h-48 px-4 py-3 border border-border rounded-lg bg-background text-foreground font-mono text-sm resize-y"
        />
      </div>

      <div className="flex gap-3">
        <Button className="bg-primary hover:bg-primary/90" onClick={validate}>Validate</Button>
        <Button variant="outline" className="bg-transparent" onClick={() => { setPayload(""); setResult(null) }}>Clear</Button>
      </div>

      {result && (
        <Card className={`p-5 border-2 ${result.valid ? "border-green-300 bg-green-50/30" : "border-red-300 bg-red-50/30"}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${result.valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {result.valid ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : "!"}
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{result.valid ? "Validation Passed" : "Validation Failed"}</h4>
              <p className="text-sm text-muted-foreground">{result.errors.length} error(s), {result.warnings.length} warning(s)</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded p-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />{err}
                </div>
              ))}
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="space-y-1.5">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 rounded p-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />{w}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
