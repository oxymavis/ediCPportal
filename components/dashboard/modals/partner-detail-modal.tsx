"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import MessageRoutingModal from "./message-routing-modal"
import PartnerSpecificationsTab from "../partner-specifications-tab"

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

export default function PartnerDetailModal({
  partner,
  subsidiary,
  onClose,
}: {
  partner: TradingPartner
  subsidiary?: Subsidiary | null
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState(subsidiary ? "subsidiary" : "overview")
  const [selectedAS2Profile, setSelectedAS2Profile] = useState<AS2Profile | null>(null)
  const [copied, setCopied] = useState(false)
  const [showMessageRouting, setShowMessageRouting] = useState(false)

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
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
          >
            X
          </button>
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
                      <Input type="text" value={partner.name} disabled className="bg-secondary/30" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Partner Code</label>
                      <Input type="text" value={partner.code} disabled className="bg-secondary/30 font-mono" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Email</label>
                      <Input type="email" value={partner.email} disabled className="bg-secondary/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Type</label>
                        <Input type="text" value={getTypeLabel(partner.type)} disabled className="bg-secondary/30" />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Tier</label>
                        <Input type="text" value={partner.tier} disabled className="bg-secondary/30 capitalize" />
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
                      <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                        partner.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}>
                        {partner.status === "active" ? "Active" : "Inactive"}
                      </span>
                      <Button variant="outline" size="sm" className="bg-transparent">
                        {partner.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
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
                        <Input type="text" value={selectedAS2Profile.name} disabled className="bg-secondary/30" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">AS2 URL Endpoint</label>
                      <div className="flex gap-2">
                        <Input type="text" value={selectedAS2Profile.url} disabled className="bg-secondary/30 font-mono text-sm" />
                        <Button variant="outline" size="sm" className="bg-transparent" onClick={() => copyToClipboard(selectedAS2Profile.url)}>
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Encryption Certificate</label>
                        <div className="flex items-center gap-2">
                          <Input type="text" value={selectedAS2Profile.encryptionCert || "Not configured"} disabled className="bg-secondary/30 font-mono text-sm" />
                          <Button variant="outline" size="sm" className="bg-transparent">Upload</Button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Signing Certificate</label>
                        <div className="flex items-center gap-2">
                          <Input type="text" value={selectedAS2Profile.signingCert || "Not configured"} disabled className="bg-secondary/30 font-mono text-sm" />
                          <Button variant="outline" size="sm" className="bg-transparent">Upload</Button>
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
                <Button className="gap-2 bg-primary hover:bg-primary/90">+ Upload Certificate</Button>
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
                          <Button variant="outline" size="sm" className="bg-transparent">Download</Button>
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
                          <Button variant="outline" size="sm" className="bg-transparent">Download</Button>
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

              {/* Quick Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="p-4 border border-border">
                  <p className="text-sm text-muted-foreground">Inbound Message Types</p>
                  <p className="text-2xl font-bold text-cyan-600">4</p>
                  <p className="text-xs text-muted-foreground mt-1">850, 940, 944, 210</p>
                </Card>
                <Card className="p-4 border border-border">
                  <p className="text-sm text-muted-foreground">Outbound Message Types</p>
                  <p className="text-2xl font-bold text-purple-600">5</p>
                  <p className="text-xs text-muted-foreground mt-1">856, 810, 855, 997, 945</p>
                </Card>
                <Card className="p-4 border border-border">
                  <p className="text-sm text-muted-foreground">Routing Rules</p>
                  <p className="text-2xl font-bold text-foreground">3</p>
                  <p className="text-xs text-muted-foreground mt-1">Active configurations</p>
                </Card>
              </div>

              {/* Sample Routing Rules */}
              <div className="space-y-3">
                <Card className="p-4 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">856</span>
                          <span className="text-foreground">Advance Ship Notice</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">Outbound</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Route to Walmart US for all fulfilled orders</p>
                      </div>
                    </div>
                    <div className="text-sm text-right">
                      <p className="text-muted-foreground">Target:</p>
                      <p className="font-medium text-foreground">Walmart / Walmart US</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">810</span>
                          <span className="text-foreground">Invoice</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">Outbound</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Return invoice to original PO sender</p>
                      </div>
                    </div>
                    <div className="text-sm text-right">
                      <p className="text-muted-foreground">Target:</p>
                      <p className="font-medium text-foreground">Return to Inbound TP</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">997</span>
                          <span className="text-foreground">Functional Ack</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">Outbound</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Send FA back to message sender</p>
                      </div>
                    </div>
                    <div className="text-sm text-right">
                      <p className="text-muted-foreground">Target:</p>
                      <p className="font-medium text-foreground">Return to Inbound TP</p>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border p-6 bg-card shrink-0">
          <Button className="flex-1 bg-primary hover:bg-primary/90">Save Changes</Button>
          <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>

      {/* Message Routing Modal */}
      {showMessageRouting && (
        <MessageRoutingModal
          partnerName={subsidiary ? subsidiary.name : partner.name}
          partnerCode={subsidiary ? subsidiary.code : partner.code}
          onClose={() => setShowMessageRouting(false)}
        />
      )}
    </div>
  )
}
