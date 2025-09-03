#!/usr/bin/env pwsh
# PowerShell version of smoke test

$ErrorActionPreference = "Stop"

$base = if ($env:GATEWAY_URL) { $env:GATEWAY_URL } else { "http://localhost:3000" }

function json($obj) {
    $obj | ConvertTo-Json -Depth 10
}

Write-Host "UPSTREAM_MODE=$(if ($env:UPSTREAM_MODE) { $env:UPSTREAM_MODE } else { 'mock' })"

Write-Host "==> /health"
$health = Invoke-RestMethod -Uri "$base/health" -Method Get
json $health

Write-Host "==> /ready"
$ready = Invoke-RestMethod -Uri "$base/ready" -Method Get
json $ready

Write-Host "==> create agent"
$agentBody = @{
    name = "smoke_scraper"
    created_by = "smoke"
    role = "scraper"
} | ConvertTo-Json

$agent = Invoke-RestMethod -Uri "$base/api/create-agent" -Method Post -Body $agentBody -ContentType "application/json"
$AID = $agent.agent_id

Write-Host "==> generate token"
$exp = (Get-Date).AddMinutes(10).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$tokenBody = @{
    agent_id = $AID
    tools = @("serpapi")
    permissions = @("read")
    expires_at = $exp
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "X-Agent-Intent" = "lead_discovery"
}

$token = Invoke-RestMethod -Uri "$base/api/generate-token" -Method Post -Body $tokenBody -Headers $headers
$TOK = $token.token

Write-Host "==> happy path"
$proxyBody = @{
    agent_token = $TOK
    tool = "serpapi"
    action = "search"
    params = @{
        q = "test"
        engine = "google"
    }
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "$base/api/proxy" -Method Post -Body $proxyBody -ContentType "application/json"
Write-Host "Happy path successful"

Write-Host "==> denial path (expect 403)"
$denialBody = @{
    agent_token = $TOK
    tool = "gmail_send"
    action = "send"
    params = @{
        to = "x@y.com"
        subject = "no"
        text = "no"
    }
} | ConvertTo-Json

try {
    $denialResult = Invoke-RestMethod -Uri "$base/api/proxy" -Method Post -Body $denialBody -ContentType "application/json"
    Write-Host "ERROR: Expected 403, but request succeeded"
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "Denial path successful (403 as expected)"
    } else {
        Write-Host "ERROR: Expected 403, got $($_.Exception.Response.StatusCode)"
        exit 1
    }
}

Write-Host "==> metrics snapshot (first 40 lines)"
$metrics = Invoke-RestMethod -Uri "$base/metrics" -Method Get
($metrics -split "`n" | Select-Object -First 40) -join "`n"

Write-Host "SMOKE OK"
