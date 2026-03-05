"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"

interface MessageSpec {
  code: string
  name: string
  version: string
  category: string
  description: string
  lastUpdated: string
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

export default function SpecificationsTab() {
  const [activeSection, setActiveSection] = useState<"unis" | "tp">("unis")
  const [searchTerm, setSearchTerm] = useState("")
  const [tpSearchTerm, setTpSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedTPFilter, setSelectedTPFilter] = useState("all")
  const [unisSpecifications, setUnisSpecifications] = useState<MessageSpec[]>([])
  const [tpSpecifications, setTpSpecifications] = useState<TPSpecification[]>([])

  useEffect(() => {
    Promise.all([apiClient.getSpecifications({ section: "unis" }), apiClient.getSpecifications({ section: "tp" })]).then(([unis, tp]) => {
      if (unis.success && Array.isArray(unis.data)) setUnisSpecifications(unis.data as MessageSpec[])
      if (tp.success && Array.isArray(tp.data)) setTpSpecifications(tp.data as TPSpecification[])
    })
  }, [])

  const categories = useMemo(() => {
    const set = new Set(unisSpecifications.map((s) => String(s.category || "general").toLowerCase()))
    return ["all", ...Array.from(set)]
  }, [unisSpecifications])

  const tradingPartners = useMemo(() => {
    return ["all", ...Array.from(new Set(tpSpecifications.map((x) => x.partner))).sort()]
  }, [tpSpecifications])

  const filteredUnisSpecs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return unisSpecifications.filter((spec) => {
      const c = String(spec.category || "").toLowerCase()
      const matchesCategory = selectedCategory === "all" || c === selectedCategory
      if (!matchesCategory) return false
      if (!q) return true
      return (
        spec.code.toLowerCase().includes(q) ||
        spec.name.toLowerCase().includes(q) ||
        spec.description.toLowerCase().includes(q)
      )
    })
  }, [unisSpecifications, searchTerm, selectedCategory])

  const filteredTPSpecs = useMemo(() => {
    const q = tpSearchTerm.trim().toLowerCase()
    return tpSpecifications.filter((spec) => {
      const partnerMatch = selectedTPFilter === "all" || spec.partner === selectedTPFilter
      if (!partnerMatch) return false
      if (!q) return true
      return (
        spec.messageType.toLowerCase().includes(q) ||
        spec.messageName.toLowerCase().includes(q) ||
        spec.partner.toLowerCase().includes(q) ||
        spec.fileName.toLowerCase().includes(q)
      )
    })
  }, [tpSpecifications, tpSearchTerm, selectedTPFilter])

  const downloadTp = (specId: string) => {
    window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/v1/specifications/${specId}/download`, "_blank")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Message Specifications</h2>
        <p className="text-muted-foreground">All records are loaded from database via /v1/specifications</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setActiveSection("unis")} className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px ${activeSection === "unis" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          UNIS Standard Specifications
        </button>
        <button onClick={() => setActiveSection("tp")} className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px ${activeSection === "tp" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Trading Partner Specifications
        </button>
      </div>

      {activeSection === "unis" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Input placeholder="Search by message code, name, or description" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <p className="text-sm text-muted-foreground">Showing {filteredUnisSpecs.length} of {unisSpecifications.length}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUnisSpecs.map((spec) => (
              <Card key={spec.code} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl font-bold text-primary">{spec.code}</span>
                  <span className="text-xs rounded bg-secondary px-2 py-1">{spec.category}</span>
                </div>
                <p className="font-medium text-foreground">{spec.name}</p>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{spec.description}</p>
                <div className="text-xs text-muted-foreground mt-3">Version {spec.version} | Updated {spec.lastUpdated}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeSection === "tp" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Input placeholder="Search by message type, partner, or file name" value={tpSearchTerm} onChange={(e) => setTpSearchTerm(e.target.value)} />
              <select value={selectedTPFilter} onChange={(e) => setSelectedTPFilter(e.target.value)} className="px-4 py-2 rounded-md border border-input bg-background text-sm">
                {tradingPartners.map((p) => (
                  <option key={p} value={p}>{p === "all" ? "All Partners" : p}</option>
                ))}
              </select>
            </div>
          </Card>

          <p className="text-sm text-muted-foreground">Showing {filteredTPSpecs.length} of {tpSpecifications.length}</p>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Message</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Partner</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Version</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">File</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Uploaded</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTPSpecs.map((spec) => (
                    <tr key={spec.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3"><span className="font-semibold text-primary">{spec.messageType}</span> <span className="text-sm text-muted-foreground">{spec.messageName}</span></td>
                      <td className="px-4 py-3"><p className="font-medium text-foreground">{spec.partner}</p><p className="text-xs text-muted-foreground">{spec.partnerCode}</p></td>
                      <td className="px-4 py-3 text-sm text-foreground">{spec.version}</td>
                      <td className="px-4 py-3"><p className="text-sm text-foreground">{spec.fileName}</p><p className="text-xs text-muted-foreground">{spec.fileType} | {spec.size}</p></td>
                      <td className="px-4 py-3"><p className="text-sm text-foreground">{spec.uploadedDate}</p><p className="text-xs text-muted-foreground">by {spec.uploadedBy}</p></td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" className="bg-transparent" onClick={() => downloadTp(spec.id)}>Download</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
