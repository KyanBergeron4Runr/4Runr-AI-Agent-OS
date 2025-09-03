# Adapters Package

All new integration lives here. No gateway/runtime forks.

## Purpose

This package contains adapters that wrap existing APIs without modifying them. This ensures we maintain the stability of our core components while adding new functionality.

## Adapter Pattern

Instead of modifying existing code, create adapters that:
1. Wrap existing APIs
2. Add new functionality
3. Maintain backward compatibility
4. Follow the contract defined in `ARCHITECTURE/REUSE-MAP.md`

## Structure

```
packages/adapters/
├── README.md                 # This file
├── database-adapter.ts       # Database integration (future)
├── cache-adapter.ts          # Redis caching (future)
├── auth-adapter.ts           # Authentication (future)
├── validation-adapter.ts     # Input validation (future)
├── webhook-adapter.ts        # Webhook system (future)
└── types/                    # Adapter-specific types
    └── index.ts
```

## Examples

### Database Adapter
```typescript
// Instead of modifying the Map-based storage in gateway
// Create an adapter that wraps the existing API
export class DatabaseAdapter {
  async createRun(runData: any) {
    // Store in database
    const run = await this.db.runs.create(runData);
    // Call existing gateway API
    return this.gateway.createRun(runData);
  }
}
```

### Validation Adapter
```typescript
// Instead of modifying route handlers
// Create middleware that validates before existing handlers
export const validationMiddleware = (schema: ZodSchema) => {
  return async (request: any, reply: any) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    // Continue to existing handler
  };
};
```

## Rules

1. **No Gateway Modifications**: Never modify `apps/gateway/src/index.ts`
2. **No Runtime Modifications**: Never modify core runtime components
3. **Wrapper Pattern**: Always wrap, never replace
4. **Contract Compliance**: Follow contracts in REUSE-MAP.md
5. **Backward Compatibility**: Existing APIs must continue to work

## Adding New Adapters

1. Create new adapter file in this directory
2. Follow the naming pattern: `{functionality}-adapter.ts`
3. Add to REUSE-MAP.md under "New Work → Adapter/Placement"
4. Write tests for the adapter
5. Document the adapter's purpose and usage

## Integration Points

- **Gateway Routes**: Use existing HTTP endpoints
- **SSE System**: Subscribe to existing SSE streams
- **Storage**: Wrap existing Map-based storage
- **SDK**: Extend existing SDK methods
- **CLI**: Add new commands that use existing APIs

## Testing

Each adapter should have:
- Unit tests for adapter logic
- Integration tests with existing APIs
- Contract tests to ensure API compliance
- Performance tests for wrapper overhead
