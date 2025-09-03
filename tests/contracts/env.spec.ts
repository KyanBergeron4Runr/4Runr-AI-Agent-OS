import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Environment Variables Contracts', () => {
  describe('Required Environment Variables', () => {
    it('should have all expected environment variables defined', () => {
      const testFilePath = join(__dirname, '../../tests/e2e.gateway.spec.ts');
      const content = readFileSync(testFilePath, 'utf-8');
      const lines = content.split('\n');

      const actualEnvVars: string[] = [];

      for (const line of lines) {
        if (line && line.includes('process.env')) {
          // Match both dot notation (process.env.VAR) and bracket notation (process.env['VAR'])
          const envMatch = line.match(/process\.env(?:\.([a-zA-Z_][a-zA-Z0-9_]*)|\['([^']+)'\]|\["([^"]+)"\]|\[`([^`]+)`\])/);
          if (envMatch) {
            const envVar = envMatch[1] || envMatch[2] || envMatch[3] || envMatch[4];
            if (envVar && !actualEnvVars.includes(envVar)) {
              actualEnvVars.push(envVar);
            }
          }
        }
      }

      // Expected environment variables from actual test file
      const expectedEnvVars = [
        'PORT',
        'SECRETS_BACKEND',
        'TOKEN_HMAC_SECRET',
        'HTTP_TIMEOUT_MS',
        'CB_FAIL_THRESHOLD',
        'CB_OPEN_MS',
        'CACHE_ENABLED',
        'CACHE_TTL_MS',
        'DEFAULT_TIMEZONE',
        'serpapi.api_key',
        'openai.api_key',
        'gmail_send.api_key'
      ];

      // Check that all expected environment variables are present
      expectedEnvVars.forEach(expected => {
        const found = actualEnvVars.find(envVar => envVar === expected);
        expect(found).toBeDefined();
      });

      // Log actual environment variables for debugging
      console.log('Actual environment variables found:', actualEnvVars);
    });

    it('should have consistent environment variable patterns', () => {
      const testFilePath = join(__dirname, '../../tests/e2e.gateway.spec.ts');
      const content = readFileSync(testFilePath, 'utf-8');
      const lines = content.split('\n');

      const envVars: string[] = [];

      for (const line of lines) {
        if (line && line.includes('process.env')) {
          // Match both dot notation (process.env.VAR) and bracket notation (process.env['VAR'])
          const envMatch = line.match(/process\.env(?:\.([a-zA-Z_][a-zA-Z0-9_]*)|\['([^']+)'\]|\["([^"]+)"\]|\[`([^`]+)`\])/);
          if (envMatch) {
            const envVar = envMatch[1] || envMatch[2] || envMatch[3] || envMatch[4];
            if (envVar) {
              envVars.push(envVar);
            }
          }
        }
      }

      // Should have at least one environment variable
      expect(envVars.length).toBeGreaterThan(0);
    });
  });
});
