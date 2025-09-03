#!/usr/bin/env node

/**
 * Data Enricher Example
 * 
 * Demonstrates:
 * - Multi-tool workflows
 * - Response redaction/truncation
 * - Policy engine integration
 * - Correlation ID tracking
 * - Error handling
 */

import { GatewayClient, GatewayPolicyError } from '@4runr/gateway'
import dotenv from 'dotenv'

dotenv.config()

const gw = new GatewayClient({
  baseUrl: process.env.GATEWAY_URL || 'http://localhost:3000',
  agentId: process.env.AGENT_ID || 'test-agent',
  agentPrivateKeyPem: process.env.AGENT_PRIVATE_KEY || 'test-key',
  defaultIntent: 'data_enrichment'
})

async function enrichData() {
  console.log('🔍 Starting data enricher...')
  
  try {
    // Get a token for multiple tools
    console.log('📋 Getting token for http_fetch and openai...')
    const token = await gw.getToken({
      tools: ['http_fetch', 'openai'],
      permissions: ['read'],
      ttlMinutes: 15
    })
    console.log('✅ Token obtained')

    const websites = [
      {
        url: 'https://httpstat.us/200',
        description: 'Test website (200 OK)'
      },
      {
        url: 'https://httpstat.us/404',
        description: 'Test website (404 Not Found)'
      }
    ]

    for (const site of websites) {
      console.log(`\n🌐 Fetching: ${site.description}`)
      console.log(`   URL: ${site.url}`)
      
      try {
        const startTime = Date.now()
        const content = await gw.proxy('http_fetch', 'get', {
          url: site.url,
          timeout: 5000
        }, token)
        
        const duration = Date.now() - startTime
        console.log(`✅ Content fetched (${duration}ms)`)
        console.log(`   Status: ${content.status}`)
        console.log(`   Content length: ${content.data?.length || 0} chars`)
        
        // Show first 100 characters of content
        if (content.data) {
          const preview = content.data.substring(0, 100)
          console.log(`   Preview: ${preview}${content.data.length > 100 ? '...' : ''}`)
        }

        // Try to summarize with OpenAI (if content is available)
        if (content.data && content.status === 200) {
          console.log('\n🤖 Summarizing with OpenAI...')
          
          try {
            const summaryStart = Date.now()
            const summary = await gw.proxy('openai', 'chat', {
              messages: [
                {
                  role: 'user',
                  content: `Summarize this content in 2-3 sentences: ${content.data.substring(0, 1000)}`
                }
              ],
              model: 'gpt-3.5-turbo',
              max_tokens: 150
            }, token)
            
            const summaryDuration = Date.now() - summaryStart
            console.log(`✅ Summary generated (${summaryDuration}ms)`)
            console.log(`   Summary: ${summary.choices?.[0]?.message?.content || 'No summary available'}`)
            
          } catch (summaryError) {
            console.log('❌ Summary failed:', summaryError.message)
          }
        }

      } catch (fetchError) {
        console.log(`❌ Fetch failed: ${fetchError.message}`)
        if (fetchError.statusCode) {
          console.log(`   Status: ${fetchError.statusCode}`)
        }
      }
    }

    // Demonstrate off-hours policy (if configured)
    console.log('\n⏰ Testing off-hours policy...')
    try {
      await gw.proxy('openai', 'chat', {
        messages: [
          { role: 'user', content: 'This should be blocked during off-hours' }
        ]
      }, token)
      console.log('✅ Off-hours policy not enforced (or request allowed)')
    } catch (error) {
      if (error instanceof GatewayPolicyError) {
        console.log('✅ Off-hours policy working correctly')
        console.log(`   Error: ${error.message}`)
      } else {
        console.log('❌ Unexpected error:', error.message)
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.statusCode) {
      console.error(`   Status: ${error.statusCode}`)
    }
    process.exit(1)
  }
}

// Run the enricher
enrichData().catch(console.error)
