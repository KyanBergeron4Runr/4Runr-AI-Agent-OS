import { SentinelSpan, SentinelEvent, Verdict, Evidence, GuardEvent, PerformanceMetrics, ShieldDecision, AuditEvent } from './types';
import { EventEmitter } from 'events';
export declare const sentinelEvents: EventEmitter<[never]>;
declare class SentinelTelemetry {
    private spans;
    private events;
    private verdicts;
    private evidence;
    private shieldDecisions;
    private auditEvents;
    private activeSpans;
    private performanceMetrics;
    constructor();
    startSpan(correlationId: string, agentId: string, tool: string, action: string, type: SentinelSpan['type'], input?: any, parentSpanId?: string): string;
    endSpan(spanId: string, output?: any, error?: Error): void;
    recordPerformance(spanId: string, metrics: Partial<PerformanceMetrics>): void;
    createEvent(correlationId: string, agentId: string, spanId: string, type: SentinelEvent['type'], severity: SentinelEvent['severity'], details: Record<string, any>, action?: SentinelEvent['action']): string;
    resolveEvent(eventId: string, resolvedBy: string): void;
    storeVerdict(verdict: Verdict): void;
    storeEvidence(evidence: Evidence): void;
    storeShieldDecision(decision: ShieldDecision): void;
    storeAuditEvent(auditEvent: AuditEvent): void;
    getTelemetryData(correlationId: string): {
        spans: SentinelSpan[];
        events: SentinelEvent[];
        verdicts: Verdict[];
        evidence: Evidence[];
        shieldDecisions: ShieldDecision[];
        auditEvents: AuditEvent[];
        metrics: {
            totalSpans: number;
            totalEvents: number;
            totalVerdicts: number;
            totalShieldDecisions: number;
            totalAuditEvents: number;
            avgLatency: number;
            totalTokenUsage: number;
            flaggedHallucinations: number;
            flaggedInjections: number;
            flaggedPII: number;
            lowGroundednessCount: number;
            judgeErrors: number;
            blockedOutputs: number;
            maskedOutputs: number;
            rewrittenOutputs: number;
        };
    };
    getAllTelemetryData(): {
        spans: SentinelSpan[];
        events: SentinelEvent[];
        verdicts: Verdict[];
        evidence: Evidence[];
        shieldDecisions: ShieldDecision[];
        auditEvents: AuditEvent[];
        metrics: {
            totalSpans: number;
            totalEvents: number;
            totalVerdicts: number;
            totalShieldDecisions: number;
            totalAuditEvents: number;
            avgLatency: number;
            totalTokenUsage: number;
            flaggedHallucinations: number;
            flaggedInjections: number;
            flaggedPII: number;
            lowGroundednessCount: number;
            judgeErrors: number;
            blockedOutputs: number;
            maskedOutputs: number;
            rewrittenOutputs: number;
        };
    };
    cleanup(): void;
    emitGuardEvent(event: GuardEvent): void;
}
export declare const sentinelTelemetry: SentinelTelemetry;
export {};
//# sourceMappingURL=telemetry.d.ts.map