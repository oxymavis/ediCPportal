"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"

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

const DEFAULT_AS2_STREAM =
  "ISA*00*          *00*          *ZZ*UNIS           *ZZ*PARTNER        *260521*1200*U*00401*000000001*0*T*>~GS*PO*UNIS*PARTNER*20260521*1200*1*X*004010~ST*850*0001~SE*2*0001~GE*1*1~IEA*1*000000001~"

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

  const [as2PartnerName, setAs2PartnerName] = useState("")
  const [as2PartnerId, setAs2PartnerId] = useState("")
  const [as2ContentType, setAs2ContentType] = useState("application/EDI-X12")
  const [as2Stream, setAs2Stream] = useState(DEFAULT_AS2_STREAM)

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
    setAs2PartnerName(selectedPartner.name)
    setAs2PartnerId(primary?.as2Id || `${selectedPartner.code}-AS2`)
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
        environment: "sandbox",
        endpoint,
        auth: authType,
        samplePayload: parsedPayload,
      })
    } else {
      res = await apiClient.runAs2ConnectionTest({
        partnerId: selectedPartner.id,
        environment: "sandbox",
        partnerName: as2PartnerName,
        partnerAS2Id: as2PartnerId,
        contentType: as2ContentType,
        stream: as2Stream,
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Connection Testing</h2>
        <p className="text-sm text-muted-foreground">API 和 EDI 流程已拆分，测试由后端 /v1/connection-testing 实际执行</p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
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
            {selectedPartner.integrationType === "api" ? " (EDI AS2 steps hidden)" : " (AS2 test will call webMethods AS2 Connectivity API)"}
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
              <label className="text-sm text-muted-foreground">webMethods Partner Name</label>
              <Input value={as2PartnerName} onChange={(e) => setAs2PartnerName(e.target.value)} placeholder="TrueCommerceSHA2" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">AS2 Partner ID</label>
              <Input value={as2PartnerId} onChange={(e) => setAs2PartnerId(e.target.value)} placeholder="TrueCommerceSHA2" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Content Type</label>
              <Input value={as2ContentType} onChange={(e) => setAs2ContentType(e.target.value)} placeholder="application/EDI-X12" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">ID Type</label>
              <Input value="EDIINT AS2" disabled className="bg-secondary/30" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm text-muted-foreground">EDI X12 Test Content</label>
              <textarea value={as2Stream} onChange={(e) => setAs2Stream(e.target.value)} className="w-full min-h-32 rounded-md border border-input bg-background p-3 text-xs font-mono" />
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
    </div>
  )
}
