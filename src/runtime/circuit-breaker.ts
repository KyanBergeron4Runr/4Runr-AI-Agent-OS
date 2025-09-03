import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing - reject requests  
  HALF_OPEN = 'HALF_OPEN' // Testing - allow limited requests
}

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Time before trying half-open
  monitoringPeriod: number;    // Time window for failure counting
  volumeThreshold: number;     // Minimum requests before considering failures
  halfOpenMaxCalls: number;    // Max calls allowed in half-open state
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  requests: number;
  lastFailureTime: number;
  nextAttempt: number;
}

export class CircuitBreaker extends EventEmitter {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private requests = 0;
  private lastFailureTime = 0;
  private nextAttempt = 0;
  private halfOpenCalls = 0;
  private requestHistory: { timestamp: number; success: boolean }[] = [];

  constructor(private options: CircuitBreakerOptions) {
    super();
    this.cleanupHistory();
  }

  // Execute a function with circuit breaker protection
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.allowRequest()) {
      throw new Error(`Circuit breaker is ${this.state} - request rejected`);
    }

    this.requests++;
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  // Check if request should be allowed
  private allowRequest(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        if (now >= this.nextAttempt) {
          this.state = CircuitState.HALF_OPEN;
          this.halfOpenCalls = 0;
          this.emit('state-change', this.state);
          console.log('🔄 Circuit breaker HALF_OPEN - testing recovery');
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return this.halfOpenCalls < this.options.halfOpenMaxCalls;

      default:
        return false;
    }
  }

  private onSuccess(): void {
    this.recordRequest(true);
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Recovery successful
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      this.halfOpenCalls = 0;
      this.emit('state-change', this.state);
      console.log('✅ Circuit breaker CLOSED - recovery successful');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.recordRequest(false);

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery
      this.openCircuit();
    } else if (this.shouldOpenCircuit()) {
      this.openCircuit();
    }
  }

  private shouldOpenCircuit(): boolean {
    if (this.requests < this.options.volumeThreshold) {
      return false; // Not enough requests to judge
    }

    const recentFailures = this.getRecentFailures();
    const failureRate = recentFailures / this.getRecentRequests();
    
    return failureRate >= (this.options.failureThreshold / 100);
  }

  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.recoveryTimeout;
    this.emit('state-change', this.state);
    
    const failureRate = Math.round((this.getRecentFailures() / this.getRecentRequests()) * 100);
    console.log(`🚨 Circuit breaker OPEN - ${failureRate}% failure rate (${this.getRecentFailures()}/${this.getRecentRequests()} requests)`);
  }

  private recordRequest(success: boolean): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      success
    });
  }

  private getRecentRequests(): number {
    const cutoff = Date.now() - this.options.monitoringPeriod;
    return this.requestHistory.filter(req => req.timestamp >= cutoff).length;
  }

  private getRecentFailures(): number {
    const cutoff = Date.now() - this.options.monitoringPeriod;
    return this.requestHistory.filter(req => req.timestamp >= cutoff && !req.success).length;
  }

  private cleanupHistory(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.options.monitoringPeriod;
      this.requestHistory = this.requestHistory.filter(req => req.timestamp >= cutoff);
    }, this.options.monitoringPeriod / 2);
  }

  // Get current stats
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      requests: this.requests,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }

  // Manual controls for testing
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.recoveryTimeout;
    this.emit('state-change', this.state);
    console.log('🔧 Circuit breaker manually OPENED');
  }

  forceClose(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.halfOpenCalls = 0;
    this.emit('state-change', this.state);
    console.log('🔧 Circuit breaker manually CLOSED');
  }
}

// Default circuit breaker for the gateway
export const gatewayCircuitBreaker = new CircuitBreaker({
  failureThreshold: 50,      // 50% failure rate triggers open
  recoveryTimeout: 30000,    // 30 seconds before retry
  monitoringPeriod: 60000,   // 1 minute monitoring window
  volumeThreshold: 10,       // Need at least 10 requests
  halfOpenMaxCalls: 5        // Allow 5 test calls when half-open
});
