"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Eye, EyeOff } from "lucide-react"
import { BrandMark } from "@/components/layout/sidebar"
import { fieldInputClass, FormError, SlateButton } from "@/components/controls"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"

export function LoginForm() {
  const router = useRouter()
  const { signIn, session, ready } = useStore()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (ready && session) router.replace("/dashboard")
  }, [ready, session, router])

  return (
    <div className="w-full max-w-md">
      <div className="mb-4 flex justify-center">
        <BrandMark />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h1 className="text-[13px] font-normal tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1 text-[11px] text-slate-500">
          Sign in with the email and password issued for this store.
        </p>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            setError("")
            const result = await signIn(email, password)
            setBusy(false)
            if (!result.ok) {
              setError(result.message)
              return
            }
            router.push("/dashboard")
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldInputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${fieldInputClass} pr-8`}
              />
              <button
                type="button"
                className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
          <FormError message={error} />
          <SlateButton type="submit" disabled={busy}>
            {busy ? "Signing in" : "Continue"}
            <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          </SlateButton>
        </form>
      </div>
    </div>
  )
}
