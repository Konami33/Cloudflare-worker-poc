# Quick Setup: Automatic Cleanup Feature

Follow these steps to enable automatic lab session cleanup.

## Prerequisites

- Cloudflare account with Workers and Durable Objects enabled
- Backend API with VM deletion endpoints
- Wrangler CLI installed

## Step-by-Step Setup

### Step 1: Configure Backend API Credentials

Set your backend API URL and authentication token:

```bash
# Set backend API base URL
npx wrangler secret put BACKEND_API_URL
# When prompted, enter: https://your-backend-api.com

# Set backend API authentication token
npx wrangler secret put BACKEND_API_TOKEN
# When prompted, enter: your_bearer_token_here
```

> **Note**: These are secrets and won't be visible in `wrangler.toml` or version control.

### Step 2: Deploy Worker

Deploy the worker with Durable Objects:

```bash
npm run deploy
```

You should see output indicating the Durable Object migration:

```
✨ Migrating Durable Objects:
  - v1: new_classes = ["SessionManager"]
✅ Successfully deployed to cloudflare-worker-labs-service.your-subdomain.workers.dev
```

### Step 3: Verify Configuration

Check that secrets are set:

```bash
npx wrangler secret list
```

Expected output:
```
BACKEND_API_URL
BACKEND_API_TOKEN
```

### Step 4: Test Automatic Cleanup

Create a test session with 1-minute duration:

```bash
curl -X POST https://your-worker.workers.dev/api/v1/labs/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-auto-cleanup",
    "lab_request_id": "test-lab-auto-cleanup",
    "labId": "lab-001",
    "labTitle": "Test Auto Cleanup",
    "labGroupID": "group-001",
    "moduleID": "module-001",
    "duration": 1,
    "activatedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "counterID": "counter-001",
    "configId": "config-001",
    "workerConfigId": "worker-config-001",
    "terminal_url": "https://terminal.example.com",
    "validation": 0,
    "vm": {
      "name": "test-vm",
      "network_id": "net-001",
      "netbird_ip": "100.64.0.1"
    }
  }'
```

### Step 5: Monitor Logs

Watch logs in real-time:

```bash
npx wrangler tail
```

After 1 minute, you should see:

```
[SessionManager] Alarm triggered for user test-user-auto-cleanup
[SessionManager] Calling backend API to delete resources
[SessionManager] Deleting exposed services for lab test-lab-auto-cleanup
[SessionManager] ✅ Exposed services deleted
[SessionManager] Deleting VM for lab test-lab-auto-cleanup
[SessionManager] ✅ VM deleted successfully
[SessionManager] ✅ Database entry deleted for user test-user-auto-cleanup
[SessionManager] ✅ Successfully cleaned up expired session
```

### Step 6: Verify Cleanup

Check that the session was deleted:

```bash
curl https://your-worker.workers.dev/api/v1/labs/sessions/user/test-user-auto-cleanup
```

Expected response (404):
```json
{
  "success": false,
  "error": "No lab session found for this user"
}
```

## Configuration Options

### Development Environment

For local development with remote backend:

```bash
# Use --remote flag to access Durable Objects
npm run dev
```

### Production Environment

Set production-specific configuration in `wrangler.toml`:

```toml
[env.production]
[env.production.vars]
ENVIRONMENT = "production"
```

Then deploy to production:

```bash
npx wrangler deploy --env production
```

## Troubleshooting

### Problem: "BACKEND_API_URL not configured"

**Solution**: Ensure secrets are set:

```bash
npx wrangler secret put BACKEND_API_URL
npx wrangler secret put BACKEND_API_TOKEN
```

### Problem: Alarm doesn't trigger

**Solution**: Check Durable Objects are enabled:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker
3. Go to Settings → Bindings
4. Verify `SESSION_MANAGER` Durable Object binding exists

### Problem: Backend API returns 401

**Solution**: Verify token format:

```bash
# Re-set the token
npx wrangler secret put BACKEND_API_TOKEN
# Enter: Bearer YOUR_TOKEN (if backend expects "Bearer" prefix)
# OR
# Enter: YOUR_TOKEN (if backend adds "Bearer" automatically)
```

Check SessionManager.ts line for how token is used:
```typescript
'Authorization': `Bearer ${authToken}`
```

### Problem: Service deletion fails but VM deletion works

**Expected behavior**: Service deletion is "best effort" and won't block VM deletion.

Check logs to verify:
```
[SessionManager] ⚠️ Failed to delete exposed services (continued)
[SessionManager] ✅ VM deleted successfully
```

## Next Steps

1. **Update Backend API URL** for production
2. **Set up monitoring** with Cloudflare Analytics
3. **Configure alerts** for failed cleanups
4. **Review logs** regularly to ensure cleanups are working
5. **Adjust retry logic** if needed (default: 5 minutes)

## Architecture Summary

```
User Creates Lab → Worker stores in D1 → Durable Object schedules alarm
                                              ↓
                                        (waits for duration)
                                              ↓
Alarm fires → Delete Services → Delete VM → Delete D1 entry → ✅ Done
```

## Support

- See full documentation: `AUTOMATIC_CLEANUP.md`
- Check API examples: `API_EXAMPLES.md`
- View main README: `README.md`

---

**Status**: ✅ Automatic cleanup feature is now active!

All new lab sessions will automatically clean up after their duration expires.
