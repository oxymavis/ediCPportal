"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Specification {
  id: string
  messageType: string
  messageName: string
  version: string
  lastUpdated: string
  updatedBy: string
  status: "current" | "draft" | "archived"
  files: {
    type: "pdf" | "excel" | "json" | "xml" | "x12"
    name: string
    size: string
  }[]
}

interface PartnerSpecificationsTabProps {
  partnerName: string
  partnerCode: string
}

export default function PartnerSpecificationsTab({ partnerName, partnerCode }: PartnerSpecificationsTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedSpec, setSelectedSpec] = useState<Specification | null>(null)
  const [uploadMessageType, setUploadMessageType] = useState("")

  // Sample specifications data for this partner
  const [specifications] = useState<Specification[]>([
    {
      id: "spec-850",
      messageType: "850",
      messageName: "Purchase Order",
      version: "v2.3",
      lastUpdated: "2024-01-15",
      updatedBy: "John Smith",
      status: "current",
      files: [
        { type: "pdf", name: `${partnerCode}_850_Implementation_Guide.pdf`, size: "2.4 MB" },
        { type: "excel", name: `${partnerCode}_850_Segment_Directory.xlsx`, size: "156 KB" },
        { type: "x12", name: `${partnerCode}_850_Sample.edi`, size: "4.2 KB" },
      ]
    },
    {
      id: "spec-855",
      messageType: "855",
      messageName: "Purchase Order Acknowledgment",
      version: "v2.1",
      lastUpdated: "2024-01-10",
      updatedBy: "Jane Doe",
      status: "current",
      files: [
        { type: "pdf", name: `${partnerCode}_855_Implementation_Guide.pdf`, size: "1.8 MB" },
        { type: "excel", name: `${partnerCode}_855_Segment_Directory.xlsx`, size: "128 KB" },
      ]
    },
    {
      id: "spec-856",
      messageType: "856",
      messageName: "Advance Ship Notice",
      version: "v3.0",
      lastUpdated: "2024-02-01",
      updatedBy: "Mike Johnson",
      status: "current",
      files: [
        { type: "pdf", name: `${partnerCode}_856_Implementation_Guide.pdf`, size: "3.1 MB" },
        { type: "excel", name: `${partnerCode}_856_Segment_Directory.xlsx`, size: "245 KB" },
        { type: "x12", name: `${partnerCode}_856_Sample.edi`, size: "8.7 KB" },
        { type: "json", name: `${partnerCode}_856_Schema.json`, size: "12 KB" },
      ]
    },
    {
      id: "spec-810",
      messageType: "810",
      messageName: "Invoice",
      version: "v2.5",
      lastUpdated: "2024-01-20",
      updatedBy: "Sarah Wilson",
      status: "current",
      files: [
        { type: "pdf", name: `${partnerCode}_810_Implementation_Guide.pdf`, size: "2.2 MB" },
        { type: "excel", name: `${partnerCode}_810_Segment_Directory.xlsx`, size: "189 KB" },
      ]
    },
    {
      id: "spec-940",
      messageType: "940",
      messageName: "Warehouse Shipping Order",
      version: "v1.8",
      lastUpdated: "2023-12-15",
      updatedBy: "Tom Brown",
      status: "current",
      files: [
        { type: "pdf", name: `${partnerCode}_940_Implementation_Guide.pdf`, size: "1.9 MB" },
        { type: "x12", name: `${partnerCode}_940_Sample.edi`, size: "3.5 KB" },
      ]
    },
    {
      id: "spec-997",
      messageType: "997",
      messageName: "Functional Acknowledgment",
      version: "v1.0",
      lastUpdated: "2023-11-01",
      updatedBy: "Admin",
      status: "current",
      files: [
        { type: "pdf", name: `${partnerCode}_997_Implementation_Guide.pdf`, size: "890 KB" },
      ]
    },
  ])

  const messageTypes = [
    { code: "204", name: "Motor Carrier Load Tender" },
    { code: "210", name: "Freight Invoice" },
    { code: "214", name: "Shipment Status" },
    { code: "810", name: "Invoice" },
    { code: "832", name: "Price/Sales Catalog" },
    { code: "846", name: "Inventory Inquiry/Advice" },
    { code: "850", name: "Purchase Order" },
    { code: "855", name: "Purchase Order Ack" },
    { code: "856", name: "Advance Ship Notice" },
    { code: "940", name: "Warehouse Shipping Order" },
    { code: "943", name: "Warehouse Stock Transfer" },
    { code: "944", name: "Warehouse Stock Receipt" },
    { code: "945", name: "Warehouse Shipping Advice" },
    { code: "947", name: "Warehouse Inventory Adj" },
    { code: "997", name: "Functional Acknowledgment" },
  ]

  const filteredSpecs = specifications.filter(spec =>
    spec.messageType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    spec.messageName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getFileIcon = (type: string) => {
    switch (type) {
      case "pdf": return "PDF"
      case "excel": return "XLS"
      case "json": return "JSON"
      case "xml": return "XML"
      case "x12": return "X12"
      default: return "FILE"
    }
  }

  const getFileColor = (type: string) => {
    switch (type) {
      case "pdf": return "bg-red-100 text-red-700"
      case "excel": return "bg-green-100 text-green-700"
      case "json": return "bg-amber-100 text-amber-700"
      case "xml": return "bg-blue-100 text-blue-700"
      case "x12": return "bg-purple-100 text-purple-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg text-foreground">Message Specifications</h3>
          <p className="text-sm text-muted-foreground">
            Upload, update and download EDI specifications for {partnerName}
          </p>
        </div>
        <Button 
          className="gap-2 bg-primary hover:bg-primary/90"
          onClick={() => setShowUploadModal(true)}
        >
          + Upload Specification
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          type="text"
          placeholder="Search by message type or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
        <span className="text-sm text-muted-foreground self-center">
          {filteredSpecs.length} specifications found
        </span>
      </div>

      {/* Specifications List */}
      <div className="space-y-4">
        {filteredSpecs.map((spec) => (
          <Card key={spec.id} className="border border-border overflow-hidden">
            <div 
              className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
              onClick={() => setSelectedSpec(selectedSpec?.id === spec.id ? null : spec)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">{spec.messageType}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{spec.messageName}</h4>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {spec.version}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        spec.status === "current" ? "bg-green-100 text-green-700" :
                        spec.status === "draft" ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {spec.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Last updated: {spec.lastUpdated} by {spec.updatedBy}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{spec.files.length} files</span>
                  <span className="text-muted-foreground">{selectedSpec?.id === spec.id ? "^" : "v"}</span>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {selectedSpec?.id === spec.id && (
              <div className="border-t border-border bg-secondary/20 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="font-medium text-foreground">Available Files</h5>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                      Update Files
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                      Download All (ZIP)
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {spec.files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getFileColor(file.type)}`}>
                          {getFileIcon(file.type)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{file.size}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                          View
                        </Button>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Version History */}
                <div className="mt-4 pt-4 border-t border-border">
                  <h5 className="font-medium text-foreground mb-2">Version History</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{spec.version} (Current)</span>
                      <span>{spec.lastUpdated}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>v{(Number.parseFloat(spec.version.substring(1)) - 0.1).toFixed(1)}</span>
                      <span>2023-10-15</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>v{(Number.parseFloat(spec.version.substring(1)) - 0.2).toFixed(1)}</span>
                      <span>2023-08-01</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {filteredSpecs.length === 0 && (
        <Card className="p-8 text-center border border-border">
          <p className="text-muted-foreground mb-4">No specifications found for this partner.</p>
          <Button onClick={() => setShowUploadModal(true)}>Upload First Specification</Button>
        </Card>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <Card className="w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Upload Specification</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
              >
                X
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Message Type *</label>
              <select 
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                value={uploadMessageType}
                onChange={(e) => setUploadMessageType(e.target.value)}
              >
                <option value="">Select message type</option>
                {messageTypes.map(mt => (
                  <option key={mt.code} value={mt.code}>{mt.code} - {mt.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Version *</label>
              <Input type="text" placeholder="e.g., v2.0" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Upload Files *</label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Input type="file" multiple accept=".pdf,.xlsx,.xls,.json,.xml,.edi,.txt" className="cursor-pointer" />
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: PDF, Excel, JSON, XML, EDI/X12 files
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Notes (optional)</label>
              <textarea 
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm min-h-[80px]"
                placeholder="Add any notes about this version..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1 bg-primary hover:bg-primary/90">
                Upload
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 bg-transparent"
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
