import { z } from 'zod';
export declare const SerpApiSearchSchema: z.ZodObject<{
    query: z.ZodString;
    location: z.ZodOptional<z.ZodString>;
    num: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    start: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    safe: z.ZodDefault<z.ZodOptional<z.ZodEnum<["active", "off"]>>>;
    intent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    query: string;
    start: number;
    num: number;
    safe: "active" | "off";
    location?: string | undefined;
    intent?: string | undefined;
}, {
    query: string;
    location?: string | undefined;
    intent?: string | undefined;
    start?: number | undefined;
    num?: number | undefined;
    safe?: "active" | "off" | undefined;
}>;
export declare const HttpFetchGetSchema: z.ZodObject<{
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    intent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    url: string;
    headers?: Record<string, string> | undefined;
    intent?: string | undefined;
}, {
    url: string;
    timeout?: number | undefined;
    headers?: Record<string, string> | undefined;
    intent?: string | undefined;
}>;
export declare const HttpFetchHeadSchema: z.ZodObject<{
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    intent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    url: string;
    headers?: Record<string, string> | undefined;
    intent?: string | undefined;
}, {
    url: string;
    timeout?: number | undefined;
    headers?: Record<string, string> | undefined;
    intent?: string | undefined;
}>;
export declare const OpenAIChatSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["system", "user", "assistant"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "system" | "user" | "assistant";
        content: string;
    }, {
        role: "system" | "user" | "assistant";
        content: string;
    }>, "many">;
    model: z.ZodDefault<z.ZodString>;
    temperature: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    max_tokens: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    intent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    messages: {
        role: "system" | "user" | "assistant";
        content: string;
    }[];
    model: string;
    temperature: number;
    max_tokens: number;
    intent?: string | undefined;
}, {
    messages: {
        role: "system" | "user" | "assistant";
        content: string;
    }[];
    intent?: string | undefined;
    model?: string | undefined;
    temperature?: number | undefined;
    max_tokens?: number | undefined;
}>;
export declare const OpenAICompleteSchema: z.ZodObject<{
    prompt: z.ZodString;
    model: z.ZodDefault<z.ZodString>;
    temperature: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    max_tokens: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    intent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    model: string;
    temperature: number;
    max_tokens: number;
    prompt: string;
    intent?: string | undefined;
}, {
    prompt: string;
    intent?: string | undefined;
    model?: string | undefined;
    temperature?: number | undefined;
    max_tokens?: number | undefined;
}>;
export declare const GmailSendSchema: z.ZodObject<{
    to: z.ZodString;
    subject: z.ZodString;
    body: z.ZodString;
    from: z.ZodOptional<z.ZodString>;
    cc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bcc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    intent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    body: string;
    to: string;
    subject: string;
    from?: string | undefined;
    intent?: string | undefined;
    cc?: string[] | undefined;
    bcc?: string[] | undefined;
}, {
    body: string;
    to: string;
    subject: string;
    from?: string | undefined;
    intent?: string | undefined;
    cc?: string[] | undefined;
    bcc?: string[] | undefined;
}>;
export declare const GmailProfileSchema: z.ZodObject<{
    intent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    intent?: string | undefined;
}, {
    intent?: string | undefined;
}>;
export declare const toolValidators: Record<string, Record<string, z.ZodSchema>>;
export declare function validateToolParameters(tool: string, action: string, params: any): {
    valid: boolean;
    errors?: string[];
};
export declare function sanitizeParameters(tool: string, action: string, params: any): any;
//# sourceMappingURL=validators.d.ts.map