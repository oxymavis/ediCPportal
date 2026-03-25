"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import MessageRoutingModal from "./message-routing-modal"
import PartnerSpecificationsTab from "../partner-specifications-tab"
import { apiClient } from "@/lib/api-client"

const AS2_QUALIFIER_OPTIONS = [...Array.from({ length: 33 }, (_, i) => String(i + 1).padStart(2, "0")), "ZZ"]

interface AS2Profile {
  id: string
  name: string
  as2Id: string
  url: string
  as2Port?: number
  senderId?: string
  senderQualifier?: string
  receiverId?: string
  receiverQualifier?: string
  encryptionCert?: string
  signingCert?: string
  status: "active" | "inactive"
}

function formatAs2Route(profile: AS2Profile) {
  const port = profile.as2Port ? `:${profile.as2Port}` : ""
  return `${profile.senderQualifier || "ZZ"}:${profile.senderId || "-"} -> ${profile.receiverQualifier || "ZZ"}:${profile.receiverId || "-"}${port}`
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

interface TradingPartner {
  id: string
  name: string
  code: string
  type: "platform" | "retailer" | "van" | "3pl" | "manufacturer"
  tier: "enterprise" | "standard" | "basic"
  email: string
  status: "active" | "inactive"
  subsidiaries: Subsidiary[]
  as2Profiles: AS2Profile[]
  documentTypes: string[]
  lastSync: string
  transactionCount: number
}

interface CertificateLite {
  id: number
  name: string
  partner: string
}

export default function PartnerDetailModal({
  partner,
  subsidiary,
  onClose,
  onSaved,
}: {
  partner: TradingPartner
  subsidiary?: Subsidiary | null
  onClose: () => void
  onSaved?: (partner: any) => void
}) {
  const [activeTab, setActiveTab] = useState(subsidiary ? "subsidiary" : "overview")
  const [selectedAS2Profile, setSelectedAS2Profile] = useState<AS2Profile | null>(null)
  const [copied, setCopied] = useState(false)
  const [showMessageRouting, setShowMessageRouting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingAs2, setEditingAs2] = useState(false)
  const [as2Saving, setAs2Saving] = useState(false)
  const [as2Error, setAs2Error] = useState<string | null>(null)
  const [showUploadCertificate, setShowUploadCertificate] = useState(false)
  const [uploadingCertificate, setUploadingCertificate] = useState(false)
  const [uploadCertificateError, setUploadCertificateError] = useState<string | null>(null)
  const [uploadCertificateName, setUploadCertificateName] = useState("")
  const [uploadCertificateUsage, setUploadCertificateUsage] = useState("")
  const [uploadCertificateType, setUploadCertificateType] = useState("X.509")
  const [uploadCertificateEnv, setUploadCertificateEnv] = useState<"production" | "sandbox">("production")
  const [uploadCertificateFile, setUploadCertificateFile] = useState<File | null>(null)
  const [uploadCertificateRawContent, setUploadCertificateRawContent] = useState("")
  const [certs, setCerts] = useState<CertificateLite[]>([])
  const [form, setForm] = useState({
    name: partner.name,
    email: partner.email,
    status: partner.status as "active" | "inactive",
    type: partner.type,
    tier: partner.tier,
  })
  const [as2Form, setAs2Form] = useState({
    name: "",
    as2Url: "",
    as2Port: "443",
    senderId: "",
    senderQualifier: "ZZ",
    receiverId: "",
    receiverQualifier: "ZZ",
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      platform: "Platform",
      retailer: "Retailer",
      van: "VAN Provider",
      "3pl": "3PL",
      manufacturer: "Manufacturer"
    }
    return labels[type] || type
  }

  // Get all AS2 profiles across subsidiaries or direct profiles
  const getAllAS2Profiles = () => {
    if (subsidiary) {
      return subsidiary.as2Profiles
    }
    if (partner.subsidiaries.length > 0) {
      return partner.subsidiaries.flatMap(s => s.as2Profiles)
    }
    return partner.as2Profiles
  }

  useEffect(() => {
    setForm({
      name: partner.name,
      email: partner.email,
      status: partner.status,
      type: partner.type,
      tier: partner.tier,
    })
    setEditing(false)
    setSaveError(null)
  }, [partner])

  useEffect(() => {
    if (!selectedAS2Profile) {
      setEditingAs2(false)
      setAs2Error(null)
      return
    }
    setEditingAs2(false)
    setAs2Error(null)
    setAs2Form({
      name: selectedAS2Profile.name,
      as2Url: selectedAS2Profile.url,
      as2Port: String(selectedAS2Profile.as2Port || 443),
      senderId: selectedAS2Profile.senderId || "",
      senderQualifier: selectedAS2Profile.senderQualifier || "ZZ",
      receiverId: selectedAS2Profile.receiverId || "",
      receiverQualifier: selectedAS2Profile.receiverQualifier || "ZZ",
    })
  }, [selectedAS2Profile])

  useEffect(() => {
    apiClient.getCertificates().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setCerts((res.data as any[]).map((x) => ({ id: x.id, name: String(x.name || ""), partner: String(x.partner || "") })))
      }
    })
  }, [])

  const findCertificateId = (label?: string) => {
    if (!label) return null
    const needle = label.trim().toLowerCase()
    const found = certs.find((c) => {
      const n = c.name.toLowerCase()
      return n === needle || n.includes(needle) || needle.includes(n)
    })
    return found?.id ?? null
  }

  const savePartner = async () => {
    if (subsidiary) return
    setSaving(true)
    setSaveError(null)
    const res = await apiClient.updatePartner(partner.id, {
      name: form.name.trim(),
      status: form.status,
      primaryContact: { name: form.name.trim(), email: form.email.trim() },
      industry: form.type,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setSaveError(res.error || "Failed to save partner")
      return
    }
    setEditing(false)
    onSaved?.(res.data)
  }

  const getProfileOwnerSubsidiaryId = (profileId: string) => {
    return partner.subsidiaries.find((sub) => sub.as2Profiles.some((profile) => profile.id === profileId))?.id || ""
  }

  const saveAs2Profile = async () => {
    if (!selectedAS2Profile) return
    const subsidiaryId = getProfileOwnerSubsidiaryId(selectedAS2Profile.id)
    if (!subsidiaryId) {
      setAs2Error("Unable to locate subsidiary for this AS2 profile")
      return
    }
    setAs2Saving(true)
    setAs2Error(null)
    const res = await apiClient.updateAs2Profile(partner.id, subsidiaryId, selectedAS2Profile.id, {
      name: as2Form.name.trim(),
      as2Url: as2Form.as2Url.trim(),
      as2Port: Number(as2Form.as2Port),
      senderId: as2Form.senderId.trim(),
      senderQualifier: as2Form.senderQualifier,
      receiverId: as2Form.receiverId.trim(),
      receiverQualifier: as2Form.receiverQualifier,
    })
    setAs2Saving(false)
    if (!res.success || !res.data) {
      setAs2Error(res.error || "Failed to save AS2 profile")
      return
    }
    const fresh = await apiClient.getPartner(partner.id)
    if (fresh.success && fresh.data) {
      onSaved?.(fresh.data)
      const updatedProfile = (fresh.data.subsidiaries || [])
        .flatMap((sub: any) => sub.as2Profiles || [])
        .find((profile: any) => profile.id === selectedAS2Profile.id)
      if (updatedProfile) {
        setSelectedAS2Profile({
          id: updatedProfile.id,
          name: updatedProfile.name,
          as2Id: updatedProfile.as2Id,
          url: updatedProfile.as2Url ?? updatedProfile.url ?? "",
          as2Port: updatedProfile.as2Port,
          senderId: updatedProfile.senderId,
          senderQualifier: updatedProfile.senderQualifier,
          receiverId: updatedProfile.receiverId,
          receiverQualifier: updatedProfile.receiverQualifier,
          encryptionCert: updatedProfile.encryptionCert,
          signingCert: updatedProfile.signingCert,
          status: updatedProfile.status,
        })
      }
    }
    setEditingAs2(false)
  }

  const openCertificateUpload = (usage: string, suggestedName?: string) => {
    setUploadCertificateError(null)
    setUploadCertificateUsage(usage)
    setUploadCertificateName(suggestedName || `${partner.name} - ${usage}`)
    setUploadCertificateType("X.509")
    setUploadCertificateEnv("production")
    setUploadCertificateFile(null)
    setUploadCertificateRawContent("")
    setShowUploadCertificate(true)
  }

  const handleUploadCertificate = async () => {
    if ((!uploadCertificateFile && !uploadCertificateRawContent.trim()) || !uploadCertificateName.trim() || !uploadCertificateUsage.trim()) {
      setUploadCertificateError("Please fill certificate name, usage and provide a file or raw certificate content.")
      return
    }
    setUploadCertificateError(null)
    setUploadingCertificate(true)
    const res = await apiClient.uploadCertificate({
      file: uploadCertificateFile,
      rawContent: uploadCertificateRawContent.trim() || undefined,
      name: uploadCertificateName.trim(),
      partner: partner.name,
      usage: uploadCertificateUsage.trim(),
      type: uploadCertificateType,
      environment: uploadCertificateEnv,
    })
    setUploadingCertificate(false)
    if (!res.success || !res.data) {
      setUploadCertificateError(res.error || "Upload failed")
      return
    }
    setCerts((prev) => [...prev, { id: res.data.id, name: String(res.data.name || ""), partner: String(res.data.partner || "") }])
    setShowUploadCertificate(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-card shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">
                {subsidiary ? subsidiary.name : partner.name}
              </h2>
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">
                {subsidiary ? subsidiary.code : partner.code}
              </span>
              {!subsidiary && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {getTypeLabel(partner.type)}
                </span>
              )}
            </div>
            {subsidiary && (
              <p className="text-sm text-muted-foreground mt-1">
                Parent: {partner.name} ({partner.code})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!subsidiary && activeTab === "overview" && !editing && (
              <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setEditing(true)}>
                Edit Partner
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
            >
              X
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 px-6 pt-4 border-b border-border bg-card shrink-0">
          {!subsidiary && (
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === "overview"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
          )}
          {subsidiary && (
            <button
              onClick={() => setActiveTab("subsidiary")}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === "subsidiary"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Subsidiary Details
            </button>
          )}
          <button
            onClick={() => setActiveTab("as2")}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === "as2"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            AS2 Profiles ({getAllAS2Profiles().length})
          </button>
          <button
            onClick={() => setActiveTab("certificates")}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === "certificates"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Certificates
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === "documents"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Document Types
          </button>
          <button
            onClick={() => setActiveTab("specifications")}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === "specifications"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Specifications
          </button>
          {subsidiary && (
            <button
              onClick={() => setActiveTab("routing")}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === "routing"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Message Routing
            </button>
          )}
          {!subsidiary && partner.subsidiaries.length > 0 && (
            <button
              onClick={() => setActiveTab("subsidiaries")}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === "subsidiaries"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Subsidiaries ({partner.subsidiaries.length})
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview Tab */}
          {activeTab === "overview" && !subsidiary && (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-4">Partner Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Partner Name</label>
                      <Input
                        type="text"
                        value={form.name}
                        disabled={!editing}
                        className={editing ? "" : "bg-secondary/30"}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Partner Code</label>
                      <Input type="text" value={partner.code} disabled className="bg-secondary/30 font-mono" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Email</label>
                      <Input
                        type="email"
                        value={form.email}
                        disabled={!editing}
                        className={editing ? "" : "bg-secondary/30"}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Type</label>
                        <Input type="text" value={getTypeLabel(form.type)} disabled className="bg-secondary/30" />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Tier</label>
                        <Input type="text" value={form.tier} disabled className="bg-secondary/30 capitalize" />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-4">Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 border border-border">
                      <p className="text-sm text-muted-foreground">Total Transactions</p>
                      <p className="text-2xl font-bold text-foreground">{partner.transactionCount.toLocaleString()}</p>
                    </Card>
                    <Card className="p-4 border border-border">
                      <p className="text-sm text-muted-foreground">Subsidiaries</p>
                      <p className="text-2xl font-bold text-foreground">{partner.subsidiaries.length}</p>
                    </Card>
                    <Card className="p-4 border border-border">
                      <p className="text-sm text-muted-foreground">AS2 Profiles</p>
                      <p className="text-2xl font-bold text-foreground">{getAllAS2Profiles().length}</p>
                    </Card>
                    <Card className="p-4 border border-border">
                      <p className="text-sm text-muted-foreground">Last Sync</p>
                      <p className="text-sm font-mono text-foreground">{partner.lastSync}</p>
                    </Card>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-semibold text-foreground mb-3">Status</h4>
                    <div className="flex items-center gap-3">
                      {editing ? (
                        <select
                          value={form.status}
                          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as "active" | "inactive" }))}
                          className="px-3 py-2 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      ) : (
                        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                          form.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {form.status === "active" ? "Active" : "Inactive"}
                        </span>
                      )}
                    </div>
                    {saveError && <p className="text-xs text-destructive mt-2">{saveError}</p>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Subsidiary Details Tab */}
          {activeTab === "subsidiary" && subsidiary && (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-4">Subsidiary Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Subsidiary Name</label>
                      <Input type="text" value={subsidiary.name} disabled className="bg-secondary/30" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Subsidiary Code</label>
                      <Input type="text" value={subsidiary.code} disabled className="bg-secondary/30 font-mono" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Region</label>
                      <Input type="text" value={subsidiary.region} disabled className="bg-secondary/30" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Status</label>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          subsidiary.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {subsidiary.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-4">Parent Partner</h3>
                  <Card className="p-4 border border-border bg-secondary/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold">{partner.code.substring(0, 2)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{partner.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{partner.code}</p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Type: {getTypeLabel(partner.type)}</p>
                      <p>Tier: {partner.tier}</p>
                      <p>Total Subsidiaries: {partner.subsidiaries.length}</p>
                    </div>
                  </Card>

                  <h3 className="font-semibold text-lg text-foreground mb-4 mt-6">Quick Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 border border-border">
                      <p className="text-sm text-muted-foreground">AS2 Profiles</p>
                      <p className="text-2xl font-bold text-foreground">{subsidiary.as2Profiles.length}</p>
                    </Card>
                    <Card className="p-4 border border-border">
                      <p className="text-sm text-muted-foreground">Document Types</p>
                      <p className="text-2xl font-bold text-foreground">{subsidiary.documentTypes.length}</p>
                    </Card>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* AS2 Profiles Tab */}
          {activeTab === "as2" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-foreground">
                  AS2 Connection Profiles
                </h3>
                <Button className="gap-2 bg-primary hover:bg-primary/90">+ Add AS2 Profile</Button>
              </div>

              {selectedAS2Profile ? (
                // AS2 Profile Detail View
                <Card className="border border-border">
                  <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedAS2Profile(null)}
                        className="p-2 hover:bg-secondary rounded-lg transition-colors"
                      >
                        &lt;-
                      </button>
                      <div>
                        <h4 className="font-semibold text-foreground">{selectedAS2Profile.name}</h4>
                        <p className="text-sm font-mono text-muted-foreground">{selectedAS2Profile.as2Id}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedAS2Profile.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    }`}>
                      {selectedAS2Profile.status}
                    </span>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">AS2 Identifier</label>
                        <div className="flex gap-2">
                          <Input type="text" value={selectedAS2Profile.as2Id} disabled className="bg-secondary/30 font-mono" />
                          <Button variant="outline" size="sm" className="bg-transparent" onClick={() => copyToClipboard(selectedAS2Profile.as2Id)}>
                            {copied ? "Copied" : "Copy"}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Profile Name</label>
                        <Input
                          type="text"
                          value={as2Form.name}
                          disabled={!editingAs2}
                          className={editingAs2 ? "" : "bg-secondary/30"}
                          onChange={(e) => setAs2Form((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">AS2 URL Endpoint</label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={as2Form.as2Url}
                          disabled={!editingAs2}
                          className={`${editingAs2 ? "" : "bg-secondary/30"} font-mono text-sm`}
                          onChange={(e) => setAs2Form((prev) => ({ ...prev, as2Url: e.target.value }))}
                        />
                        <Button variant="outline" size="sm" className="bg-transparent" onClick={() => copyToClipboard(selectedAS2Profile.url)}>
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Port</label>
                        <Input
                          type="text"
                          value={as2Form.as2Port}
                          disabled={!editingAs2}
                          className={`${editingAs2 ? "" : "bg-secondary/30"} font-mono`}
                          onChange={(e) => setAs2Form((prev) => ({ ...prev, as2Port: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Sender ID</label>
                        <Input
                          type="text"
                          value={as2Form.senderId}
                          disabled={!editingAs2}
                          className={`${editingAs2 ? "" : "bg-secondary/30"} font-mono`}
                          onChange={(e) => setAs2Form((prev) => ({ ...prev, senderId: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Sender Qualifier</label>
                        {editingAs2 ? (
                          <select
                            value={as2Form.senderQualifier}
                            onChange={(e) => setAs2Form((prev) => ({ ...prev, senderQualifier: e.target.value }))}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                          >
                            {AS2_QUALIFIER_OPTIONS.map((q) => (
                              <option key={q} value={q}>{q}</option>
                            ))}
                          </select>
                        ) : (
                          <Input type="text" value={as2Form.senderQualifier || "-"} disabled className="bg-secondary/30 font-mono" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Receiver ID</label>
                        <Input
                          type="text"
                          value={as2Form.receiverId}
                          disabled={!editingAs2}
                          className={`${editingAs2 ? "" : "bg-secondary/30"} font-mono`}
                          onChange={(e) => setAs2Form((prev) => ({ ...prev, receiverId: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Receiver Qualifier</label>
                        {editingAs2 ? (
                          <select
                            value={as2Form.receiverQualifier}
                            onChange={(e) => setAs2Form((prev) => ({ ...prev, receiverQualifier: e.target.value }))}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                          >
                            {AS2_QUALIFIER_OPTIONS.map((q) => (
                              <option key={q} value={q}>{q}</option>
                            ))}
                          </select>
                        ) : (
                          <Input type="text" value={as2Form.receiverQualifier || "-"} disabled className="bg-secondary/30 font-mono" />
                        )}
                      </div>
                    </div>
                    {as2Error && <p className="text-sm text-destructive">{as2Error}</p>}

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Encryption Certificate</label>
                        <div className="flex items-center gap-2">
                          <Input type="text" value={selectedAS2Profile.encryptionCert || "Not configured"} disabled className="bg-secondary/30 font-mono text-sm" />
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                            onClick={() => openCertificateUpload("Encryption", `${selectedAS2Profile.name} - Encryption`)}
                          >
                            Upload
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Signing Certificate</label>
                        <div className="flex items-center gap-2">
                          <Input type="text" value={selectedAS2Profile.signingCert || "Not configured"} disabled className="bg-secondary/30 font-mono text-sm" />
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                            onClick={() => openCertificateUpload("Signing", `${selectedAS2Profile.name} - Signing`)}
                          >
                            Upload
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-foreground mb-2">Connection Settings</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">MDN Request</p>
                          <p className="font-medium text-foreground">Synchronous</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Encryption Algorithm</p>
                          <p className="font-medium text-foreground">3DES</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Signature Algorithm</p>
                          <p className="font-medium text-foreground">SHA-256</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Compression</p>
                          <p className="font-medium text-foreground">Enabled</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Retry Count</p>
                          <p className="font-medium text-foreground">3</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Timeout (sec)</p>
                          <p className="font-medium text-foreground">30</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {editingAs2 ? (
                        <>
                          <Button className="bg-primary hover:bg-primary/90" onClick={saveAs2Profile} disabled={as2Saving}>
                            {as2Saving ? "Saving..." : "Save AS2 Config"}
                          </Button>
                          <Button
                            variant="outline"
                            className="bg-transparent"
                            onClick={() => {
                              setEditingAs2(false)
                              setAs2Error(null)
                              setAs2Form({
                                name: selectedAS2Profile.name,
                                as2Url: selectedAS2Profile.url,
                                as2Port: String(selectedAS2Profile.as2Port || 443),
                                senderId: selectedAS2Profile.senderId || "",
                                senderQualifier: selectedAS2Profile.senderQualifier || "ZZ",
                                receiverId: selectedAS2Profile.receiverId || "",
                                receiverQualifier: selectedAS2Profile.receiverQualifier || "ZZ",
                              })
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" className="bg-transparent" onClick={() => setEditingAs2(true)}>
                          Edit AS2 Config
                        </Button>
                      )}
                      <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Test Connection</Button>
                      <Button variant="outline" className="bg-transparent">View Logs</Button>
                      <Button variant="outline" className="text-amber-600 hover:bg-amber-50 bg-transparent">Inactive Profile</Button>
                    </div>
                  </div>
                </Card>
              ) : (
                // AS2 Profiles List
                <div className="space-y-3">
                  {getAllAS2Profiles().map((profile) => {
                    // Find which subsidiary this profile belongs to
                    const belongsTo = partner.subsidiaries.find(s => 
                      s.as2Profiles.some(p => p.id === profile.id)
                    )
                    
                    return (
                      <Card 
                        key={profile.id} 
                        className="p-4 border border-border hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedAS2Profile(profile)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-bold text-sm">AS2</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-foreground">{profile.name}</h4>
                                {belongsTo && (
                                  <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded text-xs">
                                    {belongsTo.code}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-mono text-muted-foreground">{profile.as2Id}</p>
                              <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">{profile.url}</p>
                              <p className="text-xs font-mono text-muted-foreground mt-2">{formatAs2Route(profile)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              profile.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                            }`}>
                              {profile.status}
                            </span>
                            <Button variant="outline" size="sm" className="bg-transparent">Configure</Button>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Certificates Tab */}
          {activeTab === "certificates" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-foreground">Certificates</h3>
                <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => openCertificateUpload("AS2 Communication", `${partner.name} - AS2 Communication`)}>
                  + Upload Certificate
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 border border-border">
                  <h4 className="font-semibold text-foreground mb-3">Encryption Certificates</h4>
                  <div className="space-y-3">
                    {getAllAS2Profiles().filter(p => p.encryptionCert).map((profile) => (
                      <div key={`enc-${profile.id}`} className="p-3 bg-secondary/30 rounded-lg border border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground text-sm">{profile.encryptionCert}</p>
                            <p className="text-xs text-muted-foreground">Used by: {profile.name}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                            disabled={!findCertificateId(profile.encryptionCert)}
                            onClick={async () => {
                              const certId = findCertificateId(profile.encryptionCert)
                              if (!certId) return
                              await apiClient.downloadCertificate(certId)
                            }}
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-4 border border-border">
                  <h4 className="font-semibold text-foreground mb-3">Signing Certificates</h4>
                  <div className="space-y-3">
                    {getAllAS2Profiles().filter(p => p.signingCert).map((profile) => (
                      <div key={`sign-${profile.id}`} className="p-3 bg-secondary/30 rounded-lg border border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground text-sm">{profile.signingCert}</p>
                            <p className="text-xs text-muted-foreground">Used by: {profile.name}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                            disabled={!findCertificateId(profile.signingCert)}
                            onClick={async () => {
                              const certId = findCertificateId(profile.signingCert)
                              if (!certId) return
                              await apiClient.downloadCertificate(certId)
                            }}
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Document Types Tab */}
          {activeTab === "documents" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-foreground">Supported Document Types</h3>
                <Button className="gap-2 bg-primary hover:bg-primary/90">+ Add Document Type</Button>
              </div>

              {subsidiary ? (
                // Single subsidiary document types
                <Card className="p-4 border border-border">
                  <h4 className="font-semibold text-foreground mb-3">{subsidiary.name}</h4>
                  <div className="flex flex-wrap gap-2">
                    {subsidiary.documentTypes.map((doc) => (
                      <div key={doc} className="px-4 py-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
                        <span className="font-semibold">{doc}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : partner.subsidiaries.length > 0 ? (
                // Document types grouped by subsidiary
                <div className="space-y-4">
                  {partner.subsidiaries.map((sub) => (
                    <Card key={sub.id} className="p-4 border border-border">
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="font-semibold text-foreground">{sub.name}</h4>
                        <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded text-xs font-mono">
                          {sub.code}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                          {sub.region}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sub.documentTypes.map((doc) => (
                          <div key={doc} className="px-3 py-1.5 bg-primary/10 text-primary rounded border border-primary/20">
                            <span className="font-semibold text-sm">{doc}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                // Direct partner document types
                <Card className="p-4 border border-border">
                  <div className="flex flex-wrap gap-2">
                    {partner.documentTypes.map((doc) => (
                      <div key={doc} className="px-4 py-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
                        <span className="font-semibold">{doc}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Subsidiaries Tab */}
          {activeTab === "subsidiaries" && !subsidiary && partner.subsidiaries.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-foreground">Subsidiaries</h3>
                <Button className="gap-2 bg-primary hover:bg-primary/90">+ Add Subsidiary</Button>
              </div>

              <div className="space-y-3">
                {partner.subsidiaries.map((sub) => (
                  <Card key={sub.id} className="p-4 border border-border hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-bold">{sub.code.split("-")[1]?.substring(0, 2) || sub.code.substring(0, 2)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground">{sub.name}</h4>
                            <span className="px-2 py-0.5 bg-secondary text-muted-foreground rounded text-xs font-mono">
                              {sub.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>{sub.region}</span>
                            <span>|</span>
                            <span>{sub.as2Profiles.length} AS2 Profile(s)</span>
                            <span>|</span>
                            <span>{sub.documentTypes.length} Document Types</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          sub.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {sub.status}
                        </span>
                        <Button variant="outline" size="sm" className="bg-transparent">Configure</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Partner Specifications Tab */}
          {activeTab === "specifications" && (
            <PartnerSpecificationsTab 
              partnerName={subsidiary ? subsidiary.name : partner.name}
              partnerCode={subsidiary ? subsidiary.code : partner.code}
            />
          )}

          {/* Message Routing Tab - Only for Subsidiaries */}
          {activeTab === "routing" && subsidiary && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-foreground mb-2">Message Routing Configuration for {subsidiary.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Configure which message types this subsidiary ({subsidiary.code}) can process and define routing rules for outbound messages. 
                  For example, you can route 856 ASN documents to specific retail partners like Walmart or Target, 
                  or return them to the original inbound trading partner.
                </p>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-foreground">Message Type & Routing Rules</h3>
                <Button 
                  onClick={() => setShowMessageRouting(true)}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  Configure Message Routing
                </Button>
              </div>

              <Card className="p-4 border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  Routing details are loaded and edited through the configuration modal backed by
                  <span className="font-mono"> /v1/partners/{'{partnerId}'}/subsidiaries/{'{subsidiaryId}'}/routing</span>.
                </p>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border p-6 bg-card shrink-0">
          {!subsidiary && (
            editing ? (
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={savePartner} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => setEditing(true)}>
                Edit Partner
              </Button>
            )
          )}
          <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>

      {/* Message Routing Modal */}
      {showMessageRouting && (
        <MessageRoutingModal
          partnerId={partner.id}
          subsidiaryId={(subsidiary ? subsidiary.id : partner.subsidiaries[0]?.id) || ""}
          partnerName={subsidiary ? subsidiary.name : partner.name}
          partnerCode={subsidiary ? subsidiary.code : partner.code}
          onClose={() => setShowMessageRouting(false)}
        />
      )}

      {showUploadCertificate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-xl space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Upload Certificate</h3>
              <button
                type="button"
                onClick={() => setShowUploadCertificate(false)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                X
              </button>
            </div>

            {uploadCertificateError && <p className="text-sm text-destructive">{uploadCertificateError}</p>}

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Certificate File *</label>
              <Input type="file" accept=".pem,.cer,.crt,.cert,.pfx,.p12" disabled={uploadingCertificate} onChange={(e) => setUploadCertificateFile(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Certificate PEM / Base64 Content</label>
              <textarea
                value={uploadCertificateRawContent}
                onChange={(e) => setUploadCertificateRawContent(e.target.value)}
                disabled={uploadingCertificate}
                placeholder="-----BEGIN CERTIFICATE-----&#10;MIID...&#10;-----END CERTIFICATE-----"
                className="min-h-40 w-full rounded-md border border-input bg-background p-3 text-xs font-mono"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Certificate Name *</label>
              <Input value={uploadCertificateName} disabled={uploadingCertificate} onChange={(e) => setUploadCertificateName(e.target.value)} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Partner</label>
              <Input value={partner.name} disabled className="bg-secondary/30" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Usage *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={uploadCertificateUsage}
                  onChange={(e) => setUploadCertificateUsage(e.target.value)}
                  disabled={uploadingCertificate}
                >
                  <option value="">Select usage</option>
                  <option value="Encryption">Encryption</option>
                  <option value="Signing">Signing</option>
                  <option value="Server Auth">Server Auth</option>
                  <option value="AS2 Communication">AS2 Communication</option>
                  <option value="SSL">SSL</option>
                  <option value="Root CA">Root CA</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Certificate Type *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={uploadCertificateType}
                  onChange={(e) => setUploadCertificateType(e.target.value)}
                  disabled={uploadingCertificate}
                >
                  <option value="X.509">X.509</option>
                  <option value="PKCS#12">PKCS#12</option>
                  <option value="PEM">PEM</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Environment *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={uploadCertificateEnv === "production"} onChange={() => setUploadCertificateEnv("production")} />
                  <span>Production</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={uploadCertificateEnv === "sandbox"} onChange={() => setUploadCertificateEnv("sandbox")} />
                  <span>Sandbox</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" className="bg-transparent" onClick={() => setShowUploadCertificate(false)} disabled={uploadingCertificate}>
                Cancel
              </Button>
              <Button onClick={handleUploadCertificate} disabled={uploadingCertificate}>
                {uploadingCertificate ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
