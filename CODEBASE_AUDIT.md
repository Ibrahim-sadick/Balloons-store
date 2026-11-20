# Balons Store — Codebase Audit

**Scope:** `equipment-store` (Next.js frontend) and `equipmen-backend` (Express + Prisma API)
**Type:** Read-only audit. No source file was modified, moved, renamed or deleted to produce this report.
**Status:** Recommendations only — awaiting approval before any implementation.

---

## 0. Executive Summary

The system is small, domain-focused and already in better shape than most projects at this stage: both projects compile under TypeScript `strict` with **0 type errors**, stock rules are enforced on the server inside row-locked transactions, the frontend holds no data of its own, and the API returns friendly, consistent errors.

The main gaps are not in the business logic but in the engineering scaffolding around it:

| Area | Verdict |
|---|---|
| Correctness of stock rules | Good — server-side, transactional, `SELECT … FOR UPDATE` |
| Type safety | Good — strict mode, 0 `tsc` errors in both projects |
| Lint | **9 ESLint errors** in the frontend; backend has no linter |
| Tests | **None** in either project |
| Version control / CI | **No git repository, no CI** |
| Security | Login reveals which emails exist, no rate limiting, no security headers, JWT trusted for 7 days without a DB check |
| Architecture | Backend routes mix HTTP + business rules + data access; frontend has several 300–550-line "god" files |
| Scalability | Every write triggers a full `/api/bootstrap` reload of all history |

### Verified error inventory ("fix all errors")

| Check | Frontend | Backend |
|---|---|---|
| `tsc --noEmit` | 0 errors | 0 errors |
| ESLint | **9 errors** (listed in §3.2) | not configured |
| Runtime (DB connect, login, dashboard) | working | working (`/api/health` → connected) |

---

## 1. Current Project Architecture

```
┌──────────────────────────────┐        HTTPS/JSON         ┌────────────────────────────────┐        ┌──────────────────────┐
│ equipment-store (Next.js 16) │  ───────────────────────▶ │ equipmen-backend (Express 4)   │ ─────▶ │ MariaDB 10.4 (XAMPP) │
│  React 19 client components  │  Bearer JWT + httpOnly    │  routes → Prisma 6 → SQL       │ Prisma │ db: ballons_store    │
│  StoreProvider (context)     │  cookie  (port 3000→4000) │  zod validation, bcrypt, JWT   │        │ 9 tables + migrations│
└──────────────────────────────┘                           └────────────────────────────────┘        └──────────────────────┘
```

### 1.1 Frontend (`equipment-store`)

- **Framework:** Next.js 16.4.6 App Router, React 19.3, TypeScript 5 strict, Tailwind 4, shadcn "base-nova" on `@base-ui/react`.
- **Routing:** `(auth)/login`, `(auth)/register` (redirect only), `(dashboard)/{dashboard, equipment, equipment/[id], transactions, maintenance, reports, settings}`. Route `page.tsx` files are thin and delegate to `components/pages/*`.
- **State:** one React context (`src/lib/store.tsx`) holds the whole dataset (`equipment, transactions, maintenance, activity, users, categories, locations`). It is hydrated from `GET /api/bootstrap` and **re-fetched in full after every successful write**.
- **Session:** JWT kept in `sessionStorage["balons-session"]`; `shell.tsx` redirects to `/login` when the session is empty.
- **Derived data:** stock maths in `lib/stock.ts`, formatting in `lib/format.ts`, exports in `lib/csv.ts` / `lib/excel.ts` (dependency-free XLSX), thermal receipt in `lib/receipt.ts`.

### 1.2 Backend (`equipmen-backend`)

- **Stack:** Express 4, Prisma 6.19, zod, bcryptjs, jsonwebtoken, cookie-parser, cors; TypeScript (CommonJS).
- **Layers today:** `server.ts` → `app.ts` (middleware, error mapper) → `routes/*.routes.ts` (HTTP **and** business rules **and** Prisma calls) with helpers `stock.ts`, `register.ts`, `dto.ts`, `validation.ts`, `auth.ts`, `http.ts`, `errors.ts`, `text.ts`, `env.ts`, `db.ts`.
- **Domain model:** `Equipment` 1─n `Checkout` 1─n `CheckReturn`; `Equipment` 1─n `MaintenanceLog`; `ActivityEvent`; `Counter` (BLN / TX / IN / MN sequences); `User`, `Category`, `Location`.
- **Key invariant:** `available = quantity − outstanding check-outs − in-progress maintenance`, computed in SQL and protected by `SELECT … FOR UPDATE` on the equipment row (issue) and the checkout row (return).
- **Contract:** checkouts + returns are flattened into the legacy `Transaction` DTO the frontend expects.

### 1.3 Endpoint usage (verified against `store.tsx`)

| Endpoint | Used by frontend? |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout` | yes |
| `GET /api/bootstrap` | yes (after every write) |
| `POST/PATCH /api/equipment`, `POST /api/equipment/import` | yes |
| `POST /api/checkouts`, `POST /api/checkouts/:id/returns` | yes |
| `POST /api/maintenance`, `POST /api/maintenance/:id/complete` | yes |
| `PATCH /api/users/:id`, `POST /api/categories`, `POST /api/locations` | yes |
| `GET /api/auth/me`, all `GET` list endpoints, `/api/bootstrap/{equipment,activity,…}` | **no** (dead or future API surface) |

---

## 2. Existing Folder and File Structure

Line counts are non-blank lines.

### 2.1 Workspace root

```
BALONS STORE/
├── equipment-store/        # frontend
├── equipmen-backend/       # API (name kept as chosen)
└── (no .git, no README, no CI config)
```

### 2.2 Frontend

```
equipment-store/
├── AGENTS.md                      # Next agent rules — contains mojibake ("â€”")
├── README.md
├── components.json  eslint.config.mjs  next.config.ts  tsconfig.json
├── tsconfig.tsbuildinfo           # 227 KB build artefact in project root
├── .env.local  .env.example       # .gitignore pattern ".env*" also hides .env.example
├── public/                        # 5 default Next/Vercel SVGs (unused template files)
└── src/
    ├── air-balloon.png            # UNREFERENCED
    ├── shine baloons.png          # used by sidebar; space + misspelling in filename
    ├── app/
    │   ├── layout.tsx  page.tsx (→ /login)  globals.css  icon.png  apple-icon.png  favicon.ico
    │   ├── (auth)/layout.tsx  login/page.tsx  register/page.tsx (redirect only — dead)
    │   └── (dashboard)/layout.tsx  dashboard/ equipment/ equipment/[id]/ transactions/ maintenance/ reports/ settings/
    ├── components/
    │   ├── auth/login-form.tsx
    │   ├── dialogs/equipment-dialogs.tsx ...... 492   (Add, Edit, Issue, PrintTag)
    │   │           maintenance-dialogs.tsx .... 242
    │   │           return-dialog.tsx .......... 198
    │   ├── layout/command-menu.tsx  header.tsx 158  shell.tsx  sidebar.tsx 158
    │   ├── pages/dashboard-page.tsx ........... 531   (UsageDonut + TrendCalendar + page)
    │   │         equipment-page.tsx ........... 342
    │   │         reports-page.tsx ............. 291
    │   │         settings-page.tsx ............ 271
    │   │         transactions-page.tsx ........ 179
    │   │         maintenance-page.tsx ......... 173
    │   │         equipment-detail.tsx
    │   ├── ui/ (19 shadcn primitives)
    │   ├── controls.tsx 232  status-badge.tsx 137  empty-state.tsx  qr-mark.tsx
    └── lib/
        store.tsx 288  excel.ts 167  csv.ts 120  receipt.ts 120  types.ts 79
        stock.ts 69  api.ts 45  format.ts 23  utils.ts 1
```

### 2.3 Backend

```
equipmen-backend/
├── .env  .env.example  .gitignore  docker-compose.yml  package.json  tsconfig.json
├── prisma/
│   ├── schema.prisma 159   seed.ts 62
│   └── migrations/20261120100000_init/migration.sql  migration_lock.toml
└── src/
    ├── server.ts 16   app.ts 75   env.ts 27   db.ts 8
    ├── auth.ts 61     errors.ts 15   http.ts 28   text.ts 18
    ├── validation.ts 123   dto.ts 147   stock.ts 128   register.ts 79
    └── routes/
        equipment.routes.ts 258   checkouts.routes.ts 164   maintenance.routes.ts 103
        settings.routes.ts 87     auth.routes.ts 48         bootstrap.routes.ts 40
```

---

## 3. Problems Identified

Severity key: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low

### 3.1 Security

| # | Sev | Where | Problem | Impact |
|---|---|---|---|---|
| S1 | 🔴 | `auth.routes.ts` login | Two different messages: "No store account matches that email." vs "Password does not match this account." | Anyone can discover which emails have accounts. It also makes the `DUMMY_HASH` timing protection pointless. |
| S2 | 🟠 | `app.ts` / login route | No rate limiting or lockout on `/api/auth/login` | Unlimited password guessing |
| S3 | 🟠 | `auth.ts` `requireAuth` | JWT (7 days) is trusted without a DB lookup; `role` is read from the token with an unchecked cast `as Role` | A demoted or deleted user keeps their old rights for up to 7 days |
| S4 | 🟠 | `app.ts` | No security headers (helmet), `x-powered-by` exposed | Standard hardening missing |
| S5 | 🟡 | `auth.ts` + `store.tsx` | Two parallel auth channels: Bearer token in `sessionStorage` **and** httpOnly cookie | The token in `sessionStorage` can be read by any XSS; the cookie path adds CSRF surface (mitigated only by `sameSite: lax`). One mechanism should be chosen. |
| S6 | 🟡 | `auth.routes.ts` | Login cookie uses `secure: NODE_ENV==="production"`, logout clears with `secure: corsOrigins.length>0` | Mismatched attributes → logout may fail to clear the cookie in production |
| S7 | 🟡 | logout | JWT not revoked server-side | A copied token stays valid after logout |
| S8 | 🟡 | `GET /api/bootstrap` | Returns every user's email to every role, including VIEWER | Unnecessary data exposure |
| S9 | 🟡 | `lib/csv.ts` `escapeCell` | No protection against CSV formula injection (cells starting with `= + - @`) | An equipment name like `=HYPERLINK(...)` executes when the CSV is opened in Excel. (The XLSX export is **safe** — it writes `inlineStr` cells.) |
| S10 | ⚪ | `docker-compose.yml` | `root` / `root` credentials | Dev-only; must never be used beyond local |
| S11 | ⚪ | `package.json` | `db:reset` runs `prisma migrate reset --force` | One mistaken command wipes the database |
| S12 | ⚪ | XAMPP | MariaDB runs with a password-less `root` | Acceptable locally only |

### 3.2 Lint errors (frontend, verified with `npx eslint src`)

| File | Line | Rule |
|---|---|---|
| `dialogs/maintenance-dialogs.tsx` | 62, 202 | `react-hooks/set-state-in-effect` |
| `dialogs/return-dialog.tsx` | 53 | `react-hooks/set-state-in-effect` |
| `layout/shell.tsx` | 28 | `react-hooks/set-state-in-effect` |
| `pages/dashboard-page.tsx` | 210 | `react-hooks/set-state-in-effect` |
| `pages/dashboard-page.tsx` | 82 | `react-hooks/immutability` (`cursor -= sweep` inside `.map`) |
| `pages/equipment-page.tsx` | 57 | `react-hooks/set-state-in-effect` |
| `pages/maintenance-page.tsx` | 49 | `react-hooks/set-state-in-effect` |
| `pages/transactions-page.tsx` | 47 | `react-hooks/set-state-in-effect` |

All are the "copy props/URL into state inside `useEffect`" pattern. They cause an extra render and occasionally a flash of stale values. The fixes are mechanical: key the dialog by `open`/record id, derive from `searchParams` directly, or compute the donut offsets with a reduce.

### 3.3 Potential bugs

| # | Sev | Where | Problem |
|---|---|---|---|
| B1 | 🔴 | `equipment.routes.ts` `POST /import` | Up to 500 rows processed inside **one interactive `$transaction`** with several queries per row. Prisma's default interactive-transaction timeout is 5 s → large imports fail with `P2028` and roll back. |
| B2 | 🔴 | same | Duplicate serial numbers **within the same file** are not detected up-front; the second row hits `P2002`, the whole batch rolls back and the user only sees "That value is already in use." with no row number. |
| B3 | 🟠 | `lib/types.ts` | `STORE_TODAY` is computed **once at module load**. A tab left open overnight uses yesterday's date for defaults, overdue checks, reports and receipts. |
| B4 | 🟠 | `maintenance-dialogs.tsx`, `return-dialog.tsx` | No busy/disabled state on submit → double-click creates duplicate maintenance logs or a second partial return. |
| B5 | 🟡 | import route | `sentenceCase()` is applied to `manufacturer` and `notes`, so "DJI" becomes "Dji" and notes lose their capitalisation. |
| B6 | 🟡 | `checkouts.routes.ts` returns | `returnedOn` is not validated against `issuedOn` or against future dates. |
| B7 | 🟡 | `maintenance.routes.ts` complete | `completedOn` may be earlier than `openedOn`. |
| B8 | 🟡 | checkouts | Issuing writes `conditionOut` onto the equipment record, but returning does **not** write `conditionIn` back. The register shows the hand-over condition even after a damaged return. |
| B9 | 🟡 | `bootstrap.routes.ts` `/activity` | Builds activity rows with `toISOString()` (UTC) while `toActivityDto` uses `stamp()` (server-local `YYYY-MM-DDTHH:mm`), so the two formats are inconsistent. |
| B10 | 🟡 | `http.ts` `today()` / `stamp()` | Use the **server's** timezone; if the API is hosted in a different zone than the store, "today" shifts. |
| B11 | ⚪ | `prisma/seed.ts` | Default admin email is `admin@balons.store` (one "l") while `.env` uses `admin@ballons.store`. Works only because `.env` overrides it. |
| B12 | ⚪ | `reports-page.tsx` | `exportSection` has no error handling; a failed export fails silently. |
| B13 | ⚪ | DTOs | Refs (`TX-`, `IN-`, `MN-`) are stored but not exposed, so receipts cannot print the official reference. |

### 3.4 Performance

| # | Sev | Where | Problem |
|---|---|---|---|
| P1 | 🟠 | `store.tsx` `send()` | Every write re-downloads the entire dataset via `/api/bootstrap`. |
| P2 | 🟠 | `register.ts` / bootstrap | Bootstrap is unbounded (all checkouts, returns, maintenance, activity ever recorded). `nextDueByEquipment` and `registerSnapshot` each load all checkouts — the same data is read twice per request. |
| P3 | 🟡 | `lib/stock.ts` `countsFor` | Filters the full transaction list per item (O(items × transactions)); called from equipment page, reports (3×), dialogs. |
| P4 | 🟡 | `dashboard-page.tsx` | All aggregates recomputed on every render, no `useMemo`. |
| P5 | 🟡 | `store.tsx` | One context value for data + session + actions → every consumer re-renders on any change. |
| P6 | ⚪ | `checkouts.routes.ts` `GET /` | Loads everything, filters in memory (currently unused by the frontend). |

### 3.5 Duplicated code

| Duplicate | Locations |
|---|---|
| Unique short-code generator loop | `equipment.routes.ts` `resolveCategory`, `resolveLocation`; `settings.routes.ts` `POST /categories`, `POST /locations` (4 copies) |
| Transaction sort by `returnedOn ?? issuedOn` | `register.ts` `sortTransactions` and `checkouts.routes.ts` `GET /` |
| Equipment list | `/api/equipment` and `/api/bootstrap/equipment` |
| `CONDITIONS` option list | `equipment-dialogs.tsx` and `return-dialog.tsx` |
| URL `searchParams` → local state effect | `equipment-page.tsx`, `maintenance-page.tsx`, `transactions-page.tsx` |
| Dialog form reset | `useReset` hook in `equipment-dialogs.tsx`, re-implemented inline in `maintenance-dialogs.tsx` (2×) and `return-dialog.tsx` |
| Blob download helper | `downloadCsv` (`csv.ts`) and `downloadXlsx` (`excel.ts`) |
| Report header/row mapping | four near-identical export functions in `reports-page.tsx` |
| API contract types | frontend `lib/types.ts` ↔ backend `dto.ts` (hand-kept in sync) |

### 3.6 Large / mixed-responsibility files

| File | Lines | Responsibilities mixed |
|---|---|---|
| `pages/dashboard-page.tsx` | 531 | SVG donut maths, calendar maths, KPI aggregation, activity feed, layout |
| `dialogs/equipment-dialogs.tsx` | 492 | four dialogs, validation, QR, receipt printing |
| `pages/equipment-page.tsx` | 342 | table, filters, CSV file reading/parsing/import, dialog orchestration |
| `pages/reports-page.tsx` | 291 | four reports, date filtering, export mapping |
| `lib/store.tsx` | 288 | session, HTTP, state, every mutation, result wrapping |
| `pages/settings-page.tsx` | 271 | users, categories, locations tabs |
| `routes/equipment.routes.ts` | 258 | CRUD, import, category/location resolution, serial generation |

### 3.7 Naming & consistency

- Brand spelled four ways: **Balons** (UI, cookie `balons_token`, `balons-session`, `balons-mysql`), **ballons** (`ballons_store`, admin email), **baloons** (`shine baloons.png`), **balloon** (`air-balloon.png`).
- Route `/transactions` is labelled "Check In & Check Out"; backend calls the same concept `checkouts`.
- `SlateButton` renders emerald; `EmeraldButton` and `PillButton` are also emerald — three names for one style.
- Indentation glitches (lines starting at column 0 inside blocks) in `equipment-dialogs.tsx` and `excel.ts`. There is no Prettier/formatter config in either project.
- `EmptyState` declares an `icon` prop that is never rendered.
- `next.config.ts` still contains the template comment `/* config options here */`.
- Schema header says "MySQL 8.0" while the actual server is MariaDB 10.4.

### 3.8 Dependencies & configuration

| Item | Finding |
|---|---|
| `clsx`, `tailwind-merge` | **Unused** — not imported anywhere; the `cn` package replaces both |
| `shadcn` | CLI tool listed in `dependencies`; belongs in `devDependencies` |
| `class-variance-authority` | Used (`ui/button.tsx`, `ui/tabs.tsx`) — keep |
| `cn` | Imported directly by 11 `ui/*` files and re-exported by `lib/utils.ts`; app code uses `@/lib/utils`. Two import paths for one helper. |
| `public/*.svg` | Default Next/Vercel template icons, unused |
| `src/air-balloon.png` | Unreferenced |
| `src/app/(auth)/register/page.tsx` | Only redirects — dead route |
| `tsconfig.tsbuildinfo` | Build artefact in the project root |
| Frontend `.gitignore` | `.env*` also ignores `.env.example` |
| Frontend `lint` script | `"eslint"` without a path; no `typecheck` or `test` scripts |
| Backend | No ESLint, no Prettier, no `test` script, no request logging |
| Database | MariaDB 10.4 is end-of-life (June 2024) |
| Workspace | No git, no CI, no root README |

---

## 4. Code Quality Assessment

| Principle | Score (1–5) | Notes |
|---|---|---|
| Readability | 4 | Clear names, plain-English error messages, good intent comments on locking |
| Single responsibility | 2 | Routes and several React files do too many jobs |
| DRY | 3 | Duplication is moderate and well localised (§3.5) |
| Type safety | 4 | Strict TS, zod at the API edge; one unchecked role cast; contract duplicated |
| Error handling | 4 | Central error mapper, typed `ApiError`, Result-style frontend actions |
| Security | 2 | See §3.1 |
| Testability | 1 | No tests; business rules live inside route handlers, hard to unit-test |
| Consistency / formatting | 3 | No formatter; naming drift; 9 lint errors |
| Performance design | 3 | Correct today; full reload and unbounded bootstrap will not scale |
| Operability | 2 | No git, CI, structured logs or health-based monitoring beyond `/api/health` |

**Overall:** solid domain logic, weak engineering guard-rails. Nothing requires a rewrite; everything below is incremental.

---

## 5. Recommended Architecture

### 5.1 Backend — layered, feature-oriented

```
HTTP  ─▶  routes (wiring only)  ─▶  controllers (parse req, call service, send DTO)
                                         │
                                         ▼
                                    services (business rules, transactions, stock invariants)
                                         │
                                         ▼
                                    repositories (Prisma / raw SQL only)
```

- **Routes/controllers** contain no Prisma calls.
- **Services** own the rules (availability, partial returns, damage → repair, quantity floor) and accept a transaction client so they can be composed and unit-tested.
- **Repositories** are the only place that knows table names or `FOR UPDATE`.
- **Shared helpers:** one `uniqueCode()` generator, one `sortTransactions()`, one date/time module with an explicit store timezone.
- **Cross-cutting middleware:** helmet, rate limit on login, request id + logger (pino), central error mapper (exists).
- **Auth:** pick **one** channel (recommended: httpOnly cookie only, with CSRF token; or Bearer only, no cookie). `requireAuth` loads the user (or checks a `tokenVersion`) so role changes take effect immediately.

### 5.2 Frontend — feature modules

- `features/<domain>/` holds that domain's components, hooks and API calls; `components/ui` stays generic.
- Replace the single context with **data + actions split** (or a query cache such as TanStack Query) so writes update only the affected slice instead of re-fetching everything.
- Move pure maths (stock, donut, calendar, report rows) into `features/*/lib` as tested pure functions.
- A shared `useUrlFilter()` hook replaces the three copied `searchParams` effects; a shared `useDialogForm()` replaces the four reset patterns.
- `today()` becomes a function (or a hook that ticks at midnight) instead of the module constant `STORE_TODAY`.

### 5.3 Shared contract

Either a small `shared/` package (types + zod schemas) consumed by both projects, or generated types from an OpenAPI spec. This removes the hand-synced `types.ts` ↔ `dto.ts` duplication.

---

## 6. Proposed Folder Structure

### 6.1 Workspace

```
BALONS STORE/
├── .git/  .github/workflows/ci.yml  README.md  CODEBASE_AUDIT.md
├── equipment-store/
├── equipmen-backend/
└── shared/                       # optional: contract types + zod schemas
```

### 6.2 Backend

```
equipmen-backend/src/
├── server.ts
├── app.ts
├── config/            env.ts
├── lib/               db.ts  errors.ts  http.ts  dates.ts  text.ts  codes.ts (uniqueCode)
├── middleware/        auth.ts  rate-limit.ts  error-handler.ts  request-logger.ts
├── modules/
│   ├── auth/          auth.routes.ts  auth.controller.ts  auth.service.ts  auth.schemas.ts
│   ├── equipment/     equipment.routes.ts  equipment.controller.ts  equipment.service.ts
│   │                  equipment.repository.ts  equipment.import.ts  equipment.schemas.ts  equipment.dto.ts
│   ├── checkouts/     checkouts.routes.ts  …controller  …service  …repository  …schemas  …dto
│   ├── maintenance/   …
│   ├── settings/      users.*  categories.*  locations.*
│   ├── activity/      activity.service.ts  activity.dto.ts
│   └── bootstrap/     bootstrap.routes.ts  bootstrap.service.ts (register snapshot)
├── domain/            stock.ts (pure rules)  sequences.ts
└── tests/             unit/  integration/
```

### 6.3 Frontend

```
equipment-store/src/
├── app/                              # routes only (unchanged URLs)
├── assets/                           # brand-logo.png (renamed, no spaces)
├── components/
│   ├── ui/                           # shadcn primitives (untouched)
│   ├── layout/                       # shell, sidebar, header, command-menu
│   └── common/                       # controls, empty-state, status-badge, qr-mark
├── features/
│   ├── auth/          components/login-form.tsx  api.ts
│   ├── dashboard/     components/{usage-donut, trend-calendar, kpi-cards, activity-feed}.tsx
│   │                  lib/{dashboard-stats, donut-geometry}.ts  dashboard-page.tsx
│   ├── equipment/     components/{equipment-table, add-dialog, edit-dialog, issue-dialog, print-tag-dialog}.tsx
│   │                  hooks/use-equipment-import.ts  lib/equipment-csv.ts  equipment-page.tsx
│   ├── checkouts/     components/{checkout-table, return-dialog}.tsx  checkouts-page.tsx
│   ├── maintenance/   components/{maintenance-table, log-dialog, complete-dialog}.tsx  maintenance-page.tsx
│   ├── reports/       components/report-panel.tsx  lib/report-definitions.ts  reports-page.tsx
│   └── settings/      components/{users-tab, categories-tab, locations-tab}.tsx  settings-page.tsx
├── hooks/             use-url-filter.ts  use-dialog-form.ts  use-today.ts
├── lib/
│   ├── api/           client.ts  endpoints.ts
│   ├── store/         data-context.tsx  actions-context.tsx  session.ts
│   ├── domain/        stock.ts  constants.ts (CONDITIONS, statuses)
│   ├── export/        download.ts  csv.ts  excel.ts  receipt.ts
│   └── format.ts  utils.ts  types.ts
└── tests/
```

> URLs, UI and behaviour stay identical; only file locations and internal boundaries change.

---

## 7. Refactoring Priorities

Each item is independent and can be approved separately.

### 🔴 Critical — do first

1. **Initialise git** in the workspace and commit the current working state as a baseline (safety net for everything else).
2. **Unify login error message** (S1) → single "Email or password is incorrect."
3. **Fix CSV import transaction** (B1, B2): validate the whole file first (including in-file duplicate serials, with row numbers), then insert in bounded batches / with an explicit `timeout`.
4. **Add a minimal test harness** (Vitest) with tests around stock rules and returns before refactoring anything structural.

### 🟠 High

5. Fix the **9 ESLint errors** (§3.2) — no behaviour change.
6. **Rate-limit** `/api/auth/login`, add **helmet** (S2, S4).
7. `requireAuth` verifies the user still exists and uses the **DB role** (S3).
8. **Busy state** on maintenance and return dialogs (B4).
9. Replace `STORE_TODAY` constant with a live `today()` (B3).
10. **CSV formula-injection** guard in `escapeCell` (S9).
11. Stop full bootstrap reload after each write; bound bootstrap history (P1, P2).
12. Add ESLint + Prettier to the backend; add `typecheck`/`test` scripts to both; CI running lint + typecheck + tests.

### 🟡 Medium

13. Introduce service/repository layers in the backend, module by module (start with checkouts).
14. Split the large frontend files (§3.6) into feature folders.
15. Remove duplication (§3.5): `uniqueCode`, `sortTransactions`, `CONDITIONS`, `useUrlFilter`, `useDialogForm`, `download()`.
16. Date validation: `returnedOn ≥ issuedOn`, not in future; `completedOn ≥ openedOn` (B6, B7).
17. Decide and implement return-condition rule for the register (B8).
18. Consistent activity timestamp format and explicit store timezone (B9, B10).
19. Choose one auth channel, align cookie attributes, hide emails from VIEWER (S5, S6, S8).
20. Stop sentence-casing manufacturer/notes on import (B5).
21. `useMemo` / context split on dashboard and store (P3–P5).

### ⚪ Low

22. Remove unused deps `clsx`, `tailwind-merge`; move `shadcn` to devDependencies.
23. Remove dead files: `register/page.tsx`, `air-balloon.png`, template SVGs in `public/`.
24. Rename `shine baloons.png` → `assets/brand-logo.png`; settle on one brand spelling for identifiers.
25. Rename `SlateButton`/`EmeraldButton`/`PillButton` to one meaningful variant set.
26. Fix `.gitignore` (`.env*` → `.env*` + `!.env.example`), seed default email, AGENTS.md mojibake, schema "MySQL 8" comment, template comment in `next.config.ts`, `EmptyState.icon`.
27. Expose `ref` fields in DTOs for receipts (B13).
28. Plan upgrade from MariaDB 10.4 (EOL) to MariaDB 10.11 LTS / MySQL 8.

---

## 8. Potential Risks and Dependencies

| Risk | Mitigation |
|---|---|
| Refactoring without tests can silently break stock maths | Do items 1 and 4 first; snapshot tests on `/api/bootstrap` output before moving code |
| No version control → no rollback | Git baseline before any change |
| Frontend/backend contract drift during refactor | Keep `Transaction` DTO shape frozen; introduce shared types before splitting modules |
| Changing auth channel logs everyone out | Ship in one release; communicate re-login |
| Reworking state management touches every page | Do it after feature folders exist; migrate one page at a time |
| Import batching changes atomicity semantics | Keep validation-first "all or nothing" by validating before writing; document behaviour |
| DB upgrade (MariaDB 10.4 → newer) | Run `prisma migrate deploy` against the new server in a copy first |
| Bounding bootstrap history affects reports | Reports should then query the API with date ranges instead of relying on full history |

**Ordering dependencies:** 1 → 4 → (2, 3, 5–12 in any order) → 13/14 → 15–21 → 22–28.

---

## 9. Testing Recommendations

| Layer | Tool | What to cover first |
|---|---|---|
| Backend unit | Vitest | `summarise`/`statusFor`, `uniqueCode`, DTO flattening (`toTransactionDtos` with partial returns), zod schemas, `sentenceCase`/text helpers |
| Backend integration | Vitest + Supertest + dedicated test DB (`ballons_store_test`) | login (good/bad/unknown email gives same message), issue beyond stock → 400, partial return, over-return → 400, damaged return creates repair log, quantity floor on PATCH, import with in-file duplicate serial, concurrent issues (two parallel requests for the last unit) |
| Frontend unit | Vitest + React Testing Library | `lib/stock.ts`, `csv.ts` parse/escape (incl. formula guard), `excel.ts` produces valid zip, dialogs disable submit while busy, form validation messages |
| End-to-end | Playwright | login → add equipment → issue → partial return → damaged return → maintenance complete → report export; VIEWER cannot write |
| Static | ESLint, `tsc --noEmit`, Prettier check | run in CI on every push |
| CI | GitHub Actions (or similar) | install → lint → typecheck → unit → integration (MySQL service container) → build |

Target: business rules (stock, returns, maintenance) ≥ 90 % branch coverage; overall ≥ 70 %.

---

## 10. Next Step

Nothing in the application has been changed. Please reply with which priority groups (or individual numbered items from §7) you approve, and they will be implemented in that order with verification after each step.
