**clean visual flow structure chart** of your current **Visuluxe GitHub architecture**, reflecting:

* React frontend
* Supabase Edge Functions backend
* Admin system
* Provider management
* (Optional) Private FastAPI + R2 architecture adding

---

# 🔷 VISULUXE — COMPLETE SYSTEM FLOW STRUCTURE

```
┌──────────────────────────────────────────┐
│               USER BROWSER               │
│     (React + Vite Single Page App)       │
└──────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│              FRONTEND LAYER              │
│------------------------------------------│
│  App.tsx                                 │
│   ├─ AuthProvider                        │
│   ├─ AdminProvider                       │
│   ├─ React Router                        │
│   └─ TanStack Query                      │
└──────────────────────────────────────────┘
                     │
                     │
         ┌───────────┴────────────┐
         │                        │
         ▼                        ▼

 USER ROUTES                 ADMIN ROUTES
 (/dashboard, /generate)     (/admin/*)

```

---

# 🧠 USER IMAGE GENERATION FLOW

```
[Generate.tsx]
      │
      │  prompt + model + settings
      ▼
supabase.functions.invoke("generate-image")
      │
      ▼
┌────────────────────────────────────────────┐
│  SUPABASE EDGE FUNCTION                   │
│  generate-image                           │
│--------------------------------------------│
│  ✔ JWT/API Key Authentication             │
│  ✔ Maintenance Mode Check                 │
│  ✔ User Ban Check                         │
│  ✔ IP Blocklist Check                     │
│  ✔ Rate Limiting (RPM/RPD)                │
│  ✔ Credit Check                           │
│  ✔ Model + Provider Lookup                │
│  ✔ Decrypt Provider Key                   │
└────────────────────────────────────────────┘
      │
      │  (server-to-server call)
      ▼
┌────────────────────────────────────────────┐
│     PRIVATE FASTAPI IMAGE BACKEND         │
│--------------------------------------------│
│  ✔ Validates Internal Token               │
│  ✔ Calls Flux / Provider API              │
│  ✔ Downloads Image Binary                 │
│  ✔ Uploads to Cloudflare R2               │
│  ✔ Returns R2 key + Signed/Public URL     │
└────────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────────┐
│ Cloudflare R2 Bucket                      │
│  generated/YYYY/MM/DD/jobid.png           │
│  (24h lifecycle auto-delete)              │
└────────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────────┐
│ Supabase Edge Function                    │
│--------------------------------------------│
│  ✔ Stores row in images table             │
│     - image_url                           │
│     - r2_key                              │
│     - r2_expires_at                       │
│     - metadata                            │
│  ✔ Deducts credits                        │
│  ✔ Writes request_logs                    │
└────────────────────────────────────────────┘
      │
      ▼
Frontend shows generated image
```

---

# 🔑 API KEY FLOW

```
[Dashboard UI]
      │
      ▼
supabase.functions.invoke("create-api-key")
      │
      ▼
Edge Function: create-api-key
      │
      ├─ Verify JWT
      ├─ Generate Random Key
      ├─ Store HASH only
      └─ Return full key ONCE
```

---

# 🛠 ADMIN PROVIDER CONTROL FLOW

```
[Admin Providers UI]
      │
      ├─ Add/Edit Provider
      ├─ Set base_url
      ├─ Set priority
      ├─ Enable/Disable
      └─ Encrypt API key
            │
            ▼
Edge Function: manage-provider-keys
      │
      ├─ Verify Admin Role
      ├─ AES-GCM Encrypt/Decrypt
      ├─ Rate limit decrypt attempts
      └─ Write admin_audit_logs
```

When generation happens:

```
generate-image
   │
   └─ Reads providers table
   └─ Decrypts api_key_encrypted
   └─ Sends to FastAPI (NOT frontend)
```

So:

✔ Provider key never reaches browser
✔ Flux logic never runs client-side
✔ Admin controls everything centrally

---

# 🗄 DATABASE ARCHITECTURE FLOW

```
USERS
 ├─ profiles
 ├─ user_roles
 ├─ user_credits
 └─ api_keys

GENERATION
 ├─ images
 ├─ request_logs
 └─ credits_transactions

ADMIN
 ├─ providers
 ├─ models
 ├─ system_settings
 ├─ security_events
 └─ admin_audit_logs
```

---

# 🔐 SECURITY FLOW

```
Browser
   │
   ▼
Supabase Edge Function
   │
   ├─ JWT validation
   ├─ Credit check
   ├─ Ban check
   ├─ Rate limit
   └─ Provider decryption
        │
        ▼
FastAPI (Private)
   ├─ Internal token required
   ├─ No public CORS
   └─ Not exposed to internet
```

---

# ☁ FINAL INFRASTRUCTURE LAYOUT

```
Frontend (Vite SPA)
        │
        ▼
Supabase (Auth + DB + Edge Functions)
        │
        ▼
Private FastAPI Service
        │
        ▼
Cloudflare R2 (24h storage)
        │
        ▼
Optional CDN / Signed URL
```

---

# 🧩 FULL SYSTEM RESPONSIBILITY MAP

| Layer          | Responsibility                         |
| -------------- | -------------------------------------- |
| React Frontend | UI, state, displaying images           |
| Supabase Edge  | Security, credits, logs, orchestration |
| FastAPI        | Provider call + R2 storage             |
| Cloudflare R2  | Temporary storage (24h lifecycle)      |
| Admin Panel    | Provider + model control               |

---

# 🚀 Where Code Lives (Important)

Python logic:

✔ Runs ONLY inside FastAPI
✔ Not bundled in frontend
✔ Not exposed via public endpoint
✔ Called only via internal secret header
✔ Controlled via admin provider table

That keeps your core IP protected.

---
