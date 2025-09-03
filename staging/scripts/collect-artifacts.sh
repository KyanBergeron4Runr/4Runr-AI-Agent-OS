#!/usr/bin/env bash
set -euo pipefail

# 4Runr Gateway Soak Test - Artifact Collection Script
# This script collects and packages all artifacts from the 24-hour soak test

echo "📦 Collecting soak test artifacts..."

# Configuration
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
ARTIFACT_DIR="reports"
ARCHIVE_NAME="soak-artifacts-${TIMESTAMP}.tar.gz"

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

# Check if reports directory exists
if [ ! -d "$ARTIFACT_DIR" ]; then
    print_error "Reports directory not found: $ARTIFACT_DIR"
    exit 1
fi

# Create artifacts directory
ARTIFACTS_DIR="${ARTIFACT_DIR}/artifacts-${TIMESTAMP}"
mkdir -p "$ARTIFACTS_DIR"

print_status "Creating artifact collection: $ARTIFACTS_DIR"

# Collect summary file
if [ -f "${ARTIFACT_DIR}/soak-summary.json" ]; then
    cp "${ARTIFACT_DIR}/soak-summary.json" "$ARTIFACTS_DIR/"
    print_success "Collected soak summary"
else
    print_warning "Soak summary not found"
fi

# Collect events log
if [ -f "${ARTIFACT_DIR}/soak-events.log" ]; then
    cp "${ARTIFACT_DIR}/soak-events.log" "$ARTIFACTS_DIR/"
    print_success "Collected events log"
else
    print_warning "Events log not found"
fi

# Collect metrics snapshots
METRICS_COUNT=0
for file in "${ARTIFACT_DIR}"/soak-*.prom; do
    if [ -f "$file" ]; then
        cp "$file" "$ARTIFACTS_DIR/"
        METRICS_COUNT=$((METRICS_COUNT + 1))
    fi
done

if [ $METRICS_COUNT -gt 0 ]; then
    print_success "Collected $METRICS_COUNT metrics snapshots"
else
    print_warning "No metrics snapshots found"
fi

# Generate artifact manifest
print_status "Generating artifact manifest..."

cat > "$ARTIFACTS_DIR/manifest.txt" << EOF
4Runr Gateway 24-Hour Soak Test Artifacts
Generated: $(date -u)
Timestamp: $TIMESTAMP

Files included:
$(ls -la "$ARTIFACTS_DIR" | grep -v "manifest.txt" | awk '{print $9 " (" $5 " bytes)"}')

Summary:
$(if [ -f "$ARTIFACTS_DIR/soak-summary.json" ]; then
    echo "Success Rate: $(jq -r '.success_rate' "$ARTIFACTS_DIR/soak-summary.json" 2>/dev/null || echo 'N/A')%"
    echo "Total Requests: $(jq -r '.totals.total' "$ARTIFACTS_DIR/soak-summary.json" 2>/dev/null || echo 'N/A')"
    echo "Duration: $(jq -r '.duration_seconds' "$ARTIFACTS_DIR/soak-summary.json" 2>/dev/null || echo 'N/A') seconds"
fi)

Events:
$(if [ -f "$ARTIFACTS_DIR/soak-events.log" ]; then
    echo "Total events: $(wc -l < "$ARTIFACTS_DIR/soak-events.log")"
    echo "Key events:"
    grep -E "(SOAK_TEST_STARTED|TOKENS_ROTATED|POLICY_UPDATED|CHAOS_MODE|SOAK_TEST_COMPLETED)" "$ARTIFACTS_DIR/soak-events.log" | head -10
fi)

Metrics:
- Hourly snapshots: $METRICS_COUNT files
- Format: Prometheus metrics
- Contains: gateway_requests_total, gateway_policy_denials_total, gateway_breaker_fastfail_total, etc.

EOF

# Create database snapshot if possible
print_status "Attempting database snapshot..."

if command -v docker > /dev/null 2>&1; then
    DB_CONTAINER=$(docker ps -qf "name=4runr-staging-db-1" || docker ps -qf "name=db")
    if [ -n "$DB_CONTAINER" ]; then
        DB_SNAPSHOT="$ARTIFACTS_DIR/database-snapshot.sql.gz"
        if docker exec -i "$DB_CONTAINER" pg_dump -U gateway gateway | gzip > "$DB_SNAPSHOT"; then
            print_success "Database snapshot created: $(du -h "$DB_SNAPSHOT" | cut -f1)"
        else
            print_warning "Database snapshot failed"
        fi
    else
        print_warning "Database container not found"
    fi
else
    print_warning "Docker not available for database snapshot"
fi

# Generate metrics analysis
print_status "Generating metrics analysis..."

if [ $METRICS_COUNT -gt 0 ]; then
    cat > "$ARTIFACTS_DIR/metrics-analysis.txt" << 'EOF'
4Runr Gateway Soak Test - Metrics Analysis
==========================================

Key Metrics Summary:
EOF

    # Analyze final metrics snapshot
    if [ -f "$ARTIFACTS_DIR/soak-final.prom" ]; then
        echo "Final Metrics Snapshot Analysis:" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        echo "" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        
        # Extract key metrics
        grep -E "gateway_requests_total" "$ARTIFACTS_DIR/soak-final.prom" | head -5 >> "$ARTIFACTS_DIR/metrics-analysis.txt" 2>/dev/null || echo "No request metrics found" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        echo "" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        
        grep -E "gateway_policy_denials_total" "$ARTIFACTS_DIR/soak-final.prom" >> "$ARTIFACTS_DIR/metrics-analysis.txt" 2>/dev/null || echo "No policy denial metrics found" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        echo "" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        
        grep -E "gateway_breaker_fastfail_total" "$ARTIFACTS_DIR/soak-final.prom" >> "$ARTIFACTS_DIR/metrics-analysis.txt" 2>/dev/null || echo "No circuit breaker metrics found" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        echo "" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        
        grep -E "gateway_cache_hits_total" "$ARTIFACTS_DIR/soak-final.prom" >> "$ARTIFACTS_DIR/metrics-analysis.txt" 2>/dev/null || echo "No cache metrics found" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        echo "" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
        
        grep -E "gateway_retries_total" "$ARTIFACTS_DIR/soak-final.prom" >> "$ARTIFACTS_DIR/metrics-analysis.txt" 2>/dev/null || echo "No retry metrics found" >> "$ARTIFACTS_DIR/metrics-analysis.txt"
    fi
    
    print_success "Metrics analysis generated"
fi

# Create archive
print_status "Creating artifact archive..."

cd "$ARTIFACT_DIR"
if tar -czf "$ARCHIVE_NAME" "artifacts-${TIMESTAMP}"; then
    print_success "Artifact archive created: $ARCHIVE_NAME"
    print_success "Archive size: $(du -h "$ARCHIVE_NAME" | cut -f1)"
else
    print_error "Failed to create archive"
    exit 1
fi

# Generate final report
print_status "Generating final report..."

cat > "soak-test-report-${TIMESTAMP}.md" << EOF
# 4Runr Gateway 24-Hour Soak Test Report

**Test Date:** $(date -u)
**Duration:** 24 hours
**Archive:** $ARCHIVE_NAME

## Test Summary

$(if [ -f "artifacts-${TIMESTAMP}/soak-summary.json" ]; then
    echo "**Success Rate:** \$(jq -r '.success_rate' "artifacts-${TIMESTAMP}/soak-summary.json")%"
    echo "**Total Requests:** \$(jq -r '.totals.total' "artifacts-${TIMESTAMP}/soak-summary.json")"
    echo "**Denial Rate:** \$(jq -r '.denial_rate' "artifacts-${TIMESTAMP}/soak-summary.json")%"
    echo "**Failure Rate:** \$(jq -r '.failure_rate' "artifacts-${TIMESTAMP}/soak-summary.json")%"
fi)

## Artifacts Collected

- **Metrics Snapshots:** $METRICS_COUNT hourly snapshots
- **Events Log:** Complete test event timeline
- **Database Snapshot:** PostgreSQL dump (if available)
- **Summary Data:** JSON summary with key statistics

## Key Findings

$(if [ -f "artifacts-${TIMESTAMP}/soak-events.log" ]; then
    echo "**Events Recorded:** \$(wc -l < "artifacts-${TIMESTAMP}/soak-events.log")"
    echo ""
    echo "**Notable Events:**"
    grep -E "(TOKENS_ROTATED|POLICY_UPDATED|CHAOS_MODE)" "artifacts-${TIMESTAMP}/soak-events.log" | head -5 | sed 's/^/- /'
fi)

## Next Steps

1. Analyze metrics snapshots for trends
2. Review policy denial patterns
3. Examine circuit breaker behavior
4. Generate charts for whitepaper

## Archive Contents

\`\`\`
$(tar -tzf "$ARCHIVE_NAME" | sed 's/^/  /')
\`\`\`

---
*Generated by 4Runr Gateway Soak Test Artifact Collection*
EOF

print_success "Final report generated: soak-test-report-${TIMESTAMP}.md"

# Display summary
echo ""
print_success "🎉 Artifact collection completed!"
echo ""
echo "📁 Artifacts collected:"
echo "  - Summary: $(ls -la "artifacts-${TIMESTAMP}/soak-summary.json" 2>/dev/null | awk '{print $5 " bytes"}' || echo 'Not found')"
echo "  - Events: $(ls -la "artifacts-${TIMESTAMP}/soak-events.log" 2>/dev/null | awk '{print $5 " bytes"}' || echo 'Not found')"
echo "  - Metrics: $METRICS_COUNT snapshots"
echo "  - Database: $(ls -la "artifacts-${TIMESTAMP}/database-snapshot.sql.gz" 2>/dev/null | awk '{print $5 " bytes"}' || echo 'Not available')"
echo ""
echo "📦 Archive created:"
echo "  - File: $ARCHIVE_NAME"
echo "  - Size: $(du -h "$ARCHIVE_NAME" | cut -f1)"
echo ""
echo "📋 Reports generated:"
echo "  - Manifest: artifacts-${TIMESTAMP}/manifest.txt"
echo "  - Metrics Analysis: artifacts-${TIMESTAMP}/metrics-analysis.txt"
echo "  - Final Report: soak-test-report-${TIMESTAMP}.md"
echo ""
echo "🚀 Ready for whitepaper analysis!"
