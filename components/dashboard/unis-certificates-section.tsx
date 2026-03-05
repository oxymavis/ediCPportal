"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface CertificateItem {
  id: number
  name: string
  serialNumber: string
  fingerprint: string
  usage: string
  type: string
  expires: string
  environment: "production" | "sandbox"
  partner: string
}

interface UNISCertificatesSectionProps {
  environment: "production" | "sandbox"
  certificates: CertificateItem[]
}

export default function UNISCertificatesSection({ environment, certificates }: UNISCertificatesSectionProps) {
  const [search, setSearch] = useState("")

  const unisCertificates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return certificates.filter((c) => {
      if (c.environment !== environment) return false
      if (!c.partner.toLowerCase().includes("unis")) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.serialNumber.toLowerCase().includes(q) ||
        c.fingerprint.toLowerCase().includes(q)
      )
    })
  }, [certificates, environment, search])

  const handleDownload = (cert: CertificateItem) => {
    window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/v1/certificates/${cert.id}/download`, "_blank")
  }

  return (
    <Card className="p-5 border border-border/80 bg-secondary/20">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">UNIS Certificates</h3>
            <p className="text-sm text-muted-foreground">Data source: database ({environment})</p>
          </div>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by certificate name / SN / fingerprint"
        />

        {unisCertificates.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">No UNIS certificates found in database.</div>
        ) : (
          <div className="space-y-2">
            {unisCertificates.map((cert) => (
              <div key={cert.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                <div>
                  <p className="font-medium text-foreground">{cert.name}</p>
                  <p className="text-xs text-muted-foreground">{cert.serialNumber} | {cert.usage} | expires {cert.expires}</p>
                </div>
                <Button size="sm" variant="outline" className="bg-transparent" onClick={() => handleDownload(cert)}>
                  Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
