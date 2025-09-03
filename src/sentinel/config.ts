import { SentinelConfig } from './types'
import fs from 'fs'
import path from 'path'

const DEFAULT_CONFIG: SentinelConfig = {
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
}

class SentinelConfigManager {
  private config: SentinelConfig
  private configPath: string
  private shieldConfigPath: string

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'sentinel.json')
    this.shieldConfigPath = path.join(process.cwd(), 'config', 'shield.json')
    this.config = this.loadConfig()
  }

  private loadConfig(): SentinelConfig {
    try {
      // Load main sentinel config
      let fileConfig = {}
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8')
        fileConfig = JSON.parse(configData)
      }

      // Load shield config
      let shieldConfig = {}
      if (fs.existsSync(this.shieldConfigPath)) {
        const shieldData = fs.readFileSync(this.shieldConfigPath, 'utf8')
        shieldConfig = JSON.parse(shieldData)
      }

      // Merge configurations
      const mergedConfig = this.mergeConfigs(DEFAULT_CONFIG, fileConfig)
      if (shieldConfig) {
        mergedConfig.shield = this.mergeConfigs(mergedConfig.shield, shieldConfig)
      }

      return mergedConfig
    } catch (error) {
      console.error('Error loading Sentinel config:', error)
      return DEFAULT_CONFIG
    }
  }

  private mergeConfigs(defaultConfig: any, fileConfig: any): any {
    const merged = { ...defaultConfig }
    
    for (const [key, value] of Object.entries(fileConfig)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        merged[key] = this.mergeConfigs(merged[key] || {}, value)
      } else {
        merged[key] = value
      }
    }
    
    return merged
  }

  public getConfig(): SentinelConfig {
    return this.config
  }

  public getFeatureConfig(feature: keyof SentinelConfig): any {
    return this.config[feature]
  }

  public isFeatureEnabled(feature: keyof SentinelConfig): boolean {
    const featureConfig = this.config[feature]
    return featureConfig && featureConfig.enabled === true
  }

  public updateConfig(newConfig: Partial<SentinelConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  public reloadConfig(): void {
    this.config = this.loadConfig()
  }
}

// Singleton instance
const sentinelConfig = new SentinelConfigManager()

export { sentinelConfig }

// Helper functions
export const isTelemetryEnabled = () => sentinelConfig.isFeatureEnabled('telemetry')
export const isHallucinationEnabled = () => sentinelConfig.isFeatureEnabled('hallucination')
export const isInjectionEnabled = () => sentinelConfig.isFeatureEnabled('injection')
export const isPIIEnabled = () => sentinelConfig.isFeatureEnabled('pii')
export const isCostEnabled = () => sentinelConfig.isFeatureEnabled('cost')
export const isLatencyEnabled = () => sentinelConfig.isFeatureEnabled('latency')
export const isJudgeEnabled = () => sentinelConfig.isFeatureEnabled('judge')
export const isShieldEnabled = () => sentinelConfig.isFeatureEnabled('shield')
