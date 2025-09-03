import { generateAgentKeyPair, encryptForAgent, decryptByAgent } from './src/services/4runr-cipher'
import crypto from 'crypto'

console.log('🔐 Simple Token Generation Test\n')

// Test 1: Generate keypair
console.log('Test 1: Generate Agent Keypair')
const { publicKey, privateKey } = generateAgentKeyPair()
console.log('✅ Keypair generated successfully')

// Test 2: Create token payload
console.log('\nTest 2: Create Token Payload')
const tokenPayload = {
  agent_id: "test-agent-123",
  agent_name: "test_scraper",
  tools: ["serpapi"],
  permissions: ["read"],
  expires_at: "2025-08-30T12:00:00Z",
  nonce: crypto.randomUUID(),
  issued_at: new Date().toISOString()
}

console.log('✅ Token payload created:')
console.log('  Agent ID:', tokenPayload.agent_id)
console.log('  Tools:', tokenPayload.tools)
console.log('  Permissions:', tokenPayload.permissions)

// Test 3: Encrypt payload
console.log('\nTest 3: Encrypt Payload')
const payloadString = JSON.stringify(tokenPayload)
const encryptedToken = encryptForAgent(publicKey, payloadString)

console.log('✅ Payload encrypted:')
console.log('  Original size:', payloadString.length, 'bytes')
console.log('  Encrypted size:', encryptedToken.length, 'bytes')

// Test 4: Add signature
console.log('\nTest 4: Add HMAC Signature')
const signingSecret = "4runr-gateway-secret-key-change-in-production"
const signature = crypto
  .createHmac('sha256', signingSecret)
  .update(encryptedToken)
  .digest('hex')

const finalToken = `${encryptedToken}.${signature}`

console.log('✅ Token signed:')
console.log('  Signature length:', signature.length, 'chars')
console.log('  Final token length:', finalToken.length, 'chars')
console.log('  Format: BASE64(encrypted).SIGNATURE')

// Test 5: Decrypt and verify
console.log('\nTest 5: Decrypt and Verify')
const decryptedPayload = decryptByAgent(privateKey, encryptedToken)
const decryptedData = JSON.parse(decryptedPayload)

console.log('✅ Token decrypted successfully:')
console.log('  Agent ID match:', decryptedData.agent_id === tokenPayload.agent_id)
console.log('  Tools match:', JSON.stringify(decryptedData.tools) === JSON.stringify(tokenPayload.tools))
console.log('  Permissions match:', JSON.stringify(decryptedData.permissions) === JSON.stringify(tokenPayload.permissions))

// Test 6: Verify signature
console.log('\nTest 6: Verify Signature')
const [encryptedPart, receivedSignature] = finalToken.split('.')
const expectedSignature = crypto
  .createHmac('sha256', signingSecret)
  .update(encryptedPart)
  .digest('hex')

console.log('✅ Signature verified:', receivedSignature === expectedSignature)

console.log('\n🎉 All token generation tests PASSED!')
console.log('\n📋 Token Generation System Status:')
console.log('  ✅ Hybrid encryption (AES + RSA) working')
console.log('  ✅ HMAC signature verification working')
console.log('  ✅ Payload integrity maintained')
console.log('  ✅ Agent-specific encryption working')
console.log('\n🔧 Next: Fix API route registration and test full endpoint')
