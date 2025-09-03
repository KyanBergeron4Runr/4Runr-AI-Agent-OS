import { Verdict, Evidence } from './types';
export interface JudgeResult {
    verdict: Verdict;
    guardEventEmitted: boolean;
}
export declare class Judge {
    private config;
    /**
     * Judge an output span for groundedness and citation coverage
     */
    judgeOutput(correlationId: string, agentId: string, spanId: string, outputText: string | null, evidence: Evidence[], promptMetadata?: Record<string, any>): Promise<JudgeResult>;
    /**
     * Segment text into sentences
     */
    private segmentSentences;
    /**
     * Sample sentences for judging
     */
    private sampleSentences;
    /**
     * Filter evidence by age and relevance
     */
    private filterRelevantEvidence;
    /**
     * Judge a single sentence against evidence
     */
    private judgeSentence;
    /**
     * Calculate support score for a sentence against evidence
     */
    private calculateSupportScore;
    /**
     * Calculate overall groundedness score
     */
    private calculateGroundedness;
    /**
     * Calculate citation coverage
     */
    private calculateCitationCoverage;
    /**
     * Determine decision based on groundedness and context
     */
    private determineDecision;
    /**
     * Create default verdict when judge is disabled
     */
    private createDefaultVerdict;
    /**
     * Create hash-only verdict
     */
    private createHashOnlyVerdict;
    /**
     * Create error verdict
     */
    private createErrorVerdict;
    /**
     * Emit low groundedness GuardEvent
     */
    private emitLowGroundednessEvent;
    /**
     * Emit verdict created GuardEvent
     */
    private emitVerdictCreatedEvent;
}
export declare const judge: Judge;
//# sourceMappingURL=judge.d.ts.map