---

# Visuluxe — Full Technical Audit & Codebase Documentation

---

## Terminal Commands Used for This Analysis

The following commands were used during repository inspection:

```bash
pwd && ls

rg --files src supabase docs | sed -n '1,220p'

nl -ba package.json | sed -n '1,220p'
nl -ba tsconfig.json | sed -n '1,220p'
nl -ba tsconfig.app.json | sed -n '1,220p'
nl -ba vite.config.ts | sed -n '1,220p'
nl -ba vitest.config.ts | sed -n '1,220p'

nl -ba src/App.tsx | sed -n '1,220p'
nl -ba src/contexts/AuthContext.tsx | sed -n '1,280p'
nl -ba src/contexts/AdminContext.tsx | sed -n '1,220p'
nl -ba src/components/ProtectedRoute.tsx | sed -n '1,120p'
nl -ba src/components/admin/AdminProtectedRoute.tsx | sed -n '1,220p'
nl -ba src/pages/Generate.tsx | sed -n '1,260p'
nl -ba src/pages/admin/AdminDashboard.tsx | sed -n '1,240p'

nl -ba src/components/docs/sections/ErrorsSection.tsx | sed -n '1,80p'
nl -ba src/lib/errorUtils.ts | sed -n '1,240p'
nl -ba src/lib/logger.ts | sed -n '1,120p'
nl -ba src/lib/__tests__/errorUtils.test.ts | sed -n '1,120p'

nl -ba src/integrations/supabase/client.ts | sed -n '1,120p'

nl -ba supabase/functions/generate-image/index.ts | sed -n '1,340p'
nl -ba supabase/functions/create-api-key/index.ts | sed -n '1,260p'
nl -ba supabase/functions/manage-provider-keys/index.ts | sed -n '1,280p'
nl -ba supabase/functions/scheduled-profile-sync/index.ts | sed -n '1,220p'

nl -ba supabase/config.toml | sed -n '1,240p'
nl -ba docs/migrations/lovable_cloud_to_custom_supabase.sql | sed -n '40,420p'
nl -ba README.md | sed -n '1,220p'
nl -ba docs/architecture.md | sed -n '1,240p'
nl -ba .env | sed -n '1,120p'
nl -ba .gitignore | sed -n '1,220p'

wc -l ...
````

Additional analysis:

* Python snippet for extension/LOC distribution
* Python snippet for top-level directory snapshot

---

# 1) PROJECT OVERVIEW & PURPOSE

## Project Name

**Visuluxe**

## Primary Purpose

A web-based AI image generation SaaS platform featuring:

* User authentication
* AI image generation via backend Edge Functions
* Credit-based consumption model
* API key lifecycle management
* Full admin governance suite

## Target Audience

* End-users generating images
* Developers using Visuluxe API
* Platform administrators

## Use Cases

* Generate AI images with credit enforcement
* Integrate Visuluxe API into external apps
* Manage users, billing, providers, and analytics
* Security moderation and abuse prevention

## Domain

AI SaaS / Developer Platform / Image Generation

## Maturity Assessment

Late-beta to production-intent:

* Strong admin + security module depth
* Some dashboard metrics still placeholder
* Minimal automated testing

---

# 2) TECHNOLOGY STACK & VERSIONS

## Programming Languages

| Language         | Usage                     |
| ---------------- | ------------------------- |
| TypeScript / TSX | Frontend & Edge Functions |
| SQL              | Schema + Migrations       |
| CSS              | Styling                   |
| Markdown         | Documentation             |
| HTML             | App Shell                 |

### Approximate LOC Distribution

* `.tsx` ~47.7%
* `.ts` ~10.1%
* `.sql` ~10.8%
* `.json` ~12.1%
* `.md` ~0.9%
* `.css` ~0.8%

---

## Frameworks & Libraries

### Frontend

* React 18.3.1
* React Router DOM 6.30.1
* TanStack React Query 5.83.0
* Zod 3.25.76
* Radix UI
* TailwindCSS 3.4.17

### Backend

* Supabase JS 2.90.0
* Supabase Edge Functions (Deno runtime)

### Build & Tooling

* Vite 5.4.19
* Vitest 2.1.5
* npm (primary)
* bun.lockb present (optional Bun usage)

---

## Runtime Environments

* Node.js (Vite dev/build)
* Deno (Supabase Edge Functions)
* Postgres (Supabase DB)

---

# 3) COMPLETE CODEBASE STRUCTURE

## Top-Level Structure

```
Visuluxe/
├── README.md
├── docs/
├── src/
├── supabase/
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig*.json
└── public/
```

---

## Major Modules

### src/App.tsx

* Root composition
* Providers + Router
* Maintenance gate

### AuthContext.tsx

* Auth listener
* Profile fallback creation
* Credit initialization

### AdminContext.tsx

* Role resolution
* Capability flags

### Generate.tsx

* Core image generation UI
* Error mapping + retries

### supabase/functions/generate-image

* JWT/API key auth
* Rate limiting
* Maintenance checks
* Credit enforcement
* Model fallback logic

---

# 4) HOW THE CODE WORKS

## Application Lifecycle

1. `main.tsx` mounts `<App />`
2. QueryClient + AuthProvider initialized
3. Session hydration
4. Role resolution
5. Route gating
6. Feature rendering

---

## Core Feature Flow — Image Generation

### Frontend

* Prompt validation
* Model selection
* Credit pre-check
* Edge function call

### Backend

* Auth verification
* Maintenance + ban checks
* IP blocklist
* Rate limiting
* Model status validation
* Credit deduction
* Logging

---

# 5) DATA MODELS

Core tables:

* profiles
* user_roles
* user_credits
* system_settings
* admin_audit_logs
* ip_blocklist
* security_events
* providers
* ai_models
* api_keys
* images
* request_logs
* credits_transactions
* invoices
* notifications
* analytics_cache

---

# 6) ROUTES & API ENDPOINTS

## Frontend Routes

### Public

* `/`
* `/docs`
* `/signin`
* `/signup`
* `/pricing`

### Protected

* `/dashboard`
* `/generate`
* `/notifications`

### Admin

* `/admin/*`

---

## Edge Functions

* generate-image
* create-api-key
* manage-provider-keys
* test-provider-connection
* refresh-analytics-cache
* scheduled-profile-sync
* assign-external-admin

⚠️ `verify_jwt = false` in config.toml

---

# 7) AUTHENTICATION & AUTHORIZATION

## Authentication

* Supabase Auth
* Email/password
* OAuth (Google)
* Optional OTP/magic link

## Authorization

* ProtectedRoute (user)
* AdminProtectedRoute (role-based)
* RPC checks in Edge Functions

---

# 8) CODE QUALITY ANALYSIS

## Strengths

* Clean modular SPA structure
* Lazy loading
* Centralized error sanitization
* Strong admin guard patterns

## Weaknesses

* `strict: false` in TS config
* Minimal test coverage
* Placeholder admin metrics

---

# 9) CRITICAL ISSUES

## 1) JWT Verification Disabled (High)

* `verify_jwt = false` globally
* Relies on manual checks
* Increased attack surface

**Fix:** Enable verify_jwt where possible.

---

## 2) `.env` Not Ignored (High)

* `.env` present
* No ignore rule
* Risk of secret leakage

**Fix:** Add `.env*` to `.gitignore`

---

## 3) README Citation Artifact (Medium)

* Internal citation token leaked
* Documentation polish issue

---

## 4) Placeholder Admin Metrics (Medium)

* Hardcoded values in dashboard

---

## 5) Low Test Coverage (Medium)

* Only one test file
* Critical paths untested

---

# 10) MISSING INFRASTRUCTURE

* No CI config
* No integration tests
* No `.env.example`
* No structured logging strategy
* No API auto-generated docs

---

# 11) PERFORMANCE & SCALABILITY

## Strengths

* Lazy-loaded routes
* Analytics caching table

## Bottlenecks

* Multiple DB reads per generation
* Rate limit queries per request
* Large monolithic admin pages

---

# 12) MAINTAINABILITY

## Improvements Recommended

* Enable TypeScript strict mode gradually
* Add CI pipeline
* Add integration tests
* Refactor large admin files
* Harden JWT verification strategy

---

# 13) SIGNIFICANT FILE INVENTORY

| File                                 | LOC  | Complexity   |
| ------------------------------------ | ---- | ------------ |
| Generate.tsx                         | 693  | Complex      |
| Dashboard.tsx                        | 758  | Complex      |
| AdminBilling.tsx                     | 1303 | Very Complex |
| generate-image/index.ts              | 566  | Very Complex |
| manage-provider-keys/index.ts        | 451  | Complex      |
| lovable_cloud_to_custom_supabase.sql | 632  | Complex      |

---

# EXECUTIVE SUMMARY

Visuluxe is a serious Supabase-backed AI SaaS platform with:

* Broad user features
* Extensive admin plane
* Security + billing systems
* Modular SPA + serverless backend architecture

## Top Risks

1. `verify_jwt = false`
2. Low automated testing
3. `.env` tracking
4. Minor documentation leakage

## Production Readiness Path

* Harden security configuration
* Add CI + testing
* Improve type strictness
* Refactor large admin modules

---

**Conclusion:**
Visuluxe is architecturally strong and feature-rich but requires security hygiene improvements and stronger automated testing to reach hardened production maturity.


```
