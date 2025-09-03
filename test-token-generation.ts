import { generateAgentKeyPair, encryptForAgent, decryptByAgent } from './src/services/4runr-cipher'
import crypto from 'crypto'

console.log('🔐 Testing Token Generation System\n')

// Test 1: Simulate token generation process
console.log('Test 1: Token Generation Process')
const { publicKey, privateKey } = generateAgentKeyPair()

// Simulate token payload
const tokenPayload = {
  agent_id: "test-agent-123",
  agent_name: "test_scraper",
  tools: ["serpapi", "web_search"],
  permissions: ["read", "search"],
  expires_at: "2025-08-30T12:00:00Z",
  nonce: crypto.randomUUID(),
  issued_at: new Date().toISOString()
}

console.log('✅ Token payload created:')
console.log('  Agent ID:', tokenPayload.agent_id)
console.log('  Tools:', tokenPayload.tools)
console.log('  Permissions:', tokenPayload.permissions)
console.log('  Expires:', tokenPayload.expires_at)

// Test 2: Encrypt payload with agent's public key
console.log('\nTest 2: Encryption with Agent Public Key')
const payloadString = JSON.stringify(tokenPayload)
const encryptedToken = encryptForAgent(publicKey, payloadString)

console.log('✅ Payload encrypted:')
console.log('  Original length:', payloadString.length)
console.log('  Encrypted length:', encryptedToken.length)
console.log('  Encrypted (first 50 chars):', encryptedToken.substring(0, 50) + '...')

// Test 3: Add HMAC signature
console.log('\nTest 3: HMAC Signature')
const signingSecret = "4runr-gateway-secret-key-change-in-production"
const signature = crypto
  .createHmac('sha256', signingSecret)
  .update(encryptedToken)
  .digest('hex')

const finalToken = `${encryptedToken}.${signature}`

console.log('✅ Token signed:')
console.log('  Signature length:', signature.length)
console.log('  Final token length:', finalToken.length)
console.log('  Token format: BASE64(encrypted).SIGNATURE')

// Test 4: Decrypt and verify
console.log('\nTest 4: Decryption and Verification')
const decryptedPayload = decryptByAgent(privateKey, encryptedToken)
const decryptedData = JSON.parse(decryptedPayload)

console.log('✅ Token decrypted:')
console.log('  Agent ID match:', decryptedData.agent_id === tokenPayload.agent_id)
console.log('  Tools match:', JSON.stringify(decryptedData.tools) === JSON.stringify(tokenPayload.tools))
console.log('  Permissions match:', JSON.stringify(decryptedData.permissions) === JSON.stringify(tokenPayload.permissions))
console.log('  Expiry match:', decryptedData.expires_at === tokenPayload.expires_at)

// Test 5: Verify signature
console.log('\nTest 5: Signature Verification')
const [encryptedPart, receivedSignature] = finalToken.split('.')
const expectedSignature = crypto
  .createHmac('sha256', signingSecret)
  .update(encryptedPart)
  .digest('hex')

console.log('✅ Signature verified:', receivedSignature === expectedSignature)

console.log('\n🎉 All token generation tests completed!')
console.log('\n📋 API Testing:')
console.log('  1. Create agent: POST /api/create-agent')
console.log('  2. Generate token: POST /api/generate-token')
console.log('  3. Ready for TASK 004: Proxy Request System')
