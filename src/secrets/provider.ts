import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'

// Secret reference structure
export interface SecretRef {
  key: string
  version?: string
  metadata?: Record<string, any>
}

// Secrets provider interface
export interface SecretsProvider {
  getSecret(ref: SecretRef): Promise<string | null>
  setSecret(ref: SecretRef, value: string): Promise<void>
  listSecrets(prefix?: string): Promise<SecretRef[]>
  deleteSecret(ref: SecretRef): Promise<boolean>
  isConfigured(): boolean
}

// Environment-based secrets provider
export class EnvSecretsProvider implements SecretsProvider {
  private prefix: string

  constructor(prefix: string = '') {
    this.prefix = prefix
  }

  async getSecret(ref: SecretRef): Promise<string | null> {
    const envKey = this.prefix + ref.key
    const value = process.env[envKey]
    return value || null
  }

  async setSecret(ref: SecretRef, value: string): Promise<void> {
    const envKey = this.prefix + ref.key
    process.env[envKey] = value
  }

  async listSecrets(prefix?: string): Promise<SecretRef[]> {
    const searchPrefix = this.prefix + (prefix || '')
    const secrets: SecretRef[] = []
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(searchPrefix) && value) {
        secrets.push({
          key: key.substring(this.prefix.length),
          metadata: { source: 'env' }
        })
      }
    }
    
    return secrets
  }

  async deleteSecret(ref: SecretRef): Promise<boolean> {
    const envKey = this.prefix + ref.key
    if (process.env[envKey]) {
      delete process.env[envKey]
      return true
    }
    return false
  }

  isConfigured(): boolean {
    return true // Always available
  }
}

// File-based secrets provider
export class FileSecretsProvider implements SecretsProvider {
  private secretsDir: string
  private encryptionKey?: Buffer

  constructor(secretsDir: string = './secrets', encryptionKey?: string) {
    this.secretsDir = secretsDir
    if (encryptionKey) {
      this.encryptionKey = Buffer.from(encryptionKey, 'base64')
    }
  }

  async getSecret(ref: SecretRef): Promise<string | null> {
    try {
      const filePath = path.join(this.secretsDir, `${ref.key}.secret`)
      const encryptedData = await fs.readFile(filePath, 'utf-8')
      
      if (this.encryptionKey) {
        // Decrypt the secret
        const [ivHex, encryptedHex] = encryptedData.split(':')
        const iv = Buffer.from(ivHex, 'hex')
        const encrypted = Buffer.from(encryptedHex, 'hex')
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv)
        let decrypted = decipher.update(encrypted)
        decrypted = Buffer.concat([decrypted, decipher.final()])
        
        return decrypted.toString('utf-8')
      } else {
        return encryptedData
      }
    } catch (error) {
      return null
    }
  }

  async setSecret(ref: SecretRef, value: string): Promise<void> {
    await fs.mkdir(this.secretsDir, { recursive: true })
    
    const filePath = path.join(this.secretsDir, `${ref.key}.secret`)
    
    if (this.encryptionKey) {
      // Encrypt the secret
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv)
      let encrypted = cipher.update(value, 'utf-8', 'hex')
      encrypted += cipher.final('hex')
      
      const encryptedData = `${iv.toString('hex')}:${encrypted}`
      await fs.writeFile(filePath, encryptedData)
    } else {
      await fs.writeFile(filePath, value)
    }
  }

  async listSecrets(prefix?: string): Promise<SecretRef[]> {
    try {
      const files = await fs.readdir(this.secretsDir)
      const secrets: SecretRef[] = []
      
      for (const file of files) {
        if (file.endsWith('.secret')) {
          const key = file.replace('.secret', '')
          if (!prefix || key.startsWith(prefix)) {
            secrets.push({
              key,
              metadata: { source: 'file' }
            })
          }
        }
      }
      
      return secrets
    } catch (error) {
      return []
    }
  }

  async deleteSecret(ref: SecretRef): Promise<boolean> {
    try {
      const filePath = path.join(this.secretsDir, `${ref.key}.secret`)
      await fs.unlink(filePath)
      return true
    } catch (error) {
      return false
    }
  }

  isConfigured(): boolean {
    return true // Always available
  }
}

// KMS-based secrets provider (scaffold)
export class KmsSecretsProvider implements SecretsProvider {
  private kek: Buffer
  private region: string
  private keyId: string

  constructor(kekBase64: string, region: string = 'us-east-1', keyId?: string) {
    this.kek = Buffer.from(kekBase64, 'base64')
    this.region = region
    this.keyId = keyId || 'default'
  }

  async getSecret(ref: SecretRef): Promise<string | null> {
    // TODO: Implement actual KMS integration
    // For now, return null to indicate not implemented
    console.warn('KMS provider not fully implemented - returning null')
    return null
  }

  async setSecret(ref: SecretRef, value: string): Promise<void> {
    // TODO: Implement actual KMS integration
    console.warn('KMS provider not fully implemented - no-op')
  }

  async listSecrets(prefix?: string): Promise<SecretRef[]> {
    // TODO: Implement actual KMS integration
    console.warn('KMS provider not fully implemented - returning empty list')
    return []
  }

  async deleteSecret(ref: SecretRef): Promise<boolean> {
    // TODO: Implement actual KMS integration
    console.warn('KMS provider not fully implemented - returning false')
    return false
  }

  isConfigured(): boolean {
    return this.kek.length > 0
  }

  // Helper method for envelope encryption
  async wrapKey(dek: Buffer): Promise<{ wrappedKey: Buffer; iv: Buffer }> {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', this.kek, iv)
    let wrappedKey = cipher.update(dek)
    wrappedKey = Buffer.concat([wrappedKey, cipher.final()])
    
    return {
      wrappedKey,
      iv
    }
  }

  async unwrapKey(wrappedKey: Buffer, iv: Buffer): Promise<Buffer> {
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.kek, iv)
    let dek = decipher.update(wrappedKey)
    dek = Buffer.concat([dek, decipher.final()])
    
    return dek
  }
}

// Factory function to create the appropriate provider
export function createSecretsProvider(): SecretsProvider {
  const backend = process.env.SECRETS_BACKEND || 'env'
  
  switch (backend) {
    case 'env':
      return new EnvSecretsProvider()
    
    case 'file':
      const secretsFile = process.env.SECRETS_FILE || './secrets'
      const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY
      return new FileSecretsProvider(secretsFile, encryptionKey)
    
    case 'kms':
      const kekBase64 = process.env.KEK_BASE64
      if (!kekBase64) {
        throw new Error('KEK_BASE64 environment variable required for KMS provider')
      }
      const region = process.env.AWS_REGION || 'us-east-1'
      const keyId = process.env.KMS_KEY_ID
      return new KmsSecretsProvider(kekBase64, region, keyId)
    
    default:
      throw new Error(`Unknown secrets backend: ${backend}`)
  }
}

// Global secrets provider instance
export const secretsProvider = createSecretsProvider()
