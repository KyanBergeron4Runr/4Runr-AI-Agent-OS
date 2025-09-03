"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentinelMiddleware = void 0;
const telemetry_1 = require("./telemetry");
const injection_1 = require("./injection");
const hallucination_1 = require("./hallucination");
const judge_1 = require("./judge");
const shield_1 = require("./shield");
const config_1 = require("./config");
class SentinelMiddleware {
    /**
     * Start monitoring a request
     */
    static startMonitoring(correlationId, agentId, tool, action, params) {
        if (!(0, config_1.isTelemetryEnabled)()) {
            return null;
        }
        const startTime = Date.now();
        const spanId = telemetry_1.sentinelTelemetry.startSpan(correlationId, agentId, tool, action, 'tool_call', params);
        // Check for injection attempts
        const injectionCheck = injection_1.injectionDetector.checkForInjection(correlationId, agentId, spanId, params);
        if (injectionCheck) {
            console.warn(`Potential injection detected: ${injectionCheck.patterns.join(', ')}`);
        }
        return {
            correlationId,
            agentId,
            tool,
            action,
            spanId,
            startTime,
            evidence: []
        };
    }
    /**
     * End monitoring and perform safety checks
     */
    static async endMonitoring(context, result, error) {
        if (!context || !(0, config_1.isTelemetryEnabled)()) {
            return { shouldBlock: false };
        }
        // End the span
        telemetry_1.sentinelTelemetry.endSpan(context.spanId, result, error);
        if (error) {
            return { shouldBlock: false };
        }
        // Check for hallucinations
        const hallucinationCheck = hallucination_1.hallucinationDetector.checkForHallucination(context.correlationId, context.agentId, context.spanId, { tool: context.tool, action: context.action }, result);
        if (hallucinationCheck) {
            console.warn(`Potential hallucination detected: ${hallucinationCheck.patterns.join(', ')}`);
        }
        // Judge the output for groundedness and citation coverage
        const judgeResult = await this.judgeOutput(context, result);
        // Get all events for this correlation ID
        const telemetryData = telemetry_1.sentinelTelemetry.getTelemetryData(context.correlationId);
        const events = telemetryData.events;
        // Apply Shield enforcement
        const shieldResult = await this.applyShieldEnforcement(context, result, events, judgeResult.verdict);
        // Record performance metrics if available
        if (result && typeof result === 'object' && result.usage) {
            telemetry_1.sentinelTelemetry.recordPerformance(context.spanId, {
                tokenUsage: {
                    input: result.usage.prompt_tokens || 0,
                    output: result.usage.completion_tokens || 0,
                    total: result.usage.total_tokens || 0
                }
            });
        }
        return {
            shouldBlock: shieldResult.shouldBlock,
            sanitizedOutput: shieldResult.sanitizedOutput,
            error: shieldResult.error
        };
    }
    /**
     * Store evidence for Judge evaluation
     */
    static storeEvidence(context, sourceId, url, content) {
        if (!context || !(0, config_1.isTelemetryEnabled)()) {
            return;
        }
        const evidence = {
            id: crypto_1.default.randomUUID(),
            correlationId: context.correlationId,
            spanId: context.spanId,
            sourceId,
            url,
            content,
            contentHash: crypto_1.default.createHash('sha256').update(content).digest('hex'),
            timestamp: Date.now(),
            metadata: {}
        };
        context.evidence.push(evidence);
        telemetry_1.sentinelTelemetry.storeEvidence(evidence);
    }
    /**
     * Judge the output for groundedness
     */
    static async judgeOutput(context, result) {
        const outputText = this.extractOutputText(result);
        const hasExternalAction = this.hasExternalAction(context.tool, context.action);
        const promptMetadata = {
            tool: context.tool,
            action: context.action,
            hasExternalAction,
            temperature: result?.usage?.temperature || 0.7
        };
        return await judge_1.judge.judgeOutput(context.correlationId, context.agentId, context.spanId, outputText, context.evidence, promptMetadata);
    }
    /**
     * Apply Shield enforcement
     */
    static async applyShieldEnforcement(context, result, events, verdict) {
        const metadata = {
            hasExternalAction: this.hasExternalAction(context.tool, context.action),
            tool: context.tool,
            action: context.action
        };
        const shieldResult = await shield_1.shield.evaluateOutput(context.correlationId, context.agentId, context.spanId, result, events, verdict, metadata);
        return {
            shouldBlock: shieldResult.shouldBlock,
            sanitizedOutput: shieldResult.sanitizedOutput,
            error: shieldResult.error
        };
    }
    /**
     * Extract output text from result
     */
    static extractOutputText(result) {
        if (!result)
            return null;
        // Handle different result formats
        if (typeof result === 'string') {
            return result;
        }
        if (result.choices && result.choices[0] && result.choices[0].message) {
            return result.choices[0].message.content;
        }
        if (result.content) {
            return result.content;
        }
        if (result.text) {
            return result.text;
        }
        if (result.output) {
            return result.output;
        }
        return null;
    }
    /**
     * Check if this is an external action
     */
    static hasExternalAction(tool, action) {
        const externalTools = ['gmail_send', 'http_fetch', 'file_write', 'webhook'];
        const externalActions = ['send', 'post', 'put', 'delete', 'write'];
        return externalTools.includes(tool) || externalActions.includes(action);
    }
}
exports.SentinelMiddleware = SentinelMiddleware;
// Import crypto for UUID generation
const crypto_1 = __importDefault(require("crypto"));
//# sourceMappingURL=middleware.js.map