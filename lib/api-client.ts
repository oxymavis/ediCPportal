// API client for FastAPI backend (/v1)

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

// 为空字符串时走同源（Next 反向代理到后端），便于 ngrok 单域名访问
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL !== undefined ? process.env.NEXT_PUBLIC_API_BASE_URL : "http://localhost:8000"

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/edi_csrf=([^;]+)/)
  return m ? m[1] : null
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
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
    })

    const json = await response.json()
    if (!response.ok && json?.success !== false) {
      return {
        success: false,
        error: json?.error || `HTTP ${response.status}`,
        code: json?.code,
      }
    }

    return json
  } catch {
    return { success: false, error: "Network error" }
  }
}

export const apiClient = {
  getHealth() {
    return request<{ status: string; version?: string }>("/v1/meta/health")
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
    file: File
    name: string
    partner: string
    usage: string
    type: string
    environment: string
  }) {
    const formData = new FormData()
    formData.append("file", form.file)
    formData.append("name", form.name)
    formData.append("partner", form.partner)
    formData.append("usage", form.usage)
    formData.append("type", form.type)
    formData.append("environment", form.environment)
    return request<any>("/v1/certificates", { method: "POST", body: formData })
  },

  deleteCertificate(id: number | string) {
    return request<void>(`/v1/certificates/${id}`, {
      method: "DELETE",
    })
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

  // Notifications
  getNotifications() {
    return request<any[]>("/v1/notifications")
  },

  // Dashboard
  getVersion() {
    return request<{ version: string; name: string }>("/v1/meta/version")
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

  getConnectionRuns(params?: { environment?: string; testType?: string }) {
    const search = new URLSearchParams()
    if (params?.environment) search.set("environment", params.environment)
    if (params?.testType) search.set("testType", params.testType)
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
}
