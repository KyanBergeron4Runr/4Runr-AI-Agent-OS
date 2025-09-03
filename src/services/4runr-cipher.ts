import crypto from 'crypto'

// Use RSA-2048 for compatibility with publicEncrypt/privateDecrypt
const KEY_TYPE = 'rsa';
const KEY_SIZE = 2048;

/**
 * Generates a new asymmetric keypair for an agent
 * @returns Object containing publicKey (for DB storage) and privateKey (for agent)
 */
export function generateAgentKeyPair() {
  // Generate RSA keypair for compatibility with encryption/decryption methods
  const { publicKey, privateKey } = crypto.generateKeyPairSync(KEY_TYPE, {
    modulusLength: KEY_SIZE,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  return {
    publicKey,  // store this in DB
    privateKey  // return to agent (never stored)
  }
}

/**
 * Encrypts data for a specific agent using hybrid encryption (AES + RSA)
 * @param publicKeyPem - The agent's public key in PEM format
 * @param data - The data string to encrypt
 * @returns Base64 encoded encrypted string (AES key encrypted with RSA + AES encrypted data)
 */
export function encryptForAgent(publicKeyPem: string, data: string): string {
  // Create public key object from PEM string
  const publicKey = crypto.createPublicKey(publicKeyPem)
  
  // Generate a random AES key for this encryption
  const aesKey = crypto.randomBytes(32) // 256-bit key
  const iv = crypto.randomBytes(16) // 128-bit IV
  
  // Encrypt the data with AES
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv)
  let encryptedData = cipher.update(data, 'utf8', 'base64')
  encryptedData += cipher.final('base64')
  
  // Encrypt the AES key with the agent's public key
  const encryptedAesKey = crypto.publicEncrypt(publicKey, aesKey)
  
  // Combine: encrypted AES key + IV + encrypted data
  const combined = Buffer.concat([
    encryptedAesKey,
    iv,
    Buffer.from(encryptedData, 'base64')
  ])
  
  // Return as base64
  return combined.toString('base64')
}

/**
 * Decrypts data using an agent's private key (hybrid AES + RSA decryption)
 * @param privateKeyPem - The agent's private key in PEM format
 * @param encryptedBase64 - The base64 encoded encrypted data
 * @returns Decrypted string
 */
export function decryptByAgent(privateKeyPem: string, encryptedBase64: string): string {
  // Create private key object from PEM string
  const privateKey = crypto.createPrivateKey(privateKeyPem)
  
  // Convert base64 to buffer
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64')
  
  // Extract components: encrypted AES key + IV + encrypted data
  const rsaKeySize = 256 // RSA-2048 encrypted key size
  const ivSize = 16 // AES IV size
  
  const encryptedAesKey = encryptedBuffer.subarray(0, rsaKeySize)
  const iv = encryptedBuffer.subarray(rsaKeySize, rsaKeySize + ivSize)
  const encryptedData = encryptedBuffer.subarray(rsaKeySize + ivSize)
  
  // Decrypt the AES key with the private key
  const aesKey = crypto.privateDecrypt(privateKey, encryptedAesKey)
  
  // Decrypt the data with AES
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv)
  let decrypted = decipher.update(encryptedData, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Generates the gateway's public key from its private key
 * @param gatewayPrivateKeyPem - The gateway's private key in PEM format
 * @returns The gateway's public key in PEM format
 */
export function getGatewayPublicKey(gatewayPrivateKeyPem: string): string {
  const privateKey = crypto.createPrivateKey(gatewayPrivateKeyPem)
  const publicKey = crypto.createPublicKey(privateKey)
  return publicKey.export({ type: 'spki', format: 'pem' }) as string
}

/**
 * Encrypts data for the gateway using hybrid encryption (AES + RSA)
 * @param gatewayPublicKeyPem - The gateway's public key in PEM format
 * @param data - The data string to encrypt
 * @returns Base64 encoded encrypted string
 */
export function encryptForGateway(gatewayPublicKeyPem: string, data: string): string {
  // Create public key object from PEM string
  const publicKey = crypto.createPublicKey(gatewayPublicKeyPem)
  
  // Generate a random AES key for this encryption
  const aesKey = crypto.randomBytes(32) // 256-bit key
  const iv = crypto.randomBytes(16) // 128-bit IV
  
  // Encrypt the data with AES
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv)
  let encryptedData = cipher.update(data, 'utf8', 'base64')
  encryptedData += cipher.final('base64')
  
  // Encrypt the AES key with the gateway's public key
  const encryptedAesKey = crypto.publicEncrypt(publicKey, aesKey)
  
  // Combine: encrypted AES key + IV + encrypted data
  const combined = Buffer.concat([
    encryptedAesKey,
    iv,
    Buffer.from(encryptedData, 'base64')
  ])
  
  // Return as base64
  return combined.toString('base64')
}
