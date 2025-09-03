import { SentinelConfig } from './types';
declare class SentinelConfigManager {
    private config;
    private configPath;
    private shieldConfigPath;
    constructor();
    private loadConfig;
    private mergeConfigs;
    getConfig(): SentinelConfig;
    getFeatureConfig(feature: keyof SentinelConfig): any;
    isFeatureEnabled(feature: keyof SentinelConfig): boolean;
    updateConfig(newConfig: Partial<SentinelConfig>): void;
    reloadConfig(): void;
}
declare const sentinelConfig: SentinelConfigManager;
export { sentinelConfig };
export declare const isTelemetryEnabled: () => boolean;
export declare const isHallucinationEnabled: () => boolean;
export declare const isInjectionEnabled: () => boolean;
export declare const isPIIEnabled: () => boolean;
export declare const isCostEnabled: () => boolean;
export declare const isLatencyEnabled: () => boolean;
export declare const isJudgeEnabled: () => boolean;
export declare const isShieldEnabled: () => boolean;
//# sourceMappingURL=config.d.ts.map