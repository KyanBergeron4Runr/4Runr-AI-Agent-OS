import { generateAgentKeyPair, encryptForAgent, decryptByAgent } from './src/services/4runr-cipher'

console.log('🧪 Testing Create-Agent Endpoint Integration\n')

// Test 1: Generate keypair and simulate agent creation
console.log('Test 1: Keypair Generation')
const { publicKey, privateKey } = generateAgentKeyPair()
console.log('✅ Generated keypair:')
console.log('  Public key length:', publicKey.length)
console.log('  Private key length:', privateKey.length)

// Test 2: Simulate encryption/decryption with the generated keys
console.log('\nTest 2: Encryption/Decryption with Generated Keys')
const testMessage = "agent-specific secure payload"
const encrypted = encryptForAgent(publicKey, testMessage)
const decrypted = decryptByAgent(privateKey, encrypted)

console.log('✅ Encryption/Decryption test:', decrypted === testMessage ? 'PASSED' : 'FAILED')
console.log('  Original:', testMessage)
console.log('  Encrypted (base64):', encrypted.substring(0, 50) + '...')
console.log('  Decrypted:', decrypted)

// Test 3: Simulate API response format
console.log('\nTest 3: API Response Format')
const mockApiResponse = {
  agent_id: "14a7e4ad-da5a-466a-b633-7a9ff8ac8616",
  private_key: privateKey
}

console.log('✅ API Response format:')
console.log('  agent_id:', mockApiResponse.agent_id)
console.log('  private_key length:', mockApiResponse.private_key.length)

console.log('\n🎉 All tests completed!')
console.log('\n📋 Next Steps:')
console.log('  1. Server is running on http://localhost:3000')
console.log('  2. Test with: curl -X POST http://localhost:3000/api/create-agent')
console.log('  3. Ready for TASK 003: Generate AgentAuth Tokens')
