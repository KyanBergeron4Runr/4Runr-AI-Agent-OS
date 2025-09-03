"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isShieldEnabled = exports.isJudgeEnabled = exports.isLatencyEnabled = exports.isCostEnabled = exports.isPIIEnabled = exports.isInjectionEnabled = exports.isHallucinationEnabled = exports.isTelemetryEnabled = exports.sentinelConfig = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_CONFIG = {
    telemetry: {
        enabled: true,
        privacyMode: 'plaintext',
        retentionDays: 30
    },
    hallucination: {
        enabled: true,
        sensitivity: 'medium',
        patterns: [
            "I can't verify",
            "I don't have access to",
            "I cannot confirm",
            "I'm not sure",
            "I don't know"
        ]
    },
    injection: {
        enabled: true,
        sensitivity: 'high',
        patterns: [
            "ignore previous instructions",
            "you are now",
            "forget everything",
            "disregard all",
            "ignore all above",
            "pretend to be"
        ],
        action: 'flag'
    },
    pii: {
        enabled: true,
        sensitivity: 'high',
        patterns: [
            "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
            "\\b\\d{3}-\\d{2}-\\d{4}\\b",
            "\\b\\d{10,11}\\b"
        ],
        action: 'mask'
    },
    cost: {
        enabled: true,
        maxTokensPerRequest: 10000,
        maxCostPerRequest: 1.00,
        action: 'flag'
    },
    latency: {
        enabled: true,
        maxLatencyMs: 30000,
        action: 'flag'
    },
    judge: {
        enabled: true,
        sampleN: 6,
        citationMin: 0.6,
        lowThreshold: 0.7,
        privacyDefaultGroundedness: 0.5,
        latencyBudgetMs: 300,
        evidenceCandidates: 3,
        maxEvidenceAge: 300000
    },
    shield: {
        enabled: true,
        mode: 'enforce',
        defaultAction: 'block',
        policies: [],
        actions: {
            block: {
                description: "Completely block the output",
                response: {
                    error: "Output blocked by Shield policy",
                    code: "SHIELD_BLOCKED",
                    policyId: null
                }
            },
            mask: {
                description: "Redact unsafe content",
                patterns: {
                    pii: "***REDACTED***",
                    hallucination: "[UNVERIFIED]",
                    injection: "[BLOCKED]"
                }
            },
            rewrite: {
                description: "Request agent self-correction",
                maxAttempts: 2,
                correctionPrompt: "Please correct the following output to be more accurate and grounded in the provided evidence:"
            },
            pass: {
                description: "Allow output through unchanged"
            }
        },
        audit: {
            enabled: true,
            logOriginalOutput: false,
            logSanitizedOutput: true,
            retentionDays: 30
        },
        performance: {
            maxLatencyMs: 200,
            timeoutMs: 150,
            cacheSize: 1000
        }
    }
};
class SentinelConfigManager {
    constructor() {
        this.configPath = path_1.default.join(process.cwd(), 'config', 'sentinel.json');
        this.shieldConfigPath = path_1.default.join(process.cwd(), 'config', 'shield.json');
        this.config = this.loadConfig();
    }
    loadConfig() {
        try {
            // Load main sentinel config
            let fileConfig = {};
            if (fs_1.default.existsSync(this.configPath)) {
                const configData = fs_1.default.readFileSync(this.configPath, 'utf8');
                fileConfig = JSON.parse(configData);
            }
            // Load shield config
            let shieldConfig = {};
            if (fs_1.default.existsSync(this.shieldConfigPath)) {
                const shieldData = fs_1.default.readFileSync(this.shieldConfigPath, 'utf8');
                shieldConfig = JSON.parse(shieldData);
            }
            // Merge configurations
            const mergedConfig = this.mergeConfigs(DEFAULT_CONFIG, fileConfig);
            if (shieldConfig) {
                mergedConfig.shield = this.mergeConfigs(mergedConfig.shield, shieldConfig);
            }
            return mergedConfig;
        }
        catch (error) {
            console.error('Error loading Sentinel config:', error);
            return DEFAULT_CONFIG;
        }
    }
    mergeConfigs(defaultConfig, fileConfig) {
        const merged = { ...defaultConfig };
        for (const [key, value] of Object.entries(fileConfig)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                merged[key] = this.mergeConfigs(merged[key] || {}, value);
            }
            else {
                merged[key] = value;
            }
        }
        return merged;
    }
    getConfig() {
        return this.config;
    }
    getFeatureConfig(feature) {
        return this.config[feature];
    }
    isFeatureEnabled(feature) {
        const featureConfig = this.config[feature];
        return featureConfig && featureConfig.enabled === true;
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    reloadConfig() {
        this.config = this.loadConfig();
    }
}
// Singleton instance
const sentinelConfig = new SentinelConfigManager();
exports.sentinelConfig = sentinelConfig;
// Helper functions
const isTelemetryEnabled = () => sentinelConfig.isFeatureEnabled('telemetry');
exports.isTelemetryEnabled = isTelemetryEnabled;
const isHallucinationEnabled = () => sentinelConfig.isFeatureEnabled('hallucination');
exports.isHallucinationEnabled = isHallucinationEnabled;
const isInjectionEnabled = () => sentinelConfig.isFeatureEnabled('injection');
exports.isInjectionEnabled = isInjectionEnabled;
const isPIIEnabled = () => sentinelConfig.isFeatureEnabled('pii');
exports.isPIIEnabled = isPIIEnabled;
const isCostEnabled = () => sentinelConfig.isFeatureEnabled('cost');
exports.isCostEnabled = isCostEnabled;
const isLatencyEnabled = () => sentinelConfig.isFeatureEnabled('latency');
exports.isLatencyEnabled = isLatencyEnabled;
const isJudgeEnabled = () => sentinelConfig.isFeatureEnabled('judge');
exports.isJudgeEnabled = isJudgeEnabled;
const isShieldEnabled = () => sentinelConfig.isFeatureEnabled('shield');
exports.isShieldEnabled = isShieldEnabled;
//# sourceMappingURL=config.js.map