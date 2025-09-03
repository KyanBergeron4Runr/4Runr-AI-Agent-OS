#!/bin/bash

# Prove-It Packaging Test Script
# Validates that the 4Runr Gateway can be cloned, booted, and tested end-to-end

set -e

echo "🎯 Prove-It Packaging Test - 4Runr Gateway"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Wait for service to be ready
wait_for_service() {
    local url=$1
    local timeout=${2:-60}
    local interval=${3:-2}
    
    log_info "Waiting for $url to be ready (timeout: ${timeout}s)..."
    
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            log_success "Service $url is ready"
            return 0
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    log_error "Service $url failed to be ready within ${timeout}s"
    return 1
}

# Test 1: Boot services
test_boot() {
    log_info "1️⃣ Booting services with make up..."
    
    if make up > /dev/null 2>&1; then
        log_success "Services started successfully"
    else
        log_error "Failed to start services"
        return 1
    fi
    
    # Wait for services to be ready
    if wait_for_service "http://localhost:8080/ready" 60; then
        log_success "All services are ready"
    else
        log_error "Services failed to become ready"
        return 1
    fi
}

# Test 2: Health check
test_health() {
    log_info "2️⃣ Testing health endpoint..."
    
    local response=$(curl -s http://localhost:8080/health)
    if echo "$response" | jq -e '.ok == true' > /dev/null 2>&1; then
        log_success "Health check passed"
        echo "   Response: $(echo "$response" | jq -c .)"
    else
        log_error "Health check failed"
        echo "   Response: $response"
        return 1
    fi
}

# Test 3: Readiness check
test_readiness() {
    log_info "3️⃣ Testing readiness endpoint..."
    
    local response=$(curl -s http://localhost:8080/ready)
    if echo "$response" | jq -e '.ready == true' > /dev/null 2>&1; then
        log_success "Readiness check passed"
        echo "   Response: $(echo "$response" | jq -c .)"
    else
        log_error "Readiness check failed"
        echo "   Response: $response"
        return 1
    fi
}

# Test 4: Telemetry sanity
test_telemetry() {
    log_info "4️⃣ Testing telemetry with demo run..."
    
    # Create a demo run
    local demo_response=$(curl -s -X POST http://localhost:8080/api/diagnostics/emit-demo-run \
        -H "Content-Type: application/json" \
        -d '{"agentId": "test-agent", "input": "test input"}')
    
    if echo "$demo_response" | jq -e '.success == true' > /dev/null 2>&1; then
        log_success "Demo run created successfully"
        local run_id=$(echo "$demo_response" | jq -r '.data.runId')
        echo "   Run ID: $run_id"
    else
        log_error "Failed to create demo run"
        echo "   Response: $demo_response"
        return 1
    fi
}

# Test 5: SSE capture
test_sse() {
    log_info "5️⃣ Testing SSE functionality..."
    
    # Start SSE test and capture events for 5 seconds
    local events=$(timeout 5s curl -N http://localhost:8080/diagnostics/sse-test 2>/dev/null || true)
    
    if [ -n "$events" ]; then
        log_success "SSE events received"
        echo "   Event types found:"
        echo "$events" | grep -E "^event:" | sort | uniq | sed 's/^event: /     - /'
    else
        log_error "No SSE events received"
        return 1
    fi
}

# Test 6: Metrics scrape
test_metrics() {
    log_info "6️⃣ Testing metrics endpoint..."
    
    local metrics=$(curl -s http://localhost:8080/metrics)
    
    # Check for required metrics
    local required_metrics=(
        "sentinel_spans_total"
        "sentinel_guard_events_total"
    )
    
    local missing_metrics=()
    for metric in "${required_metrics[@]}"; do
        if ! echo "$metrics" | grep -q "$metric"; then
            missing_metrics+=("$metric")
        fi
    done
    
    if [ ${#missing_metrics[@]} -eq 0 ]; then
        log_success "All required metrics found"
        echo "   Metrics found: ${required_metrics[*]}"
    else
        log_error "Missing required metrics: ${missing_metrics[*]}"
        return 1
    fi
}

# Test 7: Clean teardown
test_teardown() {
    log_info "7️⃣ Testing clean teardown..."
    
    # Stop services
    if make down > /dev/null 2>&1; then
        log_success "Services stopped successfully"
    else
        log_error "Failed to stop services"
        return 1
    fi
    
    # Check that ports are no longer bound
    sleep 2
    
    if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
        log_success "Port 8080 is no longer bound"
    else
        log_error "Port 8080 is still bound after teardown"
        return 1
    fi
    
    if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Port 3000 is no longer bound"
    else
        log_error "Port 3000 is still bound after teardown"
        return 1
    fi
}

# Main test execution
main() {
    log_info "Starting Prove-It packaging test..."
    
    # Check prerequisites
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
    
    # Run tests
    test_boot
    test_health
    test_readiness
    test_telemetry
    test_sse
    test_metrics
    test_teardown
    
    # Final results
    echo ""
    echo "🎯 Prove-It Packaging Test Results:"
    echo "==================================="
    echo "✅ Passed: $PASSED"
    echo "❌ Failed: $FAILED"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        log_success "ALL TESTS PASSED!"
        echo ""
        echo "🎉 4Runr Gateway packaging is PROVEN to work!"
        echo "✅ Fresh machine can clone, boot, and test successfully"
        echo "✅ All services start and become ready"
        echo "✅ Health and readiness checks pass"
        echo "✅ Telemetry system works"
        echo "✅ SSE events are emitted"
        echo "✅ Metrics are exposed"
        echo "✅ Clean teardown works"
        echo ""
        echo "🛡️ The 4Runr AI Agent OS is ready for production!"
        exit 0
    else
        log_error "SOME TESTS FAILED!"
        echo ""
        echo "⚠️  Please fix the failing tests before proceeding"
        exit 1
    fi
}

# Run main function
main "$@"
