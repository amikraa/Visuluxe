# Architecture & Functional Overview

## 1) High-Level Overview

Visuluxe is a React + Vite single-page application backed by Supabase. It offers AI image generation for end users, a credit system for usage tracking, API key management for programmatic access, notifications, and a dedicated admin console for operational controls. The frontend lives in `src/`, while backend logic is implemented via Supabase Edge Functions in `supabase/functions/`, backed by a Postgres schema defined in the migration SQL.

**Primary users**
- **End users**: generate images, manage credits, view history, and create API keys.
- **Admins/operators**: manage models/providers/users, billing, security, and analytics via the admin console.

## 2) Architecture Breakdown

### Frontend
- **Framework**: React + Vite, entry at `src/main.tsx`.
- **Routing**: React Router in `src/App.tsx`, with public, protected, and admin routes. Admin routes are nested under `/admin`.
- **State/Data**:
  - Auth state in `AuthContext` (profile sync + fallback creation).
  - Role state in `AdminContext`.
  - Server data via TanStack Query hooks (credits, models, analytics, notifications).

### Backend (Supabase Edge Functions)
- **generate-image**: Validates auth, maintenance mode, bans, IP blocklist, and rate limits before generating images and logging requests.
- **create-api-key**: Generates and hashes API keys, inserts into `api_keys`.
- **manage-provider-keys**: Encrypts/decrypts provider keys with admin checks and rate limits.
- **test-provider-connection**: Admin-only provider health checks with per-provider rate limiting.
- **refresh-analytics-cache**: Pre-computes analytics caches for reporting.

### Database Layer (Supabase Postgres)
Key tables include:
- **User/roles**: `profiles`, `user_roles`.
- **Credits/billing**: `user_credits`, `credits_transactions`, `invoices`.
- **AI models/providers**: `ai_models`, `providers`.
- **Images/usage**: `images`, `request_logs`.
- **Security/audit**: `security_events`, `ip_blocklist`, `admin_audit_logs`.
- **Notifications/settings**: `notifications`, `system_settings`, `admin_invites`.

### Authentication
Supabase Auth powers email/password and OAuth (Google), with optional OTP/magic-link settings sourced from `system_settings`. Auth state + profile fallback creation are handled in `AuthContext`.

### External Integrations
- **AI generation**: Edge function uses system settings and `LOVABLE_API_KEY` to call model providers via server-side logic.
- **Supabase Storage**: Invoices and notification attachments use storage buckets (`invoice-files`, `notification-attachments`).

## 3) Feature Map (Major Features + Data Flow)

### User Features
1. **Image Generation**
   - UI: `src/pages/Generate.tsx`
   - Flow: UI → `generate-image` edge function → `images` + `request_logs` tables → UI refresh and credits update.

2. **Dashboard & History**
   - UI: `src/pages/Dashboard.tsx`
   - Flow: UI → `user_credits`, `images`, `api_keys` queries → UI render.

3. **API Key Management**
   - UI: `src/components/APIKeyCreationModal.tsx`
   - Flow: UI → `create-api-key` edge function → `api_keys` table → UI refresh.

4. **Notifications**
   - UI: `src/pages/Notifications.tsx` + `useNotifications`
   - Flow: UI ↔ `notifications` table; attachments via storage bucket downloads.

### Credits & Billing
1. **Credits Tracking**
   - Hook: `useUserCredits` + `useUserStats`
   - Flow: UI → `user_credits`, `images`, `request_logs` → UI stats and balances.

2. **Admin Billing**
   - UI: `src/pages/admin/AdminBilling.tsx`
   - Flow: Admin UI → `user_credits`/`credits_transactions`/`invoices` tables → UI updates; invoice files stored in Supabase Storage.

## 4) Admin Panel Deep Dive

### Access & Roles
Admin access is enforced by `AdminProtectedRoute`, using role data from `AdminContext` (`user_roles` table). Analysts are read-only and shown a banner.

### Admin Capabilities
- **Users**: role management, orphaned user detection, profile syncs.
- **Models/Providers**: manage models/providers, encrypt keys, test connectivity.
- **Security**: IP blocklist, security events, bans, system security toggles.
- **Billing**: credit adjustments, transactions, invoice management.
- **Analytics**: reporting and CSV export for usage and credits.
- **Settings**: maintenance mode, auth settings (OTP/magic-link), daily credits defaults.

## 5) Security & Permissions

- **Role system**: roles in `user_roles`, enforced in `AdminProtectedRoute`.
- **Protected routes**: `ProtectedRoute` for user pages, `AdminProtectedRoute` for admin pages.
- **Error sanitization**: `errorUtils` blocks sensitive info from leaking to the UI.
- **Rate limiting**: enforced in `generate-image` (RPM/RPD) and provider tests (in-memory).

## 6) Data Flow Examples

1. **User login**
   - UI (`SignIn`) → Supabase Auth → `AuthContext` profile fetch/fallback → UI session state.

2. **Generate image**
   - UI (`Generate`) → `generate-image` edge function → DB insert/updates → UI refresh + credit refetch.

3. **Credit adjustment**
   - Admin UI (`AdminBilling`) → update `user_credits` + insert `credits_transactions` → UI refresh.

4. **Admin provider test**
   - Admin UI (`AdminProviders`) → `test-provider-connection` edge function → UI result toast/modal.

## 7) Testing & Reliability

- **Tests**: Vitest configuration and error-utils unit tests are present. Expand coverage for critical flows (generation, billing, admin actions) for stronger guarantees.
- **Reliability controls**: maintenance-mode gating, rate limits, audit logs, and analytics caching are implemented server-side.

## 8) Deployment & Environment

Key environment variables:
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Edge functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `LOVABLE_API_KEY`, `ENCRYPTION_KEY`, `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`.

Build scripts are defined in `package.json` for `dev`, `build`, and `preview`.

## 9) Summary

Visuluxe is a Supabase-backed AI image platform with a React/Vite frontend, serverless edge functions for core operations, and a comprehensive admin console. It combines credit-based usage, API key access, notifications, and extensive administrative tooling for system management and observability.
