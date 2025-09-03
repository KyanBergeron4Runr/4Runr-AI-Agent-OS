import { generateAgentKeyPair, encryptForAgent, decryptByAgent } from './src/services/4runr-cipher'

console.log('🧪 Testing 4Runr Cipher Module\n')

// Test 1: Basic functionality
console.log('Test 1: Basic encryption/decryption')
const { publicKey, privateKey } = generateAgentKeyPair()
const message = "secure token payload"
const encrypted = encryptForAgent(publicKey, message)
const decrypted = decryptByAgent(privateKey, encrypted)
console.log('✅ Basic test:', decrypted === message ? 'PASSED' : 'FAILED')

// Test 2: Different message types
console.log('\nTest 2: Different message types')
const testCases = [
  "simple text",
  "text with spaces",
  "text with special chars: !@#$%^&*()",
  "text with numbers: 1234567890",
  "text with unicode: 🚀🌟✨",
  "very long text that might exceed some limits and should still work properly with the encryption system",
  ""
]

testCases.forEach((testCase, index) => {
  const encrypted = encryptForAgent(publicKey, testCase)
  const decrypted = decryptByAgent(privateKey, encrypted)
  const passed = decrypted === testCase
  console.log(`  Case ${index + 1}: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
})

// Test 3: Multiple keypairs
console.log('\nTest 3: Multiple keypairs')
const keypair1 = generateAgentKeyPair()
const keypair2 = generateAgentKeyPair()
const testMessage = "test message"

// Encrypt with keypair1, decrypt with keypair1 (should work)
const encrypted1 = encryptForAgent(keypair1.publicKey, testMessage)
const decrypted1 = decryptByAgent(keypair1.privateKey, encrypted1)
console.log('  Same keypair:', decrypted1 === testMessage ? '✅ PASSED' : '❌ FAILED')

// Encrypt with keypair1, decrypt with keypair2 (should fail)
try {
  const decrypted2 = decryptByAgent(keypair2.privateKey, encrypted1)
  console.log('  Different keypair:', decrypted2 === testMessage ? '❌ FAILED (should not work)' : '✅ PASSED')
} catch (error) {
  console.log('  Different keypair: ✅ PASSED (correctly failed)')
}

console.log('\n🎉 All tests completed!')
