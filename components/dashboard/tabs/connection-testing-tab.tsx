"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"

interface PartnerRow {
  id: string
  name: string
  code: string
  integrationType: "api" | "edi"
  communicationChannel?: string
  environment?: string
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
}

export default function ConnectionTestingTab() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [runs, setRuns] = useState<RunRow[]>([])
  const [selectedPartner, setSelectedPartner] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string>("")
  const [runSteps, setRunSteps] = useState<StepRow[]>([])
  const [validatorContent, setValidatorContent] = useState('{"demo":true}')
  const [validatorResult, setValidatorResult] = useState<string>("")

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
      }
    })
  }, [selectedRunId])

  const partner = useMemo(() => partners.find((p) => p.id === selectedPartner), [partners, selectedPartner])

  const runTest = async () => {
    if (!partner) return
    setLoading(true)

    const environment = partner.environment || "production"
    const isApi = partner.integrationType === "api"
    const result = isApi
      ? await apiClient.runApiConnectionTest({
          partnerId: partner.id,
          environment,
          endpoint: "https://httpbin.org/get",
          auth: "oauth2",
          samplePayload: { test: true },
        })
      : await apiClient.runAs2ConnectionTest({
          partnerId: partner.id,
          environment,
          host: "httpbin.org",
          port: 443,
          as2Id: `${partner.code}-AS2`,
          ackUrl: "https://httpbin.org/anything/ACK-997",
          mdnUrl: "https://httpbin.org/status/200",
        })

    setLoading(false)
    if (result.success) {
      const latest = await apiClient.getConnectionRuns()
      if (latest.success && Array.isArray(latest.data)) {
        setRuns(latest.data as RunRow[])
      }
      const runId = (result.data as any)?.runId as string | undefined
      if (runId) setSelectedRunId(runId)
    }
  }

  const runPayloadValidator = async () => {
    const res = await apiClient.validatePayload({ format: "json", content: validatorContent })
    if (res.success && res.data) {
      setValidatorResult(JSON.stringify(res.data, null, 2))
    } else {
      setValidatorResult(JSON.stringify({ success: false, error: res.error }, null, 2))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Connection Testing</h2>
        <p className="text-sm text-muted-foreground">All diagnostics use backend endpoints under /v1/connection-testing</p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={selectedPartner} onChange={(e) => setSelectedPartner(e.target.value)} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
            <option value="">Select partner</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code}) - {p.integrationType.toUpperCase()}</option>
            ))}
          </select>
          <Button onClick={runTest} disabled={!partner || loading}>{loading ? "Running..." : "Run Connection Test"}</Button>
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={async () => {
              const r = await apiClient.getConnectionRuns()
              if (r.success && Array.isArray(r.data)) setRuns(r.data as RunRow[])
            }}
          >
            Refresh Runs
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-foreground">Recent Runs</h3>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No connection test runs found.</p>
          ) : (
            runs.slice(0, 10).map((run) => (
              <button key={run.id} onClick={() => setSelectedRunId(run.id)} className={`w-full text-left p-3 rounded-md border ${selectedRunId === run.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="font-medium text-foreground">{run.id}</p>
                <p className="text-xs text-muted-foreground">{run.testType.toUpperCase()} | {run.environment} | {run.status}</p>
              </button>
            ))
          )}
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-foreground">Run Steps</h3>
          {!selectedRunId ? (
            <p className="text-sm text-muted-foreground">Select a run to inspect steps.</p>
          ) : runSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps available for this run.</p>
          ) : (
            runSteps.map((step) => (
              <div key={step.stepNo} className="p-3 rounded-md border border-border">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{step.stepNo}. {step.name}</p>
                  <span className={`px-2 py-0.5 rounded text-xs ${step.status === "passed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{step.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{step.detail || "-"} | {step.latencyMs}ms</p>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Payload Validator</h3>
        <Input value={validatorContent} onChange={(e) => setValidatorContent(e.target.value)} />
        <div className="flex gap-2">
          <Button onClick={runPayloadValidator}>Validate JSON</Button>
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={async () => {
              if (!partner) return
              await apiClient.createDocumentTest({ partnerId: partner.id, environment: partner.environment || "production", messageType: "850", payload: { test: true }, errors: [] })
            }}
          >
            Submit Document Test
          </Button>
        </div>
        {validatorResult && <pre className="text-xs bg-secondary/40 rounded p-3 overflow-auto">{validatorResult}</pre>}
      </Card>
    </div>
  )
}
