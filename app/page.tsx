"use client"

import { useState } from "react"
import LoginForm from "@/components/auth/login-form"
import RegisterForm from "@/components/auth/register-form"

export default function Home() {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-bold text-lg tracking-wider">EDI</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">EDI Portal</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Electronic Data Interchange</p>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-8 space-y-6">
          {isLogin ? <LoginForm /> : <RegisterForm />}

          {/* Toggle Auth Mode */}
          <div className="flex items-center justify-center gap-2 text-sm text-center">
            <span className="text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </span>
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-primary/80 font-semibold transition-colors"
            >
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground">Secure document exchange for modern businesses</p>
        </div>
      </div>
    </div>
  )
}
