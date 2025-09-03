# ADR-0004: Input Validation and Idempotency via Middleware

## Status
Accepted

## Context
The 4Runr Gateway needs to add input validation and idempotency capabilities without modifying existing working components. The Anti-Duplication Guardrails require all new functionality to be implemented via adapters and middleware.

## Decision
Implement input validation and idempotency as middleware that wraps existing gateway handlers, using feature flags for gradual rollout and environment-specific configuration.

## Implementation Details

### Input Validation
- **Zod schemas** for type-safe validation with machine-readable error codes
- **Middleware pattern** that hooks into Fastify's preHandler lifecycle
- **Feature flags**: `VALIDATION_ENFORCE=strict|warn|off`
- **Error responses**: 422 status with structured error details
- **Size limits**: 64KB strings, 128KB objects, configurable via environment

### Idempotency
- **UUID v4 keys** via `Idempotency-Key` header
- **Redis store** with 24-hour TTL (configurable)
- **Body normalization** for consistent hashing
- **Feature flags**: `IDEMPOTENCY_ENABLED=true|false`
- **Response codes**: 201 → 200 for idempotent requests, 409 for conflicts

### Architecture Pattern
```
Client Request → Validation Middleware → Idempotency Middleware → Existing Handler
                ↓                        ↓
            Zod Schema              Redis Store
            Validation              Key Lookup
```

## Consequences

### Positive
- ✅ **Non-invasive**: No changes to existing gateway handlers
- ✅ **Feature flags**: Can be enabled/disabled per environment
- ✅ **Type safety**: Strong TypeScript types for SDK reuse
- ✅ **Scalable**: Redis-based storage for production use
- ✅ **Compliant**: Follows Anti-Duplication Guardrails

### Negative
- ⚠️ **Complexity**: Additional middleware layers
- ⚠️ **Dependencies**: Requires Redis for production idempotency
- ⚠️ **Performance**: Small overhead for validation and idempotency checks

### Risks
- **Redis availability**: Idempotency fails if Redis is down (fail-open design)
- **Schema drift**: Validation schemas must stay in sync with API contracts
- **Memory usage**: In-memory fallback for development/testing

## Alternatives Considered

### 1. Modify Existing Handlers
- **Rejected**: Violates Anti-Duplication Guardrails
- **Reason**: Would require changes to working, tested code

### 2. New Validation Routes
- **Rejected**: Creates duplication of existing endpoints
- **Reason**: Violates "reuse over rewrite" principle

### 3. Database Schema Changes
- **Rejected**: Would modify existing storage patterns
- **Reason**: Storage is locked per DO-NOT-REBUILD.md

## Implementation Steps

1. ✅ **Validation Middleware**: Zod schemas + Fastify hooks
2. ✅ **Idempotency Middleware**: Redis store + response capture
3. ✅ **Gateway Adapters**: Wire middleware to existing routes
4. ✅ **Contract Tests**: Ensure behavior consistency
5. ✅ **Configuration**: Environment-based feature flags
6. 🔄 **Integration**: Wire into gateway startup
7. 🔄 **Testing**: Local + stress test validation

## Testing Strategy

### Contract Tests
- **Validation**: Exact error response structure
- **Idempotency**: UUID format, response codes, TTL behavior
- **Integration**: Middleware composition with existing handlers

### Stress Tests
- **50% requests** with Idempotency-Key
- **20% malformed payloads** for validation testing
- **Expected**: 0 server errors, consistent 422s, high idempotency hit-rate

## Monitoring & Observability

### Metrics
- `validation_rejections_total` - Count of validation failures
- `idempotency_hits_total` - Count of idempotent request hits
- `idempotency_conflicts_total` - Count of key conflicts

### Logs
- **Structured logging** with consistent field names
- **Validation events**: `validation.reject`, `validation.warning`
- **Idempotency events**: `idempotency.hit`, `idempotency.conflict`

## Future Considerations

### Phase 2 Enhancements
- **Rate limiting** middleware (after idempotency lands)
- **Authentication** middleware (JWT validation)
- **Caching** middleware (Redis-based response caching)

### Phase 3 Enhancements
- **Shield & Sentinel** safety systems
- **Education Agent** build/test harness
- **Advanced validation** (cross-field validation, business rules)

## References

- [Anti-Duplication Guardrails](../ANTI-DUPLICATION-GUARDRAILS.md)
- [REUSE-MAP](../REUSE-MAP.md)
- [DO-NOT-REBUILD](../DO-NOT-REBUILD.md)
- [Zod Documentation](https://zod.dev/)
- [Fastify Hooks](https://www.fastify.io/docs/latest/Reference/Hooks/)
