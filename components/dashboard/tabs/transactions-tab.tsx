"use client"

import { useState, useMemo, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import TransactionDetailModal from "../modals/transaction-detail-modal"
import { apiClient } from "@/lib/api-client"

export default function TransactionsTab() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [selectedTrx, setSelectedTrx] = useState<any | null>(null)
  const [trxDetail, setTrxDetail] = useState<any | null>(null)

  useEffect(() => {
    apiClient.getTransactions().then((r) => {
      if (r.success && Array.isArray(r.data)) setTransactions(r.data)
    })
  }, [])

  useEffect(() => {
    if (!selectedTrx?.id) {
      setTrxDetail(null)
      return
    }
    setTrxDetail(null)
    apiClient.getTransaction(selectedTrx.id).then((r) => {
      if (r.success && r.data) setTrxDetail(r.data)
    })
  }, [selectedTrx?.id])

  
  // Filter states
  const [searchKeyword, setSearchKeyword] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedDirection, setSelectedDirection] = useState<string>("all")
  const [selectedPartner, setSelectedPartner] = useState<string>("all")
  const [selectedIntegrationType, setSelectedIntegrationType] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const docTypes = [
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
    { code: "997", name: "Functional Ack" },
    { code: "PO", name: "Purchase Order (API)" },
    { code: "ASN", name: "Advance Ship Notice (API)" },
    { code: "INV", name: "Invoice (API)" },
  ]
  const statusOptions = ["completed", "processing", "error", "pending"]
  const directionOptions = ["inbound", "outbound"]
  
  // Get unique partners
  const partners = useMemo(() => {
    const uniquePartners = [...new Set(transactions.map(t => t.partner))]
    return uniquePartners.sort()
  }, [transactions])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(trx => {
      // Keyword search
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        const s = (x: any) => String(x ?? "").toLowerCase()
        const matchesKeyword =
          s(trx.id).includes(keyword) ||
          s(trx.partner).includes(keyword) ||
          s(trx.controlNumber).includes(keyword) ||
          s(trx.senderId).includes(keyword) ||
          s(trx.receiverId).includes(keyword) ||
          s(trx.typeName).includes(keyword)
        if (!matchesKeyword) return false
      }
      
      // Document type filter
      if (selectedType !== "all" && trx.type !== selectedType) return false
      
      // Status filter
      if (selectedStatus !== "all" && trx.status !== selectedStatus) return false
      
      // Direction filter
      if (selectedDirection !== "all" && trx.direction !== selectedDirection) return false
      
      // Partner filter
      if (selectedPartner !== "all" && trx.partner !== selectedPartner) return false

      // Integration type filter
      const trxIntType = (trx as any).integrationType || "edi"
      if (selectedIntegrationType !== "all" && trxIntType !== selectedIntegrationType) return false
      
      // Date range filter
      if (dateFrom && trx.date < dateFrom) return false
      if (dateTo && trx.date > dateTo) return false
      
      return true
    })
  }, [transactions, searchKeyword, selectedType, selectedStatus, selectedDirection, selectedPartner, selectedIntegrationType, dateFrom, dateTo])

  const clearFilters = () => {
    setSearchKeyword("")
    setSelectedType("all")
    setSelectedStatus("all")
    setSelectedDirection("all")
    setSelectedPartner("all")
    setSelectedIntegrationType("all")
    setDateFrom("")
    setDateTo("")
  }

  const hasActiveFilters = searchKeyword || selectedType !== "all" || selectedStatus !== "all" || 
    selectedDirection !== "all" || selectedPartner !== "all" || selectedIntegrationType !== "all" || dateFrom || dateTo

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-50 text-green-700"
      case "processing":
        return "bg-blue-50 text-blue-700"
      case "error":
        return "bg-red-50 text-red-700"
      case "pending":
        return "bg-amber-50 text-amber-700"
      default:
        return "bg-gray-50 text-gray-700"
    }
  }

  const getDirectionBadge = (direction: string) => {
    return direction === "inbound" 
      ? "bg-cyan-50 text-cyan-700" 
      : "bg-purple-50 text-purple-700"
  }

  // Get doc type name
  const getDocTypeName = (code: string) => {
    const docType = docTypes.find(d => d.code === code)
    return docType ? docType.name : code
  }

  const exportToExcel = async () => {
    await apiClient.exportTransactions("xlsx")
  }

  const exportToCsv = async () => {
    await apiClient.exportTransactions("csv")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Transactions</h2>
          <p className="text-muted-foreground">View and manage EDI and API document transactions</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Integration Type Quick Toggle */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            <button
              onClick={() => setSelectedIntegrationType("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedIntegrationType === "all"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedIntegrationType("edi")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedIntegrationType === "edi"
                  ? "bg-blue-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EDI (AS2/SFTP)
            </button>
            <button
              onClick={() => setSelectedIntegrationType("api")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedIntegrationType === "api"
                  ? "bg-emerald-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              API (REST)
            </button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 bg-transparent" onClick={exportToCsv}>
              Export CSV
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={exportToExcel}>
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-muted/50 border border-border text-sm">
        <span className="text-muted-foreground">Showing <span className="font-semibold text-foreground">{filteredTransactions.length}</span> of {transactions.length} transactions</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">EDI: <span className="font-semibold text-blue-700">{transactions.filter(t => !(t as any).integrationType || (t as any).integrationType === "edi").length}</span></span>
        <span className="text-muted-foreground">API: <span className="font-semibold text-emerald-700">{transactions.filter(t => (t as any).integrationType === "api").length}</span></span>
      </div>

      {/* Search and Quick Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* First Row: Search and Quick Actions */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by Transaction ID, Partner, Control Number, Sender/Receiver ID..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="bg-transparent"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? "Hide Filters" : "Advanced Filters"}
              </Button>
              {hasActiveFilters && (
                <Button variant="outline" className="bg-transparent" onClick={clearFilters}>
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Document Type Quick Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
                selectedType === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-primary/10"
              }`}
            >
              All Types
            </button>
            {docTypes.map((type) => (
              <button
                key={type.code}
                onClick={() => setSelectedType(selectedType === type.code ? "all" : type.code)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
                  selectedType === type.code
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                }`}
                title={type.name}
              >
                {type.code}
              </button>
            ))}
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="pt-4 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {statusOptions.map(status => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Direction */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Direction</Label>
                  <Select value={selectedDirection} onValueChange={setSelectedDirection}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Directions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Directions</SelectItem>
                      {directionOptions.map(dir => (
                        <SelectItem key={dir} value={dir} className="capitalize">
                          {dir}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Partner */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Trading Partner</Label>
                  <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Partners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Partners</SelectItem>
                      {partners.map(partner => (
                        <SelectItem key={partner} value={partner}>
                          {partner}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Transactions List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No transactions found matching your criteria</p>
            {hasActiveFilters && (
              <Button 
                variant="link" 
                className="mt-2"
                onClick={clearFilters}
              >
                Clear filters to see all transactions
              </Button>
            )}
          </Card>
        ) : (
          filteredTransactions.map((trx) => (
            <Card
              key={trx.id}
              className="p-6 cursor-pointer border border-border hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => setSelectedTrx(trx)}
            >
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 flex-1">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Transaction ID</p>
                    <p className="font-mono font-semibold text-foreground">{trx.id}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Document Type</p>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-primary">{trx.type}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        (trx as any).integrationType === "api"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {(trx as any).integrationType === "api" ? "API" : "EDI"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{getDocTypeName(trx.type)}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Trading Partner</p>
                    <p className="font-medium text-foreground text-sm">{trx.partner}</p>
                    {(trx as any).channel && (
                      <p className="text-[10px] text-muted-foreground">{(trx as any).channel}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Direction</p>
                    <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${getDirectionBadge(trx.direction)}`}>
                      {trx.direction}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Size / Records</p>
                    <p className="font-medium text-foreground text-sm">
                      {trx.size} / {trx.records}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <span className={`px-3 py-1 rounded text-xs font-semibold capitalize ${getStatusColor(trx.status)}`}>
                      {trx.status}
                    </span>
                  </div>
                </div>
                <span className="text-muted-foreground ml-4">→</span>
              </div>
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                <span>{trx.date} {trx.time}</span>
                <span>ICN: {trx.controlNumber}</span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${trx.status === "completed" ? "bg-green-500" : trx.status === "error" ? "bg-red-500" : "bg-amber-500"}`} />
                  {trx.status === "completed" ? "Valid" : trx.status === "error" ? "Invalid" : "Validating"}
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${trx.status === "completed" ? "bg-green-500" : "bg-amber-500"}`} />
                  {trx.status === "completed" ? "Delivered" : "Pending"}
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${trx.status === "completed" ? "bg-green-500" : trx.status === "error" ? "bg-red-500" : "bg-slate-400"}`} />
                  {trx.status === "completed" ? "Accepted" : trx.status === "error" ? "Rejected" : "N/A"}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTrx && (
        <TransactionDetailModal
          transaction={trxDetail ?? selectedTrx}
          onClose={() => { setSelectedTrx(null); setTrxDetail(null) }}
        />
      )}
    </div>
  )
}
