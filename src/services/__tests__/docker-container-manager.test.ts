import { DockerContainerManager } from '../docker-container-manager'
import { executeCommand } from '../../utils/cross-platform-executor'

// Mock the cross-platform executor
jest.mock('../../utils/cross-platform-executor')
const mockExecuteCommand = executeCommand as jest.MockedFunction<typeof executeCommand>

describe('DockerContainerManager', () => {
  let manager: DockerContainerManager

  beforeEach(() => {
    manager = new DockerContainerManager({
      healthCheckInterval: 1000,
      statsCollectionInterval: 2000,
      containerTimeout: 5000
    })
    jest.clearAllMocks()
  })

  afterEach(async () => {
    if (manager) {
      await manager.stop()
    }
  })

  describe('Container Discovery', () => {
    test('should discover containers successfully', async () => {
      const mockContainerOutput = JSON.stringify({
        ID: 'abc123',
        Names: 'test-container',
        Image: 'nginx:latest',
        State: 'running',
        Status: 'Up 5 minutes',
        Ports: '80/tcp',
        CreatedAt: '2024-01-01T00:00:00Z'
      })

      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: mockContainerOutput,
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'docker',
        args: ['ps', '-a', '--format', 'json']
      })

      const containers = await manager.discoverContainers()

      expect(containers).toHaveLength(1)
      expect(containers[0].id).toBe('abc123')
      expect(containers[0].name).toBe('test-container')
      expect(containers[0].status).toBe('running')
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'docker',
        ['ps', '-a', '--format', 'json'],
        expect.any(Object)
      )
    })

    test('should handle discovery errors gracefully', async () => {
      mockExecuteCommand.mockResolvedValue({
        success: false,
        exitCode: 1,
        signal: null,
        stdout: '',
        stderr: 'Docker not running',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'docker',
        args: ['ps', '-a', '--format', 'json']
      })

      await expect(manager.discoverContainers()).rejects.toThrow('Failed to list containers')
    })
  })

  describe('Container Health Checks', () => {
    test('should check container health', async () => {
      const mockContainer = {
        id: 'abc123',
        name: 'test-container',
        image: 'nginx:latest',
        status: 'running',
        state: 'Up 5 minutes',
        health: 'healthy',
        ports: ['80/tcp'],
        created: new Date(),
        uptime: 300000,
        restartCount: 0
      }

      const mockHealthOutput = JSON.stringify({
        Status: 'healthy',
        FailingStreak: 0,
        Log: []
      })

      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: mockHealthOutput,
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'docker',
        args: ['inspect', 'abc123', '--format', '{{json .State.Health}}']
      })

      const healthCheck = await manager.checkContainerHealth(mockContainer)

      expect(healthCheck.status).toBe('healthy')
      expect(healthCheck.containerId).toBe('abc123')
      expect(healthCheck.failingStreak).toBe(0)
    })

    test('should handle containers without health checks', async () => {
      const mockContainer = {
        id: 'abc123',
        name: 'test-container',
        image: 'nginx:latest',
        status: 'running',
        state: 'Up 5 minutes',
        health: 'none',
        ports: ['80/tcp'],
        created: new Date(),
        uptime: 300000,
        restartCount: 0
      }

      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: 'null',
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'docker',
        args: ['inspect', 'abc123', '--format', '{{json .State.Health}}']
      })

      const healthCheck = await manager.checkContainerHealth(mockContainer)

      expect(healthCheck.status).toBe('healthy') // Running container without health check
      expect(healthCheck.containerId).toBe('abc123')
    })
  })

  describe('Container Statistics', () => {
    test('should collect container statistics', async () => {
      // Mock container discovery first
      const mockContainerOutput = JSON.stringify({
        ID: 'abc123',
        Names: 'test-container',
        Image: 'nginx:latest',
        State: 'running',
        Status: 'Up 5 minutes',
        Ports: '80/tcp',
        CreatedAt: '2024-01-01T00:00:00Z'
      })

      const mockStatsOutput = JSON.stringify({
        Container: 'abc123',
        Name: 'test-container',
        CPUPerc: '5.25%',
        MemUsage: '128MiB / 1GiB',
        MemPerc: '12.5%',
        NetIO: '1.2kB / 2.4kB',
        BlockIO: '0B / 0B',
        PIDs: '10'
      })

      mockExecuteCommand
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          signal: null,
          stdout: mockContainerOutput,
          stderr: '',
          duration: 100,
          retryCount: 0,
          platform: 'linux',
          command: 'docker',
          args: ['ps', '-a', '--format', 'json']
        })
        .mockResolvedValueOnce({
          success: true,
          exitCode: 0,
          signal: null,
          stdout: mockStatsOutput,
          stderr: '',
          duration: 100,
          retryCount: 0,
          platform: 'linux',
          command: 'docker',
          args: ['stats', '--no-stream', '--format', 'json', 'abc123']
        })

      await manager.discoverContainers()
      await manager.collectContainerStats()

      const stats = manager.getContainerStats('abc123')
      expect(stats).toHaveLength(1)
      expect(stats[0].cpuPercent).toBe(5.25)
      expect(stats[0].memoryPercent).toBe(12.5)
      expect(stats[0].containerName).toBe('test-container')
    })
  })

  describe('Container Operations', () => {
    test('should restart container successfully', async () => {
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: 'abc123',
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'docker',
        args: ['restart', 'abc123']
      })

      const result = await manager.restartContainer('abc123')

      expect(result).toBe(true)
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'docker',
        ['restart', 'abc123'],
        expect.any(Object)
      )
    })

    test('should stop container successfully', async () => {
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: 'abc123',
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'docker',
        args: ['stop', '-t', '10', 'abc123']
      })

      const result = await manager.stopContainer('abc123', 10)

      expect(result).toBe(true)
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'docker',
        ['stop', '-t', '10', 'abc123'],
        expect.any(Object)
      )
    })

    test('should start container successfully', async () => {
      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: 'abc123',
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'docker',
        args: ['start', 'abc123']
      })

      const result = await manager.startContainer('abc123')

      expect(result).toBe(true)
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'docker',
        ['start', 'abc123'],
        expect.any(Object)
      )
    })
  })

  describe('Manager Status', () => {
    test('should return correct manager status', () => {
      const status = manager.getManagerStatus()

      expect(status).toEqual({
        isMonitoring: false,
        containerCount: 0,
        healthyContainers: 0,
        unhealthyContainers: 0,
        runningContainers: 0,
        restartAttempts: 0
      })
    })
  })

  describe('Event Handling', () => {
    test('should emit events during monitoring', (done) => {
      const mockContainerOutput = JSON.stringify({
        ID: 'abc123',
        Names: 'test-container',
        Image: 'nginx:latest',
        State: 'running',
        Status: 'Up 5 minutes',
        Ports: '80/tcp',
        CreatedAt: '2024-01-01T00:00:00Z'
      })

      mockExecuteCommand.mockResolvedValue({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: mockContainerOutput,
        stderr: '',
        duration: 100,
        retryCount: 0,
        platform: 'linux',
        command: 'docker',
        args: ['ps', '-a', '--format', 'json']
      })

      manager.on('containers-discovered', (containers) => {
        expect(containers).toHaveLength(1)
        expect(containers[0].name).toBe('test-container')
        done()
      })

      manager.discoverContainers()
    })
  })
})