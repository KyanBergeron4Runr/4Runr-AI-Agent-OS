import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Route Contracts', () => {
  describe('Gateway Routes', () => {
    it('should have all expected routes defined', () => {
      const gatewayPath = join(__dirname, '../../apps/gateway/src/index.ts');
      const content = readFileSync(gatewayPath, 'utf-8');
      const lines = content.split('\n');

      const actualRoutes: Array<{method: string, path: string}> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && (line.includes('fastify.get') || line.includes('fastify.post') ||
            line.includes('fastify.put') || line.includes('fastify.delete') ||
            line.includes('fastify.patch'))) {
          const methodMatch = line.match(/fastify\.(get|post|put|delete|patch)/);
          const pathMatch = line.match(/['"`]([^'"`]+)['"`]/);
          
          if (methodMatch && methodMatch[1] && pathMatch && pathMatch[1]) {
            actualRoutes.push({
              method: methodMatch[1].toUpperCase(),
              path: pathMatch[1]
            });
          }
        }
      }

      // Expected routes from actual gateway source
      const expectedRoutes = [
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/ready' },
        { method: 'GET', path: '/metrics' },
        { method: 'POST', path: '/api/workspace/plan' },
        { method: 'POST', path: '/api/runs' },
        { method: 'GET', path: '/api/runs/:id' },
        { method: 'POST', path: '/api/runs/:id/start' },
        { method: 'GET', path: '/api/runs/:id/logs/stream' },
        { method: 'GET', path: '/api/runs/logs/stream' },
        { method: 'POST', path: '/api/registry/publish' },
        { method: 'GET', path: '/api/safety/check' },
        { method: 'POST', path: '/api/privacy/toggle' },
        { method: 'POST', path: '/api/diagnostics/emit-demo-run' },
        { method: 'GET', path: '/diagnostics/sse-test' }
      ];

      // Check that all expected routes are present
      expectedRoutes.forEach(expected => {
        const found = actualRoutes.find(route => 
          route.method === expected.method && route.path === expected.path
        );
        expect(found).toBeDefined();
      });

      // Log actual routes for debugging
      console.log('Actual routes found:', actualRoutes);
    });

    it('should have consistent route patterns', () => {
      const gatewayPath = join(__dirname, '../../apps/gateway/src/index.ts');
      const content = readFileSync(gatewayPath, 'utf-8');
      const lines = content.split('\n');

      const routes: string[] = [];

      for (const line of lines) {
        if (line && (line.includes('fastify.get') || line.includes('fastify.post'))) {
          const pathMatch = line.match(/['"`]([^'"`]+)['"`]/);
          if (pathMatch && pathMatch[1]) {
            routes.push(pathMatch[1]);
          }
        }
      }

      // All routes should start with / or /api/
      routes.forEach(route => {
        expect(route).toMatch(/^(\/|\/api\/)/);
      });

      // Health and ready endpoints should be at root level
      expect(routes).toContain('/health');
      expect(routes).toContain('/ready');

      // API routes should be under /api/
      const apiRoutes = routes.filter(route => route.startsWith('/api/'));
      expect(apiRoutes.length).toBeGreaterThan(0);
    });
  });
});
