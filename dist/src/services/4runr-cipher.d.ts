/**
 * Generates a new asymmetric keypair for an agent
 * @returns Object containing publicKey (for DB storage) and privateKey (for agent)
 */
export declare function generateAgentKeyPair(): {
    publicKey: string;
    privateKey: string;
};
/**
 * Encrypts data for a specific agent using hybrid encryption (AES + RSA)
 * @param publicKeyPem - The agent's public key in PEM format
 * @param data - The data string to encrypt
 * @returns Base64 encoded encrypted string (AES key encrypted with RSA + AES encrypted data)
 */
export declare function encryptForAgent(publicKeyPem: string, data: string): string;
/**
 * Decrypts data using an agent's private key (hybrid AES + RSA decryption)
 * @param privateKeyPem - The agent's private key in PEM format
 * @param encryptedBase64 - The base64 encoded encrypted data
 * @returns Decrypted string
 */
export declare function decryptByAgent(privateKeyPem: string, encryptedBase64: string): string;
/**
 * Generates the gateway's public key from its private key
 * @param gatewayPrivateKeyPem - The gateway's private key in PEM format
 * @returns The gateway's public key in PEM format
 */
export declare function getGatewayPublicKey(gatewayPrivateKeyPem: string): string;
/**
 * Encrypts data for the gateway using hybrid encryption (AES + RSA)
 * @param gatewayPublicKeyPem - The gateway's public key in PEM format
 * @param data - The data string to encrypt
 * @returns Base64 encoded encrypted string
 */
export declare function encryptForGateway(gatewayPublicKeyPem: string, data: string): string;
//# sourceMappingURL=4runr-cipher.d.ts.map