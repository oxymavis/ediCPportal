"use client"

import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const AVAILABLE_SCOPES = [
  "partners:read",
  "partners:write",
  "certificates:read",
  "certificates:write",
  "specifications:read",
  "specifications:write",
  "transactions:read",
  "transactions:write",
  "notifications:read",
  "notifications:write",
  "integrations:read",
  "integrations:write",
] as const

type DeveloperClient = {
  client_id: string
  name: string
  status: string
  scopes: string[]
  environment: string
  created_at?: string | null
  last_used_at?: string | null
}

export default function DeveloperAppsTab() {
  const [clients, setClients] = useState<DeveloperClient[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [createdSecret, setCreatedSecret] = useState<{ clientId: string; clientSecret: string } | null>(null)
  const [form, setForm] = useState({
    name: "",
    environment: "sandbox" as "production" | "sandbox" | "all",
    scopes: ["integrations:write", "transactions:read"] as string[],
  })

  const loadClients = async () => {
    setLoading(true)
    const res = await apiClient.getMyOauthClients()
    if (res.success && res.data) {
      setClients(res.data)
      setError("")
    } else {
      setError(res.error || "Failed to load developer apps.")
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadClients()
  }, [])

  const toggleScope = (scope: string) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope) ? prev.scopes.filter((item) => item !== scope) : [...prev.scopes, scope],
    }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setCreatedSecret(null)
    const res = await apiClient.createMyOauthClient(form)
    setSubmitting(false)
    if (!res.success || !res.data) {
      setError(res.error || "Failed to create app.")
      return
    }
    setCreatedSecret({ clientId: res.data.client_id, clientSecret: res.data.client_secret })
    setForm({ name: "", environment: "sandbox", scopes: ["integrations:write", "transactions:read"] })
    setError("")
    await loadClients()
  }

  const handleRotate = async (clientId: string) => {
    const res = await apiClient.rotateMyOauthClientSecret(clientId)
    if (!res.success || !res.data) {
      setError(res.error || "Failed to rotate secret.")
      return
    }
    setCreatedSecret({ clientId: res.data.client_id, clientSecret: res.data.client_secret })
    setError("")
    await loadClients()
  }

  const handleToggleStatus = async (client: DeveloperClient) => {
    const nextStatus = client.status === "active" ? "disabled" : "active"
    const res = await apiClient.updateMyOauthClientStatus(client.client_id, nextStatus)
    if (!res.success) {
      setError(res.error || "Failed to update app status.")
      return
    }
    setError("")
    await loadClients()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Self-Service OAuth Apps</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Register an app, generate a dedicated client ID and client secret, then use it with the external Open API.
            </p>
          </div>
          <Badge variant="secondary">OAuth2 Client Credentials</Badge>
        </div>

        {createdSecret && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-medium">Copy this client secret now. It will not be shown again.</p>
            <p className="mt-2 font-mono text-xs">client_id: {createdSecret.clientId}</p>
            <p className="mt-1 font-mono text-xs break-all">client_secret: {createdSecret.clientSecret}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">App Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="OMS Production Connector"
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Environment</label>
              <select
                value={form.environment}
                onChange={(e) => setForm((prev) => ({ ...prev, environment: e.target.value as "production" | "sandbox" | "all" }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={submitting}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Scopes</label>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {AVAILABLE_SCOPES.map((scope) => {
                const checked = form.scopes.includes(scope)
                return (
                  <label
                    key={scope}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                      checked ? "border-primary bg-primary/5 text-foreground" : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleScope(scope)} disabled={submitting} />
                    <span className="font-mono text-xs">{scope}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <Button type="submit" disabled={submitting || form.scopes.length === 0}>
            {submitting ? "Creating App..." : "Create App"}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">My Apps</h3>
            <p className="mt-1 text-sm text-muted-foreground">Each app is isolated by its own client credentials and environment.</p>
          </div>
          <Button variant="outline" onClick={() => void loadClients()} disabled={loading}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Loading apps...</div>
          ) : clients.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No apps yet. Create your first OAuth app above.</div>
          ) : (
            clients.map((client) => (
              <div key={client.client_id} className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{client.name}</p>
                      <Badge variant={client.status === "active" ? "default" : "secondary"}>{client.status}</Badge>
                      <Badge variant="outline">{client.environment}</Badge>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">{client.client_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Created: {client.created_at ? new Date(client.created_at).toLocaleString() : "-"} | Last used:{" "}
                      {client.last_used_at ? new Date(client.last_used_at).toLocaleString() : "Never"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {client.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="font-mono text-[11px]">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void handleRotate(client.client_id)}>
                      Rotate Secret
                    </Button>
                    <Button variant="outline" onClick={() => void handleToggleStatus(client)}>
                      {client.status === "active" ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
