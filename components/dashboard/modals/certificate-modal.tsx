"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useState } from "react"
import { apiClient } from "@/lib/api-client"

export default function CertificateModal({ cert, onClose }: { cert: any; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(cert.fingerprint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyRawToClipboard = () => {
    if (!cert.rawContent) return
    navigator.clipboard.writeText(cert.rawContent)
    setCopiedRaw(true)
    setTimeout(() => setCopiedRaw(false), 2000)
  }

  const handleDownload = async () => {
    setDownloading(true)
    await apiClient.downloadCertificate(cert.id)
    setDownloading(false)
  }

  const handleDownloadRawContent = () => {
    if (!cert.rawContent) return
    const blob = new Blob([cert.rawContent], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${String(cert.name || "certificate").replace(/\s+/g, "_")}.b64.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-border bg-card">
          <h2 className="text-xl font-bold text-foreground">{cert.name}</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Fingerprint */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Certificate Fingerprint</h3>
            <div className="flex gap-2">
              <code className="flex-1 p-4 bg-secondary/50 rounded-lg text-xs font-mono text-foreground break-all">
                {cert.fingerprint}
              </code>
              <button
                onClick={copyToClipboard}
                className="p-3 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors text-lg"
                title="Copy"
              >
                📋
              </button>
            </div>
            {copied && <p className="text-xs text-accent mt-2">Copied to clipboard</p>}
          </div>

          {/* Certificate Details Grid */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Certificate Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Subject</p>
                <p className="font-mono text-sm text-foreground">{cert.subject}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Issuer</p>
                <p className="font-medium text-foreground">{cert.issuer}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Algorithm</p>
                <p className="font-medium text-foreground">{cert.algorithm}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Key Size</p>
                <p className="font-medium text-foreground">{cert.keySize} bits</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Created</p>
                <p className="font-medium text-foreground">{cert.created}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Expires</p>
                <p className="font-medium text-foreground">{cert.expires}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-1">Usage</p>
                <p className="font-medium text-foreground">{cert.usage}</p>
              </div>
            </div>
          </div>

          {/* Raw Certificate Data */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">Raw Certificate (Base64)</h3>
              {cert.rawContent && (
                <div className="flex gap-2">
                  <Button variant="outline" className="bg-transparent" onClick={copyRawToClipboard}>
                    {copiedRaw ? "Copied" : "Copy Base64"}
                  </Button>
                  <Button variant="outline" className="bg-transparent" onClick={handleDownloadRawContent}>
                    Download Base64
                  </Button>
                </div>
              )}
            </div>
            {cert.rawContent ? (
              <pre className="max-h-80 overflow-auto rounded-lg bg-secondary/50 p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                {cert.rawContent}
              </pre>
            ) : (
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Certificate binary is stored in backend storage. Click Download Certificate to view full PEM/DER content.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-border pt-6">
            <Button className="flex-1 gap-2 bg-primary hover:bg-primary/90" onClick={handleDownload} disabled={downloading}>
              {downloading ? "Downloading..." : "Download Certificate"}
            </Button>
            <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
