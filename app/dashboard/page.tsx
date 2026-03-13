"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard/dashboard-layout"
import { apiClient } from "@/lib/api-client"

const AUTH_CHECK_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ])
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string; name: string } | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    withTimeout(apiClient.getMe(), AUTH_CHECK_TIMEOUT_MS)
      .then((r) => {
        if (cancelled) return
        setChecking(false)
        if (r.success && r.data?.user) {
          setUser({ email: r.data.user.email, name: r.data.user.name })
          localStorage.setItem("user", JSON.stringify({ email: r.data.user.email, name: r.data.user.name }))
        } else {
          router.replace("/")
        }
      })
      .catch(() => {
        if (cancelled) return
        setChecking(false)
        setError("无法连接后端，请确认后端已启动（端口 8000）")
      })
    return () => {
      cancelled = true
    }
  }, [router])

  if (checking && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">正在验证登录状态...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-sm rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            返回登录
          </button>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <DashboardLayout user={user} />
}
