import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/errors.ts
var GatewayError = class extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
  }
};
var GatewayAuthError = class extends GatewayError {
  constructor(message, statusCode) {
    super(message, statusCode, "AUTH_ERROR");
  }
};
var GatewayPolicyError = class extends GatewayError {
  constructor(message, statusCode) {
    super(message, statusCode, "POLICY_ERROR");
  }
};
var GatewayRateLimitError = class extends GatewayError {
  constructor(message, retryAfter, statusCode) {
    super(message, statusCode, "RATE_LIMIT_ERROR");
    this.retryAfter = retryAfter;
  }
};
var GatewayUpstreamError = class extends GatewayError {
  constructor(message, statusCode) {
    super(message, statusCode, "UPSTREAM_ERROR");
  }
};
var GatewayNetworkError = class extends GatewayError {
  constructor(message, originalError) {
    super(message, void 0, "NETWORK_ERROR");
    this.originalError = originalError;
  }
};
var GatewayTokenError = class extends GatewayError {
  constructor(message, statusCode) {
    super(message, statusCode, "TOKEN_ERROR");
  }
};
function createErrorFromResponse(statusCode, errorMessage, retryAfter) {
  switch (statusCode) {
    case 401:
    case 403:
      return new GatewayAuthError(errorMessage, statusCode);
    case 429:
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : void 0;
      return new GatewayRateLimitError(errorMessage, retryAfterSeconds, statusCode);
    case 400:
      if (errorMessage.includes("policy") || errorMessage.includes("scope")) {
        return new GatewayPolicyError(errorMessage, statusCode);
      }
      return new GatewayError(errorMessage, statusCode);
    case 502:
    case 503:
    case 504:
      return new GatewayUpstreamError(errorMessage, statusCode);
    default:
      return new GatewayError(errorMessage, statusCode);
  }
}

// src/utils/correlation.ts
function generateCorrelationId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `req_${timestamp}_${random}`;
}
function extractCorrelationId(headers) {
  return headers.get("X-Correlation-Id") || void 0;
}

// src/utils/retry.ts
var DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelay: 1e3,
  maxDelay: 1e4,
  jitter: true
};
function isRetryableError(error) {
  if (error instanceof GatewayRateLimitError) {
    return false;
  }
  if (error.code === "NETWORK_ERROR") {
    return true;
  }
  if (error instanceof GatewayUpstreamError) {
    return true;
  }
  if (error.statusCode && error.statusCode >= 500) {
    return true;
  }
  return false;
}
function calculateDelay(attempt, options) {
  const delay = Math.min(
    options.baseDelay * Math.pow(2, attempt),
    options.maxDelay
  );
  if (options.jitter) {
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return Math.max(0, delay + jitter);
  }
  return delay;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function withRetry(fn, options = {}) {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError;
  for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retryOptions.maxRetries) {
        throw error;
      }
      if (error instanceof GatewayError && !isRetryableError(error)) {
        throw error;
      }
      const delay = calculateDelay(attempt, retryOptions);
      await sleep(delay);
    }
  }
  throw lastError;
}

// src/client.ts
var GatewayClient = class {
  baseUrl;
  agentId;
  agentPrivateKeyPem;
  defaultIntent;
  timeoutMs;
  currentIntent;
  constructor(options) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.agentId = options.agentId;
    this.agentPrivateKeyPem = options.agentPrivateKeyPem;
    this.defaultIntent = options.defaultIntent;
    this.timeoutMs = options.timeoutMs || 6e3;
    this.currentIntent = options.defaultIntent || "";
  }
  /**
   * Set the current intent for requests
   */
  setIntent(intent) {
    this.currentIntent = intent;
  }
  /**
   * Get a new token from the Gateway
   */
  async getToken(opts) {
    const expiresAt = new Date(Date.now() + opts.ttlMinutes * 60 * 1e3).toISOString();
    const response = await this.makeRequest("/api/generate-token", {
      method: "POST",
      body: JSON.stringify({
        agent_id: this.agentId,
        tools: opts.tools,
        permissions: opts.permissions,
        expires_at: expiresAt
      })
    });
    const data = await response.json();
    return data.agent_token;
  }
  /**
   * Make a proxied request through the Gateway
   */
  async proxy(tool, action, params, agentToken, proofPayloadOverride) {
    let token = agentToken;
    if (!token) {
      token = await this.getToken({
        tools: [tool],
        permissions: ["read", "write"],
        ttlMinutes: 10
      });
    }
    if (token) {
      const tokenAge = this.getTokenAge(token);
      if (tokenAge > 24 * 60 * 60 * 1e3) {
        throw new GatewayTokenError("Token is too old (older than 24h)");
      }
    }
    const body = {
      agent_token: token,
      tool,
      action,
      params
    };
    if (this.currentIntent) {
      body.intent = this.currentIntent;
    }
    if (proofPayloadOverride) {
      body.proof_payload = JSON.stringify(proofPayloadOverride);
    }
    const response = await this.makeRequest("/api/proxy-request", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const data = await response.json();
    const rotationRecommended = response.headers.get("X-Token-Rotation-Recommended");
    const tokenExpiresAt = response.headers.get("X-Token-Expires-At");
    if (rotationRecommended === "true") {
      console.warn(`Token rotation recommended! Expires: ${tokenExpiresAt}`);
    }
    return data.data;
  }
  /**
   * Make an async proxy request
   */
  async proxyAsync(tool, action, params, agentToken) {
    let token = agentToken;
    if (!token) {
      token = await this.getToken({
        tools: [tool],
        permissions: ["read", "write"],
        ttlMinutes: 10
      });
    }
    const body = {
      agent_token: token,
      tool,
      action,
      params,
      async: true
    };
    if (this.currentIntent) {
      body.intent = this.currentIntent;
    }
    const response = await this.makeRequest("/api/proxy-request", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return { jobId: data.job_id };
  }
  /**
   * Get job status and result
   */
  async getJob(jobId) {
    const response = await this.makeRequest(`/api/jobs/${jobId}`, {
      method: "GET"
    });
    return await response.json();
  }
  /**
   * Make an HTTP request with retry logic and error handling
   */
  async makeRequest(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const correlationId = generateCorrelationId();
    const requestOptions = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": correlationId,
        "User-Agent": "@4runr/gateway/1.0.0",
        ...options.headers
      },
      signal: AbortSignal.timeout(this.timeoutMs)
    };
    return withRetry(async () => {
      try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          const retryAfter = response.headers.get("Retry-After");
          throw createErrorFromResponse(
            response.status,
            errorData.error || `HTTP ${response.status}`,
            retryAfter || void 0
          );
        }
        return response;
      } catch (error) {
        if (error instanceof GatewayError) {
          throw error;
        }
        if (error instanceof Error) {
          throw new GatewayError(
            `Network error: ${error.message}`,
            void 0,
            "NETWORK_ERROR"
          );
        }
        throw error;
      }
    });
  }
  /**
   * Get token age in milliseconds
   */
  getTokenAge(token) {
    try {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        if (payload.iat) {
          return Date.now() - payload.iat * 1e3;
        }
      }
    } catch {
    }
    return 0;
  }
  /**
   * Mask sensitive parameters in logs
   */
  maskParams(params) {
    const masked = { ...params };
    const sensitiveKeys = ["password", "token", "key", "secret", "api_key"];
    for (const key of sensitiveKeys) {
      if (masked[key]) {
        masked[key] = "***MASKED***";
      }
    }
    return masked;
  }
};
function generateIdempotencyKey() {
  return `idemp_${Date.now()}_${randomUUID()}`;
}
function generateIdempotencyKeyFromData(tool, action, params) {
  const dataString = JSON.stringify({ tool, action, params });
  const hash = __require("crypto").createHash("sha256").update(dataString).digest("hex");
  return `idemp_${hash.substring(0, 16)}`;
}

export { GatewayAuthError, GatewayClient, GatewayError, GatewayNetworkError, GatewayPolicyError, GatewayRateLimitError, GatewayTokenError, GatewayUpstreamError, calculateDelay, createErrorFromResponse, extractCorrelationId, generateCorrelationId, generateIdempotencyKey, generateIdempotencyKeyFromData, isRetryableError, sleep, withRetry };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map