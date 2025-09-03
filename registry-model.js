const crypto = require('crypto');

// Registry Data Models
class RegistryAgent {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.namespace = data.namespace; // user or org
    this.name = data.name;
    this.slug = data.slug; // namespace/name
    this.version = data.version; // semver
    this.visibility = data.visibility || 'public';
    this.manifest_hash = data.manifest_hash;
    this.signature = data.signature;
    this.owner_workspace_id = data.owner_workspace_id;
    this.publisher_id = data.publisher_id;
    this.verified = data.verified || false;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  static validate(data) {
    const errors = [];
    
    if (!data.namespace) errors.push('namespace is required');
    if (!data.name) errors.push('name is required');
    if (!data.slug) errors.push('slug is required');
    if (!data.version) errors.push('version is required');
    if (!data.owner_workspace_id) errors.push('owner_workspace_id is required');
    if (!data.publisher_id) errors.push('publisher_id is required');
    
    // Validate slug format
    if (data.slug && !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(data.slug)) {
      errors.push('slug must be in format namespace/name with lowercase letters, numbers, and hyphens only');
    }
    
    // Validate semver
    if (data.version && !/^\d+\.\d+\.\d+$/.test(data.version)) {
      errors.push('version must be valid semver (e.g., 1.0.0)');
    }
    
    // Check reserved namespaces
    if (data.namespace === '4runr') {
      errors.push('4runr namespace is reserved');
    }
    
    return errors;
  }
}

class Manifest {
  constructor(data) {
    this.manifest_version = data.manifest_version || '1.0';
    this.entry = data.entry;
    this.language = data.language;
    this.policy_refs = data.policy_refs || [];
    this.env_ref_names = data.env_ref_names || [];
    this.readme_md = data.readme_md || '';
    this.tags = data.tags || [];
    this.examples = data.examples || [];
    this.summary = data.summary || '';
    this.created_at = data.created_at || new Date().toISOString();
    this.publisher_id = data.publisher_id;
  }

  static validate(data) {
    const errors = [];
    
    if (!data.entry) errors.push('entry is required');
    if (!data.language) errors.push('language is required');
    if (!['js', 'py', 'ts'].includes(data.language)) {
      errors.push('language must be js, py, or ts');
    }
    
    return errors;
  }

  static sanitizeReadme(readme) {
    if (!readme) return '';
    
    // Remove script tags and iframes
    return readme
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
      .replace(/<iframe[^>]*\/>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  toJSON() {
    return {
      manifest_version: this.manifest_version,
      entry: this.entry,
      language: this.language,
      policy_refs: this.policy_refs,
      env_ref_names: this.env_ref_names,
      readme_md: this.readme_md,
      tags: this.tags,
      examples: this.examples,
      summary: this.summary,
      created_at: this.created_at,
      publisher_id: this.publisher_id
    };
  }
}

// Registry signing utilities
class RegistrySigner {
  constructor(privateKey = null) {
    this.privateKey = privateKey || crypto.randomBytes(32).toString('hex');
    // For demo purposes, we'll use a simple HMAC-based approach
    // In production, you'd use proper asymmetric cryptography
  }

  signManifest(manifest, agentData) {
    const content = JSON.stringify({
      manifest: manifest.toJSON(),
      agent: {
        namespace: agentData.namespace,
        name: agentData.name,
        slug: agentData.slug,
        version: agentData.version,
        publisher_id: agentData.publisher_id,
        created_at: agentData.created_at
      }
    });
    
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const signature = crypto.createHmac('sha256', this.privateKey).update(hash).digest('hex');
    
    return { hash, signature };
  }

  verifySignature(manifest, agentData, hash, signature) {
    const content = JSON.stringify({
      manifest: manifest.toJSON(),
      agent: {
        namespace: agentData.namespace,
        name: agentData.name,
        slug: agentData.slug,
        version: agentData.version,
        publisher_id: agentData.publisher_id,
        created_at: agentData.created_at
      }
    });
    
    const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
    const expectedSignature = crypto.createHmac('sha256', this.privateKey).update(expectedHash).digest('hex');
    
    return hash === expectedHash && signature === expectedSignature;
  }

  getPublicKey() {
    // For demo purposes, return a simple identifier
    // In production, you'd return the actual public key
    return `registry-public-key-${this.privateKey.substring(0, 8)}`;
  }
}

// Name policy enforcement
class NamePolicy {
  static RESERVED_NAMESPACES = ['4runr', 'admin', 'system', 'root'];
  static TRADEMARK_DENYLIST = ['microsoft', 'google', 'apple', 'amazon', 'meta', 'openai', 'anthropic'];
  
  static validateSlug(slug) {
    const errors = [];
    
    if (!slug) {
      errors.push('slug is required');
      return errors;
    }
    
    const [namespace, name] = slug.split('/');
    
    if (!namespace || !name) {
      errors.push('slug must be in format namespace/name');
      return errors;
    }
    
    // Check reserved namespaces
    if (this.RESERVED_NAMESPACES.includes(namespace.toLowerCase())) {
      errors.push(`namespace '${namespace}' is reserved`);
    }
    
    // Check trademark denylist
    if (this.TRADEMARK_DENYLIST.includes(namespace.toLowerCase()) || 
        this.TRADEMARK_DENYLIST.includes(name.toLowerCase())) {
      errors.push('slug contains reserved trademark');
    }
    
    // Check format
    if (!/^[a-z0-9-]+$/.test(namespace) || !/^[a-z0-9-]+$/.test(name)) {
      errors.push('namespace and name must contain only lowercase letters, numbers, and hyphens');
    }
    
    return errors;
  }
}

// Plan enforcement
class PlanEnforcement {
  static PLANS = {
    free: { maxPublicAgents: 5 },
    pro: { maxPublicAgents: 50 }
  };
  
  static checkPublishLimit(workspaceId, currentCount, plan = 'free') {
    const limit = this.PLANS[plan]?.maxPublicAgents || this.PLANS.free.maxPublicAgents;
    
    if (currentCount >= limit) {
      return {
        allowed: false,
        error: `Publish limit reached (${currentCount}/${limit}). Upgrade to Pro for higher limits.`
      };
    }
    
    return { allowed: true };
  }
}

module.exports = {
  RegistryAgent,
  Manifest,
  RegistrySigner,
  NamePolicy,
  PlanEnforcement
};
