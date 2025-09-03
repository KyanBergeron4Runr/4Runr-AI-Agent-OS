import { PolicySpec } from '../types/policy';
export declare const defaultScraperPolicy: PolicySpec;
export declare const defaultEnricherPolicy: PolicySpec;
export declare const defaultEngagerPolicy: PolicySpec;
export declare const defaultDenyPolicy: PolicySpec;
export declare function getDefaultPolicyForRole(role: string): PolicySpec;
export declare const defaultPolicyNames: {
    scraper: string;
    enricher: string;
    engager: string;
};
//# sourceMappingURL=defaults.d.ts.map