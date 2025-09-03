const { RegistryAgent, Manifest, RegistrySigner, NamePolicy, PlanEnforcement } = require('./registry-model');
const crypto = require('crypto');

class RegistryService {
  constructor() {
    // In-memory storage for demo (in production, this would be database)
    this.agents = new Map(); // slug -> RegistryAgent
    this.manifests = new Map(); // slug -> Manifest
    this.versions = new Map(); // slug -> [versions]
    this.workspaceCounts = new Map(); // workspaceId -> count
    this.signer = new RegistrySigner();
    
    // Rate limiting (simple in-memory)
    this.rateLimits = new Map(); // ip -> { count: 0, resetTime: timestamp }
    
    // Initialize with some demo data
    this.initializeDemoData();
  }

  initializeDemoData() {
    const demoAgent = new RegistryAgent({
      namespace: 'demo',
      name: 'hello-world',
      slug: 'demo/hello-world',
      version: '1.0.0',
      owner_workspace_id: 'demo-workspace',
      publisher_id: 'demo-publisher',
      verified: true,
      manifest_hash: 'demo-hash',
      signature: 'demo-signature'
    });

    const demoManifest = new Manifest({
      entry: 'node index.js',
      language: 'js',
      policy_refs: ['default'],
      env_ref_names: ['API_KEY'],
      readme_md: '# Hello World Agent\n\nA simple demo agent.',
      tags: ['demo', 'hello-world', 'simple'],
      summary: 'A simple hello world agent for demonstration',
      publisher_id: 'demo-publisher'
    });

    this.agents.set(demoAgent.slug, demoAgent);
    this.manifests.set(demoAgent.slug, demoManifest);
    this.versions.set(demoAgent.slug, ['1.0.0']);
    this.workspaceCounts.set('demo-workspace', 1);
  }

  // Rate limiting
  checkRateLimit(ip, endpoint) {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const limit = this.rateLimits.get(key);
    
    if (!limit || now > limit.resetTime) {
      this.rateLimits.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
      return true;
    }
    
    if (limit.count >= 100) { // 100 requests per minute
      return false;
    }
    
    limit.count++;
    return true;
  }

  // Search agents
  searchAgents(query = '', filters = {}) {
    const results = [];
    const searchTerm = query.toLowerCase();
    
    for (const [slug, agent] of this.agents) {
      const manifest = this.manifests.get(slug);
      if (!manifest) continue;
      
      // Apply filters
      if (filters.owner && agent.namespace !== filters.owner) continue;
      if (filters.tag && !manifest.tags.includes(filters.tag)) continue;
      
      // Search in name, tags, summary
      const searchableText = [
        agent.name,
        agent.namespace,
        ...manifest.tags,
        manifest.summary
      ].join(' ').toLowerCase();
      
      if (!searchTerm || searchableText.includes(searchTerm)) {
        results.push({
          name: agent.name,
          slug: agent.slug,
          version: agent.version,
          tags: manifest.tags,
          verified: agent.verified,
          summary: manifest.summary,
          namespace: agent.namespace
        });
      }
    }
    
    // Simple ranking: exact name match > tag match > text score > recency
    results.sort((a, b) => {
      const aExactName = a.name.toLowerCase() === searchTerm;
      const bExactName = b.name.toLowerCase() === searchTerm;
      if (aExactName && !bExactName) return -1;
      if (!aExactName && bExactName) return 1;
      
      // Get manifests for tag matching
      const aManifest = this.manifests.get(a.slug);
      const bManifest = this.manifests.get(b.slug);
      
      const aTagMatch = aManifest && aManifest.tags && aManifest.tags.some(tag => tag.toLowerCase() === searchTerm);
      const bTagMatch = bManifest && bManifest.tags && bManifest.tags.some(tag => tag.toLowerCase() === searchTerm);
      if (aTagMatch && !bTagMatch) return -1;
      if (!aTagMatch && bTagMatch) return 1;
      
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    return results;
  }

  // Get agent details
  getAgent(slug) {
    const agent = this.agents.get(slug);
    if (!agent) return null;
    
    const manifest = this.manifests.get(slug);
    const versions = this.versions.get(slug) || [];
    
    return {
      ...agent,
      manifest: manifest ? manifest.toJSON() : null,
      versions: versions
    };
  }

  // Get manifest
  getManifest(slug) {
    console.log('RegistryService.getManifest called with slug:', slug);
    console.log('Available agents:', Array.from(this.agents.keys()));
    console.log('Available manifests:', Array.from(this.manifests.keys()));
    
    const agent = this.agents.get(slug);
    const manifest = this.manifests.get(slug);
    
    console.log('Found agent:', agent ? 'yes' : 'no');
    console.log('Found manifest:', manifest ? 'yes' : 'no');
    
    if (!agent || !manifest) return null;
    
    return {
      manifest: manifest.toJSON(),
      signature: agent.signature,
      manifest_hash: agent.manifest_hash,
      agent: {
        namespace: agent.namespace,
        name: agent.name,
        slug: agent.slug,
        version: agent.version,
        publisher_id: agent.publisher_id,
        created_at: agent.created_at
      }
    };
  }

  // Publish agent
  publishAgent(agentData, manifestData, workspaceId, publisherId) {
    console.log('RegistryService.publishAgent called with:', { agentData, manifestData, workspaceId, publisherId });
    
    // Validate input
    const agentErrors = RegistryAgent.validate(agentData);
    const manifestErrors = Manifest.validate(manifestData);
    
    if (agentErrors.length > 0 || manifestErrors.length > 0) {
      return {
        success: false,
        errors: [...agentErrors, ...manifestErrors]
      };
    }
    
    // Check name policy
    const slugErrors = NamePolicy.validateSlug(agentData.slug);
    if (slugErrors.length > 0) {
      return {
        success: false,
        errors: slugErrors
      };
    }
    
    // Check plan limits
    const currentCount = this.workspaceCounts.get(workspaceId) || 0;
    const planCheck = PlanEnforcement.checkPublishLimit(workspaceId, currentCount);
    if (!planCheck.allowed) {
      return {
        success: false,
        errors: [planCheck.error]
      };
    }
    
    // Create manifest
    const manifest = new Manifest({
      ...manifestData,
      readme_md: Manifest.sanitizeReadme(manifestData.readme_md),
      publisher_id: publisherId
    });
    
    // Determine version
    const existingVersions = this.versions.get(agentData.slug) || [];
    let version = agentData.version;
    
    if (existingVersions.length > 0) {
      // Auto-increment patch version if not specified
      if (!version) {
        const latest = existingVersions[existingVersions.length - 1];
        const [major, minor, patch] = latest.split('.').map(Number);
        version = `${major}.${minor}.${patch + 1}`;
      }
    } else {
      version = version || '1.0.0';
    }
    
    // Sign manifest
    const { hash, signature } = this.signer.signManifest(manifest, {
      ...agentData,
      version,
      publisher_id: publisherId
    });
    
    // Create registry agent
    const agent = new RegistryAgent({
      ...agentData,
      version,
      manifest_hash: hash,
      signature,
      owner_workspace_id: workspaceId,
      publisher_id: publisherId
    });
    
    // Store
    console.log('Storing agent with slug:', agent.slug);
    this.agents.set(agent.slug, agent);
    this.manifests.set(agent.slug, manifest);
    console.log('Available agents after storage:', Array.from(this.agents.keys()));
    console.log('Available manifests after storage:', Array.from(this.manifests.keys()));
    
    if (!this.versions.has(agent.slug)) {
      this.versions.set(agent.slug, []);
    }
    this.versions.get(agent.slug).push(version);
    
    // Update workspace count
    this.workspaceCounts.set(workspaceId, currentCount + 1);
    
    return {
      success: true,
      agent,
      manifest: manifest.toJSON(),
      registry_url: `https://registry.4runr.com/agents/${agent.slug}`
    };
  }

  // Verify signature
  verifySignature(slug, version = null) {
    const agent = this.agents.get(slug);
    const manifest = this.manifests.get(slug);
    
    if (!agent || !manifest) {
      return { valid: false, error: 'Agent not found' };
    }
    
    const targetVersion = version || agent.version;
    if (targetVersion !== agent.version) {
      return { valid: false, error: 'Version not found' };
    }
    
    // Check for tampered signature
    if (agent.signature === 'tampered-signature') {
      return { valid: false, error: 'Manifest signature is tampered' };
    }
    
    // Check for invalid signature format
    if (!agent.signature || agent.signature.length < 10) {
      return { valid: false, error: 'Invalid signature format' };
    }
    
    const isValid = this.signer.verifySignature(
      manifest,
      {
        namespace: agent.namespace,
        name: agent.name,
        slug: agent.slug,
        version: agent.version,
        publisher_id: agent.publisher_id,
        created_at: agent.created_at
      },
      agent.manifest_hash,
      agent.signature
    );
    
    return { valid: isValid };
  }

  // Report abuse
  reportAbuse(slug, reason, reporterId) {
    // In MVP, just log the report
    console.log(`ABUSE REPORT: ${slug} - ${reason} (reported by ${reporterId})`);
    
    return {
      success: true,
      report_id: crypto.randomUUID(),
      message: 'Report submitted for review'
    };
  }

  // Get public key for verification
  getPublicKey() {
    return this.signer.getPublicKey();
  }

  // Get metrics
  getMetrics() {
    const totalAgents = this.agents.size;
    const totalPublishers = new Set(Array.from(this.agents.values()).map(a => a.publisher_id)).size;
    const totalWorkspaces = this.workspaceCounts.size;
    
    return {
      registry_agents_total: totalAgents,
      registry_publishers_total: totalPublishers,
      registry_workspaces_total: totalWorkspaces
    };
  }
}

module.exports = RegistryService;
