export interface SecretRef {
    key: string;
    version?: string;
    metadata?: Record<string, any>;
}
export interface SecretsProvider {
    getSecret(ref: SecretRef): Promise<string | null>;
    setSecret(ref: SecretRef, value: string): Promise<void>;
    listSecrets(prefix?: string): Promise<SecretRef[]>;
    deleteSecret(ref: SecretRef): Promise<boolean>;
    isConfigured(): boolean;
}
export declare class EnvSecretsProvider implements SecretsProvider {
    private prefix;
    constructor(prefix?: string);
    getSecret(ref: SecretRef): Promise<string | null>;
    setSecret(ref: SecretRef, value: string): Promise<void>;
    listSecrets(prefix?: string): Promise<SecretRef[]>;
    deleteSecret(ref: SecretRef): Promise<boolean>;
    isConfigured(): boolean;
}
export declare class FileSecretsProvider implements SecretsProvider {
    private secretsDir;
    private encryptionKey?;
    constructor(secretsDir?: string, encryptionKey?: string);
    getSecret(ref: SecretRef): Promise<string | null>;
    setSecret(ref: SecretRef, value: string): Promise<void>;
    listSecrets(prefix?: string): Promise<SecretRef[]>;
    deleteSecret(ref: SecretRef): Promise<boolean>;
    isConfigured(): boolean;
}
export declare class KmsSecretsProvider implements SecretsProvider {
    private kek;
    private region;
    private keyId;
    constructor(kekBase64: string, region?: string, keyId?: string);
    getSecret(ref: SecretRef): Promise<string | null>;
    setSecret(ref: SecretRef, value: string): Promise<void>;
    listSecrets(prefix?: string): Promise<SecretRef[]>;
    deleteSecret(ref: SecretRef): Promise<boolean>;
    isConfigured(): boolean;
    wrapKey(dek: Buffer): Promise<{
        wrappedKey: Buffer;
        iv: Buffer;
    }>;
    unwrapKey(wrappedKey: Buffer, iv: Buffer): Promise<Buffer>;
}
export declare function createSecretsProvider(): SecretsProvider;
export declare const secretsProvider: SecretsProvider;
//# sourceMappingURL=provider.d.ts.map