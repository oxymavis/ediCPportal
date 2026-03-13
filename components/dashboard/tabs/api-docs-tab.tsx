"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"

interface MessageRow {
  code: string
  name: string
  category: string
  x12Equivalent?: string
  version: string
}

export default function ApiDocsTab() {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [selectedCode, setSelectedCode] = useState<string>("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [schema, setSchema] = useState<Record<string, unknown>>({})
  const [mapping, setMapping] = useState<any[]>([])
  const [samples, setSamples] = useState<any[]>([])

  useEffect(() => {
    apiClient.getApiMessages().then((r) => {
      if (r.success && Array.isArray(r.data)) {
        const rows = r.data as MessageRow[]
        setMessages(rows)
        if (rows.length > 0) setSelectedCode(rows[0].code)
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedCode) return
    Promise.all([
      apiClient.getApiMessageSchema(selectedCode),
      apiClient.getApiMessageMapping(selectedCode),
      apiClient.getApiMessageSamples(selectedCode),
    ]).then(([s, m, p]) => {
      if (s.success && s.data && typeof s.data === "object") setSchema(s.data)
      if (m.success && Array.isArray(m.data)) setMapping(m.data)
      if (p.success && Array.isArray(p.data)) setSamples(p.data)
    })
  }, [selectedCode])

  const categories = useMemo(() => ["all", ...Array.from(new Set(messages.map((m) => m.category))).sort()], [messages])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return messages.filter((m) => {
      if (category !== "all" && m.category !== category) return false
      if (!q) return true
      return m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    })
  }, [messages, search, category])

  const selected = messages.find((m) => m.code === selectedCode)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">API Documentation</h2>
        <p className="text-muted-foreground">Message types, schemas, X12 mappings, and request/response samples (database-backed).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 lg:col-span-1 space-y-4">
          <Input placeholder="Search code / name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm">
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="space-y-2">
            {filtered.map((m) => (
              <button
                key={m.code}
                onClick={() => setSelectedCode(m.code)}
                className={`w-full text-left p-3 rounded-md border transition-colors ${selectedCode === m.code ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <p className="font-semibold text-foreground">{m.code} - {m.name}</p>
                <p className="text-xs text-muted-foreground">{m.category} | X12 {m.x12Equivalent || "-"} | {m.version}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2 space-y-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">No message selected.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selected.code} - {selected.name}</h3>
                  <p className="text-sm text-muted-foreground">Category {selected.category} | X12 {selected.x12Equivalent || "-"}</p>
                </div>
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => apiClient.getApiMessage(selected.code)}>
                  Refresh
                </Button>
              </div>

              {schema && typeof schema === "object" && "description" in schema && typeof (schema as Record<string, unknown>).description === "string" && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">Overview</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted/50 p-3 border border-border">
                    {(schema as Record<string, unknown>).description as string}
                  </p>
                </div>
              )}

              <div>
                <h4 className="font-medium text-foreground mb-2">Schema</h4>
                <pre className="text-xs bg-secondary/40 rounded-md p-3 overflow-auto max-h-80">{JSON.stringify(schema, null, 2)}</pre>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-2">X12 Mapping</h4>
                {mapping.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No mapping rows.</p>
                ) : (
                  <div className="space-y-2">
                    {mapping.map((row, idx) => (
                      <div key={`${row.jsonField}-${idx}`} className="p-3 rounded-md border border-border text-sm space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium font-mono text-foreground">{row.jsonField}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono">{row.x12Segment}{row.x12Element ? `.${row.x12Element}` : ""}</span>
                        </div>
                        {row.notes && <p className="text-xs text-muted-foreground">{row.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-2">Samples</h4>
                {samples.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sample payloads.</p>
                ) : (
                  <div className="space-y-4">
                    {samples.map((sample, idx) => (
                      <div key={`${sample.type}-${idx}`}>
                        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{sample.type}</p>
                        <pre className="text-xs bg-secondary/40 rounded-md p-3 overflow-auto max-h-72 border border-border">{JSON.stringify(sample.content || {}, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
