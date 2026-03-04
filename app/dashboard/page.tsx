"use client"

import { useEffect, useState } from "react"
import DashboardLayout from "@/components/dashboard/dashboard-layout"

const DEFAULT_USER = { email: "admin@unis-edi.com", name: "Admin" }

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    } else {
      // Auto-login with default user for preview
      localStorage.setItem("user", JSON.stringify(DEFAULT_USER))
      setUser(DEFAULT_USER)
    }
  }, [])

  if (!user) return null

  return <DashboardLayout user={user} />
}
