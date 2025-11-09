# Automatic Lab Session Cleanup

This document explains how the automatic lab session cleanup feature works using Cloudflare Durable Objects.

## Overview

The Cloudflare Worker service now includes **automatic lab session expiration** based on the `duration` field. When a lab session is created, a timer is automatically scheduled. When the timer expires, the worker will:

1. Call the backend API to delete VMs and exposed services
2. Delete the lab session from the D1 database
3. Clean up all associated resources

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐         ┌─────────────────────┐         │
│  │  HTTP Routes │◄───────►│  Durable Object     │         │
│  │  (CRUD API)  │         │  (SessionManager)   │         │
│  └──────────────┘         └─────────────────────┘         │
│                                    │                        │
│                           ┌────────┴────────┐              │
│                           │                 │              │
│                     Alarm Scheduler    Session Tracking    │
│                           │                                │
└───────────────────────────┼────────────────────────────────┘
                            │
            ┌───────────────┴──────────────┐
            │                              │
            ▼                              ▼
    ┌────────────────┐           ┌────────────────┐
    │  Backend API   │           │   D1 Database  │
    │ (VM Deletion)  │           │  (Lab State)   │
    └────────────────┘           └────────────────┘
```

## How It Works

### 1. Session Creation (POST /api/v1/labs/sessions)

When a lab session is created:

```typescript
// 1. Session is stored in D1 database
INSERT INTO labs_sessions (user_id, duration, ...) VALUES (...)

// 2. Durable Object is instantiated for the user
const doId = SESSION_MANAGER.idFromName(user_id)
const doStub = SESSION_MANAGER.get(doId)

// 3. Alarm is scheduled for expiration
await doStub.schedule({
  user_id,
  lab_request_id,
  duration  // in minutes
})

// 4. Alarm will fire after: current_time + (duration * 60 seconds)
```

### 2. Automatic Cleanup (Alarm Trigger)

When the alarm fires (lab duration expires):

```typescript
async alarm() {
  // Step 1: Delete exposed services (best effort)
  await fetch(`${BACKEND_API_URL}/api/v1/expose/`, {
    method: 'DELETE',
    body: JSON.stringify({ lab_request_id })
  })
  
  // Step 2: Delete VM (critical)
  await fetch(`${BACKEND_API_URL}/api/v1/labs/delete`, {
    method: 'POST',
    body: JSON.stringify({ lab_request_id, user_id })
  })
  
  // Step 3: Delete from D1 database
  await DB.prepare('DELETE FROM labs_sessions WHERE user_id = ?').run()
  
  // Step 4: Cleanup Durable Object storage
  await state.storage.deleteAll()
}
```

### 3. Manual Deletion (DELETE /api/v1/labs/sessions/:user_id)

When a user manually terminates their lab:

```typescript
// 1. Cancel scheduled alarm
const doId = SESSION_MANAGER.idFromName(user_id)
await doStub.cancel()

// 2. Delete from database
DELETE FROM labs_sessions WHERE user_id = ?

// 3. Frontend handles calling backend API for immediate VM deletion
```

## Configuration

### Required Environment Variables

Set these in `wrangler.toml` or via Wrangler CLI:

```toml
# wrangler.toml
[vars]
BACKEND_API_URL = "https://your-backend-api.com"

# Set via CLI (recommended for sensitive data):
# npx wrangler secret put BACKEND_API_TOKEN
```

Or set via Wrangler CLI:

```bash
# Set backend API URL
npx wrangler secret put BACKEND_API_URL
# Enter: https://your-backend-api.com

# Set backend API token
npx wrangler secret put BACKEND_API_TOKEN
# Enter: your_bearer_token_here
```

### Backend API Endpoints

The worker expects these backend endpoints:

1. **Delete Exposed Services** (Optional - best effort)
   - **Endpoint**: `DELETE /api/v1/expose/`
   - **Payload**: `{ "lab_request_id": "..." }`
   - **Headers**: `Authorization: Bearer <token>`

2. **Delete VM** (Required)
   - **Endpoint**: `POST /api/v1/labs/delete`
   - **Payload**: `{ "lab_request_id": "...", "user_id": "..." }`
   - **Headers**: `Authorization: Bearer <token>`
   - **Expected Response**: Status 202 (Accepted)

## Deployment

### 1. Deploy Worker with Durable Objects

```bash
# Deploy the worker
npm run deploy
```

The Durable Object migration will automatically run on first deployment.

### 2. Set Backend Configuration

```bash
# Set backend API URL
npx wrangler secret put BACKEND_API_URL
# Enter: https://api.example.com

# Set backend API token
npx wrangler secret put BACKEND_API_TOKEN
# Enter: your_secret_token
```

### 3. Verify Configuration

```bash
# Check deployed configuration
npx wrangler secret list
```

## Testing

### Test Automatic Cleanup

1. **Create a session with short duration (1 minute)**:

```bash
curl -X POST https://your-worker.workers.dev/api/v1/labs/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "lab_request_id": "test-lab-456",
    "duration": 1,
    ...other fields...
  }'
```

2. **Wait for 1 minute**

3. **Check logs**:

```bash
npx wrangler tail
```

You should see:
```
[SessionManager] Alarm triggered for user test-user-123
[SessionManager] Calling backend API...
[SessionManager] ✅ Successfully cleaned up expired session
```

4. **Verify session is deleted**:

```bash
curl https://your-worker.workers.dev/api/v1/labs/sessions/user/test-user-123
# Should return 404
```

### Test Manual Cancellation

1. **Create a session with long duration (60 minutes)**

2. **Manually delete before expiration**:

```bash
curl -X DELETE https://your-worker.workers.dev/api/v1/labs/sessions/test-user-123
```

3. **Check logs** - alarm should be cancelled:

```
[Handler] Automatic cleanup cancelled: { success: true, user_id: "test-user-123" }
```

## Error Handling

### Retry Logic

If automatic cleanup fails (backend API error, network issue), the alarm will **automatically retry after 5 minutes**:

```typescript
async alarm() {
  try {
    await callBackendCleanup()
    await deleteFromDatabase()
  } catch (error) {
    // Retry after 5 minutes
    await this.state.storage.setAlarm(Date.now() + 5 * 60 * 1000)
  }
}
```

### Failure Scenarios

| Scenario | Behavior |
|----------|----------|
| Backend API unavailable | Retries every 5 minutes until success |
| Database deletion fails | Retries every 5 minutes until success |
| Manual deletion during retry | Alarm is cancelled, no more retries |
| Service deletion fails | Continues with VM deletion (best effort) |

## Monitoring

### View Real-Time Logs

```bash
# Tail worker logs
npx wrangler tail

# Filter for SessionManager logs
npx wrangler tail --format json | grep SessionManager
```

### Check Scheduled Alarms

Durable Objects don't expose a direct way to list scheduled alarms, but you can:

1. Check D1 database for active sessions
2. Calculate expected expiration time: `created_at + duration`
3. Cross-reference with current time

```sql
SELECT 
  user_id,
  lab_request_id,
  datetime(created_at, '+' || duration || ' minutes') as expires_at,
  CASE 
    WHEN datetime(created_at, '+' || duration || ' minutes') < datetime('now') 
    THEN 'EXPIRED' 
    ELSE 'ACTIVE' 
  END as status
FROM labs_sessions;
```

## Cost Implications

### Durable Objects Pricing

- **Requests**: $0.15 per million requests
- **Duration**: $12.50 per million GB-seconds
- **Storage**: Included

### Typical Usage Per Lab Session

1. **Create session**: 2 DO requests (schedule)
2. **Alarm fires**: 3 DO requests (alarm + backend API calls + cleanup)
3. **Manual delete**: 2 DO requests (cancel)

**Example**: 10,000 labs/month = 50,000 DO requests ≈ **$0.0075/month**

## Troubleshooting

### Issue: "BACKEND_API_URL not configured"

**Solution**: Set the environment variable:

```bash
npx wrangler secret put BACKEND_API_URL
```

### Issue: Alarm doesn't fire

**Possible causes**:
1. Durable Object migration not run - redeploy
2. Worker hasn't been invoked to activate DO
3. Check logs for errors

**Solution**:
```bash
# Redeploy with migration
npm run deploy

# Check deployment status
npx wrangler deployments list
```

### Issue: Backend API returns 401 Unauthorized

**Solution**: Verify token is set correctly:

```bash
npx wrangler secret put BACKEND_API_TOKEN
```

## Security Considerations

1. **Backend API Token**: Always use Wrangler secrets, never hardcode in `wrangler.toml`
2. **Token Rotation**: Update token via `npx wrangler secret put BACKEND_API_TOKEN`
3. **Rate Limiting**: Backend API should implement rate limiting to prevent abuse
4. **Validation**: Backend API should validate `user_id` matches authenticated user

## Migration from Manual Cleanup

If you're migrating from manual-only cleanup:

1. **No database changes required** - existing sessions work as-is
2. **New sessions** automatically get cleanup scheduled
3. **Existing sessions** won't have cleanup scheduled until they're recreated
4. **Optional**: Run a one-time script to schedule cleanup for existing sessions

## Future Enhancements

Potential improvements:

1. **Configurable retry intervals** - allow customization of 5-minute default
2. **Dead letter queue** - store failed cleanups for manual review
3. **Cleanup webhooks** - notify external systems of cleanup events
4. **Graceful shutdown** - warn users before automatic cleanup (e.g., 5 minutes before)
5. **Cleanup history** - log all cleanup events to analytics

## API Changes

No breaking changes to existing API endpoints. The automatic cleanup is transparent to clients.

**New behavior**:
- POST creates session + schedules cleanup ✅
- DELETE deletes session + cancels cleanup ✅
- GET and PUT are unchanged ✅
