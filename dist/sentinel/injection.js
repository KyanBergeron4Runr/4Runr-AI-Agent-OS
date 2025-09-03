"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectionDetector = exports.InjectionDetector = void 0;
const config_1 = require("./config");
const telemetry_1 = require("./telemetry");
class InjectionDetector {
    constructor() {
        this.config = config_1.sentinelConfig.getFeatureConfig('injection');
    }
    /**
     * Check for prompt injection attempts in input
     */
    checkForInjection(correlationId, agentId, spanId, input) {
        if (!(0, config_1.isInjectionEnabled)()) {
            return null;
        }
        const inputText = this.extractText(input);
        if (!inputText) {
            return null;
        }
        const patterns = this.config.patterns;
        const detectedPatterns = [];
        const details = {};
        // Check for suspicious patterns
        for (const pattern of patterns) {
            if (inputText.toLowerCase().includes(pattern.toLowerCase())) {
                detectedPatterns.push(pattern);
            }
        }
        // Check for encoded/masked content
        const encodedContent = this.checkForEncodedContent(inputText);
        if (encodedContent.detected) {
            detectedPatterns.push(...encodedContent.patterns);
            details.encodedContent = encodedContent;
        }
        // Check for hidden text
        const hiddenText = this.checkForHiddenText(inputText);
        if (hiddenText.detected) {
            detectedPatterns.push(...hiddenText.patterns);
            details.hiddenText = hiddenText;
        }
        // Check for role manipulation attempts
        const roleManipulation = this.checkForRoleManipulation(inputText);
        if (roleManipulation.detected) {
            detectedPatterns.push(...roleManipulation.patterns);
            details.roleManipulation = roleManipulation;
        }
        if (detectedPatterns.length === 0) {
            return null;
        }
        // Calculate severity and confidence
        const severity = this.calculateSeverity(detectedPatterns, encodedContent, hiddenText, roleManipulation);
        const confidence = this.calculateConfidence(detectedPatterns, encodedContent, hiddenText, roleManipulation);
        // Determine action based on config and severity
        const action = this.determineAction(severity, confidence);
        // Sanitize input if needed
        let sanitizedInput = input;
        if (action === 'mask' || action === 'block') {
            sanitizedInput = this.sanitizeInput(input, detectedPatterns);
        }
        const check = {
            detected: true,
            severity,
            patterns: detectedPatterns,
            confidence,
            details,
            action,
            sanitizedInput: action !== 'flag' ? sanitizedInput : undefined
        };
        // Create safety event
        telemetry_1.sentinelTelemetry.createEvent(correlationId, agentId, spanId, 'injection', severity, {
            patterns: detectedPatterns,
            confidence,
            details,
            action,
            inputLength: inputText.length,
            inputType: typeof input
        });
        return check;
    }
    /**
     * Check for encoded/masked content (Base64, hex, etc.)
     */
    checkForEncodedContent(text) {
        const patterns = [];
        const details = {};
        // Base64 detection
        const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
        const base64Matches = text.match(base64Pattern);
        if (base64Matches && base64Matches.length > 0) {
            patterns.push('Base64 encoded content');
            details.base64Matches = base64Matches.length;
            details.base64Samples = base64Matches.slice(0, 3);
        }
        // Hex detection
        const hexPattern = /[0-9a-fA-F]{16,}/g;
        const hexMatches = text.match(hexPattern);
        if (hexMatches && hexMatches.length > 0) {
            patterns.push('Hex encoded content');
            details.hexMatches = hexMatches.length;
            details.hexSamples = hexMatches.slice(0, 3);
        }
        // URL encoding detection
        const urlEncodedPattern = /%[0-9a-fA-F]{2}/g;
        const urlEncodedMatches = text.match(urlEncodedPattern);
        if (urlEncodedMatches && urlEncodedMatches.length > 5) {
            patterns.push('URL encoded content');
            details.urlEncodedMatches = urlEncodedMatches.length;
        }
        return {
            detected: patterns.length > 0,
            patterns,
            details
        };
    }
    /**
     * Check for hidden text (zero-width characters, etc.)
     */
    checkForHiddenText(text) {
        const patterns = [];
        const details = {};
        // Zero-width characters
        const zeroWidthPattern = /[\u200B-\u200D\uFEFF]/g;
        const zeroWidthMatches = text.match(zeroWidthPattern);
        if (zeroWidthMatches && zeroWidthMatches.length > 0) {
            patterns.push('Zero-width characters');
            details.zeroWidthCount = zeroWidthMatches.length;
        }
        // Invisible Unicode characters
        const invisiblePattern = /[\u0000-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g;
        const invisibleMatches = text.match(invisiblePattern);
        if (invisibleMatches && invisibleMatches.length > 0) {
            patterns.push('Invisible Unicode characters');
            details.invisibleCount = invisibleMatches.length;
        }
        // Right-to-left override
        if (text.includes('\u202E') || text.includes('\u202D')) {
            patterns.push('Text direction override');
            details.hasDirectionOverride = true;
        }
        return {
            detected: patterns.length > 0,
            patterns,
            details
        };
    }
    /**
     * Check for role manipulation attempts
     */
    checkForRoleManipulation(text) {
        const patterns = [];
        const details = {};
        const lowerText = text.toLowerCase();
        // Role switching patterns
        const rolePatterns = [
            'you are now',
            'you have become',
            'act as',
            'pretend to be',
            'roleplay as',
            'you are a',
            'you are an',
            'you work for',
            'you represent',
            'you are employed by'
        ];
        for (const pattern of rolePatterns) {
            if (lowerText.includes(pattern)) {
                patterns.push(`Role manipulation: ${pattern}`);
            }
        }
        // System prompt injection
        if (lowerText.includes('system:') || lowerText.includes('system prompt:')) {
            patterns.push('System prompt injection');
        }
        // Assistant/user role confusion
        if (lowerText.includes('assistant:') || lowerText.includes('user:')) {
            patterns.push('Role confusion attempt');
        }
        details.rolePatternCount = patterns.length;
        return {
            detected: patterns.length > 0,
            patterns,
            details
        };
    }
    /**
     * Calculate severity based on detected patterns
     */
    calculateSeverity(patterns, encodedContent, hiddenText, roleManipulation) {
        let score = 0;
        // Basic pattern scoring
        score += patterns.length * 2;
        // Encoded content is high risk
        if (encodedContent.detected) {
            score += encodedContent.patterns.length * 5;
        }
        // Hidden text is high risk
        if (hiddenText.detected) {
            score += hiddenText.patterns.length * 5;
        }
        // Role manipulation is medium risk
        if (roleManipulation.detected) {
            score += roleManipulation.patterns.length * 3;
        }
        // Sensitivity adjustment
        const sensitivity = this.config.sensitivity;
        const sensitivityMultiplier = sensitivity === 'high' ? 1.5 : sensitivity === 'medium' ? 1.0 : 0.5;
        score *= sensitivityMultiplier;
        if (score >= 20)
            return 'high';
        if (score >= 10)
            return 'medium';
        return 'low';
    }
    /**
     * Calculate confidence in the injection detection
     */
    calculateConfidence(patterns, encodedContent, hiddenText, roleManipulation) {
        let confidence = 0;
        // Pattern confidence
        confidence += patterns.length * 0.15;
        // Encoded content confidence
        if (encodedContent.detected) {
            confidence += encodedContent.patterns.length * 0.3;
        }
        // Hidden text confidence
        if (hiddenText.detected) {
            confidence += hiddenText.patterns.length * 0.3;
        }
        // Role manipulation confidence
        if (roleManipulation.detected) {
            confidence += roleManipulation.patterns.length * 0.2;
        }
        // Cap at 1.0
        return Math.min(confidence, 1.0);
    }
    /**
     * Determine action based on severity, confidence, and config
     */
    determineAction(severity, confidence) {
        const configAction = this.config.action;
        // If config is set to block, use it
        if (configAction === 'block') {
            return 'block';
        }
        // High severity with high confidence -> block
        if (severity === 'high' && confidence > 0.7) {
            return 'block';
        }
        // High severity with medium confidence -> require approval
        if (severity === 'high' && confidence > 0.4) {
            return 'require_approval';
        }
        // Medium severity -> mask
        if (severity === 'medium') {
            return 'mask';
        }
        // Default to flag
        return 'flag';
    }
    /**
     * Sanitize input by removing or masking suspicious content
     */
    sanitizeInput(input, detectedPatterns) {
        if (typeof input === 'string') {
            let sanitized = input;
            // Remove detected patterns
            for (const pattern of detectedPatterns) {
                const regex = new RegExp(pattern, 'gi');
                sanitized = sanitized.replace(regex, '[REDACTED]');
            }
            // Remove encoded content
            sanitized = sanitized.replace(/[A-Za-z0-9+/]{20,}={0,2}/g, '[BASE64_REDACTED]');
            sanitized = sanitized.replace(/[0-9a-fA-F]{16,}/g, '[HEX_REDACTED]');
            sanitized = sanitized.replace(/%[0-9a-fA-F]{2}/g, '[URL_ENCODED_REDACTED]');
            // Remove zero-width and invisible characters
            sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
            sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '');
            return sanitized;
        }
        if (typeof input === 'object' && input !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitizeInput(value, detectedPatterns);
            }
            return sanitized;
        }
        return input;
    }
    /**
     * Extract text from various input formats
     */
    extractText(data) {
        if (typeof data === 'string') {
            return data;
        }
        if (typeof data === 'object' && data !== null) {
            // Check common fields that might contain text
            const textFields = ['text', 'content', 'message', 'prompt', 'input', 'query', 'question'];
            for (const field of textFields) {
                if (data[field] && typeof data[field] === 'string') {
                    return data[field];
                }
            }
            // If it's an array, try to extract text from first item
            if (Array.isArray(data) && data.length > 0) {
                return this.extractText(data[0]);
            }
            // Try to stringify and extract meaningful text
            try {
                const stringified = JSON.stringify(data);
                if (stringified.length > 50) {
                    return stringified;
                }
            }
            catch (error) {
                // Ignore stringification errors
            }
        }
        return null;
    }
}
exports.InjectionDetector = InjectionDetector;
// Singleton instance
exports.injectionDetector = new InjectionDetector();
//# sourceMappingURL=injection.js.map