// API client for FastAPI backend (/v1)

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(init?.headers || {}),
      },
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

  // Specifications
  getSpecifications() {
    return request<any[]>("/v1/specifications")
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

  markAllNotificationsRead() {
    return request<any>("/v1/notifications/mark-all-read", {
      method: "PUT",
    })
  },
}
