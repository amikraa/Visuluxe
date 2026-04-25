# Production Security Hardening Guide

This document outlines the production-grade security controls implemented for Visuluxe.

## 🚨 Kill Switch Operations

### Emergency Pause
```bash
curl -X POST "https://api.example.com/v1/admin/kill-switch/emergency-pause?reason=DDOS_ATTACK" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Resume
```bash
curl -X POST "https://api.example.com/v1/admin/kill-switch/resume?reason=ATTACK_CONTAINED" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 📊 Monitoring Endpoints

### System Health
```bash
curl "https://api.example.com/v1/admin/health" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Top Active Users
```bash
curl "https://api.example.com/v1/admin/users/top-active?limit=10&window_minutes=60" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### User Suspension
```bash
# Suspend user
curl -X POST "https://api.example.com/v1/admin/users/{user_id}/suspend?reason=ABUSE&duration_hours=24" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Unsuspend user
curl -X POST "https://api.example.com/v1/admin/users/{user_id}/unsuspend" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 🔒 Security Headers

All responses include:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

## 📈 Rate Limits

| Tier | RPM | RPD |
|------|-----|-----|
| Free | 60 | 1000 |
| Pro | 120 | 5000 |
| Enterprise | 500 | 50000 |

## 🔐 Abuse Detection Thresholds

- Max requests/minute: 10
- Max requests/hour: 200
- Max requests/day: 1000
- Max cost/day: ₹100
- Rate limit hits before cooldown: 5
- Invalid inputs before cooldown: 10

## 📋 Audit Log Events

All admin actions are logged:
- Queue pause/resume
- Job cancellation/termination/retry
- Priority changes
- Config changes
- User suspensions
- Kill switch activation

## 🚨 Alert Triggers

Alerts fire when:
- Traffic spike (5x normal)
- Error rate > 10%
- Rate limit abuse
- Admin action detected
- Suspicious activity pattern
- System health degraded
