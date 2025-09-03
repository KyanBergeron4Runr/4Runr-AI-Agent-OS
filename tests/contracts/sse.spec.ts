import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('SSE Contracts', () => {
  describe('SSE Endpoints', () => {
    it('should have all expected SSE endpoints defined', () => {
      const gatewayPath = join(__dirname, '../../apps/gateway/src/index.ts');
      const content = readFileSync(gatewayPath, 'utf-8');
      const lines = content.split('\n');

      const actualSSEEndpoints: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.includes('text/event-stream')) {
          // Look for the route definition above this line
          for (let j = Math.max(0, i - 10); j <= i; j++) {
            const checkLine = lines[j];
            if (j < lines.length && checkLine && (checkLine.includes('fastify.get') || checkLine.includes('fastify.post'))) {
              const pathMatch = checkLine.match(/['"`]([^'"`]+)['"`]/);
              if (pathMatch && pathMatch[1]) {
                actualSSEEndpoints.push(pathMatch[1]);
              }
              break;
            }
          }
        }
      }

      // Expected SSE endpoints from actual gateway
      const expectedSSEEndpoints = [
        '/api/runs/:id/logs/stream',
        '/api/runs/logs/stream',
        '/diagnostics/sse-test'
      ];

      // Check that all expected SSE endpoints are present
      expectedSSEEndpoints.forEach(expected => {
        const found = actualSSEEndpoints.find(endpoint => endpoint === expected);
        expect(found).toBeDefined();
      });

      // Log actual SSE endpoints for debugging
      console.log('Actual SSE endpoints found:', actualSSEEndpoints);
    });

    it('should have consistent SSE patterns', () => {
      const gatewayPath = join(__dirname, '../../apps/gateway/src/index.ts');
      const content = readFileSync(gatewayPath, 'utf-8');
      const lines = content.split('\n');

      const ssePaths: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.includes('text/event-stream')) {
          // Look for the route definition above this line
          for (let j = Math.max(0, i - 10); j <= i; j++) {
            const checkLine = lines[j];
            if (j < lines.length && checkLine && (checkLine.includes('fastify.get') || checkLine.includes('fastify.post'))) {
              const pathMatch = checkLine.match(/['"`]([^'"`]+)['"`]/);
              if (pathMatch && pathMatch[1]) {
                ssePaths.push(pathMatch[1]);
              }
              break;
            }
          }
        }
      }

      // All SSE endpoints should be under /api/ or /diagnostics/
      ssePaths.forEach(path => {
        expect(path).toMatch(/^(\/api\/|\/diagnostics\/)/);
      });

      // SSE endpoints should contain 'stream' in the path (except diagnostics)
      ssePaths.forEach(path => {
        if (path.startsWith('/api/')) {
          expect(path).toContain('stream');
        }
      });

      // Should have at least one SSE endpoint
      expect(ssePaths.length).toBeGreaterThan(0);
    });
  });
});
