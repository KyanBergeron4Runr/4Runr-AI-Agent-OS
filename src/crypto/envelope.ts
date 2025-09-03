import * as crypto from 'crypto'

// Envelope encryption result
export interface EnvelopeResult {
  encryptedData: Buffer
  encryptedKey: Buffer
  iv: Buffer
  tag: Buffer
}

// Envelope decryption result
export interface EnvelopeDecryptResult {
  decryptedData: Buffer
  dek: Buffer
}

// Generate a new Data Encryption Key (DEK)
export function generateDEK(): Buffer {
  return crypto.randomBytes(32) // 256-bit key for AES-256
}

// Wrap a DEK with a Key Encryption Key (KEK)
export function wrapDEK(dek: Buffer, kek: Buffer): { wrappedKey: Buffer; iv: Buffer } {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv)
  
  let wrappedKey = cipher.update(dek)
  wrappedKey = Buffer.concat([wrappedKey, cipher.final()])
  
  return {
    wrappedKey,
    iv
  }
}

// Unwrap a DEK with a Key Encryption Key (KEK)
export function unwrapDEK(wrappedKey: Buffer, iv: Buffer, kek: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv)
  
  let dek = decipher.update(wrappedKey)
  dek = Buffer.concat([dek, decipher.final()])
  
  return dek
}

// Encrypt data using envelope encryption
export function encryptWithEnvelope(
  data: Buffer,
  kek: Buffer
): EnvelopeResult {
  // Generate a new DEK for this encryption
  const dek = generateDEK()
  
  // Encrypt the data with the DEK
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv)
  
  let encryptedData = cipher.update(data)
  encryptedData = Buffer.concat([encryptedData, cipher.final()])
  
  // Get the authentication tag
  const tag = cipher.getAuthTag()
  
  // Wrap the DEK with the KEK
  const { wrappedKey, iv: wrapIv } = wrapDEK(dek, kek)
  
  return {
    encryptedData,
    encryptedKey: wrappedKey,
    iv: wrapIv,
    tag
  }
}

// Decrypt data using envelope encryption
export function decryptWithEnvelope(
  envelope: EnvelopeResult,
  kek: Buffer
): EnvelopeDecryptResult {
  // Unwrap the DEK with the KEK
  const dek = unwrapDEK(envelope.encryptedKey, envelope.iv, kek)
  
  // Decrypt the data with the DEK
  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, envelope.iv)
  decipher.setAuthTag(envelope.tag)
  
  let decryptedData = decipher.update(envelope.encryptedData)
  decryptedData = Buffer.concat([decryptedData, decipher.final()])
  
  return {
    decryptedData,
    dek
  }
}

// Serialize envelope result to string (for storage/transmission)
export function serializeEnvelope(envelope: EnvelopeResult): string {
  const serialized = {
    encryptedData: envelope.encryptedData.toString('base64'),
    encryptedKey: envelope.encryptedKey.toString('base64'),
    iv: envelope.iv.toString('base64'),
    tag: envelope.tag.toString('base64')
  }
  
  return JSON.stringify(serialized)
}

// Deserialize envelope result from string
export function deserializeEnvelope(serialized: string): EnvelopeResult {
  const parsed = JSON.parse(serialized)
  
  return {
    encryptedData: Buffer.from(parsed.encryptedData, 'base64'),
    encryptedKey: Buffer.from(parsed.encryptedKey, 'base64'),
    iv: Buffer.from(parsed.iv, 'base64'),
    tag: Buffer.from(parsed.tag, 'base64')
  }
}

// Utility function to encrypt a string
export function encryptString(data: string, kek: Buffer): string {
  const dataBuffer = Buffer.from(data, 'utf-8')
  const envelope = encryptWithEnvelope(dataBuffer, kek)
  return serializeEnvelope(envelope)
}

// Utility function to decrypt a string
export function decryptString(encryptedData: string, kek: Buffer): string {
  const envelope = deserializeEnvelope(encryptedData)
  const result = decryptWithEnvelope(envelope, kek)
  return result.decryptedData.toString('utf-8')
}

// Utility function to encrypt an object (JSON)
export function encryptObject(obj: any, kek: Buffer): string {
  const jsonString = JSON.stringify(obj)
  return encryptString(jsonString, kek)
}

// Utility function to decrypt an object (JSON)
export function decryptObject(encryptedData: string, kek: Buffer): any {
  const jsonString = decryptString(encryptedData, kek)
  return JSON.parse(jsonString)
}
