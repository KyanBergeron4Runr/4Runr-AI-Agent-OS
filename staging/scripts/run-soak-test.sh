#!/usr/bin/env bash
set -euo pipefail

# 4Runr Gateway 24-Hour Soak Test Runner
# This script orchestrates the complete soak test process

echo "🚀 4Runr Gateway 24-Hour Soak Test Runner"

# Configuration
GATEWAY_URL=${GATEWAY_URL:-"https://gateway-staging.yourdomain.com"}
SOAK_RPS=${SOAK_RPS:-10}
SOAK_HOURS=${SOAK_HOURS:-24}
SOAK_SCRIPT="scripts/soak-24h.js"
MID_RUN_SCRIPT="scripts/mid-run-changes.js"
COLLECT_SCRIPT="scripts/collect-artifacts.sh"

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

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check system health
check_health() {
    print_status "Checking system health..."
    
    if ! command_exists curl; then
        print_error "curl is required but not installed"
        return 1
    fi
    
    if ! command_exists node; then
        print_error "Node.js is required but not installed"
        return 1
    fi
    
    # Check Gateway health
    if ! curl -fsS "${GATEWAY_URL}/health" > /dev/null 2>&1; then
        print_error "Gateway health check failed"
        return 1
    fi
    
    if ! curl -fsS "${GATEWAY_URL}/ready" > /dev/null 2>&1; then
        print_error "Gateway readiness check failed"
        return 1
    fi
    
    print_success "System health check passed"
    return 0
}

# Function to setup environment
setup_environment() {
    print_status "Setting up soak test environment..."
    
    # Create reports directory
    mkdir -p reports
    
    # Check if soak script exists
    if [ ! -f "$SOAK_SCRIPT" ]; then
        print_error "Soak test script not found: $SOAK_SCRIPT"
        exit 1
    fi
    
    # Check if mid-run script exists
    if [ ! -f "$MID_RUN_SCRIPT" ]; then
        print_error "Mid-run changes script not found: $MID_RUN_SCRIPT"
        exit 1
    fi
    
    # Make scripts executable
    chmod +x "$SOAK_SCRIPT"
    chmod +x "$MID_RUN_SCRIPT"
    chmod +x "$COLLECT_SCRIPT"
    
    print_success "Environment setup completed"
}

# Function to display test configuration
show_configuration() {
    echo ""
    print_status "Soak Test Configuration:"
    echo "  Gateway URL: $GATEWAY_URL"
    echo "  Request Rate: $SOAK_RPS RPS"
    echo "  Duration: $SOAK_HOURS hours"
    echo "  Total Requests: $((SOAK_RPS * SOAK_HOURS * 3600))"
    echo ""
    print_status "Test Schedule:"
    echo "  Start: $(date -u)"
    echo "  End: $(date -u -d "+$SOAK_HOURS hours")"
    echo "  H+8: $(date -u -d "+8 hours") - Credential rotation"
    echo "  H+12: $(date -u -d "+12 hours") - Chaos mode (30 min)"
    echo "  H+16: $(date -u -d "+16 hours") - Policy update"
    echo ""
}

# Function to run mid-run changes
run_mid_run_changes() {
    local hour=$1
    local change=$2
    
    print_status "Executing mid-run change at H+$hour: $change"
    
    case $change in
        "credentials")
            node "$MID_RUN_SCRIPT" rotate-credentials
            ;;
        "chaos-on")
            node "$MID_RUN_SCRIPT" chaos-on
            ;;
        "chaos-off")
            node "$MID_RUN_SCRIPT" chaos-off
            ;;
        "policy")
            node "$MID_RUN_SCRIPT" update-policy
            ;;
        *)
            print_error "Unknown mid-run change: $change"
            return 1
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        print_success "Mid-run change completed: $change"
    else
        print_error "Mid-run change failed: $change"
    fi
}

# Function to monitor the soak test
monitor_soak_test() {
    local soak_pid=$1
    local start_time=$(date +%s)
    
    print_status "Starting soak test monitoring..."
    
    while kill -0 "$soak_pid" 2>/dev/null; do
        local elapsed=$(( $(date +%s) - start_time ))
        local hours=$(( elapsed / 3600 ))
        local minutes=$(( (elapsed % 3600) / 60 ))
        
        echo -ne "\r⏱️  Elapsed: ${hours}h ${minutes}m - Soak test running..."
        
        # Check for mid-run changes
        if [ $elapsed -eq $((8 * 3600)) ]; then
            echo ""
            run_mid_run_changes 8 "credentials"
        elif [ $elapsed -eq $((12 * 3600)) ]; then
            echo ""
            run_mid_run_changes 12 "chaos-on"
        elif [ $elapsed -eq $((12 * 3600 + 1800)) ]; then
            echo ""
            run_mid_run_changes 12 "chaos-off"
        elif [ $elapsed -eq $((16 * 3600)) ]; then
            echo ""
            run_mid_run_changes 16 "policy"
        fi
        
        sleep 60
    done
    
    echo ""
    print_success "Soak test completed"
}

# Function to collect artifacts
collect_artifacts() {
    print_status "Collecting soak test artifacts..."
    
    if [ -f "$COLLECT_SCRIPT" ]; then
        bash "$COLLECT_SCRIPT"
        if [ $? -eq 0 ]; then
            print_success "Artifact collection completed"
        else
            print_error "Artifact collection failed"
            return 1
        fi
    else
        print_error "Artifact collection script not found: $COLLECT_SCRIPT"
        return 1
    fi
}

# Function to display results
show_results() {
    print_status "Soak Test Results:"
    
    if [ -f "reports/soak-summary.json" ]; then
        echo ""
        echo "📊 Final Summary:"
        if command_exists jq; then
            jq -r '. | "Success Rate: \(.success_rate)%\nTotal Requests: \(.totals.total)\nDenial Rate: \(.denial_rate)%\nFailure Rate: \(.failure_rate)%\nDuration: \(.duration_seconds) seconds"' reports/soak-summary.json
        else
            cat reports/soak-summary.json
        fi
    fi
    
    if [ -f "reports/soak-events.log" ]; then
        echo ""
        echo "📝 Key Events:"
        grep -E "(SOAK_TEST_STARTED|TOKENS_ROTATED|POLICY_UPDATED|CHAOS_MODE|SOAK_TEST_COMPLETED)" reports/soak-events.log | head -10
    fi
    
    echo ""
    echo "📁 Artifacts:"
    ls -la reports/soak-*.prom 2>/dev/null | wc -l | xargs echo "  Metrics snapshots:"
    ls -la reports/soak-artifacts-*.tar.gz 2>/dev/null | wc -l | xargs echo "  Artifact archives:"
}

# Main execution
main() {
    echo "🚀 Starting 4Runr Gateway 24-Hour Soak Test"
    echo "=========================================="
    
    # Check system health
    if ! check_health; then
        print_error "System health check failed. Aborting."
        exit 1
    fi
    
    # Setup environment
    setup_environment
    
    # Show configuration
    show_configuration
    
    # Confirm before starting
    echo ""
    read -p "Do you want to start the 24-hour soak test? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Soak test cancelled"
        exit 0
    fi
    
    # Start soak test
    print_status "Starting soak test..."
    print_status "Command: SOAK_RPS=$SOAK_RPS SOAK_HOURS=$SOAK_HOURS GATEWAY_URL=$GATEWAY_URL node $SOAK_SCRIPT"
    
    # Run soak test in background
    SOAK_RPS="$SOAK_RPS" SOAK_HOURS="$SOAK_HOURS" GATEWAY_URL="$GATEWAY_URL" node "$SOAK_SCRIPT" &
    SOAK_PID=$!
    
    print_success "Soak test started with PID: $SOAK_PID"
    
    # Monitor the test
    monitor_soak_test "$SOAK_PID"
    
    # Wait for soak test to complete
    wait "$SOAK_PID"
    SOAK_EXIT_CODE=$?
    
    if [ $SOAK_EXIT_CODE -eq 0 ]; then
        print_success "Soak test completed successfully"
    else
        print_error "Soak test failed with exit code: $SOAK_EXIT_CODE"
    fi
    
    # Collect artifacts
    collect_artifacts
    
    # Show results
    show_results
    
    echo ""
    print_success "🎉 24-hour soak test completed!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Review the generated reports"
    echo "  2. Analyze metrics snapshots"
    echo "  3. Generate charts for whitepaper"
    echo "  4. Share artifact archive with team"
    echo ""
}

# Handle graceful shutdown
cleanup() {
    echo ""
    print_status "Cleaning up..."
    
    # Kill soak test if running
    if [ -n "${SOAK_PID:-}" ] && kill -0 "$SOAK_PID" 2>/dev/null; then
        print_status "Stopping soak test..."
        kill "$SOAK_PID"
        wait "$SOAK_PID" 2>/dev/null || true
    fi
    
    print_status "Cleanup completed"
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Run main function
main "$@"
