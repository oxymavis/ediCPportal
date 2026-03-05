"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import CertificateModal from "../modals/certificate-modal"
import UNISCertificatesSection from "../unis-certificates-section"
import { apiClient } from "@/lib/api-client"

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

interface PartnerItem {
  id: string
  name: string
}

export default function CertificatesTab() {
  const [environment, setEnvironment] = useState<"production" | "sandbox">("production")
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [partners, setPartners] = useState<PartnerItem[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadName, setUploadName] = useState("")
  const [uploadPartner, setUploadPartner] = useState("")
  const [uploadUsage, setUploadUsage] = useState("")
  const [uploadType, setUploadType] = useState("X.509")
  const [uploadEnv, setUploadEnv] = useState<"production" | "sandbox">("production")
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [usageFilter, setUsageFilter] = useState("all")
  const [expiryFilter, setExpiryFilter] = useState("all")

  useEffect(() => {
    Promise.all([apiClient.getCertificates(), apiClient.getPartners()]).then(([certs, ps]) => {
      if (certs.success && Array.isArray(certs.data)) setCertificates(certs.data as Certificate[])
      if (ps.success && Array.isArray(ps.data)) {
        setPartners((ps.data as any[]).map((p) => ({ id: String(p.id), name: String(p.name) })))
      }
      setLoading(false)
    })
  }, [])

  const getDaysUntilExpiry = (expiryDate: string) => {
    const exp = new Date(expiryDate)
    const today = new Date()
    const diff = exp.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const filteredCertificates = useMemo(() => {
    return certificates.filter((cert) => {
      if (cert.environment !== environment) return false
      const q = searchTerm.trim().toLowerCase()
      if (
        q &&
        !(
          cert.name.toLowerCase().includes(q) ||
          cert.serialNumber.toLowerCase().includes(q) ||
          cert.fingerprint.toLowerCase().includes(q) ||
          cert.issuer.toLowerCase().includes(q) ||
          cert.subject.toLowerCase().includes(q) ||
          cert.partner.toLowerCase().includes(q)
        )
      ) {
        return false
      }
      if (statusFilter !== "all" && cert.status !== statusFilter) return false
      if (usageFilter !== "all" && cert.usage !== usageFilter) return false

      const daysLeft = getDaysUntilExpiry(cert.expires)
      if (expiryFilter === "30days" && !(daysLeft <= 30 && daysLeft > 0)) return false
      if (expiryFilter === "90days" && !(daysLeft <= 90 && daysLeft > 0)) return false
      if (expiryFilter === "expired" && !(daysLeft <= 0)) return false
      return true
    })
  }, [certificates, environment, searchTerm, statusFilter, usageFilter, expiryFilter])

  const usageOptions = [...new Set(certificates.filter((c) => c.environment === environment).map((c) => c.usage))]

  const getStatusColor = (status: string) => {
    if (status === "expired") return "bg-red-50 text-red-700 border-red-200"
    if (status === "expiring") return "bg-orange-50 text-orange-700 border-orange-200"
    return "bg-green-50 text-green-700 border-green-200"
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim() || !uploadPartner.trim() || !uploadUsage.trim()) {
      setUploadError("Please fill name, partner, usage and select a file.")
      return
    }
    setUploadError(null)
    setIsUploading(true)
    const res = await apiClient.uploadCertificate({
      file: uploadFile,
      name: uploadName.trim(),
      partner: uploadPartner.trim(),
      usage: uploadUsage.trim(),
      type: uploadType,
      environment: uploadEnv,
    })
    setIsUploading(false)
    if (res.success && res.data) {
      setCertificates((prev) => [...prev, res.data as Certificate])
      setShowUploadModal(false)
      setUploadName("")
      setUploadPartner("")
      setUploadUsage("")
      setUploadFile(null)
      return
    }
    setUploadError(res.error || "Upload failed")
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setUsageFilter("all")
    setExpiryFilter("all")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Certificates</h2>
          <p className="text-muted-foreground">All records are loaded from database via /v1/certificates</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
            <button
              onClick={() => setEnvironment("production")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                environment === "production" ? "bg-green-600 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Production
            </button>
            <button
              onClick={() => setEnvironment("sandbox")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                environment === "sandbox" ? "bg-amber-500 text-white" : "text-muted-foreground hover:text-foreground"
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

      <UNISCertificatesSection environment={environment} certificates={certificates} />

      <Card className="p-4">
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Search by name, partner, serial number, fingerprint, issuer or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Status:</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Usage:</label>
              <select value={usageFilter} onChange={(e) => setUsageFilter(e.target.value)} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
                <option value="all">All Usage</option>
                {usageOptions.map((usage) => (
                  <option key={usage} value={usage}>{usage}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Expiry:</label>
              <select value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
                <option value="all">All Certificates</option>
                <option value="30days">Expires in 30 days</option>
                <option value="90days">Expires in 90 days</option>
                <option value="expired">Already Expired</option>
              </select>
            </div>

            <Button variant="outline" size="sm" onClick={clearFilters} className="bg-transparent">Clear Filters</Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredCertificates.length} of {certificates.filter((c) => c.environment === environment).length} certificates
          </div>
        </div>
      </Card>

      {showUploadModal && (
        <Card className="p-6 bg-secondary/20 border-2 border-dashed border-primary/30 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground">Upload New Certificate</h3>
          </div>
          {uploadError && <p className="text-sm text-destructive" role="alert">{uploadError}</p>}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Target Environment *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="uploadEnv" checked={uploadEnv === "production"} onChange={() => setUploadEnv("production")} className="w-4 h-4 accent-green-600" />
                <span className="px-3 py-1 rounded text-sm font-medium bg-green-50 text-green-700 border border-green-200">Production</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="uploadEnv" checked={uploadEnv === "sandbox"} onChange={() => setUploadEnv("sandbox")} className="w-4 h-4 accent-amber-500" />
                <span className="px-3 py-1 rounded text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">Sandbox</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Certificate File *</label>
            <Input type="file" accept=".pem,.cer,.crt,.pfx,.p12" disabled={isUploading} className="cursor-pointer" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Certificate Name *</label>
            <Input type="text" placeholder="e.g., Walmart US - Encryption" disabled={isUploading} value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Trading Partner *</label>
            <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" value={uploadPartner} onChange={(e) => setUploadPartner(e.target.value)} disabled={isUploading}>
              <option value="">Select partner</option>
              {partners.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
              <option value="UNIS (Self)">UNIS (Self)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Usage Purpose *</label>
              <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" value={uploadUsage} onChange={(e) => setUploadUsage(e.target.value)} disabled={isUploading}>
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
              <label className="block text-sm font-medium text-foreground mb-2">Certificate Type *</label>
              <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" value={uploadType} onChange={(e) => setUploadType(e.target.value)} disabled={isUploading}>
                <option value="X.509">X.509</option>
                <option value="PKCS#12">PKCS#12</option>
                <option value="PEM">PEM</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowUploadModal(false)} disabled={isUploading} className="bg-transparent">Cancel</Button>
            <Button onClick={handleUpload} disabled={isUploading}>{isUploading ? "Uploading..." : "Upload"}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading certificates...</Card>
      ) : filteredCertificates.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No certificate data in database for selected filters.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCertificates.map((cert) => {
            const daysLeft = getDaysUntilExpiry(cert.expires)
            return (
              <Card key={cert.id} className="p-4 hover:shadow-sm transition-all cursor-pointer" onClick={() => setSelectedCert(cert)}>
                <div className="flex items-start justify-between mb-3 gap-2">
                  <h3 className="font-semibold text-foreground leading-tight">{cert.name}</h3>
                  <span className={`px-2 py-0.5 rounded border text-xs font-semibold whitespace-nowrap ${getStatusColor(cert.status)}`}>
                    {cert.status === "expiring" ? `Expiring (${daysLeft}d)` : cert.status}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Partner: <span className="text-foreground">{cert.partner}</span></p>
                  <p>Usage: <span className="text-foreground">{cert.usage}</span></p>
                  <p>Type: <span className="text-foreground">{cert.type}</span></p>
                  <p>Expires: <span className="text-foreground">{cert.expires}</span></p>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {selectedCert && <CertificateModal cert={selectedCert as any} onClose={() => setSelectedCert(null)} />}
    </div>
  )
}
