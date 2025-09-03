import { z } from 'zod';
export declare const PolicySpecSchema: z.ZodObject<{
    scopes: z.ZodArray<z.ZodString, "many">;
    intent: z.ZodOptional<z.ZodString>;
    guards: z.ZodOptional<z.ZodObject<{
        maxRequestSize: z.ZodOptional<z.ZodNumber>;
        maxResponseSize: z.ZodOptional<z.ZodNumber>;
        allowedDomains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        blockedDomains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        piiFilters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        timeWindow: z.ZodOptional<z.ZodObject<{
            start: z.ZodOptional<z.ZodString>;
            end: z.ZodOptional<z.ZodString>;
            timezone: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            start?: string | undefined;
            end?: string | undefined;
            timezone?: string | undefined;
        }, {
            start?: string | undefined;
            end?: string | undefined;
            timezone?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        maxRequestSize?: number | undefined;
        maxResponseSize?: number | undefined;
        allowedDomains?: string[] | undefined;
        blockedDomains?: string[] | undefined;
        piiFilters?: string[] | undefined;
        timeWindow?: {
            start?: string | undefined;
            end?: string | undefined;
            timezone?: string | undefined;
        } | undefined;
    }, {
        maxRequestSize?: number | undefined;
        maxResponseSize?: number | undefined;
        allowedDomains?: string[] | undefined;
        blockedDomains?: string[] | undefined;
        piiFilters?: string[] | undefined;
        timeWindow?: {
            start?: string | undefined;
            end?: string | undefined;
            timezone?: string | undefined;
        } | undefined;
    }>>;
    quotas: z.ZodOptional<z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        limit: z.ZodNumber;
        window: z.ZodString;
        resetStrategy: z.ZodDefault<z.ZodEnum<["sliding", "fixed"]>>;
    }, "strip", z.ZodTypeAny, {
        action: string;
        limit: number;
        window: string;
        resetStrategy: "fixed" | "sliding";
    }, {
        action: string;
        limit: number;
        window: string;
        resetStrategy?: "fixed" | "sliding" | undefined;
    }>, "many">>;
    schedule: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        timezone: z.ZodDefault<z.ZodString>;
        allowedDays: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        allowedHours: z.ZodOptional<z.ZodObject<{
            start: z.ZodOptional<z.ZodNumber>;
            end: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            start?: number | undefined;
            end?: number | undefined;
        }, {
            start?: number | undefined;
            end?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        timezone: string;
        enabled: boolean;
        allowedDays?: number[] | undefined;
        allowedHours?: {
            start?: number | undefined;
            end?: number | undefined;
        } | undefined;
    }, {
        timezone?: string | undefined;
        enabled?: boolean | undefined;
        allowedDays?: number[] | undefined;
        allowedHours?: {
            start?: number | undefined;
            end?: number | undefined;
        } | undefined;
    }>>;
    responseFilters: z.ZodOptional<z.ZodObject<{
        redactFields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        truncateFields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            maxLength: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            field: string;
            maxLength: number;
        }, {
            field: string;
            maxLength: number;
        }>, "many">>;
        blockPatterns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        redactFields?: string[] | undefined;
        truncateFields?: {
            field: string;
            maxLength: number;
        }[] | undefined;
        blockPatterns?: string[] | undefined;
    }, {
        redactFields?: string[] | undefined;
        truncateFields?: {
            field: string;
            maxLength: number;
        }[] | undefined;
        blockPatterns?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    scopes: string[];
    intent?: string | undefined;
    guards?: {
        maxRequestSize?: number | undefined;
        maxResponseSize?: number | undefined;
        allowedDomains?: string[] | undefined;
        blockedDomains?: string[] | undefined;
        piiFilters?: string[] | undefined;
        timeWindow?: {
            start?: string | undefined;
            end?: string | undefined;
            timezone?: string | undefined;
        } | undefined;
    } | undefined;
    quotas?: {
        action: string;
        limit: number;
        window: string;
        resetStrategy: "fixed" | "sliding";
    }[] | undefined;
    schedule?: {
        timezone: string;
        enabled: boolean;
        allowedDays?: number[] | undefined;
        allowedHours?: {
            start?: number | undefined;
            end?: number | undefined;
        } | undefined;
    } | undefined;
    responseFilters?: {
        redactFields?: string[] | undefined;
        truncateFields?: {
            field: string;
            maxLength: number;
        }[] | undefined;
        blockPatterns?: string[] | undefined;
    } | undefined;
}, {
    scopes: string[];
    intent?: string | undefined;
    guards?: {
        maxRequestSize?: number | undefined;
        maxResponseSize?: number | undefined;
        allowedDomains?: string[] | undefined;
        blockedDomains?: string[] | undefined;
        piiFilters?: string[] | undefined;
        timeWindow?: {
            start?: string | undefined;
            end?: string | undefined;
            timezone?: string | undefined;
        } | undefined;
    } | undefined;
    quotas?: {
        action: string;
        limit: number;
        window: string;
        resetStrategy?: "fixed" | "sliding" | undefined;
    }[] | undefined;
    schedule?: {
        timezone?: string | undefined;
        enabled?: boolean | undefined;
        allowedDays?: number[] | undefined;
        allowedHours?: {
            start?: number | undefined;
            end?: number | undefined;
        } | undefined;
    } | undefined;
    responseFilters?: {
        redactFields?: string[] | undefined;
        truncateFields?: {
            field: string;
            maxLength: number;
        }[] | undefined;
        blockPatterns?: string[] | undefined;
    } | undefined;
}>;
export type PolicySpec = z.infer<typeof PolicySpecSchema>;
export interface PolicyEvaluationResult {
    allowed: boolean;
    reason?: string;
    appliedFilters?: {
        redactedFields?: string[];
        truncatedFields?: string[];
        blockedPatterns?: string[];
    };
    quotaInfo?: {
        action: string;
        current: number;
        limit: number;
        resetAt: Date;
    };
}
export interface PolicyMergeResult {
    mergedSpec: PolicySpec;
    sourcePolicies: string[];
}
export declare function generateQuotaKey(action: string, window: string): string;
export declare const DEFAULT_TIMEZONE: string;
//# sourceMappingURL=policy.d.ts.map