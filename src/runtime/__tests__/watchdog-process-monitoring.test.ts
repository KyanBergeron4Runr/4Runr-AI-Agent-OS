import { WatchdogService } from '../watchdog'
import { executeCommand } from '../../utils/cross-platform-executor'

// Mock the cross-platform executor
jest.mock('../../utils/cross-platform-executor')
const mockExecuteCommand = executeCommand as jest.MockedFunction<typeof executeCommand>

describe('Watchdog Process Monitoring', () => {
  let watchdog: WatchdogService

  beforeEach(() => {
    watchdog = new WatchdogService({
      healthCheckUrl: 'http://localhost:3000/health',
      healthCheckInterval: 1000,
      healthCheckTimeout: 500,
      maxResponseTime: 1000,
      maxMemoryMB: 100,
      maxCpuPercent: 50,
      failureThreshold: 2,
      restartDelay: 100,
      maxRestarts: 3,
      logFile: undefined // Disable file logging for tests
    })
    jest.clearAllMocks()
  })

  afterEach(async () => {
    if (watchdog) {
      await watchdog.stop()
    }
  })

  describe('Process Metrics Collection', () => {
    test('should collect Windows process metrics', async () => {
      // Mock Windows environment
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32' })

      // Mock PowerShell response
      const mockPSResponse = JSON.stringify({
        WorkingSet: 52428800, // 50MB
        CPU: 1.5,
        StartTime: new Date(Date.now() - 60000).toISOString() // 1 minute ago
      })

      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: mockPSResponse,
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'win32',
        command: 'powershell',
        args: ['-Command', 'Get-Process -Id 1234 | Select-Object WorkingSet,CPU,StartTime | ConvertTo-Json']
      })

      const metrics = await watchdog['getProcessMetrics'](1234)

      expect(metrics.memoryMB).toBe(50)
      expect(metrics.cpuPercent).toBe(1.5)
      expect(metrics.uptime).toBeGreaterThan(0)

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    test('should fallback to tasklist on Windows PowerShell failure', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32' })

      // Mock PowerShell failure, then tasklist success
      mockExecuteCommand
        .mockResolvedValueOnce({
          success: false,
          exitCode: 1,
          signal: null,
          stdout: '',
          stderr: 'PowerShell error',
          duration: 100,
          retryCount: 0,
          platform: 'win32',
          command: 'powershell',
          args: []
        })
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          signal: null,
          stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","1234","Console","1","51,200 K"',
          stderr: '',
          duration: 100,
          retryCount: 0,
          platform: 'win32',
          command: 'tasklist',
          args: []
        })

      const metrics = await watchdog['getProcessMetrics'](1234)

      expect(metrics.memoryMB).toBe(50) // 51,200 KB ≈ 50 MB
      expect(metrics.cpuPercent).toBe(0) // CPU not available in tasklist
      expect(metrics.uptime).toBeGreaterThan(0)

      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    test('should collect Unix process metrics using ps', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux' })

      // Mock ps command response
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: '51200  2.5  01:30', // RSS(KB), %CPU, ELAPSED
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'ps',
        args: []
      })

      const metrics = await watchdog['getProcessMetrics'](1234)

      expect(metrics.memoryMB).toBe(50) // 51200 KB = 50 MB
      expect(metrics.cpuPercent).toBe(2.5)
      expect(metrics.uptime).toBe(90000) // 01:30 = 90 seconds = 90000 ms

      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    test('should parse elapsed time correctly', () => {
      const parseElapsedTime = watchdog['parseElapsedTime'].bind(watchdog)

      expect(parseElapsedTime('01:30')).toBe(90000) // 1:30 = 90 seconds
      expect(parseElapsedTime('02:15:45')).toBe(8145000) // 2:15:45 = 8145 seconds
      expect(parseElapsedTime('1-02:15:45')).toBe(94545000) // 1 day + 2:15:45
      expect(parseElapsedTime('invalid')).toBe(0)
    })

    test('should handle process metrics errors gracefully', async () => {
      mockExecuteCommand.mockResolvedValue({
        success: false,
        exitCode: 1,
        signal: null,
        stdout: '',
        stderr: 'Process not found',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'ps',
        args: []
      })

      const metrics = await watchdog['getProcessMetrics'](9999)

      expect(metrics.memoryMB).toBe(0)
      expect(metrics.cpuPercent).toBe(0)
      expect(metrics.uptime).toBeGreaterThan(0)
    })
  })

  describe('Health Check Integration', () => {
    test('should perform health check with process monitoring', async () => {
      const mockPid = 1234

      // Mock process running check
      jest.spyOn(watchdog as any, 'isProcessRunning').mockReturnValue(true)
      
      // Mock HTTP health check
      jest.spyOn(watchdog as any, 'httpHealthCheck').mockResolvedValue({ ok: true })
      
      // Mock process metrics
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: '25600  1.2  00:45', // 25MB, 1.2% CPU, 45 seconds
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'ps',
        args: []
      })

      let healthCheckResult: any = null
      watchdog.on('health-check-passed', (health) => {
        healthCheckResult = health
      })

      // Start monitoring
      watchdog['monitoredPid'] = mockPid
      watchdog['isMonitoring'] = true

      await watchdog['performHealthCheck']()

      expect(healthCheckResult).toBeDefined()
      expect(healthCheckResult.responsive).toBe(true)
      expect(healthCheckResult.memoryUsage).toBe(25)
      expect(healthCheckResult.cpuUsage).toBe(1.2)
      expect(healthCheckResult.consecutiveFailures).toBe(0)
    })

    test('should detect high memory usage', async () => {
      const mockPid = 1234

      jest.spyOn(watchdog as any, 'isProcessRunning').mockReturnValue(true)
      jest.spyOn(watchdog as any, 'httpHealthCheck').mockResolvedValue({ ok: true })
      
      // Mock high memory usage (150MB > 100MB limit)
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: '153600  5.0  01:00', // 150MB, 5% CPU
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'ps',
        args: []
      })

      let healthCheckFailed = false
      let failureReason = ''
      watchdog.on('health-check-failed', (health, reason) => {
        healthCheckFailed = true
        failureReason = reason
      })

      watchdog['monitoredPid'] = mockPid
      watchdog['isMonitoring'] = true

      await watchdog['performHealthCheck']()

      expect(healthCheckFailed).toBe(true)
      expect(failureReason).toContain('Memory usage too high')
      expect(failureReason).toContain('150MB > 100MB')
    })

    test('should detect high CPU usage', async () => {
      const mockPid = 1234

      jest.spyOn(watchdog as any, 'isProcessRunning').mockReturnValue(true)
      jest.spyOn(watchdog as any, 'httpHealthCheck').mockResolvedValue({ ok: true })
      
      // Mock high CPU usage (75% > 50% limit)
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: '25600  75.5  01:00', // 25MB, 75.5% CPU
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'ps',
        args: []
      })

      let healthCheckFailed = false
      let failureReason = ''
      watchdog.on('health-check-failed', (health, reason) => {
        healthCheckFailed = true
        failureReason = reason
      })

      watchdog['monitoredPid'] = mockPid
      watchdog['isMonitoring'] = true

      await watchdog['performHealthCheck']()

      expect(healthCheckFailed).toBe(true)
      expect(failureReason).toContain('CPU usage too high')
      expect(failureReason).toContain('75.5% > 50%')
    })

    test('should handle process not running', async () => {
      const mockPid = 1234

      jest.spyOn(watchdog as any, 'isProcessRunning').mockReturnValue(false)

      let healthCheckFailed = false
      let failureReason = ''
      watchdog.on('health-check-failed', (health, reason) => {
        healthCheckFailed = true
        failureReason = reason
      })

      watchdog['monitoredPid'] = mockPid
      watchdog['isMonitoring'] = true

      await watchdog['performHealthCheck']()

      expect(healthCheckFailed).toBe(true)
      expect(failureReason).toContain('Process is not running')
    })
  })

  describe('Cross-Platform Compatibility', () => {
    test('should use appropriate metrics collection for platform', async () => {
      const originalPlatform = process.platform

      // Test Windows
      Object.defineProperty(process, 'platform', { value: 'win32' })
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: '{"WorkingSet":52428800,"CPU":1.5,"StartTime":"2024-01-01T00:00:00Z"}',
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'win32',
        command: 'powershell',
        args: []
      })

      let metrics = await watchdog['getProcessMetrics'](1234)
      expect(metrics.memoryMB).toBe(50)

      // Test Linux
      Object.defineProperty(process, 'platform', { value: 'linux' })
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: '51200  2.5  01:30',
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'ps',
        args: []
      })

      metrics = await watchdog['getProcessMetrics'](1234)
      expect(metrics.memoryMB).toBe(50)

      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    test('should handle platform-specific command failures', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'darwin' })

      mockExecuteCommand.mockResolvedValue({
        success: false,
        exitCode: 1,
        signal: null,
        stdout: '',
        stderr: 'Command not found',
        duration: 100,
        retryCount: 0,
        platform: 'darwin',
        command: 'ps',
        args: []
      })

      const metrics = await watchdog['getProcessMetrics'](1234)
      
      // Should return fallback values
      expect(metrics.memoryMB).toBe(0)
      expect(metrics.cpuPercent).toBe(0)
      expect(typeof metrics.uptime).toBe('number')

      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })
  })

  describe('Response Time Monitoring', () => {
    test('should monitor HTTP response times', async () => {
      const mockPid = 1234

      jest.spyOn(watchdog as any, 'isProcessRunning').mockReturnValue(true)
      
      // Mock slow HTTP response
      jest.spyOn(watchdog as any, 'httpHealthCheck').mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ ok: true }), 1500) // 1.5 second delay
        })
      })
      
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: '25600  1.2  00:45',
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'ps',
        args: []
      })

      let healthCheckFailed = false
      let failureReason = ''
      watchdog.on('health-check-failed', (health, reason) => {
        healthCheckFailed = true
        failureReason = reason
      })

      watchdog['monitoredPid'] = mockPid
      watchdog['isMonitoring'] = true

      await watchdog['performHealthCheck']()

      expect(healthCheckFailed).toBe(true)
      expect(failureReason).toContain('Response time too slow')
      expect(failureReason).toContain('1000ms') // Max response time limit
    })
  })
})