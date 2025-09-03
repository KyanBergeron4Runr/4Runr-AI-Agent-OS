import { generateAgentKeyPair, encryptForAgent, decryptByAgent } from './src/services/4runr-cipher'

// Test the cipher module
const { publicKey, privateKey } = generateAgentKeyPair()
const message = "secure token payload"

console.log('Generated keypair:')
console.log('Public key length:', publicKey.length)
console.log('Private key length:', privateKey.length)

const encrypted = encryptForAgent(publicKey, message)
console.log('\nEncrypted (base64):', encrypted)

const decrypted = decryptByAgent(privateKey, encrypted)
console.log('Decrypted:', decrypted)

// Verify the decryption worked correctly
console.log('\nTest result:', decrypted === message ? '✅ SUCCESS' : '❌ FAILED')
