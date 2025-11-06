# 🚀 Cloudflare Worker - Lab Sessions API

A Cloudflare Worker service that manages cloud lab state information using D1 Database. This service provides a REST API to store, retrieve, and update active lab sessions for users.

## 📋 Features

- **RESTful API** for lab session management
- **D1 Database** integration for persistent storage
- **One active lab per user** enforcement
- **JSON storage** for complex objects (VM, worker nodes, load balancers)
- **TypeScript** for type safety
- **CORS support** for cross-origin requests

## 🗄️ Database Schema

Each record represents the state of a single user's active lab session. The `labs_sessions` table includes:

- Session metadata (ID, timestamps, duration)
- Lab information (title, group, module)
- User association (user_id - unique constraint)
- Infrastructure details (VM, worker nodes, load balancers)
- Service endpoints (terminal, VS Code, Puku editor)

## 📚 API Endpoints

### 1. Create Lab Session
```http
POST /api/v1/labs/sessions
Content-Type: application/json
```

**Request Body:**
```json
{
  "labId": "68c455e6a5fbc303e31d428b",
  "labTitle": "NETWORK NAMESPACE INSPECTING (K8S)",
  "labGroupID": "68c455c0a5fbc303e31d4269",
  "moduleID": "68c455e6a5fbc303e31d4287",
  "duration": 60,
  "activatedAt": "2025-11-06T06:03:31.559Z",
  "counterID": "68c455e6a5fbc303e31d428b",
  "configId": "e8ceb72a-f12b-4565-a0fe-49bfd49wkf14",
  "workerConfigId": "e8ceb72a-f12b-4565-a0fe-49bfd49wkf15",
  "lab_request_id": "9f3077ea-8d03-44f0-a6b3-c9697b43427c",
  "user_id": "675993586c0850de6534d90d",
  "terminal_url": "https://675993586c0850de6534d90d_abb17775.terminal-stag.poridhi.io",
  "validation": 1762412611563,
  "vm": {
    "name": "k3s-master-1-9f3077ea-8018e1",
    "network_id": "4eeee504-a9cc-46eb-9121-32fb9dd51975",
    "netbird_ip": "100.125.174.16"
  },
  "vscode_domain": "675993586c0850de6534d90d_136ee932.vscode-stag.poridhi.io",
  "puku_domain": "675993586c0850de6534d90d_9551ff4b.puku-editor-stag.poridhi.io",
  "worker_nodes": [
    {
      "name": "k3s-worker-41516a2d-43ae1f",
      "worker_lab_request_id": "41516a2d-8073-4601-9907-d98d8af25b25",
      "network_id": "4eeee504-a9cc-46eb-9121-32fb9dd51975",
      "netbird_ip": "100.125.42.245"
    }
  ],
  "loadBalancers": [
    {
      "id": "02849259",
      "domain": "675993586c0850de6534d90d_02849259.lb-stag.poridhi.io",
      "port": "4000"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Lab session created successfully",
  "data": {
    "id": "generated-uuid",
    ...
  }
}
```

**Error (409 Conflict):**
```json
{
  "success": false,
  "error": "User already has an active lab session. Only one active lab per user is allowed."
}
```

### 2. Get Lab Session by User ID
```http
GET /api/v1/labs/sessions/user/:user_id
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lab session retrieved successfully",
  "data": {
    "id": "uuid",
    "labId": "68c455e6a5fbc303e31d428b",
    ...
  }
}
```

**Error (404 Not Found):**
```json
{
  "success": false,
  "error": "No active lab session found for this user"
}
```

### 3. Update Lab Session
```http
PUT /api/v1/labs/sessions/:user_id
Content-Type: application/json
```

**Request Body (partial update):**
```json
{
  "worker_nodes": [
    {
      "name": "k3s-worker-2",
      "worker_lab_request_id": "new-request-id",
      "network_id": "network-id",
      "netbird_ip": "100.125.42.246"
    }
  ],
  "loadBalancers": [
    {
      "id": "02849260",
      "domain": "new-lb-domain.io",
      "port": "5000"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Lab session updated successfully",
  "data": {
    ...updated session data
  }
}
```

### 4. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "lab-sessions-api",
  "timestamp": "2025-11-06T12:00:00.000Z"
}
```

## 🛠️ Setup & Installation

> **🪟 Windows Users:** Please see [WINDOWS_SETUP.md](WINDOWS_SETUP.md) for Windows-specific setup instructions due to local D1 compatibility issues.

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)

### 1. Install Dependencies

```bash
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create D1 Database

```bash
wrangler d1 create labs-database
```

This will output a database ID. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "labs-database"
database_id = "your-database-id-here"  # Replace with actual ID
```

### 4. Initialize Database Schema

For local development:
```bash
npm run db:init
```

For production:
```bash
npm run db:init:remote
```

## 🚀 Development

### Run Locally

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`

### Test the API

**Create a session:**
```bash
curl -X POST http://localhost:8787/api/v1/labs/sessions \
  -H "Content-Type: application/json" \
  -d @test-data.json
```

**Get a session:**
```bash
curl http://localhost:8787/api/v1/labs/sessions/user/675993586c0850de6534d90d
```

**Update a session:**
```bash
curl -X PUT http://localhost:8787/api/v1/labs/sessions/675993586c0850de6534d90d \
  -H "Content-Type: application/json" \
  -d '{"duration": 90}'
```

## 📦 Deployment

### Deploy to Cloudflare

```bash
npm run deploy
```

Your worker will be deployed to: `https://cloudflare-worker-labs-service.<your-subdomain>.workers.dev`

### Environment Configuration

The worker supports different environments (development, production). Configure in `wrangler.toml`:

```toml
[env.production]
[env.production.vars]
ENVIRONMENT = "production"
```

Deploy to specific environment:
```bash
wrangler deploy --env production
```

## 🧪 Testing

You can test the API using the provided example in your request. Create a `test-data.json` file:

```json
{
  "labId": "68c455e6a5fbc303e31d428b",
  "labTitle": "NETWORK NAMESPACE INSPECTING (K8S)",
  "labGroupID": "68c455c0a5fbc303e31d4269",
  "moduleID": "68c455e6a5fbc303e31d4287",
  "duration": 60,
  "activatedAt": "2025-11-06T06:03:31.559Z",
  "counterID": "68c455e6a5fbc303e31d428b",
  "configId": "e8ceb72a-f12b-4565-a0fe-49bfd49wkf14",
  "workerConfigId": "e8ceb72a-f12b-4565-a0fe-49bfd49wkf15",
  "lab_request_id": "9f3077ea-8d03-44f0-a6b3-c9697b43427c",
  "user_id": "675993586c0850de6534d90d",
  "terminal_url": "https://675993586c0850de6534d90d_abb17775.terminal-stag.poridhi.io",
  "validation": 1762412611563,
  "vm": {
    "name": "k3s-master-1-9f3077ea-8018e1",
    "network_id": "4eeee504-a9cc-46eb-9121-32fb9dd51975",
    "netbird_ip": "100.125.174.16"
  },
  "vscode_domain": "675993586c0850de6534d90d_136ee932.vscode-stag.poridhi.io",
  "puku_domain": "675993586c0850de6534d90d_9551ff4b.puku-editor-stag.poridhi.io",
  "worker_nodes": [
    {
      "name": "k3s-worker-41516a2d-43ae1f",
      "worker_lab_request_id": "41516a2d-8073-4601-9907-d98d8af25b25",
      "network_id": "4eeee504-a9cc-46eb-9121-32fb9dd51975",
      "netbird_ip": "100.125.42.245"
    }
  ],
  "loadBalancers": [
    {
      "id": "02849259",
      "domain": "675993586c0850de6534d90d_02849259.lb-stag.poridhi.io",
      "port": "4000"
    }
  ]
}
```

## 📁 Project Structure

```
cloudflare-worker-poc/
├── src/
│   ├── index.ts          # Main entry point and routing
│   ├── handlers.ts       # API endpoint handlers
│   ├── types.ts          # TypeScript interfaces
│   └── utils.ts          # Utility functions
├── schema.sql            # D1 database schema
├── wrangler.toml         # Cloudflare Worker configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## 🔒 Business Logic

1. **One Active Lab Per User**: The database enforces a unique constraint on `user_id`, ensuring each user can only have one active lab session at a time.

2. **Session Creation**: When a new lab is launched, the POST endpoint creates a new record. If the user already has an active session, it returns a 409 Conflict error.

3. **Session Updates**: During lab runtime, the PUT endpoint allows updating fields like `worker_nodes`, `loadBalancers`, or domain configurations.

4. **Session Retrieval**: The GET endpoint returns the active lab session for a given user.

## 🛡️ Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `404` - Not Found
- `409` - Conflict (user already has active lab)
- `500` - Internal Server Error

## 📝 License

MIT