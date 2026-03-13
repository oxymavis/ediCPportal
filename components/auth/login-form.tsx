"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("demo@example.com")
  const [password, setPassword] = useState("DemoPass1")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const res = await apiClient.login(email, password)
    setIsLoading(false)
    if (!res.success || !res.data?.user) {
      setError(res.error || "Login failed. Please try again.")
      return
    }
    localStorage.setItem("user", JSON.stringify({ email: res.data.user.email, name: res.data.user.name }))
    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
        <p className="font-medium text-foreground">测试账号已内置</p>
        <p className="text-muted-foreground mt-1">demo@example.com / DemoPass1</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-7 px-2 bg-transparent"
          onClick={() => {
            setEmail("demo@example.com")
            setPassword("DemoPass1")
          }}
        >
          一键填充测试账号
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Email</label>
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Password</label>
        <Input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        disabled={isLoading}
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  )
}
