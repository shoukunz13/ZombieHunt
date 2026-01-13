# 🔐 Zombie Hunt - Security Documentation

This document details the security measures implemented in Zombie Hunt for safe public deployment.

---

## Architecture Overview

```
┌─────────────────┐      WebSocket      ┌─────────────────┐
│     Client      │ ◄─────────────────► │     Server      │
│   (React SPA)   │                     │ (Node + Express)│
└─────────────────┘                     └─────────────────┘
        │                                       │
        │ - No sensitive data                   │ - Server-authoritative
        │ - React auto-escapes                  │ - All validation here
        │ - Session in localStorage             │ - Rate limiting
        └───────────────────────────────────────┘
```

---

## Security Layers

### 1. Authentication & Authorization

| Feature | Implementation |
|---------|----------------|
| Host PIN | Required via `HOST_PIN` env var (min 6 chars in production) |
| PIN Protection | Rate limited (5 attempts/min, then 5min block) |
| Host Auth | Socket ID tracked after PIN verification |
| Player Identity | Server-generated UUID, cannot be forged |

### 2. Rate Limiting

```typescript
// Rate limiters (rate-limiter-flexible)
├── eventRateLimiter    // 20 events/second per socket
├── authRateLimiter     // 5 attempts/min, 5min block
└── joinRateLimiter     // 10 joins/min per IP
```

Logged with observability:
```
[RATE-LIMIT] join_game blocked for IP 192.168.1.50
[RATE-LIMIT] host_auth blocked for IP 192.168.1.50
```

### 3. Connection Security

| Measure | Value |
|---------|-------|
| Max connections per IP | 10 |
| Max payload size (Socket) | 100kb |
| Max payload size (JSON) | 10kb |
| Connection timeout | 10 seconds |
| Ping timeout | 5 seconds |

### 4. Input Validation

**Player Names:**
```typescript
// XSS prevention + length limit
const sanitizedName = name.trim().replace(/[<>"'&]/g, '').substring(0, 16);
```

**Game Codes:**
```typescript
// Alphanumeric only
const sanitizedCode = gameCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
```

**Socket Events:**
```typescript
// All socket handlers validate input before processing
socket.on('join_game', (data: unknown) => {
    if (!data || typeof data !== 'object') return; // Reject null/invalid
    // ... validate fields before processing
});
```

### 5. Server-Authoritative Design

The server validates ALL game actions:

- ✅ Card ownership before plays
- ✅ Phase checks on every action
- ✅ Duel membership verification
- ✅ Special card usage limits
- ✅ Infection count per zombie

Clients cannot:
- See other players' roles
- See other players' cards
- Submit actions out of phase
- Forge player IDs

### 6. Security Headers (Helmet.js)

Production headers include:
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security` (HSTS)
- `X-XSS-Protection`

### 7. CORS Protection

```typescript
// Development: Allow all (for LAN testing)
// Production: Whitelist from ALLOWED_ORIGINS env var
origin: isDevelopment ? '*' : ALLOWED_ORIGINS
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` for public release |
| `HOST_PIN` | Yes (prod) | Min 6 characters |
| `ALLOWED_ORIGINS` | Yes (prod) | Comma-separated list of allowed origins |
| `PORT` | No | Default: 3001 |
| `METRICS_KEY` | No | Key to access `/api/metrics` in production |

---

## Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set strong `HOST_PIN` (12+ chars recommended)
- [ ] Set `ALLOWED_ORIGINS` to your domain only
- [ ] Deploy behind HTTPS (Let's Encrypt, Cloudflare)
- [ ] Configure reverse proxy if using Nginx/Cloudflare
- [ ] Monitor `/api/metrics` for attack patterns
- [ ] Review logs for `[RATE-LIMIT]` events

---

## Security Testing

Run the adversarial test suite:

```bash
# Start server first
npm run dev

# In another terminal
cd server && npm run security-test
```

Tests include:
1. Join rate limit bypass
2. Auth rate limit bypass
3. Malformed payload handling
4. Phase bypass attempts
5. Connection limit enforcement
6. XSS prevention

---

## CI/CD Security

GitHub Actions workflow (`.github/workflows/security.yml`):

- **npm audit** - Fails on high/critical vulnerabilities
- **ESLint** - Security-focused linting rules
- **TypeScript** - Type checking

---

## Files Reference

| File | Security Feature |
|------|------------------|
| `server/src/index.ts` | Helmet, CORS, rate limits, connection limits |
| `server/src/socketHandlers.ts` | Rate limiting, input validation, phase checks |
| `server/src/config.ts` | PIN enforcement |
| `server/.eslintrc.cjs` | Security linting rules |
| `.github/workflows/security.yml` | CI security checks |
| `server/src/security-test.ts` | Adversarial testing |

---

## Known Limitations

1. **IP Spoofing**: If misconfigured behind proxy, rate limiting by IP may be bypassed
   - Mitigation: Ensure `trust proxy` is set correctly

2. **Session Persistence**: Uses localStorage (XSS would expose session)
   - Mitigation: React auto-escapes, no `dangerouslySetInnerHTML`

3. **Host PIN**: Single static PIN for all hosts
   - Mitigation: Rate limiting, strong PIN requirement

---

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it privately by emailing [your-email@example.com].

Do not open public issues for security vulnerabilities.
