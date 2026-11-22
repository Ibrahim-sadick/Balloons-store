"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Eye, EyeOff, ShieldAlert } from "lucide-react"
import { BrandMark } from "@/components/layout/sidebar"
import { fieldInputClass, FormError, SlateButton, Spinner } from "@/components/controls"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { startNavProgress } from "@/lib/nav-progress"
import { useStore } from "@/lib/store"

/**
 * How long a refused sign-in stays on screen before the answer is shown. The
 * API answers in ~200 ms, which the eye reads as a flicker; this holds the
 * spinner for five seconds so the click visibly did something. A successful
 * sign-in is timed by the loading line at the top instead, which is the same
 * wait the dashboard itself is held behind.
 */
const MIN_BUSY_MS = 5000

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Where to hand over to once the store says yes. A scan of an asset tag arrives
 * as /login?next=/equipment/<id>, and dropping a visitor on the dashboard after
 * they asked for one machine would lose the whole point of the printed square.
 * The address is read at the hand-off rather than through searchParams, so this
 * page still needs nothing from the request and can be served from cache. Only
 * a path on this store is honoured, and never back to this page, so a
 * hand-edited link cannot bounce a visitor elsewhere.
 */
function afterSignIn() {
  const next = new URLSearchParams(window.location.search).get("next")
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")) return next
  return "/dashboard"
}

export function LoginForm() {
  const router = useRouter()
  const { signIn, session, ready } = useStore()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [denied, setDenied] = React.useState(false)

  React.useEffect(() => {
    // `!busy` keeps a successful sign-in from navigating away mid-spinner, which
    // would make the five-second hold invisible.
    if (ready && session && !busy) router.replace(afterSignIn())
  }, [ready, session, busy, router])

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
            if (busy) return
            setBusy(true)
            setError("")
            setDenied(false)
            const startedAt = Date.now()
            const result = await signIn(email, password)
            if (!result.ok) {
              const remaining = MIN_BUSY_MS - (Date.now() - startedAt)
              if (remaining > 0) await wait(remaining)
              setBusy(false)
              // Only a rejected email/password pair is an access refusal; a server
              // that is down or a blocked attempt keeps its own wording.
              setDenied(Boolean(result.denied))
              setError(result.denied ? "" : result.message)
              return
            }
            // The card stays on "Signing in" while the line crosses the bar; the
            // effect above only hands over to the dashboard once busy falls, so
            // the wait is one animation and not a spinner racing a route swap.
            // The card is cleared here, not after the hand-off: Next keeps this
            // page mounted behind the dashboard, so a leftover "Signing in", an
            // old denial notice or a typed password would be on screen the next
            // time /login is shown.
            startNavProgress(() => {
              setBusy(false)
              setDenied(false)
              setError("")
              setPassword("")
            })
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              name="email"
              // Phone keyboards otherwise capitalise the first letter and
              // "correct" the address, which the server then rightly refuses.
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
          {denied ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-2 text-[11px] leading-relaxed text-rose-700"
            >
              <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>You have no access to use this system.</span>
            </div>
          ) : null}
          <SlateButton type="submit" disabled={busy} aria-busy={busy}>
            {busy ? "Signing in" : "Continue"}
            {busy ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            )}
          </SlateButton>
        </form>
      </div>
    </div>
  )
}
