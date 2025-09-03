import { EventEmitter } from 'events'

export interface SentinelRun {
  id: string
  status: 'running' | 'completed' | 'failed' | 'canceled'
  startTime: Date
  endTime?: Date
  metadata: Record<string, any>
}

export interface SentinelEvent {
  type: string
  timestamp: Date
  data: any
}

export class Sentinel {
  private static instance: Sentinel
  private activeRuns: Map<string, SentinelRun> = new Map()
  private eventStreams: Map<string, EventEmitter> = new Map()

  private constructor() {}

  public static getInstance(): Sentinel {
    if (!Sentinel.instance) {
      Sentinel.instance = new Sentinel()
    }
    return Sentinel.instance
  }

  /**
   * Watch a run for events and potential issues
   * @param runId - The ID of the run to watch
   * @param events$ - Event stream to monitor
   */
  public watchRun(runId: string, events$: EventEmitter): void {
    console.log(`🔍 Sentinel: Watching run ${runId}`)
    
    // Store the event stream
    this.eventStreams.set(runId, events$)
    
    // Create run record
    const run: SentinelRun = {
      id: runId,
      status: 'running',
      startTime: new Date(),
      metadata: {}
    }
    this.activeRuns.set(runId, run)

    // Listen for events
    events$.on('data', (event: SentinelEvent) => {
      this.processEvent(runId, event)
    })

    events$.on('error', (error: Error) => {
      console.error(`❌ Sentinel: Error in run ${runId}:`, error)
      this.markRunFailed(runId, error.message)
    })

    events$.on('end', () => {
      console.log(`✅ Sentinel: Run ${runId} completed`)
      this.markRunCompleted(runId)
    })
  }

  /**
   * Kill a running process
   * @param runId - The ID of the run to kill
   * @param reason - Reason for killing the run
   */
  public kill(runId: string, reason: string): boolean {
    console.log(`🛑 Sentinel: Killing run ${runId} - Reason: ${reason}`)
    
    const run = this.activeRuns.get(runId)
    if (!run) {
      console.warn(`⚠️ Sentinel: Run ${runId} not found`)
      return false
    }

    if (run.status === 'completed' || run.status === 'failed') {
      console.warn(`⚠️ Sentinel: Run ${runId} already ${run.status}`)
      return false
    }

    // Mark as canceled
    run.status = 'canceled'
    run.endTime = new Date()
    run.metadata.cancelReason = reason

    // Close event stream
    const eventStream = this.eventStreams.get(runId)
    if (eventStream) {
      eventStream.removeAllListeners()
      eventStream.emit('end')
      this.eventStreams.delete(runId)
    }

    console.log(`✅ Sentinel: Run ${runId} killed successfully`)
    return true
  }

  /**
   * Get status of all active runs
   */
  public getActiveRuns(): SentinelRun[] {
    return Array.from(this.activeRuns.values())
  }

  /**
   * Get status of a specific run
   */
  public getRunStatus(runId: string): SentinelRun | undefined {
    return this.activeRuns.get(runId)
  }

  private processEvent(runId: string, event: SentinelEvent): void {
    const run = this.activeRuns.get(runId)
    if (!run) return

    // Process different event types
    switch (event.type) {
      case 'run_started':
        run.status = 'running'
        break
      case 'run_completed':
        this.markRunCompleted(runId)
        break
      case 'run_failed':
        this.markRunFailed(runId, event.data?.error || 'Unknown error')
        break
      case 'run_canceled':
        run.status = 'canceled'
        run.endTime = new Date()
        break
      default:
        // Store other events in metadata
        if (!run.metadata.events) run.metadata.events = []
        run.metadata.events.push(event)
    }
  }

  private markRunCompleted(runId: string): void {
    const run = this.activeRuns.get(runId)
    if (run) {
      run.status = 'completed'
      run.endTime = new Date()
    }
  }

  private markRunFailed(runId: string, error: string): void {
    const run = this.activeRuns.get(runId)
    if (run) {
      run.status = 'failed'
      run.endTime = new Date()
      run.metadata.error = error
    }
  }

  /**
   * Cleanup completed/failed runs
   */
  public cleanup(): void {
    const now = new Date()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    for (const [runId, run] of this.activeRuns.entries()) {
      if (run.endTime && (now.getTime() - run.endTime.getTime()) > maxAge) {
        this.activeRuns.delete(runId)
        this.eventStreams.delete(runId)
      }
    }
  }
}

// Export singleton instance
export const sentinel = Sentinel.getInstance()
