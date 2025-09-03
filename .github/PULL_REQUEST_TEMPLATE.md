# Pull Request Template

## What capability? (link to REUSE-MAP row)

**REUSE-MAP Link:** [Link to relevant row in ARCHITECTURE/REUSE-MAP.md]

**Capability:** [Brief description of what capability this PR adds]

## Which existing components are reused?

- [ ] **Gateway Routes**: Using existing `/api/runs` endpoints
- [ ] **SSE System**: Using existing `/api/runs/:id/logs/stream` 
- [ ] **Storage**: Using existing Map-based storage
- [ ] **SDK**: Extending existing SDK methods
- [ ] **CLI**: Adding commands that use existing APIs
- [ ] **Shared Libs**: Using existing utility functions
- [ ] **Test Harnesses**: Using existing S2 stress tests

**List specific components:**
- `apps/gateway/src/index.ts` - [How it's reused]
- `packages/sdk-js/src/index.ts` - [How it's reused]
- `packages/shared/src/` - [How it's reused]

## Why not modify existing code? (if you did, explain)

- [ ] **No existing code modified**: All changes are in new files
- [ ] **Bugfix only**: Only fixing existing bugs, no new features
- [ ] **Interface compliance**: Updating existing code to conform to new interface
- [ ] **Approved change**: Change approved by component owner

**If existing code was modified, explain why:**
[Explanation of why modification was necessary and how it maintains backward compatibility]

## Evidence: tests passing, routes unchanged, SSE unchanged

- [ ] **Contract tests pass**: `npm run test:contracts` ✅
- [ ] **Route inventory unchanged**: No new routes added
- [ ] **SSE inventory unchanged**: No new SSE endpoints added
- [ ] **Environment variables unchanged**: No new env vars added
- [ ] **Existing tests pass**: All existing tests still pass
- [ ] **Stress tests pass**: S2 harness tests still work

## Inventory diff: attach tools/inventory before/after

**Before:**
```
[Attach output of `tools/inventory-basic.ps1` before changes]
```

**After:**
```
[Attach output of `tools/inventory-basic.ps1` after changes]
```

## No new public endpoints unless approved by OWNER

- [ ] **No new routes**: No new HTTP endpoints added
- [ ] **No new SSE**: No new SSE endpoints added
- [ ] **No new env vars**: No new environment variables added
- [ ] **Owner approval**: [If new endpoints were added, list owner approval]

## Adapter Pattern Compliance

- [ ] **New code in adapters**: All new integration code is in `packages/adapters/`
- [ ] **Wrapper pattern**: New code wraps existing APIs, doesn't replace them
- [ ] **Backward compatibility**: Existing APIs continue to work unchanged
- [ ] **Contract compliance**: Follows contracts defined in REUSE-MAP.md

## Files Changed

### New Files (Adapters)
- `packages/adapters/[new-adapter].ts` - [Description]

### Modified Files (Bugfixes/Interfaces only)
- `[file]` - [Reason for modification]

### Unchanged Files (Protected)
- `apps/gateway/src/index.ts` - ✅ No changes
- `packages/sdk-js/src/index.ts` - ✅ No changes
- `packages/shared/src/` - ✅ No changes

## Testing

- [ ] **Unit tests**: New adapter has unit tests
- [ ] **Integration tests**: Tests integration with existing APIs
- [ ] **Contract tests**: Ensures API contracts are maintained
- [ ] **Performance tests**: Measures adapter overhead
- [ ] **Stress tests**: S2 harness still works

## Documentation

- [ ] **REUSE-MAP updated**: New capability added to REUSE-MAP.md
- [ ] **Adapter documented**: New adapter has README/usage docs
- [ ] **API docs updated**: If new public APIs, they're documented

## Checklist

- [ ] I have read and followed the Anti-Duplication Guardrails
- [ ] I have linked this PR to the relevant REUSE-MAP row
- [ ] I have not modified any protected components without approval
- [ ] I have used the adapter pattern for new integrations
- [ ] I have maintained backward compatibility
- [ ] I have run all contract tests and they pass
- [ ] I have updated the inventory if needed
- [ ] I have documented the changes appropriately

---

**Note:** This PR template enforces the "Adapters not rewrites" rule. If you need to modify existing code, you must explain why and get approval from the component owner.
