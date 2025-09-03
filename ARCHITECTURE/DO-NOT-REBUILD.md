# DO-NOT-REBUILD: Code Freeze Components

This document lists components that are **LOCKED** and must not be modified except via adapters or approved bugfixes.

## Gateway (Routes, SSE)

**Where it lives:** `apps/gateway/src/index.ts`
**Owner:** Gateway Team
**Contract:** 
- HTTP routes: `/api/runs`, `/api/runs/:id`, `/api/runs/:id/start`, `/api/runs/:id/logs/stream`
- SSE endpoints: `/api/runs/:id/logs/stream`, `/api/runs/logs/stream`
- Health/readiness: `/health`, `/ready`
- Metrics: `/metrics`
**Allowed changes:** Bugfixes only, no new routes without approval

## Run Lifecycle Core

**Where it lives:** `apps/gateway/src/index.ts` (lines 101-250)
**Owner:** Runtime Team
**Contract:**
- Run creation: POST `/api/runs` → `{success: true, run: {...}}`
- Run retrieval: GET `/api/runs/:id` → run object
- Run start: POST `/api/runs/:id/start` → `{success: true, run: {...}}`
- In-memory run storage with Map<string, any>
**Allowed changes:** Bugfixes only, no storage changes without approval

## Auth

**Where it lives:** Currently minimal auth in gateway
**Owner:** Security Team
**Contract:** Basic request validation
**Allowed changes:** Security patches only

## Telemetry/Metrics

**Where it lives:** `apps/gateway/src/index.ts` (lines 50-80)
**Owner:** Observability Team
**Contract:**
- Prometheus metrics endpoint: `/metrics`
- SSE connection tracking
- Message counters
**Allowed changes:** Bugfixes only, no metric changes without approval

## Test Harnesses (S2, Stress, Chaos)

**Where it lives:** Root level files: `s2-*.js`, `stress-test-*.js`, `*-harness-*.js`
**Owner:** QA Team
**Contract:** CLI-based test runners with JSON output
**Allowed changes:** Bugfixes only, no test logic changes without approval

## Proven Libraries

**Where it lives:** `packages/shared/src/`
**Owner:** Platform Team
**Contract:**
- `utils.ts`: Utility functions
- `types.ts`: TypeScript interfaces
- `logger.ts`: Logging utilities
- `env.ts`: Environment variable handling
**Allowed changes:** Bugfixes only, no API changes without approval

## SDK-JS

**Where it lives:** `packages/sdk-js/src/index.ts`
**Owner:** SDK Team
**Contract:** JavaScript SDK for gateway integration
**Allowed changes:** Bugfixes only, no breaking changes without approval

## CLI

**Where it lives:** `packages/cli/`
**Owner:** CLI Team
**Contract:** Command-line interface for gateway operations
**Allowed changes:** Bugfixes only, no command changes without approval

---

## Modification Process

1. **Bugfixes:** Create PR with clear description of the bug and fix
2. **Adapters:** Create new code in `packages/adapters/` or `apps/*/adapters/`
3. **Interface Changes:** Propose in `/types` and update existing implementation
4. **New Features:** Must be approved by component owner and documented in ADR

## Enforcement

- CI will fail if protected files are modified without proper approval
- Contract tests will catch breaking changes
- Inventory script will detect unauthorized additions
