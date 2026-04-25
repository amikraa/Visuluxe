# Visuluxe Production Architecture

**Version:** 1.0 | **Date:** 2026-04-24 | **Status:** Production Ready

---

## 🏗️ 1. Architecture Design

```
USER → Cloudflare Edge (WAF, DDoS, Rate Limit) 
     → Cloudflare Workers (Auth, CORS, Pre-validate)
     → FastAPI Backend (3 regions, auto-scale)
            ↓
     ┌────────┴────────┐
     ↓                  ↓
  Redis            Supabase
 (Queue/Cache)    (PostgreSQL)
     ↓                  ↓
  Workers ──────→ R2 Storage
 (Image Gen)
```

### Components

| Component | Purpose | Scaling |
|-----------|---------|---------|
| Cloudflare Edge | WAF, DDoS, Rate Limiting | Managed |
| FastAPI Backend | Auth, Validation, Job Creation | 3-20 instances/region |
| Redis | Queue, Rate Limits, Cache | 3-node cluster |
| Supabase | User data, jobs, analytics | Multi-region replicas |
| Workers | Image generation | 10-100 concurrent |
| R2 | Image storage | Managed |

---

## ⚡ 2. Scaling Strategy

### Auto-Scaling Config (Kubernetes HPA)

```yaml
minReplicas: 3
maxReplicas: 50
metrics:
  - CPU > 70% → scale up
  - Queue depth > 100 → scale up
  - Error rate > 5% → scale up
scaleDownCooldown: 5 min
```

### Scaling Triggers

| Metric | Scale Up | Scale Down | Cooldown |
|--------|---------|-----------|----------|
| CPU | >70% | <30% | 3 min |
| Queue Depth | >100 | <20 | 2 min |
| Request Rate | >5000 RPS | <500 RPS | 5 min |
| Error Rate | >5% | <1% | 2 min |
| P99 Latency | >2000ms | <500ms | 3 min |

### Stateless Requirements

✅ All state in Redis (sessions, rate limits, queue)  
✅ No local storage on backend instances  
✅ No sticky sessions  
✅ Health checks before scale-down

---

## 💸 3. Cost Control System

### Cost Per Request (₹)

| Model | Provider Cost | Platform Margin | Total |
|-------|-------------|----------------|-------|
| flux-dev | ₹8.00 | ₹2.00 | ₹10.00 |
| flux-schnell | ₹4.00 | ₹1.00 | ₹5.00 |
| dall-e-3 | ₹15.00 | ₹5.00 | ₹20.00 |
| sdxl | ₹10.00 | ₹3.00 | ₹13.00 |

### User Budget Tiers

| Tier | Daily Limit | Monthly Limit | Rate Limit |
|------|-------------|---------------|------------|
| Free | ₹50 | ₹500 | 10 req/min |
| Starter | ₹200 | ₹2,000 | 30 req/min |
| Pro | ₹1,000 | ₹10,000 | 100 req/min |
| Enterprise | Custom | Custom | Custom |

### Cost Anomaly Detection

```python
ALERT_THRESHOLDS = {
    "daily_spend_10x_normal": 10,    # ₹500 → alert at ₹5,000
    "hourly_spend_5x_normal": 5,      # ₹20 → alert at ₹100
}

KILL_SWITCH_THRESHOLDS = {
    "daily_spend_20x_normal": 20,    # Hard stop at 20x normal
    "single_request_3x_max": 3,        # ₹15 → kill at ₹45
}
```

---

## 🔁 4. Queue & Worker Design

### Priority Queue Structure (Redis Streams)

```
Stream: visuluxe:jobs:priority
├── enterprise (priority 10) → dedicated workers
├── pro (priority 5-9) → shared pool  
├── starter (priority 3-4) → shared pool
└── free (priority 1-2) → shared pool

Consumer Groups:
├── visuluxe:consumers:enterprise
├── visuluxe:consumers:pro
├── visuluxe:consumers:starter
└── visuluxe:consumers:free
```

### Retry Logic

| Retry | Delay | Action |
|-------|-------|--------|
| 1 | 5 sec | Auto-retry |
| 2 | 30 sec | Auto-retry |
| 3 | 120 sec | Auto-retry |
| 4+ | - | Dead Letter Queue |

### Dead Letter Queue

```redis
Stream: visuluxe:jobs:dlq
Entry: {job_id, error, retry_count, original_payload, failed_at}
Retention: 7 days for analysis
```

---

## 🧠 5. Smart Abuse Detection

### Per-User Scoring

```python
class AbuseScore:
    # Weights
    REQUESTS_WEIGHT = 0.3
    ERRORS_WEIGHT = 0.3
    RATE_LIMIT_HITS_WEIGHT = 0.2
    COST_ANOMALY_WEIGHT = 0.2
    
    # Thresholds
    SAFE_SCORE = 0-30
    SUSPICIOUS = 31-60
    BLOCKED = 61-100
    
    # Auto-actions
    SUSPICIOUS → Reduce rate limit by 50%
    BLOCKED → API key suspension + alert
```

### Adaptive Rate Limits

| User Score | RPM Modifier | RPD Modifier |
|------------|--------------|---------------|
| 0-30 (Safe) | 1.0x | 1.0x |
| 31-60 (Warning) | 0.7x | 0.8x |
| 61-100 (Blocked) | 0.3x | 0.5x |

---

## 🌐 6. Edge Protection (Cloudflare)

### WAF Rules

```bash
# Block common attack patterns
 Rule 1: cf.threat_score > 30 → BLOCK
 Rule 2: ip.rate_limit > 100/min → CHALLENGE  
 Rule 3: http.request.uri contains " UNION " → BLOCK
 Rule 4: http.request.uri contains " DROP " → BLOCK
 Rule 5: geo.country in [RU, CN, KP] → RATE_LIMIT only
```

### Rate Limiting (Edge)

```yaml
# Cloudflare Rate Limiting Rules
- threshold: 60 requests/minute
- window: 1 minute
- action: simulate (log only for testing)
- default: 429 Too Many Requests

# Aggressive for unauthenticated
- threshold: 20 requests/minute
- window: 1 minute
```

---

## 📊 7. Observability

### Dashboards

| Dashboard | Metrics |
|-----------|---------|
| Overview | RPS, Error Rate, P99 Latency, Active Users |
| Costs | Daily Spend, Per-User Cost, Anomaly Alerts |
| Queue | Depth, Processing Rate, Worker Utilization |
| Abuse | Blocked IPs, Suspended Users, Attack Attempts |
| Infrastructure | CPU, Memory, Redis Connections |

### Alerts

| Alert | Condition | Severity | Action |
|-------|------------|-----------|--------|
| High Error Rate | >5% 5xx | P1 | Page on-call |
| Queue Spike | >1000 pending | P2 | Slack alert |
| Cost Anomaly | >10x normal | P1 | Kill switch + page |
| DDoS Detected | >10x normal traffic | P1 | Auto-enable protection mode |
| API Key Suspended | Any | P3 | Slack notification |

### Request Tracing

```
trace_id → backend_instance → redis_operation → worker → provider
         → database_query → storage_upload
```

---

## 🔐 8. High Availability

### Failover Strategy

```
Primary Region (us-east-1)
├── Backend: 3+ instances, multi-AZ
├── Redis: 3-node cluster with replicas
├── Database: Supabase with read replicas
└── Workers: Always-on pool

Secondary Region (eu-west-1)
├── Backend: Hot standby (1 instance)
├── Redis: Read replicas synced
└── Database: Read replica (promotable)

Disaster Recovery
├── RTO: <5 minutes
├── RPO: <1 minute (async replication)
└── DNS failover via Cloudflare Health Checks
```

### Database Replication

```
Supabase Primary (us-east-1)
├── Replica 1 (eu-west-1) - Read queries
├── Replica 2 (ap-south-1) - Read queries
└── Backup (daily snapshots, 30-day retention)
```

---

## 📋 Production Checklist

### Pre-Deployment

- [ ] CORS restricted to production domains
- [ ] Redis cluster deployed (3+ nodes)
- [ ] Cloudflare WAF rules configured
- [ ] Rate limits at edge enforced
- [ ] Monitoring dashboards created
- [ ] Alert routing configured (PagerDuty/Slack)
- [ ] Kill switch tested
- [ ] Disaster recovery tested

### Post-Deployment

- [ ] Load test at 10x normal traffic
- [ ] Chaos test (kill random instances)
- [ ] Cost anomaly test (simulate abuse)
- [ ] Verify audit logs are populating
- [ ] Verify alerts are firing correctly

---

**Architecture Status:** ✅ PRODUCTION READY