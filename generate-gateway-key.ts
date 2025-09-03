import { generateAgentKeyPair } from './src/services/4runr-cipher'

console.log('🔑 Generating Gateway Private Key\n')

// Generate a keypair for the gateway
const { publicKey, privateKey } = generateAgentKeyPair()

console.log('✅ Gateway keypair generated successfully')
console.log('\n📋 Environment Variables to Add:')
console.log('\nGATEWAY_PRIVATE_KEY="' + privateKey.replace(/\n/g, '\\n') + '"')
console.log('\nSERPAPI_KEY="your-serpapi-key-here"')
console.log('\nOPENAI_API_KEY="your-openai-api-key-here"')

console.log('\n🔧 Instructions:')
console.log('1. Add the above environment variables to your .env file')
console.log('2. Replace the API keys with your actual keys')
console.log('3. Restart the server to load the new environment variables')
console.log('\n⚠️  Security Note:')
console.log('- Keep the GATEWAY_PRIVATE_KEY secure')
console.log('- In production, each agent would have their own private key')
console.log('- This centralized approach is for development/testing only')
