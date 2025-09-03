#!/usr/bin/env pwsh

# Simple 4Runr Gateway Inventory Script
param([string]$OutputDir = "ARCHITECTURE/inventory")

# Create output directory
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "🔍 Generating 4Runr Gateway Inventory..." -ForegroundColor Green

# 1. HTTP Routes Inventory
Write-Host "📡 Scanning HTTP routes..." -ForegroundColor Yellow
$routes = @()

$gatewayFile = "apps/gateway/src/index.ts"
if (Test-Path $gatewayFile) {
    $content = Get-Content $gatewayFile -Raw
    $lines = $content -split "`n"
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match 'fastify\.(get|post|put|delete|patch)\s*\(\s*["'']([^"'']+)["'']') {
            $routes += [PSCustomObject]@{
                Method = $matches[1].ToUpper()
                Path = $matches[2]
                File = $gatewayFile
                Line = $i + 1
            }
        }
    }
}

# Write routes inventory
$routesContent = "# HTTP Routes Inventory`n`n"
$routesContent += "| Method | Path | File | Line |`n"
$routesContent += "|--------|------|------|------|`n"
foreach ($route in $routes) {
    $routesContent += "| $($route.Method) | $($route.Path) | $($route.File) | $($route.Line) |`n"
}

Set-Content -Path "$OutputDir/routes.md" -Value $routesContent

# 2. Environment Variables Inventory
Write-Host "🌍 Scanning environment variables..." -ForegroundColor Yellow
$envVars = @()

$tsFiles = Get-ChildItem -Path "." -Recurse -Include "*.ts" -Exclude "node_modules", "dist", "*.d.ts" | Where-Object { $_.FullName -notlike "*node_modules*" }

foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    $lines = $content -split "`n"
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match 'process\.env\[["'']([^"'']+)["'']\]') {
            $envVar = $matches[1]
            if ($envVars.Name -notcontains $envVar) {
                $envVars += [PSCustomObject]@{
                    Name = $envVar
                    File = $relativePath
                    Line = $i + 1
                }
            }
        }
    }
}

$envContent = "# Environment Variables Inventory`n`n"
$envContent += "| Variable | File | Line |`n"
$envContent += "|----------|------|------|`n"
foreach ($envVar in $envVars) {
    $envContent += "| $($envVar.Name) | $($envVar.File) | $($envVar.Line) |`n"
}

Set-Content -Path "$OutputDir/env.md" -Value $envContent

# 3. SSE Endpoints Inventory
Write-Host "📡 Scanning SSE endpoints..." -ForegroundColor Yellow
$sseEndpoints = @()

foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    $lines = $content -split "`n"
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match 'text/event-stream') {
            # Look backwards for the route
            for ($j = $i; $j -ge 0; $j--) {
                if ($lines[$j] -match 'fastify\.(get|post)\s*\(\s*["'']([^"'']+)["'']') {
                    $sseEndpoints += [PSCustomObject]@{
                        Path = $matches[2]
                        Method = $matches[1].ToUpper()
                        File = $relativePath
                        Line = $j + 1
                    }
                    break
                }
            }
        }
    }
}

$sseContent = "# SSE Endpoints Inventory`n`n"
$sseContent += "| Path | Method | File | Line |`n"
$sseContent += "|------|--------|------|------|`n"
foreach ($endpoint in $sseEndpoints) {
    $sseContent += "| $($endpoint.Path) | $($endpoint.Method) | $($endpoint.File) | $($endpoint.Line) |`n"
}

Set-Content -Path "$OutputDir/sse.md" -Value $sseContent

Write-Host "✅ Inventory generated in $OutputDir/" -ForegroundColor Green
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  - Routes: $($routes.Count)" -ForegroundColor White
Write-Host "  - Environment Variables: $($envVars.Count)" -ForegroundColor White
Write-Host "  - SSE Endpoints: $($sseEndpoints.Count)" -ForegroundColor White
