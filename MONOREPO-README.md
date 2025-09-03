# 4Runr Gateway Monorepo Structure

This document explains the new monorepo structure for the 4Runr AI Agent OS.

## 🏗️ Directory Structure

```
4Runr.Gateway/
├── apps/
│   ├── gateway/          # Fastify API with Sentinel integration
│   │   ├── src/         # Gateway source code
│   │   ├── package.json # Gateway dependencies
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   └── sse-worker/       # SSE streams for Guard/Audit events
│       ├── src/         # SSE worker source code
│       ├── package.json # SSE worker dependencies
│       ├── tsconfig.json
│       └── Dockerfile
├── packages/
│   ├── shared/           # Types, env, logging utilities
│   │   ├── src/
│   │   │   ├── env.ts   # Environment configuration
│   │   │   ├── types.ts # Shared types
│   │   │   ├── logger.ts # Logging utilities
│   │   │   ├── utils.ts # Utility functions
│   │   │   └── index.ts # Main exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── cli/              # 4runr CLI (stub)
│   │   ├── src/
│   │   │   └── index.ts # CLI implementation
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── sdk-js/           # JavaScript SDK
│       ├── src/
│       │   └── index.ts # SDK implementation
│       ├── package.json
│       └── tsconfig.json
├── infra/
│   ├── docker-compose.yml # Development environment
│   ├── nginx.conf        # Reverse proxy configuration
│   ├── env.example       # Environment template
│   └── init-db.sql       # Database initialization
├── package.json          # Root package.json (workspaces)
├── tsconfig.json         # Root TypeScript configuration
├── Makefile             # Development commands
└── prove-it-packaging.sh # Prove-It system test
```

## 🚀 Quick Start

### 1. Set up environment

```bash
# Copy environment template
cp infra/env.example infra/.env

# Edit configuration (optional)
nano infra/.env
```

### 2. Install dependencies

```bash
# Install all dependencies
make install
```

### 3. Build packages

```bash
# Build all packages
make build
```

### 4. Start services

```bash
# Start all services
make up

# Check health
make health

# Follow logs
make logs
```

### 5. Run Prove-It test

```bash
# Run comprehensive system test
make prove-it
```

## 📦 Package Descriptions

### Apps

#### `apps/gateway`
- **Purpose**: Main Fastify API server with Sentinel integration
- **Port**: 3000 (internal), 8080 (via nginx)
- **Features**: 
  - Agent management
  - Sentinel safety system
  - Coach feedback engine
  - Health and metrics endpoints

#### `apps/sse-worker`
- **Purpose**: Server-Sent Events worker for real-time Guard/Audit events
- **Features**:
  - Redis pub/sub integration
  - SSE event streaming
  - Real-time monitoring

### Packages

#### `packages/shared`
- **Purpose**: Shared utilities and types across all packages
- **Exports**:
  - Environment configuration (`env.ts`)
  - TypeScript types (`types.ts`)
  - Logging utilities (`logger.ts`)
  - Utility functions (`utils.ts`)

#### `packages/cli`
- **Purpose**: Command-line interface for 4Runr (stub)
- **Commands**:
  - `4runr health` - Check system health
  - `4runr agent list` - List agents
  - `4runr sentinel status` - Check Sentinel status
  - `4runr coach report <agentId>` - Generate Coach report

#### `packages/sdk-js`
- **Purpose**: JavaScript SDK for 4Runr API
- **Features**:
  - HTTP client with axios
  - TypeScript support
  - SSE event streaming
  - Full API coverage

## 🔧 Development Commands

```bash
# Show all available commands
make help

# Development workflow
make install    # Install dependencies
make build      # Build all packages
make up         # Start services
make logs       # Follow logs
make health     # Check health
make ready      # Check readiness
make prove-it   # Run Prove-It test
make down       # Stop services
make clean      # Clean build artifacts
make reset      # Reset everything
```

## 🐳 Docker Services

The `infra/docker-compose.yml` defines these services:

- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache (port 6379)
- **gateway**: 4Runr Gateway API (port 3000)
- **sse-worker**: SSE event worker
- **nginx**: Reverse proxy (port 8080)

## 🔍 Health Endpoints

- `GET /health` - Basic health check
- `GET /ready` - Readiness check (DB/Redis connectivity)
- `GET /metrics` - Prometheus metrics
- `GET /diagnostics/sse-test` - SSE test endpoint

## 🧪 Testing

### Prove-It System Test

The `prove-it-packaging.sh` script validates the entire system:

1. **Boot**: Starts all services with `make up`
2. **Health**: Validates health and readiness endpoints
3. **Telemetry**: Creates demo run and validates telemetry
4. **SSE**: Tests Server-Sent Events functionality
5. **Metrics**: Validates Prometheus metrics exposure
6. **Teardown**: Ensures clean shutdown

### Individual Tests

```bash
# Run all tests
make test

# Run tests in specific package
cd packages/shared && npm test
cd apps/gateway && npm test
```

## 🔐 Environment Configuration

The `infra/env.example` file contains all required environment variables:

```bash
# Server configuration
NODE_ENV=development
PORT=3000
HOST=127.0.0.1

# Database
DATABASE_URL=postgresql://4runr:4runr_password@postgres:5432/4runr_gateway

# Security
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ENCRYPTION_KEY=your-super-secret-encryption-key-minimum-32-characters-long

# Sentinel configuration
SENTINEL_STORE_PLAIN=true
SENTINEL_MODE=live
SENTINEL_SHIELD_MODE=enforce
```

## 🚀 Production Deployment

### Build Production Images

```bash
# Build all production images
make prod-build
```

### Deploy with Docker Compose

```bash
# Start production services
docker-compose -f infra/docker-compose.yml up -d
```

## 📊 Monitoring

### Metrics

Key metrics exposed at `/metrics`:
- `sentinel_spans_total` - Total telemetry spans
- `sentinel_guard_events_total` - Total Guard events
- `shield_decisions_total` - Total Shield decisions
- `judge_verdicts_total` - Total Judge verdicts

### Logging

All services use structured logging with configurable levels:
- `error` - Errors only
- `warn` - Warnings and errors
- `info` - Info, warnings, and errors
- `debug` - All log levels

## 🔄 Migration from Old Structure

The old structure has been preserved in the root directory. To migrate:

1. **Move existing code**: Copy relevant files from `src/` to `apps/gateway/src/`
2. **Update imports**: Update import paths to use `@4runr/shared`
3. **Test thoroughly**: Run `make prove-it` to validate
4. **Remove old files**: Clean up old structure once migration is complete

## 🆘 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 5432, 6379, and 8080 are available
2. **Docker not running**: Start Docker Desktop before running `make up`
3. **Environment not set**: Copy `infra/env.example` to `infra/.env`
4. **Build errors**: Run `make clean && make build` to rebuild everything

### Getting Help

- Check logs: `make logs`
- Check health: `make health`
- Check readiness: `make ready`
- Run Prove-It test: `make prove-it`

---

**4Runr AI Agent OS** - Making AI agents safe, explainable, and auditable. 🛡️
