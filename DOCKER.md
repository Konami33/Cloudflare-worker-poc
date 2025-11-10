# 🐳 Docker Setup Guide

This guide explains how to run the Cloudflare Worker project in a Dockerized environment.

## 📋 Prerequisites

- Docker installed ([Download Docker](https://www.docker.com/products/docker-desktop))
- Docker Compose installed (included with Docker Desktop)
- Cloudflare account with Wrangler authenticated on your host machine

## 🚀 Quick Start

### 1. Authenticate Wrangler (One-time setup)

Before running Docker, authenticate Wrangler on your host machine:

```bash
wrangler login
```

This creates authentication files in `~/.wrangler` which will be mounted into the container.

### 2. Build and Run with Docker Compose

```bash
# Build and start the container
docker-compose up --build

# Or run in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f
```

The API will be available at `http://localhost:8787`

### 3. Stop the Container

```bash
# Stop the container
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## 🐳 Docker Commands

### Using Docker Compose (Recommended)

```bash
# Build the image
docker-compose build

# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f cloudflare-worker

# Stop services
docker-compose stop

# Remove containers and networks
docker-compose down

# Rebuild and restart
docker-compose up --build --force-recreate
```

### Using Docker CLI Directly

```bash
# Build the image
docker build -t cloudflare-worker-labs .

# Run the container
docker run -p 8787:8787 \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/wrangler.toml:/app/wrangler.toml \
  -v ~/.wrangler:/root/.wrangler:ro \
  cloudflare-worker-labs

# Run in background
docker run -d -p 8787:8787 \
  --name cloudflare-worker-labs \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/wrangler.toml:/app/wrangler.toml \
  -v ~/.wrangler:/root/.wrangler:ro \
  cloudflare-worker-labs

# View logs
docker logs -f cloudflare-worker-labs

# Stop container
docker stop cloudflare-worker-labs

# Remove container
docker rm cloudflare-worker-labs
```

### PowerShell Commands (Windows)

```powershell
# Build the image
docker build -t cloudflare-worker-labs .

# Run the container
docker run -p 8787:8787 `
  -v ${PWD}/src:/app/src `
  -v ${PWD}/wrangler.toml:/app/wrangler.toml `
  -v $HOME/.wrangler:/root/.wrangler:ro `
  cloudflare-worker-labs

# Run with Docker Compose (recommended)
docker-compose up --build
```

## 🔧 Configuration

### Environment Variables

The Docker setup uses these environment variables:

```yaml
environment:
  - NODE_ENV=development
  - WRANGLER_SEND_METRICS=false
```

You can add more in `docker-compose.yml` or create a `.env` file:

```env
NODE_ENV=development
WRANGLER_SEND_METRICS=false
# Add custom variables here
```

### Volumes

The setup mounts these volumes for live development:

```yaml
volumes:
  - ./src:/app/src                    # Source code (live reload)
  - ./wrangler.toml:/app/wrangler.toml # Configuration
  - ./schema.sql:/app/schema.sql       # Database schema
  - node_modules:/app/node_modules     # Node modules (performance)
  - ~/.wrangler:/root/.wrangler:ro     # Wrangler auth (read-only)
```

### Ports

- `8787`: Wrangler dev server (mapped to host)

## 🧪 Testing the Dockerized API

### 1. Health Check

```bash
# Using curl
curl http://localhost:8787/health

# Using PowerShell
Invoke-RestMethod -Uri "http://localhost:8787/health"
```

### 2. Create Session

```bash
# Using curl
curl -X POST http://localhost:8787/api/v1/labs/sessions \
  -H "Content-Type: application/json" \
  -d @test-data.json

# Using PowerShell
$body = Get-Content -Path test-data.json -Raw
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8787/api/v1/labs/sessions" `
  -ContentType "application/json" `
  -Body $body
```

### 3. Get Session

```bash
# Using curl
curl http://localhost:8787/api/v1/labs/sessions/user/675993586c0850de6534d90d

# Using PowerShell
Invoke-RestMethod -Uri "http://localhost:8787/api/v1/labs/sessions/user/675993586c0850de6534d90d"
```

## 🔍 Troubleshooting

### Issue: "Authentication required"

**Solution:** Make sure you've run `wrangler login` on your host machine:

```bash
wrangler login
```

The authentication files will be mounted into the container.

### Issue: "Port 8787 already in use"

**Solution:** Stop any other services using port 8787:

```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8787).OwningProcess | Stop-Process

# Or change the port in docker-compose.yml
ports:
  - "8788:8787"  # Use different host port
```

### Issue: "Module not found" errors

**Solution:** Rebuild the container:

```bash
docker-compose down -v
docker-compose up --build
```

### Issue: Code changes not reflecting

**Solution:** Restart the container or check volume mounts:

```bash
docker-compose restart
```

### Issue: "Cannot connect to remote database"

**Solution:** Ensure:
1. Database is initialized: `npm run db:init:remote`
2. `database_id` is correct in `wrangler.toml`
3. Wrangler is authenticated

## 🛠️ Advanced Usage

### Run Commands Inside Container

```bash
# Execute bash in running container
docker-compose exec cloudflare-worker sh

# Or with docker
docker exec -it cloudflare-worker-labs sh

# Inside container, you can run:
npx wrangler --version
npx wrangler d1 list
npm run build
```

### Deploy from Docker

```bash
# Deploy to Cloudflare
docker-compose exec cloudflare-worker npx wrangler deploy

# Or
docker exec cloudflare-worker-labs npx wrangler deploy
```

### Database Operations in Docker

```bash
# Initialize database
docker-compose exec cloudflare-worker npm run db:init:remote

# View database
docker-compose exec cloudflare-worker \
  npx wrangler d1 execute labs-database --remote \
  --command "SELECT * FROM labs_sessions"
```

### Multi-stage Build for Production

If you want a production-optimized image:

```dockerfile
# Dockerfile.production
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app .
CMD ["npx", "wrangler", "deploy"]
```

## 📊 Docker Development Workflow

1. **Start development environment:**
   ```bash
   docker-compose up -d
   ```

2. **View logs in real-time:**
   ```bash
   docker-compose logs -f
   ```

3. **Make code changes:**
   - Edit files in `src/` directory
   - Changes are automatically reflected (hot reload)

4. **Test your changes:**
   ```bash
   curl http://localhost:8787/health
   ```

5. **Stop when done:**
   ```bash
   docker-compose down
   ```

## 🎯 Benefits of Docker Setup

✅ **Consistent Environment** - Same Node.js version across all machines  
✅ **Isolated Dependencies** - No conflicts with system packages  
✅ **Easy Setup** - One command to start everything  
✅ **Windows Compatibility** - Avoids Windows-specific Wrangler issues  
✅ **Hot Reload** - Code changes reflect automatically  
✅ **Clean Workspace** - Easy to start fresh with `docker-compose down -v`

## 📝 Notes

- The Docker setup uses `--remote` flag to connect to Cloudflare's D1 database, avoiding local simulation issues
- Authentication files are mounted read-only from host machine
- Node modules are stored in a Docker volume for better performance
- Source code is mounted for live development

## 🚀 Production Deployment

Docker is for **local development only**. For production, deploy directly to Cloudflare:

```bash
# From host machine
npm run deploy

# Or from Docker container
docker-compose exec cloudflare-worker npm run deploy
```

Your worker runs on Cloudflare's edge network, not in Docker containers.

## 📚 Related Documentation

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
