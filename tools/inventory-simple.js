#!/usr/bin/env node

// Simple 4Runr Gateway Inventory Script
const fs = require('fs');
const path = require('path');

const outputDir = process.argv[2] || 'ARCHITECTURE/inventory';

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🔍 Generating 4Runr Gateway Inventory...');

// 1. HTTP Routes Inventory
console.log('📡 Scanning HTTP routes...');
const routes = [];

const gatewayFile = 'apps/gateway/src/index.ts';
if (fs.existsSync(gatewayFile)) {
  const content = fs.readFileSync(gatewayFile, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('fastify.get') || line.includes('fastify.post') || 
        line.includes('fastify.put') || line.includes('fastify.delete') || 
        line.includes('fastify.patch')) {
      const methodMatch = line.match(/fastify\.(get|post|put|delete|patch)/);
      const pathMatch = line.match(/['"`]([^'"`]+)['"`]/);
      
      if (methodMatch && pathMatch) {
        routes.push({
          method: methodMatch[1].toUpperCase(),
          path: pathMatch[1],
          file: gatewayFile,
          line: i + 1
        });
      }
    }
  }
}

// Write routes inventory
let routesContent = '# HTTP Routes Inventory\n\n';
routesContent += '| Method | Path | File | Line |\n';
routesContent += '|--------|------|------|------|\n';
routes.forEach(route => {
  routesContent += `| ${route.method} | ${route.path} | ${route.file} | ${route.line} |\n`;
});

fs.writeFileSync(path.join(outputDir, 'routes.md'), routesContent);

// 2. Environment Variables Inventory
console.log('🌍 Scanning environment variables...');
const envVars = [];

const tsFiles = getAllTsFiles('.');
tsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('process.env')) {
      const envMatch = line.match(/process\.env\[['"`]([^'"`]+)['"`]\]/);
      if (envMatch) {
        const envVar = envMatch[1];
        if (!envVars.find(e => e.name === envVar)) {
          envVars.push({
            name: envVar,
            file: file.replace(/\\/g, '/'),
            line: i + 1
          });
        }
      }
    }
  }
});

let envContent = '# Environment Variables Inventory\n\n';
envContent += '| Variable | File | Line |\n';
envContent += '|----------|------|------|\n';
envVars.forEach(envVar => {
  envContent += `| ${envVar.name} | ${envVar.file} | ${envVar.line} |\n`;
});

fs.writeFileSync(path.join(outputDir, 'env.md'), envContent);

// 3. SSE Endpoints Inventory
console.log('📡 Scanning SSE endpoints...');
const sseEndpoints = [];

tsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('text/event-stream')) {
      // Look backwards for the route definition
      for (let j = i; j >= 0; j--) {
        if (lines[j].includes('fastify.get') || lines[j].includes('fastify.post')) {
          const pathMatch = lines[j].match(/['"`]([^'"`]+)['"`]/);
          if (pathMatch) {
            sseEndpoints.push({
              path: pathMatch[1],
              method: 'GET',
              file: file.replace(/\\/g, '/'),
              line: j + 1
            });
            break;
          }
        }
      }
    }
  }
});

let sseContent = '# SSE Endpoints Inventory\n\n';
sseContent += '| Path | Method | File | Line |\n';
sseContent += '|------|--------|------|------|\n';
sseEndpoints.forEach(endpoint => {
  sseContent += `| ${endpoint.path} | ${endpoint.method} | ${endpoint.file} | ${endpoint.line} |\n`;
});

fs.writeFileSync(path.join(outputDir, 'sse.md'), sseContent);

console.log('✅ Inventory generated in', outputDir + '/');
console.log('📊 Summary:');
console.log('  - Routes:', routes.length);
console.log('  - Environment Variables:', envVars.length);
console.log('  - SSE Endpoints:', sseEndpoints.length);

// Helper function to get all TypeScript files
function getAllTsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== 'dist' && !item.startsWith('.')) {
        files.push(...getAllTsFiles(fullPath));
      }
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}
