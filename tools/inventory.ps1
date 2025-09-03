#!/usr/bin/env pwsh

# 4Runr Gateway Inventory Script
# Generates a living inventory of the codebase for anti-duplication guardrails

param(
    [string]$OutputDir = "ARCHITECTURE/inventory"
)

# Create output directory
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "🔍 Generating 4Runr Gateway Inventory..." -ForegroundColor Green

# 1. HTTP Routes Inventory
Write-Host "📡 Scanning HTTP routes..." -ForegroundColor Yellow
$routes = @()

# Scan gateway for routes
$gatewayFile = "apps/gateway/src/index.ts"
if (Test-Path $gatewayFile) {
    $content = Get-Content $gatewayFile -Raw
    $routeMatches = [regex]::Matches($content, 'fastify\.(get|post|put|delete|patch)\s*\(\s*["'']([^"'']+)["'']')
    
    foreach ($match in $routeMatches) {
        $method = $match.Groups[1].Value.ToUpper()
        $path = $match.Groups[2].Value
        $routes += [PSCustomObject]@{
            Method = $method
            Path = $path
            File = $gatewayFile
            Line = ($content.Substring(0, $match.Index) -split "`n").Count
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

# 2. TypeScript Symbols Inventory
Write-Host "🔤 Scanning TypeScript symbols..." -ForegroundColor Yellow
$symbols = @()

# Scan TypeScript files for exports
$tsFiles = Get-ChildItem -Path "." -Recurse -Include "*.ts" -Exclude "node_modules", "dist", "*.d.ts" | Where-Object { $_.FullName -notlike "*node_modules*" }

foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    
    # Find exported classes
    $classMatches = [regex]::Matches($content, 'export\s+(?:class|interface|type|enum)\s+(\w+)')
    foreach ($match in $classMatches) {
        $symbols += [PSCustomObject]@{
            Name = $match.Groups[1].Value
            Type = "class/interface/type/enum"
            File = $relativePath
            Line = ($content.Substring(0, $match.Index) -split "`n").Count
        }
    }
    
    # Find exported functions
    $funcMatches = [regex]::Matches($content, 'export\s+(?:async\s+)?function\s+(\w+)')
    foreach ($match in $funcMatches) {
        $symbols += [PSCustomObject]@{
            Name = $match.Groups[1].Value
            Type = "function"
            File = $relativePath
            Line = ($content.Substring(0, $match.Index) -split "`n").Count
        }
    }
    
    # Find const exports
    $constMatches = [regex]::Matches($content, 'export\s+const\s+(\w+)')
    foreach ($match in $constMatches) {
        $symbols += [PSCustomObject]@{
            Name = $match.Groups[1].Value
            Type = "const"
            File = $relativePath
            Line = ($content.Substring(0, $match.Index) -split "`n").Count
        }
    }
}

# Write symbols inventory
$symbolsContent = "# TypeScript Symbols Inventory`n`n"
$symbolsContent += "| Name | Type | File | Line |`n"
$symbolsContent += "|------|------|------|------|`n"
foreach ($symbol in $symbols) {
    $symbolsContent += "| $($symbol.Name) | $($symbol.Type) | $($symbol.File) | $($symbol.Line) |`n"
}

Set-Content -Path "$OutputDir/symbols.md" -Value $symbolsContent

# 3. Environment Variables Inventory
Write-Host "🌍 Scanning environment variables..." -ForegroundColor Yellow
$envVars = @()

# Scan for process.env usage
foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    
    $envMatches = [regex]::Matches($content, 'process\.env\[["'']([^"'']+)["'']\]')
    foreach ($match in $envMatches) {
        $envVar = $match.Groups[1].Value
        if ($envVars.Name -notcontains $envVar) {
            $envVars += [PSCustomObject]@{
                Name = $envVar
                File = $relativePath
                Line = ($content.Substring(0, $match.Index) -split "`n").Count
            }
        }
    }
}

# Write environment variables inventory
$envContent = "# Environment Variables Inventory`n`n"
$envContent += "| Variable | File | Line |`n"
$envContent += "|----------|------|------|`n"
foreach ($envVar in $envVars) {
    $envContent += "| $($envVar.Name) | $($envVar.File) | $($envVar.Line) |`n"
}

Set-Content -Path "$OutputDir/env.md" -Value $envContent

# 4. SSE Endpoints Inventory
Write-Host "📡 Scanning SSE endpoints..." -ForegroundColor Yellow
$sseEndpoints = @()

# Scan for SSE-related code
foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    
    # Find SSE endpoints
    $sseMatches = [regex]::Matches($content, 'text/event-stream')
    if ($sseMatches.Count -gt 0) {
        # Look for the route definition above
        $lines = $content -split "`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match 'text/event-stream') {
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
}

# Write SSE inventory
$sseContent = "# SSE Endpoints Inventory`n`n"
$sseContent += "| Path | Method | File | Line |`n"
$sseContent += "|------|--------|------|------|`n"
foreach ($endpoint in $sseEndpoints) {
    $sseContent += "| $($endpoint.Path) | $($endpoint.Method) | $($endpoint.File) | $($endpoint.Line) |`n"
}

Set-Content -Path "$OutputDir/sse.md" -Value $sseContent

# 5. Schemas Inventory
Write-Host "📋 Scanning schemas..." -ForegroundColor Yellow
$schemas = @()

# Scan for Zod schemas
foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    
    $zodMatches = [regex]::Matches($content, 'z\.(\w+)\s*\(\s*\)')
    foreach ($match in $zodMatches) {
        $schemas += [PSCustomObject]@{
            Type = "Zod.$($match.Groups[1].Value)"
            File = $relativePath
            Line = ($content.Substring(0, $match.Index) -split "`n").Count
        }
    }
    
    # Find object schemas
    $objMatches = [regex]::Matches($content, 'z\.object\s*\(\s*\{')
    foreach ($match in $objMatches) {
        $schemas += [PSCustomObject]@{
            Type = "Zod.object"
            File = $relativePath
            Line = ($content.Substring(0, $match.Index) -split "`n").Count
        }
    }
}

# Write schemas inventory
$schemasContent = "# Schemas Inventory`n`n"
$schemasContent += "| Type | File | Line |`n"
$schemasContent += "|------|------|------|`n"
foreach ($schema in $schemas) {
    $schemasContent += "| $($schema.Type) | $($schema.File) | $($schema.Line) |`n"
}

Set-Content -Path "$OutputDir/schemas.md" -Value $schemasContent

Write-Host "✅ Inventory generated in $OutputDir/" -ForegroundColor Green
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  - Routes: $($routes.Count)" -ForegroundColor White
Write-Host "  - Symbols: $($symbols.Count)" -ForegroundColor White
Write-Host "  - Environment Variables: $($envVars.Count)" -ForegroundColor White
Write-Host "  - SSE Endpoints: $($sseEndpoints.Count)" -ForegroundColor White
Write-Host "  - Schemas: $($schemas.Count)" -ForegroundColor White
