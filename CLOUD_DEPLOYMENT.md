# Cloud Deployment Guide for Assistive-LLM

This guide provides a comprehensive workflow for deploying Assistive-LLM as a centralized cloud service on various platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Platform-Specific Guides](#platform-specific-guides)
  - [Vercel Deployment](#vercel-deployment)
  - [Cloudflare Workers](#cloudflare-workers)
  - [Railway](#railway)
  - [Render](#render)
  - [AWS](#aws)
  - [Google Cloud Platform](#google-cloud-platform)
  - [Azure](#azure)
- [Database & Storage](#database--storage)
- [Environment Management](#environment-management)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Observability](#monitoring--observability)
- [Security Considerations](#security-considerations)

---

## Prerequisites

Before deploying to the cloud, ensure you have:

- ✅ Project building successfully locally (`npm run build`)
- ✅ API keys for LLM providers (Anthropic/OpenAI)
- ✅ Git repository (GitHub, GitLab, Bitbucket)
- ✅ Domain name (optional but recommended)
- ✅ SSL certificates configured (most platforms provide this)

---

## Architecture Overview

### Current Architecture (Local)
```
┌─────────────────┐
│  Express Server │
│   (TypeScript)  │
├─────────────────┤
│   File Storage  │
│ (devices.json)  │
│(conversations)  │
└─────────────────┘
```

### Target Architecture (Cloud)
```
┌──────────────────────────────────────────┐
│              Load Balancer               │
└────────────────┬─────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
┌───▼────┐              ┌────▼───┐
│ Server │              │ Server │
│Instance│              │Instance│
└───┬────┘              └────┬───┘
    │                        │
    └────────┬───────────────┘
             │
    ┌────────▼─────────────────┐
    │    Managed Database      │
    │  (PostgreSQL/MongoDB)    │
    └──────────────────────────┘

    ┌──────────────────────────┐
    │    Object Storage        │
    │   (Conversation Data)    │
    └──────────────────────────┘

    ┌──────────────────────────┐
    │   WebSocket/RTP Relay    │
    │ (Device Connections)     │
    └──────────────────────────┘
```

---

## Development Workflow

### Phase 1: Cloud-Ready Refactoring

#### 1.1 Replace File-Based Storage

**Current:** File-based JSON storage
**Target:** Database-backed storage

**Implementation Steps:**

1. **Create Database Adapter Interface**

```typescript
// src/adapters/storage.adapter.ts
export interface StorageAdapter {
  // Devices
  getAllDevices(): Promise<AssistiveDevice[]>;
  getDeviceById(id: string): Promise<AssistiveDevice | null>;
  createDevice(device: AssistiveDevice): Promise<AssistiveDevice>;
  updateDevice(id: string, data: Partial<AssistiveDevice>): Promise<AssistiveDevice | null>;
  deleteDevice(id: string): Promise<boolean>;

  // Conversations
  getConversation(id: string): Promise<ConversationMessage[]>;
  saveConversation(id: string, messages: ConversationMessage[]): Promise<void>;
  deleteConversation(id: string): Promise<boolean>;
}
```

2. **Create File Storage Adapter (for backwards compatibility)**

```typescript
// src/adapters/file-storage.adapter.ts
export class FileStorageAdapter implements StorageAdapter {
  // Existing file-based implementation
  // This keeps local development working
}
```

3. **Create PostgreSQL Adapter**

```typescript
// src/adapters/postgres.adapter.ts
import { Pool } from 'pg';

export class PostgresAdapter implements StorageAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async getAllDevices(): Promise<AssistiveDevice[]> {
    const result = await this.pool.query(
      'SELECT * FROM devices ORDER BY created_at DESC'
    );
    return result.rows.map(this.mapRowToDevice);
  }

  async createDevice(device: AssistiveDevice): Promise<AssistiveDevice> {
    const result = await this.pool.query(
      `INSERT INTO devices
       (id, name, type, ip_address, port, protocol, status, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        device.id,
        device.name,
        device.type,
        device.ipAddress,
        device.port,
        device.protocol,
        device.status,
        JSON.stringify(device.settings),
        device.createdAt,
        device.updatedAt
      ]
    );
    return this.mapRowToDevice(result.rows[0]);
  }

  // ... implement other methods
}
```

4. **Create Database Migration Scripts**

```sql
-- migrations/001_create_devices.sql
CREATE TABLE devices (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  port INTEGER NOT NULL,
  protocol VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  last_connected TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_created_at ON devices(created_at);

-- migrations/002_create_conversations.sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  provider VARCHAR(50),
  model VARCHAR(100),
  device_ids TEXT[],
  metadata JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);

-- migrations/003_create_stream_metadata.sql
CREATE TABLE stream_metadata (
  message_id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  device_ids TEXT[] NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  prompt TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  tokens_used INTEGER,
  error TEXT
);
```

5. **Update Services to Use Adapter**

```typescript
// src/services/device.service.ts
import { StorageAdapter } from '../adapters/storage.adapter';
import { PostgresAdapter } from '../adapters/postgres.adapter';
import { FileStorageAdapter } from '../adapters/file-storage.adapter';

export class DeviceService {
  private storage: StorageAdapter;

  constructor() {
    // Choose adapter based on environment
    if (process.env.DATABASE_URL) {
      this.storage = new PostgresAdapter(process.env.DATABASE_URL);
    } else {
      this.storage = new FileStorageAdapter();
    }
  }

  async getAllDevices(): Promise<AssistiveDevice[]> {
    return this.storage.getAllDevices();
  }

  // ... rest of methods use this.storage
}
```

#### 1.2 Add Health Check Endpoint

```typescript
// src/routes/health.routes.ts
import { Router } from 'express';
import { config } from '../config/config';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version,
    checks: {
      database: await checkDatabase(),
      llmProviders: await checkLLMProviders(),
      storage: await checkStorage()
    }
  };

  const overallStatus = Object.values(health.checks).every(c => c.status === 'ok')
    ? 200
    : 503;

  res.status(overallStatus).json(health);
});

router.get('/ready', async (req, res) => {
  // Readiness check for load balancers
  const ready = await checkReadiness();
  res.status(ready ? 200 : 503).json({ ready });
});

router.get('/live', (req, res) => {
  // Liveness check
  res.status(200).json({ live: true });
});

async function checkDatabase(): Promise<{ status: string; latency?: number }> {
  const start = Date.now();
  try {
    // Attempt database connection
    await storage.health();
    return { status: 'ok', latency: Date.now() - start };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

async function checkLLMProviders(): Promise<Record<string, { status: string }>> {
  return {
    openai: { status: config.llm.openai.apiKey ? 'configured' : 'not_configured' },
    anthropic: { status: config.llm.anthropic.apiKey ? 'configured' : 'not_configured' }
  };
}

async function checkStorage(): Promise<{ status: string }> {
  try {
    // Check if storage is accessible
    await storage.health();
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error' };
  }
}

export const healthRouter = router;
```

#### 1.3 Add Environment Configuration Validation

```typescript
// src/config/validation.ts
import * as Joi from 'joi';

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  HOST: Joi.string().default('localhost'),

  // Database
  DATABASE_URL: Joi.string().uri(),

  // LLM Providers (at least one required in production)
  OPENAI_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  ANTHROPIC_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),

  // Logging
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
  LOG_FILE: Joi.string().default('assistive-llm.log'),

  // Security
  CORS_ORIGIN: Joi.string().default('*'),
  RATE_LIMIT_WINDOW: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // Session
  SESSION_SECRET: Joi.string().min(32).required()
}).xor('OPENAI_API_KEY', 'ANTHROPIC_API_KEY'); // At least one required

export function validateEnvironment() {
  const { error, value } = envSchema.validate(process.env, {
    allowUnknown: true,
    abortEarly: false
  });

  if (error) {
    throw new Error(
      `Environment validation failed: ${error.details.map(d => d.message).join(', ')}`
    );
  }

  return value;
}
```

#### 1.4 Add Rate Limiting

```typescript
// src/middleware/rate-limit.middleware.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

export function createRateLimiter() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // Use Redis for distributed rate limiting
    const client = createClient({ url: redisUrl });
    client.connect();

    return rateLimit({
      store: new RedisStore({
        client,
        prefix: 'rl:',
      }),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      message: 'Too many requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
  } else {
    // Use memory store for development
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests, please try again later.',
    });
  }
}
```

#### 1.5 Add WebSocket Scaling Support

```typescript
// src/services/websocket-manager.service.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server } from 'socket.io';

export class WebSocketManager {
  private io: Server;

  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupRedisAdapter();
    this.setupEventHandlers();
  }

  private async setupRedisAdapter() {
    if (process.env.REDIS_URL) {
      // Enable multi-instance WebSocket with Redis
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.io.adapter(createAdapter(pubClient, subClient));
      console.log('WebSocket: Redis adapter enabled for scaling');
    }
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Admin client connected:', socket.id);

      socket.on('subscribe:device', (deviceId) => {
        socket.join(`device:${deviceId}`);
      });

      socket.on('disconnect', () => {
        console.log('Admin client disconnected:', socket.id);
      });
    });
  }

  // Broadcast device status updates
  public broadcastDeviceStatus(deviceId: string, status: any) {
    this.io.to(`device:${deviceId}`).emit('device:status', status);
  }

  // Broadcast streaming updates
  public broadcastStreamUpdate(conversationId: string, update: any) {
    this.io.to(`conversation:${conversationId}`).emit('stream:update', update);
  }
}
```

### Phase 2: Platform-Specific Preparation

#### 2.1 Add Docker Support

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:${PORT:-3000}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/assistive_llm
      - REDIS_URL=redis://redis:6379
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=assistive_llm
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### 2.2 Add Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: assistive-llm
  labels:
    app: assistive-llm
spec:
  replicas: 3
  selector:
    matchLabels:
      app: assistive-llm
  template:
    metadata:
      labels:
        app: assistive-llm
    spec:
      containers:
      - name: assistive-llm
        image: your-registry/assistive-llm:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: assistive-llm-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: assistive-llm-secrets
              key: redis-url
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: assistive-llm-secrets
              key: anthropic-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: assistive-llm
spec:
  selector:
    app: assistive-llm
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

## Platform-Specific Guides

### Vercel Deployment

**Best For:** Serverless, auto-scaling, zero-config deployment
**Limitations:** No WebSocket support (use external WebSocket service), limited execution time

#### Prerequisites
```bash
npm install -g vercel
```

#### Configuration

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "regions": ["iad1"]
}
```

#### Deployment Steps

1. **Build the project:**
```bash
npm run build
```

2. **Deploy:**
```bash
vercel --prod
```

3. **Set environment variables:**
```bash
vercel env add ANTHROPIC_API_KEY
vercel env add OPENAI_API_KEY
vercel env add DATABASE_URL
```

#### Limitations & Workarounds

**Issue:** No WebSocket support
**Solution:** Use separate WebSocket service (e.g., Ably, Pusher, or dedicated server)

```typescript
// src/services/external-websocket.service.ts
import Pusher from 'pusher';

export class ExternalWebSocketService {
  private pusher: Pusher;

  constructor() {
    this.pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true
    });
  }

  broadcastDeviceStatus(deviceId: string, status: any) {
    this.pusher.trigger(`device-${deviceId}`, 'status-update', status);
  }
}
```

**Issue:** 10-second execution limit
**Solution:** Use edge functions or move long-running tasks to queue

---

### Cloudflare Workers

**Best For:** Global edge deployment, ultra-low latency
**Limitations:** No Node.js runtime, 50ms CPU time limit (Enterprise: 30s)

#### Configuration

```toml
# wrangler.toml
name = "assistive-llm"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[vars]
NODE_ENV = "production"

[[kv_namespaces]]
binding = "DEVICES"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "DB"
database_name = "assistive-llm"
database_id = "your-database-id"
```

#### Worker Entry Point

```typescript
// src/worker.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/*', cors());

app.get('/api/devices', async (c) => {
  const devices = await c.env.DB.prepare(
    'SELECT * FROM devices'
  ).all();

  return c.json(devices);
});

app.post('/api/llm/stream/:deviceId', async (c) => {
  const { deviceId } = c.req.param();
  const { prompt, provider } = await c.req.json();

  // Stream handling with Durable Objects
  const id = c.env.STREAM_MANAGER.idFromName(deviceId);
  const stub = c.env.STREAM_MANAGER.get(id);

  return stub.fetch(c.req.raw);
});

export default app;
```

#### Durable Objects for Streaming

```typescript
// src/durable-objects/stream-manager.ts
export class StreamManager {
  state: DurableObjectState;
  sessions: Map<string, WebSocket>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.state.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    // Handle streaming logic
  }
}
```

---

### Railway

**Best For:** Simple deployment, built-in PostgreSQL, great for prototypes
**Cost:** ~$5-20/month

#### Deployment Steps

1. **Connect GitHub repository:**
   - Visit [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"

2. **Add PostgreSQL:**
   - Click "+ New"
   - Select "Database" → "PostgreSQL"
   - Copy connection string

3. **Configure environment:**
   - Add variables in Railway dashboard
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `DATABASE_URL` (auto-filled)

4. **Deploy:**
   - Push to main branch
   - Railway auto-deploys

#### Railway Configuration

```toml
# railway.toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 10
```

---

### Render

**Best For:** Full-stack apps, managed services
**Cost:** Free tier available, ~$7+/month for production

#### Configuration

```yaml
# render.yaml
services:
  - type: web
    name: assistive-llm
    env: node
    region: oregon
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: assistive-llm-db
          property: connectionString
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
    autoDeploy: true

databases:
  - name: assistive-llm-db
    databaseName: assistive_llm
    user: admin
    plan: starter
```

#### Deployment

1. **Connect repository:**
   - Sign up at [render.com](https://render.com)
   - New → Web Service
   - Connect GitHub repo

2. **Configure:**
   - Follow `render.yaml` or manual configuration
   - Add environment variables

3. **Deploy:**
   - Auto-deploys on push

---

### AWS

**Best For:** Enterprise, full control, complex requirements
**Services:** ECS, EC2, Lambda, RDS, ElastiCache

#### Architecture

```
┌──────────────────┐
│   CloudFront     │ (CDN)
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Application     │
│  Load Balancer   │
└────────┬─────────┘
         │
    ┌────▼────┐
    │   ECS   │ (Container Service)
    │ Fargate │
    └────┬────┘
         │
    ┌────▼────────┐
    │     RDS     │ (PostgreSQL)
    │  Multi-AZ   │
    └─────────────┘

    ┌─────────────┐
    │ ElastiCache │ (Redis)
    └─────────────┘
```

#### Infrastructure as Code (Terraform)

```hcl
# terraform/main.tf
provider "aws" {
  region = "us-east-1"
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "assistive-llm-cluster"
}

# Task Definition
resource "aws_ecs_task_definition" "app" {
  family                   = "assistive-llm"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"

  container_definitions = jsonencode([{
    name  = "assistive-llm"
    image = "${aws_ecr_repository.app.repository_url}:latest"
    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]
    environment = [
      {
        name  = "NODE_ENV"
        value = "production"
      }
    ]
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.db_url.arn
      }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier           = "assistive-llm-db"
  engine              = "postgres"
  engine_version      = "15.3"
  instance_class      = "db.t3.micro"
  allocated_storage   = 20
  storage_encrypted   = true

  db_name  = "assistive_llm"
  username = "admin"
  password = var.db_password

  multi_az               = true
  backup_retention_period = 7

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}
```

#### Deployment Steps

1. **Build and push Docker image:**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker build -t assistive-llm .
docker tag assistive-llm:latest your-account.dkr.ecr.us-east-1.amazonaws.com/assistive-llm:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/assistive-llm:latest
```

2. **Deploy infrastructure:**
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

3. **Update ECS service:**
```bash
aws ecs update-service --cluster assistive-llm-cluster --service assistive-llm-service --force-new-deployment
```

---

## Database & Storage

### PostgreSQL Schema Migration

```typescript
// migrations/migrate.ts
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const migrationsDir = path.join(__dirname, 'sql');
  const files = await fs.readdir(migrationsDir);

  for (const file of files.sort()) {
    console.log(`Running migration: ${file}`);
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    await pool.query(sql);
  }

  await pool.end();
  console.log('Migrations complete');
}

migrate().catch(console.error);
```

### Data Migration from Files

```typescript
// scripts/migrate-to-db.ts
import { FileStorageAdapter } from '../src/adapters/file-storage.adapter';
import { PostgresAdapter } from '../src/adapters/postgres.adapter';

async function migrateData() {
  const fileStorage = new FileStorageAdapter();
  const dbStorage = new PostgresAdapter(process.env.DATABASE_URL!);

  // Migrate devices
  console.log('Migrating devices...');
  const devices = await fileStorage.getAllDevices();
  for (const device of devices) {
    await dbStorage.createDevice(device);
  }

  // Migrate conversations
  console.log('Migrating conversations...');
  // ... migration logic

  console.log('Migration complete!');
}

migrateData().catch(console.error);
```

---

## Environment Management

### Development
```env
NODE_ENV=development
PORT=3000
HOST=localhost
LOG_LEVEL=debug

# File-based storage
DB_PATH=./data

# LLM Providers
ANTHROPIC_API_KEY=your-dev-key
OPENAI_API_KEY=your-dev-key
```

### Staging
```env
NODE_ENV=staging
PORT=3000
DATABASE_URL=postgresql://user:pass@staging-db:5432/assistive_llm
REDIS_URL=redis://staging-redis:6379

ANTHROPIC_API_KEY=your-staging-key
OPENAI_API_KEY=your-staging-key

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-key
```

### Production
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@prod-db:5432/assistive_llm
REDIS_URL=redis://prod-redis:6379

# Security
SESSION_SECRET=your-long-random-secret
CORS_ORIGIN=https://your-domain.com

# LLM Providers
ANTHROPIC_API_KEY=your-prod-key
OPENAI_API_KEY=your-prod-key

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-key
DATADOG_API_KEY=your-key
```

---

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t assistive-llm .

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker tag assistive-llm your-registry/assistive-llm:${{ github.sha }}
          docker push your-registry/assistive-llm:${{ github.sha }}

      - name: Deploy to production
        run: |
          # Deploy command depends on platform
          # Railway: railway up
          # Render: render deploy
          # AWS: aws ecs update-service ...
```

---

## Monitoring & Observability

### Metrics to Track

- Request rate and latency
- Device connection status
- LLM API latency and errors
- Database query performance
- Memory and CPU usage
- WebSocket connection count
- Stream duration and success rate

### Implementation

```typescript
// src/middleware/metrics.middleware.ts
import promClient from 'prom-client';

const register = new promClient.Registry();

// Metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const activeDeviceConnections = new promClient.Gauge({
  name: 'active_device_connections',
  help: 'Number of active device connections',
  registers: [register]
});

const llmRequestDuration = new promClient.Histogram({
  name: 'llm_request_duration_seconds',
  help: 'Duration of LLM requests in seconds',
  labelNames: ['provider', 'status'],
  registers: [register]
});

// Middleware
export function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });

  next();
}

// Metrics endpoint
export function metricsEndpoint(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
}
```

---

## Security Considerations

### Essential Security Measures

1. **API Key Management**
   - Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Rotate keys regularly
   - Never commit keys to git

2. **HTTPS/TLS**
   - Always use HTTPS in production
   - Configure strong cipher suites
   - Enable HSTS headers

3. **Rate Limiting**
   - Implement per-IP and per-user limits
   - Different limits for authenticated vs anonymous
   - DDoS protection at edge (Cloudflare, AWS Shield)

4. **Input Validation**
   - Validate all user inputs
   - Sanitize device configurations
   - Prevent SQL injection (use parameterized queries)

5. **Authentication & Authorization**
   - Implement API key authentication
   - Add JWT for user sessions
   - Role-based access control (RBAC)

6. **CORS Configuration**
   ```typescript
   app.use(cors({
     origin: process.env.CORS_ORIGIN?.split(',') || '*',
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE'],
     allowedHeaders: ['Content-Type', 'Authorization']
   }));
   ```

7. **Security Headers**
   ```typescript
   import helmet from 'helmet';

   app.use(helmet({
     contentSecurityPolicy: {
       directives: {
         defaultSrc: ["'self'"],
         styleSrc: ["'self'", "'unsafe-inline'"],
         scriptSrc: ["'self'"],
         imgSrc: ["'self'", 'data:', 'https:'],
       }
     }
   }));
   ```

---

## Cost Estimation

### Railway (Recommended for MVP)
- **Hobby Plan:** $5/month (512MB RAM, shared CPU)
- **Pro Plan:** $20/month (2GB RAM, shared CPU)
- **PostgreSQL:** $5/month (1GB storage)
- **Total:** ~$10-25/month

### Render
- **Starter:** $7/month (512MB RAM)
- **Standard:** $25/month (2GB RAM)
- **PostgreSQL:** $7/month (1GB)
- **Total:** ~$14-32/month

### AWS (Production Scale)
- **ECS Fargate:** ~$30/month (0.5 vCPU, 1GB RAM)
- **RDS:** ~$30/month (db.t3.micro)
- **ElastiCache:** ~$15/month (cache.t3.micro)
- **Load Balancer:** ~$20/month
- **Total:** ~$95-150/month

---

## Recommended Deployment Path

### Phase 1: MVP (Week 1-2)
1. Deploy to **Railway** or **Render**
2. Use managed PostgreSQL
3. Single instance (no Redis yet)
4. Cost: ~$15/month

### Phase 2: Beta (Month 1-2)
1. Add Redis for session management
2. Enable auto-scaling (2-3 instances)
3. Add monitoring (Sentry, DataDog free tier)
4. Cost: ~$50/month

### Phase 3: Production (Month 3+)
1. Move to AWS/GCP for full control
2. Multi-region deployment
3. Advanced monitoring
4. Cost: ~$200-500/month (based on traffic)

---

## Next Steps

1. **Implement Phase 1 refactoring** (database adapters, health checks)
2. **Choose deployment platform** based on requirements
3. **Set up CI/CD pipeline**
4. **Deploy to staging environment**
5. **Test thoroughly** (load testing, failover testing)
6. **Deploy to production**
7. **Set up monitoring and alerts**
8. **Document runbooks for common issues**

Need help with any specific platform or implementation detail? Let me know!
