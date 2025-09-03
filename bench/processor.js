const https = require('https')
const http = require('http')

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000'
const AGENTS = {
  scraper: process.env.SCRAPER_AGENT_ID,
  enricher: process.env.ENRICHER_AGENT_ID,
  engager: process.env.ENGAGER_AGENT_ID
}

module.exports = {
  getTokenScraper,
  getTokenEnricherHTTP,
  getTokenEnricherAI,
  getTokenEngager,
  uuid,
  keyword,
  url,
  cacheKeyword
}

function getToken(agentId, tools, permissions, ttl) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${GATEWAY}/api/generate-token`)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http
    
    const data = JSON.stringify({ 
      agent_id: agentId, 
      tools, 
      permissions, 
      expires_at: new Date(Date.now()+ttl*60000).toISOString() 
    })
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }
    
    const req = client.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve(json.agent_token)
        } catch (error) {
          reject(error)
        }
      })
    })
    
    req.on('error', (error) => {
      reject(error)
    })
    
    req.write(data)
    req.end()
  })
}

function uuid(context, events, done) {
  context.vars.uuid = cryptoRandom()
  return done()
}

function keyword(context, events, done) {
  const kws = [
    'site:linkedin.com plumber montreal',
    'site:linkedin.com dentist toronto',
    'site:linkedin.com roofer ottawa',
    'site:linkedin.com electrician vancouver',
    'site:linkedin.com carpenter calgary'
  ]
  context.vars.keyword = kws[Math.floor(Math.random()*kws.length)]
  return done()
}

function cacheKeyword(context, events, done) {
  // Use a smaller set for cache testing to increase hit rate
  const cacheKws = [
    'site:linkedin.com plumber montreal',
    'site:linkedin.com dentist toronto'
  ]
  context.vars.cacheKeyword = cacheKws[Math.floor(Math.random()*cacheKws.length)]
  return done()
}

function url(context, events, done) {
  const urls = [
    'https://example.com',
    'https://wikipedia.org',
    'https://news.ycombinator.com',
    'https://httpstat.us/200',
    'https://jsonplaceholder.typicode.com/posts/1'
  ]
  context.vars.url = urls[Math.floor(Math.random()*urls.length)]
  return done()
}

function getTokenScraper(context, events, done) {
  getToken(AGENTS.scraper, ['serpapi'], ['read'], 15)
    .then(token => {
      context.vars.token = token
      done()
    })
    .catch(error => {
      console.error('Failed to get scraper token:', error.message)
      context.vars.token = 'invalid-token'
      done()
    })
}

function getTokenEnricherHTTP(context, events, done) {
  getToken(AGENTS.enricher, ['http_fetch'], ['read'], 10)
    .then(token => {
      context.vars.token = token
      done()
    })
    .catch(error => {
      console.error('Failed to get enricher HTTP token:', error.message)
      context.vars.token = 'invalid-token'
      done()
    })
}

function getTokenEnricherAI(context, events, done) {
  getToken(AGENTS.enricher, ['openai'], ['read'], 5)
    .then(token => {
      context.vars.token = token
      done()
    })
    .catch(error => {
      console.error('Failed to get enricher AI token:', error.message)
      context.vars.token = 'invalid-token'
      done()
    })
}

function getTokenEngager(context, events, done) {
  getToken(AGENTS.engager, ['gmail_send'], ['write'], 5)
    .then(token => {
      context.vars.token = token
      done()
    })
    .catch(error => {
      console.error('Failed to get engager token:', error.message)
      context.vars.token = 'invalid-token'
      done()
    })
}

function cryptoRandom() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8)
    return v.toString(16)
  })
}
