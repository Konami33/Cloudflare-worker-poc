# 🚀 Quick Start Guide

## Getting Started in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Login to Cloudflare
```bash
wrangler login
```

### Step 3: Create and Configure D1 Database

1. Create the database:
```bash
wrangler d1 create labs-database
```

2. Copy the `database_id` from the output and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "labs-database"
database_id = "your-database-id-here"  # Paste your ID here
```

3. Initialize the database schema:

**⚠️ Windows Users:** Local D1 has known issues on Windows. Use remote database:
```bash
npm run db:init:remote
```

**Other Platforms (optional local development):**
```bash
npm run db:init
```

### Step 4: Start Development Server
```bash
npm run dev
```

Your API is now running at `http://localhost:8787`

### Step 5: Test the API

**Test with the provided sample data:**

1. **Create a lab session:**
```bash
curl -X POST http://localhost:8787/api/v1/labs/sessions \
  -H "Content-Type: application/json" \
  -d @test-data.json
```

2. **Retrieve the session:**
```bash
curl http://localhost:8787/api/v1/labs/sessions/user/675993586c0850de6534d90d
```

3. **Update the session:**
```bash
curl -X PUT http://localhost:8787/api/v1/labs/sessions/675993586c0850de6534d90d \
  -H "Content-Type: application/json" \
  -d '{"duration": 90, "vscode_domain": "new-vscode-domain.io"}'
```

4. **Health check:**
```bash
curl http://localhost:8787/health
```

### Step 6: Deploy to Production
```bash
npm run deploy
```

## 🎯 PowerShell Commands (Windows)

If you're using PowerShell, use these commands instead:

**Create a session:**
```powershell
$body = Get-Content -Path test-data.json -Raw
Invoke-RestMethod -Method Post -Uri "http://localhost:8787/api/v1/labs/sessions" -ContentType "application/json" -Body $body
```

**Get a session:**
```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8787/api/v1/labs/sessions/user/675993586c0850de6534d90d"
```

**Update a session:**
```powershell
$updateBody = @{
    duration = 90
    vscode_domain = "new-vscode-domain.io"
} | ConvertTo-Json

Invoke-RestMethod -Method Put -Uri "http://localhost:8787/api/v1/labs/sessions/675993586c0850de6534d90d" -ContentType "application/json" -Body $updateBody
```

## 📝 Common Issues

### Issue: "Workers runtime failed to start" (Windows)
**Problem:** Wrangler's local D1 execution has known issues on Windows, causing access violations.

**Solution:** Use the remote database instead:
```bash
npm run db:init:remote
```

When developing locally, you can either:
1. **Use remote database:** Your worker will connect to the remote D1 database even in dev mode
2. **Deploy and test:** Deploy your worker with `npm run deploy` and test against production

### Issue: "No binding found for DB"
**Solution:** Make sure you've:
1. Created the D1 database with `wrangler d1 create labs-database`
2. Updated the `database_id` in `wrangler.toml`
3. Restarted the dev server

### Issue: TypeScript errors during development
**Solution:** These are expected before installing dependencies. Run:
```bash
npm install
```

### Issue: "User already has an active lab session"
**Solution:** This is by design. Each user can only have one active lab. To test with a new session:
- Use a different `user_id` in your test data, or
- Delete the existing session from the database first

### Issue: CORS errors in browser
**Solution:** The API includes CORS headers automatically. Make sure you're using the correct endpoint URL.

## 🔍 Useful Commands

**View local D1 database:**
```bash
wrangler d1 execute labs-database --local --command "SELECT * FROM labs_sessions"
```

**View production D1 database:**
```bash
wrangler d1 execute labs-database --remote --command "SELECT * FROM labs_sessions"
```

**Clear all sessions (local):**
```bash
wrangler d1 execute labs-database --local --command "DELETE FROM labs_sessions"
```

**Tail logs (production):**
```bash
wrangler tail
```

## 🎉 Next Steps

- Review the [full API documentation](README.md#-api-endpoints)
- Explore the [project structure](README.md#-project-structure)
- Learn about [deployment options](README.md#-deployment)
- Understand the [business logic](README.md#-business-logic)
