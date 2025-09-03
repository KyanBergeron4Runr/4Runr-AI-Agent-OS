"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretsProvider = exports.KmsSecretsProvider = exports.FileSecretsProvider = exports.EnvSecretsProvider = void 0;
exports.createSecretsProvider = createSecretsProvider;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// Environment-based secrets provider
class EnvSecretsProvider {
    constructor(prefix = '') {
        this.prefix = prefix;
    }
    async getSecret(ref) {
        const envKey = this.prefix + ref.key;
        const value = process.env[envKey];
        return value || null;
    }
    async setSecret(ref, value) {
        const envKey = this.prefix + ref.key;
        process.env[envKey] = value;
    }
    async listSecrets(prefix) {
        const searchPrefix = this.prefix + (prefix || '');
        const secrets = [];
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith(searchPrefix) && value) {
                secrets.push({
                    key: key.substring(this.prefix.length),
                    metadata: { source: 'env' }
                });
            }
        }
        return secrets;
    }
    async deleteSecret(ref) {
        const envKey = this.prefix + ref.key;
        if (process.env[envKey]) {
            delete process.env[envKey];
            return true;
        }
        return false;
    }
    isConfigured() {
        return true; // Always available
    }
}
exports.EnvSecretsProvider = EnvSecretsProvider;
// File-based secrets provider
class FileSecretsProvider {
    constructor(secretsDir = './secrets', encryptionKey) {
        this.secretsDir = secretsDir;
        if (encryptionKey) {
            this.encryptionKey = Buffer.from(encryptionKey, 'base64');
        }
    }
    async getSecret(ref) {
        try {
            const filePath = path.join(this.secretsDir, `${ref.key}.secret`);
            const encryptedData = await fs.readFile(filePath, 'utf-8');
            if (this.encryptionKey) {
                // Decrypt the secret
                const [ivHex, encryptedHex] = encryptedData.split(':');
                const iv = Buffer.from(ivHex, 'hex');
                const encrypted = Buffer.from(encryptedHex, 'hex');
                const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
                let decrypted = decipher.update(encrypted);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                return decrypted.toString('utf-8');
            }
            else {
                return encryptedData;
            }
        }
        catch (error) {
            return null;
        }
    }
    async setSecret(ref, value) {
        await fs.mkdir(this.secretsDir, { recursive: true });
        const filePath = path.join(this.secretsDir, `${ref.key}.secret`);
        if (this.encryptionKey) {
            // Encrypt the secret
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
            let encrypted = cipher.update(value, 'utf-8', 'hex');
            encrypted += cipher.final('hex');
            const encryptedData = `${iv.toString('hex')}:${encrypted}`;
            await fs.writeFile(filePath, encryptedData);
        }
        else {
            await fs.writeFile(filePath, value);
        }
    }
    async listSecrets(prefix) {
        try {
            const files = await fs.readdir(this.secretsDir);
            const secrets = [];
            for (const file of files) {
                if (file.endsWith('.secret')) {
                    const key = file.replace('.secret', '');
                    if (!prefix || key.startsWith(prefix)) {
                        secrets.push({
                            key,
                            metadata: { source: 'file' }
                        });
                    }
                }
            }
            return secrets;
        }
        catch (error) {
            return [];
        }
    }
    async deleteSecret(ref) {
        try {
            const filePath = path.join(this.secretsDir, `${ref.key}.secret`);
            await fs.unlink(filePath);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    isConfigured() {
        return true; // Always available
    }
}
exports.FileSecretsProvider = FileSecretsProvider;
// KMS-based secrets provider (scaffold)
class KmsSecretsProvider {
    constructor(kekBase64, region = 'us-east-1', keyId) {
        this.kek = Buffer.from(kekBase64, 'base64');
        this.region = region;
        this.keyId = keyId || 'default';
    }
    async getSecret(ref) {
        // TODO: Implement actual KMS integration
        // For now, return null to indicate not implemented
        console.warn('KMS provider not fully implemented - returning null');
        return null;
    }
    async setSecret(ref, value) {
        // TODO: Implement actual KMS integration
        console.warn('KMS provider not fully implemented - no-op');
    }
    async listSecrets(prefix) {
        // TODO: Implement actual KMS integration
        console.warn('KMS provider not fully implemented - returning empty list');
        return [];
    }
    async deleteSecret(ref) {
        // TODO: Implement actual KMS integration
        console.warn('KMS provider not fully implemented - returning false');
        return false;
    }
    isConfigured() {
        return this.kek.length > 0;
    }
    // Helper method for envelope encryption
    async wrapKey(dek) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.kek, iv);
        let wrappedKey = cipher.update(dek);
        wrappedKey = Buffer.concat([wrappedKey, cipher.final()]);
        return {
            wrappedKey,
            iv
        };
    }
    async unwrapKey(wrappedKey, iv) {
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.kek, iv);
        let dek = decipher.update(wrappedKey);
        dek = Buffer.concat([dek, decipher.final()]);
        return dek;
    }
}
exports.KmsSecretsProvider = KmsSecretsProvider;
// Factory function to create the appropriate provider
function createSecretsProvider() {
    const backend = process.env.SECRETS_BACKEND || 'env';
    switch (backend) {
        case 'env':
            return new EnvSecretsProvider();
        case 'file':
            const secretsFile = process.env.SECRETS_FILE || './secrets';
            const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
            return new FileSecretsProvider(secretsFile, encryptionKey);
        case 'kms':
            const kekBase64 = process.env.KEK_BASE64;
            if (!kekBase64) {
                throw new Error('KEK_BASE64 environment variable required for KMS provider');
            }
            const region = process.env.AWS_REGION || 'us-east-1';
            const keyId = process.env.KMS_KEY_ID;
            return new KmsSecretsProvider(kekBase64, region, keyId);
        default:
            throw new Error(`Unknown secrets backend: ${backend}`);
    }
}
// Global secrets provider instance
exports.secretsProvider = createSecretsProvider();
//# sourceMappingURL=provider.js.map