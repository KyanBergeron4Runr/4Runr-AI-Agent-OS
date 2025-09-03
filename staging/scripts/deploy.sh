#!/usr/bin/env bash
set -euo pipefail

# 4Runr Gateway Staging - Deployment Script
# This script handles the complete deployment process

echo "🚀 Deploying 4Runr Gateway Staging Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found. Please run this script from /opt/4runr-staging/"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Please run ./scripts/generate-secrets.sh first"
    exit 1
fi

# Check if secrets file exists
if [ ! -f "secrets/4runr-secrets.json" ]; then
    print_warning "secrets/4runr-secrets.json not found. Please create it with your API keys"
    exit 1
fi

# Function to wait for service health
wait_for_service() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker compose ps $service | grep -q "healthy"; then
            print_success "$service is healthy"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - $service not ready yet..."
        sleep 10
        ((attempt++))
    done
    
    print_error "$service failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to check if domain resolves
check_domain() {
    local domain="gateway-staging.yourdomain.com"
    if ! nslookup $domain > /dev/null 2>&1; then
        print_warning "Domain $domain does not resolve. Please update DNS settings."
        return 1
    fi
    return 0
}

# Function to check SSL certificate
check_ssl() {
    local domain="gateway-staging.yourdomain.com"
    if ! curl -fsS "https://$domain/health" > /dev/null 2>&1; then
        print_warning "SSL certificate may not be valid for $domain"
        return 1
    fi
    return 0
}

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Check domain resolution
if check_domain; then
    print_success "Domain resolution OK"
else
    print_warning "Domain resolution failed - continuing anyway"
fi

# Check SSL certificate
if check_ssl; then
    print_success "SSL certificate OK"
else
    print_warning "SSL certificate check failed - continuing anyway"
fi

# Check Docker
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running or accessible"
    exit 1
fi

print_success "Pre-deployment checks completed"

# Pull latest changes (if using git)
if [ -d ".git" ]; then
    print_status "Pulling latest changes from git..."
    if git pull --rebase; then
        print_success "Git pull completed"
    else
        print_warning "Git pull failed - continuing with current version"
    fi
fi

# Stop existing services gracefully
print_status "Stopping existing services..."
docker compose down --timeout 30 || true

# Build Gateway image
print_status "Building Gateway Docker image..."
if docker compose build gateway; then
    print_success "Gateway image built successfully"
else
    print_error "Failed to build Gateway image"
    exit 1
fi

# Start services
print_status "Starting services..."
if docker compose up -d; then
    print_success "Services started successfully"
else
    print_error "Failed to start services"
    exit 1
fi

# Wait for database to be healthy
if ! wait_for_service db; then
    print_error "Database failed to start properly"
    docker compose logs db
    exit 1
fi

# Wait for Redis to be healthy
if ! wait_for_service redis; then
    print_error "Redis failed to start properly"
    docker compose logs redis
    exit 1
fi

# Wait for Gateway to be healthy
if ! wait_for_service gateway; then
    print_error "Gateway failed to start properly"
    docker compose logs gateway
    exit 1
fi

# Run database migrations
print_status "Running database migrations..."
if docker compose exec -T gateway npx prisma migrate deploy; then
    print_success "Database migrations completed"
else
    print_error "Database migrations failed"
    docker compose logs gateway
    exit 1
fi

# Seed database
print_status "Seeding database..."
if docker compose exec -T gateway node scripts/seed.js; then
    print_success "Database seeding completed"
else
    print_warning "Database seeding failed - this may be OK if data already exists"
fi

# Final health checks
print_status "Running final health checks..."

# Check internal health
if docker compose exec -T gateway curl -fsS http://localhost:3000/ready > /dev/null; then
    print_success "Internal health check passed"
else
    print_error "Internal health check failed"
    docker compose logs gateway
    exit 1
fi

# Check external health (if domain is configured)
if check_domain && check_ssl; then
    print_status "Testing external health endpoint..."
    if curl -fsS "https://gateway-staging.yourdomain.com/ready" > /dev/null; then
        print_success "External health check passed"
    else
        print_warning "External health check failed - check nginx and SSL configuration"
    fi
else
    print_warning "Skipping external health check - domain/SSL not configured"
fi

# Display service status
print_status "Service status:"
docker compose ps

# Display resource usage
print_status "Resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Display useful URLs
echo ""
print_success "🎉 Deployment completed successfully!"
echo ""
echo "📋 Useful URLs:"
echo "  - Health Check: https://gateway-staging.yourdomain.com/health"
echo "  - Readiness: https://gateway-staging.yourdomain.com/ready"
echo "  - Metrics: https://gateway-staging.yourdomain.com/metrics"
echo ""
echo "🔧 Useful Commands:"
echo "  - View logs: docker compose logs -f gateway"
echo "  - Restart: docker compose restart gateway"
echo "  - Status: docker compose ps"
echo "  - Shell: docker compose exec gateway sh"
echo ""
echo "📊 Monitoring:"
echo "  - Check metrics: curl https://gateway-staging.yourdomain.com/metrics"
echo "  - View backups: ls -la /var/backups/4runr/"
echo "  - SSL status: sudo certbot certificates"
echo ""

# Optional: Run smoke test
if command -v jq > /dev/null 2>&1; then
    print_status "Running smoke test..."
    if curl -fsS "https://gateway-staging.yourdomain.com/health" | jq . > /dev/null 2>&1; then
        print_success "Smoke test passed"
    else
        print_warning "Smoke test failed - check the service manually"
    fi
fi

print_success "🚀 4Runr Gateway Staging is ready!"
