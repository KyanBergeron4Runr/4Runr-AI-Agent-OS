# 4Runr Gateway Development Makefile

.PHONY: help up down logs seed lint test build clean install

# Default target
help:
	@echo "4Runr Gateway Development Commands:"
	@echo ""
	@echo "  make up          - Start all services with docker-compose"
	@echo "  make down        - Stop and remove containers"
	@echo "  make logs        - Follow gateway logs"
	@echo "  make seed        - Seed database with demo data"
	@echo "  make install     - Install all dependencies"
	@echo "  make build       - Build all packages"
	@echo "  make lint        - Lint all packages"
	@echo "  make test        - Run tests"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make health      - Check system health"
	@echo "  make ready       - Check system readiness"
	@echo "  make sse-test    - Test SSE functionality"
	@echo "  make prove-it    - Run Prove-It system test"

# Docker Compose commands
up:
	@echo "🚀 Starting 4Runr Gateway services..."
	docker-compose -f infra/docker-compose.yml up -d
	@echo "✅ Services started. Gateway available at http://localhost:8080"

down:
	@echo "🛑 Stopping 4Runr Gateway services..."
	docker-compose -f infra/docker-compose.yml down
	@echo "✅ Services stopped"

logs:
	@echo "📋 Following gateway logs..."
	docker-compose -f infra/docker-compose.yml logs -f gateway

# Database and seeding
seed:
	@echo "🌱 Seeding database with demo data..."
	@echo "TODO: Implement database seeding"
	@echo "✅ Database seeded"

# Development commands
install:
	@echo "📦 Installing dependencies..."
	npm install
	cd packages/shared && npm install
	cd apps/gateway && npm install
	cd apps/sse-worker && npm install
	cd packages/cli && npm install
	cd packages/sdk-js && npm install
	@echo "✅ Dependencies installed"

build:
	@echo "🔨 Building all packages..."
	cd packages/shared && npm run build
	cd apps/gateway && npm run build
	cd apps/sse-worker && npm run build
	cd packages/cli && npm run build
	cd packages/sdk-js && npm run build
	@echo "✅ All packages built"

lint:
	@echo "🔍 Linting all packages..."
	cd packages/shared && npm run lint
	cd apps/gateway && npm run lint
	cd apps/sse-worker && npm run lint
	cd packages/cli && npm run lint
	cd packages/sdk-js && npm run lint
	@echo "✅ Linting complete"

test:
	@echo "🧪 Running tests..."
	cd packages/shared && npm test
	cd apps/gateway && npm test
	cd apps/sse-worker && npm test
	cd packages/cli && npm test
	cd packages/sdk-js && npm test
	@echo "✅ Tests complete"

clean:
	@echo "🧹 Cleaning build artifacts..."
	cd packages/shared && npm run clean
	cd apps/gateway && npm run clean
	cd apps/sse-worker && npm run clean
	cd packages/cli && npm run clean
	cd packages/sdk-js && npm run clean
	@echo "✅ Clean complete"

# Health checks
health:
	@echo "🏥 Checking system health..."
	@curl -s http://localhost:8080/health | jq . || echo "❌ Health check failed"

ready:
	@echo "✅ Checking system readiness..."
	@curl -s http://localhost:8080/ready | jq . || echo "❌ Readiness check failed"

# SSE testing
sse-test:
	@echo "📡 Testing SSE functionality..."
	@curl -N http://localhost:8080/diagnostics/sse-test | head -20 || echo "❌ SSE test failed"

# Prove-It system test
prove-it:
	@echo "🎯 Running Prove-It system test..."
	@node test-coach-prove-it-fast.js || echo "❌ Prove-It test failed"

# Development setup
setup:
	@echo "🔧 Setting up development environment..."
	@if [ ! -f infra/.env ]; then \
		echo "📝 Creating .env file from template..."; \
		cp infra/env.example infra/.env; \
		echo "✅ .env file created. Please edit infra/.env with your configuration."; \
	else \
		echo "✅ .env file already exists"; \
	fi
	@echo "📦 Installing dependencies..."
	$(MAKE) install
	@echo "🔨 Building packages..."
	$(MAKE) build
	@echo "🚀 Starting services..."
	$(MAKE) up
	@echo "⏳ Waiting for services to be ready..."
	@sleep 10
	@echo "🏥 Checking health..."
	$(MAKE) health
	@echo "✅ Development environment setup complete!"

# Quick development cycle
dev:
	@echo "🔄 Starting development cycle..."
	$(MAKE) up
	@echo "📋 Following logs (Ctrl+C to stop)..."
	$(MAKE) logs

# Production build
prod-build:
	@echo "🏭 Building production images..."
	docker-compose -f infra/docker-compose.yml build
	@echo "✅ Production build complete"

# Reset everything
reset:
	@echo "🔄 Resetting development environment..."
	$(MAKE) down
	docker system prune -f
	docker volume prune -f
	$(MAKE) clean
	@echo "✅ Reset complete. Run 'make setup' to start fresh."
