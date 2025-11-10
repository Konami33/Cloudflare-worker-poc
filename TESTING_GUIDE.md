# 🚀 Testing Your Deployed Cloudflare Worker

## Step 1: Find Your Worker URL

After running `npm run deploy`, Wrangler displays your worker URL. It looks like:

```
Published cloudflare-worker-labs-service
  https://cloudflare-worker-labs-service.<your-subdomain>.workers.dev
```

## Step 2: Update test-api.http

Open `test-api.http` and update the `@baseUrl` variable with your actual deployed URL:

```http
### Variables
@baseUrl = https://cloudflare-worker-labs-service.<your-subdomain>.workers.dev
@userId = 675993586c0850de6534d90d
@contentType = application/json
```

## Step 3: Test Using VS Code REST Client

### Option A: VS Code REST Client Extension (Recommended)

1. **Install the Extension:**
   - Open VS Code Extensions (Ctrl+Shift+X)
   - Search for "REST Client" by Huachao Mao
   - Install it

2. **Open test-api.http:**
   - Open the `test-api.http` file

3. **Send Requests:**
   - You'll see "Send Request" links above each HTTP request
   - Click "Send Request" to execute any API call
   - View the response in a split pane

### Option B: PowerShell (Command Line)

```powershell
# Set your worker URL
$baseUrl = "https://cloudflare-worker-labs-service.<your-subdomain>.workers.dev"

# 1. Health Check
Invoke-RestMethod -Method Get -Uri "$baseUrl/health"

# 2. Create a Session
$body = Get-Content -Path test-data.json -Raw
$response = Invoke-RestMethod -Method Post `
    -Uri "$baseUrl/api/v1/labs/sessions" `
    -ContentType "application/json" `
    -Body $body
$response | ConvertTo-Json -Depth 10

# 3. Get the Session
$userId = "675993586c0850de6534d90d"
Invoke-RestMethod -Method Get `
    -Uri "$baseUrl/api/v1/labs/sessions/user/$userId" | 
    ConvertTo-Json -Depth 10

# 4. Update the Session
$updateBody = @{
    duration = 90
    vscode_domain = "new-vscode-domain.io"
} | ConvertTo-Json

Invoke-RestMethod -Method Put `
    -Uri "$baseUrl/api/v1/labs/sessions/$userId" `
    -ContentType "application/json" `
    -Body $updateBody |
    ConvertTo-Json -Depth 10
```

### Option C: cURL (Git Bash/WSL)

```bash
# Set your worker URL
BASE_URL="https://cloudflare-worker-labs-service.<your-subdomain>.workers.dev"

# 1. Health Check
curl "$BASE_URL/health"

# 2. Create a Session
curl -X POST "$BASE_URL/api/v1/labs/sessions" \
  -H "Content-Type: application/json" \
  -d @test-data.json

# 3. Get the Session
curl "$BASE_URL/api/v1/labs/sessions/user/675993586c0850de6534d90d"

# 4. Update the Session
curl -X PUT "$BASE_URL/api/v1/labs/sessions/675993586c0850de6534d90d" \
  -H "Content-Type: application/json" \
  -d '{"duration": 90, "vscode_domain": "new-vscode-domain.io"}'
```

## Step 4: Quick Test Sequence

### 1. Health Check (Verify Deployment)
```http
GET {{baseUrl}}/health
```

Expected Response:
```json
{
  "status": "healthy",
  "service": "lab-sessions-api",
  "timestamp": "2025-11-09T12:00:00.000Z"
}
```

### 2. View API Documentation
```http
GET {{baseUrl}}/
```

### 3. Create a Lab Session
```http
POST {{baseUrl}}/api/v1/labs/sessions
Content-Type: application/json

{
  "labId": "68c455e6a5fbc303e31d428b",
  "labTitle": "NETWORK NAMESPACE INSPECTING (K8S)",
  ...
}
```

### 4. Get the Lab Session
```http
GET {{baseUrl}}/api/v1/labs/sessions/user/675993586c0850de6534d90d
```

### 5. Update the Lab Session
```http
PUT {{baseUrl}}/api/v1/labs/sessions/675993586c0850de6534d90d
Content-Type: application/json

{
  "duration": 90,
  "vscode_domain": "new-vscode-domain.io"
}
```

## Common Testing Scenarios

### Scenario 1: Test Complete Workflow

```powershell
$baseUrl = "https://your-worker.workers.dev"

# 1. Check if worker is running
Write-Host "Testing health..." -ForegroundColor Yellow
Invoke-RestMethod -Method Get -Uri "$baseUrl/health"

# 2. Create a session
Write-Host "`nCreating session..." -ForegroundColor Yellow
$body = Get-Content -Path test-data.json -Raw
$createResponse = Invoke-RestMethod -Method Post `
    -Uri "$baseUrl/api/v1/labs/sessions" `
    -ContentType "application/json" `
    -Body $body

# 3. Get the session
Write-Host "`nGetting session..." -ForegroundColor Yellow
$userId = "675993586c0850de6534d90d"
$getResponse = Invoke-RestMethod -Method Get `
    -Uri "$baseUrl/api/v1/labs/sessions/user/$userId"

# 4. Update the session
Write-Host "`nUpdating session..." -ForegroundColor Yellow
$updateBody = @{
    duration = 90
} | ConvertTo-Json
$updateResponse = Invoke-RestMethod -Method Put `
    -Uri "$baseUrl/api/v1/labs/sessions/$userId" `
    -ContentType "application/json" `
    -Body $updateBody

Write-Host "`nAll tests completed!" -ForegroundColor Green
```

### Scenario 2: Test Error Handling

```powershell
# Try to create duplicate session (should fail with 409)
try {
    $body = Get-Content -Path test-data.json -Raw
    Invoke-RestMethod -Method Post `
        -Uri "$baseUrl/api/v1/labs/sessions" `
        -ContentType "application/json" `
        -Body $body
} catch {
    Write-Host "Expected error: User already has active lab" -ForegroundColor Yellow
    $_.Exception.Response.StatusCode
}

# Try to get non-existent user (should fail with 404)
try {
    Invoke-RestMethod -Method Get `
        -Uri "$baseUrl/api/v1/labs/sessions/user/nonexistent-user"
} catch {
    Write-Host "Expected error: User not found" -ForegroundColor Yellow
    $_.Exception.Response.StatusCode
}
```

## Monitoring & Debugging

### View Real-time Logs
```powershell
wrangler tail
```

This shows live logs from your deployed worker, including:
- All incoming requests
- Console logs
- Errors and exceptions

### View Worker Details
```powershell
wrangler deployments list
```

### View Database Data
```powershell
# View all sessions
wrangler d1 execute labs-database --remote `
    --command "SELECT * FROM labs_sessions"

# Count sessions
wrangler d1 execute labs-database --remote `
    --command "SELECT COUNT(*) as total FROM labs_sessions"

# View specific user's session
wrangler d1 execute labs-database --remote `
    --command "SELECT * FROM labs_sessions WHERE user_id = '675993586c0850de6534d90d'"
```

### Clear Database (For Testing)
```powershell
wrangler d1 execute labs-database --remote `
    --command "DELETE FROM labs_sessions"
```

## Troubleshooting

### Issue: "Cannot resolve hostname"
**Solution:** Make sure you're using the correct worker URL from the deployment output.

### Issue: "404 Not Found"
**Solution:** 
1. Check if worker is deployed: `wrangler deployments list`
2. Verify the endpoint URL is correct
3. Check the API path (should start with `/api/v1/labs/sessions`)

### Issue: "500 Internal Server Error"
**Solution:**
1. Check logs: `wrangler tail`
2. Verify database is initialized: `wrangler d1 execute labs-database --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`

### Issue: Database errors
**Solution:** Re-initialize the database:
```powershell
npm run db:init:remote
```

## Quick Reference: PowerShell Test Script

Save this as `test-worker.ps1`:

```powershell
# Configuration
$baseUrl = "https://your-worker.workers.dev"  # UPDATE THIS!
$userId = "675993586c0850de6534d90d"

function Test-Health {
    Write-Host "`n=== Health Check ===" -ForegroundColor Cyan
    Invoke-RestMethod -Method Get -Uri "$baseUrl/health" | ConvertTo-Json
}

function Test-CreateSession {
    Write-Host "`n=== Create Session ===" -ForegroundColor Cyan
    $body = Get-Content -Path test-data.json -Raw
    Invoke-RestMethod -Method Post `
        -Uri "$baseUrl/api/v1/labs/sessions" `
        -ContentType "application/json" `
        -Body $body | ConvertTo-Json -Depth 10
}

function Test-GetSession {
    Write-Host "`n=== Get Session ===" -ForegroundColor Cyan
    Invoke-RestMethod -Method Get `
        -Uri "$baseUrl/api/v1/labs/sessions/user/$userId" |
        ConvertTo-Json -Depth 10
}

function Test-UpdateSession {
    Write-Host "`n=== Update Session ===" -ForegroundColor Cyan
    $updateBody = @{
        duration = 90
        vscode_domain = "updated-vscode.example.com"
    } | ConvertTo-Json
    
    Invoke-RestMethod -Method Put `
        -Uri "$baseUrl/api/v1/labs/sessions/$userId" `
        -ContentType "application/json" `
        -Body $updateBody |
        ConvertTo-Json -Depth 10
}

# Run all tests
Test-Health
Test-CreateSession
Test-GetSession
Test-UpdateSession

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
```

Usage:
```powershell
.\test-worker.ps1
```

## Next Steps

1. ✅ Update `@baseUrl` in `test-api.http` with your deployed URL
2. ✅ Install REST Client extension in VS Code
3. ✅ Run health check to verify deployment
4. ✅ Test creating a session
5. ✅ Test retrieving and updating sessions
6. ✅ Monitor logs with `wrangler tail`

Happy testing! 🎉
