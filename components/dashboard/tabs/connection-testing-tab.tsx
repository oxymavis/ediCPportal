"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"

interface AS2ProfileRow {
  id: string
  name: string
  as2Id: string
  as2Url: string
  as2Port?: number
  status?: string
}

interface SubsidiaryRow {
  id: string
  name: string
  code: string
  as2Profiles?: AS2ProfileRow[]
}

interface PartnerRow {
  id: string
  name: string
  code: string
  integrationType: "api" | "edi"
  communicationChannel?: string
  apiConfig?: { baseUrl?: string }
  subsidiaries?: SubsidiaryRow[]
}

interface RunRow {
  id: string
  partnerId?: string
  testType: "as2" | "api"
  environment: string
  status: string
  summary?: Record<string, unknown>
  startedAt?: string
}

interface StepRow {
  stepNo: number
  name: string
  status: string
  latencyMs: number
  detail?: string
  evidence?: Record<string, unknown>
}

function parseHostPort(urlText?: string): { host: string; port: number } {
  if (!urlText) return { host: "", port: 443 }
  try {
    const url = new URL(urlText)
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === "http:" ? 80 : 443,
    }
  } catch {
    return { host: "", port: 443 }
  }
}

export default function ConnectionTestingTab() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [runs, setRuns] = useState<RunRow[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("")
  const [selectedRunId, setSelectedRunId] = useState<string>("")
  const [runSteps, setRunSteps] = useState<StepRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const [endpoint, setEndpoint] = useState("https://httpbin.org/get")
  const [authType, setAuthType] = useState<"oauth2" | "api-key" | "none">("oauth2")
  const [samplePayload, setSamplePayload] = useState('{"messageType":"850","orderNo":"PO-1001"}')

  const [host, setHost] = useState("")
  const [port, setPort] = useState("443")
  const [as2Id, setAs2Id] = useState("")
  const [ackUrl, setAckUrl] = useState("https://httpbin.org/anything/ACK-997")
  const [mdnUrl, setMdnUrl] = useState("https://httpbin.org/status/200")

  const [validatorFormat, setValidatorFormat] = useState<"json" | "xml" | "x12">("json")
  const [validatorContent, setValidatorContent] = useState('{"demo":true}')
  const [validatorResult, setValidatorResult] = useState("")
  const [validatorLoading, setValidatorLoading] = useState(false)
  const [documentTestLoading, setDocumentTestLoading] = useState(false)

  useEffect(() => {
    Promise.all([apiClient.getPartners(), apiClient.getConnectionRuns()]).then(([p, r]) => {
      if (p.success && Array.isArray(p.data)) setPartners(p.data as PartnerRow[])
      if (r.success && Array.isArray(r.data)) setRuns(r.data as RunRow[])
    })
  }, [])

  useEffect(() => {
    if (!selectedRunId) return
    apiClient.getConnectionRun(selectedRunId).then((res) => {
      if (res.success && res.data && Array.isArray((res.data as any).steps)) {
        setRunSteps((res.data as any).steps as StepRow[])
      } else {
        setRunSteps([])
      }
    })
  }, [selectedRunId])

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId),
    [partners, selectedPartnerId],
  )

  useEffect(() => {
    if (!selectedPartner) return
    if (selectedPartner.integrationType === "api") {
      setEndpoint(selectedPartner.apiConfig?.baseUrl || "https://httpbin.org/get")
      setAuthType("oauth2")
      return
    }

    const primary = selectedPartner.subsidiaries?.flatMap((s) => s.as2Profiles || [])[0]
    const parsed = parseHostPort(primary?.as2Url)
    setHost(parsed.host)
    setPort(String(primary?.as2Port || parsed.port || 443))
    setAs2Id(primary?.as2Id || `${selectedPartner.code}-AS2`)
  }, [selectedPartner])

  const visibleRuns = useMemo(() => {
    return runs
      .filter((r) => {
        if (!selectedPartnerId) return true
        return r.partnerId === selectedPartnerId
      })
      .slice(0, 20)
  }, [runs, selectedPartnerId])

  const refreshRuns = async () => {
    const r = await apiClient.getConnectionRuns()
    if (r.success && Array.isArray(r.data)) setRuns(r.data as RunRow[])
  }

  const runTest = async () => {
    if (!selectedPartner) return
    setLoading(true)
    setError("")

    let res
    if (selectedPartner.integrationType === "api") {
      let parsedPayload: Record<string, unknown> = {}
      try {
        parsedPayload = JSON.parse(samplePayload)
      } catch {
        setLoading(false)
        setError("Sample payload must be valid JSON")
        return
      }
      res = await apiClient.runApiConnectionTest({
        partnerId: selectedPartner.id,
        environment: "default",
        endpoint,
        auth: authType,
        samplePayload: parsedPayload,
      })
    } else {
      res = await apiClient.runAs2ConnectionTest({
        partnerId: selectedPartner.id,
        environment: "default",
        host,
        port: Number(port) || 443,
        as2Id,
        ackUrl,
        mdnUrl,
      })
    }

    setLoading(false)
    if (!res.success || !res.data) {
      setError(res.error || "Connection test failed")
      return
    }

    await refreshRuns()
    const runId = (res.data as any).runId as string | undefined
    if (runId) setSelectedRunId(runId)
  }

  const runPayloadValidator = async () => {
    setValidatorLoading(true)
    setValidatorResult("")
    try {
      const res = await apiClient.validatePayload({ format: validatorFormat, content: validatorContent })
      if (res.success && res.data) {
        setValidatorResult(JSON.stringify(res.data, null, 2))
      } else {
        setValidatorResult(JSON.stringify({ success: false, error: res.error }, null, 2))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed"
      setValidatorResult(JSON.stringify({ success: false, error: msg }, null, 2))
      toast.error("Validate Payload 请求失败")
    } finally {
      setValidatorLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Connection Testing</h2>
        <p className="text-sm text-muted-foreground">API 和 EDI 流程已拆分，测试由后端 /v1/connection-testing 实际执行</p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
            <option value="">Select partner</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code}) - {p.integrationType.toUpperCase()}</option>
            ))}
          </select>
          <Button onClick={runTest} disabled={!selectedPartner || loading}>{loading ? "Running..." : "Run Test"}</Button>
        </div>

        {selectedPartner && (
          <div className={`rounded-md border p-3 text-sm ${selectedPartner.integrationType === "api" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-sky-50 border-sky-200 text-sky-800"}`}>
            Selected flow: <span className="font-semibold">{selectedPartner.integrationType.toUpperCase()}</span>
            {selectedPartner.integrationType === "api" ? " (EDI AS2 steps hidden)" : " (API endpoint checks hidden)"}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {selectedPartner?.integrationType === "api" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">API Endpoint</label>
              <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://partner.example.com/api/health" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Auth</label>
              <select value={authType} onChange={(e) => setAuthType(e.target.value as "oauth2" | "api-key" | "none")} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
                <option value="oauth2">OAuth2</option>
                <option value="api-key">API Key</option>
                <option value="none">None</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm text-muted-foreground">Sample Payload (JSON)</label>
              <textarea value={samplePayload} onChange={(e) => setSamplePayload(e.target.value)} className="w-full min-h-28 rounded-md border border-input bg-background p-3 text-xs font-mono" />
            </div>
          </div>
        )}

        {selectedPartner?.integrationType === "edi" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Host</label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="as2.partner.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Port</label>
              <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="443" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">AS2 ID</label>
              <Input value={as2Id} onChange={(e) => setAs2Id(e.target.value)} placeholder="PARTNER-AS2" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">MDN URL</label>
              <Input value={mdnUrl} onChange={(e) => setMdnUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm text-muted-foreground">Functional ACK URL</label>
              <Input value={ackUrl} onChange={(e) => setAckUrl(e.target.value)} placeholder="https://.../ACK-997" />
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Recent Runs</h3>
            <Button variant="outline" className="bg-transparent" size="sm" onClick={refreshRuns}>Refresh</Button>
          </div>
          {visibleRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs found.</p>
          ) : (
            visibleRuns.map((run) => (
              <button key={run.id} onClick={() => setSelectedRunId(run.id)} className={`w-full text-left p-3 rounded-md border ${selectedRunId === run.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="font-medium text-foreground">{run.id}</p>
                <p className="text-xs text-muted-foreground">{run.testType.toUpperCase()} | {run.status}</p>
                {(run.summary as any)?.passedSteps !== undefined && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    passed {(run.summary as any).passedSteps} / {(run.summary as any).totalSteps}
                  </p>
                )}
              </button>
            ))
          )}
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-foreground">Run Steps & Evidence</h3>
          {!selectedRunId ? (
            <p className="text-sm text-muted-foreground">Select a run to inspect.</p>
          ) : runSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps available for this run.</p>
          ) : (
            runSteps.map((step) => (
              <div key={step.stepNo} className="p-3 rounded-md border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{step.stepNo}. {step.name}</p>
                  <span className={`px-2 py-0.5 rounded text-xs ${step.status === "passed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{step.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">{step.detail || "-"} | {step.latencyMs}ms</p>
                {step.evidence && (
                  <pre className="text-[11px] bg-secondary/40 rounded p-2 overflow-auto max-h-36">{JSON.stringify(step.evidence, null, 2)}</pre>
                )}
              </div>
            ))
          )}
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Document Test & Payload Validator</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={validatorFormat} onChange={(e) => setValidatorFormat(e.target.value as "json" | "xml" | "x12")} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
            <option value="json">JSON</option>
            <option value="xml">XML</option>
            <option value="x12">X12</option>
          </select>
          <Button onClick={runPayloadValidator} disabled={validatorLoading}>
            {validatorLoading ? "Validating…" : "Validate Payload"}
          </Button>
          <Button
            variant="outline"
            className="bg-transparent"
            disabled={documentTestLoading}
            onClick={async () => {
              if (!selectedPartner) {
                toast.error("请先在上方选择伙伴 (Select partner)")
                return
              }
              setDocumentTestLoading(true)
              try {
                const res = await apiClient.createDocumentTest({
                  partnerId: selectedPartner.id,
                  environment: "default",
                  messageType: "850",
                  payload: { test: true },
                  errors: [],
                })
                if (res.success && res.data) {
                  toast.success(`Document Test 已提交: ${(res.data as { id?: string }).id ?? "ok"}`)
                } else {
                  toast.error(res.error ?? "Submit failed")
                }
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Submit failed")
              } finally {
                setDocumentTestLoading(false)
              }
            }}
          >
            {documentTestLoading ? "Submitting…" : "Submit Document Test"}
          </Button>
        </div>
        <textarea value={validatorContent} onChange={(e) => setValidatorContent(e.target.value)} className="w-full min-h-24 rounded-md border border-input bg-background p-3 text-xs font-mono" />
        {validatorResult && <pre className="text-xs bg-secondary/40 rounded p-3 overflow-auto">{validatorResult}</pre>}
      </Card>
    </div>
  )
}
