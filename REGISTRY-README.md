# 4Runr Agent Registry - MVP Implementation

## 🚀 **Agent Registry System Overview**

This is a complete agent registry implementation that enables builders to publish agents and others to discover + pull them (Docker-Hub style). This unlocks the ecosystem loop.

## 📋 **Quick Start**

### 1. **Start the Registry Gateway**
```bash
# Stop any existing processes
.\stop-reliable.bat

# Start the registry gateway
.\start-registry.bat
```

### 2. **Test the Registry System**
```bash
# Run comprehensive tests
.\test-registry.bat
```

### 3. **Use the Registry CLI**
```bash
# Search for agents
node registry-cli.js search "data processor"

# Show agent details
node registry-cli.js show demo/hello-world

# Publish an agent
node registry-cli.js publish demo-enricher

# Pull an agent
node registry-cli.js pull demo/hello-world
```

## 🏗️ **System Architecture**

### **Core Components**

1. **Registry Data Model** (`registry-model.js`)
   - `RegistryAgent`: Complete agent metadata
   - `Manifest`: Agent configuration and metadata
   - `RegistrySigner`: Cryptographic signing utilities
   - `NamePolicy`: Namespace and naming enforcement
   - `PlanEnforcement`: Subscription plan limits

2. **Registry Service** (`registry-service.js`)
   - Agent publication and validation
   - Search and discovery
   - Manifest signing and verification
   - Rate limiting and abuse protection

3. **Registry Gateway** (`registry-gateway.js`)
   - HTTP API endpoints
   - Integration with existing agent execution
   - CORS and security headers

4. **Registry CLI** (`registry-cli.js`)
   - Publish, search, pull, show commands
   - Interactive prompts for metadata
   - Signature verification

## 🔧 **API Endpoints**

### **Registry Endpoints**
- `GET /api/registry/agents` - Search agents (with query, filters, pagination)
- `GET /api/registry/agents/:slug` - Get agent details
- `GET /api/registry/agents/:slug/manifest` - Get signed manifest
- `POST /api/agents/:id/publish` - Publish agent to registry
- `POST /api/registry/report` - Report abuse
- `GET /api/registry/public-key` - Get registry public key

### **Original Gateway Endpoints** (Still Available)
- `GET /api/agents` - List local agents
- `POST /api/agents/:slug/run` - Start agent run
- `GET /api/runs` - List runs
- `GET /api/runs/:id/logs/stream` - Stream logs (SSE)

## 🛡️ **Security & Integrity Features**

### **Manifest Signing**
- Each manifest is cryptographically signed
- Prevents tampering and ensures authenticity
- CLI verifies signatures before importing

### **Name Policy Enforcement**
- Reserved namespaces: `4runr`, `admin`, `system`, `root`
- Trademark denylist: `microsoft`, `google`, `apple`, etc.
- Slug format: `[a-z0-9-]/[a-z0-9-]` only

### **Content Sanitization**
- README sanitization removes script tags and iframes
- No remote code execution at publish time
- Safe subset of markdown allowed

### **Plan Enforcement**
- Free plan: 5 public agents max
- Pro plan: 50 public agents max
- Clear error messages on cap violations

### **Abuse Protection**
- Report system for problematic agents
- Rate limiting on search and fetch
- Moderation inbox for review

## 📊 **Data Models**

### **RegistryAgent**
```javascript
{
  id: "uuid",
  namespace: "user-or-org",
  name: "agent-name",
  slug: "namespace/name",
  version: "1.0.0",
  visibility: "public",
  manifest_hash: "sha256-hash",
  signature: "crypto-signature",
  owner_workspace_id: "workspace-id",
  publisher_id: "publisher-id",
  verified: false,
  created_at: "iso-timestamp",
  updated_at: "iso-timestamp"
}
```

### **Manifest**
```javascript
{
  manifest_version: "1.0",
  entry: "node index.js",
  language: "js",
  policy_refs: ["default"],
  env_ref_names: ["API_KEY"],
  readme_md: "# Agent Description",
  tags: ["data", "ml"],
  examples: [],
  summary: "Brief description",
  created_at: "iso-timestamp",
  publisher_id: "publisher-id"
}
```

## 🎯 **CLI Commands**

### **Registry Commands**
```bash
# Publish an agent
node registry-cli.js publish <agent-slug>

# Search for agents
node registry-cli.js search "<query>"

# Pull an agent
node registry-cli.js pull <namespace/name[@version]>

# Show agent details
node registry-cli.js show <namespace/name>

# Report abuse
node registry-cli.js report <slug> "<reason>"
```

### **Execution Commands** (Same as before)
```bash
# Start an agent run
node registry-cli.js run <agent-slug>

# List active runs
node registry-cli.js ps

# Stream logs
node registry-cli.js logs <run-id>

# Stop a run
node registry-cli.js stop <run-id>

# List local agents
node registry-cli.js list

# Check status
node registry-cli.js status
```

## 🧪 **Testing & Validation**

### **Prove-It Test Suite**
The `prove-it-registry-mvp.js` test performs comprehensive end-to-end validation:

1. **Publish Test** - Publishes a demo agent with metadata
2. **Search Test** - Verifies the agent appears in search results
3. **Manifest Verification** - Validates signed manifest structure
4. **Pull & Run Test** - Simulates pulling and running the agent
5. **Tamper Protection** - Tests signature verification against tampering
6. **Version Bump** - Verifies version incrementing works
7. **Name Policy** - Ensures reserved namespaces are blocked
8. **Plan Enforcement** - Validates subscription limits
9. **Abuse Reporting** - Tests report submission
10. **Rate Limiting** - Verifies request throttling

### **Manual Acceptance Tests**

#### **Publish Happy Path**
```bash
# Create and publish an agent
node registry-cli.js publish demo-enricher
# Expect: 201 Created, registry listing shows agent, manifest signed, version 1.0.0
```

#### **Search & Pull**
```bash
# Search for the published agent
node registry-cli.js search "data processor"
# Expect: Results include the published slug

# Pull the agent
node registry-cli.js pull test-company/data-processor
# Expect: CLI verifies signature, imports manifest, agent is runnable
```

#### **Version Bump**
```bash
# Publish again with changes
node registry-cli.js publish demo-enricher
# Expect: Version increments (1.0.1), both versions available
```

#### **Security Tests**
```bash
# Try reserved namespace
node registry-cli.js publish demo-enricher
# Enter: 4runr/test-agent
# Expect: Blocked with reserved-namespace error
```

## 📈 **Metrics & Monitoring**

### **Registry Metrics**
- `registry_agents_total` - Total published agents
- `registry_publishers_total` - Unique publishers
- `registry_workspaces_total` - Active workspaces
- `registry_publish_total` - Publication events
- `registry_pull_total` - Pull events
- `registry_search_total` - Search events
- `registry_signature_verify_fail_total` - Verification failures

### **Logging**
- Structured logs with slug, version, publisher_id, workspace_id
- Never logs manifest body or secrets
- Abuse reports logged for moderation

## 🚨 **Error Handling**

### **Common Error Scenarios**
- **Name Policy Violations**: Clear error messages for reserved namespaces
- **Plan Limits**: Upgrade prompts when caps are reached
- **Signature Failures**: Detailed verification error messages
- **Rate Limiting**: 429 responses with retry guidance
- **Validation Errors**: Specific field-level error details

### **Recovery Procedures**
- **Publish Failures**: Retry with corrected metadata
- **Pull Failures**: Verify network and try again
- **Signature Failures**: Re-pull from registry
- **Rate Limits**: Wait and retry with exponential backoff

## 🔄 **Workflow Examples**

### **Publisher Workflow**
```bash
# 1. Develop agent locally
node cli.js run my-agent

# 2. Publish to registry
node registry-cli.js publish my-agent
# Enter: namespace, name, summary, tags, README

# 3. Verify publication
node registry-cli.js show mycompany/my-agent
```

### **Consumer Workflow**
```bash
# 1. Search for agents
node registry-cli.js search "data processing"

# 2. View agent details
node registry-cli.js show company/data-processor

# 3. Pull the agent
node registry-cli.js pull company/data-processor

# 4. Run the agent
node registry-cli.js run company/data-processor-local
```

## 🎉 **Success Criteria**

The registry system is considered successful when:

✅ **A second account can discover → pull → run your agent in <5 minutes**
✅ **Signed manifests prevent tampering**
✅ **Caps and name policy enforced**
✅ **Prove-It script passes end-to-end**
✅ **All security features working**
✅ **Rate limiting and abuse protection active**

## 🚀 **Production Readiness**

The registry MVP is production-ready with:
- ✅ **Complete data models and validation**
- ✅ **Cryptographic signing and verification**
- ✅ **Security policies and enforcement**
- ✅ **Rate limiting and abuse protection**
- ✅ **Comprehensive testing suite**
- ✅ **Error handling and recovery**
- ✅ **Metrics and monitoring**
- ✅ **Documentation and examples**

**The system is designed to unlock the agent ecosystem loop and enable seamless agent sharing and discovery!** 🎯
