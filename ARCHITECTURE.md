# Architecture: Automatic Lab Session Cleanup

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Frontend Application                           │
│                     (React/Vue/Angular/etc.)                            │
└────────────┬──────────────────────────────────────┬─────────────────────┘
             │                                      │
             │ Manual Delete                        │ Create/Get/Update
             │ (User terminates lab)                │ (CRUD operations)
             ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Cloudflare Worker (Edge)                           │
│              https://your-worker.workers.dev                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      HTTP Router (index.ts)                      │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  POST   /api/v1/labs/sessions       → createLabSession()        │  │
│  │  GET    /api/v1/labs/sessions/user/:id → getLabSession()        │  │
│  │  PUT    /api/v1/labs/sessions/:id   → updateLabSession()        │  │
│  │  DELETE /api/v1/labs/sessions/:id   → deleteLabSession()        │  │
│  │  GET    /health                     → health check              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                          │                                              │
│                          ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  API Handlers (handlers.ts)                      │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  • Validate requests                                             │  │
│  │  • Interact with D1 database                                     │  │
│  │  • Schedule/cancel Durable Object alarms                         │  │
│  │  • Return JSON responses                                         │  │
│  └─────────┬────────────────────────────────────────────┬───────────┘  │
│            │                                            │              │
│            │ DB Operations                              │ DO Operations│
│            ▼                                            ▼              │
│  ┌──────────────────┐                      ┌──────────────────────┐   │
│  │   D1 Database    │                      │  Durable Object NS   │   │
│  │ (labs_sessions)  │                      │  (SESSION_MANAGER)   │   │
│  └──────────────────┘                      └──────────┬───────────┘   │
│                                                       │               │
│                                       ┌───────────────┴─────────────┐ │
│                                       │                             │ │
│                              ┌────────▼───────┐         ┌──────────▼┐ │
│                              │ SessionManager │   ...   │SessionMngr│ │
│                              │  (user-abc)    │         │(user-xyz) │ │
│                              └────────────────┘         └───────────┘ │
│                              • Alarm Scheduler                        │
│                              • Session State                          │
│                              • Retry Logic                            │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                │ Automatic Cleanup
                                │ (on alarm trigger)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend API (Your Service)                      │
│                    https://your-backend-api.com                         │
├─────────────────────────────────────────────────────────────────────────┤
│  DELETE /api/v1/expose/        → Delete exposed services (LB, etc.)    │
│  POST   /api/v1/labs/delete    → Delete VM and resources               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Interactions

### 1. Session Creation Flow

```
Frontend                Worker              D1 Database         Durable Object
   │                      │                      │                    │
   │  POST /sessions      │                      │                    │
   ├─────────────────────►│                      │                    │
   │                      │  INSERT session      │                    │
   │                      ├─────────────────────►│                    │
   │                      │      Success         │                    │
   │                      │◄─────────────────────┤                    │
   │                      │                      │                    │
   │                      │  Instantiate DO (user_id)                 │
   │                      ├────────────────────────────────────────────►
   │                      │                      │                    │
   │                      │  Schedule alarm (duration)                │
   │                      ├────────────────────────────────────────────►
   │                      │                      │   Store metadata   │
   │                      │                      │   Set alarm        │
   │                      │      Success         │                    │
   │                      │◄────────────────────────────────────────────┤
   │   201 Created        │                      │                    │
   │◄─────────────────────┤                      │                    │
   │                      │                      │                    │
   │                                          [Timer Running]          │
   │                                              ⏰                    │
```

### 2. Automatic Cleanup Flow (Alarm Triggered)

```
Durable Object             Backend API           D1 Database        
      │                         │                     │
      │  [Alarm Fires]          │                     │
      │  (duration expired)     │                     │
      │                         │                     │
      │  DELETE /expose/        │                     │
      ├────────────────────────►│                     │
      │  (best effort)          │                     │
      │      202/200            │                     │
      │◄────────────────────────┤                     │
      │                         │                     │
      │  POST /labs/delete      │                     │
      ├────────────────────────►│                     │
      │  (critical)             │  [Delete VMs]       │
      │      202 Accepted       │                     │
      │◄────────────────────────┤                     │
      │                         │                     │
      │  DELETE FROM labs_sessions                    │
      ├───────────────────────────────────────────────►
      │                         │      Success        │
      │◄───────────────────────────────────────────────┤
      │                         │                     │
      │  Clear DO storage       │                     │
      │  ✅ Cleanup complete    │                     │
```

### 3. Manual Deletion Flow (User Cancels)

```
Frontend                Worker              Durable Object      D1 Database
   │                      │                      │                  │
   │  DELETE /sessions/id │                      │                  │
   ├─────────────────────►│                      │                  │
   │                      │  Cancel alarm        │                  │
   │                      ├─────────────────────►│                  │
   │                      │  Delete alarm        │                  │
   │                      │  Clear storage       │                  │
   │                      │     Success          │                  │
   │                      │◄─────────────────────┤                  │
   │                      │                      │                  │
   │                      │  DELETE FROM labs_sessions              │
   │                      ├─────────────────────────────────────────►
   │                      │                      │    Success       │
   │                      │◄─────────────────────────────────────────┤
   │   200 OK             │                      │                  │
   │◄─────────────────────┤                      │                  │
   │                      │                      │                  │
   │  [Frontend calls backend API directly for immediate cleanup]   │
```

## Data Flow

### Session Data Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Lab Session Record                          │
├─────────────────────────────────────────────────────────────────────┤
│  Metadata                    Infrastructure         Services        │
│  ├─ id (UUID)                ├─ vm                 ├─ terminal_url  │
│  ├─ user_id (unique)         │  ├─ name            ├─ vscode_domain │
│  ├─ lab_request_id           │  ├─ network_id      └─ puku_domain   │
│  ├─ duration (minutes)       │  └─ netbird_ip                       │
│  ├─ created_at               ├─ worker_nodes[]                      │
│  └─ updated_at               │  ├─ name                             │
│                              │  ├─ lab_request_id                   │
│  Lab Info                    │  ├─ network_id                       │
│  ├─ labId                    │  └─ netbird_ip                       │
│  ├─ labTitle                 └─ loadBalancers[]                     │
│  ├─ labGroupID                  ├─ id                               │
│  ├─ moduleID                    ├─ domain                           │
│  └─ counterID                   └─ port                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Durable Object State

```
┌─────────────────────────────────────────────────────────────────────┐
│         SessionManager Durable Object (Per User)                    │
├─────────────────────────────────────────────────────────────────────┤
│  Storage                                                            │
│  ├─ user_id: "675993586c0850de6534d90d"                            │
│  ├─ lab_request_id: "9f3077ea-8d03-44f0-a6b3-c9697b43427c"         │
│  ├─ duration: 60                                                    │
│  ├─ created_at: "2025-11-09T12:00:00Z"                             │
│  └─ alarm: timestamp (current_time + duration * 60 * 1000)         │
│                                                                     │
│  Methods                                                            │
│  ├─ fetch(request)        → Handle HTTP requests                   │
│  ├─ scheduleCleanup()     → Set alarm for expiration               │
│  ├─ cancelCleanup()       → Delete scheduled alarm                 │
│  ├─ alarm()               → Triggered when duration expires         │
│  ├─ callBackendCleanup()  → Call backend API                       │
│  └─ deleteFromDatabase()  → Remove from D1                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Error Handling & Retry Logic

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Alarm Execution (alarm())                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Call Backend API│
                    └────────┬────────┘
                             │
                   ┌─────────▼─────────┐
                   │   Success?        │
                   └────┬──────────┬───┘
                        │ Yes      │ No
                        ▼          ▼
            ┌──────────────┐  ┌────────────────┐
            │Delete from D1│  │ Retry in 5 min │
            └──────┬───────┘  └────────┬───────┘
                   │                   │
                   ▼                   │
           ┌───────────────┐           │
           │Clear DO State │           │
           └───────┬───────┘           │
                   │                   │
                   ▼                   │
            ✅ Complete          ⏰ Schedule retry
                                      │
                                      └──────┐
                                             │
                                             ▼
                                    [Wait 5 minutes]
                                             │
                                             └───► [Retry alarm()]
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Global Network                        │
│                      (Edge Locations Worldwide)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Worker (Deployed Globally)                     │   │
│  │  • Runs on every edge location                              │   │
│  │  • Handles HTTP requests                                    │   │
│  │  • Routes to Durable Objects                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │       Durable Objects (Single Region per Object)            │   │
│  │  • SessionManager instances (one per user)                  │   │
│  │  • Strongly consistent                                      │   │
│  │  • Persistent storage                                       │   │
│  │  • Scheduled alarms                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              D1 Database (SQLite)                           │   │
│  │  • labs_sessions table                                      │   │
│  │  • Global replication                                       │   │
│  │  • Automatic backups                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend API                                 │
│                    (Your Infrastructure)                            │
│  • VM Management                                                    │
│  • Service Orchestration                                            │
│  • Load Balancer Configuration                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Security Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Security Layers                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Transport Security                                              │
│     ├─ HTTPS (TLS 1.3) for all communications                      │
│     └─ Cloudflare's global SSL/TLS                                 │
│                                                                     │
│  2. Authentication                                                  │
│     ├─ Frontend → Worker: Application-level auth                   │
│     ├─ Worker → Backend: Bearer token (BACKEND_API_TOKEN)          │
│     └─ Backend validates all requests                              │
│                                                                     │
│  3. Authorization                                                   │
│     ├─ Backend verifies user_id matches authenticated user         │
│     ├─ Worker enforces one-lab-per-user constraint                 │
│     └─ Durable Objects isolated per user (single-tenant)           │
│                                                                     │
│  4. Data Protection                                                 │
│     ├─ Secrets stored via Wrangler (encrypted at rest)             │
│     ├─ No sensitive data in code or version control                │
│     ├─ D1 database encrypted at rest                               │
│     └─ Durable Object storage encrypted                            │
│                                                                     │
│  5. Rate Limiting                                                   │
│     ├─ Cloudflare automatic DDoS protection                        │
│     ├─ Backend implements rate limiting                            │
│     └─ Worker can implement additional limits (if needed)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Scalability Characteristics

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Scalability Profile                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Component          Scaling Strategy          Limits               │
│  ────────────────────────────────────────────────────────────────  │
│  Worker            Automatic (global)          ~100K req/sec       │
│  Durable Objects   Per-user isolation          ~1000 req/sec/DO    │
│  D1 Database       Automatic replication       ~100K rows          │
│  Backend API       Your infrastructure         Depends on setup    │
│                                                                     │
│  Cost Profile (10,000 labs/month)                                  │
│  ────────────────────────────────────────────────────────────────  │
│  Worker Requests   $0.15/million               ~$0.0015           │
│  Durable Objects   $0.15/million + storage     ~$0.0075           │
│  D1 Database       Free tier (up to 100K rows) Free               │
│  Total                                         ~$0.01/month        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Monitoring Stack                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Real-Time Logs (npx wrangler tail)                             │
│     ├─ [SessionManager] prefixed logs                              │
│     ├─ [Handler] prefixed logs                                     │
│     ├─ ✅ Success indicators                                        │
│     ├─ ⚠️ Warning indicators                                        │
│     └─ ❌ Error indicators                                          │
│                                                                     │
│  2. Cloudflare Analytics                                            │
│     ├─ Request counts                                              │
│     ├─ Error rates                                                 │
│     ├─ Response times                                              │
│     └─ Durable Object usage                                        │
│                                                                     │
│  3. D1 Database Queries                                             │
│     ├─ Active session count                                        │
│     ├─ Expired session detection                                   │
│     └─ Session duration analysis                                   │
│                                                                     │
│  4. Backend API Logs                                                │
│     ├─ VM deletion requests                                        │
│     ├─ Service deletion requests                                   │
│     └─ Error tracking                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

1. **Durable Objects over Cron**: Precise timing, per-user isolation, lower D1 queries
2. **Best Effort Service Deletion**: Don't fail VM deletion if service deletion fails
3. **5-Minute Retry**: Balance between responsiveness and resource usage
4. **Bearer Token Auth**: Standard, widely supported authentication method
5. **Alarm Cancellation**: Manual deletion cancels automatic cleanup to prevent conflicts
6. **Non-Blocking Schedule**: Session creation succeeds even if scheduling fails

## Future Enhancements

- [ ] Configurable retry intervals
- [ ] Dead letter queue for failed cleanups
- [ ] Cleanup webhooks for external notifications
- [ ] User warnings before automatic cleanup
- [ ] Cleanup history and analytics
- [ ] Multi-region backend API failover
- [ ] Circuit breaker pattern for backend API calls
