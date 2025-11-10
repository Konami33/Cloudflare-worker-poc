# 🚀 Deployment Checklist - Automatic Cleanup Feature

Use this checklist to deploy the automatic lab session cleanup feature.

## Pre-Deployment

- [ ] **Review implementation**
  - [ ] Read `IMPLEMENTATION_SUMMARY.md`
  - [ ] Read `AUTOMATIC_CLEANUP.md`
  - [ ] Understand the alarm/cleanup flow

- [ ] **Verify backend API**
  - [ ] Backend has DELETE `/api/v1/expose/` endpoint
  - [ ] Backend has POST `/api/v1/labs/delete` endpoint
  - [ ] Backend returns 202 status for VM deletion
  - [ ] Authentication token is valid

- [ ] **Local testing** (optional but recommended)
  - [ ] Run `npm install`
  - [ ] Run `npm run dev` (with --remote flag)
  - [ ] Test basic CRUD operations
  - [ ] Review console for any TypeScript errors

## Deployment Steps

### Step 1: Set Backend Configuration

```bash
# Set backend API URL
npm run secret:set:url
# When prompted, enter: https://your-backend-api.com

# Set backend API authentication token
npm run secret:set:token
# When prompted, enter: your_bearer_token_here
```

**Verification**:
```bash
npm run secret:list
# Should show:
# BACKEND_API_URL
# BACKEND_API_TOKEN
```

- [ ] Backend API URL configured
- [ ] Backend API token configured
- [ ] Secrets verified with `npm run secret:list`

### Step 2: Deploy to Cloudflare

```bash
npm run deploy
```

**Expected output**:
```
✨ Migrating Durable Objects:
  - v1: new_classes = ["SessionManager"]
✅ Successfully deployed to cloudflare-worker-labs-service.your-subdomain.workers.dev
```

- [ ] Deployment successful
- [ ] Durable Object migration completed
- [ ] Worker URL noted: _______________________________________________

### Step 3: Verify Deployment

```bash
# Check deployment status
npm run deployments

# Verify worker is responding
curl https://your-worker.workers.dev/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "service": "lab-sessions-api",
  "timestamp": "2025-11-09T..."
}
```

- [ ] Health check returns 200
- [ ] Deployment shows in list
- [ ] Worker URL is accessible

## Post-Deployment Testing

### Test 1: Create Session with Short Duration

```bash
curl -X POST https://your-worker.workers.dev/api/v1/labs/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "labId": "test-auto-cleanup",
    "labTitle": "Auto Cleanup Test",
    "labGroupID": "test-group",
    "moduleID": "test-module",
    "duration": 1,
    "activatedAt": "2025-11-09T12:00:00Z",
    "counterID": "counter-test",
    "configId": "config-test",
    "workerConfigId": "worker-config-test",
    "lab_request_id": "test-lab-123",
    "user_id": "test-user-123",
    "terminal_url": "https://terminal.test.com",
    "validation": 0,
    "vm": {
      "name": "test-vm",
      "network_id": "net-test",
      "netbird_ip": "100.64.0.1"
    }
  }'
```

- [ ] Session created successfully (201 status)
- [ ] Response includes session data

### Test 2: Monitor Logs

```bash
npm run tail
```

**Watch for** (after 1 minute):
```
[SessionManager] Alarm triggered for user test-user-123
[SessionManager] Calling backend API...
[SessionManager] ✅ Successfully cleaned up expired session
```

- [ ] Logs show alarm triggered
- [ ] Backend API called successfully
- [ ] Database entry deleted
- [ ] No errors in logs

### Test 3: Verify Automatic Deletion

```bash
# Wait 1 minute after creating session
sleep 60

# Check if session is deleted
curl https://your-worker.workers.dev/api/v1/labs/sessions/user/test-user-123
```

**Expected response** (404):
```json
{
  "success": false,
  "error": "No lab session found for this user"
}
```

- [ ] Session automatically deleted after 1 minute
- [ ] Returns 404 status
- [ ] Backend API was called (check backend logs)

### Test 4: Manual Deletion (Cancel Alarm)

```bash
# Create session with 5-minute duration
curl -X POST https://your-worker.workers.dev/api/v1/labs/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-456",
    "lab_request_id": "test-lab-456",
    "duration": 5,
    ...
  }'

# Immediately delete (before 5 minutes)
curl -X DELETE https://your-worker.workers.dev/api/v1/labs/sessions/test-user-456

# Check logs - should show alarm cancelled
```

**Expected log**:
```
[Handler] Automatic cleanup cancelled: { success: true, user_id: "test-user-456" }
```

- [ ] Session created successfully
- [ ] Manual deletion successful
- [ ] Logs show alarm cancelled
- [ ] No automatic cleanup after 5 minutes

## Production Verification

### Day 1: Monitor First 24 Hours

```bash
# Check for any errors
npm run tail | grep "❌"

# Check for successful cleanups
npm run tail | grep "✅ Successfully cleaned up"
```

- [ ] No critical errors in logs
- [ ] Automatic cleanups working as expected
- [ ] Backend API responding correctly
- [ ] No retry loops (check for repeated failures)

### Week 1: Check Metrics

- [ ] Review Cloudflare Analytics for Durable Object usage
- [ ] Check backend API logs for VM deletion requests
- [ ] Verify no orphaned sessions in D1 database
- [ ] Monitor costs (should be negligible)

## Rollback Plan (If Needed)

If you encounter issues and need to rollback:

### Option 1: Deploy Previous Version

```bash
# List previous deployments
npm run deployments

# Rollback to previous deployment (via Cloudflare Dashboard)
# Workers & Pages → Your Worker → Deployments → Rollback
```

### Option 2: Disable Automatic Cleanup

**Quick fix**: Remove Durable Object calls in handlers:

```bash
# Edit src/handlers.ts and comment out:
# - Durable Object scheduling in createLabSession
# - Durable Object cancellation in deleteLabSession

# Redeploy
npm run deploy
```

Sessions will still be created/deleted manually, but no automatic cleanup.

- [ ] Rollback plan documented
- [ ] Team knows how to rollback if needed

## Documentation Updates

- [ ] Update team documentation with new feature
- [ ] Share `SETUP_AUTO_CLEANUP.md` with team
- [ ] Document backend API expectations
- [ ] Update API documentation for clients

## Monitoring Setup

- [ ] Set up Cloudflare Analytics alerts (optional)
- [ ] Configure logging aggregation (optional)
- [ ] Create dashboard for lab session metrics (optional)
- [ ] Set up alerts for failed cleanups (optional)

## Final Checks

- [ ] All tests passed
- [ ] Logs show no errors
- [ ] Backend integration working
- [ ] Team notified of new feature
- [ ] Documentation updated
- [ ] Rollback plan ready

## Sign-Off

**Deployed by**: _____________________ **Date**: _____________________

**Verified by**: _____________________ **Date**: _____________________

---

## Quick Reference

### Useful Commands

```bash
# View logs
npm run tail

# Check secrets
npm run secret:list

# List deployments
npm run deployments

# Query active sessions
npx wrangler d1 execute labs-database --remote --command "SELECT * FROM labs_sessions"

# Check for expired sessions
npx wrangler d1 execute labs-database --remote --command "
  SELECT 
    user_id,
    CASE 
      WHEN datetime(created_at, '+' || duration || ' minutes') < datetime('now')
      THEN 'EXPIRED' 
      ELSE 'ACTIVE' 
    END as status
  FROM labs_sessions
"
```

### Support Resources

- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Full Documentation**: `AUTOMATIC_CLEANUP.md`
- **Setup Guide**: `SETUP_AUTO_CLEANUP.md`
- **Test Scenarios**: `test-auto-cleanup.http`
- **Main README**: `README.md`

---

## Status

✅ **Deployment Complete** - Automatic cleanup feature is now active!

All new lab sessions will automatically clean up after their duration expires.
