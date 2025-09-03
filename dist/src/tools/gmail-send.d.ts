/**
 * Gmail Send Tool Adapter
 * Handles email sending through Gmail API
 */
export interface GmailSendParams {
    to: string;
    subject: string;
    text: string;
    html?: string;
    from?: string;
}
export declare class GmailSendTool {
    private accessToken?;
    private baseUrl;
    constructor();
    /**
     * Check if Gmail is configured
     */
    isConfigured(): Promise<boolean>;
    /**
     * Validate email address format
     */
    private isValidEmail;
    /**
     * Create RFC 2822 formatted email
     */
    private createEmail;
    /**
     * Send an email through Gmail
     */
    send(params: GmailSendParams): Promise<any>;
    /**
     * Get Gmail profile information
     */
    getProfile(): Promise<any>;
}
export declare const gmailSendTool: GmailSendTool;
//# sourceMappingURL=gmail-send.d.ts.map