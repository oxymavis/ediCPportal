// API client for FastAPI backend (/v1)

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

// 未设置时用 localhost:8000；设为空字符串时走同源（Next 反向代理），便于 ngrok 单域名
const _apiBaseRaw = process.env.NEXT_PUBLIC_API_BASE_URL
const API_BASE =
  _apiBaseRaw === undefined || _apiBaseRaw === null
    ? "http://localhost:8000"
    : _apiBaseRaw

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/edi_csrf=([^;]+)/)
  return m ? m[1] : null
}

const REQUEST_TIMEOUT_MS = 15000

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...((init?.headers as Record<string, string>) || {}),
    }
    const method = (init?.method || "GET").toUpperCase()
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      const csrf = getCsrfToken()
      if (csrf) headers["x-csrf-token"] = csrf
    }
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const json = await response.json()
    if (!response.ok && json?.success !== false) {
      return {
        success: false,
        error: json?.error || `HTTP ${response.status}`,
        code: json?.code,
      }
    }

    return json
  } catch (e) {
    clearTimeout(timeoutId)
    if (e instanceof Error && e.name === "AbortError") {
      return { success: false, error: "请求超时，请检查后端是否已启动" }
    }
    return { success: false, error: "Network error" }
  }
}

function getFilenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i)
  const raw = match?.[1] || match?.[2]
  if (!raw) return fallback
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

async function download(path: string, fallbackFilename: string): Promise<ApiResponse<{ downloaded: boolean }>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      credentials: "include",
    })
    const contentType = (response.headers.get("content-type") || "").toLowerCase()
    if (!response.ok || contentType.includes("application/json")) {
      try {
        const json = await response.json()
        return {
          success: false,
          error: json?.error || `HTTP ${response.status}`,
          code: json?.code,
        }
      } catch {
        return { success: false, error: `HTTP ${response.status}` }
      }
    }
    const blob = await response.blob()
    const filename = getFilenameFromDisposition(response.headers.get("content-disposition"), fallbackFilename)
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    return { success: true, data: { downloaded: true } }
  } catch {
    return { success: false, error: "Network error" }
  }
}

export const apiClient = {
  getHealth() {
    return request<{ status: string; version?: string }>("/v1/meta/health")
  },

  // Auth (login does not send CSRF; session/cookie set by backend)
  async register(payload: { name: string; email: string; password: string; confirmPassword: string; rememberMe?: boolean }): Promise<ApiResponse<{ user: { id: string; name: string; email: string; emailVerified?: boolean } }>> {
    try {
      const response = await fetch(`${API_BASE}/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          email: payload.email.trim().toLowerCase(),
          rememberMe: payload.rememberMe ?? false,
        }),
        credentials: "include",
      })
      const json = await response.json()
      if (!response.ok) return { success: false, error: json?.error || "Registration failed", code: json?.code }
      return json
    } catch {
      return { success: false, error: "Network error" }
    }
  },

  async login(email: string, password: string): Promise<ApiResponse<{ user: { id: string; name: string; email: string; emailVerified?: boolean } }>> {
    try {
      const response = await fetch(`${API_BASE}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        credentials: "include",
      })
      const json = await response.json()
      if (!response.ok) return { success: false, error: json?.error || "Login failed", code: json?.code }
      return json
    } catch {
      return { success: false, error: "Network error" }
    }
  },

  async getMe(): Promise<ApiResponse<{ user: { id: string; name: string; email: string; emailVerified?: boolean } }>> {
    return request("/v1/auth/me")
  },

  logout() {
    return request<{ loggedOut: boolean }>("/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    })
  },

  // Partners
  getPartners() {
    return request<any[]>("/v1/partners")
  },

  getPartner(id: number | string) {
    return request<any>(`/v1/partners/${id}`)
  },

  createPartner(partnerData: any) {
    return request<any>("/v1/partners", {
      method: "POST",
      body: JSON.stringify(partnerData),
    })
  },

  updatePartner(id: number | string, partnerData: any) {
    return request<any>(`/v1/partners/${id}`, {
      method: "PUT",
      body: JSON.stringify(partnerData),
    })
  },

  deletePartner(id: number | string) {
    return request<void>(`/v1/partners/${id}`, {
      method: "DELETE",
    })
  },

  // Certificates
  getCertificates() {
    return request<any[]>("/v1/certificates")
  },

  getCertificate(id: number | string) {
    return request<any>(`/v1/certificates/${id}`)
  },

  uploadCertificate(form: {
    file: File | null
    rawContent?: string
    name: string
    partner: string
    usage: string
    type: string
    environment: string
  }) {
    const formData = new FormData()
    if (form.file) formData.append("file", form.file)
    formData.append("name", form.name)
    formData.append("partner", form.partner)
    formData.append("usage", form.usage)
    formData.append("type", form.type)
    formData.append("environment", form.environment)
    if (form.rawContent?.trim()) formData.append("rawContent", form.rawContent)
    return request<any>("/v1/certificates", { method: "POST", body: formData })
  },

  deleteCertificate(id: number | string) {
    return request<void>(`/v1/certificates/${id}`, {
      method: "DELETE",
    })
  },

  downloadCertificate(id: number | string) {
    return download(`/v1/certificates/${id}/download`, `certificate-${id}.pem`)
  },

  // Specifications (section: 'unis' | 'tp' | 'all', default 'all' returns { unis, tp })
  getSpecifications(params?: { section?: "all" | "unis" | "tp" }) {
    const q = params?.section ? `?section=${params.section}` : ""
    return request<any[] | { unis: any[]; tp: any[] }>(`/v1/specifications${q}`)
  },

  uploadSpecification(form: Record<string, string | File>) {
    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value)
    })
    return request<any>("/v1/specifications/upload", { method: "POST", body: formData })
  },

  downloadSpecification(specId: string) {
    return download(`/v1/specifications/${specId}/download`, `spec-${specId}`)
  },

  downloadUnisSpecification(code: string) {
    return download(`/v1/specifications/unis/${code}/download`, `unis-${code}.txt`)
  },

  // Transactions
  getTransactions(query?: Record<string, string>) {
    const search = query ? `?${new URLSearchParams(query).toString()}` : ""
    return request<any[]>(`/v1/transactions${search}`)
  },

  getTransaction(id: string) {
    return request<any>(`/v1/transactions/${id}`)
  },

  uploadTransaction(form: Record<string, string | File>) {
    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value)
    })
    return request<any>("/v1/transactions", { method: "POST", body: formData })
  },

  getRelatedTransactions(id: string) {
    return request<any[]>(`/v1/transactions/${id}/related`)
  },

  exportTransactions(format: "csv" | "xlsx", environment?: string) {
    const params = new URLSearchParams({ format })
    if (environment) params.set("environment", environment)
    return download(`/v1/transactions/export?${params.toString()}`, `transactions.${format}`)
  },

  // Notifications
  getNotifications() {
    return request<any[]>("/v1/notifications")
  },

  // Dashboard
  getVersion() {
    return request<{ version: string; name: string }>("/v1/meta/version")
  },

  getMyOauthClients() {
    return request<Array<{ client_id: string; name: string; status: string; scopes: string[]; environment: string; created_at?: string | null; last_used_at?: string | null }>>("/v1/oauth/my/clients")
  },

  createMyOauthClient(payload: { name: string; scopes: string[]; environment: "production" | "sandbox" | "all" }) {
    return request<{ client_id: string; client_secret: string; scopes: string[]; environment: string }>("/v1/oauth/my/clients", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  rotateMyOauthClientSecret(clientId: string) {
    return request<{ client_id: string; client_secret: string; rotated: boolean }>(`/v1/oauth/my/clients/${clientId}/rotate-secret`, {
      method: "POST",
      body: JSON.stringify({}),
    })
  },

  updateMyOauthClientStatus(clientId: string, status: "active" | "disabled") {
    return request<{ client_id: string; status: string }>(`/v1/oauth/my/clients/${clientId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  },

  updateNotification(id: number | string, data: any) {
    return request<any>(`/v1/notifications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  markNotificationRead(id: number | string) {
    return request<any>(`/v1/notifications/${id}/read`, {
      method: "PUT",
    })
  },

  markAllNotificationsRead(environment?: string) {
    return request<any>("/v1/notifications/mark-all-read", {
      method: "PUT",
      body: JSON.stringify(environment ? { environment } : {}),
    })
  },

  // API docs
  getApiMessages(params?: { category?: string; search?: string }) {
    const search = new URLSearchParams()
    if (params?.category) search.set("category", params.category)
    if (params?.search) search.set("search", params.search)
    const q = search.toString()
    return request<any[]>(`/v1/api-docs/messages${q ? `?${q}` : ""}`)
  },

  getApiMessage(code: string) {
    return request<any>(`/v1/api-docs/messages/${code}`)
  },

  getApiMessageSchema(code: string) {
    return request<Record<string, unknown>>(`/v1/api-docs/messages/${code}/schema`)
  },

  getApiMessageMapping(code: string) {
    return request<any[]>(`/v1/api-docs/messages/${code}/mapping`)
  },

  getApiMessageSamples(code: string) {
    return request<any[]>(`/v1/api-docs/messages/${code}/samples`)
  },

  // Connection testing
  runAs2ConnectionTest(payload: Record<string, unknown>) {
    return request<any>("/v1/connection-testing/as2/run", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  runApiConnectionTest(payload: Record<string, unknown>) {
    return request<any>("/v1/connection-testing/api/run", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  getConnectionRuns(params?: { environment?: string; testType?: string; partnerId?: string }) {
    const search = new URLSearchParams()
    if (params?.environment) search.set("environment", params.environment)
    if (params?.testType) search.set("testType", params.testType)
    if (params?.partnerId) search.set("partnerId", params.partnerId)
    const q = search.toString()
    return request<any[]>(`/v1/connection-testing/runs${q ? `?${q}` : ""}`)
  },

  getConnectionRun(runId: string) {
    return request<any>(`/v1/connection-testing/runs/${runId}`)
  },

  createDocumentTest(payload: Record<string, unknown>) {
    return request<any>("/v1/connection-testing/document-tests", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  validatePayload(payload: Record<string, unknown>) {
    return request<any>("/v1/connection-testing/validator/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  // Partner routing
  getSubsidiaryRouting(partnerId: string, subsidiaryId: string) {
    return request<any>(`/v1/partners/${partnerId}/subsidiaries/${subsidiaryId}/routing`)
  },

  updateSubsidiaryRouting(partnerId: string, subsidiaryId: string, payload: Record<string, unknown>) {
    return request<any>(`/v1/partners/${partnerId}/subsidiaries/${subsidiaryId}/routing`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  },

  updateAs2Profile(
    partnerId: string,
    subsidiaryId: string,
    profileId: string,
    payload: {
      name?: string
      as2Url?: string
      as2Port: number
      senderId: string
      senderQualifier: string
      receiverId: string
      receiverQualifier: string
    },
  ) {
    return request<any>(`/v1/partners/${partnerId}/subsidiaries/${subsidiaryId}/as2-profiles/${profileId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  },
}
