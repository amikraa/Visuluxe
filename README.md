# Visuluxe Post-Refactor Production Audit

Audit timestamp (UTC): 2026-03-22

This document is a **code-evidence audit** performed after refactor. All claims below are backed by file+line references from the current repository state.

---

## 1) System Architecture Diagram

```text
User
 ↓
API Gateway
 ↓
Auth + Credits
 ↓
Job System
 ↓
Model Registry
 ↓
Provider Router
 ↓
Provider APIs
 ↓
R2 Storage
 ↓
Analytics

Config Service (global)
↓
All services use runtime config
```

Primary runtime flow is implemented across:
- API entry: [`backend/app/routers/images.py`](backend/app/routers/images.py:30)
- Queueing: [`backend/app/services/queue.py`](backend/app/services/queue.py:28)
- Processing + provider routing: [`backend/app/services/processor.py`](backend/app/services/processor.py:28)
- Storage: [`backend/app/services/storage.py`](backend/app/services/storage.py:112)
- Analytics updates: [`backend/app/services/processor.py`](backend/app/services/processor.py:397)

---

## 2) Model Registry System

### Registry tables
- `models`: [`supabase/migrations/20260314160000_create_model_registry.sql`](supabase/migrations/20260314160000_create_model_registry.sql:2)
- `model_providers`: [`supabase/migrations/20260314160000_create_model_registry.sql`](supabase/migrations/20260314160000_create_model_registry.sql:20)
- `model_analytics`: [`supabase/migrations/20260314160000_create_model_registry.sql`](supabase/migrations/20260314160000_create_model_registry.sql:35)

### Runtime usage proof
- Backend model lookup from `models`: [`backend/app/services/processor.py`](backend/app/services/processor.py:239)
- Provider mapping from `model_providers`: [`backend/app/services/processor.py`](backend/app/services/processor.py:251)
- Analytics write to `model_analytics`: [`backend/app/services/processor.py`](backend/app/services/processor.py:423)
- Edge function switched to `models` + `model_analytics`: [`supabase/functions/generate-image/index.ts`](supabase/functions/generate-image/index.ts:273), [`supabase/functions/generate-image/index.ts`](supabase/functions/generate-image/index.ts:600)

### ai_models status
- **Active backend/python runtime:** no `ai_models` references remain.
- **Frontend runtime files updated:** moved to `models` in key admin/hooks files.
- **Legacy historical SQL/docs artifacts:** still contain `ai_models` references (documented in Known Issues).

---

## 3) Configuration System

### Core service
- Service class: [`backend/app/services/config_service.py`](backend/app/services/config_service.py:23)
- `get()`: [`backend/app/services/config_service.py`](backend/app/services/config_service.py:87)
- `set()`: [`backend/app/services/config_service.py`](backend/app/services/config_service.py:127)
- `reload()` (added): [`backend/app/services/config_service.py`](backend/app/services/config_service.py:203)

### Backing store
- `system_settings` upsert/read path: [`backend/app/services/config_service.py`](backend/app/services/config_service.py:150), [`backend/app/services/config_service.py`](backend/app/services/config_service.py:234)

### TTL cache
- timeout = 300s: [`backend/app/services/config_service.py`](backend/app/services/config_service.py:29)
- expiry write: [`backend/app/services/config_service.py`](backend/app/services/config_service.py:229)
- expiry check: [`backend/app/services/config_service.py`](backend/app/services/config_service.py:220)

### Fallback env logic
- env fallback only in config service: [`backend/app/services/config_service.py`](backend/app/services/config_service.py:237)

---

## 4) Job System

### Queue
- queue service: [`backend/app/services/queue.py`](backend/app/services/queue.py:13)
- enqueue/dequeue: [`backend/app/services/queue.py`](backend/app/services/queue.py:28), [`backend/app/services/queue.py`](backend/app/services/queue.py:72)

### Concurrency + pause/resume controls
- runtime `max_concurrent_jobs` read: [`backend/app/services/queue.py`](backend/app/services/queue.py:140)
- runtime `queue_paused` read: [`backend/app/services/queue.py`](backend/app/services/queue.py:141)
- pause persists to config service: [`backend/app/services/queue.py`](backend/app/services/queue.py:117)
- resume persists to config service: [`backend/app/services/queue.py`](backend/app/services/queue.py:126)

### Priority system
- Priority fetch path: [`backend/app/services/database.py`](backend/app/services/database.py:428)
- Processing loop checks pause + concurrency before dequeuing: [`backend/app/services/processor.py`](backend/app/services/processor.py:466), [`backend/app/services/processor.py`](backend/app/services/processor.py:471)

---

## 5) Provider Routing Logic

Implemented in processor:
- filter active mappings: [`backend/app/services/processor.py`](backend/app/services/processor.py:109)
- health filtering: [`backend/app/services/processor.py`](backend/app/services/processor.py:114)
- cost sort asc: [`backend/app/services/processor.py`](backend/app/services/processor.py:125)
- fallback across providers: [`backend/app/services/processor.py`](backend/app/services/processor.py:129)

---

## 6) Storage System

### R2 usage
- upload by URL to R2: [`backend/app/services/storage.py`](backend/app/services/storage.py:133)
- signed URL generation: [`backend/app/services/storage.py`](backend/app/services/storage.py:167)

### Lifecycle / expiration config
- runtime lifetime key read (`r2_bucket_lifetime_days`): [`backend/app/services/storage.py`](backend/app/services/storage.py:139)
- expiration calculated from runtime setting: [`backend/app/services/storage.py`](backend/app/services/storage.py:160)

---

## 7) Security System

### API protection
- auth module + supabase client init (settings-based): [`backend/app/security.py`](backend/app/security.py:26), [`backend/app/security.py`](backend/app/security.py:30)

### Rate limiting + abuse detection
- monitor class: [`backend/app/services/security_monitoring.py`](backend/app/services/security_monitoring.py:14)
- runtime thresholds from config service: [`backend/app/services/security_monitoring.py`](backend/app/services/security_monitoring.py:44)

---

## 8) Monitoring System

### Telegram logging
- runtime config-driven initialization: [`backend/app/services/telegram_logger.py`](backend/app/services/telegram_logger.py:27)
- `telegram_alerts_enabled` control gate: [`backend/app/services/telegram_logger.py`](backend/app/services/telegram_logger.py:28), [`backend/app/services/telegram_logger.py`](backend/app/services/telegram_logger.py:31)

### Alert producers
- provider health alerts: [`backend/app/services/provider_health.py`](backend/app/services/provider_health.py:192)
- security high-severity alerts: [`backend/app/services/security_monitoring.py`](backend/app/services/security_monitoring.py:296)

---

## 9) Known Issues (Critical)

1. Legacy SQL migration history still includes `ai_models` DDL/DML text (historical migration chain), e.g. [`supabase/migrations/20260112152647_f50abda4-b40a-467c-bbdd-f2e32f08d270.sql`](supabase/migrations/20260112152647_f50abda4-b40a-467c-bbdd-f2e32f08d270.sql:30).
2. Historical docs still mention `ai_models`, e.g. [`docs/architecture.md`](docs/architecture.md:32).
3. `@supabase/realtime-js` appears in lockfile as transitive package metadata only: [`package-lock.json`](package-lock.json:2600).

These do **not** represent active backend Python runtime usage but are documented for full transparency.

---

## Runtime Validation Results

### 1) Change `MAX_CONCURRENT_JOBS`
Behavior:
- admin/settings writes value through config service.
- queue status reads `max_concurrent_jobs` dynamically.
- processing loop enforces cap before taking next job.

Proof: [`backend/app/services/queue.py`](backend/app/services/queue.py:140), [`backend/app/services/processor.py`](backend/app/services/processor.py:471)

### 2) Disable Telegram alerts
Behavior:
- set `telegram_alerts_enabled = false`.
- logger initialization marks `enabled = false` even if token/chat exist.
- message sends short-circuit.

Proof: [`backend/app/services/telegram_logger.py`](backend/app/services/telegram_logger.py:28), [`backend/app/services/telegram_logger.py`](backend/app/services/telegram_logger.py:38)

### 3) Change storage lifecycle
Behavior:
- set `r2_bucket_lifetime_days` in config.
- upload response `expires_at` reflects new day-based TTL.

Proof: [`backend/app/services/storage.py`](backend/app/services/storage.py:139), [`backend/app/services/storage.py`](backend/app/services/storage.py:160)

### 4) Pause queue
Behavior:
- `pause_queue()` updates runtime flag and persists `queue_paused` in config service.
- processing loop reads queue status and idles while paused.

Proof: [`backend/app/services/queue.py`](backend/app/services/queue.py:117), [`backend/app/services/processor.py`](backend/app/services/processor.py:466)

---

## Fixes Applied (Before → After)

1. Direct env usage in auth service
- Before: `os.getenv(...)` for Supabase in [`backend/app/security.py`](backend/app/security.py:34)
- After: settings-only initialization in [`backend/app/security.py`](backend/app/security.py:30)

2. Missing reload API in config service
- Before: `refresh()` only
- After: `reload()` added in [`backend/app/services/config_service.py`](backend/app/services/config_service.py:203)

3. Queue pause not persisted; concurrency partially static
- Before: in-memory pause only
- After: persisted pause via config in [`backend/app/services/queue.py`](backend/app/services/queue.py:117) and loop gating in [`backend/app/services/processor.py`](backend/app/services/processor.py:466)

4. Storage lifetime fixed at 24h
- Before: hardcoded 24h expiration
- After: runtime-configurable day TTL in [`backend/app/services/storage.py`](backend/app/services/storage.py:139)

5. `ai_models` runtime references in edge/frontend runtime
- Before: references in edge function + admin/hooks
- After: moved to `models`/`model_analytics` in [`supabase/functions/generate-image/index.ts`](supabase/functions/generate-image/index.ts:273), [`src/pages/admin/AdminModels.tsx`](src/pages/admin/AdminModels.tsx:63), [`src/hooks/useAvailableModels.ts`](src/hooks/useAvailableModels.ts:23)

6. Realtime migration artifact
- Before: dedicated realtime publication migration file existed
- After: file removed from active tree (`supabase/migrations/20260121142425_436fd857-5e2b-4473-8403-64893bb6171b.sql`)

---

## ✅ Final Verified Status

- `ai_models` removed from active backend Python runtime: **YES**
- SQLAlchemy removed: **YES**
- Central config service present with `get/set/reload`: **YES**
- Direct env misuse in backend Python runtime: **NO** (only fallback in config service)
- Redis/realtime/pubsub in backend Python runtime: **NO**
- Job system dynamic controls (`max_concurrent_jobs`, `queue_paused`): **YES**
- Storage lifecycle runtime-configurable (`r2_bucket_lifetime_days`): **YES**
- Runtime behavior wiring (simulated by code path verification): **YES**

Note: historical docs/migrations still contain legacy `ai_models` text and are listed in Known Issues for explicit follow-up cleanup strategy.
