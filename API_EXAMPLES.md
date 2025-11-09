# API Examples

This file contains practical examples for all API endpoints.

## Base URL
- **Local Development:** `http://localhost:8787`
- **Production:** `https://your-worker.workers.dev`

---

## 1. Create Lab Session

### Request
```http
POST /api/v1/labs/sessions
Content-Type: application/json
```

### Example 1: Minimal Required Fields
```json
{
  "labId": "lab-123",
  "labTitle": "Introduction to Kubernetes",
  "labGroupID": "group-456",
  "moduleID": "module-789",
  "duration": 60,
  "activatedAt": "2025-11-06T10:00:00.000Z",
  "counterID": "counter-001",
  "configId": "config-abc",
  "workerConfigId": "worker-config-xyz",
  "lab_request_id": "request-uuid-1234",
  "user_id": "user-12345",
  "terminal_url": "https://terminal.example.com",
  "validation": 1234567890,
  "vm": {
    "name": "master-vm-1",
    "network_id": "net-001",
    "netbird_ip": "100.125.1.1"
  }
}
```

### Example 2: Full Lab Session with All Fields
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
  "vscode_domain": "675993586c0850de6534d90d_136ee932.vscode-stag.poridhi.io",
  "puku_domain": "675993586c0850de6534d90d_9551ff4b.puku-editor-stag.poridhi.io",
  "vm": {
    "name": "k3s-master-1-9f3077ea-8018e1",
    "network_id": "4eeee504-a9cc-46eb-9121-32fb9dd51975",
    "netbird_ip": "100.125.174.16"
  },
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

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Lab session created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "labId": "68c455e6a5fbc303e31d428b",
    "labTitle": "NETWORK NAMESPACE INSPECTING (K8S)",
    ...
  }
}
```

### Error Responses

**Missing Required Fields (400)**
```json
{
  "success": false,
  "error": "Missing required fields: labId, user_id, vm"
}
```

**User Already Has Active Lab (409)**
```json
{
  "success": false,
  "error": "User already has an active lab session. Only one active lab per user is allowed."
}
```

---

## 2. Get Lab Session by User ID

### Request
```http
GET /api/v1/labs/sessions/user/:user_id
```

### Example
```bash
GET /api/v1/labs/sessions/user/675993586c0850de6534d90d
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Lab session retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "labId": "68c455e6a5fbc303e31d428b",
    "labTitle": "NETWORK NAMESPACE INSPECTING (K8S)",
    "labGroupID": "68c455c0a5fbc303e31d4269",
    "moduleID": "68c455e6a5fbc303e31d4287",
    "duration": 60,
    "activatedAt": "2025-11-06T06:03:31.559Z",
    "user_id": "675993586c0850de6534d90d",
    "vm": {
      "name": "k3s-master-1-9f3077ea-8018e1",
      "network_id": "4eeee504-a9cc-46eb-9121-32fb9dd51975",
      "netbird_ip": "100.125.174.16"
    },
    "worker_nodes": [...],
    "loadBalancers": [...]
  }
}
```

### Error Response (404 Not Found)
```json
{
  "success": false,
  "error": "No active lab session found for this user"
}
```

---

## 3. Update Lab Session

### Request
```http
PUT /api/v1/labs/sessions/:user_id
Content-Type: application/json
```

### Example 1: Add Worker Nodes
```json
{
  "worker_nodes": [
    {
      "name": "k3s-worker-1",
      "worker_lab_request_id": "worker-req-1",
      "network_id": "net-001",
      "netbird_ip": "100.125.42.245"
    },
    {
      "name": "k3s-worker-2",
      "worker_lab_request_id": "worker-req-2",
      "network_id": "net-001",
      "netbird_ip": "100.125.42.246"
    }
  ]
}
```

### Example 2: Add Load Balancers
```json
{
  "loadBalancers": [
    {
      "id": "lb-001",
      "domain": "app.lb-stag.poridhi.io",
      "port": "8080"
    },
    {
      "id": "lb-002",
      "domain": "api.lb-stag.poridhi.io",
      "port": "3000"
    }
  ]
}
```

### Example 3: Update Domains
```json
{
  "vscode_domain": "user123_vscode.example.com",
  "puku_domain": "user123_puku.example.com"
}
```

### Example 4: Update Multiple Fields
```json
{
  "duration": 90,
  "terminal_url": "https://new-terminal.example.com",
  "vscode_domain": "new-vscode.example.com",
  "worker_nodes": [
    {
      "name": "k3s-worker-3",
      "worker_lab_request_id": "worker-req-3",
      "network_id": "net-001",
      "netbird_ip": "100.125.42.247"
    }
  ]
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Lab session updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "labId": "68c455e6a5fbc303e31d428b",
    ...updated fields...
  }
}
```

### Error Responses

**Session Not Found (404)**
```json
{
  "success": false,
  "error": "No active lab session found for this user"
}
```

**Empty Request Body (400)**
```json
{
  "success": false,
  "error": "Request body cannot be empty"
}
```

---

## 4. Delete Lab Session

### Request
```http
DELETE /api/v1/labs/sessions/:user_id
```

### Example
```bash
DELETE /api/v1/labs/sessions/675993586c0850de6534d90d
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Lab session deleted successfully",
  "data": {
    "user_id": "675993586c0850de6534d90d",
    "deleted": true
  }
}
```

### Error Response (404 Not Found)
```json
{
  "success": false,
  "error": "No active lab session found for this user"
}
```

---

## 5. Health Check

### Request
```http
GET /health
```

### Response (200 OK)
```json
{
  "status": "healthy",
  "service": "lab-sessions-api",
  "timestamp": "2025-11-06T12:00:00.000Z"
}
```

---

## cURL Examples

### Create Session
```bash
curl -X POST http://localhost:8787/api/v1/labs/sessions \
  -H "Content-Type: application/json" \
  -d @test-data.json
```

### Get Session
```bash
curl http://localhost:8787/api/v1/labs/sessions/user/675993586c0850de6534d90d
```

### Update Session
```bash
curl -X PUT http://localhost:8787/api/v1/labs/sessions/675993586c0850de6534d90d \
  -H "Content-Type: application/json" \
  -d '{
    "duration": 90,
    "vscode_domain": "new-vscode-domain.io"
  }'
```

### Delete Session
```bash
curl -X DELETE http://localhost:8787/api/v1/labs/sessions/675993586c0850de6534d90d
```

### Health Check
```bash
curl http://localhost:8787/health
```

---

## PowerShell Examples (Windows)

### Create Session
```powershell
$body = Get-Content -Path test-data.json -Raw
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8787/api/v1/labs/sessions" `
  -ContentType "application/json" `
  -Body $body
```

### Get Session
```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://localhost:8787/api/v1/labs/sessions/user/675993586c0850de6534d90d"
```

### Update Session
```powershell
$updateBody = @{
    duration = 90
    vscode_domain = "new-vscode-domain.io"
} | ConvertTo-Json

Invoke-RestMethod -Method Put `
  -Uri "http://localhost:8787/api/v1/labs/sessions/675993586c0850de6534d90d" `
  -ContentType "application/json" `
  -Body $updateBody
```

### Delete Session
```powershell
Invoke-RestMethod -Method Delete `
  -Uri "http://localhost:8787/api/v1/labs/sessions/675993586c0850de6534d90d"
```

### Health Check
```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8787/health"
```

---

## JavaScript/Fetch Examples

### Create Session
```javascript
const createSession = async () => {
  const response = await fetch('http://localhost:8787/api/v1/labs/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      labId: "lab-123",
      labTitle: "Introduction to Kubernetes",
      // ... other required fields
    }),
  });
  
  const data = await response.json();
  console.log(data);
};
```

### Get Session
```javascript
const getSession = async (userId) => {
  const response = await fetch(
    `http://localhost:8787/api/v1/labs/sessions/user/${userId}`
  );
  
  const data = await response.json();
  console.log(data);
};
```

### Update Session
```javascript
const updateSession = async (userId, updates) => {
  const response = await fetch(
    `http://localhost:8787/api/v1/labs/sessions/${userId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );
  
  const data = await response.json();
  console.log(data);
};
```

---

## Use Case Scenarios

### Scenario 1: Launch a New Lab
1. User starts a lab from the frontend
2. Frontend calls POST `/api/v1/labs/sessions` with initial lab data
3. API creates session and returns session ID
4. Frontend displays lab environment to user

### Scenario 2: Add Services During Lab Runtime
1. User's lab is running
2. User spawns a new worker node
3. Frontend calls PUT `/api/v1/labs/sessions/:user_id` with new worker node info
4. API updates the session with new worker node
5. Frontend reflects the updated infrastructure

### Scenario 3: Resume Lab Session
1. User refreshes the page or returns later
2. Frontend calls GET `/api/v1/labs/sessions/user/:user_id`
3. API returns current lab state
4. Frontend reconstructs the lab UI with saved state

### Scenario 4: Add Load Balancer
1. User creates a service that needs external access
2. System provisions a load balancer
3. Frontend calls PUT with new load balancer info
4. API stores the load balancer configuration
5. User can access service via load balancer URL
