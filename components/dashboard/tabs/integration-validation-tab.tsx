"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"

interface UploadedDocument {
  fileName?: string
  file_name?: string
  fileType?: string
  file_type?: string
  storedPath?: string
  stored_path?: string
  characters?: number
  sha256?: string
}

interface ValidationPoint {
  id: string
  title: string
  source_file: string
  source_line: string
  category: string
  rule_type: string
  segment?: string
  element?: string
  qualifier?: string
  expected?: string[]
  compiled?: boolean
}

interface PointGroup {
  category: string
  count: number
  items: ValidationPoint[]
}

interface Finding {
  code: string
  severity: string
  segment?: string
  element?: string
  source: string
  messageZh: string
  messageEn: string
  rawSegment?: string
  rawSegmentIndex?: number
}

interface SpecBundle {
  specId: string
  specName: string
  validationMode: string
  detectedProfile?: {
    name?: string
    confidence?: string
    matchReason?: string
    match_reason?: string
  } | null
  validator?: {
    buildVersion?: string
    rulesHash?: string
    rulesPath?: string
  }
  documents?: UploadedDocument[]
  unsupported?: Array<{ fileName: string; reason: string }>
  summary?: {
    totalPoints: number
    compiledPoints: number
    informationalPoints: number
  }
  pointGroups?: PointGroup[]
}

interface ValidationResult {
  validationMode: string
  summary: { total: number; errors: number; warnings: number }
  findings: Finding[]
  downloadUrl: string
  fallback?: {
    messageZh?: string
    messageEn?: string
    details?: string
  }
}

function labelOfValidationMode(mode?: string) {
  return mode === "built_in_profile" ? "Dedicated Spec + Built-in Profile" : "Dedicated Spec Validator"
}

export default function IntegrationValidationTab() {
  const [files, setFiles] = useState<File[]>([])
  const [specBundle, setSpecBundle] = useState<SpecBundle | null>(null)
  const [ediMessage, setEdiMessage] = useState("")
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [specError, setSpecError] = useState("")
  const [validationError, setValidationError] = useState("")

  const fileLabel = useMemo(() => {
    if (files.length === 0) return "No files selected"
    if (files.length === 1) return files[0].name
    return `${files.length} files selected`
  }, [files])

  const uploadSpec = async () => {
    if (files.length === 0) {
      setSpecError("Please choose at least one specification file.")
      return
    }
    setUploading(true)
    setSpecError("")
    setValidationResult(null)
    const res = await apiClient.uploadIntegrationValidationSpec(files)
    setUploading(false)
    if (!res.success || !res.data) {
      setSpecError(res.error || "Failed to upload spec files")
      return
    }
    setSpecBundle(res.data as SpecBundle)
    toast.success("Integration validation spec uploaded")
  }

  const validateMessage = async () => {
    if (!specBundle?.specId) {
      setValidationError("Upload a spec bundle first.")
      return
    }
    if (!ediMessage.trim()) {
      setValidationError("Paste an EDI message before validation.")
      return
    }
    setValidating(true)
    setValidationError("")
    const res = await apiClient.validateIntegrationSpec({
      specId: specBundle.specId,
      ediMessage,
    })
    setValidating(false)
    if (!res.success || !res.data) {
      setValidationError(res.error || "Validation failed")
      return
    }
    setValidationResult(res.data as ValidationResult)
    toast.success("EDI validation completed")
  }

  const downloadReport = async () => {
    if (!validationResult?.downloadUrl) return
    const res = await apiClient.downloadIntegrationValidationReport(validationResult.downloadUrl)
    if (!res.success) {
      toast.error(res.error || "Failed to download report")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Integration Validation</h2>
        <p className="text-sm text-muted-foreground">
          Upload customer specs, extract executable validation points, validate EDI payloads, and export markdown findings.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Spec Upload</h3>
              <p className="text-sm text-muted-foreground">Supports `.pdf`, `.txt`, `.md`, `.docx`, `.xlsx`, `.xls`; scanned PDFs may still need OCR.</p>
            </div>
            <div className="space-y-3">
              <Input
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.xls,.txt,.md"
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
              <p className="text-sm text-muted-foreground">{fileLabel}</p>
              <Button onClick={uploadSpec} disabled={uploading}>
                {uploading ? "Extracting..." : "Extract Validation Points"}
              </Button>
              {specError && <p className="text-sm text-destructive">{specError}</p>}
            </div>
          </Card>

          {specBundle && (
            <>
              <Card className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{specBundle.specName}</h3>
                    <p className="text-sm text-muted-foreground">Spec ID: <span className="font-mono">{specBundle.specId}</span></p>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-primary/10 text-primary">
                    {labelOfValidationMode(specBundle.validationMode)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total Points</p>
                    <p className="text-xl font-semibold text-foreground">{specBundle.summary?.totalPoints || 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Executable</p>
                    <p className="text-xl font-semibold text-foreground">{specBundle.summary?.compiledPoints || 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Informational</p>
                    <p className="text-xl font-semibold text-foreground">{specBundle.summary?.informationalPoints || 0}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Detected Profile</p>
                    <p className="font-medium text-foreground">{specBundle.detectedProfile?.name || "No built-in profile matched"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Validator Build</p>
                    <p className="font-mono text-foreground">{specBundle.validator?.buildVersion || "--"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground">Reason</p>
                    <p className="text-foreground">{specBundle.detectedProfile?.matchReason || specBundle.detectedProfile?.match_reason || "Using generated spec rules only."}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Uploaded Documents</h3>
                <div className="space-y-3">
                  {(specBundle.documents || []).map((doc) => (
                    <div key={`${doc.fileName || doc.file_name}-${doc.sha256}`} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground">{doc.fileName || doc.file_name}</p>
                        <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs uppercase">
                          {doc.fileType || doc.file_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Characters: {doc.characters || 0} · Stored: <span className="font-mono">{doc.storedPath || doc.stored_path}</span>
                      </p>
                    </div>
                  ))}
                  {(specBundle.unsupported || []).length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="font-medium text-amber-800">Unsupported / Failed Files</p>
                      <div className="mt-2 space-y-1 text-sm text-amber-700">
                        {specBundle.unsupported?.map((item) => (
                          <p key={`${item.fileName}-${item.reason}`}>{item.fileName}: {item.reason}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4 space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Validation Points</h3>
                <div className="space-y-4">
                  {(specBundle.pointGroups || []).map((group) => (
                    <div key={group.category} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="font-medium text-foreground">{group.category}</p>
                        <span className="text-xs text-muted-foreground">{group.count} points</span>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((point) => (
                          <div key={point.id} className="rounded-md bg-secondary/40 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-foreground">{point.title}</p>
                              <span className={`text-xs px-2 py-0.5 rounded ${point.compiled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                                {point.compiled ? "Executable" : "Informational"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Source: {point.source_file} · Rule: <span className="font-mono">{point.rule_type}</span>
                              {point.segment ? ` · Segment: ${point.segment}` : ""}
                              {point.element ? ` · Element: ${point.element}` : ""}
                            </p>
                            <p className="text-sm text-foreground mt-2">{point.source_line}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">EDI Message Validation</h3>
              <p className="text-sm text-muted-foreground">Paste the EDI payload to run rule-based validation against the uploaded spec bundle.</p>
            </div>
            <Textarea
              value={ediMessage}
              onChange={(event) => setEdiMessage(event.target.value)}
              className="min-h-[280px] font-mono text-xs"
              placeholder="Paste EDI message here..."
            />
            <div className="flex items-center gap-3">
              <Button onClick={validateMessage} disabled={!specBundle?.specId || validating}>
                {validating ? "Validating..." : "Validate EDI"}
              </Button>
              <Button variant="outline" className="bg-transparent" onClick={downloadReport} disabled={!validationResult?.downloadUrl}>
                Download Markdown
              </Button>
            </div>
            {validationError && <p className="text-sm text-destructive">{validationError}</p>}
          </Card>

          {validationResult && (
            <>
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">Validation Summary</h3>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-primary/10 text-primary">
                    {labelOfValidationMode(validationResult.validationMode)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-semibold text-foreground">{validationResult.summary.total}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Errors</p>
                    <p className="text-xl font-semibold text-destructive">{validationResult.summary.errors}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Warnings</p>
                    <p className="text-xl font-semibold text-amber-600">{validationResult.summary.warnings}</p>
                  </div>
                </div>
                {validationResult.fallback && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {validationResult.fallback.messageZh} {validationResult.fallback.messageEn}
                  </div>
                )}
              </Card>

              <div className="space-y-3">
                {validationResult.findings.map((finding, index) => (
                  <Card key={`${finding.code}-${index}`} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${finding.severity === "Error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {finding.severity}
                        </span>
                        <span className="font-mono text-sm text-foreground">{finding.code}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{finding.source}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Segment: <span className="font-mono">{finding.segment || "--"}</span> · Element: <span className="font-mono">{finding.element || "--"}</span>
                    </p>
                    <div className="space-y-1 text-sm">
                      <p className="text-foreground">{finding.messageZh}</p>
                      <p className="text-muted-foreground">{finding.messageEn}</p>
                    </div>
                    <div className="rounded-md bg-secondary/40 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Original Segment</p>
                      <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
                        {finding.rawSegment
                          ? `Line ${finding.rawSegmentIndex || "-"}\n${finding.rawSegment}`
                          : "No matching raw segment could be attached to this finding."}
                      </pre>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
