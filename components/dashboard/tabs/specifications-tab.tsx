"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface MessageSpec {
  code: string
  name: string
  version: string
  category: string
  direction: "inbound" | "outbound" | "both"
  description: string
  segments: number
  lastUpdated: string
  formats: string[]
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
  environment: string
}

export default function SpecificationsTab() {
  const [activeSection, setActiveSection] = useState<"unis" | "tp">("unis")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedSpec, setSelectedSpec] = useState<MessageSpec | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [tpSearchTerm, setTpSearchTerm] = useState("")
  const [selectedTPFilter, setSelectedTPFilter] = useState("all")
  const [environment, setEnvironment] = useState("production")

  const categories = [
    { id: "all", label: "All" },
    { id: "order", label: "Order Management" },
    { id: "warehouse", label: "Warehouse" },
    { id: "shipping", label: "Shipping & Logistics" },
    { id: "financial", label: "Financial" },
    { id: "inventory", label: "Inventory" },
    { id: "acknowledgment", label: "Acknowledgment" },
  ]

  // UNIS Standard Specifications
  const unisSpecifications: MessageSpec[] = [
    { code: "850", name: "Purchase Order", version: "005010", category: "order", direction: "inbound", description: "Used to request the purchase of goods or services from a trading partner.", segments: 45, lastUpdated: "2024-01-15", formats: ["X12", "EDIFACT"] },
    { code: "855", name: "Purchase Order Acknowledgment", version: "005010", category: "order", direction: "outbound", description: "Confirms receipt and acceptance of a purchase order, may include changes.", segments: 38, lastUpdated: "2024-01-15", formats: ["X12", "EDIFACT"] },
    { code: "860", name: "Purchase Order Change Request", version: "005010", category: "order", direction: "both", description: "Used to request changes to a previously submitted purchase order.", segments: 42, lastUpdated: "2024-01-10", formats: ["X12"] },
    { code: "940", name: "Warehouse Shipping Order", version: "005010", category: "warehouse", direction: "inbound", description: "Instruction to a warehouse to ship goods to a specified location.", segments: 52, lastUpdated: "2024-02-01", formats: ["X12"] },
    { code: "943", name: "Warehouse Stock Transfer Shipment Advice", version: "005010", category: "warehouse", direction: "inbound", description: "Notification of goods being transferred between warehouse locations.", segments: 48, lastUpdated: "2024-02-01", formats: ["X12"] },
    { code: "944", name: "Warehouse Stock Transfer Receipt Advice", version: "005010", category: "warehouse", direction: "outbound", description: "Confirmation of goods received at warehouse from a transfer.", segments: 44, lastUpdated: "2024-02-01", formats: ["X12"] },
    { code: "945", name: "Warehouse Shipping Advice", version: "005010", category: "warehouse", direction: "outbound", description: "Notification from warehouse that goods have been shipped.", segments: 50, lastUpdated: "2024-02-01", formats: ["X12"] },
    { code: "947", name: "Warehouse Inventory Adjustment Advice", version: "005010", category: "warehouse", direction: "outbound", description: "Reports inventory adjustments due to damage, loss, or corrections.", segments: 32, lastUpdated: "2024-01-20", formats: ["X12"] },
    { code: "204", name: "Motor Carrier Load Tender", version: "005010", category: "shipping", direction: "outbound", description: "Request to a carrier to transport a shipment.", segments: 58, lastUpdated: "2024-01-25", formats: ["X12"] },
    { code: "210", name: "Motor Carrier Freight Details and Invoice", version: "005010", category: "shipping", direction: "inbound", description: "Freight invoice from carrier for transportation services.", segments: 62, lastUpdated: "2024-01-25", formats: ["X12"] },
    { code: "214", name: "Transportation Carrier Shipment Status", version: "005010", category: "shipping", direction: "inbound", description: "Real-time status updates on shipment location and delivery.", segments: 28, lastUpdated: "2024-01-25", formats: ["X12"] },
    { code: "856", name: "Ship Notice/Manifest (ASN)", version: "005010", category: "shipping", direction: "outbound", description: "Advance notification of shipment contents, packaging, and carrier details.", segments: 68, lastUpdated: "2024-02-05", formats: ["X12", "EDIFACT"] },
    { code: "810", name: "Invoice", version: "005010", category: "financial", direction: "outbound", description: "Commercial invoice requesting payment for goods or services delivered.", segments: 55, lastUpdated: "2024-01-30", formats: ["X12", "EDIFACT"] },
    { code: "820", name: "Payment Order/Remittance Advice", version: "005010", category: "financial", direction: "inbound", description: "Notification of payment and details of invoices being paid.", segments: 45, lastUpdated: "2024-01-30", formats: ["X12"] },
    { code: "846", name: "Inventory Inquiry/Advice", version: "005010", category: "inventory", direction: "both", description: "Report of current inventory levels or request for inventory information.", segments: 35, lastUpdated: "2024-01-18", formats: ["X12", "EDIFACT"] },
    { code: "832", name: "Price/Sales Catalog", version: "005010", category: "inventory", direction: "outbound", description: "Product catalog with pricing, descriptions, and availability.", segments: 72, lastUpdated: "2024-01-12", formats: ["X12"] },
    { code: "997", name: "Functional Acknowledgment", version: "005010", category: "acknowledgment", direction: "both", description: "Confirms receipt and syntactical correctness of an EDI transmission.", segments: 12, lastUpdated: "2024-01-05", formats: ["X12"] },
    { code: "999", name: "Implementation Acknowledgment", version: "005010", category: "acknowledgment", direction: "both", description: "Detailed acknowledgment including implementation-level errors.", segments: 18, lastUpdated: "2024-01-05", formats: ["X12"] },
  ]

  // Trading Partner uploaded specifications
  const [tpSpecifications] = useState<TPSpecification[]>([
    { id: "1", messageType: "850", messageName: "Purchase Order", partner: "Walmart US", partnerCode: "WMT-US", version: "5010-WMT-2024", uploadedDate: "2024-01-20", uploadedBy: "admin@walmart.com", fileType: "PDF", fileName: "WMT_850_Implementation_Guide_2024.pdf", size: "2.4 MB" },
    { id: "2", messageType: "856", messageName: "ASN", partner: "Walmart US", partnerCode: "WMT-US", version: "5010-WMT-2024", uploadedDate: "2024-01-20", uploadedBy: "admin@walmart.com", fileType: "PDF", fileName: "WMT_856_Implementation_Guide_2024.pdf", size: "3.1 MB" },
    { id: "3", messageType: "810", messageName: "Invoice", partner: "Walmart US", partnerCode: "WMT-US", version: "5010-WMT-2024", uploadedDate: "2024-01-20", uploadedBy: "admin@walmart.com", fileType: "PDF", fileName: "WMT_810_Implementation_Guide_2024.pdf", size: "1.8 MB" },
    { id: "4", messageType: "850", messageName: "Purchase Order", partner: "Target", partnerCode: "TGT", version: "5010-TGT-2024", uploadedDate: "2024-02-01", uploadedBy: "edi@target.com", fileType: "PDF", fileName: "TGT_850_Spec_v2024.pdf", size: "2.1 MB" },
    { id: "5", messageType: "856", messageName: "ASN", partner: "Target", partnerCode: "TGT", version: "5010-TGT-2024", uploadedDate: "2024-02-01", uploadedBy: "edi@target.com", fileType: "PDF", fileName: "TGT_856_Spec_v2024.pdf", size: "2.8 MB" },
    { id: "6", messageType: "940", messageName: "Warehouse Shipping Order", partner: "Amazon FBA", partnerCode: "AMZN-FBA", version: "5010-AMZN-2024", uploadedDate: "2024-01-15", uploadedBy: "fba-edi@amazon.com", fileType: "PDF", fileName: "AMZN_940_FBA_Guide.pdf", size: "4.2 MB" },
    { id: "7", messageType: "945", messageName: "Warehouse Shipping Advice", partner: "Amazon FBA", partnerCode: "AMZN-FBA", version: "5010-AMZN-2024", uploadedDate: "2024-01-15", uploadedBy: "fba-edi@amazon.com", fileType: "PDF", fileName: "AMZN_945_FBA_Guide.pdf", size: "3.5 MB" },
    { id: "8", messageType: "850", messageName: "Purchase Order", partner: "Costco", partnerCode: "COST", version: "5010-COST-2023", uploadedDate: "2023-12-10", uploadedBy: "edi@costco.com", fileType: "Excel", fileName: "COST_850_Segment_Directory.xlsx", size: "1.2 MB" },
    { id: "9", messageType: "997", messageName: "Functional Acknowledgment", partner: "SPS Commerce", partnerCode: "SPS", version: "5010-SPS-2024", uploadedDate: "2024-02-05", uploadedBy: "support@spscommerce.com", fileType: "PDF", fileName: "SPS_997_Implementation_Guide.pdf", size: "0.8 MB" },
    { id: "10", messageType: "214", messageName: "Shipment Status", partner: "Target", partnerCode: "TGT", version: "5010-TGT-2024", uploadedDate: "2024-01-25", uploadedBy: "edi@target.com", fileType: "PDF", fileName: "TGT_214_Tracking_Spec.pdf", size: "1.5 MB" },
  ])

  const tradingPartners = ["Walmart US", "Target", "Amazon FBA", "Costco", "SPS Commerce"]

  const filteredUnisSpecs = unisSpecifications.filter(spec => {
    const matchesSearch = 
      spec.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      spec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      spec.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || spec.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const filteredTPSpecs = useMemo(() => {
    return tpSpecifications.filter(spec => {
      const matchesSearch = 
        spec.messageType.toLowerCase().includes(tpSearchTerm.toLowerCase()) ||
        spec.messageName.toLowerCase().includes(tpSearchTerm.toLowerCase()) ||
        spec.partner.toLowerCase().includes(tpSearchTerm.toLowerCase()) ||
        spec.fileName.toLowerCase().includes(tpSearchTerm.toLowerCase())
      const matchesPartner = selectedTPFilter === "all" || spec.partner === selectedTPFilter
      return matchesSearch && matchesPartner
    })
  }, [tpSpecifications, tpSearchTerm, selectedTPFilter])

  const handleDownload = (spec: MessageSpec, format: string) => {
    alert(`Downloading UNIS ${spec.code} ${spec.name} specification in ${format} format...`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Message Specifications</h2>
          <p className="text-muted-foreground">
            View UNIS standard specifications or manage Trading Partner specific documents
          </p>
        </div>
      </div>

      {/* Section Toggle */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveSection("unis")}
          className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px ${
            activeSection === "unis"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          UNIS Standard Specifications
        </button>
        <button
          onClick={() => setActiveSection("tp")}
          className={`px-6 py-3 font-medium transition-colors border-b-2 -mb-px ${
            activeSection === "tp"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Trading Partner Specifications
        </button>
      </div>

      {/* UNIS Specifications Section */}
      {activeSection === "unis" && (
        <div className="space-y-6">
          <Card className="p-4 bg-blue-50/50 border-blue-200">
            <p className="text-sm text-blue-700">
              Download UNIS standard EDI message specifications. These are the baseline implementation guides that apply to all trading partners unless overridden by partner-specific specifications.
            </p>
          </Card>

          {/* Search and Filter */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by message code, name, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === cat.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <p className="text-sm text-muted-foreground">
            Showing {filteredUnisSpecs.length} of {unisSpecifications.length} UNIS specifications
          </p>

          {/* Specifications Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUnisSpecs.map((spec) => (
              <Card 
                key={spec.code} 
                className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedSpec(spec)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-bold text-primary">{spec.code}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        spec.direction === "inbound" 
                          ? "bg-cyan-100 text-cyan-700" 
                          : spec.direction === "outbound"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-700"
                      }`}>
                        {spec.direction}
                      </span>
                    </div>
                    <p className="font-medium text-foreground">{spec.name}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{spec.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Version: {spec.version}</span>
                  <span>{spec.segments} segments</span>
                </div>
                <div className="flex gap-1 mt-2">
                  {spec.formats.map((fmt) => (
                    <span key={fmt} className="px-2 py-0.5 rounded bg-secondary text-xs">
                      {fmt}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Trading Partner Specifications Section */}
      {activeSection === "tp" && (
        <div className="space-y-6">
          <Card className="p-4 bg-purple-50/50 border-purple-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-purple-700">
                Upload and manage Trading Partner specific specifications. These override UNIS standard specifications for specific partners.
              </p>
              <Button 
                onClick={() => setShowUploadModal(true)}
                className="bg-primary hover:bg-primary/90"
              >
                + Upload Specification
              </Button>
            </div>
          </Card>

          {/* Search and Filter for TP Specs */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by message type, partner, or file name..."
                  value={tpSearchTerm}
                  onChange={(e) => setTpSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <select
                  value={selectedTPFilter}
                  onChange={(e) => setSelectedTPFilter(e.target.value)}
                  className="px-4 py-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value="all">All Partners</option>
                  {tradingPartners.map(tp => (
                    <option key={tp} value={tp}>{tp}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <p className="text-sm text-muted-foreground">
            Showing {filteredTPSpecs.length} of {tpSpecifications.length} Trading Partner specifications
          </p>

          {/* TP Specifications Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Message Type</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Trading Partner</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Version</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">File</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Uploaded</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTPSpecs.map((spec) => (
                    <tr key={spec.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{spec.messageType}</span>
                          <span className="text-sm text-muted-foreground">{spec.messageName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{spec.partner}</p>
                          <p className="text-xs text-muted-foreground">{spec.partnerCode}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{spec.version}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-foreground">{spec.fileName}</p>
                          <p className="text-xs text-muted-foreground">{spec.fileType} - {spec.size}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-foreground">{spec.uploadedDate}</p>
                          <p className="text-xs text-muted-foreground">{spec.uploadedBy}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-transparent"
                            onClick={() => alert(`Downloading ${spec.fileName}...`)}
                          >
                            Download
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-transparent"
                            onClick={() => alert(`Update ${spec.fileName}...`)}
                          >
                            Update
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-transparent text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            Inactive
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredTPSpecs.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No specifications found for the selected filters.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* UNIS Spec Detail Modal */}
      {selectedSpec && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-bold text-primary">{selectedSpec.code}</span>
                  <span className="text-xl font-semibold text-foreground">{selectedSpec.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Version: {selectedSpec.version}</span>
                  <span>|</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    selectedSpec.direction === "inbound" 
                      ? "bg-cyan-100 text-cyan-700" 
                      : selectedSpec.direction === "outbound"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                  }`}>
                    {selectedSpec.direction}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedSpec(null)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                X
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Description</h3>
                <p className="text-muted-foreground">{selectedSpec.description}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Segments</p>
                  <p className="text-xl font-bold text-foreground">{selectedSpec.segments}</p>
                </Card>
                <Card className="p-4 bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="text-xl font-bold text-foreground">{selectedSpec.version}</p>
                </Card>
                <Card className="p-4 bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="text-xl font-bold text-foreground capitalize">{selectedSpec.category}</p>
                </Card>
                <Card className="p-4 bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Formats</p>
                  <p className="text-xl font-bold text-foreground">{selectedSpec.formats.join(", ")}</p>
                </Card>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-3">Download UNIS Specification</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="p-4 border border-border hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Implementation Guide (PDF)</p>
                        <p className="text-sm text-muted-foreground">Complete specification with examples</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-transparent"
                        onClick={() => handleDownload(selectedSpec, "PDF")}
                      >
                        Download
                      </Button>
                    </div>
                  </Card>
                  <Card className="p-4 border border-border hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Segment Directory (Excel)</p>
                        <p className="text-sm text-muted-foreground">All segments, elements, and codes</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-transparent"
                        onClick={() => handleDownload(selectedSpec, "Excel")}
                      >
                        Download
                      </Button>
                    </div>
                  </Card>
                  <Card className="p-4 border border-border hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Sample Message (X12)</p>
                        <p className="text-sm text-muted-foreground">Example EDI document</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-transparent"
                        onClick={() => handleDownload(selectedSpec, "X12")}
                      >
                        Download
                      </Button>
                    </div>
                  </Card>
                  <Card className="p-4 border border-border hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">JSON Schema</p>
                        <p className="text-sm text-muted-foreground">For API integration</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-transparent"
                        onClick={() => handleDownload(selectedSpec, "JSON")}
                      >
                        Download
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-border p-6">
              <Button 
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={() => handleDownload(selectedSpec, "PDF")}
              >
                Download Full Specification
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 bg-transparent" 
                onClick={() => setSelectedSpec(null)}
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Upload Specification Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-xl">
            <div className="flex items-center justify-between border-b border-border p-6">
              <h3 className="text-lg font-semibold text-foreground">Upload Trading Partner Specification</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                X
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Trading Partner *</label>
                <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                  <option value="">Select partner</option>
                  {tradingPartners.map(tp => (
                    <option key={tp} value={tp}>{tp}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Message Type *</label>
                <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                  <option value="">Select message type</option>
                  {unisSpecifications.map(spec => (
                    <option key={spec.code} value={spec.code}>{spec.code} - {spec.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Version *</label>
                <Input type="text" placeholder="e.g., 5010-WMT-2024" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Specification File *</label>
                <Input type="file" accept=".pdf,.xlsx,.xls,.doc,.docx,.txt,.edi" className="cursor-pointer" />
                <p className="text-xs text-muted-foreground mt-1">Accepted formats: PDF, Excel, Word, TXT, EDI</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Notes (Optional)</label>
                <textarea 
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm min-h-[80px]"
                  placeholder="Add any notes about this specification version..."
                />
              </div>
            </div>

            <div className="flex gap-2 border-t border-border p-6">
              <Button className="flex-1 bg-primary hover:bg-primary/90">
                Upload Specification
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
