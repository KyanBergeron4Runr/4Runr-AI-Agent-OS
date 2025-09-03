/**
 * OpenAI Tool Adapter
 * Handles chat completions and other OpenAI API calls
 */
export interface OpenAIChatParams {
    model: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
}
export declare class OpenAITool {
    private apiKey?;
    private baseUrl;
    constructor();
    /**
     * Check if OpenAI is configured
     */
    isConfigured(): Promise<boolean>;
    /**
     * Perform a chat completion
     */
    chat(params: OpenAIChatParams): Promise<any>;
    /**
     * Simple text completion (legacy)
     */
    complete(params: {
        model: string;
        prompt: string;
        max_tokens?: number;
        temperature?: number;
    }): Promise<any>;
}
export declare const openaiTool: OpenAITool;
//# sourceMappingURL=openai.d.ts.map