export interface InjectionCheck {
    detected: boolean;
    severity: 'low' | 'medium' | 'high';
    patterns: string[];
    confidence: number;
    details: Record<string, any>;
    action: 'flag' | 'block' | 'mask' | 'require_approval';
    sanitizedInput?: any;
}
export declare class InjectionDetector {
    private config;
    /**
     * Check for prompt injection attempts in input
     */
    checkForInjection(correlationId: string, agentId: string, spanId: string, input: any): InjectionCheck | null;
    /**
     * Check for encoded/masked content (Base64, hex, etc.)
     */
    private checkForEncodedContent;
    /**
     * Check for hidden text (zero-width characters, etc.)
     */
    private checkForHiddenText;
    /**
     * Check for role manipulation attempts
     */
    private checkForRoleManipulation;
    /**
     * Calculate severity based on detected patterns
     */
    private calculateSeverity;
    /**
     * Calculate confidence in the injection detection
     */
    private calculateConfidence;
    /**
     * Determine action based on severity, confidence, and config
     */
    private determineAction;
    /**
     * Sanitize input by removing or masking suspicious content
     */
    private sanitizeInput;
    /**
     * Extract text from various input formats
     */
    private extractText;
}
export declare const injectionDetector: InjectionDetector;
//# sourceMappingURL=injection.d.ts.map