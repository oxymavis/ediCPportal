"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import CertificateModal from "../modals/certificate-modal"
import UNISCertificatesSection from "../unis-certificates-section"

interface Certificate {
  id: number
  name: string
  serialNumber: string
  fingerprint: string
  expires: string
  usage: string
  status: string
  issuer: string
  subject: string
  algorithm: string
  keySize: string
  created: string
  type: string
  partner: string
  environment: "production" | "sandbox"
}

export default function CertificatesTab() {
  const [environment, setEnvironment] = useState<"production" | "sandbox">("production")
  const [certificates] = useState<Certificate[]>([
    // Production Certificates
    {
      id: 1,
      name: "Walmart US - Encryption",
      partner: "Walmart",
      serialNumber: "7A:8B:C1:D2:E3:F4:05:16:27:38:49:5A:6B:7C:8D:9E",
      fingerprint: "3F:E2:4A:78:9B:C1:D5:E8:4F:2A:6B:9C:D3:E1:F5:A2",
      expires: "2025-12-15",
      usage: "Encryption",
      status: "active",
      issuer: "DigiCert Inc",
      subject: "CN=walmart-us.edi.example.com",
      algorithm: "SHA256RSA",
      keySize: "2048",
      created: "2023-12-15",
      type: "X.509",
      environment: "production",
    },
    {
      id: 2,
      name: "Target Stores - AS2",
      partner: "Target",
      serialNumber: "1F:2E:3D:4C:5B:6A:79:88:97:A6:B5:C4:D3:E2:F1:00",
      fingerprint: "7C:E1:9F:A2:B8:D4:C6:3E:9A:F1:7B:2C:E8:D5:4A:1F",
      expires: "2024-03-20",
      usage: "AS2 Communication",
      status: "expiring",
      issuer: "Sectigo",
      subject: "CN=target-as2.edi.example.com",
      algorithm: "SHA256RSA",
      keySize: "2048",
      created: "2022-03-20",
      type: "X.509",
      environment: "production",
    },
    {
      id: 3,
      name: "Amazon VC - Signing",
      partner: "Amazon",
      serialNumber: "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89",
      fingerprint: "2A:D8:5F:C1:E7:9B:4D:A3:F2:B6:8C:E1:3F:A5:7D:9E",
      expires: "2026-06-10",
      usage: "Signing",
      status: "active",
      issuer: "Internal CA",
      subject: "CN=amazon-vc.edi.example.com",
      algorithm: "SHA256RSA",
      keySize: "4096",
      created: "2024-01-15",
      type: "X.509",
      environment: "production",
    },
    {
      id: 4,
      name: "SPS Commerce - SSL",
      partner: "SPS Commerce",
      serialNumber: "DE:AD:BE:EF:CA:FE:BA:BE:12:34:56:78:9A:BC:DE:F0",
      fingerprint: "9C:A2:B1:D8:E5:F4:3A:C2:7D:9E:1F:8B:4C:6D:2A:5E",
      expires: "2024-02-28",
      usage: "SSL",
      status: "expired",
      issuer: "GlobalSign",
      subject: "CN=sps.as2.example.com",
      algorithm: "SHA384RSA",
      keySize: "2048",
      created: "2023-02-28",
      type: "PKCS#12",
      environment: "production",
    },
    {
      id: 5,
      name: "Costco - Encryption",
      partner: "Costco",
      serialNumber: "01:02:03:04:05:06:07:08:09:0A:0B:0C:0D:0E:0F:10",
      fingerprint: "5E:A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F",
      expires: "2025-08-20",
      usage: "Encryption",
      status: "active",
      issuer: "Entrust",
      subject: "CN=costco-edi.example.com",
      algorithm: "SHA256RSA",
      keySize: "4096",
      created: "2024-08-20",
      type: "X.509",
      environment: "production",
    },
    {
      id: 6,
      name: "UNIS Server Certificate",
      partner: "UNIS (Self)",
      serialNumber: "11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00",
      fingerprint: "1A:2B:3C:4D:5E:6F:7A:8B:9C:AD:BE:CF:D0:E1:F2:03",
      expires: "2026-01-01",
      usage: "Server Auth",
      status: "active",
      issuer: "UNIS Internal CA",
      subject: "CN=api.unis.example.com",
      algorithm: "SHA256RSA",
      keySize: "4096",
      created: "2024-01-01",
      type: "X.509",
      environment: "production",
    },
    // Sandbox Certificates
    {
      id: 101,
      name: "Test Partner A - Encryption",
      partner: "Test Partner A",
      serialNumber: "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
      fingerprint: "TEST:FP:01:02:03:04:05:06:07:08:09:0A:0B:0C:0D:0E",
      expires: "2025-12-31",
      usage: "Encryption",
      status: "active",
      issuer: "Test CA",
      subject: "CN=test-a.sandbox.example.com",
      algorithm: "SHA256RSA",
      keySize: "2048",
      created: "2024-01-01",
      type: "X.509",
      environment: "sandbox",
    },
    {
      id: 102,
      name: "Sandbox AS2 Certificate",
      partner: "Sandbox Environment",
      serialNumber: "BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA",
      fingerprint: "SAND:FP:01:02:03:04:05:06:07:08:09:0A:0B:0C:0D:0E",
      expires: "2025-06-30",
      usage: "AS2 Communication",
      status: "active",
      issuer: "Test CA",
      subject: "CN=sandbox-as2.example.com",
      algorithm: "SHA256RSA",
      keySize: "2048",
      created: "2024-01-01",
      type: "X.509",
      environment: "sandbox",
    },
    {
      id: 103,
      name: "UNIS Sandbox Server Cert",
      partner: "UNIS (Self)",
      serialNumber: "CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB",
      fingerprint: "UNIS:SB:01:02:03:04:05:06:07:08:09:0A:0B:0C:0D:0E",
      expires: "2025-12-31",
      usage: "Server Auth",
      status: "active",
      issuer: "UNIS Test CA",
      subject: "CN=sandbox-api.unis.example.com",
      algorithm: "SHA256RSA",
      keySize: "2048",
      created: "2024-01-01",
      type: "X.509",
      environment: "sandbox",
    },
  ])

  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [usageFilter, setUsageFilter] = useState("all")
  const [expiryFilter, setExpiryFilter] = useState("all")

  const getStatusColor = (status: string) => {
    switch (status) {
      case "expired":
        return "bg-red-50 text-red-700 border-red-200"
      case "expiring":
        return "bg-orange-50 text-orange-700 border-orange-200"
      default:
        return "bg-green-50 text-green-700 border-green-200"
    }
  }

  const getStatusLabel = (status: string, daysLeft: number) => {
    switch (status) {
      case "expired":
        return "Expired"
      case "expiring":
        return `Expires in ${daysLeft} days`
      default:
        return "Active"
    }
  }

  const getDaysUntilExpiry = (expiryDate: string) => {
    const exp = new Date(expiryDate)
    const today = new Date()
    const diff = exp.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  // Filter certificates
  const filteredCertificates = useMemo(() => {
    return certificates.filter((cert) => {
      // Environment filter
      if (cert.environment !== environment) return false

      // Search filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        searchTerm === "" ||
        cert.name.toLowerCase().includes(searchLower) ||
        cert.serialNumber.toLowerCase().includes(searchLower) ||
        cert.fingerprint.toLowerCase().includes(searchLower) ||
        cert.issuer.toLowerCase().includes(searchLower) ||
        cert.subject.toLowerCase().includes(searchLower) ||
        cert.partner.toLowerCase().includes(searchLower)

      // Status filter
      const matchesStatus = statusFilter === "all" || cert.status === statusFilter

      // Usage filter
      const matchesUsage = usageFilter === "all" || cert.usage === usageFilter

      // Expiry filter
      const daysLeft = getDaysUntilExpiry(cert.expires)
      let matchesExpiry = true
      if (expiryFilter === "30days") {
        matchesExpiry = daysLeft <= 30 && daysLeft > 0
      } else if (expiryFilter === "90days") {
        matchesExpiry = daysLeft <= 90 && daysLeft > 0
      } else if (expiryFilter === "expired") {
        matchesExpiry = daysLeft <= 0
      }

      return matchesSearch && matchesStatus && matchesUsage && matchesExpiry
    })
  }, [certificates, searchTerm, statusFilter, usageFilter, expiryFilter, environment])

  const handleUpload = async () => {
    setIsUploading(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsUploading(false)
    setShowUploadModal(false)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setUsageFilter("all")
    setExpiryFilter("all")
  }

  const usageOptions = [...new Set(certificates.filter(c => c.environment === environment).map((c) => c.usage))]

  // UNIS certificates for download
  const unisCertificates = filteredCertificates.filter(c => c.partner === "UNIS (Self)")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Certificates</h2>
          <p className="text-muted-foreground">Manage SSL/TLS certificates for secure communication</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Environment Toggle */}
          <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
            <button
              onClick={() => setEnvironment("production")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                environment === "production"
                  ? "bg-green-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Production
            </button>
            <button
              onClick={() => setEnvironment("sandbox")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                environment === "sandbox"
                  ? "bg-amber-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sandbox
            </button>
          </div>
          <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setShowUploadModal(true)}>
            Upload Certificate
          </Button>
        </div>
      </div>

      {/* Environment Indicator */}
      <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
        environment === "production" 
          ? "bg-green-50 text-green-700 border border-green-200" 
          : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}>
        Currently viewing: <span className="font-bold uppercase">{environment}</span> environment certificates
      </div>

      {/* UNIS Certificates Download Section */}
      <UNISCertificatesSection environment={environment} />

      {/* Search and Filter Section */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* Search Bar */}
          <div>
            <Input
              type="text"
              placeholder="Search by name, partner, serial number, fingerprint, issuer or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Usage:</label>
              <select
                value={usageFilter}
                onChange={(e) => setUsageFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">All Usage</option>
                {usageOptions.map((usage) => (
                  <option key={usage} value={usage}>
                    {usage}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Expiry:</label>
              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">All Certificates</option>
                <option value="30days">Expires in 30 days</option>
                <option value="90days">Expires in 90 days</option>
                <option value="expired">Already Expired</option>
              </select>
            </div>

            <Button variant="outline" size="sm" onClick={clearFilters} className="bg-transparent">
              Clear Filters
            </Button>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredCertificates.length} of {certificates.filter(c => c.environment === environment).length} certificates
          </div>
        </div>
      </Card>

      {/* Upload Modal */}
      {showUploadModal && (
        <Card className="p-6 bg-secondary/20 border-2 border-dashed border-primary/30 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground">Upload New Certificate</h3>
          </div>

          {/* Environment Selection for Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Target Environment *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="uploadEnv"
                  value="production"
                  defaultChecked={environment === "production"}
                  className="w-4 h-4 accent-green-600"
                />
                <span className="px-3 py-1 rounded text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                  Production
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="uploadEnv"
                  value="sandbox"
                  defaultChecked={environment === "sandbox"}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="px-3 py-1 rounded text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Sandbox
                </span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Select the environment where this certificate will be used
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Certificate File *</label>
            <Input type="file" accept=".pem,.cer,.crt,.pfx,.p12" disabled={isUploading} className="cursor-pointer" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Certificate Name *</label>
            <Input type="text" placeholder="e.g., Walmart US - Encryption" disabled={isUploading} />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Trading Partner *</label>
            <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
              <option value="">Select partner</option>
              <option value="walmart">Walmart</option>
              <option value="target">Target</option>
              <option value="amazon">Amazon</option>
              <option value="sps">SPS Commerce</option>
              <option value="costco">Costco</option>
              <option value="unis">UNIS (Self)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Usage Purpose *</label>
              <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                <option value="">Select usage</option>
                <option value="Encryption">Encryption</option>
                <option value="Signing">Signing</option>
                <option value="Server Auth">Server Auth</option>
                <option value="AS2 Communication">AS2 Communication</option>
                <option value="SSL">SSL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Certificate Type *</label>
              <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                <option value="X.509">X.509</option>
                <option value="PKCS#12">PKCS#12</option>
                <option value="PEM">PEM</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1 gap-2 bg-primary hover:bg-primary/90"
            >
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowUploadModal(false)}
              disabled={isUploading}
              className="flex-1 bg-transparent"
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Certificates List */}
      <div className="space-y-3">
        {filteredCertificates.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No certificates found matching your criteria.</p>
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          </Card>
        ) : (
          filteredCertificates.map((cert) => {
            const daysLeft = getDaysUntilExpiry(cert.expires)
            return (
              <Card
                key={cert.id}
                className="p-6 border border-border hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg text-foreground">{cert.name}</h3>
                        {cert.partner === "UNIS (Self)" && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                            UNIS
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Partner: <span className="font-semibold text-foreground">{cert.partner}</span>
                      </p>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-mono">
                          <span className="text-foreground font-semibold">SN:</span> {cert.serialNumber}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          <span className="text-foreground font-semibold">Fingerprint:</span> {cert.fingerprint}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold border whitespace-nowrap ${getStatusColor(cert.status)}`}
                    >
                      {getStatusLabel(cert.status, daysLeft)}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm border-t border-border pt-4">
                    <div>
                      <p className="text-muted-foreground mb-1">Issuer</p>
                      <p className="font-medium text-foreground">{cert.issuer}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground mb-1">Subject</p>
                      <p className="font-mono text-foreground text-xs truncate" title={cert.subject}>
                        {cert.subject}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground mb-1">Algorithm</p>
                      <p className="font-medium text-foreground">{cert.algorithm}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground mb-1">Key Size</p>
                      <p className="font-medium text-foreground">{cert.keySize} bits</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground mb-1">Type</p>
                      <p className="font-medium text-foreground">{cert.type}</p>
                    </div>
                  </div>

                  {/* Dates Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-border pt-4">
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium text-foreground">{cert.created}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Expires</p>
                      <p className="font-medium text-foreground">{cert.expires}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Usage</p>
                      <p className="font-medium text-foreground">{cert.usage}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Days Remaining</p>
                      <p className={`font-medium ${daysLeft <= 0 ? "text-red-600" : daysLeft <= 30 ? "text-orange-600" : "text-foreground"}`}>
                        {daysLeft <= 0 ? "Expired" : `${daysLeft} days`}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-transparent"
                      onClick={() => setSelectedCert(cert)}
                    >
                      View Details
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                      Download
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                      Inactive
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Certificate Details Modal */}
      {selectedCert && <CertificateModal cert={selectedCert} onClose={() => setSelectedCert(null)} />}
    </div>
  )
}
