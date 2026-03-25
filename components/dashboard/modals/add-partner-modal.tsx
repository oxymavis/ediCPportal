"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api-client"

interface AddPartnerModalProps {
  onClose: () => void
  onSave: (partner: any) => void
}

const STEP_LABELS = [
  "Basic Info",
  "Integration Path",
  "Channel Config",
  "Document Types",
  "Review",
]

const AS2_QUALIFIER_OPTIONS = [...Array.from({ length: 33 }, (_, i) => String(i + 1).padStart(2, "0")), "ZZ"]

/** Normalize backend partner response to TradingPartner shape for list display */
function normalizePartnerFromApi(p: any): any {
  const lifecycle = p.lifecycle || {}
  const channel = p.communicationChannel
  const channelObj = typeof channel === "string"
    ? { type: channel, status: "configured" as const, config: p.apiConfig || {} }
    : channel
  const subsidiaries = (p.subsidiaries ?? []).map((s: any) => ({
    ...s,
    as2Profiles: (s.as2Profiles ?? []).map((a: any) => ({
      ...a,
      url: a.as2Url ?? a.url ?? "",
      as2Port: a.as2Port,
      senderId: a.senderId,
      senderQualifier: a.senderQualifier,
      receiverId: a.receiverId,
      receiverQualifier: a.receiverQualifier,
    })),
  }))
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    type: (p as any).type ?? "retailer",
    tier: (p as any).tier ?? "standard",
    email: p.primaryContact?.email ?? (p as any).email ?? "",
    status: p.status ?? "active",
    integrationType: p.integrationType ?? "edi",
    communicationChannel: channelObj,
    currentStepId: lifecycle.currentStepId ?? 1,
    onboardingStartDate: lifecycle.onboardingStartDate ?? new Date().toISOString().split("T")[0],
    stepCompletionDates: lifecycle.stepCompletionDates ?? {},
    subsidiaries,
    as2Profiles: subsidiaries.flatMap((s: any) => s.as2Profiles ?? []),
    documentTypes: subsidiaries[0]?.supportedDocTypes?.x12 ?? [],
    lastSync: "--",
    transactionCount: 0,
  }
}

export default function AddPartnerModal({ onClose, onSave }: AddPartnerModalProps) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "retailer",
    tier: "standard",
    email: "",
    status: "active" as "active" | "inactive",
    // Integration path
    integrationType: "" as "api" | "edi" | "",
    // EDI channel config
    channelType: "AS2" as "AS2" | "SFTP" | "VAN",
    as2Id: "",
    as2Url: "",
    as2Port: "443",
    senderId: "",
    senderQualifier: "ZZ",
    receiverId: "",
    receiverQualifier: "ZZ",
    encryptionCert: "",
    signingCert: "",
    sftpHost: "",
    sftpPort: "22",
    sftpUser: "",
    vanProvider: "",
    vanNetworkId: "",
    // API channel config
    apiBaseUrl: "",
    apiWebhookUrl: "",
    // Document Types
    documentTypes: [] as string[],
  })

  const partnerTypes = [
    { value: "platform", label: "Platform" },
    { value: "retailer", label: "Retailer" },
    { value: "van", label: "VAN Provider" },
    { value: "3pl", label: "3PL" },
    { value: "manufacturer", label: "Manufacturer" },
  ]

  const documentTypeOptions = [
    { value: "850", label: "Purchase Order" },
    { value: "855", label: "PO Acknowledgment" },
    { value: "856", label: "Ship Notice / ASN" },
    { value: "810", label: "Invoice" },
    { value: "940", label: "Warehouse Ship Order" },
    { value: "945", label: "Warehouse Ship Advice" },
    { value: "943", label: "Warehouse Stock Transfer" },
    { value: "944", label: "Warehouse Stock Receipt" },
    { value: "846", label: "Inventory Inquiry" },
    { value: "860", label: "PO Change Request" },
    { value: "204", label: "Motor Carrier Load Tender" },
    { value: "214", label: "Transportation Status" },
    { value: "990", label: "Response to Load Tender" },
    { value: "210", label: "Motor Carrier Freight Invoice" },
  ]

  const toggleDocType = (docType: string) => {
    setFormData(prev => ({
      ...prev,
      documentTypes: prev.documentTypes.includes(docType)
        ? prev.documentTypes.filter(d => d !== docType)
        : [...prev.documentTypes, docType]
    }))
  }

  const handleSubmit = async () => {
    setError(null)
    setSaving(true)

    const communicationChannel = formData.integrationType === "api" ? "REST_API" : formData.channelType
    const apiConfig =
      formData.integrationType === "api"
        ? {
            baseUrl: formData.apiBaseUrl || "https://api.unis-edi.com/v1",
            ...(formData.apiWebhookUrl ? { webhook: formData.apiWebhookUrl } : {}),
          }
        : undefined

    const subsidiaries: any[] = []
    if (formData.integrationType === "edi" && formData.channelType === "AS2" && formData.as2Id) {
      subsidiaries.push({
        name: `${formData.name} Primary`,
        code: `${formData.code}-PRIMARY`,
        region: "",
        status: "active",
        supportedDocTypes: { x12: formData.documentTypes, edifact: [] },
        as2Profiles: [
          {
            name: `${formData.name} Primary`,
            as2Id: formData.as2Id,
            as2Url: formData.as2Url,
            as2Port: Number(formData.as2Port),
            senderId: formData.senderId.trim(),
            senderQualifier: formData.senderQualifier,
            receiverId: formData.receiverId.trim(),
            receiverQualifier: formData.receiverQualifier,
            status: "active",
            encryptionCert: formData.encryptionCert || undefined,
            signingCert: formData.signingCert || undefined,
          },
        ],
      })
    } else if (formData.documentTypes.length > 0) {
      subsidiaries.push({
        name: formData.name,
        code: formData.code,
        region: "",
        status: "active",
        supportedDocTypes: { x12: formData.documentTypes, edifact: [] },
        as2Profiles: [],
      })
    }

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      primaryContact: { name: formData.name, email: formData.email },
      integrationType: formData.integrationType,
      communicationChannel,
      status: formData.status,
      currentStepId: 1,
      onboardingStartDate: new Date().toISOString().split("T")[0],
      stepCompletionDates: {},
      ...(apiConfig ? { apiConfig } : {}),
      subsidiaries,
    }

    const res = await apiClient.createPartner(payload)
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.error || "Failed to create partner")
      return
    }
    onSave(normalizePartnerFromApi(res.data))
    onClose()
  }

  const canProceed = () => {
    switch (step) {
      case 1: return formData.name && formData.code && formData.email
      case 2: return formData.integrationType !== ""
      case 3:
        if (formData.integrationType === "edi") {
          if (formData.channelType === "AS2") return formData.as2Id && formData.as2Url && formData.as2Port && formData.senderId && formData.receiverId
          if (formData.channelType === "SFTP") return formData.sftpHost && formData.sftpUser
          return formData.vanProvider
        }
        return true // API path has optional fields
      case 4: return formData.documentTypes.length > 0
      default: return true
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-card">
          <div>
            <h2 className="text-xl font-bold text-foreground">Add Trading Partner</h2>
            <p className="text-sm text-muted-foreground mt-1">Step {step} of 5 - {STEP_LABELS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex gap-1.5">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full ${i < step ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            {STEP_LABELS.map((label, i) => (
              <span key={label} className={i < step ? "text-primary font-medium" : ""}>{label}</span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Partner Name *</Label>
                  <Input id="name" placeholder="e.g., Walmart" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Partner Code *</Label>
                  <Input id="code" placeholder="e.g., WMT" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))} className="font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Partner Type *</Label>
                  <select id="type" value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                    {partnerTypes.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier">Service Tier *</Label>
                  <select id="tier" value={formData.tier} onChange={e => setFormData(p => ({ ...p, tier: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                    <option value="enterprise">Enterprise</option>
                    <option value="standard">Standard</option>
                    <option value="basic">Basic</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Contact Email *</Label>
                <Input id="email" type="email" placeholder="edi@partner.com" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Initial Status</Label>
                <select id="status" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value as "active" | "inactive" }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Integration Path Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose how this partner will connect to UNIS EDI Hub.</p>
              <div className="grid grid-cols-2 gap-4">
                {/* EDI */}
                <button
                  onClick={() => setFormData(p => ({ ...p, integrationType: "edi" }))}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${
                    formData.integrationType === "edi"
                      ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                      : "border-border hover:border-sky-300"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                      <span className="text-sky-700 font-bold text-sm">EDI</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">EDI Integration</h3>
                      <p className="text-xs text-muted-foreground">AS2 / SFTP / VAN</p>
                    </div>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li>- Traditional EDI over AS2, SFTP or VAN</li>
                    <li>- X12 / EDIFACT document exchange</li>
                    <li>- Certificate-based encryption</li>
                    <li>- MDN acknowledgment support</li>
                  </ul>
                </button>

                {/* API */}
                <button
                  onClick={() => setFormData(p => ({ ...p, integrationType: "api" }))}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${
                    formData.integrationType === "api"
                      ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200"
                      : "border-border hover:border-violet-300"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                      <span className="text-violet-700 font-bold text-sm">API</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">API Integration</h3>
                      <p className="text-xs text-muted-foreground">REST API / Webhook</p>
                    </div>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li>- RESTful API with JSON payloads</li>
                    <li>- Token-based authentication</li>
                    <li>- Webhook for real-time notifications</li>
                    <li>- Swagger / OpenAPI documentation</li>
                  </ul>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Channel Config */}
          {step === 3 && formData.integrationType === "edi" && (
            <div className="space-y-4">
              {/* EDI Protocol selector */}
              <div className="space-y-2">
                <Label>Communication Protocol</Label>
                <div className="flex gap-2">
                  {(["AS2", "SFTP", "VAN"] as const).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setFormData(p => ({ ...p, channelType: ch }))}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                        formData.channelType === ch
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {formData.channelType === "AS2" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="as2Id">AS2 Identifier *</Label>
                      <Input id="as2Id" placeholder="PARTNER-AS2-PROD" value={formData.as2Id} onChange={e => setFormData(p => ({ ...p, as2Id: e.target.value }))} className="font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="as2Url">AS2 Endpoint URL *</Label>
                      <Input id="as2Url" placeholder="https://as2.partner.com/receive" value={formData.as2Url} onChange={e => setFormData(p => ({ ...p, as2Url: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="as2Port">Port *</Label>
                      <Input id="as2Port" placeholder="443" value={formData.as2Port} onChange={e => setFormData(p => ({ ...p, as2Port: e.target.value }))} className="font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="senderId">Sender ID *</Label>
                      <Input id="senderId" placeholder="UNIS-SENDER" value={formData.senderId} onChange={e => setFormData(p => ({ ...p, senderId: e.target.value }))} className="font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senderQualifier">Qualifier *</Label>
                      <select id="senderQualifier" value={formData.senderQualifier} onChange={e => setFormData(p => ({ ...p, senderQualifier: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                        {AS2_QUALIFIER_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="receiverId">Receiver ID *</Label>
                      <Input id="receiverId" placeholder="PARTNER-RECEIVER" value={formData.receiverId} onChange={e => setFormData(p => ({ ...p, receiverId: e.target.value }))} className="font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receiverQualifier">Qualifier *</Label>
                      <select id="receiverQualifier" value={formData.receiverQualifier} onChange={e => setFormData(p => ({ ...p, receiverQualifier: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                        {AS2_QUALIFIER_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Encryption Certificate</Label>
                      <Input placeholder="partner-enc.cer" value={formData.encryptionCert} onChange={e => setFormData(p => ({ ...p, encryptionCert: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Signing Certificate</Label>
                      <Input placeholder="partner-sign.cer" value={formData.signingCert} onChange={e => setFormData(p => ({ ...p, signingCert: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}

              {formData.channelType === "SFTP" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SFTP Host *</Label>
                      <Input placeholder="sftp.partner.com" value={formData.sftpHost} onChange={e => setFormData(p => ({ ...p, sftpHost: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input placeholder="22" value={formData.sftpPort} onChange={e => setFormData(p => ({ ...p, sftpPort: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Username *</Label>
                    <Input placeholder="edi_user" value={formData.sftpUser} onChange={e => setFormData(p => ({ ...p, sftpUser: e.target.value }))} className="font-mono" />
                  </div>
                </div>
              )}

              {formData.channelType === "VAN" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>VAN Provider *</Label>
                      <select value={formData.vanProvider} onChange={e => setFormData(p => ({ ...p, vanProvider: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                        <option value="">Select provider...</option>
                        <option value="SPS Commerce">SPS Commerce</option>
                        <option value="OpenText">OpenText</option>
                        <option value="TrueCommerce">TrueCommerce</option>
                        <option value="Cleo">Cleo</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Network ID</Label>
                      <Input placeholder="NET-001" value={formData.vanNetworkId} onChange={e => setFormData(p => ({ ...p, vanNetworkId: e.target.value }))} className="font-mono" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && formData.integrationType === "api" && (
            <div className="space-y-4">
              <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
                <p className="text-sm text-violet-700">
                  An API token will be generated after partner creation. The partner can use this token to authenticate REST API requests.
                </p>
              </div>
              <div className="space-y-2">
                <Label>API Base URL</Label>
                <Input value={formData.apiBaseUrl} onChange={e => setFormData(p => ({ ...p, apiBaseUrl: e.target.value }))} placeholder="https://api.unis-edi.com/v1 (default)" />
                <p className="text-xs text-muted-foreground">Leave blank to use the default UNIS API endpoint</p>
              </div>
              <div className="space-y-2">
                <Label>Webhook URL (optional)</Label>
                <Input value={formData.apiWebhookUrl} onChange={e => setFormData(p => ({ ...p, apiWebhookUrl: e.target.value }))} placeholder="https://partner.com/webhooks/edi" />
                <p className="text-xs text-muted-foreground">UNIS will POST transaction status updates to this URL</p>
              </div>
            </div>
          )}

          {/* Step 4: Document Types */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select EDI document types to exchange with this partner.</p>
              <div className="grid grid-cols-2 gap-3">
                {documentTypeOptions.map(doc => (
                  <label
                    key={doc.value}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.documentTypes.includes(doc.value)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <input type="checkbox" checked={formData.documentTypes.includes(doc.value)} onChange={() => toggleDocType(doc.value)} className="w-4 h-4 rounded border-border" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{doc.value}</p>
                      <p className="text-xs text-muted-foreground">{doc.label}</p>
                    </div>
                  </label>
                ))}
              </div>
              {formData.documentTypes.length > 0 && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium text-foreground">Selected: {formData.documentTypes.join(", ")}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
                <h4 className="font-semibold text-foreground">Partner Info</h4>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium text-foreground">{formData.name}</span>
                  <span className="text-muted-foreground">Code:</span>
                  <span className="font-mono text-foreground">{formData.code}</span>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="text-foreground capitalize">{formData.type}</span>
                  <span className="text-muted-foreground">Tier:</span>
                  <span className="text-foreground capitalize">{formData.tier}</span>
                  <span className="text-muted-foreground">Email:</span>
                  <span className="text-foreground">{formData.email}</span>
                </div>
              </div>

              <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
                <h4 className="font-semibold text-foreground">Integration Path</h4>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    formData.integrationType === "api" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                  }`}>
                    {formData.integrationType === "api" ? "API / REST" : `EDI / ${formData.channelType}`}
                  </span>
                </div>
                {formData.integrationType === "edi" && formData.channelType === "AS2" && (
                  <div className="grid grid-cols-2 gap-y-2 text-sm mt-2">
                    <span className="text-muted-foreground">AS2 ID:</span>
                    <span className="font-mono text-foreground">{formData.as2Id}</span>
                    <span className="text-muted-foreground">Endpoint:</span>
                    <span className="text-foreground truncate">{formData.as2Url}</span>
                    <span className="text-muted-foreground">Port:</span>
                    <span className="font-mono text-foreground">{formData.as2Port}</span>
                    <span className="text-muted-foreground">Sender ID:</span>
                    <span className="font-mono text-foreground">{formData.senderId} ({formData.senderQualifier})</span>
                    <span className="text-muted-foreground">Receiver ID:</span>
                    <span className="font-mono text-foreground">{formData.receiverId} ({formData.receiverQualifier})</span>
                  </div>
                )}
                {formData.integrationType === "api" && (
                  <div className="grid grid-cols-2 gap-y-2 text-sm mt-2">
                    <span className="text-muted-foreground">Base URL:</span>
                    <span className="text-foreground">{formData.apiBaseUrl || "Default"}</span>
                    <span className="text-muted-foreground">Webhook:</span>
                    <span className="text-foreground">{formData.apiWebhookUrl || "Not configured"}</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
                <h4 className="font-semibold text-foreground">Document Types ({formData.documentTypes.length})</h4>
                <div className="flex flex-wrap gap-1.5">
                  {formData.documentTypes.map(doc => (
                    <span key={doc} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">{doc}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 border-t border-border p-6 bg-card">
          <Button variant="outline" className="bg-transparent" onClick={() => step > 1 ? setStep(step - 1) : onClose()}>
            {step > 1 ? "Back" : "Cancel"}
          </Button>
          <div className="flex gap-2">
            {step < 5 ? (
              <Button className="bg-primary hover:bg-primary/90" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                Continue
              </Button>
            ) : (
              <Button className="bg-primary hover:bg-primary/90" onClick={handleSubmit} disabled={saving}>
                {saving ? "Creating…" : "Create Partner"}
              </Button>
            )}
          </div>
        </div>
        {error && (
          <div className="px-6 pb-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}
      </Card>
    </div>
  )
}
