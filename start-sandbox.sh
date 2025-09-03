#!/bin/bash

echo "🚀 Starting 4Runr Gateway Sandbox Environment"
echo "============================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install Docker Compose."
    exit 1
fi

echo "📦 Building and starting services..."
docker-compose -f docker-compose.sandbox.yml up -d --build

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check Gateway
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Gateway is running at http://localhost:3000"
else
    echo "⚠️  Gateway is still starting up..."
fi

# Check Redis
if docker-compose -f docker-compose.sandbox.yml exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis is still starting up..."
fi

echo ""
echo "🎯 SANDBOX ENVIRONMENT READY!"
echo "=============================="
echo ""
echo "📱 Sandbox UI:        http://localhost:8080/sandbox.html"
echo "🔧 Gateway API:       http://localhost:3000"
echo "📊 Prometheus:        http://localhost:9090"
echo "📈 Grafana:           http://localhost:3001 (admin/sandbox)"
echo "📖 Documentation:     http://localhost:8080/docs/"
echo ""
echo "🧪 QUICK START:"
echo "1. Open the Sandbox UI: http://localhost:8080/sandbox.html"
echo "2. Create an agent and generate a token"
echo "3. Make API calls and watch live metrics"
echo "4. Test security by making unauthorized requests"
echo ""
echo "📊 To view metrics in Grafana:"
echo "1. Go to http://localhost:3001"
echo "2. Login with admin/sandbox"
echo "3. Import the 4Runr Gateway dashboard"
echo ""
echo "🛑 To stop the sandbox:"
echo "   docker-compose -f docker-compose.sandbox.yml down"
echo ""
echo "📋 To view logs:"
echo "   docker-compose -f docker-compose.sandbox.yml logs -f gateway"
echo ""
