export interface HallucinationCheck {
    detected: boolean;
    severity: 'low' | 'medium' | 'high';
    patterns: string[];
    confidence: number;
    details: Record<string, any>;
}
export declare class HallucinationDetector {
    private config;
    /**
     * Check for potential hallucinations in text output
     */
    checkForHallucination(correlationId: string, agentId: string, spanId: string, input: any, output: any): HallucinationCheck | null;
    /**
     * Check for self-contradictory statements
     */
    private checkForContradictions;
    /**
     * Check if output drifts away from input context
     */
    private checkForContextDrift;
    /**
     * Check for factual inconsistencies
     */
    private checkForFactualInconsistencies;
    /**
     * Calculate severity based on detected patterns and issues
     */
    private calculateSeverity;
    /**
     * Calculate confidence in the hallucination detection
     */
    private calculateConfidence;
    /**
     * Extract text from various input/output formats
     */
    private extractText;
}
export declare const hallucinationDetector: HallucinationDetector;
//# sourceMappingURL=hallucination.d.ts.map