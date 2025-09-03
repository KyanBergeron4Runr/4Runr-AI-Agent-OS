// seeds baseline roles, policies, and a v1 tool credential
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Default policy specifications (copied from src/policies/defaults.ts)
const defaultScraperPolicy = {
  scopes: [
    'serpapi:search',
    'http_fetch:get',
    'http_fetch:head'
  ],
  intent: 'data_collection',
  guards: {
    maxRequestSize: 10000, // 10KB
    maxResponseSize: 1000000, // 1MB
    allowedDomains: [
      'google.com',
      'bing.com',
      'yahoo.com',
      'wikipedia.org',
      'linkedin.com',
      'crunchbase.com',
      'github.com',
      'stackoverflow.com'
    ],
    blockedDomains: [
      'malicious-site.com',
      'phishing-example.com'
    ],
    timeWindow: {
      start: '06:00',
      end: '22:00',
      timezone: 'UTC'
    }
  },
  quotas: [
    {
      action: 'serpapi:search',
      limit: 100,
      window: '24h',
      resetStrategy: 'sliding'
    },
    {
      action: 'http_fetch:get',
      limit: 500,
      window: '24h',
      resetStrategy: 'sliding'
    }
  ],
  schedule: {
    enabled: true,
    timezone: 'UTC',
    allowedDays: [1, 2, 3, 4, 5, 6, 0], // Monday-Sunday
    allowedHours: {
      start: 6,
      end: 22
    }
  },
  responseFilters: {
    redactFields: ['api_key', 'password', 'token'],
    truncateFields: [
      { field: 'content', maxLength: 1000 },
      { field: 'description', maxLength: 500 }
    ]
  }
}

const defaultEnricherPolicy = {
  scopes: [
    'http_fetch:get',
    'http_fetch:head',
    'openai:chat',
    'openai:complete'
  ],
  intent: 'data_enrichment',
  guards: {
    maxRequestSize: 50000, // 50KB (for larger AI prompts)
    maxResponseSize: 5000000, // 5MB
    allowedDomains: [
      'api.openai.com',
      'api.company.com',
      'api.data-provider.com',
      'example.com',
      'test.com'
    ],
    piiFilters: ['email', 'phone', 'ssn', 'credit_card']
  },
  quotas: [
    {
      action: 'openai:chat',
      limit: 50,
      window: '24h',
      resetStrategy: 'sliding'
    },
    {
      action: 'openai:complete',
      limit: 25,
      window: '24h',
      resetStrategy: 'sliding'
    },
    {
      action: 'http_fetch:get',
      limit: 200,
      window: '24h',
      resetStrategy: 'sliding'
    }
  ],
  schedule: {
    enabled: true,
    timezone: 'UTC',
    allowedDays: [1, 2, 3, 4, 5], // Monday-Friday
    allowedHours: {
      start: 8,
      end: 18
    }
  },
  responseFilters: {
    redactFields: ['api_key', 'password', 'token', 'secret'],
    truncateFields: [
      { field: 'choices', maxLength: 2000 },
      { field: 'content', maxLength: 2000 }
    ],
    blockPatterns: ['password', 'secret', 'private_key']
  }
}

const defaultEngagerPolicy = {
  scopes: [
    'gmail_send:send',
    'gmail_send:profile'
  ],
  intent: 'communication',
  guards: {
    maxRequestSize: 20000, // 20KB
    maxResponseSize: 100000, // 100KB
    timeWindow: {
      start: '09:00',
      end: '17:00',
      timezone: 'America/New_York'
    }
  },
  quotas: [
    {
      action: 'gmail_send:send',
      limit: 10,
      window: '24h',
      resetStrategy: 'sliding'
    }
  ],
  schedule: {
    enabled: true,
    timezone: 'America/New_York',
    allowedDays: [1, 2, 3, 4, 5], // Monday-Friday
    allowedHours: {
      start: 9,
      end: 17
    }
  },
  responseFilters: {
    redactFields: ['access_token', 'refresh_token'],
    truncateFields: [
      { field: 'body', maxLength: 500 },
      { field: 'subject', maxLength: 100 }
    ]
  }
}

async function main() {
  console.log('🌱 Seeding 4Runr Gateway baseline data...')
  
  // Create baseline policies if absent (scraper/enricher/engager)
  const have = await prisma.policy.findFirst()
  if (!have) {
    console.log('📋 Creating default policies...')
    
    // Create scraper policy
    await prisma.policy.create({
      data: {
        name: 'Default Scraper Policy',
        description: 'Default policy for scraper agents - allows data collection from search engines and web scraping',
        role: 'scraper',
        spec: JSON.stringify(defaultScraperPolicy),
        specHash: Buffer.from(JSON.stringify(defaultScraperPolicy)).toString('base64').substring(0, 32),
        active: true
      }
    })
    console.log('✅ Created scraper policy')
    
    // Create enricher policy
    await prisma.policy.create({
      data: {
        name: 'Default Enricher Policy',
        description: 'Default policy for enricher agents - allows AI processing and data enrichment',
        role: 'enricher',
        spec: JSON.stringify(defaultEnricherPolicy),
        specHash: Buffer.from(JSON.stringify(defaultEnricherPolicy)).toString('base64').substring(0, 32),
        active: true
      }
    })
    console.log('✅ Created enricher policy')
    
    // Create engager policy
    await prisma.policy.create({
      data: {
        name: 'Default Engager Policy',
        description: 'Default policy for engager agents - allows email communication',
        role: 'engager',
        spec: JSON.stringify(defaultEngagerPolicy),
        specHash: Buffer.from(JSON.stringify(defaultEngagerPolicy)).toString('base64').substring(0, 32),
        active: true
      }
    })
    console.log('✅ Created engager policy')
    
  } else {
    console.log('📋 Policies already exist, skipping creation')
  }

  console.log('🎉 Seed complete')
}
main().finally(() => prisma.$disconnect())
