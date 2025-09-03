#!/usr/bin/env node

/**
 * Lead Scraper Example
 * 
 * Demonstrates:
 * - Basic SDK usage
 * - Token management
 * - Policy enforcement (scope denial)
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
  defaultIntent: 'lead_discovery'
})

async function scrapeLeads() {
  console.log('🔍 Starting lead scraper...')
  
  try {
    // Get a token for SerpAPI access
    console.log('📋 Getting token for SerpAPI...')
    const token = await gw.getToken({
      tools: ['serpapi'],
      permissions: ['read'],
      ttlMinutes: 15
    })
    console.log('✅ Token obtained')

    // Search for leads
    const searches = [
      {
        query: 'site:linkedin.com "software engineer" "San Francisco"',
        description: 'Software engineers in San Francisco'
      },
      {
        query: 'site:linkedin.com "product manager" "New York"',
        description: 'Product managers in New York'
      },
      {
        query: 'site:linkedin.com "data scientist" "Seattle"',
        description: 'Data scientists in Seattle'
      }
    ]

    for (const search of searches) {
      console.log(`\n🔎 Searching: ${search.description}`)
      
      const startTime = Date.now()
      const results = await gw.proxy('serpapi', 'search', {
        q: search.query,
        engine: 'google',
        num: 5
      }, token)
      
      const duration = Date.now() - startTime
      console.log(`✅ Found ${results.organic_results?.length || 0} results (${duration}ms)`)
      
      if (results.organic_results) {
        results.organic_results.slice(0, 3).forEach((result, i) => {
          console.log(`  ${i + 1}. ${result.title}`)
          console.log(`     ${result.link}`)
        })
      }
    }

    // Demonstrate scope denial
    console.log('\n🚫 Testing scope denial...')
    try {
      await gw.proxy('gmail_send', 'send', {
        to: 'test@example.com',
        subject: 'Test',
        body: 'This should fail'
      }, token)
    } catch (error) {
      if (error instanceof GatewayPolicyError) {
        console.log('✅ Scope denial working correctly')
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

// Run the scraper
scrapeLeads().catch(console.error)
