export interface ChaosConfig {
    mode: 'timeout' | '500' | 'jitter';
    pct: number;
}
export declare function shouldInjectChaos(tool: string): boolean;
export declare function injectChaos(tool: string): Promise<never>;
export declare function maybeInjectChaos(tool: string): Promise<void>;
//# sourceMappingURL=chaos.d.ts.map