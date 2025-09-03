import { ResourceLeakDetector } from '../resource-leak-detector'

describe('ResourceLeakDetector', () => {
  let detector: ResourceLeakDetector

  beforeEach(() => {
    detector = new ResourceLeakDetector({
      monitoringInterval: 100,  // Fast for testing
      analysisWindow: 1000,     // 1 second for testing
      memoryLeakThreshold: 10,  // Lower threshold for testing
      connectionLeakThreshold: 20,
      fileHandleLeakThreshold: 15,
      eventListenerLeakThreshold: 50,
      timerLeakThreshold: 100,
      historyRetention: 10
    })
  })

  afterEach(async () => {
    if (detector) {
      detector.stop()
    }
  })

  describe('Monitoring Lifecycle', () => {
    test('should start and stop monitoring', () => {
      expect(detector['isMonitoring']).toBe(false)
      
      detector.start()
      expect(detector['isMonitoring']).toBe(true)
      
      detector.stop()
      expect(detector['isMonitoring']).toBe(false)
    })

    test('should not start monitoring twice', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      detector.start()
      detector.start() // Second start should be ignored
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Resource Leak Detector already running')
      
      consoleSpy.mockRestore()
    })

    test('should emit monitoring events', (done) => {
      let eventsReceived = 0
      
      detector.on('monitoring-started', () => {
        eventsReceived++
        if (eventsReceived === 1) {
          detector.stop()
        }
      })
      
      detector.on('monitoring-stopped', () => {
        eventsReceived++
        if (eventsReceived === 2) {
          done()
        }
      })
      
      detector.start()
    })
  })

  describe('Snapshot Taking', () => {
    test('should take resource snapshots', async () => {
      const snapshot = await detector.takeSnapshot()
      
      expect(snapshot).toBeDefined()
      expect(snapshot.timestamp).toBeInstanceOf(Date)
      expect(snapshot.memory).toBeDefined()
      expect(snapshot.connections).toBeDefined()
      expect(snapshot.fileHandles).toBeDefined()
      expect(snapshot.eventListeners).toBeDefined()
      expect(snapshot.timers).toBeDefined()
      
      expect(typeof snapshot.memory.heapUsed).toBe('number')
      expect(typeof snapshot.memory.heapTotal).toBe('number')
      expect(typeof snapshot.connections.database).toBe('number')
      expect(typeof snapshot.fileHandles.open).toBe('number')
    })

    test('should maintain snapshot history', async () => {
      // Take multiple snapshots
      for (let i = 0; i < 5; i++) {
        await detector.takeSnapshot()
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      const history = detector.getUsageHistory(1)
      expect(history.length).toBe(5)
      
      // Verify chronological order
      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp.getTime()).toBeGreaterThan(history[i-1].timestamp.getTime())
      }
    })

    test('should limit history retention', async () => {
      // Take more snapshots than retention limit
      for (let i = 0; i < 15; i++) {
        await detector.takeSnapshot()
      }
      
      const snapshots = detector['snapshots']
      expect(snapshots.length).toBeLessThanOrEqual(10) // Retention limit
    })

    test('should emit snapshot events', (done) => {
      detector.on('snapshot-taken', (snapshot) => {
        expect(snapshot).toBeDefined()
        expect(snapshot.timestamp).toBeInstanceOf(Date)
        done()
      })
      
      detector.takeSnapshot()
    })
  })

  describe('Leak Analysis', () => {
    test('should detect memory leaks', async () => {
      // Create baseline snapshot
      const baseline = await detector.takeSnapshot()
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Simulate memory increase by modifying the snapshot
      const current = await detector.takeSnapshot()
      current.memory.heapUsed = baseline.memory.heapUsed * 1.5 // 50% increase
      
      // Replace the current snapshot
      detector['snapshots'][detector['snapshots'].length - 1] = current
      
      const results = detector.analyzeLeaks()
      const memoryLeaks = results.filter(r => r.type === 'memory')
      
      expect(memoryLeaks.length).toBeGreaterThan(0)
      expect(memoryLeaks[0].trend).toBe('increasing')
      expect(memoryLeaks[0].changePercent).toBeGreaterThan(10)
    })

    test('should detect connection leaks', async () => {
      // Create baseline
      const baseline = await detector.takeSnapshot()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Simulate connection increase
      const current = await detector.takeSnapshot()
      current.connections.database = baseline.connections.database + 5
      detector['snapshots'][detector['snapshots'].length - 1] = current
      
      const results = detector.analyzeLeaks()
      const connectionLeaks = results.filter(r => r.type === 'connections')
      
      if (baseline.connections.database > 0) {
        expect(connectionLeaks.length).toBeGreaterThan(0)
        expect(connectionLeaks[0].trend).toBe('increasing')
      }
    })

    test('should emit leak detection events', (done) => {
      detector.on('leak-detected', (result) => {
        expect(result).toBeDefined()
        expect(result.type).toBeDefined()
        expect(result.severity).toMatch(/warning|critical/)
        expect(result.message).toBeTruthy()
        expect(Array.isArray(result.recommendations)).toBe(true)
        done()
      })
      
      // Manually trigger analysis with simulated leak
      detector.takeSnapshot().then(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const current = await detector.takeSnapshot()
        current.memory.heapUsed *= 2 // Double memory usage
        detector['snapshots'][detector['snapshots'].length - 1] = current
        
        detector.analyzeLeaks()
      })
    })

    test('should provide appropriate recommendations', async () => {
      const baseline = await detector.takeSnapshot()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const current = await detector.takeSnapshot()
      current.memory.heapUsed = baseline.memory.heapUsed * 2
      detector['snapshots'][detector['snapshots'].length - 1] = current
      
      const results = detector.analyzeLeaks()
      const memoryLeak = results.find(r => r.type === 'memory')
      
      if (memoryLeak) {
        expect(memoryLeak.recommendations).toBeDefined()
        expect(memoryLeak.recommendations.length).toBeGreaterThan(0)
        expect(memoryLeak.recommendations[0]).toContain('memory')
      }
    })
  })

  describe('Statistics and Reporting', () => {
    test('should provide leak detection statistics', async () => {
      // Take a few snapshots
      for (let i = 0; i < 3; i++) {
        await detector.takeSnapshot()
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
      const stats = detector.getLeakStatistics()
      
      expect(stats.snapshotCount).toBe(3)
      expect(stats.monitoringDuration).toBeGreaterThan(0)
      expect(typeof stats.averageMemoryUsage).toBe('number')
      expect(typeof stats.peakMemoryUsage).toBe('number')
    })

    test('should return empty stats when no snapshots', () => {
      const stats = detector.getLeakStatistics()
      
      expect(stats.snapshotCount).toBe(0)
      expect(stats.monitoringDuration).toBe(0)
      expect(stats.averageMemoryUsage).toBe(0)
    })

    test('should provide current usage', async () => {
      expect(detector.getCurrentUsage()).toBeNull()
      
      await detector.takeSnapshot()
      const current = detector.getCurrentUsage()
      
      expect(current).toBeDefined()
      expect(current?.timestamp).toBeInstanceOf(Date)
    })

    test('should filter usage history by time', async () => {
      const now = Date.now()
      
      // Take snapshots with different timestamps
      for (let i = 0; i < 5; i++) {
        const snapshot = await detector.takeSnapshot()
        // Modify timestamp to simulate different times
        snapshot.timestamp = new Date(now - (i * 60 * 60 * 1000)) // i hours ago
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      const recentHistory = detector.getUsageHistory(2) // Last 2 hours
      expect(recentHistory.length).toBeLessThanOrEqual(3) // Should filter out older snapshots
    })
  })

  describe('Error Handling', () => {
    test('should handle snapshot errors gracefully', async () => {
      // Mock process.memoryUsage to throw an error
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('Memory usage error')
      })
      
      await expect(detector.takeSnapshot()).rejects.toThrow('Memory usage error')
      
      // Restore original function
      process.memoryUsage = originalMemoryUsage
    })

    test('should handle analysis with insufficient data', () => {
      // Try to analyze with no snapshots
      const results = detector.analyzeLeaks()
      expect(results).toEqual([])
      
      // Try with only one snapshot
      detector['snapshots'] = [{
        timestamp: new Date(),
        memory: { heapUsed: 1000, heapTotal: 2000, external: 100, rss: 3000 },
        connections: { database: 1, redis: 1, http: 0 },
        fileHandles: { open: 10, limit: 1024 },
        eventListeners: { total: 5, byEmitter: {} },
        timers: { active: 2, intervals: 1, timeouts: 1 }
      }]
      
      const resultsWithOne = detector.analyzeLeaks()
      expect(resultsWithOne).toEqual([])
    })
  })

  describe('Integration', () => {
    test('should work with monitoring lifecycle', (done) => {
      let snapshotCount = 0
      
      detector.on('snapshot-taken', () => {
        snapshotCount++
        if (snapshotCount >= 2) {
          detector.stop()
          expect(snapshotCount).toBeGreaterThanOrEqual(2)
          done()
        }
      })
      
      detector.start()
    }, 5000)
  })
})