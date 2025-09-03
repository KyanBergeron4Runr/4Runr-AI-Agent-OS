"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.judge = exports.Judge = void 0;
const config_1 = require("./config");
const telemetry_1 = require("./telemetry");
const crypto_1 = __importDefault(require("crypto"));
class Judge {
    constructor() {
        this.config = config_1.sentinelConfig.getFeatureConfig('judge');
    }
    /**
     * Judge an output span for groundedness and citation coverage
     */
    async judgeOutput(correlationId, agentId, spanId, outputText, evidence, promptMetadata) {
        if (!(0, config_1.isJudgeEnabled)()) {
            return this.createDefaultVerdict(correlationId, agentId, spanId, 'judge_disabled');
        }
        const startTime = Date.now();
        const verdictId = crypto_1.default.randomUUID();
        let guardEventEmitted = false;
        try {
            // Check if we're in hash-only mode
            const isHashOnly = !outputText || outputText.length === 0;
            if (isHashOnly) {
                return this.createHashOnlyVerdict(correlationId, agentId, spanId, verdictId, startTime);
            }
            // Filter evidence by age and relevance
            const relevantEvidence = this.filterRelevantEvidence(evidence, startTime);
            // Segment output into sentences
            const sentences = this.segmentSentences(outputText);
            // Sample sentences for judging
            const sampledIndices = this.sampleSentences(sentences, this.config.sampleN);
            const sampledSentences = sampledIndices.map(i => ({
                index: i,
                text: sentences[i]
            }));
            // Judge each sampled sentence
            const sentenceSupports = [];
            const penalties = [];
            for (const { index, text } of sampledSentences) {
                const support = this.judgeSentence(text, relevantEvidence, index);
                sentenceSupports.push(support);
            }
            // Apply soft penalties
            if (promptMetadata?.temperature && promptMetadata.temperature > 0.8) {
                penalties.push('high_temperature');
            }
            if (promptMetadata?.contextLength && promptMetadata.contextLength < 100) {
                penalties.push('short_context');
            }
            // Calculate groundedness and citation coverage
            const groundedness = this.calculateGroundedness(sentenceSupports, penalties);
            const citationCoverage = this.calculateCitationCoverage(sentenceSupports);
            // Determine decision
            const decision = this.determineDecision(groundedness, promptMetadata);
            // Create verdict
            const verdict = {
                id: verdictId,
                correlationId,
                spanId,
                agentId,
                timestamp: startTime,
                groundedness,
                citationCoverage,
                decision,
                metadata: {
                    mode: 'plaintext',
                    sampledSentenceIndices: sampledIndices,
                    totalSentences: sentences.length,
                    sampledSentences: sampledSentences.length,
                    evidenceCount: relevantEvidence.length,
                    penalties,
                    latencyMs: Date.now() - startTime
                },
                sentenceSupports
            };
            // Check if we need to emit a GuardEvent
            if (groundedness < this.config.lowThreshold) {
                this.emitLowGroundednessEvent(correlationId, agentId, spanId, verdict);
                guardEventEmitted = true;
            }
            // Store verdict in telemetry
            telemetry_1.sentinelTelemetry.storeVerdict(verdict);
            // Emit verdict created event
            this.emitVerdictCreatedEvent(verdict);
            return { verdict, guardEventEmitted };
        }
        catch (error) {
            console.error('Judge error:', error);
            return this.createErrorVerdict(correlationId, agentId, spanId, verdictId, startTime, error);
        }
    }
    /**
     * Segment text into sentences
     */
    segmentSentences(text) {
        // Basic punctuation-based segmentation
        const sentences = text
            .replace(/([.!?])\s*(?=[A-Z])/g, '$1|')
            .split('|')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        return sentences;
    }
    /**
     * Sample sentences for judging
     */
    sampleSentences(sentences, sampleN) {
        if (sentences.length <= sampleN) {
            return Array.from({ length: sentences.length }, (_, i) => i);
        }
        // First 3 + 3 longest
        const firstThree = [0, 1, 2].filter(i => i < sentences.length);
        const remaining = Array.from({ length: sentences.length }, (_, i) => i)
            .filter(i => i >= 3)
            .sort((a, b) => sentences[b].length - sentences[a].length)
            .slice(0, 3);
        return [...firstThree, ...remaining].slice(0, sampleN);
    }
    /**
     * Filter evidence by age and relevance
     */
    filterRelevantEvidence(evidence, currentTime) {
        return evidence
            .filter(e => currentTime - e.timestamp <= this.config.maxEvidenceAge)
            .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
            .slice(0, 20); // Limit to last 20 items
    }
    /**
     * Judge a single sentence against evidence
     */
    judgeSentence(sentence, evidence, sentenceIndex) {
        const candidates = evidence.slice(0, this.config.evidenceCandidates);
        let bestScore = 0;
        let bestCandidates = [];
        let bestDetails = {
            exactPhraseOverlap: 0,
            namedEntityOverlap: 0,
            numericMatch: 0,
            penalties: []
        };
        for (const candidate of candidates) {
            const details = this.calculateSupportScore(sentence, candidate.content);
            const totalScore = Math.max(details.exactPhraseOverlap, details.namedEntityOverlap, details.numericMatch);
            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestCandidates = [candidate];
                bestDetails = details;
            }
        }
        return {
            sentenceIndex,
            sentenceText: sentence,
            supportScore: bestScore,
            evidenceCandidates: bestCandidates,
            details: bestDetails
        };
    }
    /**
     * Calculate support score for a sentence against evidence
     */
    calculateSupportScore(sentence, evidence) {
        const sentenceLower = sentence.toLowerCase();
        const evidenceLower = evidence.toLowerCase();
        const penalties = [];
        // Exact phrase overlap (normalized)
        const sentenceWords = sentenceLower.split(/\s+/).filter(w => w.length > 2);
        const evidenceWords = evidenceLower.split(/\s+/).filter(w => w.length > 2);
        const commonWords = sentenceWords.filter(word => evidenceWords.includes(word));
        const exactPhraseOverlap = sentenceWords.length > 0 ? commonWords.length / sentenceWords.length : 0;
        // Named entity overlap (simplified - look for capitalized words)
        const sentenceEntities = sentence.match(/\b[A-Z][a-z]+\b/g) || [];
        const evidenceEntities = evidence.match(/\b[A-Z][a-z]+\b/g) || [];
        const commonEntities = sentenceEntities.filter(entity => evidenceEntities.some(e => e.toLowerCase() === entity.toLowerCase()));
        const namedEntityOverlap = sentenceEntities.length > 0 ? commonEntities.length / sentenceEntities.length : 0;
        // Numeric match
        const sentenceNumbers = sentence.match(/\d+(?:\.\d+)?/g) || [];
        const evidenceNumbers = evidence.match(/\d+(?:\.\d+)?/g) || [];
        const commonNumbers = sentenceNumbers.filter(num => evidenceNumbers.some(evidenceNum => evidenceNum === num));
        const numericMatch = sentenceNumbers.length > 0 ? commonNumbers.length / sentenceNumbers.length : 0;
        return {
            exactPhraseOverlap,
            namedEntityOverlap,
            numericMatch,
            penalties
        };
    }
    /**
     * Calculate overall groundedness score
     */
    calculateGroundedness(sentenceSupports, penalties) {
        if (sentenceSupports.length === 0)
            return 0;
        const avgSupport = sentenceSupports.reduce((sum, s) => sum + s.supportScore, 0) / sentenceSupports.length;
        // Apply penalties
        let groundedness = avgSupport;
        if (penalties.includes('high_temperature')) {
            groundedness = Math.max(0, groundedness - 0.05);
        }
        if (penalties.includes('short_context')) {
            groundedness = Math.max(0, groundedness - 0.05);
        }
        return Math.max(0, Math.min(1, groundedness));
    }
    /**
     * Calculate citation coverage
     */
    calculateCitationCoverage(sentenceSupports) {
        if (sentenceSupports.length === 0)
            return 0;
        const wellSupported = sentenceSupports.filter(s => s.supportScore >= this.config.citationMin).length;
        return wellSupported / sentenceSupports.length;
    }
    /**
     * Determine decision based on groundedness and context
     */
    determineDecision(groundedness, promptMetadata) {
        const hasExternalAction = promptMetadata?.hasExternalAction || false;
        if (groundedness < this.config.lowThreshold && hasExternalAction) {
            return 'require_approval';
        }
        return 'allow';
    }
    /**
     * Create default verdict when judge is disabled
     */
    createDefaultVerdict(correlationId, agentId, spanId, reason) {
        const verdict = {
            id: crypto_1.default.randomUUID(),
            correlationId,
            spanId,
            agentId,
            timestamp: Date.now(),
            groundedness: 1.0,
            citationCoverage: 1.0,
            decision: 'allow',
            metadata: {
                mode: 'plaintext',
                sampledSentenceIndices: [],
                totalSentences: 0,
                sampledSentences: 0,
                evidenceCount: 0,
                penalties: [],
                latencyMs: 0,
                error: reason
            },
            sentenceSupports: []
        };
        return { verdict, guardEventEmitted: false };
    }
    /**
     * Create hash-only verdict
     */
    createHashOnlyVerdict(correlationId, agentId, spanId, verdictId, startTime) {
        const verdict = {
            id: verdictId,
            correlationId,
            spanId,
            agentId,
            timestamp: startTime,
            groundedness: this.config.privacyDefaultGroundedness,
            citationCoverage: 0,
            decision: 'allow',
            metadata: {
                mode: 'hash-only',
                sampledSentenceIndices: [],
                totalSentences: 0,
                sampledSentences: 0,
                evidenceCount: 0,
                penalties: [],
                latencyMs: Date.now() - startTime
            },
            sentenceSupports: []
        };
        telemetry_1.sentinelTelemetry.storeVerdict(verdict);
        this.emitVerdictCreatedEvent(verdict);
        return { verdict, guardEventEmitted: false };
    }
    /**
     * Create error verdict
     */
    createErrorVerdict(correlationId, agentId, spanId, verdictId, startTime, error) {
        const verdict = {
            id: verdictId,
            correlationId,
            spanId,
            agentId,
            timestamp: startTime,
            groundedness: 0.5,
            citationCoverage: 0,
            decision: 'require_approval',
            metadata: {
                mode: 'plaintext',
                sampledSentenceIndices: [],
                totalSentences: 0,
                sampledSentences: 0,
                evidenceCount: 0,
                penalties: [],
                latencyMs: Date.now() - startTime,
                error: error.message || 'Unknown error'
            },
            sentenceSupports: []
        };
        // Emit error event
        telemetry_1.sentinelTelemetry.createEvent(correlationId, agentId, spanId, 'judge_error', 'error', {
            error: error.message || 'Unknown error',
            verdictId
        }, 'flag');
        telemetry_1.sentinelTelemetry.storeVerdict(verdict);
        this.emitVerdictCreatedEvent(verdict);
        return { verdict, guardEventEmitted: true };
    }
    /**
     * Emit low groundedness GuardEvent
     */
    emitLowGroundednessEvent(correlationId, agentId, spanId, verdict) {
        telemetry_1.sentinelTelemetry.createEvent(correlationId, agentId, spanId, 'judge_low_groundedness', 'warn', {
            rule_id: 'judge.low_groundedness',
            groundedness: verdict.groundedness,
            citationCoverage: verdict.citationCoverage,
            sampledIndices: verdict.metadata.sampledSentenceIndices,
            penalties: verdict.metadata.penalties,
            decision: 'flag'
        }, 'flag');
    }
    /**
     * Emit verdict created GuardEvent
     */
    emitVerdictCreatedEvent(verdict) {
        telemetry_1.sentinelTelemetry.emitGuardEvent({
            id: crypto_1.default.randomUUID(),
            correlationId: verdict.correlationId,
            agentId: verdict.agentId,
            timestamp: verdict.timestamp,
            type: 'verdict_created',
            data: verdict
        });
    }
}
exports.Judge = Judge;
// Singleton instance
exports.judge = new Judge();
//# sourceMappingURL=judge.js.map