"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sentinelTelemetry = exports.sentinelEvents = void 0;
const config_1 = require("./config");
const events_1 = require("events");
const crypto_1 = __importDefault(require("crypto"));
// Global event emitter for real-time events
exports.sentinelEvents = new events_1.EventEmitter();
class SentinelTelemetry {
    constructor() {
        this.spans = new Map();
        this.events = new Map();
        this.verdicts = new Map();
        this.evidence = new Map();
        this.shieldDecisions = new Map();
        this.auditEvents = new Map();
        this.activeSpans = new Map();
        this.performanceMetrics = new Map();
        // Set up periodic cleanup
        setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000); // Clean up every hour
    }
    // Start a new span
    startSpan(correlationId, agentId, tool, action, type, input, parentSpanId) {
        if (!(0, config_1.isTelemetryEnabled)()) {
            return 'telemetry-disabled';
        }
        const spanId = crypto_1.default.randomUUID();
        const startTime = Date.now();
        const span = {
            id: spanId,
            correlationId,
            agentId,
            tool,
            action,
            type,
            startTime,
            input,
            metadata: { parentSpanId },
            parentSpanId,
            children: []
        };
        this.spans.set(spanId, span);
        this.activeSpans.set(spanId, span);
        // Add to parent's children if exists
        if (parentSpanId) {
            const parentSpan = this.spans.get(parentSpanId);
            if (parentSpan) {
                parentSpan.children.push(spanId);
            }
        }
        // Emit span start event
        this.emitGuardEvent({
            id: crypto_1.default.randomUUID(),
            correlationId,
            agentId,
            timestamp: startTime,
            type: 'span_start',
            data: span
        });
        return spanId;
    }
    // End a span
    endSpan(spanId, output, error) {
        if (!(0, config_1.isTelemetryEnabled)() || spanId === 'telemetry-disabled') {
            return;
        }
        const span = this.spans.get(spanId);
        if (!span) {
            return;
        }
        const endTime = Date.now();
        span.endTime = endTime;
        span.duration = endTime - span.startTime;
        span.output = output;
        if (error) {
            span.metadata.error = error.message;
        }
        this.activeSpans.delete(spanId);
        // Emit span end event
        this.emitGuardEvent({
            id: crypto_1.default.randomUUID(),
            correlationId: span.correlationId,
            agentId: span.agentId,
            timestamp: endTime,
            type: 'span_end',
            data: span
        });
    }
    // Record performance metrics
    recordPerformance(spanId, metrics) {
        if (!(0, config_1.isTelemetryEnabled)() || spanId === 'telemetry-disabled') {
            return;
        }
        const span = this.spans.get(spanId);
        if (!span) {
            return;
        }
        const existing = this.performanceMetrics.get(spanId) || {
            startTime: span.startTime,
            endTime: span.endTime,
            duration: span.duration
        };
        this.performanceMetrics.set(spanId, {
            ...existing,
            ...metrics
        });
        // Update span metadata with performance data
        span.metadata.performance = this.performanceMetrics.get(spanId);
    }
    // Create a safety event
    createEvent(correlationId, agentId, spanId, type, severity, details, action = 'flag') {
        if (!(0, config_1.isTelemetryEnabled)()) {
            return 'telemetry-disabled';
        }
        const eventId = crypto_1.default.randomUUID();
        const timestamp = Date.now();
        const event = {
            id: eventId,
            correlationId,
            agentId,
            spanId,
            type,
            severity,
            timestamp,
            details,
            action,
            resolved: false
        };
        this.events.set(eventId, event);
        // Emit event created
        this.emitGuardEvent({
            id: crypto_1.default.randomUUID(),
            correlationId,
            agentId,
            timestamp,
            type: 'event_created',
            data: event
        });
        return eventId;
    }
    // Resolve an event
    resolveEvent(eventId, resolvedBy) {
        if (!(0, config_1.isTelemetryEnabled)()) {
            return;
        }
        const event = this.events.get(eventId);
        if (!event) {
            return;
        }
        event.resolved = true;
        event.resolvedAt = Date.now();
        event.resolvedBy = resolvedBy;
        // Emit event resolved
        this.emitGuardEvent({
            id: crypto_1.default.randomUUID(),
            correlationId: event.correlationId,
            agentId: event.agentId,
            timestamp: Date.now(),
            type: 'event_resolved',
            data: event
        });
    }
    // Store a verdict
    storeVerdict(verdict) {
        if (!(0, config_1.isTelemetryEnabled)()) {
            return;
        }
        this.verdicts.set(verdict.id, verdict);
    }
    // Store evidence
    storeEvidence(evidence) {
        if (!(0, config_1.isTelemetryEnabled)()) {
            return;
        }
        this.evidence.set(evidence.id, evidence);
    }
    // Store Shield decision
    storeShieldDecision(decision) {
        if (!(0, config_1.isTelemetryEnabled)()) {
            return;
        }
        this.shieldDecisions.set(decision.policyId, decision);
    }
    // Store audit event
    storeAuditEvent(auditEvent) {
        if (!(0, config_1.isTelemetryEnabled)()) {
            return;
        }
        this.auditEvents.set(auditEvent.id, auditEvent);
    }
    // Get telemetry data for a specific correlation ID
    getTelemetryData(correlationId) {
        const spans = Array.from(this.spans.values()).filter(s => s.correlationId === correlationId);
        const events = Array.from(this.events.values()).filter(e => e.correlationId === correlationId);
        const verdicts = Array.from(this.verdicts.values()).filter(v => v.correlationId === correlationId);
        const evidence = Array.from(this.evidence.values()).filter(e => e.correlationId === correlationId);
        const shieldDecisions = Array.from(this.shieldDecisions.values()).filter(d => d.correlationId === correlationId);
        const auditEvents = Array.from(this.auditEvents.values()).filter(a => a.correlationId === correlationId);
        // Calculate metrics
        const avgLatency = spans.length > 0
            ? spans.reduce((sum, s) => sum + (s.duration || 0), 0) / spans.length
            : 0;
        const totalTokenUsage = spans.reduce((sum, s) => {
            const perf = this.performanceMetrics.get(s.id);
            return sum + (perf?.tokenUsage?.total || 0);
        }, 0);
        const flaggedHallucinations = events.filter(e => e.type === 'hallucination').length;
        const flaggedInjections = events.filter(e => e.type === 'injection').length;
        const flaggedPII = events.filter(e => e.type === 'pii_detected').length;
        const lowGroundednessCount = events.filter(e => e.type === 'judge_low_groundedness').length;
        const judgeErrors = events.filter(e => e.type === 'judge_error').length;
        const blockedOutputs = shieldDecisions.filter(d => d.action === 'block').length;
        const maskedOutputs = shieldDecisions.filter(d => d.action === 'mask').length;
        const rewrittenOutputs = shieldDecisions.filter(d => d.action === 'rewrite').length;
        return {
            spans,
            events,
            verdicts,
            evidence,
            shieldDecisions,
            auditEvents,
            metrics: {
                totalSpans: spans.length,
                totalEvents: events.length,
                totalVerdicts: verdicts.length,
                totalShieldDecisions: shieldDecisions.length,
                totalAuditEvents: auditEvents.length,
                avgLatency,
                totalTokenUsage,
                flaggedHallucinations,
                flaggedInjections,
                flaggedPII,
                lowGroundednessCount,
                judgeErrors,
                blockedOutputs,
                maskedOutputs,
                rewrittenOutputs
            }
        };
    }
    // Get all telemetry data
    getAllTelemetryData() {
        const spans = Array.from(this.spans.values());
        const events = Array.from(this.events.values());
        const verdicts = Array.from(this.verdicts.values());
        const evidence = Array.from(this.evidence.values());
        const shieldDecisions = Array.from(this.shieldDecisions.values());
        const auditEvents = Array.from(this.auditEvents.values());
        // Calculate metrics
        const avgLatency = spans.length > 0
            ? spans.reduce((sum, s) => sum + (s.duration || 0), 0) / spans.length
            : 0;
        const totalTokenUsage = spans.reduce((sum, s) => {
            const perf = this.performanceMetrics.get(s.id);
            return sum + (perf?.tokenUsage?.total || 0);
        }, 0);
        const flaggedHallucinations = events.filter(e => e.type === 'hallucination').length;
        const flaggedInjections = events.filter(e => e.type === 'injection').length;
        const flaggedPII = events.filter(e => e.type === 'pii_detected').length;
        const lowGroundednessCount = events.filter(e => e.type === 'judge_low_groundedness').length;
        const judgeErrors = events.filter(e => e.type === 'judge_error').length;
        const blockedOutputs = shieldDecisions.filter(d => d.action === 'block').length;
        const maskedOutputs = shieldDecisions.filter(d => d.action === 'mask').length;
        const rewrittenOutputs = shieldDecisions.filter(d => d.action === 'rewrite').length;
        return {
            spans,
            events,
            verdicts,
            evidence,
            shieldDecisions,
            auditEvents,
            metrics: {
                totalSpans: spans.length,
                totalEvents: events.length,
                totalVerdicts: verdicts.length,
                totalShieldDecisions: shieldDecisions.length,
                totalAuditEvents: auditEvents.length,
                avgLatency,
                totalTokenUsage,
                flaggedHallucinations,
                flaggedInjections,
                flaggedPII,
                lowGroundednessCount,
                judgeErrors,
                blockedOutputs,
                maskedOutputs,
                rewrittenOutputs
            }
        };
    }
    // Clean up old data
    cleanup() {
        const retentionDays = config_1.sentinelConfig.getFeatureConfig('telemetry').retentionDays;
        const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        // Clean up old spans
        for (const [spanId, span] of this.spans.entries()) {
            if (span.startTime < cutoffTime) {
                this.spans.delete(spanId);
                this.activeSpans.delete(spanId);
                this.performanceMetrics.delete(spanId);
            }
        }
        // Clean up old events
        for (const [eventId, event] of this.events.entries()) {
            if (event.timestamp < cutoffTime) {
                this.events.delete(eventId);
            }
        }
        // Clean up old verdicts
        for (const [verdictId, verdict] of this.verdicts.entries()) {
            if (verdict.timestamp < cutoffTime) {
                this.verdicts.delete(verdictId);
            }
        }
        // Clean up old evidence
        for (const [evidenceId, evidence] of this.evidence.entries()) {
            if (evidence.timestamp < cutoffTime) {
                this.evidence.delete(evidenceId);
            }
        }
        // Clean up old Shield decisions
        for (const [decisionId, decision] of this.shieldDecisions.entries()) {
            if (decision.timestamp < cutoffTime) {
                this.shieldDecisions.delete(decisionId);
            }
        }
        // Clean up old audit events
        for (const [auditId, auditEvent] of this.auditEvents.entries()) {
            if (auditEvent.timestamp < cutoffTime) {
                this.auditEvents.delete(auditId);
            }
        }
    }
    // Emit GuardEvent
    emitGuardEvent(event) {
        exports.sentinelEvents.emit('guardEvent', event);
    }
}
exports.sentinelTelemetry = new SentinelTelemetry();
//# sourceMappingURL=telemetry.js.map