"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"

interface PartnerSpecificationsTabProps {
  partnerName: string
  partnerCode: string
}

interface TPSpecification {
  id: string
  messageType: string
  messageName: string
  partner: string
  partnerCode: string
  version: string
  uploadedDate: string
  uploadedBy: string
  fileType: string
  fileName: string
  size: string
  status?: string
}

export default function PartnerSpecificationsTab({ partnerName, partnerCode }: PartnerSpecificationsTabProps) {
  const [rows, setRows] = useState<TPSpecification[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    apiClient.getSpecifications({ section: "tp" }).then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setRows(res.data as TPSpecification[])
      }
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const partnerMatch = r.partner === partnerName || r.partnerCode === partnerCode
      if (!partnerMatch) return false
      if (!q) return true
      return (
        r.messageType.toLowerCase().includes(q) ||
        r.messageName.toLowerCase().includes(q) ||
        r.fileName.toLowerCase().includes(q)
      )
    })
  }, [rows, search, partnerName, partnerCode])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg text-foreground">Partner Specifications</h3>
          <p className="text-sm text-muted-foreground">Source: /v1/specifications (database)</p>
        </div>
      </div>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search message type / file name" className="max-w-md" />

      {filtered.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No specification records for this partner in database.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((spec) => (
            <Card key={spec.id} className="p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{spec.messageType} - {spec.messageName}</p>
                  <p className="text-sm text-muted-foreground">{spec.fileName} | {spec.fileType} | {spec.size}</p>
                  <p className="text-xs text-muted-foreground">Version {spec.version} | Uploaded {spec.uploadedDate} by {spec.uploadedBy}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/v1/specifications/${spec.id}/download`, "_blank")}
                >
                  Download
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
