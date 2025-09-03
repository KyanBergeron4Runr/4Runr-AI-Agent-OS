"use strict";
/**
 * Gmail Send Tool Adapter
 * Handles email sending through Gmail API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gmailSendTool = exports.GmailSendTool = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const envelope_1 = require("../crypto/envelope");
const memory_db_1 = require("../models/memory-db");
class GmailSendTool {
    constructor() {
        this.baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';
    }
    /**
     * Check if Gmail is configured
     */
    async isConfigured() {
        try {
            const credential = await memory_db_1.memoryDB.findActiveToolCredential('gmail_send');
            if (!credential) {
                return false;
            }
            // Get the KEK from environment
            const kekBase64 = process.env.KEK_BASE64;
            if (!kekBase64) {
                return false;
            }
            const kek = Buffer.from(kekBase64, 'base64');
            // Decrypt the credential
            this.accessToken = (0, envelope_1.decryptString)(credential.encryptedCredential, kek);
            return true;
        }
        catch (error) {
            console.error('Error configuring Gmail tool:', error);
            return false;
        }
    }
    /**
     * Validate email address format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    /**
     * Create RFC 2822 formatted email
     */
    createEmail(params) {
        const { to, subject, text, html, from = 'me' } = params;
        if (!this.isValidEmail(to)) {
            throw new Error('Invalid recipient email address');
        }
        const boundary = `boundary_${crypto_1.default.randomBytes(16).toString('hex')}`;
        const date = new Date().toUTCString();
        let email = `From: ${from}\r\n`;
        email += `To: ${to}\r\n`;
        email += `Subject: ${subject}\r\n`;
        email += `Date: ${date}\r\n`;
        email += `MIME-Version: 1.0\r\n`;
        email += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
        // Text part
        email += `--${boundary}\r\n`;
        email += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
        email += `${text}\r\n\r\n`;
        // HTML part (if provided)
        if (html) {
            email += `--${boundary}\r\n`;
            email += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
            email += `${html}\r\n\r\n`;
        }
        email += `--${boundary}--\r\n`;
        return email;
    }
    /**
     * Send an email through Gmail
     */
    async send(params) {
        // Check if Gmail is configured
        if (!(await this.isConfigured())) {
            throw new Error('Gmail not configured - no active credential found');
        }
        // Validate required parameters
        if (!params.to || !params.subject || !params.text) {
            throw new Error('To, subject, and text are required');
        }
        try {
            // Create the email message
            const email = this.createEmail(params);
            const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
            // Send the email
            const response = await axios_1.default.post(`${this.baseUrl}/messages/send`, {
                raw: encodedEmail
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });
            // Log the email send for audit purposes
            console.log(`Email sent via Gmail: ${params.to} - ${params.subject} (ID: ${response.data.id})`);
            return {
                success: true,
                messageId: response.data.id,
                threadId: response.data.threadId,
                to: params.to,
                subject: params.subject,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            if (error.response?.status === 401) {
                throw new Error('Gmail authentication failed - check access token');
            }
            if (error.response?.status === 403) {
                throw new Error('Gmail permission denied - check scope and permissions');
            }
            if (error.response?.status === 400) {
                const errorData = error.response.data;
                throw new Error(`Gmail request error: ${errorData.error?.message || 'Bad request'}`);
            }
            throw new Error(`Gmail send failed: ${error.message}`);
        }
    }
    /**
     * Get Gmail profile information
     */
    async getProfile() {
        // Check if Gmail is configured
        if (!(await this.isConfigured())) {
            throw new Error('Gmail not configured - no active credential found');
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                timeout: 10000
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Gmail profile fetch failed: ${error.message}`);
        }
    }
}
exports.GmailSendTool = GmailSendTool;
exports.gmailSendTool = new GmailSendTool();
//# sourceMappingURL=gmail-send.js.map